import { useState } from "react"
import { HumanAction } from "../types/editor"
import { ChevronDown, ChevronRight, Clock, Trash2, Edit2, Check, X } from 'lucide-react'

interface Props {
    action: HumanAction
    index: number
    onDelete: (id: string) => void
    onUpdateDelay: (id: string, ms: number) => void
}

export function HumanStep({ action, index, onDelete, onUpdateDelay }: Props) {
    const [expanded, setExpanded] = useState(false)
    const [editingMs, setEditingMs] = useState(false)
    const [msValue, setMsValue] = useState(String(action.editable_ms ?? ""))

    function handleSaveMs() {
        const val = parseInt(msValue)
        if (!isNaN(val) && val >= 0) {
            onUpdateDelay(action.id, val)
        }
        setEditingMs(false)
    }

    return (
        <div className="bg-surface border border-surface-lighter rounded-lg p-3 mb-2 hover:border-text-dim transition-colors group">
            <div className="flex justify-between items-start gap-4">
                <div className="flex items-start gap-3 flex-1">
                    <span className="flex items-center justify-center bg-surface-lighter text-text-dim rounded-md text-[10px] min-w-[24px] h-[24px] mt-0.5 font-bold font-mono">
                        {index + 1}
                    </span>
                    <div className="flex-1">
                        <div className="text-sm text-text-main font-bold tracking-wide">{action.label}</div>
                        {action.editable_ms !== undefined ? (
                            editingMs ? (
                                <div className="flex items-center gap-2 mt-2 bg-neutral p-1.5 rounded-md border border-secondary/30">
                                    <Clock size={12} className="text-secondary" />
                                    <input
                                        className="bg-transparent text-text-main text-xs w-16 font-mono outline-none"
                                        value={msValue}
                                        onChange={e => setMsValue(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") handleSaveMs() }}
                                        autoFocus
                                    />
                                    <span className="text-[10px] text-text-dim">ms</span>
                                    <div className="flex gap-1 ml-auto">
                                        <button 
                                            className="p-1 text-text-main hover:bg-green-400/20 rounded-md transition-colors" 
                                            onClick={handleSaveMs}
                                        >
                                            <Check size={14} />
                                        </button>
                                        <button 
                                            className="p-1 text-text-dim hover:bg-surface-lighter rounded-md transition-colors" 
                                            onClick={() => setEditingMs(false)}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="flex items-center gap-1.5 text-xs text-text-dim mt-1 cursor-pointer hover:text-secondary transition-colors inline-block group/edit"
                                    onClick={() => setEditingMs(true)}
                                    title="Edit duration"
                                >
                                    <Clock size={10} />
                                    <span>{action.detail}</span>
                                    <Edit2 size={10} className="opacity-0 group-hover/edit:opacity-100 transition-opacity" />
                                </div>
                            )
                        ) : (
                            <div className="text-xs text-text-dim mt-1 font-mono">{action.detail}</div>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {action.raw_events.length > 1 && (
                        <button
                            className="p-1.5 text-text-dim hover:bg-surface-lighter hover:text-text-main rounded-md transition-colors"
                            onClick={() => setExpanded(e => !e)}
                            title={expanded ? "Collapse details" : "Expand details"}
                        >
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    )}
                    <button
                        className="p-1.5 text-text-dim/40 hover:bg-red-500/10 hover:text-red-400 rounded-md transition-colors"
                        onClick={() => onDelete(action.id)}
                        title="Delete action"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="mt-3 pt-3 border-t border-surface-lighter space-y-1">
                    {action.raw_events.map((e, i) => (
                        <div key={i} className="flex gap-4 text-[10px] font-mono hover:bg-surface-lighter/50 px-2 py-1 rounded-sm">
                            <span className="text-text-dim min-w-[50px]">{e.time_ms}ms</span>
                            <span className="text-secondary min-w-[90px] uppercase tracking-widest">{e.type}</span>
                            <span className="text-text-dim/60 truncate">
                                {e.key || e.value || (e.x !== undefined ? `(${e.x}, ${e.y})` : "") || ""}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}