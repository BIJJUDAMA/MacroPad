import { useState } from 'react'
import { LibraryBrowser } from './components/LibraryBrowser'
import { ScriptEditor } from './components/ScriptEditor'
import { SettingsPanel } from './components/SettingsPanel'
import { HelpPanel } from './components/HelpPanel'
import { HotkeyManager } from './components/HotkeyManager'
import { SchedulerPanel } from './components/SchedulerPanel'
import { ScriptLogPanel } from './components/ScriptLogPanel'
import { LogProvider, useLogs } from './context/LogContext'
import { Database, Code2, Terminal, Settings, HelpCircle, Zap, Clock } from 'lucide-react'

export type Tab = 'library' | 'script' | 'hotkeys' | 'scheduler' | 'terminal' | 'settings' | 'help'

export interface MacroLibraryState {
  paths: string[]
  setPaths: (paths: string[]) => void
}

function App() {
  return (
    <LogProvider>
      <AppContent />
    </LogProvider>
  )
}

function AppContent() {
  const [tab, setTab] = useState<Tab>('library')
  const [paths, setPaths] = useState<string[]>([])
  const { logLines, isExecuting } = useLogs()

  const navItems = [
    { id: 'library', icon: Database, label: 'Library' },
    { id: 'script', icon: Code2, label: 'Editor' },
    { id: 'hotkeys', icon: Zap, label: 'Hotkeys' },
    { id: 'scheduler', icon: Clock, label: 'Schedules' },
    { id: 'terminal', icon: Terminal, label: 'Console' },
    { id: 'settings', icon: Settings, label: 'Settings' },
    { id: 'help', icon: HelpCircle, label: 'Help' },
  ] as const

  return (
    <div className="flex h-screen bg-neutral text-text-main font-sans overflow-hidden select-none">

      {/* Sidebar Navigation */}
      <nav className="w-52 bg-surface border-r border-surface-lighter flex flex-col items-start py-6 px-4 gap-2 relative z-10 shadow-2xl">
        <div className="flex items-center gap-3 text-primary mb-10 px-2">
          <Terminal size={28} strokeWidth={2.5} />
          <span className="font-bold tracking-tighter text-xl uppercase">MACROPAD</span>
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
                    ? 'bg-primary/10 text-primary shadow-[inset_0_0_20px_var(--color-primary-dim)] border border-primary/20'
                    : 'text-text-dim hover:text-text-main hover:bg-surface-light border border-transparent'}
                `}
              >
                <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </div>

                <span className={`text-sm font-bold uppercase tracking-widest transition-colors ${isActive ? 'text-primary' : 'text-text-dim'}`}>
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

        {/* Space filler where System button was */}
        <div className="mt-auto w-full pt-6"></div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-surface relative">
        <header className="h-12 border-b border-surface-lighter flex items-center px-6 bg-surface/80 backdrop-blur-md sticky top-0 z-10">
          <h1 className="text-sm font-bold tracking-widest text-text-dim uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary/80"></span>
            Macropad Operations
          </h1>
        </header>

        <div className="flex-1 overflow-x-hidden overflow-y-auto">
          {tab === 'library' && (
            <LibraryBrowser paths={paths} setPaths={setPaths} />
          )}
          {tab === 'script' && (
            <ScriptEditor libraryPaths={paths} />
          )}
          {tab === 'hotkeys' && (
            <HotkeyManager />
          )}
          {tab === 'scheduler' && (
            <SchedulerPanel />
          )}
          {tab === 'terminal' && (
            <ScriptLogPanel lines={logLines} running={isExecuting} />
          )}
          {tab === 'settings' && (
            <SettingsPanel />
          )}
          {tab === 'help' && (
            <HelpPanel />
          )}
        </div>
      </main>
    </div>
  )
}

export default App