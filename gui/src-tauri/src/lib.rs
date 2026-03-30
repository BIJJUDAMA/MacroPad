use macropad_ipc::{IpcCommand, IpcResponse};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State};

pub struct ConfigState {
    pub config: Mutex<macropad_core::models::AppConfig>,
    pub path: PathBuf,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MacroInfo {
    pub name:        String,
    pub path:        String,
    pub tags:        Vec<String>,
    pub created:     String,
    pub event_count: usize,
    pub speed:       f64,
    pub loop_count:  u32,
    pub requires:    Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlaybackResult {
    pub ok:      bool,
    pub message: String,
}

async fn send_ipc(cmd: IpcCommand) -> Result<IpcResponse, String> {
    macropad_ipc::client::send_command(cmd)
        .await
        .map_err(|e| e.to_string())
}

fn load_macro_info(path: &str) -> Result<MacroInfo, String> {
    let p   = PathBuf::from(path);
    let rec = macropad_core::load(&p)
        .map_err(|e| format!("failed to load {}: {}", path, e))?;

    Ok(MacroInfo {
        name:        rec.meta.name,
        path:        path.to_string(),
        tags:        rec.meta.tags,
        created:     rec.meta.created.to_string(),
        event_count: rec.events.len(),
        speed:       rec.playback.speed,
        loop_count:  rec.playback.loop_count,
        requires:    rec.meta.requires,
    })
}

#[tauri::command]
async fn list_macros() -> Result<Vec<String>, String> {
    match send_ipc(IpcCommand::ListMacros).await? {
        IpcResponse::Macros { names } => Ok(names),
        IpcResponse::Error { message } => Err(message),
        _ => Err("unexpected response".into()),
    }
}

#[tauri::command]
fn get_macro_info(path: String) -> Result<MacroInfo, String> {
    if !path.ends_with(".mpr") {
        return Err(format!("expected a .mpr file, got: {}", path));
    }
    load_macro_info(&path)
}

#[tauri::command]
async fn play_macro(
    state:   State<'_, ConfigState>,
    path:    String,
    speed:   Option<f64>,
    dry_run: bool,
    vars:    Option<std::collections::HashMap<String, String>>,
) -> Result<PlaybackResult, String> {
    // Use global default speed if not specified
    let effective_speed = speed.or_else(|| {
        state.config.lock().ok().map(|c| c.playback_defaults.speed)
    });

    let cmd = IpcCommand::Play {
        path:      PathBuf::from(&path),
        speed:     effective_speed,
        dry_run:   Some(dry_run),
        vars,
        overrides: None,
    };

    match send_ipc(cmd).await? {
        IpcResponse::Ok => Ok(PlaybackResult {
            ok:      true,
            message: "playback started".into(),
        }),
        IpcResponse::Error { message } => Ok(PlaybackResult {
            ok:      false,
            message,
        }),
        _ => Err("unexpected response".into()),
    }
}

#[tauri::command]
fn get_app_config(state: State<'_, ConfigState>) -> Result<macropad_core::models::AppConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
fn update_app_config(
    state: State<'_, ConfigState>,
    config: macropad_core::models::AppConfig,
) -> Result<(), String> {
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    *current = config;
    macropad_core::storage::save_config(&current, &state.path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_as_mpr(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app
        .dialog()
        .file()
        .add_filter("MacroRecording files", &["mpr"])
        .blocking_save_file();
    
    let result = path.and_then(|p| p.as_path().map(|ap| ap.to_string_lossy().to_string()));
    tracing::info!("GUI Backend: save_as_mpr selected path: {:?}", result);
    Ok(result)
}

#[tauri::command]
async fn start_record(
    window: tauri::Window,
    state: State<'_, ConfigState>,
    output_path: String,
) -> Result<(), String> {
    tracing::info!("start_record requested for path: {}", output_path);
    
    // Minimize the window so user can interact with other apps
    if let Err(e) = window.minimize() {
        tracing::warn!("Failed to minimize window: {}", e);
    }
    let options = {
        let config = state.config.lock().map_err(|e| e.to_string())?;
        config.recording_defaults.clone()
    };

    let cmd = IpcCommand::Record {
        output_path: PathBuf::from(output_path),
        options: Some(options),
    };
    
    tracing::info!("GUI Backend: Sending Record IPC command to daemon...");
    let response = send_ipc(cmd).await?;
    tracing::info!("GUI Backend: Received daemon response: {:?}", response);

    match response {
        IpcResponse::Ok => {
            tracing::info!("GUI Backend: Recording successfully started in daemon.");
            Ok(())
        },
        IpcResponse::Error { message } => {
            tracing::error!("GUI Backend: Daemon reported error: {}", message);
            Err(format!("Daemon error: {}", message))
        },
        _ => {
            tracing::error!("GUI Backend: Unexpected response from daemon: {:?}", response);
            Err("unexpected response from daemon".into())
        },
    }
}

#[tauri::command]
async fn stop_record() -> Result<(), String> {
    match send_ipc(IpcCommand::StopRecord).await? {
        IpcResponse::Ok => Ok(()),
        IpcResponse::Error { message } => Err(message),
        _ => Err("unexpected response".into()),
    }
}

#[tauri::command]
async fn stop_playback() -> Result<(), String> {
    send_ipc(IpcCommand::StopPlayback).await?;
    Ok(())
}

#[tauri::command]
async fn get_daemon_status() -> Result<String, String> {
    match send_ipc(IpcCommand::Status).await {
        Ok(IpcResponse::Status { status, .. }) => Ok(status),
        Ok(_)  => Ok("unknown".into()),
        Err(_) => Ok("offline".into()),
    }
}

#[tauri::command]
fn browse_mpr(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app
        .dialog()
        .file()
        .add_filter("MacroRecording files", &["mpr"])
        .blocking_pick_file();

    Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
fn load_events(path: String) -> Result<Vec<serde_json::Value>, String> {
    let p   = PathBuf::from(&path);
    let rec = macropad_core::load(&p)
        .map_err(|e| e.to_string())?;

    let events = serde_json::to_value(&rec.events)
        .map_err(|e| e.to_string())?;

    Ok(events.as_array().cloned().unwrap_or_default())
}

#[tauri::command]
fn save_events(path: String, events: Vec<serde_json::Value>) -> Result<(), String> {
    let p   = PathBuf::from(&path);
    let mut rec = macropad_core::load(&p)
        .map_err(|e| e.to_string())?;

    rec.events = serde_json::from_value(serde_json::Value::Array(events))
        .map_err(|e| e.to_string())?;

    macropad_core::save(&rec, &p)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn set_theme_icon(app: tauri::AppHandle, theme: String) -> Result<(), String> {
    let window = app.get_webview_window("main")
        .or_else(|| app.webview_windows().values().next().cloned())
        .ok_or("could not find any window to set icon")?;
    
    tracing::info!("Setting {} theme icon", theme);
 
    
    let icon_name = if theme == "dark" { "Logo_Dark.png" } else { "Logo_Light.png" };
    
    // Try multiple paths to find the icon (dev vs prod)
    let resource_path = app.path().resource_dir().unwrap_or_default().join(icon_name);
    // Relative to src-tauri during dev
    let dev_path = std::path::Path::new("..").join("public").join(icon_name);
    
    tracing::info!("Trying icon paths: {:?}, {:?}", resource_path, dev_path);
    
    let bytes = std::fs::read(&resource_path)
        .or_else(|_| std::fs::read(&dev_path))
        .or_else(|_| {
            let exe_path = std::env::current_exe().unwrap_or_default();
            let base = exe_path.parent().unwrap_or(std::path::Path::new("."));
            std::fs::read(base.join(icon_name))
        })
        .map_err(|e| format!("failed to read icon {}: {}", icon_name, e))?;
    let img = image::load_from_memory(&bytes)
        .map_err(|e| format!("failed to load image {}: {}", icon_name, e))?;
    
    let resized = img.resize(256, 256, image::imageops::FilterType::Lanczos3);
    let rgba = resized.to_rgba8();
    let (width, height) = rgba.dimensions();
    let pixels = rgba.into_raw();

    let icon = tauri::image::Image::new_owned(pixels, width, height);

    window.set_icon(icon)
        .map_err(|e| format!("failed to set window icon: {}", e))?;

    Ok(())
}

#[tauri::command]
fn load_macro_script(path: String) -> Result<String, String> {
    if !path.ends_with(".mps") {
        return Err(format!("expected a .mps file, got: {}", path));
    }
    std::fs::read_to_string(&path)
        .map_err(|e| format!("failed to read {}: {}", path, e))
}

#[tauri::command]
fn save_macro_script(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content)
        .map_err(|e| format!("failed to write {}: {}", path, e))
}

#[tauri::command]
async fn run_macro_script_file(
    path: String,
    dry_run: bool,
    vars: Option<std::collections::HashMap<String, String>>,
) -> Result<Vec<String>, String> {
    if !path.ends_with(".mps") {
        return Err(format!("expected a .mps file, got: {}", path));
    }

    let p = PathBuf::from(&path);
    match script::run_script(&p, dry_run, vars).await {
        Ok(_) => Ok(vec!["script executed successfully".into()]),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn browse_macro_script(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app
        .dialog()
        .file()
        .add_filter("MacroScript files", &["mps"])
        .blocking_pick_file();

    Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
fn browse_any_macro(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app
        .dialog()
        .file()
        .add_filter("Macro files (*.mpr, *.mps)", &["mpr", "mps"])
        .blocking_pick_file();

    Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
fn new_macro_script(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app
        .dialog()
        .file()
        .add_filter("MacroScript files", &["mps"])
        .blocking_save_file();

    Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
fn duplicate_file(path: String) -> Result<String, String> {
    let src  = std::path::PathBuf::from(&path);
    let stem = src.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("macro");
    let ext  = src.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mpr");
    let parent = src.parent().unwrap_or(std::path::Path::new("."));

    let mut i = 1;
    let dest = loop {
        let name = format!("{}_{}.{}", stem, i, ext);
        let candidate = parent.join(&name);
        if !candidate.exists() { break candidate; }
        i += 1;
    };

    std::fs::copy(&src, &dest)
        .map_err(|e| e.to_string())?;

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn list_macro_history(path: String) -> Result<Vec<String>, String> {
    let p = std::path::PathBuf::from(&path);
    let history = macropad_core::list_history(&p)
        .map_err(|e| e.to_string())?;
    
    Ok(history.into_iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect())
}

#[tauri::command]
fn restore_macro_version(backup_path: String, target_path: String) -> Result<(), String> {
    let b = std::path::PathBuf::from(&backup_path);
    let t = std::path::PathBuf::from(&target_path);
    macropad_core::restore_history(&b, &t)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn wrap_recording_in_script(macro_path: String) -> Result<String, String> {
    let macro_p = std::path::PathBuf::from(&macro_path);
    let macro_name = macro_p.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("macro.mpr");
    
    let script_path = macro_p.with_extension("mps");
    
    let final_script_path = if script_path.exists() {
        let parent = script_path.parent().unwrap_or(std::path::Path::new("."));
        let stem = script_path.file_stem().and_then(|s| s.to_str()).unwrap_or("script");
        let mut i = 1;
        loop {
            let candidate = parent.join(format!("{}_{}.mps", stem, i));
            if !candidate.exists() { break candidate; }
            i += 1;
        }
    } else {
        script_path
    };

    let content = format!(
        "// Auto-generated wrapper for {}\nrun \"./{}\"\n",
        macro_name, macro_name
    );

    std::fs::write(&final_script_path, content)
        .map_err(|e| e.to_string())?;

    Ok(final_script_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn set_hotkey(macro_path: String, hotkey_str: String) -> Result<(), String> {
    match send_ipc(IpcCommand::SetHotkey {
        macro_path: PathBuf::from(macro_path),
        hotkey_str,
    }).await? {
        IpcResponse::Ok => Ok(()),
        IpcResponse::Error { message } => Err(message),
        _ => Err("unexpected response".into()),
    }
}

#[tauri::command]
async fn get_hotkeys() -> Result<std::collections::HashMap<String, String>, String> {
    match send_ipc(IpcCommand::GetHotkeys).await? {
        IpcResponse::Hotkeys { bindings } => Ok(bindings),
        IpcResponse::Error { message } => Err(message),
        _ => Err("unexpected response".into()),
    }
}

#[tauri::command]
async fn add_scheduled_task(task: macropad_ipc::ScheduledTask) -> Result<(), String> {
    match send_ipc(IpcCommand::AddScheduledTask { task }).await? {
        IpcResponse::Ok => Ok(()),
        IpcResponse::Error { message } => Err(message),
        _ => Err("unexpected response".into()),
    }
}

#[tauri::command]
async fn remove_scheduled_task(id: String) -> Result<(), String> {
    match send_ipc(IpcCommand::RemoveScheduledTask { id }).await? {
        IpcResponse::Ok => Ok(()),
        IpcResponse::Error { message } => Err(message),
        _ => Err("unexpected response".into()),
    }
}

#[tauri::command]
async fn get_scheduled_tasks() -> Result<Vec<macropad_ipc::ScheduledTask>, String> {
    match send_ipc(IpcCommand::GetScheduledTasks).await? {
        IpcResponse::ScheduledTasks { tasks } => Ok(tasks),
        IpcResponse::Error { message } => Err(message),
        _ => Err("unexpected response".into()),
    }
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let config_dir = app.path().app_config_dir().unwrap_or_else(|_| PathBuf::from("."));
            let config_path = config_dir.join("settings.toml");
            let config = macropad_core::storage::load_config(&config_path).unwrap_or_default();
            
            app.manage(ConfigState {
                config: Mutex::new(config),
                path: config_path,
            });

            let daemon_dir = app
                .path()
                .resource_dir()
                .unwrap_or_else(|_| {
                    std::env::current_exe()
                        .ok()
                        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                        .unwrap_or_default()
                });

            #[cfg(windows)]
            let daemon_bin = daemon_dir.join("daemon.exe");
            #[cfg(not(windows))]
            let daemon_bin = daemon_dir.join("daemon");

            std::thread::spawn(move || {
                #[cfg(windows)]
                {
                    // Kill existing daemon if any to avoid zombies. 
                    // Use .spawn().ok() to be truly silent and non-blocking.
                    let _ = std::process::Command::new("taskkill")
                        .args(["/F", "/IM", "daemon.exe", "/T"])
                        .stdout(std::process::Stdio::null())
                        .stderr(std::process::Stdio::null())
                        .status();
                }

                if daemon_bin.exists() {
                    tracing::info!("starting daemon from {:?}", daemon_bin);
                    let _ = std::process::Command::new(&daemon_bin).spawn();
                } else {
                    tracing::info!("daemon binary not found at {:?}, trying PATH", daemon_bin);
                    let _ = std::process::Command::new("daemon").spawn();
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_macros,
            get_macro_info,
            play_macro,
            stop_playback,
            get_daemon_status,
            browse_mpr,
            load_events,
            save_events,
            load_macro_script,
            save_macro_script,
            run_macro_script_file,
            browse_macro_script,
            new_macro_script,
            duplicate_file,
            list_macro_history,
            restore_macro_version,
            wrap_recording_in_script,
            get_app_config,
            update_app_config,
            save_as_mpr,
            start_record,
            stop_record,
            set_hotkey,
            get_hotkeys,
            add_scheduled_task,
            remove_scheduled_task,
            get_scheduled_tasks,
            set_theme_icon,
            browse_any_macro,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}