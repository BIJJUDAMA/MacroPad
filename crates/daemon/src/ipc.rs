use crate::state::SharedState;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

#[cfg(windows)]
use tokio::net::windows::named_pipe::{NamedPipeServer, ServerOptions};

#[cfg(unix)]
use tokio::net::{UnixListener, UnixStream};

// IPC pipe name / socket path
#[cfg(windows)]
pub const PIPE_NAME: &str = r"\\.\pipe\macropad-daemon";

#[cfg(unix)]
pub const SOCKET_PATH: &str = "/tmp/macropad-daemon.sock";

#[derive(Debug, Error)]
pub enum IpcError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("daemon is busy")]
    Busy,
    #[error("macro not found: {0}")]
    MacroNotFound(String),
}

// commands the CLI / GUI send to the daemon
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "cmd", rename_all = "snake_case")]
pub enum IpcCommand {
    Play {
        path:     PathBuf,
        speed:    Option<f64>,
        dry_run:  Option<bool>,
    },
    Record {
        output_path: PathBuf,
    },
    StopRecord,
    StopPlayback,
    Status,
    ListMacros,
    Ping,
}

// responses the daemon sends back
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum IpcResponse {
    Ok,
    Pong,
    Error   { message: String },
    Status  { status: String, last_result: Option<bool> },
    Macros  { names: Vec<String> },
}

pub async fn start_ipc_server(state: SharedState) -> Result<(), IpcError> {
    #[cfg(windows)]
    {
        start_windows_pipe(state).await
    }

    #[cfg(unix)]
    {
        start_unix_socket(state).await
    }
}

// Windows named pipe 

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

// Unix socket

#[cfg(unix)]
async fn start_unix_socket(state: SharedState) -> Result<(), IpcError> {
    if std::path::Path::new(SOCKET_PATH).exists() {
        std::fs::remove_file(SOCKET_PATH)?;
    }

    let listener = UnixListener::bind(SOCKET_PATH)?;
    println!("[ipc] listening on {}", SOCKET_PATH);

    loop {
        let (stream, _) = listener.accept().await?;
        let state_clone  = state.clone();
        tokio::spawn(async move {
            handle_connection_unix(stream, state_clone).await;
        });
    }
}

#[cfg(unix)]
async fn handle_connection_unix(stream: UnixStream, state: SharedState) {
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

// Command handler 
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
            let s = state.lock().unwrap();
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
                let (_, abort_rx) = macropad_core::Player::new();
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
            let mut s = state.lock().unwrap();
            if s.is_busy() {
                return IpcResponse::Error { message: "daemon is busy".into() };
            }
            s.set_recording();
            drop(s);

            let state_clone = state.clone();
            tokio::spawn(async move {
                match macropad_core::Recorder::start() {
                    Ok(mut recorder) => {
                        let mut events = Vec::new();

                        // collect events until StopRecord is received via state
                        loop {
                            tokio::select! {
                                Some(event) = recorder.rx.recv() => {
                                    events.push(event);
                                }
                                _ = tokio::time::sleep(
                                    std::time::Duration::from_millis(100)
                                ) => {
                                    let s = state_clone.lock().unwrap();
                                    if s.status != crate::state::PlaybackStatus::Recording {
                                        break;
                                    }
                                }
                            }
                        }

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
                        }
                    }
                    Err(e) => eprintln!("[daemon] recorder error: {}", e),
                }
            });

            IpcResponse::Ok
        }

        IpcCommand::StopRecord => {
            let mut s = state.lock().unwrap();
            s.set_idle();
            IpcResponse::Ok
        }

        IpcCommand::StopPlayback => {
            let mut s = state.lock().unwrap();
            s.set_idle();
            IpcResponse::Ok
        }
    }
}