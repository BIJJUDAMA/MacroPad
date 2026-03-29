use macropad_core::models::MacropadRec;
use platform::hotkey::{Hotkey, HotkeyManager};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

#[derive(Debug, Clone, PartialEq)]
pub enum PlaybackStatus {
    Idle,
    Playing(String),
    Recording,
}

#[derive(Debug)]
pub struct MacroEntry {
    pub name:   String,
    pub path:   PathBuf,
    pub rec:    MacropadRec,
    pub hotkey: Option<Hotkey>,
}

pub struct AppState {
    pub macros:         HashMap<String, MacroEntry>,
    pub hotkeys:        HotkeyManager,
    pub status:         PlaybackStatus,
    pub last_result:    Option<bool>,
    pub loop_cap:       u32,
    pub record_stop_tx: Option<oneshot::Sender<()>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            macros:         HashMap::new(),
            hotkeys:        HotkeyManager::new(),
            status:         PlaybackStatus::Idle,
            last_result:    None,
            loop_cap:       1000,
            record_stop_tx: None,
        }
    }

    pub fn is_busy(&self) -> bool {
        self.status != PlaybackStatus::Idle
    }

    pub fn set_playing(&mut self, name: &str) {
        self.status = PlaybackStatus::Playing(name.into());
    }

    pub fn set_idle(&mut self) {
        self.status = PlaybackStatus::Idle;
    }

    pub fn set_recording(&mut self) {
        self.status = PlaybackStatus::Recording;
    }

    pub fn register_macro(&mut self, entry: MacroEntry) {
        self.macros.insert(entry.name.clone(), entry);
    }

    pub fn remove_macro(&mut self, name: &str) -> bool {
        self.macros.remove(name).is_some()
    }

    pub fn get_macro(&self, name: &str) -> Option<&MacroEntry> {
        self.macros.get(name)
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

pub type SharedState = Arc<Mutex<AppState>>;

pub fn new_shared_state() -> SharedState {
    Arc::new(Mutex::new(AppState::new()))
}