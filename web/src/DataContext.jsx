import { createContext, useContext, useEffect, useState } from 'react'
import {
  clearHandle,
  loadHandle,
  objectURL,
  permissionState,
  pickDir,
  readBytes,
  requestPermission,
  supportsFsAccess,
} from './local.js'
import { openDb, q } from './db.js'

const Ctx = createContext(null)
export const useData = () => useContext(Ctx)

// phases: 'checking' | 'need-folder' | 'need-permission' | 'loading' | 'ready' | 'error' | 'unsupported'
export function DataProvider({ children }) {
  const [phase, setPhase] = useState('checking')
  const [error, setError] = useState(null)
  const [handle, setHandle] = useState(null)

  async function loadFrom(h) {
    setPhase('loading')
    try {
      const bytes = await readBytes(h, 'manga.db')
      await openDb(bytes)
      setHandle(h)
      setPhase('ready')
    } catch (e) {
      setError(
        e?.name === 'NotFoundError'
          ? "Couldn't find manga.db in that folder — pick your backend/data folder (the one containing manga.db and images/)."
          : String(e?.message || e),
      )
      setPhase('error')
    }
  }

  useEffect(() => {
    if (!supportsFsAccess()) {
      setPhase('unsupported')
      return
    }
    ;(async () => {
      const h = await loadHandle()
      if (!h) {
        setPhase('need-folder')
        return
      }
      const state = await permissionState(h)
      if (state === 'granted') loadFrom(h)
      else setPhase('need-permission') // needs a user gesture to (re)grant
    })()
  }, [])

  async function choose() {
    setError(null)
    try {
      const h = await pickDir()
      await loadFrom(h)
    } catch (e) {
      if (e?.name !== 'AbortError') setError(String(e?.message || e))
    }
  }

  async function grant() {
    setError(null)
    const h = await loadHandle()
    if (h && (await requestPermission(h))) loadFrom(h)
    else setPhase('need-folder')
  }

  async function forget() {
    await clearHandle()
    setHandle(null)
    setPhase('need-folder')
  }

  const resolveImage = (relPath) => (handle && relPath ? objectURL(handle, `images/${relPath}`) : Promise.resolve(null))

  if (phase === 'ready') {
    return <Ctx.Provider value={{ q, resolveImage, forget }}>{children}</Ctx.Provider>
  }

  return <Gate phase={phase} error={error} onChoose={choose} onGrant={grant} onForget={forget} />
}

function Gate({ phase, error, onChoose, onGrant, onForget }) {
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="brand" style={{ fontSize: 22, marginBottom: 6 }}>
          漫画 <span style={{ color: 'var(--accent)' }}>Reader</span>
        </div>
        {phase === 'checking' || phase === 'loading' ? (
          <p className="muted">{phase === 'loading' ? 'Loading your library…' : 'Checking…'}</p>
        ) : phase === 'unsupported' ? (
          <>
            <p>
              This reader needs the File System Access API to read your local library folder, which
              your browser doesn’t support.
            </p>
            <p className="muted">Use Chrome or Edge (desktop) to open your data folder here.</p>
          </>
        ) : phase === 'need-permission' ? (
          <>
            <p>Re-open your saved library folder?</p>
            <button className="primary" onClick={onGrant}>
              Open my library
            </button>
            <button className="ghost" onClick={onForget} style={{ marginLeft: 8 }}>
              Pick a different folder
            </button>
          </>
        ) : (
          <>
            <p>
              Choose your <code>backend/data</code> folder — the one containing{' '}
              <code>manga.db</code> and <code>images/</code>. It stays on your device; nothing is
              uploaded.
            </p>
            <button className="primary" onClick={onChoose}>
              Choose data folder
            </button>
          </>
        )}
        {error && <div className="error">{error}</div>}
        <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
          Read-only. Move your library between machines with <code>scripts/data.sh</code>.
        </p>
      </div>
    </div>
  )
}
