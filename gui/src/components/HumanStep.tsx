import { useState } from "react"
import { HumanAction } from "../types/editor"

interface Props {
    action: HumanAction
    index: number
    onDelete: (id: string) => void
    onUpdateDelay: (id: string, ms: number) => void
}

export function HumanStep({ action, index, onDelete, onUpdateDelay }: Props) {
    const [expanded, setExpanded] = useState(false)
    const [editingMs, setEditingMs] = useState(false)
    const [msValue, setMsValue] = useState(String(action.editable_ms ?? ""))

    function handleSaveMs() {
        const val = parseInt(msValue)
        if (!isNaN(val) && val >= 0) {
            onUpdateDelay(action.id, val)
        }
        setEditingMs(false)
    }

    return (
        <div style={styles.step}>
            <div style={styles.row}>
                <div style={styles.left}>
                    <span style={styles.index}>{index + 1}</span>
                    <div>
                        <div style={styles.label}>{action.label}</div>
                        {action.editable_ms !== undefined ? (
                            editingMs ? (
                                <div style={styles.editRow}>
                                    <input
                                        style={styles.msInput}
                                        value={msValue}
                                        onChange={e => setMsValue(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") handleSaveMs() }}
                                        autoFocus
                                    />
                                    <span style={styles.msLabel}>ms</span>
                                    <button style={styles.btnSave} onClick={handleSaveMs}>save</button>
                                    <button style={styles.btnCancel} onClick={() => setEditingMs(false)}>cancel</button>
                                </div>
                            ) : (
                                <div
                                    style={styles.detail}
                                    onClick={() => setEditingMs(true)}
                                    title="click to edit"
                                >
                                    {action.detail} ✎
                                </div>
                            )
                        ) : (
                            <div style={styles.detail}>{action.detail}</div>
                        )}
                    </div>
                </div>
                <div style={styles.actions}>
                    {action.raw_events.length > 1 && (
                        <button
                            style={styles.btnExpand}
                            onClick={() => setExpanded(e => !e)}
                        >
                            {expanded ? "collapse" : "expand"}
                        </button>
                    )}
                    <button
                        style={styles.btnDelete}
                        onClick={() => onDelete(action.id)}
                    >
                        delete
                    </button>
                </div>
            </div>

            {expanded && (
                <div style={styles.rawList}>
                    {action.raw_events.map((e, i) => (
                        <div key={i} style={styles.rawRow}>
                            <span style={styles.rawTime}>{e.time_ms}ms</span>
                            <span style={styles.rawType}>{e.type}</span>
                            <span style={styles.rawDetail}>
                                {e.key || e.value || (e.x !== undefined ? `(${e.x}, ${e.y})` : "") || ""}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    step: {
        background: "#1e1e2e",
        border: "1px solid #313244",
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 8,
    },
    row: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    left: {
        display: "flex",
        alignItems: "center",
        gap: 12,
    },
    index: {
        background: "#313244",
        color: "#6c7086",
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 11,
        minWidth: 24,
        textAlign: "center",
    },
    label: {
        fontSize: 14,
        color: "#cdd6f4",
        fontWeight: 500,
    },
    detail: {
        fontSize: 12,
        color: "#6c7086",
        marginTop: 2,
        cursor: "text",
    },
    editRow: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginTop: 4,
    },
    msInput: {
        background: "#313244",
        border: "1px solid #89b4fa",
        borderRadius: 4,
        padding: "2px 6px",
        color: "#cdd6f4",
        fontSize: 12,
        width: 70,
        fontFamily: "monospace",
        outline: "none",
    },
    msLabel: {
        fontSize: 12,
        color: "#6c7086",
    },
    btnSave: {
        background: "#a6e3a1",
        color: "#1e1e2e",
        border: "none",
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 11,
        cursor: "pointer",
        fontFamily: "monospace",
    },
    btnCancel: {
        background: "#45475a",
        color: "#cdd6f4",
        border: "none",
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 11,
        cursor: "pointer",
        fontFamily: "monospace",
    },
    actions: {
        display: "flex",
        gap: 6,
    },
    btnExpand: {
        background: "#313244",
        color: "#89b4fa",
        border: "none",
        borderRadius: 4,
        padding: "4px 10px",
        fontSize: 11,
        cursor: "pointer",
        fontFamily: "monospace",
    },
    btnDelete: {
        background: "#2a1a1e",
        color: "#f38ba8",
        border: "1px solid #f38ba8",
        borderRadius: 4,
        padding: "4px 10px",
        fontSize: 11,
        cursor: "pointer",
        fontFamily: "monospace",
    },
    rawList: {
        marginTop: 10,
        borderTop: "1px solid #313244",
        paddingTop: 10,
    },
    rawRow: {
        display: "flex",
        gap: 12,
        fontSize: 11,
        fontFamily: "monospace",
        marginBottom: 4,
        color: "#6c7086",
    },
    rawTime: {
        color: "#45475a",
        minWidth: 60,
    },
    rawType: {
        color: "#89b4fa",
        minWidth: 100,
    },
    rawDetail: {
        color: "#cdd6f4",
    },
}