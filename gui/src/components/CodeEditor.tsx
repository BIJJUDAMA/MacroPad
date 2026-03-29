import { useRef, forwardRef, useImperativeHandle } from "react"

interface Props {
    value: string
    onChange: (val: string) => void
}

export const CodeEditor = forwardRef<HTMLTextAreaElement, Props>(({ value, onChange }, ref) => {
    const lineCount = Math.max(1, value.split("\n").length)
    const taRef = useRef<HTMLTextAreaElement>(null)
    useImperativeHandle(ref, () => taRef.current!)
    const gutterRef = useRef<HTMLDivElement>(null)

    // Removed GSAP animations for performance and to fix UI flashes.

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
    
    // Sync gutter scroll with textarea scroll
    function handleScroll(e: React.UIEvent<HTMLTextAreaElement>) {
        if (gutterRef.current) {
            gutterRef.current.scrollTop = e.currentTarget.scrollTop
        }
    }

    return (
        <div className="flex h-full w-full bg-neutral font-mono text-sm leading-relaxed overflow-hidden">
            {/* Soft left accent indicating active code zone */}
            <div className="w-1 bg-surface-lighter/50 h-full shadow-[inset_-1px_0_0_rgba(255,255,255,0.02)]"></div>
            
            <div 
                ref={gutterRef}
                className="bg-surface/30 border-r border-surface-lighter py-4 pr-3 pl-2 text-right min-w-[48px] select-none text-tertiary overflow-hidden"
                style={{ scrollbarWidth: 'none' }}
            >
                {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i} className="h-[1.6em] text-[12px] opacity-40">{i + 1}</div>
                ))}
            </div>
            
            <textarea
                ref={taRef}
                className="flex-1 bg-transparent text-gray-200 p-4 outline-none resize-none font-mono text-sm leading-relaxed whitespace-pre custom-scrollbar focus:ring-1 focus:ring-inset focus:ring-secondary/10"
                style={{ tabSize: 4 }}
                value={value}
                onChange={e => onChange(e.target.value)}
                onScroll={handleScroll}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                placeholder="// Initialize operational sequence..."
            />
        </div>
    )
})