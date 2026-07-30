import { useEffect, useRef, useState } from 'react'
import { useProjects } from './lib/project'
import { loadTheme, nextTheme, saveTheme, type Theme } from './lib/theme'
import { api, type AuthUser } from './lib/api'
import { enableSync, installUnloadGuard, reconcileOnLogin } from './lib/sync'
import { checkSsoReturn, cleanSsoQueryParams } from './lib/sso'
import ProjectsHome from './components/ProjectsHome'
import ProjectView from './components/ProjectView'
import SettingsPanel from './components/SettingsPanel'
import DesignPanel from './components/DesignPanel'
import AuthModal from './components/AuthModal'
import AdminPanel from './components/AdminPanel'
import Bibliotheque from './components/Bibliotheque'
import SyncIndicator from './components/SyncIndicator'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Button, Icon, IconButton } from './ui'

type Route = 'home' | 'project' | 'design' | 'settings' | 'admin' | 'images'

export default function App() {
  const { projects, createProject, deleteProject, renameProject, addScreen, updateScreen, removeScreen, setReferenceScreen } =
    useProjects()
  const [route, setRoute] = useState<Route>('home')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [theme, setThemeState] = useState<Theme>(() => loadTheme())
  const [account, setAccount] = useState<AuthUser | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [ssoError, setSsoError] = useState<string | null>(null)
  const authCheckedRef = useRef(false)

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
        if (!user) {
          setAuthOpen(true)
        } else {
          enableSync(true)
          const changed = await reconcileOnLogin()
          if (changed) window.location.reload()
        }
      })
      .catch(() => {
        setAccount(null)
        setAuthOpen(true)
        // SSO return but no session → surface the problem in the auth modal.
        if (hadSsoReturn) {
          if (returned.ok) setSsoError('session-not-set')
        }
      })
      .finally(() => {
        authCheckedRef.current = true
      })
  }, [])

  useEffect(() => installUnloadGuard(), [])

  async function logout() {
    try {
      await api.logout()
    } catch {
      /* ignore */
    }
    enableSync(false)
    setAccount(null)
    setAuthOpen(true)
  }

  function toggleTheme() {
    const next: Theme = nextTheme(theme)
    setThemeState(next)
    saveTheme(next)
  }

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
    <div className="min-h-screen bg-sunken text-ink">
      {/* The masthead. A newspaper announces itself once, in the serif, above a
          double rule — then gets out of the way. */}
      <header className="rule-double bg-surface">
        <div className="page flex items-center gap-3 py-2.5">
          <button
            type="button"
            onClick={goHome}
            className="flex items-baseline gap-2.5"
            title="Accueil Mocky"
          >
            <span className="masthead text-h2 leading-none">Mocky</span>
            <span className="kicker hidden text-accent-ink sm:inline">Chat&nbsp;→&nbsp;UI · auto-hébergé</span>
          </button>

          {/* Project breadcrumb */}
          {activeProject && (
            <div className="flex items-center gap-2">
              <span className="text-ink-faint">/</span>
              {editingName ? (
                <input
                  autoFocus
                  className="input py-1 text-body"
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
                  className="text-body font-medium text-ink-muted transition hover:text-ink"
                  title={route === 'project' ? 'Rename project' : 'Back to project'}
                >
                  {activeProject.name}
                </button>
              )}
            </div>
          )}

          <nav className="ml-auto flex items-center gap-1">
            <SyncIndicator />
            <HeaderTab active={route === 'home'} onClick={goHome}>
              Home
            </HeaderTab>
            <HeaderTab active={route === 'design'} onClick={() => setRoute('design')}>
              DESIGN.md
            </HeaderTab>
            <HeaderTab active={route === 'images'} onClick={() => setRoute('images')}>
              Images
            </HeaderTab>
            <HeaderTab active={route === 'settings'} onClick={() => setRoute('settings')}>
              Settings
            </HeaderTab>
            {account?.role === 'admin' && (
              <HeaderTab active={route === 'admin'} onClick={() => setRoute('admin')}>
                Admin
              </HeaderTab>
            )}
            <IconButton
              label={theme === 'dark' ? 'Passer au thème Papier' : 'Passer au thème Encre'}
              variant="quiet"
              onClick={toggleTheme}
              className="ml-1"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </IconButton>
            {account ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm(`Se déconnecter de « ${account.username} » ? Vos projets restent sur cet appareil.`)) logout()
                }}
                className="ml-1"
                title="Connecté — cliquez pour vous déconnecter"
              >
                <Icon name="user" size={16} />
                <span className="max-w-[100px] truncate">{account.username}</span>
              </Button>
            ) : (
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setAuthOpen(true)}
                className="ml-1"
                title="Sign in to sync your projects across devices"
              >
                Sign in
              </Button>
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
          // Scoped boundary: a project whose data makes ProjectView throw must
          // not take the rest of the app down with it — you can still get back
          // to the other projects.
          <ErrorBoundary
            resetKey={activeProject.id}
            onReset={goHome}
            resetLabel="Retour aux projets"
          >
          <ProjectView
            key={activeProject.id}
            project={activeProject}
            onAddScreen={(screen) => addScreen(activeProject.id, screen)}
            onUpdateScreen={(sid, patch) => updateScreen(activeProject.id, sid, patch)}
            onRemoveScreen={(sid) => removeScreen(activeProject.id, sid)}
            onOpenSettings={() => setRoute('settings')}
            onOpenDesign={() => setRoute('design')}
            onBack={goHome}
            onSetReference={(sid) => setReferenceScreen(activeProject.id, sid)}
            onRenameProject={(name) => renameProject(activeProject.id, name)}
          />
          </ErrorBoundary>
        ) : (
          <div className="page py-16 text-center text-body text-ink-faint">
            No project selected.{' '}
            <button type="button" className="text-accent hover:underline" onClick={goHome}>
              Back to projects
            </button>
          </div>
        ))}

      {route === 'design' && (
        <main className="page py-10">
          <DesignPanel />
        </main>
      )}
      {route === 'images' && (
        <Bibliotheque
          variant="page"
          projectId={activeProject?.id}
          projectNames={Object.fromEntries(projects.map((p) => [p.id, p.name]))}
        />
      )}
      {route === 'settings' && (
        <main className="page py-10">
          <SettingsPanel />
        </main>
      )}
      {route === 'admin' &&
        (account?.role === 'admin' ? (
          <main className="page py-10">
            <AdminPanel currentUsername={account.username} />
          </main>
        ) : (
          <div className="page py-16 text-center text-body text-ink-faint">Admins only.</div>
        ))}

      {authOpen && (
        <AuthModal
          initialError={ssoError}
          // Mocky requires an account: the server routes that hold projects,
          // images and Muse all need a session. The modal says so rather than
          // eating the click.
          dismissible={Boolean(account)}
          onClose={() => {
            setSsoError(null)
            if (account) setAuthOpen(false)
          }}
          onSignedIn={(user) => {
            setAccount(user)
            setAuthOpen(false)
            setSsoError(null)
            enableSync(true)
            reconcileOnLogin().then((changed) => {
              if (changed) window.location.reload()
            })
          }}
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
  // Section labels of a paper: small caps, widely letterspaced, and the current
  // one marked by a rule under it rather than a filled pill.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`kicker min-h-8 border-b-2 px-2.5 pt-1.5 transition ${
        active ? 'border-accent text-accent-ink' : 'border-transparent hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
