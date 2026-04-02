import { useState } from "react"
import { Play, X, AlertCircle, Hash, Terminal } from 'lucide-react'

interface Props {
    macroName: string
    requiredVars: string[]
    onConfirm: (vars: Record<string, string>) => void
    onCancel: () => void
}

export function VariablePromptModal({ macroName, requiredVars, onConfirm, onCancel }: Props) {
    const [values, setValues] = useState<Record<string, string>>(
        requiredVars.reduce((acc, v) => ({ ...acc, [v]: "" }), {})
    )

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onConfirm(values)
    }

    const handleChange = (varName: string, value: string) => {
        setValues(prev => ({ ...prev, [varName]: value }))
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div 
                className="w-full max-w-md bg-surface border-2 border-secondary/30 rounded-2xl shadow-[0_0_50px_rgba(255,100,0,0.15)] overflow-hidden"
            >
                {/* Header */}
                <div className="bg-secondary/10 border-b border-secondary/20 p-5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-secondary/20 rounded-lg text-secondary">
                            <Terminal size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-100 tracking-tight">Input Required</h2>
                            <p className="text-[10px] text-secondary/60 uppercase font-mono tracking-widest">{macroName}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onCancel}
                        className="btn-brutal p-2 text-text-dim hover:text-text-main opacity-60 hover:opacity-100"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-4 mb-6 flex gap-3">
                        <AlertCircle size={18} className="text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-200/80 leading-relaxed">
                            This macro expects runtime variables. Please provide values for the following keys before execution.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {requiredVars.map((v) => (
                            <div key={v} className="space-y-1.5">
                                <label className="flex items-center gap-2 text-[11px] font-mono text-tertiary uppercase tracking-wider ml-1">
                                    <Hash size={10} /> {v}
                                </label>
                                <div className="relative group">
                                    <input
                                        autoFocus={requiredVars.indexOf(v) === 0}
                                        type="text"
                                        value={values[v]}
                                        onChange={(e) => handleChange(v, e.target.value)}
                                        placeholder={`Enter value for ${v}...`}
                                        className="w-full bg-surface-light border border-surface-lighter focus:border-secondary/50 focus:ring-1 focus:ring-secondary/20 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-gray-600 outline-none transition-all"
                                        required
                                    />
                                    <div className="absolute inset-0 rounded-xl bg-secondary/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="mt-8 flex gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="btn-brutal flex-1 px-4 py-3 text-text-dim text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-brutal btn-secondary flex-[2] px-4 py-3 text-sm flex items-center justify-center gap-2 group"
                        >
                            <Play size={18} />
                            Start Playback
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
