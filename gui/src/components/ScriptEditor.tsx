import { useState, useEffect, useRef } from "react"
import { CodeEditor } from "./CodeEditor"
import { BlockEditor } from "./BlockEditor"
import { ScriptLogPanel } from "./ScriptLogPanel"
import { ScriptView, BlockStatement } from "../types/script"
import { Play, PlaySquare, Save, FilePlus, FolderOpen, Code2, Blocks } from 'lucide-react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

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
    libraryPaths: string[]
}

export function ScriptEditor({ libraryPaths: _ }: ScriptEditorProps) {
    const [path, setPath] = useState<string | null>(null)
    const [source, setSource] = useState("# write your .nitscript here\n")
    const [blocks, setBlocks] = useState<BlockStatement[]>([])
    const [view, setView] = useState<ScriptView>("code")
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [running, setRunning] = useState(false)
    const [logLines, setLogLines] = useState<string[]>([])
    
    const viewContainerRef = useRef<HTMLDivElement>(null)

    useGSAP(() => {
        if (viewContainerRef.current) {
            gsap.from(viewContainerRef.current, {
                opacity: 0,
                y: 10,
                duration: 0.3,
                ease: "power2.out"
            })
        }
    }, [view])

    useEffect(() => {
        if (!running) return
        async function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                e.preventDefault()
                setRunning(false)
                setLogLines(prev => [...prev, "aborted by user (Escape)"])
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
            const p = await tauriInvoke<string | null>("browse_nitscript")
            if (!p) return
            const content = await tauriInvoke<string>("load_script", { path: p })
            setPath(p)
            setSource(content)
            setBlocks([])
            setLogLines([])
        } catch (e) {
            setError(String(e))
        }
    }

    async function handleNew() {
        try {
            const p = await tauriInvoke<string | null>("new_nitscript")
            if (!p) return
            const defaultContent = "# new script\n"
            await tauriInvoke("save_script", { path: p, content: defaultContent })
            setPath(p)
            setSource(defaultContent)
            setBlocks([])
            setLogLines([])
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
            await tauriInvoke("save_script", { path, content })
            if (view === "blocks") setSource(content)
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (e) {
            setError(String(e))
        } finally {
            setSaving(false)
        }
    }

    async function handleRun(dryRun: boolean) {
        if (!path) return
        setRunning(true)
        setError(null)
        setLogLines([`${dryRun ? "[dry-run] " : ""}starting: ${path.split(/[\\/]/).pop()}`])

        try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window")
            const win = getCurrentWindow()
            if (!dryRun) {
                await win.minimize()
                await new Promise(r => setTimeout(r, 300))
            }

            const lines = await tauriInvoke<string[]>("run_script_file", { path, dryRun })
            setLogLines(prev => [...prev, ...lines])

            if (!dryRun) {
                await win.unminimize()
                await win.setFocus()
            }
        } catch (e) {
            setLogLines(prev => [...prev, `error: ${String(e)}`])
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
                    <h2 className="text-xl font-bold text-gray-200 tracking-tight">Editor</h2>
                    {path && (
                        <div className="flex items-center gap-2 bg-surface border border-surface-lighter px-3 py-1 rounded-md">
                            <span className="text-sm font-mono text-secondary truncate max-w-[200px]" title={path}>
                                {path.split(/[\\/]/).pop()}
                            </span>
                            <span className="text-xs text-tertiary">| {view}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {/* View Toggle */}
                    <div className="flex bg-surface rounded-lg p-1 border border-surface-lighter shadow-inner">
                        <button 
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${view === "code" ? "bg-surface-lighter text-primary shadow" : "text-tertiary hover:text-gray-300"}`}
                            onClick={() => handleViewToggle("code")}
                        >
                            <Code2 size={14} /> Code
                        </button>
                        <button 
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${view === "blocks" ? "bg-surface-lighter text-primary shadow" : "text-tertiary hover:text-gray-300"}`}
                            onClick={() => handleViewToggle("blocks")}
                        >
                            <Blocks size={14} /> Blocks
                        </button>
                    </div>
                    
                    <div className="w-px h-6 bg-surface-lighter"></div>

                    <button 
                        className="p-2 border border-surface-lighter hover:border-tertiary rounded-lg text-tertiary hover:text-gray-200 transition-colors bg-surface"
                        onClick={handleNew} title="New Script"
                    >
                        <FilePlus size={18} />
                    </button>
                    
                    <button 
                        className="p-2 border border-surface-lighter hover:border-tertiary rounded-lg text-tertiary hover:text-gray-200 transition-colors bg-surface"
                        onClick={handleOpen} title="Open Script"
                    >
                        <FolderOpen size={18} />
                    </button>
                    
                    <button 
                        className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-secondary/10 border border-secondary/30 text-secondary rounded-lg text-sm font-bold uppercase tracking-wider transition-colors shadow-[0_0_15px_rgba(137,207,240,0.1)]"
                        onClick={() => handleRun(true)} 
                        disabled={running || !path}
                    >
                        <PlaySquare size={16} /> Dry Run
                    </button>
                    
                    <button 
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-[#ff7a45] text-neutral rounded-lg text-sm font-bold uppercase tracking-wider transition-colors shadow-[0_0_20px_rgba(255,95,31,0.2)]"
                        onClick={() => handleRun(false)} 
                        disabled={running || !path}
                    >
                        <Play size={16} className="fill-current" />
                        {running ? "Running (Esc)" : "Execute"}
                    </button>
                    
                    {/* Minimal Save indicator icon */}
                    <button 
                        className={`p-2 border rounded-lg transition-colors ${saved ? 'bg-secondary/20 border-secondary/40 text-secondary' : 'bg-surface border-surface-lighter text-tertiary hover:text-gray-200'}`}
                        onClick={handleSave} 
                        disabled={saving || !path}
                        title="Save Script"
                    >
                        <Save size={18} className={saving ? 'animate-pulse' : ''} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="mx-6 mt-4 p-3 bg-red-950/40 border border-red-500/30 text-red-400 font-mono text-sm rounded-lg flex-shrink-0">
                    {error}
                </div>
            )}

            {!path ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                    <Code2 size={64} className="text-surface-lighter" strokeWidth={1} />
                    <p className="text-tertiary uppercase tracking-widest font-mono text-sm">NO EDITOR LOADED</p>
                    <div className="flex gap-4 mt-4">
                        <button 
                            className="px-6 py-3 border border-primary/40 bg-primary/10 text-primary rounded-xl font-bold uppercase tracking-wider hover:bg-primary/20 transition-colors"
                            onClick={handleNew}
                        >
                            + Initialization
                        </button>
                        <button 
                            className="px-6 py-3 border border-surface-lighter bg-surface text-gray-300 rounded-xl font-bold uppercase tracking-wider hover:bg-surface-light transition-colors"
                            onClick={handleOpen}
                        >
                            Import File
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    <div ref={viewContainerRef} className="flex-1 overflow-hidden relative border-b border-surface-lighter">
                        {view === "code" ? (
                            <div className="h-full w-full [&_textarea]:bg-transparent [&_textarea]:font-mono [&_textarea]:text-sm [&_textarea]:text-gray-300 [&_textarea]:p-6">
                                {/* CodeEditor will inherit styling if we wrap it properly or just rewrite it later */}
                                <CodeEditor value={source} onChange={setSource} />
                            </div>
                        ) : (
                            <BlockEditor blocks={blocks} onChange={setBlocks} scriptDir={scriptDir} />
                        )}
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