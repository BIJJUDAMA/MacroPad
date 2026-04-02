import React, { useState } from "react";
import {
    DatabaseZap, Radio, Zap, ShieldAlert, Settings,
    Keyboard, ChevronRight, ChevronsRight,
    Search, Terminal, Cpu, ChevronsDown, Shield, Code, Activity,
    Sparkles, Layers, HelpCircle
} from "lucide-react";

export const HelpPanel: React.FC = () => {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        ecosystem: true,
        engine: false,
        workflow: false,
        strategies: false,
        settings: false,
        hotkeys: false,
        advanced: false,
        faq: false
    });

    const toggle = (section: string) => {
        setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const ChevronBullet = ({ colorClass = "text-primary" }: { colorClass?: string }) => (
        <ChevronRight size={14} className={`${colorClass} shrink-0 mt-0.5`} strokeWidth={3} />
    );

    const SectionHeader = ({ id, icon: Icon, title, colorClass }: { id: string, icon: any, title: string, colorClass: string }) => (
        <button
            onClick={() => toggle(id)}
            className="btn-brutal w-full flex items-center justify-between p-5 bg-surface group mb-1 relative overflow-hidden"
        >
            <div className="flex items-center gap-4 relative z-10">
                <div className={`p-2.5 ${colorClass} bg-opacity-10 rounded-none border-2 border-current transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300`}>
                    <Icon size={22} className={colorClass} strokeWidth={2.5} />
                </div>
                <h3 className="font-black uppercase tracking-[0.2em] text-sm text-text-main group-hover:tracking-[0.25em] transition-all duration-300">{title}</h3>
            </div>
            <div className="flex items-center gap-2 relative z-10">
                <ChevronsRight
                    size={24}
                    className={`${colorClass} transition-all duration-500 ease-in-out ${expanded[id] ? "rotate-90 translate-y-1" : "group-hover:translate-x-2"}`}
                    strokeWidth={3}
                />
            </div>
            {/* Background Accent Animation */}
            <div className="absolute right-20 top-1/2 -translate-y-1/2 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity animate-background-glide pointer-events-none">
                <ChevronsRight size={120} strokeWidth={1} />
            </div>
        </button>
    );

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col gap-2 border-b-4 border-text-main pb-8 mt-4 relative overflow-hidden">
                <div className="absolute -top-4 right-0 flex gap-1 opacity-10 animate-chevron-rail select-none pointer-events-none">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <ChevronsRight key={i} size={48} strokeWidth={1} />)}
                </div>
                <div className="flex items-center gap-3 text-primary">
                    <ChevronsRight size={24} strokeWidth={3} />
                    <span className="text-xs font-black uppercase tracking-[0.3em]">Operational Manual</span>
                </div>
                <h2 className="text-5xl font-black tracking-tighter text-text-main uppercase">
                    System Documentation
                </h2>
                <div className="flex items-center gap-4">
                    <p className="text-text-dim font-medium max-w-2xl">
                        Comprehensive reference for the Macropad automation ecosystem, engine mechanics, and configuration protocols.
                    </p>
                    <div className="hidden md:flex gap-1 text-surface-lighter">
                        <ChevronRight size={16} className="animate-chevron-rail" />
                        <ChevronRight size={16} className="animate-chevron-rail [animation-delay:0.2s]" />
                        <ChevronRight size={16} className="animate-chevron-rail [animation-delay:0.4s]" />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {/* Ecosystem Section */}
                <div className="group/section">
                    <SectionHeader id="ecosystem" icon={DatabaseZap} title="Ecosystem & Assets" colorClass="text-primary" />
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
                                        Low-level binary recordings of pixel-perfect mouse movements, hardware-level keypresses, and system events.
                                    </p>
                                    <ul className="text-xs text-text-main space-y-3">
                                        <li className="flex items-start gap-2">
                                            <ChevronBullet colorClass="text-primary" />
                                            <span><strong>Immutable Backups:</strong> Every save generates a timestamped version.</span>
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
                                        Logic-driven manifests coordinating multiple macros into complex workflows using Variables and Loops.
                                    </p>
                                    <ul className="text-xs text-text-main space-y-3">
                                        <li className="flex items-start gap-2">
                                            <ChevronBullet colorClass="text-secondary" />
                                            <span><strong>Runtime Variables:</strong> Dynamic inputs ($VARS) injected at execution.</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Engine Architecture */}
                <div className="group/section">
                    <SectionHeader id="engine" icon={Zap} title="Engine Architecture" colorClass="text-secondary" />
                    <div className={`grid transition-all duration-300 ease-in-out ${expanded.engine ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                        <div className="overflow-hidden">
                            <div className="p-8 bg-surface border-2 border-t-0 border-surface-lighter grid grid-cols-1 md:grid-cols-3 gap-8 mb-4">
                                <div className="space-y-3">
                                    <h5 className="font-bold text-text-main text-xs uppercase flex items-center gap-2"><Cpu size={14} className="text-secondary" /> The Rust Daemon</h5>
                                    <p className="text-xs text-text-dim leading-relaxed">High-performance core handling real-time event synthesis with sub-millisecond precision.</p>
                                </div>
                                <div className="space-y-3">
                                    <h5 className="font-bold text-text-main text-xs uppercase flex items-center gap-2"><ShieldAlert size={14} className="text-secondary" /> Fail-Safe Protocol</h5>
                                    <p className="text-xs text-text-dim leading-relaxed">Emergency interrupts via <strong>ESC</strong> or <strong>F10</strong> immediately kill all hardware hooks.</p>
                                </div>
                                <div className="space-y-3">
                                    <h5 className="font-bold text-text-main text-xs uppercase flex items-center gap-2"><Search size={14} className="text-secondary" /> IPC Bridge</h5>
                                    <p className="text-xs text-text-dim leading-relaxed">Local socket communication ensuring zero network latency during operation.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Workflow Strategies */}
                <div className="group/section">
                    <SectionHeader id="strategies" icon={Sparkles} title="Tactical Strategies" colorClass="text-primary" />
                    <div className={`grid transition-all duration-300 ease-in-out ${expanded.strategies ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                        <div className="overflow-hidden">
                            <div className="p-8 bg-surface border-2 border-t-0 border-surface-lighter space-y-12 mb-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Layers size={18} className="text-primary" />
                                            <h4 className="text-xs font-black text-text-main uppercase tracking-widest">Macro Chaining</h4>
                                        </div>
                                        <p className="text-[11px] text-text-dim leading-relaxed">Record small <strong>Atomic Actions</strong> (Login, Navigate, Submit) and chain them for faster debugging.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Zap size={18} className="text-primary" />
                                            <h4 className="text-xs font-black text-text-main uppercase tracking-widest">Form Automation</h4>
                                        </div>
                                        <p className="text-[11px] text-text-dim leading-relaxed">Combine <strong>$VARS</strong> with <strong>Tab</strong> keys and set the Loop Count to match your data rows.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Panic Keys & Hotkeys */}
                <div className="group/section">
                    <SectionHeader id="hotkeys" icon={Shield} title="Panic Keys & Hotkeys" colorClass="text-red-500" />
                    <div className={`grid transition-all duration-300 ease-in-out ${expanded.hotkeys ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                        <div className="overflow-hidden">
                            <div className="p-8 bg-surface border-2 border-t-0 border-surface-lighter space-y-8 mb-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="p-5 bg-red-500/5 border-2 border-red-500/20 flex flex-col gap-3 group/panic">
                                        <div className="flex items-center gap-2 text-red-500"><Shield size={18} strokeWidth={3} /><span className="font-black uppercase tracking-widest text-xs">The Panic Protocol</span></div>
                                        <p className="text-[11px] text-text-dim leading-relaxed">If a macro goes rogue, use these keys to immediately kill the engine.</p>
                                        <div className="flex gap-2 mt-2">
                                            <button className="btn-brutal px-3 py-1 bg-red-500 text-white font-black text-[10px] cursor-pointer">ESC</button>
                                            <button className="btn-brutal px-3 py-1 bg-red-500 text-white font-black text-[10px] cursor-pointer">F10</button>
                                        </div>
                                    </div>
                                    <div className="p-5 bg-surface-light border-2 border-surface-lighter flex flex-col gap-3">
                                        <div className="flex items-center gap-2 text-primary"><Keyboard size={18} strokeWidth={3} /><span className="font-black uppercase tracking-widest text-xs">Shortcuts</span></div>
                                        <ul className="space-y-2 text-[11px] text-text-dim">
                                            <li className="flex justify-between"><span>Toggle Global Recording</span><span className="font-bold text-text-main">CTRL + R</span></li>
                                            <li className="flex justify-between"><span>Cycle UI Theme</span><span className="font-bold text-text-main">CTRL + T</span></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Advanced Scripting */}
                <div className="group/section">
                    <SectionHeader id="advanced" icon={Code} title="Advanced Logic Engine" colorClass="text-secondary" />
                    <div className={`grid transition-all duration-300 ease-in-out ${expanded.advanced ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                        <div className="overflow-hidden">
                            <div className="p-8 bg-surface border-2 border-t-0 border-surface-lighter space-y-10 mb-4">
                                <div className="space-y-6">
                                    <div className="border-l-4 border-secondary pl-6 space-y-3">
                                        <h4 className="text-sm font-black text-text-main uppercase tracking-widest">Variable Syntax</h4>
                                        <p className="text-xs text-text-dim leading-relaxed">Dynamic expansion of <strong>$VAR</strong> during execution. Use in `type_text` values.</p>
                                        <code className="block p-4 bg-surface-dark border border-surface-lighter text-secondary text-[11px] font-mono leading-relaxed">
                                            {`{ "type": "type_text", "value": "Login for $USER_ACCOUNT" }`}
                                        </code>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black text-text-main uppercase tracking-tighter border-b border-surface-lighter pb-2 flex items-center gap-2"><Zap size={14} className="text-secondary" /> Commands</h4>
                                            <ul className="space-y-3 text-[11px] text-text-dim">
                                                <li><ChevronBullet colorClass="text-secondary" /> <strong>TypeText:</strong> Optimized text synthesis bypassing physical key delays.</li>
                                                <li><ChevronBullet colorClass="text-secondary" /> <strong>ClipboardPaste:</strong> High-reliability OS-level paste injection.</li>
                                                <li><ChevronBullet colorClass="text-secondary" /> <strong>WaitForWindow:</strong> Conditional pause until title match.</li>
                                            </ul>
                                        </div>
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black text-text-main uppercase tracking-tighter border-b border-surface-lighter pb-2 flex items-center gap-2"><Activity size={14} className="text-secondary" /> Tuning</h4>
                                            <ul className="space-y-3 text-[11px] text-text-dim">
                                                <li><ChevronBullet colorClass="text-secondary" /> <strong>Atomic Playback:</strong> Disables motion interpolation for instant clicks.</li>
                                                <li><ChevronBullet colorClass="text-secondary" /> <strong>Catmull-Rom:</strong> Smooth spline-based mouse pathing.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Settings Reference */}
                <div className="group/section">
                    <SectionHeader id="settings" icon={Settings} title="Engine Tuning" colorClass="text-text-main" />
                    <div className={`grid transition-all duration-300 ease-in-out ${expanded.settings ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                        <div className="overflow-hidden">
                            <div className="p-8 bg-surface border-2 border-t-0 border-surface-lighter space-y-10 mb-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black text-text-main uppercase tracking-widest border-b-2 border-surface-lighter pb-3 flex items-center justify-between">Playback Control<ChevronsDown size={14} className="text-text-dim/30" /></h4>
                                        <p className="text-xs text-text-dim leading-normal pl-5"><ChevronBullet colorClass="text-text-main" /> <strong>Global Speed Scale:</strong> 1.0x is real-time. High speeds may drop inputs on complex apps.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black text-text-main uppercase tracking-widest border-b-2 border-surface-lighter pb-3 flex items-center justify-between">Recording Fidelity<ChevronsDown size={14} className="text-text-dim/30" /></h4>
                                        <p className="text-xs text-text-dim leading-normal pl-5"><ChevronBullet colorClass="text-text-main" /> <strong>Interval:</strong> 10ms for pro-grade capture. 100ms for power saving.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Troubleshooting & FAQ */}
                <div className="group/section">
                    <SectionHeader id="faq" icon={HelpCircle} title="Troubleshooting & FAQ" colorClass="text-secondary" />
                    <div className={`grid transition-all duration-300 ease-in-out ${expanded.faq ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                        <div className="overflow-hidden">
                            <div className="p-8 bg-surface border-2 border-t-0 border-surface-lighter space-y-6 mb-4">
                                <div className="space-y-4">
                                    <div className="p-4 bg-surface-light border-l-4 border-primary group/faq hover:bg-neutral transition-colors">
                                        <p className="text-xs font-black text-text-main uppercase mb-1 flex items-center gap-2">
                                            <HelpCircle size={14} /> Q: Macro timing is drifting or skipping?
                                        </p>
                                        <p className="text-[11px] text-text-dim pl-6">A: Reduce Speed Scale to 1.0x. Some apps cannot process high-frequency hardware inputs.</p>
                                    </div>
                                    <div className="p-4 bg-surface-light border-l-4 border-secondary group/faq hover:bg-neutral transition-colors">
                                        <p className="text-xs font-black text-text-main uppercase mb-1 flex items-center gap-2">
                                            <HelpCircle size={14} /> Q: Coordinates are offset on 4K/DPI monitors?
                                        </p>
                                        <p className="text-[11px] text-text-dim pl-6">A: Enable "Scale to Current" in Defaults. High-DPI scaling requires consistent OS scaling settings.</p>
                                    </div>
                                    <div className="p-4 bg-surface-light border-l-4 border-red-500 group/faq hover:bg-neutral transition-colors">
                                        <p className="text-xs font-black text-text-main uppercase mb-1 flex items-center gap-2">
                                            <HelpCircle size={14} /> Q: "Daemon Hook Error" on startup?
                                        </p>
                                        <p className="text-[11px] text-text-dim pl-6">A: Ensure Macropad has Accessibility/Universal Access permissions in System Settings.</p>
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
