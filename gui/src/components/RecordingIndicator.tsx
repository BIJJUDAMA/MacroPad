import { useEffect, useState } from "react"
import { RecordingState } from "../hooks/useRecording"
import { Square, Radio } from 'lucide-react'

interface Props {
    state: RecordingState
    onStop: () => void
    error: string | null
}

export function RecordingIndicator({ state, onStop, error }: Props) {
    const [elapsed, setElapsed] = useState(0)
    const [justStarted, setJustStarted] = useState(false)

    useEffect(() => {
        if (state !== "recording") {
            setElapsed(0)
            setJustStarted(false)
            return
        }
        
        setJustStarted(true)
        const startTimer = setTimeout(() => setJustStarted(false), 3000)
        
        const interval = setInterval(() => setElapsed(e => e + 1), 1000)
        return () => {
            clearInterval(interval)
            clearTimeout(startTimer)
        }
    }, [state])

    if (state === "idle" && !error) return null

    const mins = Math.floor(elapsed / 60).toString().padStart(2, "0")
    const secs = (elapsed % 60).toString().padStart(2, "0")

    return (
        <div 
            className={`flex justify-between items-center bg-surface border rounded-xl px-5 py-3 mb-6 shadow-2xl relative overflow-hidden transition-all duration-500 ${justStarted ? 'border-primary scale-[1.02] shadow-primary/20' : 'border-primary/40'}`}
        >
            {/* Background Glow */}
            <div className={`absolute inset-0 pointer-events-none transition-colors duration-500 ${justStarted ? 'bg-primary/10' : 'bg-primary/5'}`}></div>

            <div className="flex items-center gap-4 relative z-10">
                <div className={`flex items-center justify-center transition-transform duration-500 ${justStarted ? 'scale-125' : ''}`}>
                    <Radio size={20} className={`fill-primary text-primary`} />
                </div>
                
                <div className="flex flex-col">
                    <span className={`font-bold text-sm tracking-widest uppercase transition-all duration-300 ${justStarted ? 'text-primary scale-110 origin-left' : 'text-primary/90'}`}>
                        {state === "saving" ? "Saving Data..." : justStarted ? "Recording Started" : "Recording Live Input"}
                    </span>
                    {justStarted && <span className="text-[10px] text-primary/60 font-medium uppercase tracking-[0.2em]">Capturing Telemetry...</span>}
                </div>
                
                {state === "recording" && !justStarted && (
                     <span className="text-gray-300 font-mono text-sm ml-4 pl-4 border-l border-surface-lighter">
                         {mins}:{secs} <span className="text-tertiary ml-2 text-xs">· Press F9</span>
                     </span>
                )}
                
                {error && <span className="text-red-400 text-xs opacity-80 ml-4">{error}</span>}
            </div>

            {(state === "recording" || state === "saving") && (
                <button 
                    className={`btn-brutal relative z-10 flex items-center gap-2 text-xs ${state === "saving" ? 'bg-surface-lighter text-text-dim cursor-not-allowed opacity-50' : 'bg-primary/10 text-primary border border-primary/30'}`}
                    onClick={onStop}
                    disabled={state === "saving"}
                >
                    <Square size={14} className="fill-current" /> 
                    {state === "saving" ? "Saving..." : "Stop"}
                </button>
            )}
        </div>
    )
}