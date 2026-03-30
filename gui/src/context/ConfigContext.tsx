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
            // Remove any existing theme- classes
            const classList = document.documentElement.classList;
            Array.from(classList).forEach(cls => {
                if (cls.startsWith("theme-")) {
                    classList.remove(cls);
                }
            });
            // Add CURRENT theme
            document.documentElement.classList.add(`theme-${config.ui_theme}`);

            // Update App Icons
            const isDark = config.ui_theme === 'dark';
            const iconPath = isDark ? '/Logo_Dark.ico' : '/Logo_Light.ico';
            
            // 1. Update Favicon
            const favicon = document.getElementById('app-favicon') as HTMLLinkElement;
            if (favicon) {
                favicon.href = iconPath;
            }

            // 2. Update Tauri Window Icon (Taskbar) - DELEGATE TO RUST
            invoke("set_theme_icon", { theme: config.ui_theme })
                .catch(e => console.error("Failed to update taskbar icon:", e));
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
