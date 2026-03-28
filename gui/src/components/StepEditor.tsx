import { useEffect, useState, useCallback, useRef } from "react"
import { HumanStep } from "./HumanStep"
import { RawEvent, HumanAction, EditorView } from "../types/editor"
import { MacroInfo } from "../types/macro"
import { Save, X, Code2, Users, Activity } from 'lucide-react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

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

    const overlayRef = useRef<HTMLDivElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)

    useGSAP(() => {
        if (overlayRef.current && panelRef.current) {
            gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' })
            gsap.fromTo(panelRef.current, { y: 20, scale: 0.95 }, { y: 0, scale: 1, duration: 0.4, ease: 'back.out(1.2)' })
        }
    }, [])

    function closeWithAnim() {
        if (!overlayRef.current || !panelRef.current) return onClose()
        gsap.to(panelRef.current, { y: 20, scale: 0.95, opacity: 0, duration: 0.2, ease: 'power2.in' })
        gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: onClose })
    }

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
        <div ref={overlayRef} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 opacity-0">
            <div 
                ref={panelRef} 
                className="bg-neutral border border-surface-lighter rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl opacity-100 transform"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-lighter bg-surface/80 backdrop-blur shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-200 tracking-tight">{macro.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <Activity size={12} className="text-secondary" />
                            <span className="text-xs text-tertiary">
                                <strong className="text-gray-300">{events.length}</strong> raw events · <strong className="text-gray-300">{actions.length}</strong> actions
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* View Toggle */}
                        <div className="flex bg-surface rounded-lg p-1 border border-surface-lighter shadow-inner">
                            <button 
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${view === "human" ? "bg-surface-lighter text-primary shadow" : "text-tertiary hover:text-gray-300"}`}
                                onClick={() => setView("human")}
                            >
                                <Users size={14} /> Human
                            </button>
                            <button 
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${view === "raw" ? "bg-surface-lighter text-primary shadow" : "text-tertiary hover:text-gray-300"}`}
                                onClick={() => setView("raw")}
                            >
                                <Code2 size={14} /> Raw
                            </button>
                        </div>
                        
                        <div className="w-px h-6 bg-surface-lighter mx-1"></div>

                        <button 
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors ${saved ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-secondary hover:bg-[#72b8d8] text-neutral shadow-[0_0_15px_rgba(137,207,240,0.2)]'}`}
                            onClick={handleSave} 
                            disabled={saving}
                        >
                            <Save size={16} className={saving ? 'animate-pulse' : ''} />
                            {saving ? "Saving" : saved ? "Saved" : "Save"}
                        </button>
                        
                        <button 
                            className="p-2 text-tertiary hover:text-gray-200 hover:bg-surface-lighter rounded-lg transition-colors border border-transparent hover:border-surface-lighter"
                            onClick={closeWithAnim}
                            title="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="m-4 mb-0 p-3 bg-red-950/40 border border-red-500/30 text-red-400 font-mono text-sm rounded-lg flex-shrink-0 animate-pulse">
                        <strong className="text-red-300">Error:</strong> {error}
                    </div>
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-neutral custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-tertiary space-y-4">
                            <Activity size={32} className="animate-pulse opacity-50" />
                            <p className="font-mono text-xs uppercase tracking-widest">Loading Event Telemetry</p>
                        </div>
                    ) : events.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-tertiary space-y-4">
                            <Code2 size={32} className="opacity-30" />
                            <p className="font-mono text-xs uppercase tracking-widest">No events in this macro sequence</p>
                        </div>
                    ) : view === "human" ? (
                        <div className="max-w-3xl mx-auto space-y-1">
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
                        <div className="font-mono border border-surface-lighter rounded-xl overflow-hidden shadow-inner bg-surface/20">
                            {/* Sticky Header for Raw Table (optional but nice) */}
                            <div className="flex items-center gap-4 px-4 py-2 bg-surface text-[10px] uppercase font-bold tracking-widest text-tertiary border-b border-surface-lighter sticky top-0 z-10">
                                <span className="w-8 text-right">#</span>
                                <span className="w-16">Time</span>
                                <span className="w-32">Type</span>
                                <span className="flex-1">Detail</span>
                                <span className="w-6"></span>
                            </div>
                            <div className="divide-y divide-surface-lighter/50">
                                {events.map((e, i) => (
                                    <div key={i} className="flex items-center gap-4 px-4 py-1.5 text-xs hover:bg-surface-lighter/30 transition-colors group">
                                        <span className="w-8 text-right text-surface-lighter group-hover:text-tertiary transition-colors">{i + 1}</span>
                                        <span className="w-16 text-secondary/80">{e.time_ms}ms</span>
                                        <span className="w-32 text-primary/80 uppercase tracking-wider text-[10px] font-bold">{e.type}</span>
                                        <span className="flex-1 text-gray-300 truncate opacity-80 group-hover:opacity-100 transition-opacity">
                                            {e.key || e.value || (e.x !== undefined ? `(${e.x}, ${e.y})` : "") || (e.duration_ms !== undefined ? `${e.duration_ms}ms` : "") || "-"}
                                        </span>
                                        <button
                                            className="w-6 h-6 flex items-center justify-center rounded-md text-surface-lighter hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                            onClick={() => setEvents(prev => prev.filter((_, idx) => idx !== i))}
                                            title="Delete Raw Event"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}