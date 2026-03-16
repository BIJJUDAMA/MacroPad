import { useState } from "react"
import { MacroInfo } from "../types/macro"

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core")
    return invoke<T>(cmd, args)
}

interface Props {
    macro: MacroInfo
    onRefresh: () => void
    onRemove: () => void
}

export function MacroCard({ macro, onRefresh: _, onRemove }: Props) {
    const [playing, setPlaying] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handlePlay() {
        setPlaying(true)
        setError(null)
        try {
            const result = await tauriInvoke<{ ok: boolean; message: string }>(
                "play_macro",
                { path: macro.path, speed: null, dryRun: false }
            )
            if (!result.ok) setError(result.message)
        } catch (e) {
            setError(String(e))
        } finally {
            setPlaying(false)
        }
    }

    async function handleStop() {
        try {
            await tauriInvoke("stop_playback")
        } catch (e) {
            setError(String(e))
        }
    }

    return (
        <div style={styles.card}>
            <div style={styles.header}>
                <div>
                    <div style={styles.name}>{macro.name}</div>
                    <div style={styles.meta}>
                        {macro.event_count} events · speed {macro.speed}x · loops {macro.loop_count}
                    </div>
                    <div style={styles.meta}>created {macro.created}</div>
                </div>
                <div style={styles.actions}>
                    <button
                        style={{ ...styles.btn, ...styles.btnPlay }}
                        onClick={handlePlay}
                        disabled={playing}
                    >
                        {playing ? "playing..." : "play"}
                    </button>
                    <button
                        style={{ ...styles.btn, ...styles.btnStop }}
                        onClick={handleStop}
                    >
                        stop
                    </button>
                    <button
                        style={{ ...styles.btn, ...styles.btnRemove }}
                        onClick={onRemove}
                    >
                        remove
                    </button>
                </div>
            </div>

            {macro.tags.length > 0 && (
                <div style={styles.tags}>
                    {macro.tags.map(tag => (
                        <span key={tag} style={styles.tag}>{tag}</span>
                    ))}
                </div>
            )}

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.path}>{macro.path}</div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    card: {
        background: "#1e1e2e",
        border: "1px solid #313244",
        borderRadius: 10,
        padding: "16px 20px",
        marginBottom: 12,
        fontFamily: "monospace",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    name: {
        fontSize: 16,
        fontWeight: 600,
        color: "#cdd6f4",
        marginBottom: 4,
    },
    meta: {
        fontSize: 12,
        color: "#6c7086",
        marginBottom: 2,
    },
    actions: {
        display: "flex",
        gap: 8,
    },
    btn: {
        padding: "6px 14px",
        borderRadius: 6,
        border: "none",
        cursor: "pointer",
        fontSize: 13,
        fontFamily: "monospace",
        fontWeight: 500,
    },
    btnPlay: {
        background: "#a6e3a1",
        color: "#1e1e2e",
    },
    btnStop: {
        background: "#f38ba8",
        color: "#1e1e2e",
    },
    btnRemove: {
        background: "#45475a",
        color: "#cdd6f4",
    },
    tags: {
        display: "flex",
        gap: 6,
        marginTop: 10,
        flexWrap: "wrap",
    },
    tag: {
        background: "#313244",
        color: "#89b4fa",
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 11,
    },
    path: {
        marginTop: 10,
        fontSize: 10,
        color: "#45475a",
        wordBreak: "break-all",
    },
    error: {
        marginTop: 8,
        color: "#f38ba8",
        fontSize: 12,
        background: "#2a1a1e",
        borderRadius: 4,
        padding: "4px 8px",
    },
}