import { useState } from "react"
import { useMacroList } from "../hooks/useDaemon"
import { ScriptEditor } from "./ScriptEditor"
import { Search, Plus, RefreshCw, Code2, Database, Trash2, FileText, ChevronRight } from 'lucide-react'
import { Tooltip } from "./Tooltip"
import { tauriInvoke } from '../lib/tauri'

interface Props {
    paths: string[]
    setPaths: (paths: string[]) => void
}

export function ScriptingSection({ paths, setPaths }: Props) {
    const { macros, loading, refresh, addMacro, removeMacro } = useMacroList(paths, setPaths)
    const [search, setSearch] = useState("")
    const [mode, setMode] = useState<'library' | 'editor'>('library')
    const [selectedPath, setSelectedPath] = useState<string | null>(null)

    // STRICT FILTER: Only show .mps files in the Scripting section
    const filtered = macros.filter(m => {
        return m.path.toLowerCase().endsWith('.mps') && 
               m.name.toLowerCase().includes(search.toLowerCase())
    })

    async function handleBrowse() {
        try {
            const path = await tauriInvoke<string | null>("browse_any_macro")
            if (path && path.toLowerCase().endsWith('.mps')) {
                addMacro(path)
            } else if (path) {
                console.warn("Only .mps files can be added to the Scripting library.")
            }
        } catch (e) {
            console.error(e)
        }
    }

    async function handleNew() {
        try {
            const p = await tauriInvoke<string | null>("new_macro_script")
            if (!p) return
            const defaultContent = "# new script\n"
            await tauriInvoke("save_macro_script", { path: p, content: defaultContent })
            addMacro(p)
            setSelectedPath(p)
            setMode('editor')
        } catch (e) {
            console.error(e)
        }
    }

    const openInEditor = (path: string) => {
        setSelectedPath(path)
        setMode('editor')
    }

    return (
        <div className="h-full flex flex-col bg-neutral overflow-hidden">
            {/* Nav Header */}
            <header className="h-16 px-8 border-b border-surface-lighter flex items-center justify-between bg-surface/30 shrink-0">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-secondary/10 p-2 rounded-lg border border-secondary/20">
                            <Code2 className="text-secondary" size={20} />
                        </div>
                        <h2 className="text-lg font-bold text-text-main tracking-tight uppercase">Scripting</h2>
                    </div>

                    <div className="flex bg-surface rounded-xl p-1 border border-surface-lighter">
                        <button 
                            onClick={() => setMode('library')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${mode === 'library' ? 'bg-surface-light shadow-md text-primary' : 'text-tertiary hover:text-text-main'}`}
                        >
                            Library
                        </button>
                        <button 
                            disabled={!selectedPath}
                            onClick={() => setMode('editor')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${mode === 'editor' ? 'bg-surface-light shadow-md text-primary' : !selectedPath ? 'opacity-30 cursor-not-allowed text-tertiary' : 'text-tertiary hover:text-text-main'}`}
                        >
                            Editor
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {mode === 'library' && (
                        <div className="flex items-center gap-3">
                            <Tooltip name="New Script" description="Create a fresh .mps script for advanced automation.">
                                <button
                                    className="flex items-center gap-2 bg-secondary/10 hover:bg-secondary/20 border border-secondary/20 text-secondary px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                                    onClick={handleNew}
                                >
                                    <Plus size={16} /> New Script
                                </button>
                            </Tooltip>
                            
                            <Tooltip name="Import Script" description="Add an existing .mps file from your local machine to the library.">
                                <button
                                    className="flex items-center gap-2 bg-surface hover:bg-surface-light border border-surface-lighter text-tertiary hover:text-text-main px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                                    onClick={handleBrowse}
                                >
                                    <Database size={16} /> Import
                                </button>
                            </Tooltip>

                            <button
                                className="p-2.5 bg-surface hover:bg-surface-light border border-surface-lighter text-tertiary hover:text-text-main rounded-lg transition-colors"
                                onClick={refresh}
                            >
                                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {mode === 'library' ? (
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                    <div className="max-w-5xl mx-auto">
                        <div className="relative mb-10 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary group-focus-within:text-secondary transition-colors" size={20} />
                            <input
                                type="text"
                                placeholder="Search scripts (.mps)..."
                                className="w-full bg-surface/50 border border-surface-lighter rounded-2xl py-4 pl-14 pr-6 text-base focus:outline-none focus:border-secondary/50 focus:ring-4 focus:ring-secondary/5 transition-all shadow-inner"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 bg-surface/20 border border-dashed border-surface-lighter rounded-3xl">
                                    <Code2 size={48} className="text-surface-lighter mb-4" />
                                    <p className="text-tertiary font-medium">No scripts in your library</p>
                                    <div className="flex gap-4 mt-6">
                                        <button onClick={handleNew} className="text-secondary text-xs font-bold uppercase tracking-widest hover:underline">+ Create New</button>
                                        <span className="text-surface-lighter">|</span>
                                        <button onClick={handleBrowse} className="text-tertiary text-xs font-bold uppercase tracking-widest hover:underline">Import File</button>
                                    </div>
                                </div>
                            ) : (
                                filtered.map(m => (
                                    <div 
                                        key={m.path}
                                        className="group flex items-center justify-between p-4 bg-surface hover:bg-surface-light border border-surface-lighter rounded-xl transition-all hover:shadow-xl hover:shadow-secondary/5 cursor-pointer"
                                        onClick={() => openInEditor(m.path)}
                                    >
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="p-2.5 bg-secondary/10 rounded-lg group-hover:scale-110 transition-transform">
                                                <FileText className="text-secondary" size={20} />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-text-main truncate">{m.name}</span>
                                                <span className="text-[10px] text-tertiary font-mono truncate opacity-60">{m.path}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeMacro(m.path);
                                                }}
                                                className="p-2 text-tertiary hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            <div className="p-2 text-tertiary group-hover:text-secondary group-hover:translate-x-1 transition-all">
                                                <ChevronRight size={20} />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden">
                    {selectedPath && (
                        <ScriptEditor initialPath={selectedPath} />
                    )}
                </div>
            )}
        </div>
    )
}
