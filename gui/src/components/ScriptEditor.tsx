import { useState, useEffect, useRef } from "react"
import { CodeEditor } from "./CodeEditor"
import { BlockEditor } from "./BlockEditor"
import { ScriptLogPanel } from "./ScriptLogPanel"
import { ScriptView, BlockStatement } from "../types/script"
import { Play, PlaySquare, Save, FilePlus, FolderOpen, Code2, Blocks, CircleDot, Eye } from 'lucide-react'
import { Tooltip } from "./Tooltip"
import { useLogs } from "../context/LogContext"

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core")
    return invoke<T>(cmd, args)
}

function blocksToSource(blocks: BlockStatement[]): string {
    function render(block: BlockStatement, indent: number): string {
        const pad = "    ".repeat(indent)
        switch (block.type) {
            case "let": return `${pad}let ${block.args.name} = "${block.args.value}"`
            case "run": return `${pad}run "${block.args.path}"`
            case "run_async": return `${pad}run_async "${block.args.path}"`
            case "delay": return `${pad}delay ${block.args.ms}`
            case "wait_for": return `${pad}wait_for ${block.args.condition} timeout=${block.args.timeout}`
            case "loop":
                return [`${pad}loop(${block.args.count}) {`, ...block.children.map(c => render(c, indent + 1)), `${pad}}`].join("\n")
            case "loop_while":
                return [`${pad}loop_while ${block.args.condition} max=${block.args.max} {`, ...block.children.map(c => render(c, indent + 1)), `${pad}}`].join("\n")
            case "if":
                return [`${pad}if ${block.args.condition} {`, ...block.children.map(c => render(c, indent + 1)), `${pad}}`].join("\n")
            case "elif":
                return [`${pad}elif ${block.args.condition} {`, ...block.children.map(c => render(c, indent + 1)), `${pad}}`].join("\n")
            case "else":
                return [`${pad}else {`, ...block.children.map(c => render(c, indent + 1)), `${pad}}`].join("\n")
            default:
                return `${pad}# unknown block: ${block.type}`
        }
    }
    return blocks.map(b => render(b, 0)).join("\n")
}

interface ScriptEditorProps {
    initialPath?: string | null
}

