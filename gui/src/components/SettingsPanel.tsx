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
            <div className="flex items-center justify-center h-full text-text-dim">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="animate-spin text-primary" size={32} />
                    <span className="text-sm font-bold uppercase tracking-[0.3em]">Loading Core...</span>
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
                <h2 className="text-2xl font-bold tracking-tight text-text-main">
                    Settings
                </h2>
                <div className="flex gap-4">
                    <button 
                        onClick={refreshConfig}
                        title="Reload"
                        className="btn-brutal p-2.5 opacity-60 hover:opacity-100 group"
                    >
                        <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="btn-brutal btn-primary px-6 py-2.5 text-xs"
                    >
                        {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Playback Settings */}
                <section className="space-y-6">
                    <div className="flex items-center gap-4 text-primary border-b-2 border-primary/20 pb-3">
                        <Zap size={24} strokeWidth={3} />
                        <h3 className="font-black uppercase tracking-[0.25em] text-xl">Playback</h3>
                    </div>
                    
                    <div className="bg-surface border border-surface-lighter p-6 rounded-2xl space-y-6 shadow-xl">
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-text-main border-b border-surface-lighter pb-2 block w-full">Speed Controller</label>
                        <div className="space-y-6">
                            <div className="flex justify-between text-sm font-black uppercase tracking-widest text-text-main">
                                <span>Playback Speed</span>
                                <span className="text-primary">
                                    {localConfig.playback_defaults.speed.toFixed(1)}x
                                </span>
                            </div>
                            {(() => {
                                // Non-linear mapping: 0-50 maps to 0.1-1.0, 50-100 maps to 1.0-5.0
                                const val = localConfig.playback_defaults.speed;
                                const percentage = val <= 1.0 
                                    ? ((val - 0.1) / 0.9) * 50 
                                    : 50 + ((val - 1.0) / 4.0) * 50;
                                
                                return (
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        step="1"
                                        value={percentage}
                                        onChange={(e) => {
                                            const p = parseFloat(e.target.value);
                                            const v = p <= 50 
                                                ? 0.1 + (p / 50) * 0.9 
                                                : 1.0 + ((p - 50) / 50) * 4.0;
                                            updateNested('playback_defaults.speed', v);
                                        }}
                                        className="w-full accent-primary bg-surface-lighter h-1.5 rounded-full appearance-none cursor-pointer"
                                    />
                                );
                            })()}
                            <div className="flex justify-between text-[10px] text-text-dim font-medium uppercase tracking-widest">
                                <span>0.1 (Slow)</span>
                                <span className="text-primary font-bold">1.0 (Normal)</span>
                                <span>5.0 (Fast)</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Appearance */}
                <section className="space-y-6">
                    <div className="flex items-center gap-4 text-secondary border-b-2 border-secondary/20 pb-3">
                        <MousePointer2 size={24} strokeWidth={3} />
                        <h3 className="font-black uppercase tracking-[0.25em] text-xl">Theme</h3>
                    </div>
                    
                    <div className="bg-surface border border-surface-lighter p-6 rounded-2xl space-y-6 shadow-xl">
                        <div className="space-y-4">
                            <label className="text-xs font-black uppercase tracking-[0.2em] text-text-main border-b border-surface-lighter pb-2 block w-full">Interface Mode</label>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { id: 'light', label: 'Light' },
                                    { id: 'dark', label: 'Dark' }
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => updateNested('ui_theme', t.id)}
                                        className={`btn-brutal py-3 px-4 text-[12px]
                                            ${localConfig.ui_theme === t.id 
                                                ? 'bg-primary text-white' 
                                                : 'opacity-60 text-text-dim hover:opacity-100 hover:text-text-main hover:border-text-main'}`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* Recording */}
            <section className="space-y-6">
                <div className="flex items-center gap-4 text-primary border-b-2 border-primary/20 pb-3">
                    <MousePointer size={24} strokeWidth={3} />
                    <h3 className="font-black uppercase tracking-[0.25em] text-xl">Recording</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-surface border border-surface-lighter p-6 rounded-2xl space-y-6 shadow-xl">
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-text-main border-b border-surface-lighter pb-2 block w-full">Capture Engine</label>
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-black text-text-main uppercase tracking-wider">Movement Threshold</p>
                                <p className="text-[10px] text-text-dim uppercase tracking-widest">Pixels before logging</p>
                            </div>
                            <input 
                                type="number"
                                value={localConfig.recording_defaults.min_move_distance_px}
                                onChange={(e) => updateNested('recording_defaults.min_move_distance_px', parseFloat(e.target.value))}
                                className="w-16 bg-surface-light border border-surface-lighter text-primary font-mono text-center py-2 rounded-lg text-xs focus:border-primary transition-colors"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-black text-text-main uppercase tracking-wider">Refresh Rate</p>
                                <p className="text-[10px] text-text-dim uppercase tracking-widest">Interval in milliseconds</p>
                            </div>
                            <input 
                                type="number"
                                value={localConfig.recording_defaults.min_move_interval_ms}
                                onChange={(e) => updateNested('recording_defaults.min_move_interval_ms', parseInt(e.target.value))}
                                className="w-16 bg-surface-light border border-surface-lighter text-primary font-mono text-center py-2 rounded-lg text-xs focus:border-primary transition-colors"
                            />
                        </div>
                    </div>

                    <div className="bg-surface border border-surface-lighter p-6 rounded-2xl space-y-6 shadow-xl">
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-text-main border-b border-surface-lighter pb-2 block w-full">Recording Inputs</label>
                        <div className="grid grid-cols-2 gap-3">
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
                                        className={`btn-brutal flex items-center gap-3 p-3 transition-all
                                            ${val 
                                                ? 'bg-primary text-white border-primary-dark shadow-lg' 
                                                : 'opacity-40 text-text-dim hover:opacity-80'}`}
                                    >
                                        <Icon size={16} />
                                        <span className="text-[12px] font-black uppercase tracking-widest">{opt.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
