import { useRef } from "react"
import { BlockStatement, BlockType, PALETTE } from "../types/script"
import { Trash2, GripVertical, Plus } from 'lucide-react'

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
    const color = palette?.color ?? "#89CFF0"
    const hasBody = ["if", "elif", "else", "loop", "loop_while"].includes(block.type)

    return (
        <div
            className="mb-3 bg-surface border border-surface-lighter rounded-lg overflow-hidden flex flex-col transition-shadow hover:shadow-md"
            style={{ marginLeft: depth * 24 }}
            draggable
            onDragStart={e => dragHandlers.onDragStart(e, block.id)}
            onDragOver={e => dragHandlers.onDragOver(e, block.id)}
            onDrop={e => dragHandlers.onDrop(e, block.id)}
        >
            <div className="flex items-start p-3 gap-3 bg-surface-light relative group">
                {/* Drag Handle & Left Border Indicator */}
                <div 
                    className="absolute left-0 top-0 bottom-0 w-1 drop-shadow-sm opacity-80"
                    style={{ backgroundColor: color }}
                />
                
                <div className="text-tertiary cursor-grab active:cursor-grabbing hover:text-gray-300 mt-0.5" title="Drag to reorder">
                    <GripVertical size={16} />
                </div>

                <div 
                    className="text-xs font-bold uppercase tracking-wider w-24 pt-1"
                    style={{ color }}
                >
                    {block.type}
                </div>
                
                <div className="flex-1 flex flex-col gap-2">
                    {Object.entries(block.args).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2">
                            <span className="text-[10px] text-tertiary uppercase tracking-widest w-16 text-right select-none">{key}</span>
                            <input
                                className="flex-1 bg-neutral border border-surface-lighter rounded-md px-2 py-1 text-xs text-gray-200 font-mono focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary/30 transition-all placeholder:text-surface-lighter"
                                value={val}
                                onChange={e => onUpdate(block.id, { ...block.args, [key]: e.target.value })}
                            />
                        </div>
                    ))}
                </div>

                <button
                    className="text-surface-lighter hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-surface hover:bg-surface-lighter rounded-md"
                    onClick={() => onDelete(block.id)}
                    title="Delete block"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {hasBody && (
                <div className="border-t border-surface-lighter bg-neutral/50 p-3 pl-8">
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
                    <div className="flex flex-wrap gap-2 mt-2">
                        {PALETTE.filter(p => !["if", "elif", "else"].includes(p.type)).map(p => (
                            <button
                                key={p.type}
                                className="flex items-center gap-1 bg-surface-light border border-surface-lighter hover:bg-surface-lighter rounded-md px-2 py-1 text-[10px] font-mono uppercase tracking-widest transition-colors"
                                style={{ color: p.color }}
                                onClick={() => onAddChild(block.id, p.type)}
                            >
                                <Plus size={10} /> {p.label}
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
            // Optional: Add some visual feedback to _e.dataTransfer
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
        <div className="flex h-full w-full overflow-hidden bg-neutral">
            {/* Palette Sidebar */}
            <div className="w-[220px] bg-surface/50 border-r border-surface-lighter p-4 flex flex-col overflow-y-auto shrink-0 custom-scrollbar">
                <div className="text-[10px] text-tertiary uppercase tracking-widest font-bold mb-4 px-1">Component Library</div>
                {PALETTE.map(item => (
                    <button
                        key={item.type}
                        className="flex flex-col text-left bg-surface border border-surface-lighter hover:border-gray-600 rounded-lg p-3 mb-2 transition-all hover:-translate-y-0.5 select-none relative overflow-hidden"
                        onClick={() => addBlock(item.type)}
                        title={item.description}
                    >
                        <div 
                            className="absolute left-0 top-0 bottom-0 w-1"
                            style={{ backgroundColor: item.color }}
                        />
                        <span className="font-bold text-xs pl-2" style={{ color: item.color }}>{item.label}</span>
                        <span className="text-[10px] text-gray-500 mt-1 pl-2 leading-tight">{item.description}</span>
                    </button>
                ))}
            </div>

            {/* Canvas Area */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar relative">
                {blocks.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-tertiary">
                        <div className="border border-dashed border-surface-lighter rounded-xl p-12 text-center bg-surface/30">
                            <Plus size={32} className="mx-auto mb-4 opacity-50" />
                            <p className="font-mono text-xs uppercase tracking-widest">Construct Blueprint</p>
                            <p className="text-[10px] opacity-60 mt-2">Drag components from library or click to insert</p>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-4xl pb-10">
                        {blocks.map((block) => (
                            <BlockCard
                                key={block.id}
                                block={block}
                                depth={0}
                                onDelete={deleteBlock}
                                onUpdate={updateBlock}
                                onAddChild={addChild}
                                dragHandlers={dragHandlers}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}