export function ScriptEditor({ initialPath }: ScriptEditorProps) {
    const [path, setPath] = useState<string | null>(initialPath || null)
    const [source, setSource] = useState("# write your .mps here\n")
    const [blocks, setBlocks] = useState<BlockStatement[]>([])
    const [view, setView] = useState<ScriptView>("code")

    useEffect(() => {
        if (initialPath) {
            setPath(initialPath)
            loadScript(initialPath)
        }
    }, [initialPath])

    async function loadScript(p: string) {
        try {
            const content = await tauriInvoke<string>("load_macro_script", { path: p })
            setSource(content)
            setBlocks([])
            clearLogs()
        } catch (e) {
            setError(String(e))
        }
    }
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { logLines, isExecuting: running, setExecuting: setRunning, addLog, addLogs, clearLogs } = useLogs()
    const [runtimeVars, setRuntimeVars] = useState<{key: string, value: string}[]>([])
    
    const [isRecording, setIsRecording] = useState(false)
    const [pendingMacroPath, setPendingMacroPath] = useState<string | null>(null)
    const [activeMacroInfo, setActiveMacroInfo] = useState<{path: string, events: any[]} | null>(null)
    
    const editorRef = useRef<HTMLTextAreaElement>(null)

    // Removed GSAP animations for instantaneous view switching.

    useEffect(() => {
        if (!running) return
        async function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                e.preventDefault()
                setRunning(false)
                addLog("aborted by user (Escape)")
                try {
                    await tauriInvoke("stop_playback")
                    const { getCurrentWindow } = await import("@tauri-apps/api/window")
                    await getCurrentWindow().unminimize()
                } catch { }
            }
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [running])

    async function handleOpen() {
        try {
            const p = await tauriInvoke<string | null>("browse_macro_script")
            if (!p) return
            const content = await tauriInvoke<string>("load_macro_script", { path: p })
            setPath(p)
            setSource(content)
            setBlocks([])
            clearLogs()
        } catch (e) {
            setError(String(e))
        }
    }

    async function handleNew() {
        try {
            const p = await tauriInvoke<string | null>("new_macro_script")
            if (!p) return
            const defaultContent = "# new script\n"
            await tauriInvoke("save_macro_script", { path: p, content: defaultContent })
            setPath(p)
            setSource(defaultContent)
            setBlocks([])
            clearLogs()
        } catch (e) {
            setError(String(e))
        }
    }

    async function handleSave() {
        if (!path) return
        setSaving(true)
        setError(null)
        try {
            const content = view === "blocks" ? blocksToSource(blocks) : source
            await tauriInvoke("save_macro_script", { path, content })
            if (view === "blocks") setSource(content)
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (e) {
            setError(String(e))
        } finally {
            setSaving(false)
        }
    }

    async function handleRecordHere() {
        if (isRecording) {
            try {
                await tauriInvoke("stop_record")
                setIsRecording(false)
                if (pendingMacroPath && editorRef.current) {
                    const ta = editorRef.current
                    const start = ta.selectionStart
                    const end = ta.selectionEnd
                    const filename = pendingMacroPath.split(/[\\/]/).pop()
                    const insertion = `run "${filename}"\n`
                    const next = source.substring(0, start) + insertion + source.substring(end)
                    setSource(next)
                    
                    // Force refresh source if in block view too? 
                    // handleViewToggle("code") already does this if we switch.
                }
                setPendingMacroPath(null)
            } catch (e) {
                setError(String(e))
            }
            return
        }

        try {
            const p = await tauriInvoke<string | null>("save_as_mpr")
            if (!p) return
            
            await tauriInvoke("start_record", { outputPath: p })
            setPendingMacroPath(p)
            setIsRecording(true)
        } catch (e) {
            console.error("Recording start failed:", e)
            setError(String(e))
        }
    }

    async function handlePeek() {
        if (!editorRef.current) return
        const ta = editorRef.current
        const value = ta.value
        const start = ta.selectionStart
        
        // Find current line
        const lines = value.split("\n")
        let currentPos = 0
        let currentLine = ""
        for (const line of lines) {
            if (currentPos <= start && start <= currentPos + line.length) {
                currentLine = line
                break
            }
            currentPos += line.length + 1
        }

        // Match run "path"
        const match = currentLine.match(/run\s+"([^"]+)"/)
        if (match) {
            const macroName = match[1].trim()
            try {
                // Check if absolute (Windows drive, Unix root, or Windows UNC)
                const isAbsolute = /^[A-Z]:[\\/]/i.test(macroName) || macroName.startsWith('/') || macroName.startsWith('\\')
                
                let fullPath = macroName
                if (!isAbsolute && scriptDir) {
                    const sep = scriptDir.includes('\\') ? '\\' : '/'
                    fullPath = `${scriptDir}${sep}${macroName}`
                }

                const events = await tauriInvoke<any[]>("load_events", { path: fullPath })
                setActiveMacroInfo({ path: macroName, events })
            } catch (e) {
                setError(`Could not peek ${macroName}: ${e}`)
            }
        } else {
            setError("Cursor must be on a 'run \"...\"' line to peek.")
        }
    }

    async function handleRun(dryRun: boolean) {
        if (!path) return
        setRunning(true)
        setError(null)
        clearLogs()
        addLog(`${dryRun ? "[dry-run] " : ""}starting: ${path.split(/[\\/]/).pop()}`)

        try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window")
            const win = getCurrentWindow()
            if (!dryRun) {
                await win.minimize()
                await new Promise(r => setTimeout(r, 300))
            }

            const varObj: Record<string, string> = {}
            for (const v of runtimeVars) {
                if (v.key.trim() !== "") {
                    varObj[v.key.trim()] = v.value
                }
            }
            const vars = Object.keys(varObj).length > 0 ? varObj : null

            const lines = await tauriInvoke<string[]>("run_macro_script_file", { path, dryRun, vars })
            addLogs(lines)

            if (!dryRun) {
                await win.unminimize()
                await win.setFocus()
            }
        } catch (e) {
            addLog(`error: ${String(e)}`)
            try {
                const { getCurrentWindow } = await import("@tauri-apps/api/window")
                await getCurrentWindow().unminimize()
            } catch { }
        } finally {
            setRunning(false)
        }
    }

    function handleViewToggle(next: ScriptView) {
        if (next === "blocks" && view === "code") setBlocks([])
        if (next === "code" && view === "blocks") setSource(blocksToSource(blocks))
        setView(next)
    }

    const scriptDir = path ? path.replace(/[\\/][^\\/]+$/, "") : ""

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-neutral overflow-hidden">
            {/* Toolbar Area */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-surface-lighter shrink-0 bg-surface/50">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-text-main tracking-tight uppercase">Editor</h2>
                    {path && (
                        <div className="flex items-center gap-2 bg-surface border border-surface-lighter px-3 py-1 rounded-md">
                            <span className="text-sm font-mono text-secondary truncate max-w-[200px]" title={path}>
                                {path.split(/[\\/]/).pop()}
                            </span>
                            <span className="text-xs text-text-dim">| {view}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {/* View Toggle */}
                    <div className="flex bg-surface rounded-lg p-1 border border-surface-lighter shadow-inner">
                        <button 
                            className={`btn-brutal px-3 py-1.5 text-xs ${view === "code" ? "bg-primary/10 text-primary shadow-sm" : "opacity-60 text-text-dim hover:opacity-100 hover:text-text-main"}`}
                            onClick={() => handleViewToggle("code")}
                        >
                            <Code2 size={14} /> Code
                        </button>
                        <button 
                            className={`btn-brutal px-3 py-1.5 text-xs ${view === "blocks" ? "bg-primary/10 text-primary shadow-sm" : "opacity-60 text-text-dim hover:opacity-100 hover:text-text-main"}`}
                            onClick={() => handleViewToggle("blocks")}
                        >
                            <Blocks size={14} /> Blocks
                        </button>
                    </div>
                    
                    <div className="w-px h-6 bg-surface-lighter"></div>

                    <Tooltip name="New MacroScript" description="Create a fresh automation script (.mps) from scratch.">
                        <button 
                            className="btn-brutal p-2"
                            onClick={handleNew}
                        >
                            <FilePlus size={18} />
                        </button>
                    </Tooltip>
                    
                    <Tooltip name="Open Asset" description="Load an existing .mps or .mpr file from your Library.">
                        <button 
                            className="btn-brutal p-2 hover:bg-secondary hover:text-white"
                            onClick={handleOpen}
                        >
                            <FolderOpen size={18} />
                        </button>
                    </Tooltip>
                    <Tooltip name="Convert String" description="Convert current selection.">
                        <button 
                            className="btn-brutal btn-secondary px-4 py-2 text-sm"
                            onClick={() => handleRun(true)} 
                            disabled={running || !path}
                        >
                            <PlaySquare size={16} /> Dry Run
                        </button>
                    </Tooltip>
                    
                    <Tooltip name="Execute Script" description="Run the automation on your system. Press ESC to stop.">
                        <button 
                            className="btn-brutal btn-primary px-4 py-2 text-sm"
                            onClick={() => handleRun(false)} 
                            disabled={running || !path}
                        >
                            <Play size={16} className="fill-current" />
                            {running ? "Running (Esc)" : "Execute"}
                        </button>
                    </Tooltip>
                    
                    <Tooltip name="Record Macro" description="Record your mouse and keyboard inputs to insert them at the cursor.">
                        <button 
                            className={`btn-brutal p-2 ${isRecording ? 'bg-red-500/20 border-red-500/40 text-red-500 animate-pulse' : 'text-text-dim'}`}
                            onClick={handleRecordHere}
                        >
                            <CircleDot size={18} />
                        </button>
                    </Tooltip>

                    <Tooltip name="Peek Events" description="Quickly inspect the recorded events for the selected macro.">
                        <button 
                            className="btn-brutal p-2"
                            onClick={handlePeek}
                        >
                            <Eye size={18} />
                        </button>
                    </Tooltip>

                    <div className="w-px h-6 bg-surface-lighter"></div>

                    <Tooltip name="Save Changes" description="Save your current progress to the file system.">
                        <button 
                            className={`btn-brutal p-2 ${saved ? 'btn-secondary text-white' : ''}`}
                            onClick={handleSave} 
                            disabled={saving || !path}
                        >
                            <Save size={18} className={saving ? 'animate-pulse' : ''} />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {error && (
                <div className="mx-6 mt-4 p-3 bg-red-950/40 border border-red-500/30 text-red-400 font-mono text-sm rounded-lg flex-shrink-0">
                    {error}
                </div>
            )}

            {!path ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                    <Code2 size={64} className="text-text-muted/20" strokeWidth={1} />
                    <p className="text-text-dim uppercase tracking-widest font-mono text-sm">NO EDITOR LOADED</p>
                    <div className="flex flex-col md:flex-row gap-6 mt-10">
                        <button 
                            className="btn-brutal btn-primary px-10 py-5 text-sm tracking-[0.2em]"
                            onClick={handleNew}
                        >
                            + New Script
                        </button>
                        <button 
                            className="btn-brutal px-10 py-5 text-sm tracking-[0.2em]"
                            onClick={handleOpen}
                        >
                            Open File
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    <div className="flex-1 overflow-hidden relative border-b border-surface-lighter">
                        {view === "code" ? (
                            <div className="h-full w-full [&_textarea]:bg-transparent [&_textarea]:font-mono [&_textarea]:text-sm [&_textarea]:text-text-main [&_textarea]:p-6">
                                {/* CodeEditor will inherit styling if we wrap it properly or just rewrite it later */}
                                {/* CodeEditor will inherit styling if we wrap it properly or just rewrite it later */}
                                <CodeEditor ref={editorRef} value={source} onChange={setSource} />

                                {activeMacroInfo && (
                                    <div className="absolute top-2 right-2 w-72 max-h-[80%] bg-neutral/95 backdrop-blur border border-surface-lighter rounded-xl shadow-2xl p-4 overflow-hidden flex flex-col z-50">
                                        <div className="flex justify-between items-center mb-3 border-b border-surface-lighter pb-2 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <Eye size={14} className="text-secondary" />
                                                <span className="text-xs font-bold text-text-main truncate max-w-[180px]">{activeMacroInfo.path}</span>
                                            </div>
                                            <button onClick={() => setActiveMacroInfo(null)} className="text-text-dim hover:text-text-main text-lg">&times;</button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar text-[10px] font-mono space-y-1 pr-1">
                                            {activeMacroInfo.events.map((e, idx) => (
                                                <div key={idx} className="flex gap-2 text-tertiary border-b border-surface-lighter/10 py-0.5">
                                                    <span className="opacity-30">{idx + 1}</span>
                                                    <span className="text-secondary">{e.type}:</span>
                                                    <span className="truncate">{JSON.stringify(e).substring(0, 40)}...</span>
                                                </div>
                                            ))}
                                            {activeMacroInfo.events.length === 0 && (
                                                <div className="py-4 text-center opacity-40 italic">No events found</div>
                                            )}
                                        </div>
                                        <div className="mt-3 text-[9px] text-tertiary text-center uppercase tracking-tighter shrink-0 pt-2 border-t border-surface-lighter/20">
                                            {activeMacroInfo.events.length} Operational Steps
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <BlockEditor blocks={blocks} onChange={setBlocks} scriptDir={scriptDir} />
                        )}
                    </div>
                    {/* Runtime Variables Bar */}
                    <div className="flex items-center gap-4 px-6 py-2 bg-surface/50 border-b border-surface-lighter shrink-0 overflow-x-auto custom-scrollbar">
                        <span className="text-xs font-bold text-tertiary uppercase tracking-wider shrink-0">Runtime Vars:</span>
                        {runtimeVars.map((v, i) => (
                            <div key={i} className="flex items-center gap-0 bg-neutral border border-surface-lighter rounded-md overflow-hidden shrink-0 shadow-inner">
                                <input
                                    type="text"
                                    value={v.key}
                                    onChange={e => {
                                        const newVars = [...runtimeVars]
                                        newVars[i].key = e.target.value
                                        setRuntimeVars(newVars)
                                    }}
                                    placeholder="Var Name"
                                    className="w-24 px-2 py-1 text-xs font-mono bg-transparent text-secondary focus:outline-none placeholder-text-dim/30 border-r border-surface-lighter"
                                />
                                <input
                                    type="text"
                                    value={v.value}
                                    onChange={e => {
                                        const newVars = [...runtimeVars]
                                        newVars[i].value = e.target.value
                                        setRuntimeVars(newVars)
                                    }}
                                    placeholder="Value"
                                    className="w-32 px-2 py-1 text-xs font-mono bg-transparent text-text-main focus:outline-none placeholder-text-dim/30"
                                />
                                <button
                                    onClick={() => setRuntimeVars(runtimeVars.filter((_, idx) => idx !== i))}
                                    className="px-2 py-1 text-tertiary hover:text-red-400 bg-surface/30 hover:bg-red-500/10 transition-colors border-l border-surface-lighter"
                                    title="Remove Variable"
                                >
                                    &times;
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={() => setRuntimeVars([...runtimeVars, { key: "", value: "" }])}
                            className="btn-brutal px-3 py-1 bg-surface text-xs text-secondary hover:text-primary transition-colors flex items-center gap-1 font-mono shrink-0"
                        >
                            + Add Var
                        </button>
                    </div>
                    {/* Log Panel at Bottom */}
                    <div className="h-1/3 min-h-[150px] shrink-0">
                        <ScriptLogPanel lines={logLines} running={running} />
                    </div>
                </div>
            )}
        </div>
    )
}