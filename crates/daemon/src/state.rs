use macropad_core::models::MacropadRec;
use platform::hotkey::{Hotkey, HotkeyManager};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;
use tracing::{info, warn, debug};

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

#[derive(Debug, Serialize, Deserialize)]
pub struct HotkeyStore {
    // hotkey_str -> macro_path
    pub bindings: HashMap<String, String>,
}

pub struct AppState {
    pub macros:         HashMap<String, MacroEntry>,
    pub hotkeys:        HotkeyManager,
    pub hotkeys_path:   PathBuf,
    pub status:         PlaybackStatus,
    pub last_result:    Option<bool>,
    pub loop_cap:       u32,
    pub record_stop_tx: Option<oneshot::Sender<()>>,
    pub record_done_rx: Option<oneshot::Receiver<()>>,
}

impl AppState {
    pub fn new(hotkeys_path: PathBuf) -> Self {
        let mut s = Self {
            macros:         HashMap::new(),
            hotkeys:        HotkeyManager::new(),
            hotkeys_path,
            status:         PlaybackStatus::Idle,
            last_result:    None,
            loop_cap:       1000,
            record_stop_tx: None,
            record_done_rx: None,
        };
        if let Err(e) = s.load_hotkeys() {
            warn!("failed to load hotkeys: {}", e);
        }
        s
    }

    pub fn load_hotkeys(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if !self.hotkeys_path.exists() {
            return Ok(());
        }
        let content = std::fs::read_to_string(&self.hotkeys_path)?;
        let store: HotkeyStore = toml::from_str(&content)
            .map_err(|e| format!("TOML parse error: {}", e))?;
        for (hk_str, path_str) in store.bindings {
            if let Ok(hk) = Hotkey::parse(&hk_str) {
                let _ = self.hotkeys.register(hk, &path_str);
            }
        }
        info!("loaded {} hotkey bindings", self.hotkeys.all_bindings().len());
        Ok(())
    }

    pub fn save_hotkeys(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut store = HotkeyStore {
            bindings: HashMap::new(),
        };
        for (hk, path) in self.hotkeys.all_bindings() {
            store.bindings.insert(hk.to_display_string(), path.clone());
        }
        let content = toml::to_string_pretty(&store)
            .map_err(|e| format!("TOML serialize error: {}", e))?;
        if let Some(parent) = self.hotkeys_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&self.hotkeys_path, content)?;
        debug!("saved hotkeys to {:?}", self.hotkeys_path);
        Ok(())
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

pub type SharedState = Arc<Mutex<AppState>>;

pub fn new_shared_state(hotkeys_path: PathBuf) -> SharedState {
    Arc::new(Mutex::new(AppState::new(hotkeys_path)))
}