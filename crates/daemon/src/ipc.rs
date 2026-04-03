use crate::scheduler::Scheduler;
use crate::state::SharedState;
use macropad_ipc::{IpcCommand, IpcResponse};
use script::run_script;
use std::sync::Arc;
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::oneshot;
use tracing::{debug, error, info, warn};

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

pub async fn start_ipc_server(
    state: SharedState,
    scheduler: Arc<Scheduler>,
) -> Result<(), IpcError> {
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
async fn handle_connection_windows(
    pipe: NamedPipeServer,
    state: SharedState,
    scheduler: Arc<Scheduler>,
) {
    let (reader, mut writer) = tokio::io::split(pipe);
    let mut lines = BufReader::new(reader).lines();

    while let Ok(Some(line)) = lines.next_line().await {
        let response = match serde_json::from_str::<IpcCommand>(&line) {
            Ok(cmd) => handle_command(cmd, &state, &scheduler).await,
            Err(e) => IpcResponse::Error {
                message: e.to_string(),
            },
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
async fn handle_connection_unix(
    stream: tokio::net::UnixStream,
    state: SharedState,
    scheduler: Arc<Scheduler>,
) {
    let (reader, mut writer) = stream.into_split();
    let mut lines = BufReader::new(reader).lines();

    while let Ok(Some(line)) = lines.next_line().await {
        let response = match serde_json::from_str::<IpcCommand>(&line) {
            Ok(cmd) => handle_command(cmd, &state, &scheduler).await,
            Err(e) => IpcResponse::Error {
                message: e.to_string(),
            },
        };

        let mut json = serde_json::to_string(&response).unwrap_or_default();
        json.push('\n');
        let _ = writer.write_all(json.as_bytes()).await;
    }
}

async fn handle_command(
    cmd: IpcCommand,
    state: &SharedState,
    scheduler: &Arc<Scheduler>,
) -> IpcResponse {
    match cmd {
        IpcCommand::Ping => IpcResponse::Pong,

        IpcCommand::Status => {
            let s = state.lock().unwrap();
            IpcResponse::Status {
                status: format!("{:?}", s.status),
                last_result: s.last_result,
            }
        }

        IpcCommand::ListMacros {
            mpr_paths,
            mps_paths,
        } => {
            let mut s = state.lock().unwrap();
            s.refresh_macros(&mpr_paths, &mps_paths);
            let items = s
                .macros
                .iter()
                .map(|(path, meta)| macropad_ipc::MacroItem {
                    path: std::path::PathBuf::from(path),
                    meta: meta.clone(),
                })
                .collect();
            IpcResponse::Macros { items }
        }

        IpcCommand::Play {
            path,
            speed,
            dry_run,
            vars,
            overrides,
        } => {
            let is_script = path.extension().map_or(false, |e| e == "mps");

            if is_script {
                {
                    let mut s = state.lock().unwrap();
                    if s.is_busy() {
                        return IpcResponse::Error {
                            message: "daemon is busy".into(),
                        };
                    }
                    s.set_playing(
                        path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("script"),
                    );
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
                Ok(r) => r,
                Err(e) => {
                    return IpcResponse::Error {
                        message: e.to_string(),
                    }
                }
            };

            if let Some(ov) = overrides {
                if let Some(s) = ov.speed {
                    rec.playback.speed = s;
                }
                if let Some(l) = ov.loop_count {
                    rec.playback.loop_count = l;
                }
                if let Some(m) = ov.skip_mouse_move {
                    rec.playback.skip_mouse_move = m;
                }
                if let Some(c) = ov.scale_to_current {
                    rec.playback.scale_to_current = c;
                }
                if let Some(w) = ov.wait_for_window {
                    rec.playback.wait_for_window = Some(w);
                }
                if let Some(t) = ov.wait_timeout_ms {
                    rec.playback.wait_timeout_ms = t;
                }
            }

            {
                let mut s = state.lock().unwrap();
                if s.is_busy() {
                    return IpcResponse::Error {
                        message: "daemon is busy".into(),
                    };
                }
                s.set_playing(
                    path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown"),
                );
            }

            let state_clone = state.clone();
            std::thread::spawn(move || {
                let (_player, abort_rx) = macropad_core::Player::new();
                let result = macropad_core::play(
                    &rec,
                    speed,
                    dry_run.unwrap_or(false),
                    abort_rx,
                    vars.as_ref(),
                );
                let mut s = state_clone.lock().unwrap();
                s.last_result = Some(result.is_ok());
                s.set_idle();
            });

            IpcResponse::Ok
        }

        IpcCommand::Record { output_path, .. } => {
            let mut rx = {
                let s = state.lock().unwrap();
                if s.is_busy() {
                    return IpcResponse::Error {
                        message: "daemon is busy".into(),
                    };
                }
                s.event_bus.subscribe()
            };
            {
                let mut s = state.lock().unwrap();
                s.set_recording();
            }

            info!(
                "Daemon: IpcCommand::Record received for path: {:?}",
                output_path
            );

            let (stop_tx, stop_rx) = oneshot::channel();
            let (done_tx, done_rx) = oneshot::channel();
            {
                let mut s = state.lock().unwrap();
                s.record_stop_tx = Some(stop_tx);
                s.record_done_rx = Some(done_rx);
            }

            let state_clone = state.clone();
            let output_path = output_path.clone();

            tokio::spawn(async move {
                info!("Daemon: Capture task spawned for {:?}", output_path);
                let mut events_arr = Vec::new();
                let mut stop_rx = stop_rx;
                loop {
                    tokio::select! {
                        res = rx.recv() => {
                            match res {
                                Ok(e) => {
                                    // HIGH-VISIBILITY LOGGING FOR DEBUGGING
                                    if let Some(ref k) = e.key {
                                        println!(">>REC_DEBUG: Daemon Captured Key: '{}' (Type: {:?})", k, e.event_type);
                                    }

                                    // ROBUST STOP HOTKEY CHECK (F9 / f9)
                                    let is_f9 = e.key.as_deref().map(|s| s.to_lowercase()).map(|s| {
                                        s == "f9" || s == "[f9]" || s == "function_9"
                                    }).unwrap_or(false);

                                    if is_f9 && (e.event_type == macropad_core::models::EventType::KeyDown || e.event_type == macropad_core::models::EventType::KeyUp)
                                    {
                                        println!(">>REC_STOP: F9 Global Stop Hotkey detected! Finalizing...");
                                        info!("Daemon: F9 Global Stop Hotkey detected. Finalizing recording.");
                                        break;
                                    }
                                    events_arr.push(e);
                                }
                                Err(tokio::sync::broadcast::error::RecvError::Lagged(cnt)) => {
                                    warn!("Daemon: Event channel lagged behind by {} messages", cnt);
                                }
                                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                                    error!("Daemon: Event channel closed unexpectedly!");
                                    break;
                                }
                            }
                        }
                        _ = &mut stop_rx => {
                            debug!("Daemon: Stop signal received during recording collection");
                            break;
                        }
                    }
                }

                // Drain any remaining messages (IMPORTANT: ensure all events before the stop signal are flushed)
                let mut extra_count = 0;
                while let Ok(e) = rx.try_recv() {
                    events_arr.push(e);
                    extra_count += 1;
                }
                if extra_count > 0 {
                    debug!("Daemon: Drained {} extra events from buffer.", extra_count);
                }

                info!(
                    "Daemon: Recording finished. Captured {} raw events.",
                    events_arr.len()
                );
                let events = macropad_core::recorder::consolidate_mouse_segments(&events_arr);
                info!(
                    "Daemon: Finalized recording with {} consolidated events.",
                    events.len()
                );

                let rec = macropad_core::models::MacropadRec {
                    meta: macropad_core::models::Metadata {
                        version: 1,
                        name: output_path
                            .file_stem()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string(),
                        tags: Vec::new(),
                        created: chrono::Local::now().date_naive(),
                        requires: Vec::new(),
                        origin_type: macropad_core::models::OriginType::Recording,
                        line_count: None,
                        command_count: None,
                    },
                    playback: macropad_core::models::PlaybackConfig::default(),
                    vars: None,
                    events,
                };

                info!("Daemon: Saving recording to {:?}", output_path);
                if let Err(e) = macropad_core::save(&rec, &output_path) {
                    error!("Daemon: Save error: {}", e);
                } else {
                    info!("Daemon: File saved successfully.");
                }

                let mut s = state_clone.lock().unwrap();
                s.record_stop_tx = None;
                s.record_done_rx = None;
                s.set_idle();
                let _ = done_tx.send(());

                // Signal to GUI backend that recording is finished with full path
                println!(">>REC_STOPPED: {:?}<<", output_path);
            });

            IpcResponse::Ok
        }

        IpcCommand::StopRecord => {
            info!("Daemon: IpcCommand::StopRecord received.");
            let done_rx = {
                let mut s = state.lock().unwrap();
                if let Some(tx) = s.record_stop_tx.take() {
                    let _ = tx.send(());
                }
                s.record_done_rx.take()
            };

            if let Some(rx) = done_rx {
                info!("Daemon: Waiting for recording task to finalize save...");
                let _ = rx.await;
                info!("Daemon: Recording task finalized. Responding to GUI.");
            }

            IpcResponse::Ok
        }

        IpcCommand::StopPlayback => {
            state.lock().unwrap().set_idle();
            IpcResponse::Ok
        }

        IpcCommand::SetHotkey {
            macro_path,
            hotkey_str,
        } => {
            use platform::hotkey::Hotkey;
            let hk = match Hotkey::parse(&hotkey_str) {
                Ok(h) => h,
                Err(e) => {
                    return IpcResponse::Error {
                        message: e.to_string(),
                    }
                }
            };
            {
                let mut s = state.lock().unwrap();
                if let Err(e) = s.hotkeys.register(hk, &macro_path.to_string_lossy()) {
                    return IpcResponse::Error {
                        message: e.to_string(),
                    };
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
                IpcResponse::Error {
                    message: format!("task {} not found", id),
                }
            }
        }

        IpcCommand::GetScheduledTasks => IpcResponse::ScheduledTasks {
            tasks: scheduler.list_tasks(),
        },
    }
}
