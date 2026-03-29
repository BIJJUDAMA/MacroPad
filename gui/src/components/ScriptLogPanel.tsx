import { TerminalIcon } from 'lucide-react'

interface Props {
    lines: string[]
    running: boolean
}

export function ScriptLogPanel({ lines, running }: Props) {
    if (lines.length === 0 && !running) return (
        <div className="h-full w-full bg-surface border-t border-surface-lighter flex flex-col">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-lighter bg-surface-lighter/30">
                <TerminalIcon size={14} className="text-tertiary" />
                <span className="text-[10px] text-tertiary uppercase tracking-[0.15em] font-bold">Execution Output</span>
            </div>
            <div className="flex-1 flex items-center justify-center text-tertiary font-mono text-xs opacity-50">
                // System awaiting execution commands
            </div>
        </div>
    )

    return (
        <div className="h-full w-full bg-surface border-t border-surface-lighter flex flex-col">
            <div className="flex justify-between items-center px-4 py-2 border-b border-surface-lighter bg-surface-lighter/30">
                <div className="flex items-center gap-2">
                    <TerminalIcon size={14} className="text-tertiary" />
                    <span className="text-[10px] text-tertiary uppercase tracking-[0.15em] font-bold">Execution Output</span>
                    {running && (
                        <span className="flex items-center gap-1.5 ml-2 border border-secondary/30 bg-secondary/10 px-2 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                            <span className="text-[9px] text-secondary uppercase tracking-widest font-bold">Processing</span>
                        </span>
                    )}
                </div>
                <div className="text-[9px] text-tertiary font-mono">
                    [{lines.length} lines emitted]
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs custom-scrollbar">
                {lines.map((line, i) => {
                    const isError = line.toLowerCase().includes("error") || line.toLowerCase().includes("failed")
                    const isSuccess = line.toLowerCase().includes("ok") || line.toLowerCase().includes("success")
                    const isDryRun = line.toLowerCase().includes("dry-run")
                    
                    return (
                        <div key={i} className={`leading-relaxed mb-1 pl-3 border-l-2 ${
                            isError ? "text-red-400 border-red-500/50 bg-red-500/5 py-0.5"
                                : isSuccess ? "text-text-main border-green-500/50"
                                    : isDryRun ? "text-secondary border-secondary/50"
                                        : "text-text-muted border-surface-lighter"
                        }`}>
                            {line}
                        </div>
                    )
                })}
                {running && (
                    <div className="leading-relaxed mb-1 pl-3 border-l-2 border-surface-lighter text-tertiary animate-pulse">
                        <span className="w-2 h-4 bg-tertiary inline-block align-middle ml-1"></span>
                    </div>
                )}
            </div>
        </div>
    )
}