pub mod client;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use macropad_core::models::RecordingOptions;
use thiserror::Error;
use chrono::{DateTime, Local};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledTask {
    pub id:          String,
    pub name:        String,
    pub macro_path:  PathBuf,
    pub schedule:    Schedule,
    pub enabled:     bool,
    pub last_run:    Option<DateTime<Local>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Schedule {
    Once {
        at_hour:   u32,
        at_minute: u32,
    },
    Interval {
        every_secs: u64,
    },
    Daily {
        at_hour:   u32,
        at_minute: u32,
    },
}

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

/// Overrides that a script or CLI caller can apply
/// on top of the `.mpr` file's baked-in `PlaybackConfig`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PlaybackOverrides {
    pub speed:            Option<f64>,
    pub loop_count:       Option<u32>,
    pub skip_mouse_move:  Option<bool>,
    pub scale_to_current: Option<bool>,
    pub wait_for_window:  Option<String>,
    pub wait_timeout_ms:  Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "cmd", rename_all = "snake_case")]
pub enum IpcCommand {
    Play {
        path:      PathBuf,
        speed:     Option<f64>,
        dry_run:   Option<bool>,
        /// Runtime variables to inject into event fields.
        #[serde(default)]
        vars:      Option<HashMap<String, String>>,
        /// Per-call overrides on top of the file's PlaybackConfig.
        #[serde(default)]
        overrides: Option<PlaybackOverrides>,
    },
    Record {
        output_path: PathBuf,
        options:     Option<RecordingOptions>,
    },
    StopRecord,
    StopPlayback,
    Status,
    ListMacros,
    Ping,
    SetHotkey {
        macro_path:  PathBuf,
        hotkey_str:  String,
    },
    GetHotkeys,
    AddScheduledTask {
        task: ScheduledTask,
    },
    RemoveScheduledTask {
        id: String,
    },
    GetScheduledTasks,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum IpcResponse {
    Ok,
    Pong,
    Error  { message: String },
    Status { status: String, last_result: Option<bool> },
    Macros { names: Vec<String> },
    Hotkeys { bindings: HashMap<String, String> },
    ScheduledTasks { tasks: Vec<ScheduledTask> },
}