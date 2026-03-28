export interface PlaybackConfig {
    speed: number;
    loop_count: number;
}

export interface RecordingOptions {
    record_mouse_move: boolean;
    record_clicks: boolean;
    record_scroll: boolean;
    record_keyboard: boolean;
    min_move_distance_px: number;
    min_move_interval_ms: number;
}

export interface AppConfig {
    playback_defaults: PlaybackConfig;
    recording_defaults: RecordingOptions;
    ui_theme: string;
}
