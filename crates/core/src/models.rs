use serde::{Deserialize, Serialize};
use chrono::NaiveDate;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NitsRec {
    pub meta:     Metadata,
    pub playback: PlaybackConfig,
    pub vars:     Option<HashMap<String, VarDefinition>>,
    pub events:   Vec<Event>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub version: u32,
    pub name:    String,
    pub created: NaiveDate,
    pub tags:    Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackConfig {
    pub speed:            f64,
    pub wait_for_window:  Option<String>,
    pub wait_timeout_ms:  u64,
    pub loop_count:       u32,
}

impl Default for PlaybackConfig {
    fn default() -> Self {
        Self {
            speed:           1.0,
            wait_for_window: None,
            wait_timeout_ms: 15000,
            loop_count:      1,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VarDefinition {
    #[serde(rename = "type")]
    pub var_type: VarType,
    pub default:  Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VarType {
    String,
    DurationMs,
    Int,
    Bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    #[serde(rename = "type")]
    pub event_type: EventType,
    pub time_ms:    u64,

    pub key:         Option<String>,
    pub button:      Option<MouseButton>,
    pub x:           Option<i32>,
    pub y:           Option<i32>,
    pub delta_x:     Option<i64>,
    pub delta_y:     Option<i64>,
    pub duration_ms: Option<u64>,
    pub value:       Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    KeyDown,
    KeyUp,
    MouseDown,
    MouseUp,
    MouseMove,
    Scroll,
    Delay,
    TypeText,
    ClipboardPaste,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MouseButton {
    Left,
    Right,
    Middle,
}