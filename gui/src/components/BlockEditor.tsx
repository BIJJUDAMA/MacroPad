import { useRef } from "react"
import { BlockStatement, BlockType, PALETTE } from "../types/script"

interface Props {
    blocks: BlockStatement[]
    onChange: (blocks: BlockStatement[]) => void
    scriptDir: string
}

function makeId() {
    return Math.random().toString(36).slice(2, 9)
}

function defaultArgs(type: BlockType): Record<string, string> {
    switch (type) {
        case "run": return { path: "" }
        case "run_async": return { path: "" }
        case "let": return { name: "", value: "" }
        case "loop": return { count: "3" }
        case "loop_while": return { condition: "macro_ok", max: "1000" }
        case "wait_for": return { condition: "window(\"\")", timeout: "15s" }
        case "delay": return { ms: "500ms" }
        case "if": return { condition: "macro_ok" }
        case "elif": return { condition: "macro_ok" }
        case "else": return {}
        default: return {}
    }
}

function BlockCard({
    block,
    depth,
    onDelete,
    onUpdate,
    onAddChild,
    dragHandlers,
}: {
    block: BlockStatement
    depth: number
    onDelete: (id: string) => void
    onUpdate: (id: string, args: Record<string, string>) => void
    onAddChild: (parentId: string, type: BlockType) => void
    dragHandlers: {
        onDragStart: (e: React.DragEvent, id: string) => void
        onDragOver: (e: React.DragEvent, id: string) => void
        onDrop: (e: React.DragEvent, id: string) => void
    }
}) {
    const palette = PALETTE.find(p => p.type === block.type)
    const color = palette?.color ?? "#5F5E5A"
    const hasBody = ["if", "elif", "else", "loop", "loop_while"].includes(block.type)

    return (
        <div
            style={{ ...styles.block, borderLeftColor: color, marginLeft: depth * 20 }}
            draggable
            onDragStart={e => dragHandlers.onDragStart(e, block.id)}
            onDragOver={e => dragHandlers.onDragOver(e, block.id)}
            onDrop={e => dragHandlers.onDrop(e, block.id)}
        >
            <div style={styles.blockHeader}>
                <div style={{ ...styles.blockType, color }}>
                    {block.type}
                </div>
                <div style={styles.blockArgs}>
                    {Object.entries(block.args).map(([key, val]) => (
                        <div key={key} style={styles.argRow}>
                            <span style={styles.argKey}>{key}</span>
                            <input
                                style={styles.argInput}
                                value={val}
                                onChange={e => onUpdate(block.id, { ...block.args, [key]: e.target.value })}
                            />
                        </div>
                    ))}
                </div>
                <button
                    style={styles.deleteBtn}
                    onClick={() => onDelete(block.id)}
                >
                    ✕
                </button>
            </div>

            {hasBody && (
                <div style={styles.childZone}>
                    {block.children.map(child => (
                        <BlockCard
                            key={child.id}
                            block={child}
                            depth={0}
                            onDelete={onDelete}
                            onUpdate={onUpdate}
                            onAddChild={onAddChild}
                            dragHandlers={dragHandlers}
                        />
                    ))}
                    <div style={styles.addChild}>
                        {PALETTE.filter(p => !["if", "elif", "else"].includes(p.type)).map(p => (
                            <button
                                key={p.type}
                                style={{ ...styles.addChildBtn, borderColor: p.color, color: p.color }}
                                onClick={() => onAddChild(block.id, p.type)}
                            >
                                + {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export function BlockEditor({ blocks, onChange, scriptDir: _ }: Props) {
    const dragId = useRef<string | null>(null)
    const overId = useRef<string | null>(null)

    function addBlock(type: BlockType) {
        const newBlock: BlockStatement = {
            id: makeId(),
            type,
            args: defaultArgs(type),
            children: [],
        }
        onChange([...blocks, newBlock])
    }

    function deleteBlock(id: string) {
        function removeFromList(list: BlockStatement[]): BlockStatement[] {
            return list
                .filter(b => b.id !== id)
                .map(b => ({ ...b, children: removeFromList(b.children) }))
        }
        onChange(removeFromList(blocks))
    }

    function updateBlock(id: string, args: Record<string, string>) {
        function updateInList(list: BlockStatement[]): BlockStatement[] {
            return list.map(b =>
                b.id === id
                    ? { ...b, args }
                    : { ...b, children: updateInList(b.children) }
            )
        }
        onChange(updateInList(blocks))
    }

    function addChild(parentId: string, type: BlockType) {
        const newBlock: BlockStatement = {
            id: makeId(),
            type,
            args: defaultArgs(type),
            children: [],
        }
        function addToList(list: BlockStatement[]): BlockStatement[] {
            return list.map(b =>
                b.id === parentId
                    ? { ...b, children: [...b.children, newBlock] }
                    : { ...b, children: addToList(b.children) }
            )
        }
        onChange(addToList(blocks))
    }

    const dragHandlers = {
        onDragStart: (_e: React.DragEvent, id: string) => {
            dragId.current = id
        },
        onDragOver: (e: React.DragEvent, id: string) => {
            e.preventDefault()
            overId.current = id
        },
        onDrop: (_e: React.DragEvent, targetId: string) => {
            if (!dragId.current || dragId.current === targetId) return

            const srcId = dragId.current
            let srcBlock: BlockStatement | null = null

            function extract(list: BlockStatement[]): BlockStatement[] {
                return list.filter(b => {
                    if (b.id === srcId) { srcBlock = b; return false }
                    b.children = extract(b.children)
                    return true
                })
            }

            const cleaned = extract([...blocks])

            function insertAfter(list: BlockStatement[]): BlockStatement[] {
                const result: BlockStatement[] = []
                for (const b of list) {
                    result.push({ ...b, children: insertAfter(b.children) })
                    if (b.id === targetId && srcBlock) result.push(srcBlock)
                }
                return result
            }

            if (srcBlock) onChange(insertAfter(cleaned))
            dragId.current = null
            overId.current = null
        },
    }

    return (
        <div style={styles.root}>
            <div style={styles.palette}>
                <div style={styles.paletteTitle}>blocks</div>
                {PALETTE.map(item => (
                    <button
                        key={item.type}
                        style={{ ...styles.paletteBtn, borderLeftColor: item.color }}
                        onClick={() => addBlock(item.type)}
                        title={item.description}
                    >
                        <span style={{ color: item.color }}>{item.label}</span>
                        <span style={styles.paletteDesc}>{item.description}</span>
                    </button>
                ))}
            </div>

            <div style={styles.canvas}>
                {blocks.length === 0 ? (
                    <div style={styles.empty}>
                        drag blocks from the left panel or click to add them
                    </div>
                ) : (
                    blocks.map((block) => (
                        <BlockCard
                            key={block.id}
                            block={block}
                            depth={0}
                            onDelete={deleteBlock}
                            onUpdate={updateBlock}
                            onAddChild={addChild}
                            dragHandlers={dragHandlers}
                        />
                    ))
                )}
            </div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: "flex",
        flex: 1,
        overflow: "hidden",
    },
    palette: {
        width: 200,
        background: "#13131e",
        borderRight: "1px solid #313244",
        padding: "12px 8px",
        overflowY: "auto",
        flexShrink: 0,
    },
    paletteTitle: {
        fontSize: 10,
        color: "#45475a",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        marginBottom: 8,
        padding: "0 4px",
    },
    paletteBtn: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        background: "#1e1e2e",
        border: "1px solid #313244",
        borderLeft: "3px solid",
        borderRadius: 4,
        padding: "8px 10px",
        marginBottom: 6,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "monospace",
        fontSize: 12,
    },
    paletteDesc: {
        fontSize: 10,
        color: "#45475a",
        marginTop: 2,
    },
    canvas: {
        flex: 1,
        padding: "16px",
        overflowY: "auto",
    },
    empty: {
        textAlign: "center",
        color: "#45475a",
        fontSize: 13,
        marginTop: 60,
        lineHeight: 1.6,
    },
    block: {
        background: "#1e1e2e",
        border: "1px solid #313244",
        borderLeft: "3px solid",
        borderRadius: 6,
        marginBottom: 8,
        fontFamily: "monospace",
    },
    blockHeader: {
        display: "flex",
        alignItems: "flex-start",
        padding: "10px 12px",
        gap: 12,
    },
    blockType: {
        fontSize: 12,
        fontWeight: 600,
        minWidth: 80,
        paddingTop: 2,
    },
    blockArgs: {
        flex: 1,
        gap: 6,
        display: "flex",
        flexDirection: "column",
    },
    argRow: {
        display: "flex",
        alignItems: "center",
        gap: 8,
    },
    argKey: {
        fontSize: 11,
        color: "#6c7086",
        minWidth: 60,
        textAlign: "right",
    },
    argInput: {
        background: "#313244",
        border: "1px solid #45475a",
        borderRadius: 4,
        padding: "3px 8px",
        color: "#cdd6f4",
        fontSize: 12,
        fontFamily: "monospace",
        outline: "none",
        flex: 1,
    },
    deleteBtn: {
        background: "transparent",
        border: "none",
        color: "#f38ba8",
        cursor: "pointer",
        fontSize: 14,
        padding: "0 4px",
        lineHeight: 1,
    },
    childZone: {
        borderTop: "1px solid #313244",
        padding: "8px 12px 8px 24px",
        background: "#181825",
    },
    addChild: {
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        marginTop: 6,
    },
    addChildBtn: {
        background: "transparent",
        border: "1px solid",
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 10,
        cursor: "pointer",
        fontFamily: "monospace",
    },
}