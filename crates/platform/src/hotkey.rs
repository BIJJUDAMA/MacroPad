use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum HotkeyError {
    #[error("hotkey '{0}' is already bound to macro '{1}'")]
    Conflict(String, String),
    #[error("invalid hotkey string: '{0}'")]
    InvalidFormat(String),
    #[error("platform registration failed: {0}")]
    RegistrationFailed(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Hotkey {
    pub modifiers: Vec<Modifier>,
    pub key:       String,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Modifier {
    Ctrl,
    Alt,
    Shift,
    Meta,
}

impl Hotkey {
    // parse "ctrl+shift+a" into a Hotkey struct
    pub fn parse(s: &str) -> Result<Self, HotkeyError> {
        let lower = s.to_lowercase();
let parts: Vec<&str> = lower.split('+').collect();
        if parts.is_empty() {
            return Err(HotkeyError::InvalidFormat(s.into()));
        }

        let mut modifiers = Vec::new();
        let mut key = None;

        for part in &parts {
            match *part {
                "ctrl"  | "control" => modifiers.push(Modifier::Ctrl),
                "alt"               => modifiers.push(Modifier::Alt),
                "shift"             => modifiers.push(Modifier::Shift),
                "meta"  | "win"     => modifiers.push(Modifier::Meta),
                k => {
                    if key.is_some() {
                        return Err(HotkeyError::InvalidFormat(s.into()));
                    }
                    key = Some(k.to_string());
                }
            }
        }

        let key = key.ok_or_else(|| HotkeyError::InvalidFormat(s.into()))?;
        Ok(Self { modifiers, key })
    }

    pub fn to_display_string(&self) -> String {
        let mut parts: Vec<String> = self.modifiers
            .iter()
            .map(|m| match m {
                Modifier::Ctrl  => "Ctrl".into(),
                Modifier::Alt   => "Alt".into(),
                Modifier::Shift => "Shift".into(),
                Modifier::Meta  => "Win".into(),
            })
            .collect();
        parts.push(self.key.to_uppercase());
        parts.join("+")
    }
}

pub struct HotkeyManager {
    // maps Hotkey → macro name
    bindings: HashMap<Hotkey, String>,
}

impl HotkeyManager {
    pub fn new() -> Self {
        Self {
            bindings: HashMap::new(),
        }
    }

    pub fn register(
        &mut self,
        hotkey: Hotkey,
        macro_name: &str,
    ) -> Result<(), HotkeyError> {
        // conflict check
        if let Some(existing) = self.bindings.get(&hotkey) {
            return Err(HotkeyError::Conflict(
                hotkey.to_display_string(),
                existing.clone(),
            ));
        }

        self.bindings.insert(hotkey, macro_name.into());
        Ok(())
    }

    pub fn unregister(&mut self, hotkey: &Hotkey) {
        self.bindings.remove(hotkey);
    }

    pub fn get_macro(&self, hotkey: &Hotkey) -> Option<&str> {
        self.bindings.get(hotkey).map(|s| s.as_str())
    }

    pub fn all_bindings(&self) -> Vec<(&Hotkey, &String)> {
        self.bindings.iter().collect()
    }

    pub fn check_conflicts(
        &self,
        hotkeys: &[(Hotkey, String)],
    ) -> Vec<HotkeyError> {
        let mut errors = Vec::new();
        let mut seen: HashMap<&Hotkey, &str> = HashMap::new();

        for (hotkey, macro_name) in hotkeys {
            if let Some(existing) = seen.get(hotkey) {
                errors.push(HotkeyError::Conflict(
                    hotkey.to_display_string(),
                    existing.to_string(),
                ));
            } else {
                seen.insert(hotkey, macro_name);
            }

            if let Some(existing) = self.bindings.get(hotkey) {
                errors.push(HotkeyError::Conflict(
                    hotkey.to_display_string(),
                    existing.clone(),
                ));
            }
        }

        errors
    }
}

impl Default for HotkeyManager {
    fn default() -> Self {
        Self::new()
    }
}