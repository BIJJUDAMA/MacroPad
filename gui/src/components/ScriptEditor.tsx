import { useState, useEffect } from "react"
import { CodeEditor } from "./CodeEditor"
import { BlockEditor } from "./BlockEditor"
import { ScriptLogPanel } from "./ScriptLogPanel"
import { ScriptView, BlockStatement } from "../types/script"

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
        <div style={styles.root}>
            <div style={styles.toolbar}>
                <div style={styles.left}>
                    <span style={styles.title}>script editor</span>
                    {path && <span style={styles.filePath}>{path.split(/[\\/]/).pop()}</span>}
                </div>
                <div style={styles.right}>
                    <div style={styles.toggle}>
                        <button style={{ ...styles.toggleBtn, ...(view === "code" ? styles.toggleActive : {}) }} onClick={() => handleViewToggle("code")}>code</button>
                        <button style={{ ...styles.toggleBtn, ...(view === "blocks" ? styles.toggleActive : {}) }} onClick={() => handleViewToggle("blocks")}>blocks</button>
                    </div>
                    <button style={styles.btn} onClick={handleNew}>new</button>
                    <button style={styles.btn} onClick={handleOpen}>open</button>
                    <button style={{ ...styles.btn, ...styles.btnDryRun }} onClick={() => handleRun(true)} disabled={running || !path}>dry run</button>
                    <button style={{ ...styles.btn, ...styles.btnRun }} onClick={() => handleRun(false)} disabled={running || !path}>
                        {running ? "running... (Esc)" : "run"}
                    </button>
                    <button style={{ ...styles.btn, ...styles.btnSave }} onClick={handleSave} disabled={saving || !path}>
                        {saving ? "saving..." : saved ? "saved!" : "save"}
                    </button>
                </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            {!path ? (
                <div style={styles.empty}>
                    <div style={styles.emptyTitle}>no script open</div>
                    <div style={styles.emptyActions}>
                        <button style={styles.emptyBtn} onClick={handleNew}>+ new script</button>
                        <button style={styles.emptyBtn} onClick={handleOpen}>open existing</button>
                    </div>
                </div>
            ) : (
                <div style={styles.editorArea}>
                    {view === "code" ? (
                        <CodeEditor value={source} onChange={setSource} />
                    ) : (
                        <BlockEditor blocks={blocks} onChange={setBlocks} scriptDir={scriptDir} />
                    )}
                    <ScriptLogPanel lines={logLines} running={running} />
                </div>
            )}
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    root: { display: "flex", flexDirection: "column", height: "100vh", background: "#181825", fontFamily: "monospace", color: "#cdd6f4" },
    toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid #313244", flexShrink: 0 },
    left: { display: "flex", alignItems: "center", gap: 12 },
    right: { display: "flex", alignItems: "center", gap: 8 },
    title: { fontSize: 18, fontWeight: 700, color: "#cdd6f4" },
    filePath: { fontSize: 12, color: "#6c7086", background: "#313244", borderRadius: 4, padding: "2px 8px" },
    toggle: { display: "flex", background: "#13131e", borderRadius: 6, padding: 2, gap: 2 },
    toggleBtn: { background: "transparent", border: "none", borderRadius: 4, padding: "5px 14px", fontSize: 12, color: "#6c7086", cursor: "pointer", fontFamily: "monospace" },
    toggleActive: { background: "#313244", color: "#cdd6f4" },
    btn: { background: "#313244", color: "#cdd6f4", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "monospace" },
    btnSave: { background: "#a6e3a1", color: "#1e1e2e" },
    btnRun: { background: "#89b4fa", color: "#1e1e2e" },
    btnDryRun: { background: "#cba6f7", color: "#1e1e2e" },
    error: { margin: "8px 20px", background: "#2a1a1e", border: "1px solid #f38ba8", borderRadius: 6, padding: "8px 12px", color: "#f38ba8", fontSize: 12, flexShrink: 0 },
    editorArea: { display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" },
    empty: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 },
    emptyTitle: { fontSize: 16, color: "#45475a" },
    emptyActions: { display: "flex", gap: 12 },
    emptyBtn: { background: "#1e1e2e", border: "1px solid #313244", borderRadius: 6, padding: "10px 20px", color: "#89b4fa", fontSize: 13, cursor: "pointer", fontFamily: "monospace" },
}