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
#[serde(tag = "cmd")]
pub enum IpcCommand {
    #[serde(rename = "play", alias = "PLAY")]
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
    #[serde(rename = "record", alias = "RECORD")]
    Record {
        output_path: PathBuf,
        options:     Option<RecordingOptions>,
    },
    #[serde(rename = "stop_record", alias = "STOP_RECORD")]
    StopRecord,
    #[serde(rename = "stop_playback", alias = "STOP_PLAYBACK")]
    StopPlayback,
    #[serde(rename = "status", alias = "STATUS")]
    Status,
    #[serde(rename = "list_macros", alias = "LIST_MACROS")]
    ListMacros { 
        mpr_paths: Vec<PathBuf>,
        mps_paths: Vec<PathBuf>,
    },
    #[serde(rename = "ping", alias = "PING")]
    Ping,
    #[serde(rename = "set_hotkey", alias = "SET_HOTKEY")]
    SetHotkey {
        macro_path:  PathBuf,
        hotkey_str:  String,
    },
    #[serde(rename = "get_hotkeys", alias = "GET_HOTKEYS")]
    GetHotkeys,
    #[serde(rename = "add_scheduled_task", alias = "ADD_SCHEDULED_TASK")]
    AddScheduledTask {
        task: ScheduledTask,
    },
    #[serde(rename = "remove_scheduled_task", alias = "REMOVE_SCHEDULED_TASK")]
    RemoveScheduledTask {
        id: String,
    },
    #[serde(rename = "get_scheduled_tasks", alias = "GET_SCHEDULED_TASKS")]
    GetScheduledTasks,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MacroItem {
    pub path: PathBuf,
    pub meta: macropad_core::models::Metadata,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum IpcResponse {
    Ok,
    Pong,
    Error  { message: String },
    Status { status: String, last_result: Option<bool> },
    Macros { items: Vec<MacroItem> },
    Hotkeys { bindings: HashMap<String, String> },
    ScheduledTasks { tasks: Vec<ScheduledTask> },
}