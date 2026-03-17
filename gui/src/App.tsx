import { useState } from 'react'
import { LibraryBrowser } from './components/LibraryBrowser'
import { ScriptEditor } from './components/ScriptEditor'

type Tab = 'library' | 'script'

export interface MacroLibraryState {
  paths: string[]
  setPaths: (paths: string[]) => void
}

function App() {
  const [tab, setTab] = useState<Tab>('library')
  const [paths, setPaths] = useState<string[]>([])

  return (
    <div style={{ fontFamily: 'monospace', background: '#181825', minHeight: '100vh' }}>
      <div style={{
        display: 'flex',
        gap: 2,
        padding: '8px 16px',
        borderBottom: '1px solid #313244',
        background: '#13131e',
      }}>
        {(['library', 'script'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? '#313244' : 'transparent',
              color: tab === t ? '#cdd6f4' : '#6c7086',
              border: 'none',
              borderRadius: 6,
              padding: '6px 16px',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'library' && (
        <LibraryBrowser paths={paths} setPaths={setPaths} />
      )}
      {tab === 'script' && (
        <ScriptEditor libraryPaths={paths} />
      )}
    </div>
  )
}

export default App