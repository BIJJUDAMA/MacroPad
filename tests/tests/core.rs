use macropad_core::models::{Event, EventType, MacropadRec, Metadata, OriginType, PlaybackConfig};
use macropad_core::recorder::consolidate_mouse_segments;
use std::path::PathBuf;

#[test]
fn test_metadata_creation() {
    let meta = Metadata {
        version: 1,
        name: "test".into(),
        tags: vec!["tag1".into()],
        created: chrono::Local::now().date_naive(),
        requires: vec![],
        origin_type: OriginType::Recording,
        line_count: None,
        command_count: None,
    };

    assert_eq!(meta.name, "test");
    assert_eq!(meta.tags[0], "tag1");
}

#[test]
fn test_mouse_segment_consolidation() {
    let events = vec![
        Event {
            event_type: EventType::MouseMove,
            time_ms: 0,
            x: Some(10),
            y: Some(10),
            key: None,
            button: None,
            delta_x: None,
            delta_y: None,
            duration_ms: None,
            value: None,
            waypoints: None,
        },
        Event {
            event_type: EventType::MouseMove,
            time_ms: 50,
            x: Some(20),
            y: Some(20),
            key: None,
            button: None,
            delta_x: None,
            delta_y: None,
            duration_ms: None,
            value: None,
            waypoints: None,
        },
        Event {
            event_type: EventType::KeyDown,
            time_ms: 100,
            key: Some("a".into()),
            button: None,
            x: None,
            y: None,
            delta_x: None,
            delta_y: None,
            duration_ms: None,
            value: None,
            waypoints: None,
        },
    ];

    let consolidated = consolidate_mouse_segments(&events);
    assert!(consolidated.len() >= 2);
}

#[test]
fn test_save_load_roundtrip() {
    let temp_path = PathBuf::from("test_macro_roundtrip.mpr");

    let rec = MacropadRec {
        meta: Metadata {
            version: 1,
            name: "test".into(),
            tags: vec![],
            created: chrono::Local::now().date_naive(),
            requires: vec![],
            origin_type: OriginType::Recording,
            line_count: None,
            command_count: None,
        },
        playback: PlaybackConfig::default(),
        vars: None,
        events: vec![],
    };

    macropad_core::save(&rec, &temp_path).expect("Failed to save");
    let loaded = macropad_core::load(&temp_path).expect("Failed to load");

    assert_eq!(loaded.meta.name, "test");

    if temp_path.exists() {
        let _ = std::fs::remove_file(temp_path);
    }
}
