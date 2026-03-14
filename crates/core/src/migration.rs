use thiserror::Error;
use toml::Value;

#[derive(Debug, Error)]
pub enum MigrationError {
    #[error("missing version field in .nitsrec file")]
    MissingVersion,
    #[error("unsupported version: {0}")]
    UnsupportedVersion(u32),
    #[error("migration failed at v{0} -> v{1}: {2}")]
    StepFailed(u32, u32, String),
}

pub const CURRENT_VERSION: u32 = 1;

pub fn migrate(raw: &mut Value) -> Result<(), MigrationError> {
    let version = raw
        .get("meta")
        .and_then(|m| m.get("version"))
        .and_then(|v| v.as_integer())
        .ok_or(MigrationError::MissingVersion)? as u32;

    if version > CURRENT_VERSION {
        return Err(MigrationError::UnsupportedVersion(version));
    }

    // run each migration step in sequence
    // add new ones here as the format evolves
    if version < 1 {
        migrate_v0_to_v1(raw)?;
    }

    Ok(())
}

fn migrate_v0_to_v1(raw: &mut Value) -> Result<(), MigrationError> {
    // v0 had no playback table — inject defaults
    if raw.get("playback").is_none() {
        let meta = raw
            .as_table_mut()
            .ok_or_else(|| MigrationError::StepFailed(0, 1, "root is not a table".into()))?;

        let mut playback = toml::map::Map::new();
        playback.insert("speed".into(),           Value::Float(1.0));
        playback.insert("wait_timeout_ms".into(), Value::Integer(15000));
        playback.insert("loop_count".into(),      Value::Integer(1));

        meta.insert("playback".into(), Value::Table(playback));
    }

    // bump version
    if let Some(meta) = raw.get_mut("meta").and_then(|m| m.as_table_mut()) {
        meta.insert("version".into(), Value::Integer(1));
    }

    Ok(())
}