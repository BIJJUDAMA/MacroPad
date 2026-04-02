import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type RecordingState = "idle" | "recording" | "saving";

interface RecordingContextType {
    state: RecordingState;
    error: string | null;
    lastSavedPath: string | null;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<void>;
    toggleRecording: () => Promise<void>;
}

const RecordingContext = createContext<RecordingContextType | undefined>(undefined);

export const RecordingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<RecordingState>("idle");
    const [error, setError] = useState<string | null>(null);
    const [lastSavedPath, setLastSavedPath] = useState<string | null>(null);

    // Listen for global stop events (e.g. F9)
    useEffect(() => {
        const unlistenPromise = listen<string | null>("recording-finished", (event) => {
            console.log("RecordingContext: Received recording-finished event with path:", event.payload);
            
            if (event.payload) {
                setLastSavedPath(event.payload);
            }
            setState("idle");
        });
        
        return () => {
            unlistenPromise.then(fn => fn());
        };
    }, []);

    const stopRecording = useCallback(async () => {
        if (state !== "recording") return;
        setState("saving");
        setError(null);
        try {
            await invoke("stop_record");
            setState("idle");
        } catch (e) {
            console.error("Stop recording failed:", e);
            setError(String(e));
            setState("idle");
        }
    }, [state]);

    const startRecording = useCallback(async () => {
        if (state !== "idle") return;
        setError(null);
        setLastSavedPath(null);
        try {
            const path = await invoke<string | null>("save_as_mpr");
            if (!path) return;
            await invoke("start_record", { outputPath: path });
            setState("recording");
        } catch (e) {
            console.error("Start recording failed:", e);
            setError(`Start failed: ${String(e)}`);
            setState("idle");
        }
    }, [state]);

    const toggleRecording = useCallback(async () => {
        if (state === "idle") {
            await startRecording();
        } else if (state === "recording") {
            await stopRecording();
        }
    }, [state, startRecording, stopRecording]);

    return (
        <RecordingContext.Provider value={{ state, error, lastSavedPath, startRecording, stopRecording, toggleRecording }}>
            {children}
        </RecordingContext.Provider>
    );
};

export const useRecordingContext = () => {
    const context = useContext(RecordingContext);
    if (!context) {
        throw new Error("useRecordingContext must be used within a RecordingProvider");
    }
    return context;
};
