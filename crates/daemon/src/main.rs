mod ipc;
mod scanner;
mod scheduler;
mod state;

use global_hotkey::{
    hotkey::{Code, HotKey, Modifiers},
    GlobalHotKeyEvent, GlobalHotKeyManager,
};
use ipc::start_ipc_server;
use platform::hotkey::Modifier;
use scheduler::Scheduler;
use script::run_script;
use state::{new_shared_state, SharedState};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::signal;
use tracing::{debug, error, info, warn};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    info!("macropad-daemon starting...");

    // Resolve paths
    let config_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));

    let hotkeys_path = config_dir.join("hotkeys.toml");
    let schedule_path = config_dir.join("schedule.toml");

    let state = new_shared_state(hotkeys_path);
    let scheduler = Arc::new(Scheduler::new(state.clone(), schedule_path));

    // Start scheduler background loop (non-blocking spawn inside)
    scheduler.run().await;

    // Start Global Hotkey Listener in a dedicated thread (important for Windows COM/Message loops)
    let state_hk = state.clone();
    let runtime_handle = tokio::runtime::Handle::current();
    std::thread::spawn(move || {
        let manager = match GlobalHotKeyManager::new() {
            Ok(m) => m,
            Err(e) => {
                error!("failed to initialize hotkey manager: {}", e);
                return;
            }
        };

        let mut id_to_path = std::collections::HashMap::new();

        // Register all hotkeys from state on startup
        {
            let s = state_hk.lock().unwrap();
            for (hk, path) in s.hotkeys.all_bindings() {
                if let Some(ghk) = convert_to_global_hotkey(hk) {
                    if let Err(e) = manager.register(ghk) {
                        error!(
                            "failed to register hotkey {}: {}",
                            hk.to_display_string(),
                            e
                        );
                    } else {
                        let id = ghk.id();
                        id_to_path.insert(id, PathBuf::from(path));
                        debug!("registered hotkey {} -> {}", hk.to_display_string(), path);
                    }
                }
            }
        }

        let receiver = GlobalHotKeyEvent::receiver();
        loop {
            if let Ok(event) = receiver.try_recv() {
                if event.state == global_hotkey::HotKeyState::Pressed {
                    if let Some(path) = id_to_path.get(&event.id) {
                        info!("hotkey triggered: {:?}", path);
                        let path_clone = path.clone();
                        let state_clone = state_hk.clone();

                        // We are in a std thread, so we need a handle to the tokio runtime to spawn the trigger
                        runtime_handle.spawn(async move {
                            trigger_macro_background(path_clone, state_clone).await;
                        });
                    }
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
    });

    // Start Singleton Recorder Hook (rdev)
    {
        let state_rec = state.clone();
        std::thread::spawn(move || {
            use macropad_core::recorder::convert_event;
            use rdev::listen;
            use std::time::Instant;

            let start = Instant::now();
            let event_bus = {
                let s = state_rec.lock().unwrap();
                s.event_bus.clone()
            };

            println!(">>DEBUG: Daemon: Starting singleton OS event hook...");

            let callback = move |rdev_event: rdev::Event| {
                let time_ms = start.elapsed().as_millis() as u64;
                if let Some(event) = convert_event(rdev_event, time_ms) {
                    // Broadcast to all potential subscribers (recording tasks)
                    let _ = event_bus.send(event);
                }
            };

            if let Err(e) = listen(callback) {
                error!("Daemon: Singleton OS Hook - listen error: {:?}", e);
            }
        });
    }

    let shutdown = async {
        signal::ctrl_c()
            .await
            .expect("failed to install CTRL+C handler");
        info!("shutdown signal received");
    };

    info!("macropad-daemon services ready");

    tokio::select! {
        res = start_ipc_server(state, scheduler) => {
            if let Err(e) = res {
                error!("IPC server error: {}", e);
                std::process::exit(1);
            }
        }
        _ = shutdown => {
            info!("daemon shutting down gracefully");
        }
    }
}

async fn trigger_macro_background(path: PathBuf, state: SharedState) {
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("macro");
    {
        let mut s = state.lock().unwrap();
        if s.is_busy() {
            warn!("skipping hotkey trigger — daemon is busy");
            return;
        }
        s.set_playing(name);
    }

    let is_script = path.extension().map_or(false, |e| e == "mps");
    let result = if is_script {
        run_script(&path, false, None)
            .await
            .map_err(|e| e.to_string())
    } else {
        match macropad_core::load(&path) {
            Ok(rec) => {
                let (_player, abort_rx) = macropad_core::Player::new();
                macropad_core::play(&rec, None, false, abort_rx, None)
                    .await
                    .map_err(|e| e.to_string())
            }
            Err(e) => Err(e.to_string()),
        }
    };

    let mut s = state.lock().unwrap();
    s.last_result = Some(result.is_ok());
    s.set_idle();
}

fn convert_to_global_hotkey(hk: &platform::hotkey::Hotkey) -> Option<HotKey> {
    let mut mods = Modifiers::empty();
    for m in &hk.modifiers {
        match m {
            Modifier::Ctrl => mods.insert(Modifiers::CONTROL),
            Modifier::Alt => mods.insert(Modifiers::ALT),
            Modifier::Shift => mods.insert(Modifiers::SHIFT),
            Modifier::Meta => mods.insert(Modifiers::SUPER),
        }
    }

    let code = match hk.key.to_lowercase().as_str() {
        "a" => Code::KeyA,
        "b" => Code::KeyB,
        "c" => Code::KeyC,
        "d" => Code::KeyD,
        "e" => Code::KeyE,
        "f" => Code::KeyF,
        "g" => Code::KeyG,
        "h" => Code::KeyH,
        "i" => Code::KeyI,
        "j" => Code::KeyJ,
        "k" => Code::KeyK,
        "l" => Code::KeyL,
        "m" => Code::KeyM,
        "n" => Code::KeyN,
        "o" => Code::KeyO,
        "p" => Code::KeyP,
        "q" => Code::KeyQ,
        "r" => Code::KeyR,
        "s" => Code::KeyS,
        "t" => Code::KeyT,
        "u" => Code::KeyU,
        "v" => Code::KeyV,
        "w" => Code::KeyW,
        "x" => Code::KeyX,
        "y" => Code::KeyY,
        "z" => Code::KeyZ,
        "0" => Code::Digit0,
        "1" => Code::Digit1,
        "2" => Code::Digit2,
        "3" => Code::Digit3,
        "4" => Code::Digit4,
        "5" => Code::Digit5,
        "6" => Code::Digit6,
        "7" => Code::Digit7,
        "8" => Code::Digit8,
        "9" => Code::Digit9,
        "f1" => Code::F1,
        "f2" => Code::F2,
        "f3" => Code::F3,
        "f4" => Code::F4,
        "f5" => Code::F5,
        "f6" => Code::F6,
        "f7" => Code::F7,
        "f8" => Code::F8,
        "f9" => Code::F9,
        "f10" => Code::F10,
        "f11" => Code::F11,
        "f12" => Code::F12,
        "space" => Code::Space,
        "enter" => Code::Enter,
        "backspace" => Code::Backspace,
        "tab" => Code::Tab,
        "escape" => Code::Escape,
        _ => return None,
    };

    Some(HotKey::new(Some(mods), code))
}
