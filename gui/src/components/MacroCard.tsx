import { useState, useEffect } from "react"
import { MacroInfo } from "../types/macro"
import { StepEditor } from "./StepEditor"
import { VariablePromptModal } from "./VariablePromptModal"
import { Play, Square, Edit3, Copy, Trash2, Clock, Activity, Hash, Layers, FileCode } from 'lucide-react'
import { Tooltip } from "./Tooltip"

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core")
    return invoke<T>(cmd, args)
}

interface Props {
    macro: MacroInfo
    onRefresh: () => void
    onRemove: () => void
    onDuplicate: () => void
}

export function MacroCard({ macro, onRemove, onDuplicate, onRefresh }: Props) {
    const [playing, setPlaying] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showEditor, setShowEditor] = useState(false)
    const [showVarPrompt, setShowVarPrompt] = useState(false)
    // Removed GSAP animations for performance and to fix UI flashes.


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

    async function handleWrapInScript() {
        setError(null)
        try {
            const success = await tauriInvoke<boolean>("wrap_recording_in_script", { macroPath: macro.path })
            if (success) {
                onRefresh()
            }
        } catch (e) {
            setError(String(e))
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
            <div className="bg-surface-light border border-surface-lighter rounded-xl p-5 mb-4 relative transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(255,95,31,0.08)] hover:border-primary/30">
                
                {playing && (
                    <div className="absolute top-0 left-0 h-1 bg-secondary w-full skeleton-loading-anim"></div>
                )}

                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-text-main tracking-wide">{macro.name}</h3>
                            {playing && <span className="text-[10px] bg-secondary/20 text-secondary uppercase font-bold px-2 py-0.5 rounded-full tracking-widest animate-pulse">Running</span>}
                        </div>
                        
                        {/* Stats Row */}
                        <div className="flex items-center gap-4 text-xs text-tertiary font-mono mb-4">
                            <div className="flex items-center gap-1.5" title="Total Events">
                                <Activity size={14} /> {macro.event_count}
                            </div>
                            <div className="flex items-center gap-1.5" title="Playback Speed">
                                <Clock size={14} /> {macro.speed}x
                            </div>
                            <div className="flex items-center gap-1.5" title="Loop Count">
                                <Layers size={14} /> {macro.loop_count}
                            </div>
                            <div className="text-surface-lighter">|</div>
                            <div className="flex items-center gap-1.5 opacity-60">
                                created {macro.created}
                            </div>
                        </div>
                    </div>

                    {/* Action Panel */}
                    <div className="flex items-center gap-2">
                        <Tooltip name="Play Macro" description="Execute this macro recording on your system." position="bottom">
                            <button
                                className={`p-2 rounded-lg transition-all ${playing ? 'bg-secondary/20 text-secondary' : 'bg-surface hover:bg-secondary/10 hover:text-secondary text-text-dim border border-surface-lighter hover:border-secondary/30'}`}
                                onClick={() => handlePlay()}
                                disabled={playing}
                            >
                                <Play size={18} fill={playing ? "currentColor" : "none"} />
                            </button>
                        </Tooltip>

                        <Tooltip name="Stop Execution" description="Immediately stop any active playback or recording." position="bottom">
                            <button 
                                className="p-2 bg-surface hover:bg-red-500/10 text-text-dim hover:text-red-400 border border-surface-lighter hover:border-red-500/30 rounded-lg transition-all"
                                onClick={handleStop}
                            >
                                <Square size={18} />
                            </button>
                        </Tooltip>
                        
                        <div className="w-px h-6 bg-surface-lighter mx-1"></div>

                        <Tooltip name="Step Editor" description="Modify individual events, timings, and mouse movements." position="bottom">
                            <button 
                                className="p-2 bg-surface hover:bg-primary/10 text-text-dim hover:text-primary border border-surface-lighter hover:border-primary/30 rounded-lg transition-all"
                                onClick={() => setShowEditor(true)}
                            >
                                <Edit3 size={18} />
                            </button>
                        </Tooltip>
                        
                        <Tooltip name="Convert to Script" description="Wrap this recording into an advanced MacroScript (.mps) file." position="bottom">
                            <button 
                                className="p-2 bg-surface hover:bg-secondary/10 text-text-dim hover:text-secondary border border-surface-lighter hover:border-secondary/30 rounded-lg transition-all"
                                onClick={handleWrapInScript}
                            >
                                <FileCode size={18} />
                            </button>
                        </Tooltip>
                        
                        <Tooltip name="Duplicate" description="Create a copy of this macro in your library." position="bottom" align="end">
                            <button 
                                className="p-2 bg-surface hover:bg-surface-light text-text-dim hover:text-text-main border border-surface-lighter rounded-lg transition-all"
                                onClick={onDuplicate}
                            >
                                <Copy size={18} />
                            </button>
                        </Tooltip>
                        
                        <Tooltip name="Delete Macro" description="Permanently remove this macro from your system." position="bottom" align="end">
                            <button 
                                className="p-2 bg-surface hover:bg-red-900/40 text-text-dim hover:text-red-400 border border-surface-lighter hover:border-red-500/30 rounded-lg transition-all"
                                onClick={onRemove}
                            >
                                <Trash2 size={18} />
                            </button>
                        </Tooltip>
                    </div>
                </div>

                {macro.tags.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                        {macro.tags.map(tag => (
                            <span key={tag} className="flex items-center gap-1 bg-surface py-1 px-2.5 rounded-md text-[11px] font-mono text-tertiary border border-surface-lighter">
                                <Hash size={10} /> {tag}
                            </span>
                        ))}
                    </div>
                )}

                {error && <div className="mt-3 bg-red-950/30 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-md">{error}</div>}
                <div className="mt-4 text-[10px] text-tertiary opacity-40 select-none break-all">{macro.path}</div>
            </div>
        </>
    )
}