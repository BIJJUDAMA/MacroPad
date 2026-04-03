use platform::hotkey::{Hotkey, HotkeyManager};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;
use tracing::{debug, info, warn};

#[derive(Debug, Clone, PartialEq)]
pub enum PlaybackStatus {
    Idle,
    Playing(String),
    Recording,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HotkeyStore {
    // hotkey_str -> macro_path
    pub bindings: HashMap<String, String>,
}

pub struct AppState {
    pub hotkeys: HotkeyManager,
    pub hotkeys_path: PathBuf,
    pub status: PlaybackStatus,
    pub last_result: Option<bool>,
    pub record_stop_tx: Option<oneshot::Sender<()>>,
    pub record_done_rx: Option<oneshot::Receiver<()>>,
    pub macros: HashMap<String, macropad_core::models::Metadata>,
    pub event_bus: tokio::sync::broadcast::Sender<macropad_core::models::Event>,
}

impl AppState {
    pub fn new(hotkeys_path: PathBuf) -> Self {
        let mut s = Self {
            hotkeys: HotkeyManager::new(),
            hotkeys_path,
            status: PlaybackStatus::Idle,
            last_result: None,
            record_stop_tx: None,
            record_done_rx: None,
            macros: HashMap::new(),
            event_bus: tokio::sync::broadcast::channel(1024).0,
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
        let store: HotkeyStore =
            toml::from_str(&content).map_err(|e| format!("TOML parse error: {}", e))?;
        for (hk_str, path_str) in store.bindings {
            if let Ok(hk) = Hotkey::parse(&hk_str) {
                let _ = self.hotkeys.register(hk, &path_str);
            }
        }
        info!(
            "loaded {} hotkey bindings",
            self.hotkeys.all_bindings().len()
        );
        Ok(())
    }

    pub fn save_hotkeys(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut store = HotkeyStore {
            bindings: HashMap::new(),
        };
        for (hk, path) in self.hotkeys.all_bindings() {
            store.bindings.insert(hk.to_display_string(), path.clone());
        }
        let content =
            toml::to_string_pretty(&store).map_err(|e| format!("TOML serialize error: {}", e))?;
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

    pub fn refresh_macros(&mut self, mpr_paths: &[PathBuf], mps_paths: &[PathBuf]) {
        self.macros.clear();

        // Scan MPR files
        for path in mpr_paths {
            if let Ok(rec) = macropad_core::load(path) {
                let mut meta = rec.meta;
                meta.origin_type = macropad_core::models::OriginType::Recording;
                self.macros.insert(path.to_string_lossy().to_string(), meta);
            }
        }

        // Scan MPS files
        for path in mps_paths {
            let meta = crate::scanner::scan_script(path);
            self.macros.insert(path.to_string_lossy().to_string(), meta);
        }
    }
}

pub type SharedState = Arc<Mutex<AppState>>;

pub fn new_shared_state(hotkeys_path: PathBuf) -> SharedState {
    Arc::new(Mutex::new(AppState::new(hotkeys_path)))
}
