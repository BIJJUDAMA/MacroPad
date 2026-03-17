import { useState } from "react"
import { MacroCard } from "./MacroCard"
import { useDaemonStatus, useMacroList } from "../hooks/useDaemon"

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
        <div style={styles.root}>
            <div style={styles.toolbar}>
                <div style={styles.left}>
                    <span style={styles.title}>macro library</span>
                    <span style={{
                        ...styles.statusBadge,
                        background: status === "offline" ? "#45475a" : "#a6e3a1",
                        color: status === "offline" ? "#cdd6f4" : "#1e1e2e",
                    }}>
                        {status === "offline" ? "daemon offline" : status.toLowerCase()}
                    </span>
                </div>
                <div style={styles.right}>
                    <button style={styles.btnAdd} onClick={handleBrowse}>+ add macro</button>
                    <button style={styles.btnRefresh} onClick={refresh}>refresh</button>
                </div>
            </div>

            <div style={styles.filters}>
                <input
                    style={styles.search}
                    placeholder="search macros..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <div style={styles.tagRow}>
                    <span
                        style={{ ...styles.tagFilter, background: tagFilter === null ? "#89b4fa" : "#313244", color: tagFilter === null ? "#1e1e2e" : "#cdd6f4" }}
                        onClick={() => setTagFilter(null)}
                    >all</span>
                    {allTags.map(tag => (
                        <span
                            key={tag}
                            style={{ ...styles.tagFilter, background: tagFilter === tag ? "#89b4fa" : "#313244", color: tagFilter === tag ? "#1e1e2e" : "#cdd6f4" }}
                            onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
                        >{tag}</span>
                    ))}
                </div>
            </div>

            {loading && <div style={styles.state}>loading...</div>}

            {error && (
                <div style={styles.errorBanner}>
                    {error.includes("daemon")
                        ? "daemon is not running — start it with: cargo run -p daemon"
                        : error}
                </div>
            )}

            {!loading && !error && filtered.length === 0 && (
                <div style={styles.state}>
                    {macros.length === 0
                        ? "no macros loaded — click + add macro or start recording"
                        : "no macros match your search"}
                </div>
            )}

            <div style={styles.list}>
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
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    root: { padding: "24px", background: "#181825", minHeight: "100vh", fontFamily: "monospace", color: "#cdd6f4" },
    toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    left: { display: "flex", alignItems: "center", gap: 12 },
    right: { display: "flex", gap: 8 },
    title: { fontSize: 22, fontWeight: 700, color: "#cdd6f4", letterSpacing: "0.02em" },
    statusBadge: { borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 },
    btnAdd: { background: "#89b4fa", color: "#1e1e2e", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "monospace" },
    btnRefresh: { background: "#313244", color: "#cdd6f4", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: "monospace" },
    filters: { marginBottom: 20 },
    search: { width: "100%", background: "#1e1e2e", border: "1px solid #313244", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#cdd6f4", fontFamily: "monospace", marginBottom: 10, boxSizing: "border-box", outline: "none" },
    tagRow: { display: "flex", gap: 6, flexWrap: "wrap" },
    tagFilter: { borderRadius: 4, padding: "3px 10px", fontSize: 11, cursor: "pointer", userSelect: "none" },
    list: { marginTop: 8 },
    state: { textAlign: "center", color: "#6c7086", fontSize: 14, marginTop: 60, lineHeight: 1.6 },
    errorBanner: { background: "#2a1a1e", border: "1px solid #f38ba8", borderRadius: 6, padding: "10px 16px", color: "#f38ba8", fontSize: 13, marginBottom: 16 },
}