use crate::state::SharedState;
use crate::scheduler::Scheduler;
use macropad_ipc::{IpcCommand, IpcResponse, ScheduledTask};
use std::sync::Arc;
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::oneshot;
use macropad_core::recorder::consolidate_mouse_segments;
use tracing::{info, error, debug, warn};
use script::run_script;

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

pub async fn start_ipc_server(state: SharedState, scheduler: Arc<Scheduler>) -> Result<(), IpcError> {
    #[cfg(windows)]
    {
        start_windows_pipe(state, scheduler).await
    }

    #[cfg(not(windows))]
    {
        start_unix_socket(state, scheduler).await
    }
}

#[cfg(windows)]
async fn start_windows_pipe(state: SharedState, scheduler: Arc<Scheduler>) -> Result<(), IpcError> {
    info!("listening on pipe: {}", PIPE_NAME);

    loop {
        let server = ServerOptions::new()
            .first_pipe_instance(false)
            .create(PIPE_NAME)?;

        server.connect().await?;

        let state_clone = state.clone();
        let scheduler_clone = scheduler.clone();
        tokio::spawn(async move {
            handle_connection_windows(server, state_clone, scheduler_clone).await;
        });
    }
}

#[cfg(windows)]
async fn handle_connection_windows(pipe: NamedPipeServer, state: SharedState, scheduler: Arc<Scheduler>) {
    let (reader, mut writer) = tokio::io::split(pipe);
    let mut lines = BufReader::new(reader).lines();

    while let Ok(Some(line)) = lines.next_line().await {
        let response = match serde_json::from_str::<IpcCommand>(&line) {
            Ok(cmd) => handle_command(cmd, &state, &scheduler).await,
            Err(e)  => IpcResponse::Error { message: e.to_string() },
        };

        let mut json = serde_json::to_string(&response).unwrap_or_default();
        json.push('\n');
        let _ = writer.write_all(json.as_bytes()).await;
    }
}

#[cfg(not(windows))]
async fn start_unix_socket(state: SharedState, scheduler: Arc<Scheduler>) -> Result<(), IpcError> {
    use tokio::net::UnixListener;

    if std::path::Path::new(SOCKET_PATH).exists() {
        std::fs::remove_file(SOCKET_PATH)?;
    }

    let listener = UnixListener::bind(SOCKET_PATH)?;
    info!("listening on socket: {}", SOCKET_PATH);

    loop {
        let (stream, _) = listener.accept().await?;
        let state_clone = state.clone();
        let scheduler_clone = scheduler.clone();
        tokio::spawn(async move {
            handle_connection_unix(stream, state_clone, scheduler_clone).await;
        });
    }
}

#[cfg(not(windows))]
async fn handle_connection_unix(stream: tokio::net::UnixStream, state: SharedState, scheduler: Arc<Scheduler>) {
    let (reader, mut writer) = stream.into_split();
    let mut lines = BufReader::new(reader).lines();

    while let Ok(Some(line)) = lines.next_line().await {
        let response = match serde_json::from_str::<IpcCommand>(&line) {
            Ok(cmd) => handle_command(cmd, &state, &scheduler).await,
            Err(e)  => IpcResponse::Error { message: e.to_string() },
        };

        let mut json = serde_json::to_string(&response).unwrap_or_default();
        json.push('\n');
        let _ = writer.write_all(json.as_bytes()).await;
    }
}

