import React, { useState, useEffect } from "react";
import { useConfig } from "../context/ConfigContext";
import { Save, RefreshCw, MousePointer2, MousePointer, Scroll, Keyboard, Move, Zap } from "lucide-react";

export const SettingsPanel: React.FC = () => {
    const { config, updateConfig, refreshConfig } = useConfig();
    const [localConfig, setLocalConfig] = useState(config);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    if (!localConfig) {
        return (
            <div className="flex items-center justify-center h-full text-tertiary animate-pulse">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="animate-spin text-primary" size={32} />
                    <span className="text-xs font-bold uppercase tracking-[0.3em]">Loading Core...</span>
                </div>
            </div>
        );
    }

    const handleSave = async () => {
        setIsSaving(true);
        await updateConfig(localConfig);
        setTimeout(() => setIsSaving(false), 500); // Visual feedback
    };

    const updateNested = (path: string, value: any) => {
        const keys = path.split('.');
        setLocalConfig(prev => {
            if (!prev) return null;
            const next = { ...prev };
            let current: any = next;
            for (let i = 0; i < keys.length - 1; i++) {
                current[keys[i]] = { ...current[keys[i]] };
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
            return next;
        });
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-lighter pb-6 mt-4">
                <h2 className="text-2xl font-bold tracking-tight text-white">
                    Settings
                </h2>
                <div className="flex gap-4">
                    <button 
                        onClick={refreshConfig}
                        title="Reload"
                        className="p-2.5 rounded-lg bg-surface-light border border-surface-lighter text-tertiary hover:text-white hover:border-tertiary transition-all active:scale-95 group"
                    >
                        <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-black font-bold uppercase text-xs tracking-wider hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Playback Settings */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                        <Zap size={16} strokeWidth={2.5} />
                        <h3 className="font-bold uppercase tracking-widest text-[11px]">Playback</h3>
                    </div>
                    
                    <div className="bg-surface border border-surface-lighter p-6 rounded-2xl space-y-6 shadow-xl">
                        <div className="space-y-4">
                            <label className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-tertiary">
                                <span>Playback Speed</span>
                                <span className="text-primary">
                                    {localConfig.playback_defaults.speed.toFixed(1)}x
                                </span>
                            </label>
                            <input 
                                type="range" 
                                min="0.1" 
                                max="5.0" 
                                step="0.1"
                                value={localConfig.playback_defaults.speed}
                                onChange={(e) => updateNested('playback_defaults.speed', parseFloat(e.target.value))}
                                className="w-full accent-primary bg-surface-lighter h-1.5 rounded-full appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-tertiary/60 font-medium">
                                <span>0.1 (Slow)</span>
                                <span>1.0 (Normal)</span>
                                <span>5.0 (Fast)</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Appearance */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-secondary">
                        <MousePointer2 size={16} strokeWidth={2.5} />
                        <h3 className="font-bold uppercase tracking-widest text-[11px]">Appearance</h3>
                    </div>
                    
                    <div className="bg-surface border border-surface-lighter p-6 rounded-2xl space-y-6 shadow-xl">
                        <div className="space-y-3">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-tertiary">Interface Theme</label>
                            <div className="flex gap-2">
                                {['cyber', 'slate', 'classic'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => updateNested('ui_theme', t)}
                                        className={`flex-1 py-2 px-3 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all
                                            ${localConfig.ui_theme === t 
                                                ? 'bg-secondary/10 border-secondary text-secondary shadow-sm' 
                                                : 'bg-surface-light border-surface-lighter text-tertiary hover:border-tertiary opacity-70 hover:opacity-100'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* Recording */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                    <MousePointer size={16} strokeWidth={2.5} />
                    <h3 className="font-bold uppercase tracking-widest text-[11px]">Recording</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-surface border border-surface-lighter p-6 rounded-2xl space-y-6 shadow-xl">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-xs font-bold text-white">Movement Threshold</p>
                                <p className="text-[10px] text-tertiary">Pixels before logging</p>
                            </div>
                            <input 
                                type="number"
                                value={localConfig.recording_defaults.min_move_distance_px}
                                onChange={(e) => updateNested('recording_defaults.min_move_distance_px', parseFloat(e.target.value))}
                                className="w-16 bg-surface-light border border-surface-lighter text-primary font-mono text-center py-2 rounded-lg text-xs focus:border-primary transition-colors"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-xs font-bold text-white">Refresh Rate</p>
                                <p className="text-[10px] text-tertiary">Interval in milliseconds</p>
                            </div>
                            <input 
                                type="number"
                                value={localConfig.recording_defaults.min_move_interval_ms}
                                onChange={(e) => updateNested('recording_defaults.min_move_interval_ms', parseInt(e.target.value))}
                                className="w-16 bg-surface-light border border-surface-lighter text-primary font-mono text-center py-2 rounded-lg text-xs focus:border-primary transition-colors"
                            />
                        </div>
                    </div>

                    <div className="bg-surface border border-surface-lighter p-6 rounded-2xl grid grid-cols-2 gap-3 shadow-xl">
                        {[
                            { id: 'record_mouse_move', label: 'Motion', icon: Move },
                            { id: 'record_clicks', label: 'Clicks', icon: MousePointer },
                            { id: 'record_scroll', label: 'Scroll', icon: Scroll },
                            { id: 'record_keyboard', label: 'Keys', icon: Keyboard },
                        ].map(opt => {
                            const val = (localConfig.recording_defaults as any)[opt.id];
                            const Icon = opt.icon;
                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => updateNested(`recording_defaults.${opt.id}`, !val)}
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all
                                        ${val 
                                            ? 'bg-primary/5 border-primary/40 text-primary shadow-sm' 
                                            : 'bg-surface-light border-surface-lighter text-tertiary opacity-40 hover:opacity-100'}`}
                                >
                                    <Icon size={16} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">{opt.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>
        </div>
    );
};
