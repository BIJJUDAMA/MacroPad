interface Props {
    lines: string[]
    running: boolean
}

export function ScriptLogPanel({ lines, running }: Props) {
    if (lines.length === 0 && !running) return null

    return (
        <div style={styles.panel}>
            <div style={styles.header}>
                <span style={styles.title}>output</span>
                {running && <span style={styles.running}>running...</span>}
            </div>
            <div style={styles.log}>
                {lines.map((line, i) => (
                    <div key={i} style={{
                        ...styles.line,
                        color: line.includes("error") ? "#f38ba8"
                            : line.includes("ok") || line.includes("success") ? "#a6e3a1"
                                : line.includes("dry-run") ? "#89b4fa"
                                    : "#cdd6f4",
                    }}>
                        {line}
                    </div>
                ))}
                {running && (
                    <div style={{ ...styles.line, color: "#6c7086" }}>...</div>
                )}
            </div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    panel: {
        borderTop: "1px solid #313244",
        background: "#13131e",
        flexShrink: 0,
        maxHeight: 200,
        display: "flex",
        flexDirection: "column",
    },
    header: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 16px",
        borderBottom: "1px solid #313244",
    },
    title: {
        fontSize: 11,
        color: "#45475a",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
    },
    running: {
        fontSize: 11,
        color: "#89b4fa",
    },
    log: {
        overflowY: "auto",
        padding: "8px 16px",
        fontFamily: "monospace",
        fontSize: 12,
        flex: 1,
    },
    line: {
        lineHeight: "1.6",
        marginBottom: 2,
    },
}