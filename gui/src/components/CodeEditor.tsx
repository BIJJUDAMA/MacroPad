import { useRef } from "react"

interface Props {
    value: string
    onChange: (val: string) => void
}

export function CodeEditor({ value, onChange }: Props) {
    const lineCount = value.split("\n").length
    const taRef = useRef<HTMLTextAreaElement>(null)

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Tab") {
            e.preventDefault()
            const ta = taRef.current
            if (!ta) return
            const start = ta.selectionStart
            const end = ta.selectionEnd
            const next = value.substring(0, start) + "    " + value.substring(end)
            onChange(next)
            requestAnimationFrame(() => {
                ta.selectionStart = start + 4
                ta.selectionEnd = start + 4
            })
        }
    }

    return (
        <div style={styles.root}>
            <div style={styles.gutter}>
                {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i} style={styles.lineNum}>{i + 1}</div>
                ))}
            </div>
            <textarea
                ref={taRef}
                style={styles.textarea}
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
            />
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: "flex",
        flex: 1,
        overflow: "hidden",
        fontFamily: "monospace",
        fontSize: 13,
        lineHeight: "1.6",
    },
    gutter: {
        background: "#181825",
        borderRight: "1px solid #313244",
        padding: "16px 8px",
        textAlign: "right",
        minWidth: 40,
        overflowY: "hidden",
        userSelect: "none",
    },
    lineNum: {
        color: "#45475a",
        fontSize: 12,
        lineHeight: "1.6",
        height: "1.6em",
    },
    textarea: {
        flex: 1,
        background: "#181825",
        color: "#cdd6f4",
        border: "none",
        outline: "none",
        padding: "16px",
        resize: "none",
        fontFamily: "monospace",
        fontSize: 13,
        lineHeight: "1.6",
        overflowY: "auto",
        whiteSpace: "pre",
        tabSize: 4,
    },
}