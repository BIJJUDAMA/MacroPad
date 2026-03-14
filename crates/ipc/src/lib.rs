use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;

#[cfg(windows)]
pub const PIPE_NAME: &str = r"\\.\pipe\macropad-daemon";

#[cfg(not(windows))]
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

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "cmd", rename_all = "snake_case")]
pub enum IpcCommand {
    Play {
        path:    PathBuf,
        speed:   Option<f64>,
        dry_run: Option<bool>,
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

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum IpcResponse {
    Ok,
    Pong,
    Error  { message: String },
    Status { status: String, last_result: Option<bool> },
    Macros { names: Vec<String> },
}