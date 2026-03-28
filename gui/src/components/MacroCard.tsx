import { useState, useEffect, useRef } from "react"
import { MacroInfo } from "../types/macro"
import { StepEditor } from "./StepEditor"
import { Play, Square, Edit3, Copy, Trash2, Clock, Activity, Hash, Layers } from 'lucide-react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

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

export function MacroCard({ macro, onRemove, onDuplicate }: Props) {
    const [playing, setPlaying] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showEditor, setShowEditor] = useState(false)
    const cardRef = useRef<HTMLDivElement>(null)

    useGSAP(() => {
        if (!cardRef.current) return
        
        // Setup initial state
        gsap.set(cardRef.current, { clearProps: 'all' })

        // Add hover listener dynamically through GSAP timeline for better perf
        const tl = gsap.timeline({ paused: true })
        tl.to(cardRef.current, {
            y: -2,
            boxShadow: '0 8px 30px rgba(255, 95, 31, 0.08)',
            borderColor: 'rgba(255, 95, 31, 0.3)',
            duration: 0.2,
            ease: 'power2.out'
        })
        
        cardRef.current.addEventListener('mouseenter', () => tl.play())
        cardRef.current.addEventListener('mouseleave', () => tl.reverse())

        return () => {
            tl.kill()
        }
    }, [])

    useGSAP(() => {
        if (playing && cardRef.current) {
            gsap.to(cardRef.current, {
                boxShadow: '0 0 20px rgba(137, 207, 240, 0.2)', // Secondary glow while playing
                borderColor: 'rgba(137, 207, 240, 0.4)',
                duration: 0.8,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut'
            })
        }
    }, [playing])

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

    async function handlePlay() {
        setPlaying(true)
        setError(null)
        try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window")
            const win = getCurrentWindow()
            await win.minimize()
            await new Promise(r => setTimeout(r, 300))

            const result = await tauriInvoke<{ ok: boolean; message: string }>(
                "play_macro",
                { path: macro.path, speed: null, dryRun: false }
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
            <div ref={cardRef} className="bg-surface-light border border-surface-lighter rounded-xl p-5 mb-4 relative overflow-hidden transition-colors">
                
                {playing && (
                    <div className="absolute top-0 left-0 h-1 bg-secondary w-full skeleton-loading-anim"></div>
                )}

                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-200 tracking-wide">{macro.name}</h3>
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
                        <button
                            className={`p-2 rounded-lg transition-all ${playing ? 'bg-secondary/20 text-secondary' : 'bg-surface hover:bg-secondary/10 hover:text-secondary text-gray-400 border border-surface-lighter hover:border-secondary/30'}`}
                            onClick={handlePlay}
                            disabled={playing}
                            title="Play Macro"
                        >
                            <Play size={18} fill={playing ? "currentColor" : "none"} />
                        </button>

                        <button 
                            className="p-2 bg-surface hover:bg-red-500/10 text-gray-400 hover:text-red-400 border border-surface-lighter hover:border-red-500/30 rounded-lg transition-all"
                            onClick={handleStop}
                            title="Stop Macro"
                        >
                            <Square size={18} />
                        </button>
                        
                        <div className="w-px h-6 bg-surface-lighter mx-1"></div>

                        <button 
                            className="p-2 bg-surface hover:bg-primary/10 text-gray-400 hover:text-primary border border-surface-lighter hover:border-primary/30 rounded-lg transition-all"
                            onClick={() => setShowEditor(true)}
                            title="Edit Macro"
                        >
                            <Edit3 size={18} />
                        </button>
                        
                        <button 
                            className="p-2 bg-surface hover:bg-gray-700 text-gray-400 hover:text-gray-200 border border-surface-lighter rounded-lg transition-all"
                            onClick={onDuplicate}
                            title="Duplicate"
                        >
                            <Copy size={18} />
                        </button>
                        
                        <button 
                            className="p-2 bg-surface hover:bg-red-900/40 text-gray-500 hover:text-red-400 border border-surface-lighter hover:border-red-500/30 rounded-lg transition-all"
                            onClick={onRemove}
                            title="Delete Macro"
                        >
                            <Trash2 size={18} />
                        </button>
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