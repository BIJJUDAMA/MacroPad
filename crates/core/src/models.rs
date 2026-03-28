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
    pub version:  u32,
    pub name:     String,
    pub created:  NaiveDate,
    pub tags:     Vec<String>,
    #[serde(default)]
    pub requires: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackConfig {
    pub speed:               f64,
    pub wait_for_window:     Option<String>,
    pub wait_timeout_ms:     u64,
    pub loop_count:          u32,
    pub skip_mouse_move:     bool,
    pub scale_to_current:    bool,
    pub recorded_resolution: Option<[u32; 2]>,
}

impl Default for PlaybackConfig {
    fn default() -> Self {
        Self {
            speed:               1.0,
            wait_for_window:     None,
            wait_timeout_ms:     15000,
            loop_count:          1,
            skip_mouse_move:     false,
            scale_to_current:    true,
            recorded_resolution: None,
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
    pub event_type:  EventType,
    pub time_ms:     u64,
    pub key:         Option<String>,
    pub button:      Option<MouseButton>,
    pub x:           Option<i32>,
    pub y:           Option<i32>,
    pub delta_x:     Option<i64>,
    pub delta_y:     Option<i64>,
    pub duration_ms: Option<u64>,
    pub value:       Option<String>,
    pub waypoints:   Option<Vec<[i32; 2]>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    KeyDown,
    KeyUp,
    MouseDown,
    MouseUp,
    MouseMove,
    MouseSegment,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingOptions {
    pub record_mouse_move:    bool,
    pub record_clicks:        bool,
    pub record_scroll:        bool,
    pub record_keyboard:      bool,
    pub min_move_distance_px: f64,
    pub min_move_interval_ms: u64,
}

impl Default for RecordingOptions {
    fn default() -> Self {
        Self {
            record_mouse_move:    true,
            record_clicks:        true,
            record_scroll:        true,
            record_keyboard:      true,
            min_move_distance_px: 5.0,
            min_move_interval_ms: 50,
        }
    }
}