import { useEffect, useState, useCallback } from "react"
import { HumanStep } from "./HumanStep"
import { RawEvent, HumanAction, EditorView } from "../types/editor"
import { MacroInfo } from "../types/macro"

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core")
    return invoke<T>(cmd, args)
}

interface Props {
    macro: MacroInfo
    onClose: () => void
}

function groupEvents(events: RawEvent[]): HumanAction[] {
    const actions: HumanAction[] = []
    let i = 0

    while (i < events.length) {
        const e = events[i]

        if (e.type === "delay") {
            actions.push({
                id: `delay-${i}`,
                label: "Wait",
                detail: `${e.duration_ms}ms`,
                raw_events: [e],
                editable_ms: e.duration_ms,
            })
            i++
            continue
        }

        if (e.type === "type_text") {
            actions.push({
                id: `type-${i}`,
                label: "Type text",
                detail: `"${e.value ?? ""}"`,
                raw_events: [e],
            })
            i++
            continue
        }

        if (e.type === "clipboard_paste") {
            actions.push({
                id: `paste-${i}`,
                label: "Paste clipboard",
                detail: "",
                raw_events: [e],
            })
            i++
            continue
        }

        if (e.type === "mouse_segment") {
            const fromX = e.x ?? 0
            const fromY = e.y ?? 0
            const toX = e.delta_x ?? 0
            const toY = e.delta_y ?? 0
            actions.push({
                id: `seg-${i}`,
                label: "Move mouse",
                detail: `(${fromX}, ${fromY}) → (${toX}, ${toY})  ${e.duration_ms}ms`,
                raw_events: [e],
            })
            i++
            continue
        }

        if (e.type === "mouse_move") {
            actions.push({
                id: `move-${i}`,
                label: "Move mouse",
                detail: `to (${e.x}, ${e.y})`,
                raw_events: [e],
            })
            i++
            continue
        }

        if (e.type === "scroll") {
            const dir = (e.delta_y ?? 0) > 0 ? "down" : "up"
            const ticks = Math.abs(e.delta_y ?? e.delta_x ?? 1)
            actions.push({
                id: `scroll-${i}`,
                label: `Scroll ${dir}`,
                detail: `${ticks} tick${ticks !== 1 ? "s" : ""}`,
                raw_events: [e],
            })
            i++
            continue
        }

        if (e.type === "mouse_down" || e.type === "mouse_up") {
            const down = events[i]
            const up = events[i + 1]
            if (up && up.type === "mouse_up" && up.button === down.button) {
                actions.push({
                    id: `click-${i}`,
                    label: `Click ${down.button ?? "left"}`,
                    detail: `at (${down.x}, ${down.y})`,
                    raw_events: [down, up],
                })
                i += 2
                continue
            }
            actions.push({
                id: `mouse-${i}`,
                label: e.type === "mouse_down" ? "Mouse down" : "Mouse up",
                detail: `${e.button ?? "left"} at (${e.x}, ${e.y})`,
                raw_events: [e],
            })
            i++
            continue
        }

        if (e.type === "key_down") {
            const keys: string[] = [e.key ?? ""]
            const raw: RawEvent[] = [e]
            let j = i + 1

            while (j < events.length && events[j].type === "key_down") {
                keys.push(events[j].key ?? "")
                raw.push(events[j])
                j++
            }
            while (j < events.length && events[j].type === "key_up") {
                raw.push(events[j])
                j++
            }

            actions.push({
                id: `key-${i}`,
                label: `Press ${keys.join("+")}`,
                detail: `${raw.length} events`,
                raw_events: raw,
            })
            i = j
            continue
        }

        actions.push({
            id: `evt-${i}`,
            label: e.type,
            detail: "",
            raw_events: [e],
        })
        i++
    }

    return actions
}

