import { useState, useCallback, useEffect } from "react"

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core")
    return invoke<T>(cmd, args)
}

export type RecordingState = "idle" | "recording" | "saving"

export function useRecording(onSaved: (path: string) => void) {
    const [state, setState] = useState<RecordingState>("idle")
    const [outputPath, setOutputPath] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const stopRecording = useCallback(async () => {
        if (state !== "recording") return
        setState("saving")
        setError(null)
        try {
            await tauriInvoke("stop_record")
            if (outputPath) onSaved(outputPath)
            setState("idle")
            setOutputPath(null)
        } catch (e) {
            console.error("Stop recording failed:", e)
            setError(String(e))
            setState("idle")
        }
    }, [state, outputPath, onSaved])

    const startRecording = useCallback(async () => {
        setError(null)
        console.log("Recording: Initiating save dialog...")
        try {
            const path = await tauriInvoke<string | null>("save_as_mpr")
            if (!path) {
                console.log("Recording: User cancelled save dialog.")
                return
            }
            console.log("Recording: Path selected:", path)
            setOutputPath(path)
            
            console.log("Recording: Sending start_record command...")
            await tauriInvoke("start_record", { outputPath: path })
            console.log("Recording: Start success! Moving to recording state.")
            setState("recording")
        } catch (e) {
            console.error("Start recording failed:", e)
            setError(`Start failed: ${String(e)}`)
            setState("idle")
            // Keep error visible for awareness
        }
    }, [])

    useEffect(() => {
        if (state !== "recording") return
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "F9") {
                e.preventDefault()
                stopRecording()
            }
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [state, stopRecording])

    return { state, error, startRecording, stopRecording }
}