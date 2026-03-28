import React, { createContext, useContext, useEffect, useState } from "react";
import { AppConfig } from "../types/config";
import { invoke } from "@tauri-apps/api/core";

interface ConfigContextType {
    config: AppConfig | null;
    updateConfig: (newConfig: AppConfig) => Promise<void>;
    refreshConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<AppConfig | null>(null);

    const refreshConfig = async () => {
        try {
            const cfg = await invoke<AppConfig>("get_app_config");
            setConfig(cfg);
        } catch (e) {
            console.error("Failed to fetch config:", e);
        }
    };

    const updateConfig = async (newConfig: AppConfig) => {
        try {
            await invoke("update_app_config", { config: newConfig });
            setConfig(newConfig);
        } catch (e) {
            console.error("Failed to update config:", e);
        }
    };

    useEffect(() => {
        refreshConfig();
    }, []);

    useEffect(() => {
        if (config?.ui_theme) {
            // Remove previous themes
            document.documentElement.classList.remove("theme-cyber", "theme-slate", "theme-classic");
            // Add current theme
            document.documentElement.classList.add(`theme-${config.ui_theme}`);
        }
    }, [config?.ui_theme]);

    return (
        <ConfigContext.Provider value={{ config, updateConfig, refreshConfig }}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => {
    const context = useContext(ConfigContext);
    if (!context) {
        throw new Error("useConfig must be used within a ConfigProvider");
    }
    return context;
};
