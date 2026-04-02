import { useState } from "react"
import { Play, Square, Edit3, Trash2, Terminal, Cpu, FileCode, Activity } from 'lucide-react'
import { BaseCard } from "./BaseCard"
import { MacroInfo } from "../types/macro"
import { Tooltip } from "./Tooltip"

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core")
    return invoke<T>(cmd, args)
}

interface Props {
    script:      MacroInfo;
    onRemove:    () => void;
    onEdit:      () => void;
}

export function ScriptCard({ script, onRemove, onEdit }: Props) {
    const [playing, setPlaying] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Simplified status check for parity with MacroCard
    async function handlePlay() {
        setError(null)
        setPlaying(true)
        try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window")
            const win = getCurrentWindow()
            await win.minimize()
            await new Promise(r => setTimeout(r, 300))

            await tauriInvoke("play_macro", { path: script.path, speed: null, dryRun: false, vars: null })
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
            await tauriInvoke("stop")
        } catch (e) {
            setError(String(e))
        } finally {
            setPlaying(false)
        }
    }

    return (
        <BaseCard accentColor="#8b5cf6" playing={playing}>
            <div className="flex flex-col h-full gap-5">
                {/* Header: Type, Name, and Path */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
                                Script
                            </span>
                            <span className="text-[10px] text-tertiary font-mono opacity-50">
                                [ID:{script.path.slice(-4).toUpperCase()}]
                            </span>
                        </div>
                        <Tooltip name="Delete" description="Remove this script from your library permanently" position="left">
                            <button onClick={onRemove} className="btn-brutal p-1.5 text-tertiary hover:text-red-500 opacity-60 hover:opacity-100" title="Delete"><Trash2 size={16}/></button>
                        </Tooltip>
                    </div>
                    
                    <div className="mt-1">
                        <h3 className="text-xl font-bold text-text-main line-clamp-1" title={script.name}>
                            {script.name}
                        </h3>
                        <p className="text-[11px] text-tertiary font-mono truncate mt-0.5 opacity-60" title={script.path}>
                            {script.path}
                        </p>
                    </div>
                </div>

                {/* Telemetry Dashboard */}
                <div className="grid grid-cols-3 gap-3 bg-surface-lighter rounded-xl p-4">
                    <Tooltip name="Line Count" description="Total number of instructions in this script">
                        <div className="flex flex-col gap-1 cursor-help">
                            <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider opacity-60">Lines</span>
                            <div className="flex items-center gap-2">
                                <Terminal size={14} className="text-primary" />
                                <span className="text-lg font-bold text-text-main">{script.line_count || 0}</span>
                            </div>
                        </div>
                    </Tooltip>
                    <Tooltip name="Commands" description="Estimated number of executable macro steps in the script">
                        <div className="flex flex-col gap-1 border-x border-surface-light px-3 cursor-help">
                            <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider opacity-60">Cmds</span>
                            <div className="flex items-center gap-2">
                                <Cpu size={14} className="text-primary" />
                                <span className="text-lg font-bold text-text-main">{script.command_count || 0}</span>
                            </div>
                        </div>
                    </Tooltip>
                    <Tooltip name="Script Engine" description="Version of the Macropad Scripting runtime used for execution">
                        <div className="flex flex-col gap-1 pl-1 cursor-help">
                            <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider opacity-60">Engine</span>
                            <div className="flex items-center gap-2">
                                <FileCode size={14} className="text-primary" />
                                <span className="text-lg font-bold text-text-main">V1</span>
                            </div>
                        </div>
                    </Tooltip>
                </div>

                {/* Tags and Actions */}
                <div className="flex flex-col gap-5 mt-auto">
                    {script.tags.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                            {script.tags.map(tag => (
                                <span key={tag} className="bg-surface-light text-tertiary px-2 py-0.5 rounded text-[10px] font-medium border border-surface-lighter">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <Tooltip name={playing ? "Stop Script" : "Run Script"} description={playing ? "Terminate script execution immediately" : "Compile and run the script logic in the background daemon"} className="flex-1">
                            <button
                                className={`btn-brutal w-full flex items-center justify-center gap-2 py-3 text-sm
                                    ${playing 
                                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                                        : 'bg-primary text-white shadow-lg shadow-primary/20'}
                                `}
                                onClick={() => playing ? handleStop() : handlePlay()}
                            >
                                {playing ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                                {playing ? 'Stop Execution' : 'Execute Script'}
                            </button>
                        </Tooltip>
                        
                        <Tooltip name="Edit Source" description="Open the built-in script editor to modify the code directly">
                            <button 
                                className="btn-brutal p-3 text-tertiary hover:text-primary opacity-80 hover:opacity-100"
                                onClick={onEdit}
                                title="Open Script Editor"
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
    )
}
