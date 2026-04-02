use macropad_core::models::{Metadata, OriginType};
use std::path::Path;
use std::fs;
use chrono::Local;

pub fn scan_script(path: &Path) -> Metadata {
    let content = fs::read_to_string(path).unwrap_or_default();
    let lines: Vec<&str> = content.lines().collect();
    
    let mut name = path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "unnamed".into());
    let mut tags = Vec::new();
    let mut command_count = 0;
    
    // Simple Docblock parsing
    for line in lines.iter().take(20) { // Only look at first 20 lines for metadata
        let trimmed = line.trim();
        if trimmed.starts_with("// @name:") {
            if let Some(val) = trimmed.splitn(2, ':').nth(1) {
                name = val.trim().trim_matches('"').to_string();
            }
        } else if trimmed.starts_with("// @tags:") {
            if let Some(val) = trimmed.splitn(2, ':').nth(1) {
                // Expecting ["a", "b"]
                let cleaned = val.trim().trim_matches(|c| c == '[' || c == ']');
                tags = cleaned.split(',')
                    .map(|s| s.trim().trim_matches('"').to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
            }
        }
    }

    // Heuristic for command count: non-comment, non-empty lines
    for line in &lines {
        let trimmed = line.trim();
        if !trimmed.is_empty() && !trimmed.starts_with("//") {
            command_count += 1;
        }
    }

    Metadata {
        version:       1,
        name,
        created:       fs::metadata(path)
            .and_then(|m| m.created())
            .map(|t| {
                let dt: chrono::DateTime<Local> = t.into();
                dt.date_naive()
            })
            .unwrap_or_else(|_| Local::now().date_naive()),
        tags,
        requires:      Vec::new(),
        origin_type:   OriginType::Script,
        line_count:    Some(lines.len() as u32),
        command_count: Some(command_count),
    }
}
