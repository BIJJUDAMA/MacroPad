import { useEffect, useState, useCallback, useRef } from "react"
import { DaemonStatus, MacroInfo } from "../types/macro"

import { tauriInvoke } from "../lib/tauri"

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

export function useMacroList(
    paths: string[],
    setPaths: (paths: string[]) => void,
) {
    const [macros, setMacros] = useState<MacroInfo[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const pathsRef = useRef<string[]>(paths)

    useEffect(() => {
        pathsRef.current = paths
    }, [paths])

    const loadInfosForPaths = useCallback(async (pathList: string[]) => {
        if (!pathList || pathList.length === 0) {
            setMacros([])
            return
        }
        setLoading(true)
        setError(null)
        const results = await Promise.all(
            pathList.map(async path => {
                try {
                    return await tauriInvoke<MacroInfo>("get_macro_info", { path })
                } catch (e) {
                    console.error("failed to load:", path, e)
                    return null
                }
            })
        )
        setMacros(results.filter((m): m is MacroInfo => m !== null))
        setLoading(false)
    }, [])

    useEffect(() => {
        loadInfosForPaths(paths)
    }, [paths, loadInfosForPaths])

    const refresh = useCallback(() => {
        loadInfosForPaths(pathsRef.current)
    }, [loadInfosForPaths])

    const addMacro = useCallback(async (path: string) => {
        if (pathsRef.current.includes(path)) return
        const next = [...pathsRef.current, path]
        setPaths(next)
    }, [setPaths])

    const removeMacro = useCallback((path: string) => {
        const next = pathsRef.current.filter(p => p !== path)
        setPaths(next)
    }, [setPaths])

    const duplicateMacro = useCallback(async (path: string) => {
        try {
            const newPath = await tauriInvoke<string>("duplicate_file", { path })
            const next = [...pathsRef.current, newPath]
            setPaths(next)
        } catch (e) {
            console.error("duplicate failed:", e)
        }
    }, [setPaths])

    return { macros, loading, error, refresh, addMacro, removeMacro, duplicateMacro }
}