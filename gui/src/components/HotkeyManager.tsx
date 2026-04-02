import { useState, useEffect } from 'react'
import { tauriInvoke } from '../lib/tauri'
import { Zap, Trash2, Keyboard, Play, FileCode, AlertCircle, FolderOpen } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { Tooltip } from './Tooltip'

interface HotkeyBinding {
  hotkey: string
  path: string
}

export function HotkeyManager() {
  const [bindings, setBindings] = useState<HotkeyBinding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newBinding, setNewBinding] = useState({ hotkey: '', path: '' })

  useEffect(() => {
    fetchBindings()
  }, [])

  const fetchBindings = async () => {
    try {
      const data: Record<string, string> = await tauriInvoke('get_hotkeys')
      const formatted = Object.entries(data).map(([hotkey, path]) => ({ hotkey, path }))
      setBindings(formatted)
      setError(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleAddBinding = async () => {
    if (!newBinding.hotkey || !newBinding.path) return
    try {
      await tauriInvoke('set_hotkey', { 
        macroPath: newBinding.path, 
        hotkeyStr: newBinding.hotkey 
      })
      setNewBinding({ hotkey: '', path: '' })
      fetchBindings()
    } catch (err) {
      setError(String(err))
    }
  }

  const removeBinding = async (_hotkey: string) => {
    // Currently set_hotkey doesn't have a clear "remove" in my previous IPC draft 
    // but I can send an empty path if I update the backend or just assume it overwrites.
    // For now, I'll just refresh list.
    setError("Delete functionality pending backend implementation update")
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-secondary/10 text-secondary rounded-2xl shadow-[0_0_15px_rgba(255,100,0,0.1)]">
            <Zap size={28} strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tighter">Hotkey Console</h2>
        </div>
        <p className="text-text-dim max-w-2xl font-medium tracking-tight">
          Bind high-frequency MacroScripts and Recordings to global shortcuts. 
          These triggers operate in the background even when this console is minimized.
        </p>
      </header>

      {/* Manual Add Trigger */}
      <section className="bg-surface-light border-2 border-surface-lighter p-6 rounded-3xl shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 -rotate-12 translate-x-10 -translate-y-10 group-hover:bg-secondary/10 transition-colors" />
        
        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-end">
          <div className="flex-1 space-y-2 w-full">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary px-1">Macro Resource Path</label>
               <div className="flex items-center gap-2">
                 <div className="relative flex-1">
                   <FileCode className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim" size={18} />
                   <input 
                    type="text" 
                    placeholder="C:\Path\To\MyAutomation.mps"
                    value={newBinding.path}
                    onChange={e => setNewBinding(prev => ({ ...prev, path: e.target.value }))}
                    className="w-full bg-surface border border-surface-lighter rounded-2xl py-4 pl-12 pr-6 text-sm font-bold placeholder:text-text-dim/30 focus:outline-none focus:ring-4 focus:ring-secondary/10 focus:border-secondary transition-all"
                   />
                 </div>
                 <Tooltip name="Browse" description="Select a macro file from disk" position="top">
                   <button
                    onClick={async () => {
                      const selected = await open({
                        multiple: false,
                        filters: [{ name: 'Macropad', extensions: ['mpr', 'mps'] }]
                      });
                      if (selected && typeof selected === 'string') {
                        setNewBinding(prev => ({ ...prev, path: selected }));
                      }
                    }}
                    className="btn-brutal p-4 bg-surface text-text-dim hover:text-secondary transition-all"
                   >
                     <FolderOpen size={20} />
                   </button>
                 </Tooltip>
               </div>
          </div>

          <div className="w-full md:w-64 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary px-1">Global Trigger</label>
            <div className="relative">
               <Keyboard className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim" size={18} />
               <input 
                type="text" 
                placeholder="Ctrl+Alt+S"
                value={newBinding.hotkey}
                onChange={e => setNewBinding(prev => ({ ...prev, hotkey: e.target.value }))}
                className="w-full bg-surface border border-surface-lighter rounded-2xl py-4 pl-12 pr-6 text-sm font-bold uppercase tracking-widest placeholder:text-text-dim/30 focus:outline-none focus:ring-4 focus:ring-secondary/10 focus:border-secondary transition-all"
               />
            </div>
          </div>

          <button 
            onClick={handleAddBinding}
            disabled={!newBinding.hotkey || !newBinding.path}
            className="btn-brutal btn-secondary h-[58px] px-8 text-xs disabled:opacity-30 disabled:grayscale"
          >
            Deploy Link
          </button>
        </div>
      </section>

      {/* Error display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-center gap-4 text-xs font-bold uppercase tracking-widest">
            <AlertCircle size={18} />
            {error}
        </div>
      )}

      {/* Active Bindings List */}
      <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-text-dim px-2 mb-6">In-Field Operations</h3>
          
          {loading ? (
            <div className="py-20 flex justify-center opacity-30">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : bindings.length === 0 ? (
            <div className="py-20 border-2 border-dashed border-surface-lighter rounded-3xl flex flex-col items-center justify-center text-text-dim/40 gap-4">
                <Zap size={48} strokeWidth={1} />
                <span className="text-xs font-bold uppercase tracking-widest">No active trigger links found</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {bindings.map((b, i) => (
                <div key={i} className="bg-surface border border-surface-lighter p-5 rounded-2xl flex items-center gap-6 hover:border-secondary/50 transition-colors group">
                    <div className="w-12 h-12 bg-surface-light rounded-xl flex items-center justify-center text-secondary shadow-lg group-hover:bg-secondary group-hover:text-neutral-900 transition-all">
                        <Keyboard size={20} strokeWidth={2.5} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-black uppercase tracking-widest text-secondary">{b.hotkey}</div>
                        <div className="text-[10px] text-text-dim font-bold truncate mt-1">{b.path}</div>
                    </div>

                    <div className="flex items-center gap-2 border-l border-surface-lighter pl-6">
                         <button className="btn-brutal btn-primary p-3">
                            <Play size={18} />
                         </button>
                         <button 
                            onClick={() => removeBinding(b.hotkey)}
                            className="btn-brutal p-3 text-text-dim hover:text-red-400 hover:bg-red-500/5 opacity-60 hover:opacity-100"
                         >
                            <Trash2 size={18} />
                         </button>
                    </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Real status footer could go here in the future if needed */}
    </div>
  )
}
