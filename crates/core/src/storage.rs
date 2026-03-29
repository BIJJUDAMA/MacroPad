use crate::migration::{migrate, MigrationError};
use crate::models::{AppConfig, MacropadRec};
use chrono::Local;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;
use toml::Value;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("toml parse error: {0}")]
    TomlParse(#[from] toml::de::Error),
    #[error("toml serialize error: {0}")]
    TomlSerialize(#[from] toml::ser::Error),
    #[error("migration error: {0}")]
    Migration(#[from] MigrationError),
    #[error("file must have .mpr extension")]
    WrongExtension,
}

pub fn load(path: &Path) -> Result<MacropadRec, StorageError> {
    if path.extension().and_then(|e| e.to_str()) != Some("mpr") {
        return Err(StorageError::WrongExtension);
    }

    let raw_str = fs::read_to_string(path)?;
    let mut raw_value: Value = toml::from_str(&raw_str)?;

    migrate(&mut raw_value)?;

    let rec: MacropadRec = raw_value.try_into()?;
    Ok(rec)
}

pub fn save(rec: &MacropadRec, path: &Path) -> Result<(), StorageError> {
    if path.extension().and_then(|e| e.to_str()) != Some("mpr") {
        return Err(StorageError::WrongExtension);
    }

    // write history backup before overwriting
    if path.exists() {
        backup(path)?;
    }

    let serialized = toml::to_string_pretty(rec)?;
    fs::write(path, serialized)?;
    Ok(())
}

fn backup(path: &Path) -> Result<(), StorageError> {
    let parent = path.parent().unwrap_or(Path::new("."));
    let filename = path
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or("unknown");

    let history_dir = parent.join(".mpr_history");
    fs::create_dir_all(&history_dir)?;

    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let backup_name = format!("{}_{}", timestamp, filename);
    let backup_path = history_dir.join(backup_name);

    fs::copy(path, backup_path)?;
    Ok(())
}

pub fn list_history(path: &Path) -> Result<Vec<PathBuf>, StorageError> {
    let parent = path.parent().unwrap_or(Path::new("."));
    let filename = path
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or("unknown");

    let history_dir = parent.join(".mpr_history");
    if !history_dir.exists() {
        return Ok(vec![]);
    }

    let mut entries: Vec<PathBuf> = fs::read_dir(&history_dir)?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|f| f.to_str())
                .map(|f| f.ends_with(filename))
                .unwrap_or(false)
        })
        .collect();

    entries.sort();
    entries.reverse(); // most recent first
    Ok(entries)
}

pub fn restore_history(backup_path: &Path, target_path: &Path) -> Result<(), StorageError> {
    backup(target_path)?;
    fs::copy(backup_path, target_path)?;
    Ok(())
}

pub fn load_config(path: &Path) -> Result<AppConfig, StorageError> {
    if !path.exists() {
        return Ok(AppConfig::default());
    }

    let raw_str = fs::read_to_string(path)?;
    let config: AppConfig = toml::from_str(&raw_str)?;
    Ok(config)
}

pub fn save_config(config: &AppConfig, path: &Path) -> Result<(), StorageError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let serialized = toml::to_string_pretty(config)?;
    fs::write(path, serialized)?;
    Ok(())
}