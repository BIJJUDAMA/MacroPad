import React, { useState } from "react";
import { 
    DatabaseZap, Radio, Code2, Zap, ShieldAlert, Settings, 
    Move, MousePointer, Scroll, Keyboard, ChevronRight,
    Search, Info, Terminal, Cpu
} from "lucide-react";

export const HelpPanel: React.FC = () => {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        ecosystem: true,
        engine: false,
        workflow: false,
        settings: false
    });

    const toggle = (section: string) => {
        setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const SectionHeader = ({ id, icon: Icon, title, colorClass }: { id: string, icon: any, title: string, colorClass: string }) => (
        <button 
            onClick={() => toggle(id)}
            className={`w-full flex items-center justify-between p-4 bg-surface border-2 border-surface-lighter hover:border-text-main transition-all group active:translate-y-0.5 shadow-[4px_4px_0px_var(--color-surface-lighter)] hover:shadow-[2px_2px_0px_var(--text-main-shadow)] mb-1`}
        >
            <div className="flex items-center gap-4">
                <div className={`p-2 ${colorClass} bg-opacity-10 rounded-none border border-current`}>
                    <Icon size={20} className={colorClass} strokeWidth={2.5} />
                </div>
                <h3 className="font-bold uppercase tracking-[0.2em] text-sm text-text-main">{title}</h3>
            </div>
            <ChevronRight 
                size={20} 
                className="text-text-dim transition-transform duration-300 ease-in-out" 
                style={{ transform: expanded[id] ? "rotate(90deg)" : "rotate(0deg)" }}
            />
        </button>
    );

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col gap-2 border-b-4 border-text-main pb-8 mt-4">
                <div className="flex items-center gap-3 text-primary">
                    <Info size={24} strokeWidth={3} />
                    <span className="text-xs font-black uppercase tracking-[0.3em]">Operational Manual</span>
                </div>
                <h2 className="text-5xl font-black tracking-tighter text-text-main uppercase">
                    System Documentation
                </h2>
                <p className="text-text-dim font-medium max-w-2xl">
                    Comprehensive reference for the Macropad automation ecosystem, engine mechanics, and configuration protocols.
                </p>
            </div>

            <div className="space-y-4">
                {/* Ecosystem Section */}
                <div className="group/section">
                    <SectionHeader 
                        id="ecosystem" 
                        icon={DatabaseZap} 
                        title="Ecosystem & Assets" 
                        colorClass="text-primary" 
                    />
                    <div className={`grid transition-all duration-300 ease-in-out ${expanded.ecosystem ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                        <div className="overflow-hidden">
                            <div className="p-8 bg-surface border-2 border-t-0 border-surface-lighter grid grid-cols-1 md:grid-cols-2 gap-8 mb-4">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-primary/20 flex items-center justify-center border-2 border-primary">
                                            <Radio size={20} className="text-primary" />
                                        </div>
                                        <h4 className="font-bold text-text-main uppercase tracking-widest text-xs">MacroRecordings (.mpr)</h4>
                                    </div>
                                    <p className="text-sm text-text-dim leading-relaxed">
                                        Low-level binary recordings of pixel-perfect mouse movements, hardware-level keypresses, and system events. These are the building blocks of your automation.
                                    </p>
                                    <ul className="text-xs text-text-main space-y-2 font-mono">
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-primary"></div>
                                            Immutable Backups: Every save generates a timestamped version.
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-primary"></div>
                                            Portable: Can be shared and run on any system with MacOS/Windows.
                                        </li>
                                    </ul>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-secondary/20 flex items-center justify-center border-2 border-secondary">
                                            <Terminal size={20} className="text-secondary" />
                                        </div>
                                        <h4 className="font-bold text-text-main uppercase tracking-widest text-xs">MacroScripts (.mps)</h4>
                                    </div>
                                    <p className="text-sm text-text-dim leading-relaxed">
                                        Logic-driven automation manifests. Scripts coordinate multiple macros into complex workflows using Variables, Loops, and Conditional branching.
                                    </p>
                                    <ul className="text-xs text-text-main space-y-2 font-mono">
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-secondary"></div>
                                            Runtime Variables: Dynamic inputs (e.g., passwords, URLs) at execution.
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-secondary"></div>
                                            Composition: Chain 50+ macros into a single operational unit.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Core Engine Section */}
                <div className="group/section">
                    <SectionHeader 
                        id="engine" 
                        icon={Zap} 
                        title="Engine Architecture" 
                        colorClass="text-secondary" 
                    />
                    <div className={`grid transition-all duration-300 ease-in-out ${expanded.engine ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                        <div className="overflow-hidden">
                            <div className="p-8 bg-surface border-2 border-t-0 border-surface-lighter space-y-8 mb-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-3">
                                        <h5 className="font-bold text-text-main text-xs uppercase flex items-center gap-2">
                                            <Cpu size={14} className="text-secondary" /> The Rust Daemon
                                        </h5>
                                        <p className="text-xs text-text-dim leading-relaxed">
                                            The high-performance core (macropad-daemon) handles real-time event synthesis. It runs with elevated priority to ensure sub-millisecond input precision.
                                        </p>
                                    </div>
                                    <div className="space-y-3">
                                        <h5 className="font-bold text-text-main text-xs uppercase flex items-center gap-2">
                                            <ShieldAlert size={14} className="text-secondary" /> Fail-Safe Protocol
                                        </h5>
                                        <p className="text-xs text-text-dim leading-relaxed">
                                            Global hardware interrupts are monitored. Pressing <strong>ESC</strong> or <strong>F10</strong> immediately detaches the daemon from system hooks to prevent runaway scripts.
                                        </p>
                                    </div>
                                    <div className="space-y-3">
                                        <h5 className="font-bold text-text-main text-xs uppercase flex items-center gap-2">
                                            <Search size={14} className="text-secondary" /> IPC Bridge
                                        </h5>
                                        <p className="text-xs text-text-dim leading-relaxed">
                                            Communications between this UI and the engine happen over local unix sockets or named pipes. This ensures zero network latency during operation.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Workflow Section */}
                <div className="group/section">
                    <SectionHeader 
                        id="workflow" 
                        icon={Code2} 
                        title="Workflow Optimization" 
                        colorClass="text-tertiary" 
                    />
                    <div className={`grid transition-all duration-300 ease-in-out ${expanded.workflow ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                        <div className="overflow-hidden">
                            <div className="p-8 bg-surface border-2 border-t-0 border-surface-lighter space-y-6 mb-4">
                                <div className="bg-neutral p-6 border-l-4 border-primary">
                                    <h5 className="font-bold text-text-main uppercase text-xs mb-3">Professional Strategy: "Atomic Macros"</h5>
                                    <p className="text-sm text-text-dim leading-relaxed italic">
                                        "Instead of recording one 10-minute session, record small atomic actions (Login, Navigate, Submit) and chain them in the Script Editor. This makes debugging 10x faster."
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-4 border border-surface-lighter rounded-none flex gap-4">
                                        <div className="text-2xl font-black text-primary/30 shrink-0">01</div>
                                        <p className="text-xs text-text-main font-medium">Use <strong>Dry Run</strong> to check your logic flows before letting the mouse move. Saves hours of screen-resetting.</p>
                                    </div>
                                    <div className="p-4 border border-surface-lighter rounded-none flex gap-4">
                                        <div className="text-2xl font-black text-primary/30 shrink-0">02</div>
                                        <p className="text-xs text-text-main font-medium">Record keyboard-only macros by disabling <strong>Motion</strong> in Settings. This keeps files incredibly lightweight.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Settings Section */}
                <div className="group/section">
                    <SectionHeader 
                        id="settings" 
                        icon={Settings} 
                        title="Settings Reference" 
                        colorClass="text-secondary" 
                    />
                    <div className={`grid transition-all duration-300 ease-in-out ${expanded.settings ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                        <div className="overflow-hidden">
                            <div className="p-8 bg-surface border-2 border-t-0 border-surface-lighter space-y-10 mb-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-text-main uppercase tracking-wider border-b-2 border-surface-lighter pb-3">Playback Control</h4>
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <p className="text-xs font-bold text-text-main uppercase">Global Speed Scale</p>
                                                <p className="text-xs text-text-dim leading-relaxed">
                                                    Uniformly speeds up input events. <strong>1.0x</strong> is real-time. <strong>2.0x</strong> is twice as fast.
                                                    <br/><span className="text-[10px] text-red-400 font-bold uppercase mt-1 inline-block">Warning: Complex apps may drop inputs at &gt;3.0x speed.</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-text-main uppercase tracking-wider border-b-2 border-surface-lighter pb-3">Recording Fidelity</h4>
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <p className="text-xs font-bold text-text-main uppercase flex items-center gap-2"><Move size={14}/> Space Threshold</p>
                                                <p className="text-xs text-text-dim leading-relaxed">
                                                    Minimum movement in pixels required to log a new coordinate. Set to <strong>5px</strong> for smooth paths, <strong>20px+</strong> for efficiency.
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-xs font-bold text-text-main uppercase flex items-center gap-2"><Zap size={14}/> Polling Interval</p>
                                                <p className="text-xs text-text-dim leading-relaxed">
                                                    Frequency (ms) of OS hook checks. <strong>10ms</strong> is professional grade. <strong>100ms</strong> is power-saving mode.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-surface-lighter">
                                    <h4 className="text-xs font-bold text-text-main uppercase tracking-wider mb-6">Input Filter Toggles</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                        <div className="p-4 bg-neutral border-2 border-surface-lighter space-y-2">
                                            <div className="flex items-center gap-2 text-primary font-bold">
                                                <Move size={14} /> <span className="text-[11px] uppercase tracking-tighter">Path Motion</span>
                                            </div>
                                            <p className="text-[10px] text-text-dim">Captures fluid x/y cursor navigation across screens.</p>
                                        </div>
                                        <div className="p-4 bg-neutral border-2 border-surface-lighter space-y-2">
                                            <div className="flex items-center gap-2 text-secondary font-bold">
                                                <MousePointer size={14} /> <span className="text-[11px] uppercase tracking-tighter">Surface Clicks</span>
                                            </div>
                                            <p className="text-[10px] text-text-dim">Logs Left, Right, and Middle button activation events.</p>
                                        </div>
                                        <div className="p-4 bg-neutral border-2 border-surface-lighter space-y-2">
                                            <div className="flex items-center gap-2 text-primary font-bold">
                                                <Scroll size={14} /> <span className="text-[11px] uppercase tracking-tighter">Wheel Scroll</span>
                                            </div>
                                            <p className="text-[10px] text-text-dim">Captures vertical and horizontal scrolling ticks.</p>
                                        </div>
                                        <div className="p-4 bg-neutral border-2 border-surface-lighter space-y-2">
                                            <div className="flex items-center gap-2 text-secondary font-bold">
                                                <Keyboard size={14} /> <span className="text-[11px] uppercase tracking-tighter">Key Signatures</span>
                                            </div>
                                            <p className="text-[10px] text-text-dim">Logs all key-down/up signatures and modifier states.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

