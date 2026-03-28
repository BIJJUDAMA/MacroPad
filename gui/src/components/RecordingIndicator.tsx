import { useEffect, useState, useRef } from "react"
import { RecordingState } from "../hooks/useRecording"
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Square, Radio } from 'lucide-react'

interface Props {
    state: RecordingState
    onStop: () => void
    error: string | null
}

export function RecordingIndicator({ state, onStop, error }: Props) {
    const [elapsed, setElapsed] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)
    const dotRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (state !== "recording") {
            setElapsed(0)
            return
        }
        const interval = setInterval(() => setElapsed(e => e + 1), 1000)
        return () => clearInterval(interval)
    }, [state])

    useGSAP(() => {
        if (state === 'recording' && dotRef.current) {
            gsap.to(dotRef.current, {
                opacity: 0.3,
                scale: 0.8,
                duration: 0.8,
                yoyo: true,
                repeat: -1,
                ease: 'power1.inOut'
            })
        }
    }, [state])

    useGSAP(() => {
        if (state !== 'idle' && containerRef.current) {
            gsap.fromTo(containerRef.current,
                { y: -20, autoAlpha: 0, scale: 0.95 },
                { y: 0, autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }
            )
        }
    }, [state])

    if (state === "idle") return null

    const mins = Math.floor(elapsed / 60).toString().padStart(2, "0")
    const secs = (elapsed % 60).toString().padStart(2, "0")

    return (
        <div 
            ref={containerRef}
            className="flex justify-between items-center bg-surface border border-primary/40 rounded-xl px-5 py-3 mb-6 shadow-[0_4px_24px_rgba(255,95,31,0.15)] relative overflow-hidden"
        >
            {/* Background Glow */}
            <div className="absolute inset-0 bg-primary/5 pointer-events-none"></div>

            <div className="flex items-center gap-4 relative z-10">
                <div ref={dotRef} className="text-primary flex items-center justify-center">
                    <Radio size={20} className="fill-primary text-primary" />
                </div>
                
                <span className="text-primary font-bold text-sm tracking-widest uppercase">
                    {state === "saving" ? "Saving Data..." : "Recording Live Input"}
                </span>
                
                {state === "recording" && (
                     <span className="text-gray-300 font-mono text-sm ml-4 pl-4 border-l border-surface-lighter">
                         {mins}:{secs} <span className="text-tertiary ml-2 text-xs">· Press F9</span>
                     </span>
                )}
                
                {error && <span className="text-red-400 text-xs opacity-80">{error}</span>}
            </div>

            {state === "recording" && (
                <button 
                    className="relative z-10 flex items-center gap-2 bg-primary/10 text-primary border border-primary/30 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-primary hover:text-neutral transition-colors shadow-sm"
                    onClick={onStop}
                >
                    <Square size={14} className="fill-current" /> Stop
                </button>
            )}
        </div>
    )
}