async fn handle_command(cmd: IpcCommand, state: &SharedState, scheduler: &Arc<Scheduler>) -> IpcResponse {
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

        IpcCommand::Play { path, speed, dry_run, vars, overrides } => {
            let is_script = path.extension().map_or(false, |e| e == "mps");

            if is_script {
                {
                    let mut s = state.lock().unwrap();
                    if s.is_busy() { return IpcResponse::Error { message: "daemon is busy".into() }; }
                    s.set_playing(path.file_name().and_then(|n| n.to_str()).unwrap_or("script"));
                }
                let state_clone = state.clone();
                tokio::spawn(async move {
                    let result = run_script(&path, dry_run.unwrap_or(false), vars).await;
                    let mut s = state_clone.lock().unwrap();
                    s.last_result = Some(result.is_ok());
                    s.set_idle();
                });
                return IpcResponse::Ok;
            }

            let mut rec = match macropad_core::load(&path) {
                Ok(r)  => r,
                Err(e) => return IpcResponse::Error { message: e.to_string() },
            };

            if let Some(ov) = overrides {
                if let Some(s) = ov.speed            { rec.playback.speed = s; }
                if let Some(l) = ov.loop_count       { rec.playback.loop_count = l; }
                if let Some(m) = ov.skip_mouse_move  { rec.playback.skip_mouse_move = m; }
                if let Some(c) = ov.scale_to_current { rec.playback.scale_to_current = c; }
                if let Some(w) = ov.wait_for_window  { rec.playback.wait_for_window = Some(w); }
                if let Some(t) = ov.wait_timeout_ms  { rec.playback.wait_timeout_ms = t; }
            }

            {
                let mut s = state.lock().unwrap();
                if s.is_busy() {
                    return IpcResponse::Error { message: "daemon is busy".into() };
                }
                s.set_playing(path.file_name().and_then(|n| n.to_str()).unwrap_or("unknown"));
            }

            let state_clone = state.clone();
            tokio::spawn(async move {
                let (_player, abort_rx) = macropad_core::Player::new();
                let result = macropad_core::play(&rec, speed, dry_run.unwrap_or(false), abort_rx, vars.as_ref()).await;
                let mut s = state_clone.lock().unwrap();
                s.last_result = Some(result.is_ok());
                s.set_idle();
            });

            IpcResponse::Ok
        }

        IpcCommand::Record { output_path, .. } => {
            {
                let mut s = state.lock().unwrap();
                if s.is_busy() { return IpcResponse::Error { message: "daemon is busy".into() }; }
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
                            _ = async { while let Some(e) = recorder.rx.recv().await { events.push(e); } } => {}
                            _ = stop_rx => { debug!("stop signal received"); }
                        }
                        let events = consolidate_mouse_segments(&events);
                    let rec = macropad_core::models::MacropadRec {
                        meta: macropad_core::models::Metadata {
                            version: 1,
                            name:    output_path.file_stem().and_then(|n| n.to_str()).unwrap_or("recording").into(),
                            created: chrono::Local::now().date_naive(),
                            tags:    vec![],
                            requires: vec![],
                        },
                        playback: macropad_core::models::PlaybackConfig {
                            recorded_resolution: {
                                let (w, h) = macropad_core::player::get_screen_resolution();
                                Some([w, h])
                            },
                            ..Default::default()
                        },
                        vars:     None,
                        events,
                    };
                        if let Err(e) = macropad_core::save(&rec, &output_path) { error!("save error: {}", e); }
                        let mut s = state_clone.lock().unwrap();
                        s.record_stop_tx = None;
                        s.set_idle();
                    }
                    Err(e) => {
                        error!("recorder error: {}", e);
                        state_clone.lock().unwrap().set_idle();
                    }
                }
            });
            IpcResponse::Ok
        }

        IpcCommand::StopRecord => {
            let mut s = state.lock().unwrap();
            if let Some(tx) = s.record_stop_tx.take() { let _ = tx.send(()); }
            s.set_idle();
            IpcResponse::Ok
        }

        IpcCommand::StopPlayback => {
            state.lock().unwrap().set_idle();
            IpcResponse::Ok
        }

        IpcCommand::SetHotkey { macro_path, hotkey_str } => {
            use platform::hotkey::Hotkey;
            let hk = match Hotkey::parse(&hotkey_str) {
                Ok(h)  => h,
                Err(e) => return IpcResponse::Error { message: e.to_string() },
            };
            {
                let mut s = state.lock().unwrap();
                if let Err(e) = s.hotkeys.register(hk, &macro_path.to_string_lossy()) {
                    return IpcResponse::Error { message: e.to_string() };
                }
                let _ = s.save_hotkeys();
            }
            IpcResponse::Ok
        }

        IpcCommand::GetHotkeys => {
            let s = state.lock().unwrap();
            let mut bindings = std::collections::HashMap::new();
            for (hk, path) in s.hotkeys.all_bindings() {
                bindings.insert(hk.to_display_string(), path.clone());
            }
            IpcResponse::Hotkeys { bindings }
        }

        IpcCommand::AddScheduledTask { task } => {
            scheduler.add_task(task);
            IpcResponse::Ok
        }

        IpcCommand::RemoveScheduledTask { id } => {
            if scheduler.remove_task(&id) {
                IpcResponse::Ok
            } else {
                IpcResponse::Error { message: format!("task {} not found", id) }
            }
        }

        IpcCommand::GetScheduledTasks => {
            IpcResponse::ScheduledTasks { tasks: scheduler.list_tasks() }
        }
    }
}