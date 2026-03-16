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
    { type: "run", label: "run", color: "#1D9E75", description: "run a .nitsrec file" },
    { type: "run_async", label: "run async", color: "#1D9E75", description: "run without waiting" },
    { type: "if", label: "if", color: "#534AB7", description: "conditional branch" },
    { type: "loop", label: "loop(n)", color: "#BA7517", description: "repeat N times" },
    { type: "loop_while", label: "loop while", color: "#BA7517", description: "repeat while condition" },
    { type: "wait_for", label: "wait for", color: "#185FA5", description: "wait for condition" },
    { type: "delay", label: "delay", color: "#5F5E5A", description: "pause execution" },
    { type: "let", label: "let", color: "#993556", description: "declare a variable" },
]