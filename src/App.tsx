import { useEffect, useRef, useState } from 'react'
import { discardPendingSave, useProjects } from './lib/project'
import { loadTheme, nextTheme, saveTheme, type Theme } from './lib/theme'
import { api, type AuthUser } from './lib/api'
import { enableSync, installUnloadGuard, reconcileOnLogin } from './lib/sync'
import { checkSsoReturn, cleanSsoQueryParams } from './lib/sso'
import { loadMuseConfig, setMuseVideoPin, type MuseVideoPin } from './lib/muse'
import { videoPosterUrl } from './lib/videoLibrary'
import ProjectsHome from './components/ProjectsHome'
import ProjectView from './components/ProjectView'
import SettingsPanel from './components/SettingsPanel'
import DesignPanel from './components/DesignPanel'
import AuthModal from './components/AuthModal'
import AdminPanel from './components/AdminPanel'
import Bibliotheque from './components/Bibliotheque'
import SyncIndicator from './components/SyncIndicator'
import SharedScreen from './components/SharedScreen'
import { shareTokenFromLocation } from './lib/share'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Button, Icon, IconButton, Modal } from './ui'
import { useT } from './i18n'

type Route = 'home' | 'project' | 'design' | 'settings' | 'admin' | 'media'

/** The hosted documentation. Opened in a new tab; Mocky never navigates away. */
const DOCS_URL = 'https://mocky-docs.emanuelvigreux.fr/'

/**
 * Marks that this tab has already reloaded to pick up a merge. Per-tab and
 * per-session, which is exactly the scope of the loop it guards against.
 */
const RECONCILE_RELOAD_KEY = 'mocky.reconcileReload.v1'

/**
 * Reload so the running stores pick up what `reconcileOnLogin` just merged into
 * localStorage — at most once, and never with a stale save still queued.
 *
 * Both precautions exist because this reload used to be unbounded. A save
 * queued by `useProjects` at mount still held the array as it was BEFORE the
 * merge, and its flush is registered on `beforeunload` with capture — so it ran
 * during this very reload and wrote the pre-merge array back over the merged
 * one. The next load then found the same difference and reloaded again, several
 * times a second, forever. A fresh origin hits it on the first visit: empty
 * localStorage on one side, every project the account owns on the other.
 */
function reloadForMergedData(): void {
  discardPendingSave()
  try {
    if (sessionStorage.getItem(RECONCILE_RELOAD_KEY)) {
      // We already reloaded once for this and it did not settle. Reloading
      // again would spin; the merged data is in localStorage either way, and
      // the next navigation picks it up.
      console.warn('[mocky] reconcile still reports changes after a reload — not reloading again')
      return
    }
    sessionStorage.setItem(RECONCILE_RELOAD_KEY, '1')
  } catch {
    /* No sessionStorage (private mode). Reload anyway — the loop is the rarer risk. */
  }
  window.location.reload()
}

/** Called once a load settles, so a genuine later merge can reload again. */
function clearReconcileReloadMark(): void {
  try {
    sessionStorage.removeItem(RECONCILE_RELOAD_KEY)
  } catch {
    /* ignore */
  }
}

export default function App() {
  /**
   * A share link short-circuits the whole application.
   *
   * Read once, before any hook that loads projects, opens the account modal or
   * arms the sync loop — none of which a phone scanning a QR code should
   * trigger. Computed at module scope of the render rather than in state: the
   * URL cannot change without a navigation, and a state round-trip would flash
   * the sign-in modal before the viewer appeared.
   */
  const shareToken = shareTokenFromLocation()
  if (shareToken) return <SharedScreen token={shareToken} />
  return <MockyApp />
}

