import { useEffect, useState, useCallback } from "react"
import { DaemonStatus, MacroInfo } from "../types/macro"

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core")
    return invoke<T>(cmd, args)
}

export function useDaemonStatus() {
    const [status, setStatus] = useState<DaemonStatus>("offline")

    const refresh = useCallback(async () => {
        try {
            const s = await tauriInvoke<string>("get_daemon_status")
            setStatus(s)
        } catch {
            setStatus("offline")
        }
    }, [])

    useEffect(() => {
        refresh()
        const interval = setInterval(refresh, 3000)
        return () => clearInterval(interval)
    }, [refresh])

    return { status, refresh }
}

export function useMacroList() {
    const [macros, setMacros] = useState<MacroInfo[]>([])
    const [paths, setPaths] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadInfo = useCallback(async (path: string): Promise<MacroInfo | null> => {
        try {
            const info = await tauriInvoke<MacroInfo>("get_macro_info", { path })
            return info
        } catch (e) {
            console.error("failed to load macro info for", path, e)
            return null
        }
    }, [])

    const refresh = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            setPaths(prev => {
                loadInfosForPaths(prev)
                return prev
            })
        } finally {
            setLoading(false)
        }
    }, [])

    async function loadInfosForPaths(pathList: string[]) {
        setLoading(true)
        const results = await Promise.all(pathList.map(p => loadInfo(p)))
        const valid = results.filter((m): m is MacroInfo => m !== null)
        setMacros(valid)
        setLoading(false)
    }

    const addMacro = useCallback(async (path: string) => {
        console.log("addMacro called with path:", path)
        const info = await loadInfo(path)
        console.log("loaded info:", info)
        if (!info) {
            setError(`could not load file: ${path}`)
            return
        }
        setPaths(prev => {
            if (prev.includes(path)) return prev
            const next = [...prev, path]
            loadInfosForPaths(next)
            return next
        })
    }, [loadInfo])

    const removeMacro = useCallback((path: string) => {
        setPaths(prev => {
            const next = prev.filter(p => p !== path)
            loadInfosForPaths(next)
            return next
        })
    }, [])

    return { macros, loading, error, refresh, addMacro, removeMacro }
}