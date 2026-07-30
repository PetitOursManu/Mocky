import { useEffect, useState } from 'react'
import { api, type AuthUser } from '../lib/api'
import { startDashySso } from '../lib/sso'
import { Icon } from '../ui'

export default function AuthModal({
  onClose,
  onSignedIn,
  initialError,
  dismissible = true,
}: {
  onClose: () => void
  onSignedIn: (user: AuthUser) => void
  initialError?: string | null
  /**
   * False until there is a session: Mocky needs an account, so the modal cannot
   * be dismissed. The overlay used to swallow the click silently instead, which
   * reads as a broken dialog rather than a requirement.
   */
  dismissible?: boolean
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [cfg, setCfg] = useState<{
    allowRegistration: boolean
    setup: boolean
    sso: { enabled: boolean; dashyUrl: string | null }
  } | null>(null)

  // Set when /api/config cannot be reached at all — i.e. the backend is not
  // running. That is the single most common first-run failure: `npm run dev`
  // starts only Vite, the API calls 500, and the sign-in box (which cannot be
  // dismissed) answers every attempt with "HTTP 500" and no hint at the cause.
  const [backendDown, setBackendDown] = useState(false)

  useEffect(() => {
    api
      .config()
      .then((c) => {
        setCfg(c)
        setBackendDown(false)
        if (c.setup) setMode('register')
      })
      .catch(() => {
        setBackendDown(true)
        setCfg({ allowRegistration: true, setup: false, sso: { enabled: false, dashyUrl: null } })
      })
  }, [])

  const canRegister = cfg ? cfg.allowRegistration || cfg.setup : true
  const ssoEnabled = cfg?.sso.enabled && cfg?.sso.dashyUrl

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user = mode === 'login' ? await api.login(username, password) : await api.register(username, password)
      // Authenticate, then hand over. Reconciliation belongs to App.onSignedIn —
      // doing it here as well fired two concurrent GET /api/data and two racing
      // reload paths for a single sign-in.
      onSignedIn(user)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/60 p-4"
      // No handler at all when an account is required — a click that is quietly
      // ignored looks like a bug. The explanatory line below says why instead.
      onClick={dismissible ? onClose : undefined}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm border border-line bg-raised p-6 shadow-2xl"
      >
        <header className="rule-double pb-3">
          <p className="kicker text-accent-ink">Mocky&nbsp;· Chat&nbsp;→&nbsp;UI</p>
          <h2 className="masthead mt-1.5 text-h2">
            {cfg?.setup ? 'Create the admin account' : mode === 'login' ? 'Sign in' : 'Create an account'}
          </h2>
        </header>
        <p className="measure mb-4 mt-3 text-body-sm text-ink-muted">
          {cfg?.setup
            ? 'This is the first account on this instance — it becomes the admin. Keep the credentials: only an admin can create other accounts or configure the instance model.'
            : dismissible
              ? 'Sync your projects & DESIGN.md to this Mocky instance and access them from any device.'
              : 'Mocky needs an account — your projects and DESIGN.md are stored against it.'}
        </p>

        {backendDown && (
          <div className="mb-4 border border-warn/40 bg-warn/10 p-3 text-body-sm text-warn">
            <p className="flex items-center gap-1.5 font-medium">
              <Icon name="warning" size={16} />
              Mocky’s backend is not answering.
            </p>
            <p className="mt-1 text-warn/80">
              An account is required, and accounts live on the backend. If you started Mocky with{' '}
              <code className="bg-ink/10 px-1">npm run dev</code>, that runs the web server
              only — stop it and use:
            </p>
            <pre className="mt-2 overflow-x-auto bg-ink/10 p-2 text-caption text-warn">
              npm run dev:all
            </pre>
            <p className="mt-2 text-warn/80">
              With Docker, check <code className="bg-ink/10 px-1">docker compose logs -f</code>.
            </p>
          </div>
        )}

        {ssoEnabled && !cfg?.setup && (
          <>
            <button
              type="button"
              className="btn-primary mt-1 w-full"
              onClick={() => startDashySso(cfg!.sso.dashyUrl!)}
              disabled={busy}
            >
              Sign in with Dashy
            </button>
            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-line-soft" />
              <span className="kicker">or</span>
              <span className="h-px flex-1 bg-line-soft" />
            </div>
          </>
        )}

        <label className="mb-1.5 block text-body-sm font-medium text-ink">Username</label>
        <input
          className="input mb-3"
          autoFocus
          autoComplete="username"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <label className="mb-1.5 block text-body-sm font-medium text-ink">Password</label>
        <input
          className="input"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <div className="mt-3 border border-danger/50 bg-danger/15 p-2 text-body-sm text-danger">
            {ssoErrorMessage(error)}
          </div>
        )}

        <button type="submit" className="btn-primary mt-4 w-full" disabled={busy || !username.trim() || !password}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        {!cfg?.setup &&
          (canRegister ? (
            <button
              type="button"
              className="mt-3 w-full text-center text-body-sm text-accent-ink underline underline-offset-2 transition hover:opacity-80"
              onClick={() => {
                setMode((m) => (m === 'login' ? 'register' : 'login'))
                setError(null)
              }}
            >
              {mode === 'login' ? 'No account yet? Create one' : 'Already have an account? Sign in'}
            </button>
          ) : (
            mode === 'login' && (
              <p className="mt-3 text-center text-body-sm text-ink-faint">
                Public sign-ups are disabled — ask an admin to create your account.
              </p>
            )
          ))}

        <p className="mt-5 border-t border-line-soft pt-3 text-center text-caption text-ink-faint">
          Your provider API key stays in this browser and is never sent to the server.
        </p>
      </form>
    </div>
  )
}

/** Translate a raw SSO error code into a readable message. */
function ssoErrorMessage(code: string): string {
  const map: Record<string, string> = {
    'state-mismatch': 'Sign-in with Dashy failed: the security check did not match. Please try again.',
    'session-not-set': 'Sign-in with Dashy did not establish a session. Please try again.',
    'Token expired': 'The Dashy sign-in token expired. Please try again.',
    'Token already used': 'This Dashy sign-in link was already used. Please try again.',
    'Invalid signature': 'The Dashy token signature was invalid. Check that SSO_SHARED_SECRET matches on both sides.',
    'Wrong audience': 'The token audience did not match this Mocky instance. Check MOCKY_ORIGIN and SSO_ALLOWED_REDIRECTS.',
    'Wrong issuer': 'The token was not issued by Dashy.',
    'unknown-error': 'Sign-in with Dashy failed for an unknown reason.',
  }
  return map[code] ?? code
}