function MockyApp() {
  const t = useT()
  const { projects, createProject, deleteProject, renameProject, addScreen, updateScreen, removeScreen, setReferenceScreen } =
    useProjects()
  const [route, setRoute] = useState<Route>('home')
  /** DESIGN.md shown over the current project, without leaving it. */
  const [designOverlay, setDesignOverlay] = useState(false)
  /** Bumped on close so the project below re-reads the file it may have edited. */
  const [designNonce, setDesignNonce] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [theme, setThemeState] = useState<Theme>(() => loadTheme())
  const [account, setAccount] = useState<AuthUser | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [ssoError, setSsoError] = useState<string | null>(null)
  /** The sequence Muse will use for the hero, mirrored from the Muse settings. */
  const [videoPin, setVideoPin] = useState<MuseVideoPin | null>(() => loadMuseConfig().videoPin)
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
          // Reconcile BEFORE arming sync, not after. Armed first, the empty
          // array `useProjects` reads at mount could be pushed to the server
          // before the server's own copy had even been read — and on a fresh
          // origin that means replacing every project the account owns with [].
          const changed = await reconcileOnLogin()
          enableSync(true)
          if (changed) reloadForMergedData()
          else clearReconcileReloadMark()
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
            title={t('nav.backHome')}
          >
            <span className="masthead text-h2 leading-none">Mocky</span>
            <span className="kicker hidden text-accent-ink sm:inline">{t('nav.tagline')}</span>
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
                  title={route === 'project' ? t('projects.rename') : t('app.backToProject')}
                >
                  {activeProject.name}
                </button>
              )}
            </div>
          )}

          <nav className="ml-auto flex items-center gap-1">
            <SyncIndicator />
            <HeaderTab active={route === 'home'} onClick={goHome}>
              {t('nav.home')}
            </HeaderTab>
            <HeaderTab active={route === 'design'} onClick={() => setRoute('design')}>
              {t('nav.design')}
            </HeaderTab>
            <HeaderTab active={route === 'media'} onClick={() => setRoute('media')}>
              {t('nav.media')}
            </HeaderTab>
            <HeaderTab active={route === 'settings'} onClick={() => setRoute('settings')}>
              {t('nav.settings')}
            </HeaderTab>
            {account?.role === 'admin' && (
              <HeaderTab active={route === 'admin'} onClick={() => setRoute('admin')}>
                {t('nav.admin')}
              </HeaderTab>
            )}
            {/* An anchor, not a button: this one leaves the app, so it has to
                behave like a link — middle-click, ⌘-click and "copy address"
                all work, which a button swallowing an onClick cannot offer. */}
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              title={t('nav.docsTitle')}
              className="kicker flex min-h-8 items-center gap-1.5 border-b-2 border-transparent px-2.5 pt-1.5 text-ink-muted transition hover:text-ink"
            >
              {t('nav.docs')}
              <Icon name="external" size={13} />
            </a>
            <IconButton
              label={theme === 'dark' ? t('theme.toPaper') : t('theme.toInk')}
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
                  if (confirm(t('account.signOutConfirm', { name: account.username }))) logout()
                }}
                className="ml-1"
                title={t('account.signedInAs')}
              >
                {/* Square, like everything else here. `rounded-full` is the
                    design system's one exception and it is meant for status
                    dots — an avatar in a circle would be the only round thing
                    on a page built out of rules and rectangles. */}
                {api.avatarUrl(account) ? (
                  <img
                    src={api.avatarUrl(account) as string}
                    alt=""
                    className="h-5 w-5 shrink-0 border border-line-soft object-cover"
                  />
                ) : (
                  <Icon name="user" size={16} />
                )}
                <span className="max-w-[100px] truncate">{account.username}</span>
              </Button>
            ) : (
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setAuthOpen(true)}
                className="ml-1"
                title={t('app.signInHint')}
              >
                {t('account.signIn')}
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
            resetLabel={t('error.backToProjects')}
          >
          <ProjectView
            key={activeProject.id}
            project={activeProject}
            onAddScreen={(screen) => addScreen(activeProject.id, screen)}
            onUpdateScreen={(sid, patch) => updateScreen(activeProject.id, sid, patch)}
            onRemoveScreen={(sid) => removeScreen(activeProject.id, sid)}
            onOpenSettings={() => setRoute('settings')}
            onOpenDesign={() => setDesignOverlay(true)}
            designNonce={designNonce}
            onBack={goHome}
            onSetReference={(sid) => setReferenceScreen(activeProject.id, sid)}
            onRenameProject={(name) => renameProject(activeProject.id, name)}
          />
          </ErrorBoundary>
        ) : (
          <div className="page py-16 text-center text-body text-ink-faint">
            {t('app.noProjectSelected')}{' '}
            <button type="button" className="text-accent-ink hover:underline" onClick={goHome}>
              {t('error.backToProjects')}
            </button>
          </div>
        ))}

      {route === 'design' && (
        <main className="page py-10">
          <DesignPanel />
        </main>
      )}

      {/* DESIGN.md over the project instead of instead of it.
          Opened from the composer chip, the design-system frame or a screen's
          menu — all three used to change route, which unmounts ProjectView and
          takes the canvas position, the selection, the composer's text and any
          generation in flight with it. The header tab still opens the full page
          for anyone who wants to sit and write in it. */}
      {designOverlay && (
        <Modal
          title="DESIGN.md"
          size="full"
          onClose={() => {
            setDesignOverlay(false)
            setDesignNonce((n) => n + 1)
          }}
        >
          <DesignPanel embedded />
        </Modal>
      )}
      {route === 'media' && (
        <Bibliotheque
          variant="page"
          projectId={activeProject?.id}
          projectNames={Object.fromEntries(projects.map((p) => [p.id, p.name]))}
          // Choosing a sequence here has no project to attach to, so it is
          // stored with the Muse settings: whichever project is opened next
          // finds it already chosen, and it survives a reload.
          pinnedVideo={videoPin}
          onPinVideo={(v) => {
            const pin: MuseVideoPin | null = v
              ? {
                  hash: v.hash,
                  frames: v.frames,
                  poster: videoPosterUrl(v.hash),
                  label: v.prompt.slice(0, 60),
                }
              : null
            setMuseVideoPin(pin)
            setVideoPin(pin)
          }}
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
          <div className="page py-16 text-center text-body text-ink-faint">{t('app.adminsOnly')}</div>
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
            // Same ordering as the startup path above: merge first, arm sync
            // only once the server's copy is in hand.
            reconcileOnLogin()
              .then((changed) => {
                enableSync(true)
                if (changed) reloadForMergedData()
                else clearReconcileReloadMark()
              })
              .catch(() => {
                // Sync stays off rather than risking a push of a copy that was
                // never reconciled. The indicator already shows nothing is
                // syncing; a reload retries the whole sequence.
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
