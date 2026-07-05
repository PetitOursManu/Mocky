import { useEffect, useState } from 'react'
import { api, type AuthUser } from '../lib/api'
import { enableSync, reconcileOnLogin } from '../lib/sync'

export default function AuthModal({
  onClose,
  onSignedIn,
}: {
  onClose: () => void
  onSignedIn: (user: AuthUser) => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cfg, setCfg] = useState<{ allowRegistration: boolean; setup: boolean } | null>(null)

  useEffect(() => {
    api
      .config()
      .then((c) => {
        setCfg(c)
        if (c.setup) setMode('register')
      })
      .catch(() => setCfg({ allowRegistration: true, setup: false }))
  }, [])

  const canRegister = cfg ? cfg.allowRegistration || cfg.setup : true

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user = mode === 'login' ? await api.login(username, password) : await api.register(username, password)
      enableSync(true)
      const changed = await reconcileOnLogin()
      onSignedIn(user)
      onClose()
      if (changed) window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-slate-100">
          {cfg?.setup ? 'Create the admin account' : mode === 'login' ? 'Sign in' : 'Create an account'}
        </h2>
        <p className="mb-4 mt-1 text-xs text-slate-400">
          {cfg?.setup
            ? 'This is the first account on this instance — it becomes the admin.'
            : 'Sync your projects & DESIGN.md to this Mocky instance and access them from any device.'}
        </p>

        <label className="mb-1.5 block text-sm font-medium text-slate-300">Username</label>
        <input
          className="input mb-3"
          autoFocus
          autoComplete="username"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <label className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
        <input
          className="input"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div className="mt-3 rounded-lg border border-rose-700/50 bg-rose-900/30 p-2 text-xs text-rose-200">{error}</div>}

        <button type="submit" className="btn-primary mt-4 w-full" disabled={busy || !username.trim() || !password}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        {!cfg?.setup &&
          (canRegister ? (
            <button
              type="button"
              className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-200"
              onClick={() => {
                setMode((m) => (m === 'login' ? 'register' : 'login'))
                setError(null)
              }}
            >
              {mode === 'login' ? 'No account yet? Create one' : 'Already have an account? Sign in'}
            </button>
          ) : (
            mode === 'login' && (
              <p className="mt-3 text-center text-xs text-slate-500">
                Public sign-ups are disabled — ask an admin to create your account.
              </p>
            )
          ))}

        <p className="mt-4 text-center text-[11px] text-slate-500">
          Your provider API key stays in this browser and is never sent to the server.
        </p>
      </form>
    </div>
  )
}
