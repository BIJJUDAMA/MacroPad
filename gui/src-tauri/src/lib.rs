use macropad_ipc::{IpcCommand, IpcResponse};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MacroInfo {
    pub name:        String,
    pub path:        String,
    pub tags:        Vec<String>,
    pub created:     String,
    pub event_count: usize,
    pub speed:       f64,
    pub loop_count:  u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlaybackResult {
    pub ok:      bool,
    pub message: String,
}

async fn send_ipc(cmd: IpcCommand) -> Result<IpcResponse, String> {
    let mut json = serde_json::to_string(&cmd)
        .map_err(|e| e.to_string())?;
    json.push('\n');

    #[cfg(windows)]
    {
        use tokio::net::windows::named_pipe::ClientOptions;

        let mut pipe = ClientOptions::new()
            .open(macropad_ipc::PIPE_NAME)
            .map_err(|_| "daemon is not running".to_string())?;

        pipe.write_all(json.as_bytes())
            .await
            .map_err(|e| e.to_string())?;

        let mut reader = BufReader::new(&mut pipe);
        let mut line   = String::new();
        reader.read_line(&mut line)
            .await
            .map_err(|e| e.to_string())?;

        serde_json::from_str::<IpcResponse>(line.trim())
            .map_err(|e| e.to_string())
    }

    #[cfg(not(windows))]
    {
        use tokio::net::UnixStream;

        let stream = UnixStream::connect(macropad_ipc::SOCKET_PATH)
            .await
            .map_err(|_| "daemon is not running".to_string())?;

        let (reader, mut writer) = stream.into_split();
        writer.write_all(json.as_bytes())
            .await
            .map_err(|e| e.to_string())?;

        let mut reader = BufReader::new(reader);
        let mut line   = String::new();
        reader.read_line(&mut line)
            .await
            .map_err(|e| e.to_string())?;

        serde_json::from_str::<IpcResponse>(line.trim())
            .map_err(|e| e.to_string())
    }
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
    if !path.ends_with(".nitsrec") {
        return Err(format!("expected a .nitsrec file, got: {}", path));
    }
    load_macro_info(&path)
}

#[tauri::command]
async fn play_macro(
    path:    String,
    speed:   Option<f64>,
    dry_run: bool,
) -> Result<PlaybackResult, String> {
    let cmd = IpcCommand::Play {
        path:    PathBuf::from(&path),
        speed,
        dry_run: Some(dry_run),
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
fn browse_nitsrec(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app
        .dialog()
        .file()
        .add_filter("NitsRec files", &["nitsrec"])
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
fn load_script(path: String) -> Result<String, String> {
    if !path.ends_with(".nitscript") {
        return Err(format!("expected a .nitscript file, got: {}", path));
    }
    std::fs::read_to_string(&path)
        .map_err(|e| format!("failed to read {}: {}", path, e))
}

#[tauri::command]
fn save_script(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content)
        .map_err(|e| format!("failed to write {}: {}", path, e))
}

#[tauri::command]
fn browse_nitscript(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app
        .dialog()
        .file()
        .add_filter("NitsScript files", &["nitscript"])
        .blocking_pick_file();

    Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
fn new_nitscript(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app
        .dialog()
        .file()
        .add_filter("NitsScript files", &["nitscript"])
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
        .unwrap_or("nitsrec");
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let exe_dir = app
                .path()
                .resource_dir()
                .ok()
                .and_then(|_| std::env::current_exe().ok())
                .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                .unwrap_or_default();

            #[cfg(windows)]
            let daemon_bin = exe_dir.join("daemon.exe");
            #[cfg(not(windows))]
            let daemon_bin = exe_dir.join("daemon");

            std::thread::spawn(move || {
                if daemon_bin.exists() {
                    println!("[gui] starting daemon from {:?}", daemon_bin);
                    let _ = std::process::Command::new(&daemon_bin).spawn();
                } else {
                    // fallback for dev — daemon binary in PATH
                    println!("[gui] daemon binary not found at {:?}, trying PATH", daemon_bin);
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
            browse_nitsrec,
            load_events,
            save_events,
            load_script,
            save_script,
            browse_nitscript,
            new_nitscript,
            duplicate_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}