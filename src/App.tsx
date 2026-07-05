import { useEffect, useState } from 'react'
import { useProjects } from './lib/project'
import { THEMES, loadTheme, nextTheme, saveTheme, type Theme } from './lib/theme'
import { api, type AuthUser } from './lib/api'
import { enableSync, reconcileOnLogin } from './lib/sync'
import { checkSsoReturn, cleanSsoQueryParams } from './lib/sso'
import ProjectsHome from './components/ProjectsHome'
import ProjectView from './components/ProjectView'
import SettingsPanel from './components/SettingsPanel'
import DesignPanel from './components/DesignPanel'
import AuthModal from './components/AuthModal'
import AdminPanel from './components/AdminPanel'

type Route = 'home' | 'project' | 'design' | 'settings' | 'admin'

export default function App() {
  const { projects, createProject, deleteProject, renameProject, addScreen, updateScreen, removeScreen } =
    useProjects()
  const [route, setRoute] = useState<Route>('home')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [theme, setThemeState] = useState<Theme>(() => loadTheme())
  const [account, setAccount] = useState<AuthUser | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [ssoError, setSsoError] = useState<string | null>(null)

  // On startup: if we're returning from a Dashy SSO redirect, validate the
  // state, then restore the session (the backend just set the cookie) and
  // reconcile with the server. Otherwise just restore any existing session.
  useEffect(() => {
    const returned = checkSsoReturn()
    const hadSsoReturn = returned.ok || (!returned.ok && returned.error !== 'no-sso-param')
    if (hadSsoReturn) {
      if (!returned.ok) setSsoError(returned.error)
      cleanSsoQueryParams()
    }

    api
      .me()
      .then(async (user) => {
        setAccount(user)
        if (!user) return
        enableSync(true)
        const changed = await reconcileOnLogin()
        if (changed) window.location.reload()
      })
      .catch(() => {
        setAccount(null)
        // SSO return but no session → surface the problem in the auth modal.
        if (hadSsoReturn) {
          if (returned.ok) setSsoError('session-not-set')
          setAuthOpen(true)
        }
      })
  }, [])

  async function logout() {
    try {
      await api.logout()
    } catch {
      /* ignore */
    }
    enableSync(false)
    setAccount(null)
  }

  function toggleTheme() {
    const next: Theme = nextTheme(theme)
    setThemeState(next)
    saveTheme(next)
  }
  const themeMeta = THEMES.find((t) => t.id === theme) ?? THEMES[0]

  const activeProject = projects.find((p) => p.id === activeId) ?? null

  function openProject(id: string) {
    setActiveId(id)
    setRoute('project')
  }

  function newProject() {
    const id = createProject()
    openProject(id)
  }

  function goHome() {
    setRoute('home')
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="flex items-center gap-3 px-6 py-3">
          <button type="button" onClick={goHome} className="flex items-center gap-3" title="Mocky home">
            <img src="/favicon.svg" alt="Mocky" className="h-9 w-9" />
            <div className="text-left">
              <h1 className="text-base font-semibold leading-tight">Mocky</h1>
              <p className="text-xs text-slate-400">chat-to-UI generator · self-hosted</p>
            </div>
          </button>

          {/* Project breadcrumb */}
          {activeProject && (
            <div className="flex items-center gap-2">
              <span className="text-slate-600">/</span>
              {editingName ? (
                <input
                  autoFocus
                  className="input py-1 text-sm"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => {
                    renameProject(activeProject.id, draftName)
                    setEditingName(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      renameProject(activeProject.id, draftName)
                      setEditingName(false)
                    }
                    if (e.key === 'Escape') setEditingName(false)
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (route !== 'project') setRoute('project')
                    else {
                      setDraftName(activeProject.name)
                      setEditingName(true)
                    }
                  }}
                  className="text-sm font-medium text-slate-200 hover:text-white"
                  title={route === 'project' ? 'Rename project' : 'Back to project'}
                >
                  {activeProject.name}
                </button>
              )}
            </div>
          )}

          <nav className="ml-auto flex items-center gap-1">
            <HeaderTab active={route === 'home'} onClick={goHome}>
              Home
            </HeaderTab>
            <HeaderTab active={route === 'design'} onClick={() => setRoute('design')}>
              DESIGN.md
            </HeaderTab>
            <HeaderTab active={route === 'settings'} onClick={() => setRoute('settings')}>
              Settings
            </HeaderTab>
            {account?.role === 'admin' && (
              <HeaderTab active={route === 'admin'} onClick={() => setRoute('admin')}>
                Admin
              </HeaderTab>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="ml-1 flex h-8 items-center gap-1.5 rounded-lg px-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              title={`Theme: ${themeMeta.label} — click to switch`}
            >
              <span className="text-sm">{themeMeta.icon}</span>
              <span className="text-xs">{themeMeta.label}</span>
            </button>
            {account ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Sign out of "${account.username}"? Your projects stay on this device.`)) logout()
                }}
                className="ml-1 flex h-8 items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
                title="Signed in — click to sign out"
              >
                <span>👤</span>
                <span className="max-w-[100px] truncate">{account.username}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="ml-1 flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
                title="Sign in to sync your projects across devices"
              >
                Sign in
              </button>
            )}
          </nav>
        </div>
      </header>

      {route === 'home' && (
        <ProjectsHome
          projects={projects}
          onOpen={openProject}
          onCreate={newProject}
          onDelete={(id) => {
            deleteProject(id)
            if (id === activeId) setActiveId(null)
          }}
        />
      )}

      {route === 'project' &&
        (activeProject ? (
          <ProjectView
            key={activeProject.id}
            project={activeProject}
            onAddScreen={(screen) => addScreen(activeProject.id, screen)}
            onUpdateScreen={(sid, patch) => updateScreen(activeProject.id, sid, patch)}
            onRemoveScreen={(sid) => removeScreen(activeProject.id, sid)}
            onOpenSettings={() => setRoute('settings')}
            onOpenDesign={() => setRoute('design')}
          />
        ) : (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            No project selected.{' '}
            <button type="button" className="text-indigo-400 hover:underline" onClick={goHome}>
              Back to projects
            </button>
          </div>
        ))}

      {route === 'design' && (
        <main className="px-6 py-10">
          <DesignPanel />
        </main>
      )}
      {route === 'settings' && (
        <main className="px-6 py-10">
          <SettingsPanel />
        </main>
      )}
      {route === 'admin' &&
        (account?.role === 'admin' ? (
          <main className="px-6 py-10">
            <AdminPanel currentUsername={account.username} />
          </main>
        ) : (
          <div className="px-6 py-16 text-center text-sm text-slate-500">Admins only.</div>
        ))}

      {authOpen && (
        <AuthModal
          initialError={ssoError}
          onClose={() => {
            setSsoError(null)
            setAuthOpen(false)
          }}
          onSignedIn={setAccount}
        />
      )}
    </div>
  )
}

function HeaderTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  )
}
