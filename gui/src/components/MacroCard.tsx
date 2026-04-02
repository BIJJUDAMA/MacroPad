import { useState, useEffect } from "react"
import { Play, Square, Edit3, Copy, Trash2, Clock, Activity, Layers } from 'lucide-react'
import { BaseCard } from "./BaseCard"
import { MacroInfo } from "../types/macro"
import { StepEditor } from "./StepEditor"
import { VariablePromptModal } from "./VariablePromptModal"
import { Tooltip } from "./Tooltip"

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core")
    return invoke<T>(cmd, args)
}

interface Props {
    macro:      MacroInfo;
    onRemove:   () => void;
    onDuplicate: () => void;
}

export function MacroCard({ macro, onRemove, onDuplicate }: Props) {
    const [playing, setPlaying] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showEditor, setShowEditor] = useState(false)
    const [showVarPrompt, setShowVarPrompt] = useState(false)

    useEffect(() => {
        if (!playing) return
        async function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                e.preventDefault()
                await handleStop()
            }
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [playing])

    async function handlePlay(vars: Record<string, string> | null = null) {
        if (!vars && macro.requires && macro.requires.length > 0) {
            setShowVarPrompt(true)
            return
        }

        setPlaying(true)
        setError(null)
        setShowVarPrompt(false)
        try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window")
            const win = getCurrentWindow()
            await win.minimize()
            await new Promise(r => setTimeout(r, 300))

            const result = await tauriInvoke<{ ok: boolean; message: string }>(
                "play_macro",
                { path: macro.path, speed: null, dryRun: false, vars }
            )

            if (!result.ok) {
                setError(result.message)
                await win.unminimize()
                await win.setFocus()
            }
        } catch (e) {
            setError(String(e))
            try {
                const { getCurrentWindow } = await import("@tauri-apps/api/window")
                await getCurrentWindow().unminimize()
            } catch { }
        } finally {
            setPlaying(false)
        }
    }

    async function handleStop() {
        try {
            await tauriInvoke("stop_playback")
            const { getCurrentWindow } = await import("@tauri-apps/api/window")
            await getCurrentWindow().unminimize()
            await getCurrentWindow().setFocus()
        } catch (e) {
            setError(String(e))
        } finally {
            setPlaying(false)
        }
    }

    return (
        <>
            {showEditor && (
                <StepEditor macro={macro} onClose={() => setShowEditor(false)} />
            )}
            {showVarPrompt && (
                <VariablePromptModal 
                    macroName={macro.name} 
                    requiredVars={macro.requires} 
                    onConfirm={(vars) => handlePlay(vars)}
                    onCancel={() => setShowVarPrompt(false)}
                />
            )}
            
            <BaseCard accentColor="#ff4e50" playing={playing}>
                <div className="flex flex-col h-full gap-5">
                    {/* Header: Type, Name, and Path */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="bg-secondary/10 text-secondary px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
                                    Recording
                                </span>
                                <span className="text-[10px] text-tertiary font-mono opacity-50">
                                    [ID:{macro.path.slice(-4).toUpperCase()}]
                                </span>
                            </div>
                            <div className="flex gap-1">
                                <Tooltip name="Duplicate" description="Create a copy of this macro in your library" position="left">
                                    <button onClick={onDuplicate} className="btn-brutal p-1.5 text-tertiary hover:text-primary opacity-60 hover:opacity-100" title="Duplicate"><Copy size={16}/></button>
                                </Tooltip>
                                <Tooltip name="Delete" description="Permanently remove this macro from your library" position="left">
                                    <button onClick={onRemove} className="btn-brutal p-1.5 text-tertiary hover:text-red-500 opacity-60 hover:opacity-100" title="Delete"><Trash2 size={16}/></button>
                                </Tooltip>
                            </div>
                        </div>
                        
                        <div className="mt-1">
                            <h3 className="text-xl font-bold text-text-main line-clamp-1" title={macro.name}>
                                {macro.name}
                            </h3>
                            <p className="text-[11px] text-tertiary font-mono truncate mt-0.5 opacity-60" title={macro.path}>
                                {macro.path}
                            </p>
                        </div>
                    </div>

                    {/* Telemetry Dashboard */}
                    <div className="grid grid-cols-3 gap-3 bg-surface-lighter rounded-xl p-4">
                        <Tooltip name="Event Count" description="Total number of recorded mouse and keyboard actions">
                            <div className="flex flex-col gap-1 cursor-help">
                                <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider opacity-60">Events</span>
                                <div className="flex items-center gap-2">
                                    <Activity size={14} className="text-secondary" />
                                    <span className="text-lg font-bold text-text-main">{macro.event_count}</span>
                                </div>
                            </div>
                        </Tooltip>
                        <Tooltip name="Playback Speed" description="Multiplier for the original recording speed">
                            <div className="flex flex-col gap-1 border-x border-surface-light px-3 cursor-help">
                                <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider opacity-60">Speed</span>
                                <div className="flex items-center gap-2">
                                    <Clock size={14} className="text-secondary" />
                                    <span className="text-lg font-bold text-text-main">{macro.speed}x</span>
                                </div>
                            </div>
                        </Tooltip>
                        <Tooltip name="Loop Count" description="Number of times this macro will repeat during playback">
                            <div className="flex flex-col gap-1 pl-1 cursor-help">
                                <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider opacity-60">Loops</span>
                                <div className="flex items-center gap-2">
                                    <Layers size={14} className="text-secondary" />
                                    <span className="text-lg font-bold text-text-main">{macro.loop_count}</span>
                                </div>
                            </div>
                        </Tooltip>
                    </div>

                    {/* Tags and Actions */}
                    <div className="flex flex-col gap-5 mt-auto">
                        {macro.tags.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                                {macro.tags.map(tag => (
                                    <span key={tag} className="bg-surface-light text-tertiary px-2 py-0.5 rounded text-[10px] font-medium border border-surface-lighter">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <Tooltip name={playing ? "Stop Macro" : "Run Macro"} description={playing ? "Immediately terminate macro execution and return control to the system" : "Execute all recorded events at the specified playback speed"} className="flex-1">
                                <button
                                    className={`btn-brutal w-full flex items-center justify-center gap-2 py-3 text-sm
                                        ${playing 
                                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                                            : 'bg-primary text-white shadow-lg shadow-primary/20'}
                                    `}
                                    onClick={() => playing ? handleStop() : handlePlay()}
                                >
                                    {playing ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                                    {playing ? 'Stop Execution' : 'Execute Macro'}
                                </button>
                            </Tooltip>
                            
                             <Tooltip name="Step Editor" description="Open the macro editor to modify individual events, timing, and properties">
                                <button 
                                    className="btn-brutal p-3 text-tertiary hover:text-primary opacity-80 hover:opacity-100"
                                    onClick={() => setShowEditor(true)}
                                    title="Open Step Editor"
                                >
                                    <Edit3 size={18} />
                                </button>
                            </Tooltip>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-medium rounded-lg p-3 mt-2 flex items-center gap-2">
                            <Activity size={14} />
                            {error}
                        </div>
                    )}
                </div>
            </BaseCard>
        </>
    )
}