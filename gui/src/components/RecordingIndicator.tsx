import { useEffect, useState } from "react"
import { RecordingState } from "../hooks/useRecording"

interface Props {
    state: RecordingState
    onStop: () => void
    error: string | null
}

export function RecordingIndicator({ state, onStop, error }: Props) {
    const [elapsed, setElapsed] = useState(0)

    useEffect(() => {
        if (state !== "recording") {
            setElapsed(0)
            return
        }
        const interval = setInterval(() => setElapsed(e => e + 1), 1000)
        return () => clearInterval(interval)
    }, [state])

    if (state === "idle") return null

    const mins = Math.floor(elapsed / 60).toString().padStart(2, "0")
    const secs = (elapsed % 60).toString().padStart(2, "0")

    return (
        <div style={styles.banner}>
            <div style={styles.left}>
                <div style={styles.dot} />
                <span style={styles.label}>
                    {state === "saving"
                        ? "saving..."
                        : `recording  ${mins}:${secs}  ·  press F9 or click stop`}
                </span>
                {error && <span style={styles.error}>{error}</span>}
            </div>
            {state === "recording" && (
                <button style={styles.stopBtn} onClick={onStop}>
                    stop recording
                </button>
            )}
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    banner: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "#2a1a1e",
        border: "1px solid #f38ba8",
        borderRadius: 6,
        padding: "10px 16px",
        marginBottom: 16,
        fontFamily: "monospace",
    },
    left: {
        display: "flex",
        alignItems: "center",
        gap: 10,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: "#f38ba8",
    },
    label: {
        color: "#f38ba8",
        fontSize: 13,
        fontWeight: 600,
    },
    error: {
        color: "#f38ba8",
        fontSize: 11,
        opacity: 0.7,
    },
    stopBtn: {
        background: "#f38ba8",
        color: "#1e1e2e",
        border: "none",
        borderRadius: 6,
        padding: "6px 16px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "monospace",
    },
}