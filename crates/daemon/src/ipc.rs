use crate::state::SharedState;
use macropad_ipc::{IpcCommand, IpcResponse};
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::oneshot;

#[cfg(windows)]
use macropad_ipc::PIPE_NAME;

#[cfg(not(windows))]
use macropad_ipc::SOCKET_PATH;

#[cfg(windows)]
use tokio::net::windows::named_pipe::{NamedPipeServer, ServerOptions};

#[derive(Debug, Error)]
pub enum IpcError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
}

pub async fn start_ipc_server(state: SharedState) -> Result<(), IpcError> {
    #[cfg(windows)]
    {
        start_windows_pipe(state).await
    }

    #[cfg(not(windows))]
    {
        start_unix_socket(state).await
    }
}

#[cfg(windows)]
async fn start_windows_pipe(state: SharedState) -> Result<(), IpcError> {
    println!("[ipc] listening on {}", PIPE_NAME);

    loop {
        let server = ServerOptions::new()
            .first_pipe_instance(false)
            .create(PIPE_NAME)?;

        server.connect().await?;

        let state_clone = state.clone();
        tokio::spawn(async move {
            handle_connection_windows(server, state_clone).await;
        });
    }
}

#[cfg(windows)]
async fn handle_connection_windows(pipe: NamedPipeServer, state: SharedState) {
    let (reader, mut writer) = tokio::io::split(pipe);
    let mut lines = BufReader::new(reader).lines();

    while let Ok(Some(line)) = lines.next_line().await {
        let response = match serde_json::from_str::<IpcCommand>(&line) {
            Ok(cmd) => handle_command(cmd, &state).await,
            Err(e)  => IpcResponse::Error { message: e.to_string() },
        };

        let mut json = serde_json::to_string(&response).unwrap_or_default();
        json.push('\n');
        let _ = writer.write_all(json.as_bytes()).await;
    }
}

#[cfg(not(windows))]
async fn start_unix_socket(state: SharedState) -> Result<(), IpcError> {
    use tokio::net::UnixListener;

    if std::path::Path::new(SOCKET_PATH).exists() {
        std::fs::remove_file(SOCKET_PATH)?;
    }

    let listener = UnixListener::bind(SOCKET_PATH)?;
    println!("[ipc] listening on {}", SOCKET_PATH);

    loop {
        let (stream, _) = listener.accept().await?;
        let state_clone = state.clone();
        tokio::spawn(async move {
            handle_connection_unix(stream, state_clone).await;
        });
    }
}

#[cfg(not(windows))]
async fn handle_connection_unix(stream: tokio::net::UnixStream, state: SharedState) {
    let (reader, mut writer) = stream.into_split();
    let mut lines = BufReader::new(reader).lines();

    while let Ok(Some(line)) = lines.next_line().await {
        let response = match serde_json::from_str::<IpcCommand>(&line) {
            Ok(cmd) => handle_command(cmd, &state).await,
            Err(e)  => IpcResponse::Error { message: e.to_string() },
        };

        let mut json = serde_json::to_string(&response).unwrap_or_default();
        json.push('\n');
        let _ = writer.write_all(json.as_bytes()).await;
    }
}

async fn handle_command(cmd: IpcCommand, state: &SharedState) -> IpcResponse {
    match cmd {
        IpcCommand::Ping => IpcResponse::Pong,

        IpcCommand::Status => {
            let s = state.lock().unwrap();
            IpcResponse::Status {
                status:      format!("{:?}", s.status),
                last_result: s.last_result,
            }
        }

        IpcCommand::ListMacros => {
            let s     = state.lock().unwrap();
            let names = s.macros.keys().cloned().collect();
            IpcResponse::Macros { names }
        }

        IpcCommand::Play { path, speed, dry_run } => {
            let rec = match macropad_core::load(&path) {
                Ok(r)  => r,
                Err(e) => return IpcResponse::Error { message: e.to_string() },
            };

            {
                let mut s = state.lock().unwrap();
                if s.is_busy() {
                    return IpcResponse::Error { message: "daemon is busy".into() };
                }
                s.set_playing(
                    path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown"),
                );
            }

            let state_clone = state.clone();
            tokio::spawn(async move {
                let (_player, abort_rx) = macropad_core::Player::new();
                let result = macropad_core::play(
                    &rec,
                    speed,
                    dry_run.unwrap_or(false),
                    abort_rx,
                )
                .await;

                let mut s = state_clone.lock().unwrap();
                s.last_result = Some(result.is_ok());
                s.set_idle();
            });

            IpcResponse::Ok
        }

        IpcCommand::Record { output_path } => {
            {
                let mut s = state.lock().unwrap();
                if s.is_busy() {
                    return IpcResponse::Error { message: "daemon is busy".into() };
                }
                s.set_recording();
            }

            let (stop_tx, stop_rx) = oneshot::channel::<()>();

            {
                let mut s = state.lock().unwrap();
                s.record_stop_tx = Some(stop_tx);
            }

            let state_clone = state.clone();
            tokio::spawn(async move {
                match macropad_core::Recorder::start() {
                    Ok(mut recorder) => {
                        let mut events = Vec::new();

                        tokio::select! {
                            _ = async {
                                while let Some(e) = recorder.rx.recv().await {
                                    events.push(e);
                                }
                            } => {}
                            _ = stop_rx => {
                                println!("[daemon] stop signal received");
                            }
                        }

                        println!("[daemon] recording stopped, {} events captured", events.len());

                        let rec = macropad_core::models::NitsRec {
                            meta: macropad_core::models::Metadata {
                                version: 1,
                                name:    output_path
                                    .file_stem()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("recording")
                                    .into(),
                                created: chrono::Local::now().date_naive(),
                                tags:    vec![],
                            },
                            playback: macropad_core::models::PlaybackConfig::default(),
                            vars:     None,
                            events,
                        };

                        if let Err(e) = macropad_core::save(&rec, &output_path) {
                            eprintln!("[daemon] save error: {}", e);
                        } else {
                            println!("[daemon] saved to {:?}", output_path);
                        }

                        let mut s = state_clone.lock().unwrap();
                        s.record_stop_tx = None;
                        s.set_idle();
                    }
                    Err(e) => {
                        eprintln!("[daemon] recorder error: {}", e);
                        let mut s = state_clone.lock().unwrap();
                        s.set_idle();
                    }
                }
            });

            IpcResponse::Ok
        }

        IpcCommand::StopRecord => {
            let mut s = state.lock().unwrap();
            if let Some(tx) = s.record_stop_tx.take() {
                let _ = tx.send(());
                println!("[daemon] sent stop signal to recorder");
            }
            s.set_idle();
            IpcResponse::Ok
        }

        IpcCommand::StopPlayback => {
            state.lock().unwrap().set_idle();
            IpcResponse::Ok
        }
    }
}