export interface RawEvent {
    type: string
    time_ms: number
    key?: string
    button?: string
    x?: number
    y?: number
    delta_x?: number
    delta_y?: number
    duration_ms?: number
    value?: string
}

export interface HumanAction {
    id: string
    label: string
    detail: string
    raw_events: RawEvent[]
    editable_ms?: number
}

export type EditorView = "human" | "raw"