export function StepEditor({ macro, onClose }: Props) {
    const [events, setEvents] = useState<RawEvent[]>([])
    const [view, setView] = useState<EditorView>("human")
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const evts = await tauriInvoke<RawEvent[]>("load_events", { path: macro.path })
            setEvents(evts)
        } catch (e) {
            setError(String(e))
        } finally {
            setLoading(false)
        }
    }, [macro.path])

    useEffect(() => { load() }, [load])

    async function handleSave() {
        setSaving(true)
        setError(null)
        try {
            await tauriInvoke("save_events", { path: macro.path, events })
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (e) {
            setError(String(e))
        } finally {
            setSaving(false)
        }
    }

    function handleDelete(id: string) {
        const actions = groupEvents(events)
        const action = actions.find(a => a.id === id)
        if (!action) return
        const toRemove = new Set(action.raw_events.map(e => e.time_ms))
        setEvents(prev => prev.filter(e => !toRemove.has(e.time_ms)))
    }

    function handleUpdateDelay(id: string, ms: number) {
        const actions = groupEvents(events)
        const action = actions.find(a => a.id === id)
        if (!action || action.raw_events.length === 0) return
        const targetMs = action.raw_events[0].time_ms
        setEvents(prev => prev.map(e =>
            e.time_ms === targetMs && e.type === "delay"
                ? { ...e, duration_ms: ms }
                : e
        ))
    }

    const actions = groupEvents(events)

    return (
        <div style={styles.overlay}>
            <div style={styles.panel}>
                <div style={styles.header}>
                    <div>
                        <div style={styles.title}>{macro.name}</div>
                        <div style={styles.subtitle}>{events.length} events · {actions.length} actions</div>
                    </div>
                    <div style={styles.headerRight}>
                        <div style={styles.toggle}>
                            <button
                                style={{ ...styles.toggleBtn, ...(view === "human" ? styles.toggleActive : {}) }}
                                onClick={() => setView("human")}
                            >human</button>
                            <button
                                style={{ ...styles.toggleBtn, ...(view === "raw" ? styles.toggleActive : {}) }}
                                onClick={() => setView("raw")}
                            >raw</button>
                        </div>
                        <button style={{ ...styles.btn, ...styles.btnSave }} onClick={handleSave} disabled={saving}>
                            {saving ? "saving..." : saved ? "saved!" : "save"}
                        </button>
                        <button style={{ ...styles.btn, ...styles.btnClose }} onClick={onClose}>close</button>
                    </div>
                </div>

                {error && <div style={styles.error}>{error}</div>}

                {loading ? (
                    <div style={styles.state}>loading events...</div>
                ) : events.length === 0 ? (
                    <div style={styles.state}>no events in this macro</div>
                ) : view === "human" ? (
                    <div style={styles.list}>
                        {actions.map((action, i) => (
                            <HumanStep
                                key={action.id}
                                action={action}
                                index={i}
                                onDelete={handleDelete}
                                onUpdateDelay={handleUpdateDelay}
                            />
                        ))}
                    </div>
                ) : (
                    <div style={styles.list}>
                        {events.map((e, i) => (
                            <div key={i} style={styles.rawRow}>
                                <span style={styles.rawIndex}>{i + 1}</span>
                                <span style={styles.rawTime}>{e.time_ms}ms</span>
                                <span style={styles.rawType}>{e.type}</span>
                                <span style={styles.rawDetail}>
                                    {e.key || e.value || (e.x !== undefined ? `(${e.x}, ${e.y})` : "") || (e.duration_ms !== undefined ? `${e.duration_ms}ms` : "") || ""}
                                </span>
                                <button
                                    style={styles.rawDelete}
                                    onClick={() => setEvents(prev => prev.filter((_, idx) => idx !== i))}
                                >✕</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
    panel: { background: "#1e1e2e", border: "1px solid #313244", borderRadius: 12, width: "80vw", maxWidth: 900, maxHeight: "80vh", display: "flex", flexDirection: "column", fontFamily: "monospace" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #313244" },
    title: { fontSize: 18, fontWeight: 600, color: "#cdd6f4" },
    subtitle: { fontSize: 12, color: "#6c7086", marginTop: 4 },
    headerRight: { display: "flex", alignItems: "center", gap: 10 },
    toggle: { display: "flex", background: "#181825", borderRadius: 6, padding: 2, gap: 2 },
    toggleBtn: { background: "transparent", border: "none", borderRadius: 4, padding: "5px 14px", fontSize: 12, color: "#6c7086", cursor: "pointer", fontFamily: "monospace" },
    toggleActive: { background: "#313244", color: "#cdd6f4" },
    btn: { padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "monospace", fontWeight: 500 },
    btnSave: { background: "#a6e3a1", color: "#1e1e2e" },
    btnClose: { background: "#313244", color: "#cdd6f4" },
    list: { padding: "16px 24px", overflowY: "auto", flex: 1 },
    state: { textAlign: "center", color: "#6c7086", fontSize: 14, padding: 60 },
    error: { margin: "12px 24px 0", background: "#2a1a1e", border: "1px solid #f38ba8", borderRadius: 6, padding: "8px 12px", color: "#f38ba8", fontSize: 12 },
    rawRow: { display: "flex", alignItems: "center", gap: 12, padding: "6px 8px", borderRadius: 4, marginBottom: 4, background: "#181825", fontSize: 12 },
    rawIndex: { color: "#45475a", minWidth: 28, textAlign: "right" },
    rawTime: { color: "#45475a", minWidth: 70 },
    rawType: { color: "#89b4fa", minWidth: 120 },
    rawDetail: { color: "#cdd6f4", flex: 1 },
    rawDelete: { background: "transparent", border: "none", color: "#f38ba8", cursor: "pointer", fontSize: 12, padding: "0 4px" },
}