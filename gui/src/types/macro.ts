export interface MacroInfo {
    name: string
    path: string
    tags: string[]
    created: string
    event_count: number
    speed: number
    loop_count: number
    requires: string[]
}

export interface PlaybackResult {
    ok: boolean
    message: string
}

export type DaemonStatus = "Idle" | "Playing" | "Recording" | "offline" | string