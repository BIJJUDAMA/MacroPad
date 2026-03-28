import { useState, useRef } from 'react'
import { LibraryBrowser } from './components/LibraryBrowser'
import { ScriptEditor } from './components/ScriptEditor'
import { SettingsPanel } from './components/SettingsPanel'
import { Database, Code2, Terminal, Settings } from 'lucide-react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

export type Tab = 'library' | 'script' | 'terminal' | 'settings'

export interface MacroLibraryState {
  paths: string[]
  setPaths: (paths: string[]) => void
}

function App() {
  const [tab, setTab] = useState<Tab>('library')
  const [paths, setPaths] = useState<string[]>([])
  const contentRef = useRef<HTMLDivElement>(null)

  // Subtle page transition animation when changing tabs
  useGSAP(() => {
    if (contentRef.current) {
      gsap.fromTo(contentRef.current,
        { autoAlpha: 0, y: 5 },
        { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }
      )
    }
  }, [tab])

  const navItems = [
    { id: 'library', icon: Database, label: 'Library' },
    { id: 'script', icon: Code2, label: 'Editor' },
    { id: 'terminal', icon: Terminal, label: 'Console' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ] as const

  return (
    <div className="flex h-screen bg-neutral text-gray-300 font-sans overflow-hidden select-none">

      {/* Sidebar Navigation */}
      <nav className="w-52 bg-surface border-r border-surface-lighter flex flex-col items-start py-6 px-4 gap-2 relative z-10 shadow-2xl">
        <div className="flex items-center gap-3 text-primary mb-10 px-2">
          <Terminal size={28} strokeWidth={2.5} />
          <span className="font-bold tracking-tighter text-xl">MACRONITS</span>
        </div>

        <div className="w-full space-y-2">
          {navItems.map(item => {
            const isActive = tab === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 relative group
                  ${isActive
                    ? 'bg-primary/10 text-primary shadow-[inset_0_0_20px_rgba(255,95,31,0.05)] border border-primary/20'
                    : 'text-tertiary hover:text-gray-200 hover:bg-surface-light border border-transparent'}
                `}
              >
                <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </div>

                <span className={`text-sm font-bold uppercase tracking-widest transition-colors ${isActive ? 'text-primary' : 'text-tertiary'}`}>
                  {item.label}
                </span>

                {/* Active Indicator Line */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-md shadow-[0_0_12px_var(--color-primary)]"></span>
                )}
              </button>
            )
          })}
        </div>

        {/* Bottom Profile/Settings dummy for aesthetic weight */}
        <div className="mt-auto w-full pt-6 border-t border-surface-lighter/50 opacity-40 hover:opacity-100 transition-opacity">
          <button className="flex items-center gap-4 px-4 py-3 text-tertiary">
            <Settings size={20} />
            <span className="text-sm font-bold uppercase tracking-widest">SYSTEM</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main ref={contentRef} className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-neutral relative">
        <header className="h-12 border-b border-surface-lighter flex items-center px-6 bg-neutral/80 backdrop-blur-md sticky top-0 z-10">
          <h1 className="text-sm font-bold tracking-widest text-gray-400 uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary/80"></span>
            Macronits Operations
          </h1>
        </header>

        <div className="flex-1 overflow-x-hidden overflow-y-auto">
          {tab === 'library' && (
            <LibraryBrowser paths={paths} setPaths={setPaths} />
          )}
          {tab === 'script' && (
            <ScriptEditor libraryPaths={paths} />
          )}
          {tab === 'terminal' && (
            <div className="flex items-center justify-center h-full text-tertiary text-sm tracking-widest font-bold uppercase py-20 flex-col gap-4">
              <span className="w-12 h-1 bg-surface-lighter rounded-full"></span>
              Console module standby
            </div>
          )}
          {tab === 'settings' && (
            <SettingsPanel />
          )}
        </div>
      </main>
    </div>
  )
}

export default App