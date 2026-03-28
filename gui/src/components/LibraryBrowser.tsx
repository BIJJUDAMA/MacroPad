import { useState, useCallback } from "react"
import { MacroCard } from "./MacroCard"
import { useDaemonStatus, useMacroList } from "../hooks/useDaemon"
import { useRecording } from "../hooks/useRecording"
import { RecordingIndicator } from "./RecordingIndicator"
import { Search, Plus, Radio, RefreshCw, DatabaseZap } from 'lucide-react'

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core")
    return invoke<T>(cmd, args)
}

interface Props {
    paths: string[]
    setPaths: (paths: string[]) => void
}

export function LibraryBrowser({ paths, setPaths }: Props) {
    const { status } = useDaemonStatus()
    const { macros, loading, error, refresh, addMacro, removeMacro, duplicateMacro } = useMacroList(paths, setPaths)
    const [search, setSearch] = useState("")
    const [tagFilter, setTagFilter] = useState<string | null>(null)

    const onRecordSaved = useCallback((path: string) => {
        addMacro(path)
    }, [addMacro])

    const { state: recState, error: recError, startRecording, stopRecording } = useRecording(onRecordSaved)

    const allTags = Array.from(new Set(macros.flatMap(m => m.tags))).sort()
    const filtered = macros.filter(m => {
        const matchSearch = m.name.toLowerCase().includes(search.toLowerCase())
        const matchTag = tagFilter ? m.tags.includes(tagFilter) : true
        return matchSearch && matchTag
    })

    async function handleBrowse() {
        try {
            const path = await tauriInvoke<string | null>("browse_nitsrec")
            if (path) addMacro(path)
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <div className="p-6 md:p-10 max-w-6xl mx-auto h-full flex flex-col">
            {/* Header / Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-2.5 rounded-xl border border-primary/20">
                        <DatabaseZap className="text-primary" size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-200 tracking-tight">Vault</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="relative flex h-2 w-2">
                              {status === "online" && (
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                              )}
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${status === 'online' ? 'bg-secondary' : 'bg-red-500'}`}></span>
                            </span>
                            <span className="text-xs font-mono text-tertiary uppercase tracking-wider">
                                Backend: {status === "offline" ? "Disconnected" : "Online"}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all shadow-lg ${
                            recState !== "idle" 
                            ? "bg-surface text-tertiary border border-surface-lighter opacity-50 cursor-not-allowed" 
                            : "bg-primary text-neutral hover:bg-[#ff7a45] shadow-primary/20"
                        }`}
                        onClick={startRecording}
                        disabled={recState !== "idle"}
                    >
                        <Radio size={16} /> 
                        {recState === "idle" ? "Record" : recState === "recording" ? "Recording..." : "Saving..."}
                    </button>
                    
                    <button 
                        className="flex items-center gap-2 bg-surface hover:bg-surface-light border border-surface-lighter text-gray-300 hover:text-white px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors"
                        onClick={handleBrowse}
                    >
                        <Plus size={18} /> Add
                    </button>
                    
                    <button 
                        className="p-2.5 bg-surface hover:bg-surface-light border border-surface-lighter text-tertiary hover:text-gray-200 rounded-lg transition-colors"
                        onClick={refresh}
                        title="Refresh Macro List"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            <RecordingIndicator
                state={recState}
                onStop={stopRecording}
                error={recError}
            />

            {/* Filters */}
            <div className="mb-6 flex flex-col gap-4">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary" size={18} />
                    <input
                        className="w-full bg-surface border border-surface-lighter text-gray-200 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-secondary transition-colors font-mono text-sm placeholder-tertiary/70"
                        placeholder="Search macros by name or tag..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                
                {allTags.length > 0 && (
                    <div className="flex gap-2 flex-wrap items-center">
                        <span className="text-xs font-mono text-tertiary uppercase tracking-wider mr-2">Filters:</span>
                        <button
                            className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-colors border ${
                                tagFilter === null 
                                ? "bg-secondary/15 text-secondary border-secondary/30" 
                                : "bg-surface text-tertiary border-surface-lighter hover:border-tertiary"
                            }`}
                            onClick={() => setTagFilter(null)}
                        >
                            All
                        </button>
                        {allTags.map(tag => (
                            <button
                                key={tag}
                                className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-colors border ${
                                    tagFilter === tag 
                                    ? "bg-secondary/15 text-secondary border-secondary/30" 
                                    : "bg-surface text-tertiary border-surface-lighter hover:border-tertiary"
                                }`}
                                onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-tertiary">
                        <RefreshCw className="animate-spin mb-4" size={32} />
                        <p className="font-mono text-sm uppercase tracking-widest">Loading Vault...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-6 text-red-400 font-mono text-sm">
                        <div className="font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                            <DatabaseZap size={16} /> Error Fetching Data
                        </div>
                        {error.includes("daemon")
                            ? "Daemon is not responding. Please ensure the macronits daemon is running."
                            : error}
                    </div>
                )}

                {!loading && !error && filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-tertiary border border-dashed border-surface-lighter rounded-xl bg-surface/30">
                        <DatabaseZap size={48} className="mb-4 opacity-20" />
                        <p className="font-mono text-sm uppercase tracking-widest">
                            {macros.length === 0
                                ? "No macros in vault. Start recording."
                                : "No macros match your search criteria."}
                        </p>
                    </div>
                )}

                {!loading && !error && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {filtered.map(macro => (
                            <MacroCard
                                key={macro.path}
                                macro={macro}
                                onRefresh={refresh}
                                onRemove={() => removeMacro(macro.path)}
                                onDuplicate={() => duplicateMacro(macro.path)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}