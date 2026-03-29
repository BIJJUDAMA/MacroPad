export type ScriptView = "code" | "blocks"

export interface BlockStatement {
    id: string
    type: BlockType
    args: Record<string, string>
    children: BlockStatement[]
}

export type BlockType =
    | "let"
    | "run"
    | "run_async"
    | "if"
    | "elif"
    | "else"
    | "loop"
    | "loop_while"
    | "wait_for"
    | "delay"

export interface BlockPaletteItem {
    type: BlockType
    label: string
    color: string
    description: string
}

export const PALETTE: BlockPaletteItem[] = [
    { type: "run", label: "run", color: "var(--block-run)", description: "run a .mpr recording" },
    { type: "run_async", label: "run async", color: "var(--block-run)", description: "run without waiting" },
    { type: "if", label: "if", color: "var(--block-control)", description: "conditional branch" },
    { type: "loop", label: "loop(n)", color: "var(--block-loop)", description: "repeat N times" },
    { type: "loop_while", label: "loop while", color: "var(--block-loop)", description: "repeat while condition" },
    { type: "wait_for", label: "wait for", color: "var(--block-wait)", description: "wait for condition" },
    { type: "delay", label: "delay", color: "var(--block-delay)", description: "pause execution" },
    { type: "let", label: "let", color: "var(--block-var)", description: "declare a variable" },
]