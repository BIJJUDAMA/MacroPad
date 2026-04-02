import { useState } from "react"
import { useMacroList } from "../hooks/useDaemon"
import { ScriptEditor } from "./ScriptEditor"
import { ScriptCard } from "./ScriptCard"
import { Search, Plus, RefreshCw, Code2, Database } from 'lucide-react'
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
        <div className="p-6 md:p-10 max-w-6xl mx-auto h-full flex flex-col">
            {/* Nav Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 shrink-0">
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
                            className={`btn-brutal px-4 py-1.5 text-xs ${mode === 'library' ? 'bg-surface text-primary shadow-lg' : 'opacity-60 text-tertiary hover:opacity-100 hover:text-text-main'}`}
                        >
                            Library
                        </button>
                        <button 
                            disabled={!selectedPath}
                            onClick={() => setMode('editor')}
                            className={`btn-brutal px-4 py-1.5 text-xs ${mode === 'editor' ? 'bg-surface text-primary shadow-lg' : !selectedPath ? 'opacity-30 cursor-not-allowed text-tertiary shadow-none' : 'opacity-60 text-tertiary hover:opacity-100 hover:text-text-main'}`}
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
                                    className="btn-brutal btn-secondary px-4 py-2 text-xs"
                                    onClick={handleNew}
                                >
                                    <Plus size={16} /> New Script
                                </button>
                            </Tooltip>
                            
                            <Tooltip name="Import Script" description="Add an existing .mps file from your local machine to the library.">
                                <button
                                    className="btn-brutal px-4 py-2 text-xs"
                                    onClick={handleBrowse}
                                >
                                    <Database size={16} /> Import
                                </button>
                            </Tooltip>

                            <button
                                className="btn-brutal p-2.5"
                                onClick={refresh}
                            >
                                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {mode === 'library' ? (
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="w-full">
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

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {filtered.length === 0 ? (
                                <div className="col-span-full flex flex-col items-center justify-center py-24 bg-surface/20 border border-dashed border-surface-lighter rounded-3xl">
                                    <Code2 size={48} className="text-surface-lighter mb-4" />
                                    <p className="text-tertiary font-medium">No scripts in your library</p>
                                    <div className="flex flex-col md:flex-row gap-6 mt-10">
                                        <button 
                                            onClick={handleNew} 
                                            className="btn-brutal btn-primary px-10 py-4 text-xs tracking-[0.2em]"
                                        >
                                            + Create New
                                        </button>
                                        <button 
                                            onClick={handleBrowse} 
                                            className="btn-brutal px-10 py-4 text-xs tracking-[0.2em]"
                                        >
                                            Import File
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                filtered.map(m => (
                                    <ScriptCard 
                                        key={m.path}
                                        script={m}
                                        onRemove={() => removeMacro(m.path)}
                                        onEdit={() => openInEditor(m.path)}
                                    />
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
