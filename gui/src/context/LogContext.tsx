import { createContext, useContext, useState, ReactNode } from 'react';

interface LogContextType {
    logLines: string[];
    isExecuting: boolean;
    addLog: (line: string) => void;
    addLogs: (lines: string[]) => void;
    clearLogs: () => void;
    setExecuting: (executing: boolean) => void;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

export function LogProvider({ children }: { children: ReactNode }) {
    const [logLines, setLogLines] = useState<string[]>([]);
    const [isExecuting, setExecuting] = useState(false);

    const addLog = (line: string) => {
        setLogLines(prev => [...prev, line]);
    };

    const addLogs = (lines: string[]) => {
        setLogLines(prev => [...prev, ...lines]);
    };

    const clearLogs = () => {
        setLogLines([]);
    };

    return (
        <LogContext.Provider value={{ logLines, isExecuting, addLog, addLogs, clearLogs, setExecuting }}>
            {children}
        </LogContext.Provider>
    );
}

export function useLogs() {
    const context = useContext(LogContext);
    if (context === undefined) {
        throw new Error('useLogs must be used within a LogProvider');
    }
    return context;
}
