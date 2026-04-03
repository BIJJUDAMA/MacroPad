import { useState, useEffect } from "react"
import { MacroCard } from "./MacroCard"
import { useDaemonStatus, useMacroList } from "../hooks/useDaemon"
import { useRecordingContext } from "../context/RecordingContext"
import { RecordingIndicator } from "./RecordingIndicator"
import { Search, Plus, Radio, RefreshCw, DatabaseZap, Zap } from 'lucide-react'
import { Tooltip } from "./Tooltip"
import { tauriInvoke } from '../lib/tauri'

interface Props {
    paths: string[]
    setPaths: (paths: string[]) => void
}

export function RecorderSection({ paths, setPaths }: Props) {
    const { status } = useDaemonStatus()
    const { macros, loading, error, refresh, addMacro, removeMacro, duplicateMacro } = useMacroList(paths, setPaths)
    const [search, setSearch] = useState("")
    const [tagFilter, setTagFilter] = useState<string | null>(null)
    const [mode, setMode] = useState<'library' | 'record'>('library')

    const { state: recState, error: recError, lastSavedPath, startRecording, stopRecording } = useRecordingContext()

    // Auto-add new recording to library when finished
    useEffect(() => {
        if (lastSavedPath) {
            console.log("RecorderSection: Automatically adding new recording to library:", lastSavedPath);
            addMacro(lastSavedPath);
            // Switch to library view so user can see it
            setMode('library');
        }
    }, [lastSavedPath, addMacro]);

    const allTags = Array.from(new Set(macros.flatMap(m => m.tags))).sort()

    const filtered = macros.filter(m => {
        const isMpr = m.path.toLowerCase().endsWith('.mpr')
        const matchSearch = m.name.toLowerCase().includes(search.toLowerCase())
        const matchTag = tagFilter ? m.tags.includes(tagFilter) : true
        return isMpr && matchSearch && matchTag
    })

    async function handleBrowse() {
        try {
            const path = await tauriInvoke<string | null>("browse_any_macro")
            if (path && path.toLowerCase().endsWith('.mpr')) {
                addMacro(path)
            } else if (path) {
                console.warn("Only .mpr files can be added to the Recorder library.")
            }
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <div className="p-6 md:p-10 max-w-6xl mx-auto h-full flex flex-col">
            {/* Header / Mode Switcher */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-2.5 rounded-xl border border-primary/20 shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.1)]">
                            <DatabaseZap className="text-primary" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-text-main tracking-tight uppercase">Recorder</h2>
                        </div>
                    </div>

                    <div className="flex bg-surface-light/50 p-1 rounded-xl border border-surface-lighter ml-4">
                        <button
                            onClick={() => setMode('library')}
                            className={`btn-brutal px-4 py-1.5 text-xs ${mode === 'library' ? 'bg-surface text-primary shadow-lg' : 'opacity-60 text-tertiary hover:opacity-100 hover:text-text-main'}`}
                        >
                            Library
                        </button>
                        <button
                            onClick={() => setMode('record')}
                            className={`btn-brutal px-4 py-1.5 text-xs ${mode === 'record' ? 'bg-surface text-primary shadow-lg' : 'opacity-60 text-tertiary hover:opacity-100 hover:text-text-main'}`}
                        >
                            Record New
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {status === "online" && (
                        <div className="hidden lg:flex items-center gap-2 px-3 py-2 bg-surface border border-surface-lighter rounded-lg mr-2 group relative cursor-help">
                            <Zap size={14} className="text-secondary" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-tertiary">Engine Ready</span>
                        </div>
                    )}

                    {mode === 'library' && (
                        <>
                            <Tooltip name="Add Recording" description="Browse your computer to add existing .mpr files to your recorder library.">
                                <button
                                    className="btn-brutal bg-black text-white px-8 py-3 text-xs tracking-[0.2em]"
                                    onClick={handleBrowse}
                                >
                                    <Plus size={18} /> Import Recording
                                </button>
                            </Tooltip>

                            <button
                                className="btn-brutal p-2.5 text-tertiary hover:text-text-main"
                                onClick={refresh}
                            >
                                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {mode === 'library' ? (
                <>
                    <div className="flex flex-col md:flex-row gap-4 mb-8">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary group-focus-within:text-primary transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search recordings..."
                                className="w-full bg-surface border border-surface-lighter rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        {allTags.length > 0 && (
                            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                                <button
                                    onClick={() => setTagFilter(null)}
                                    className={`btn-brutal px-4 py-2 text-[10px] whitespace-nowrap ${!tagFilter ? 'bg-primary/20 border-primary/40 text-primary' : 'text-tertiary hover:border-surface-light'}`}
                                >
                                    All
                                </button>
                                {allTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => setTagFilter(tag)}
                                        className={`btn-brutal px-4 py-2 text-[10px] whitespace-nowrap ${tagFilter === tag ? 'bg-primary/20 border-primary/40 text-primary' : 'text-tertiary hover:border-surface-light'}`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 overflow-y-auto pr-2 custom-scrollbar">
                        {loading && filtered.length === 0 ? (
                            <div className="col-span-full py-20 text-center text-tertiary">Loading library...</div>
                        ) : error && filtered.length === 0 ? (
                            <div className="col-span-full py-20 text-center text-red-400">Error loading library: {error}</div>
                        ) : filtered.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-surface/30 border border-dashed border-surface-lighter rounded-3xl">
                                <DatabaseZap size={48} className="text-surface-lighter mb-4" />
                                <p className="text-tertiary font-medium">No recordings found in library</p>
                                <button
                                    onClick={() => setMode('record')}
                                    className="btn-brutal btn-primary mt-10 px-10 py-4 text-xs tracking-[0.2em]"
                                >
                                    Record Macro →
                                </button>
                            </div>
                        ) : (
                            filtered.map(macro => (
                                <MacroCard
                                    key={macro.path}
                                    macro={macro}
                                    onRemove={() => removeMacro(macro.path)}
                                    onDuplicate={() => duplicateMacro(macro.path)}
                                />
                            ))
                        )}
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-surface/30 border border-surface-lighter rounded-3xl p-12 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

                    <div className="relative z-10 flex flex-col items-center max-w-md text-center">
                        <div className={`p-8 rounded-full mb-8 transition-all duration-500 shadow-2xl ${recState === 'recording' ? 'bg-red-500/20 border-red-500/50 scale-110' : 'bg-primary/10 border-primary/20'}`}>
                            <Radio size={48} className={recState === 'recording' ? "text-red-500" : "text-primary"} />
                        </div>

                        <h3 className="text-2xl font-bold text-text-main mb-4 tracking-tight uppercase">
                            {recState === 'idle' ? 'Ready to Record' : recState === 'recording' ? 'Recording in Progress' : 'Saving Recording...'}
                        </h3>

                        <p className="text-tertiary text-sm leading-relaxed mb-10">
                            {recState === 'idle'
                                ? 'Press the button below to start capturing your keyboard and mouse actions. Your recording will be added to the library automatically.'
                                : 'Macropad is now capturing every movement. To finish, use the Global Stop Hotkey (F9) or press the button below.'}
                        </p>

                        <div className="flex flex-col gap-4 w-full">
                            <button
                                className={`btn-brutal w-full gap-3 px-10 py-6 text-xl tracking-[0.2em] ${recState === 'recording'
                                    ? "bg-red-500 text-white"
                                    : "btn-primary"
                                    }`}
                                onClick={recState === 'recording' ? stopRecording : startRecording}
                            >
                                <Radio size={28} />
                                {recState === 'idle' ? "Start Capturing" : "Stop Recording"}
                            </button>

                            {recState === 'idle' && (
                                <button
                                    onClick={() => setMode('library')}
                                    className="btn-brutal px-6 py-3 text-tertiary hover:text-text-main text-xs font-bold uppercase tracking-widest transition-colors"
                                >
                                    Back to Library
                                </button>
                            )}
                        </div>

                        <RecordingIndicator state={recState} error={recError} onStop={stopRecording} />
                    </div>
                </div>
            )}
        </div>
    )
}