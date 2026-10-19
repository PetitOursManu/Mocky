import { useCallback, useEffect, useRef, useState } from 'react'
import { newId, normalizeScreen, type AddScreenOptions, type Project, type Screen } from './project'
import {
  currentBranch,
  deleteBranch,
  deleteVersion,
  getVersion,
  listVersions,
  MAIN_BRANCH,
  normalizeBranch,
  projectSnapshot,
  renameVersion,
  restoreScreenPatch,
  saveVersion,
  screenSnapshot,
  type VersionFull,
  type VersionKind,
  type VersionSummary,
} from './versions'

/**
 * The versions of one project, and the four things that move between them.
 *
 * THE ONE RULE: NOTHING IS REPLACED BEFORE IT IS SAVED
 *
 * A restore and a branch switch both overwrite the working copy. Each first
 * saves that working copy as an automatic version on the branch it is on, and
 * if that save FAILS — no network, a full disk, a session that expired — the
 * restore does not happen. Degrading here would mean "carry on without the
 * safety copy", which is the one thing this feature exists to prevent; so this
 * is the place in Mocky where a failure stops the action instead of being
 * noted beside it. The store answers `unchanged` when that state is already the
 * branch's newest version, so the safety copy costs nothing when nothing moved.
 *
 * The project is READ through `getProject` rather than captured: a restore
 * started from a panel that rendered a second ago must save the screens as they
 * are now, not as they were when the button was drawn.
 */
export function useVersions({
  projectId,
  getProject,
  onRestoreProject,
  onSetBranch,
  onUpdateScreen,
  onAddScreen,
  t,
  enabled,
}: {
  projectId: string
  getProject: () => Project
  onRestoreProject: (version: VersionFull) => void
  onSetBranch: (branch: string | null) => void
  onUpdateScreen: (screenId: string, patch: Partial<Screen>) => void
  onAddScreen: (screen: Omit<Screen, 'x' | 'y'>, opts?: AddScreenOptions) => void
  /**
   * The interface's translator: the automatic labels are written in the
   * person's language at the time, like a note, and so are the refusals.
   */
  t: (key: string, vars?: Record<string, string | number>) => string
  /** Fetch the list only while something shows it. */
  enabled: boolean
}) {
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cache = useRef(new Map<string, VersionFull>())
  const tRef = useRef(t)
  tRef.current = t
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const branchName = (b: string) => (b === MAIN_BRANCH ? tRef.current('versions.mainBranch') : b)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setVersions(await listVersions(projectId))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (enabled) void refresh()
  }, [enabled, refresh])

  const load = useCallback(async (id: string): Promise<VersionFull> => {
    const hit = cache.current.get(id)
    if (hit) return hit
    const v = await getVersion(id)
    cache.current.set(id, v)
    return v
  }, [])

  /** Run one action: one at a time, its error shown, the list re-read after. */
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      setWorking(true)
      setError(null)
      try {
        return await fn()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return undefined
      } finally {
        setWorking(false)
        void refresh()
      }
    },
    [refresh],
  )

  /** The safety copy taken before anything replaces the working copy. */
  const safetyCopy = useCallback(
    (label: string) => saveVersion({ ...projectSnapshot(getProject()), kind: 'auto', label }),
    [getProject],
  )

  const saveProject = useCallback(
    (label: string, kind: VersionKind = 'manual') =>
      run(async () => (await saveVersion({ ...projectSnapshot(getProject()), kind, label })).version),
    [getProject, run],
  )

  /**
   * An automatic version of one screen — taken by ProjectView each time a
   * screen's code settles after a change, so the Versions panel holds every
   * state a screen went through without anybody pressing "Save".
   *
   * Silent, unlike every other action here: no `working`, no error banner. It
   * runs behind generations the person is watching, and a version that could
   * not be kept (offline, the disk budget) is no reason to interrupt them — the
   * next change tries again (degrade, never fail). `code` saves a state the
   * screen is no longer in: the one it had before its first change of the
   * session, which nothing had kept yet.
   */
  const autoSaveScreen = useCallback(
    async (screenId: string, label: string, code?: string) => {
      const snap = screenSnapshot(getProject(), screenId)
      if (!snap.screens.length) return
      const screens = code === undefined ? snap.screens : snap.screens.map((s) => ({ ...s, code }))
      try {
        const res = await saveVersion({ ...snap, screens, kind: 'auto', label })
        if (!res.unchanged && enabledRef.current) void refresh()
      } catch {
        /* kept next time */
      }
    },
    [getProject, refresh],
  )

  const saveScreen = useCallback(
    (screenId: string, label: string) =>
      run(async () => (await saveVersion({ ...screenSnapshot(getProject(), screenId), kind: 'manual', label })).version),
    [getProject, run],
  )

  /**
   * Bring one screen back from a version — a screen version, or one screen of a
   * project version. A screen deleted since comes back as a NEW screen: its old
   * id is tombstoned for the sync, and reusing it would have the merge
   * disagree with itself about whether it exists.
   */
  const restoreScreen = useCallback(
    (versionId: string, screenId: string) =>
      run(async () => {
        const v = await load(versionId)
        const saved = v.screens.find((s) => s.id === screenId)
        if (!saved) throw new Error(tRef.current('versions.errNoScreen'))
        const now = getProject().screens.find((s) => s.id === screenId)
        if (now) {
          onUpdateScreen(screenId, restoreScreenPatch(now, saved))
        } else {
          const { x: _x, y: _y, ...rest } = normalizeScreen({ ...saved, id: newId() }, 0)
          onAddScreen({ ...rest, createdAt: Date.now() })
        }
        return true
      }),
    [getProject, load, onAddScreen, onUpdateScreen, run],
  )

  /**
   * Keep a past state of a screen BESIDE the present one: a new screen on the
   * canvas, right of the current one, holding the version's code — so the two
   * stay side by side, both live, long after the comparison is closed. Asked
   * for after a branch comparison: restoring replaces, and the person wanted
   * both.
   *
   * A copy, made the way "Duplicate" makes one: its links and its notes stay
   * behind (a link pointing where the original pointed is a flow nobody drew),
   * and so does its route — two screens answering to "cart" would leave the
   * demo choosing between them.
   */
  const keepBeside = useCallback(
    (versionId: string, screenId: string) =>
      run(async () => {
        const v = await load(versionId)
        const saved = v.screens.find((s) => s.id === screenId)
        if (!saved) throw new Error(tRef.current('versions.errNoScreen'))
        const now = getProject().screens.find((s) => s.id === screenId)
        const {
          x: _x,
          y: _y,
          links: _links,
          userNotes: _notes,
          route: _route,
          ...rest
        } = normalizeScreen({ ...saved, id: newId() }, 0)
        const which = v.label || new Date(v.createdAt).toLocaleString()
        onAddScreen(
          {
            ...rest,
            links: [],
            name: tRef.current('versions.keptName', { name: now?.name ?? rest.name, version: which }),
            createdAt: Date.now(),
          },
          now ? { beside: now.id } : undefined,
        )
        return true
      }),
    [getProject, load, onAddScreen, run],
  )

  /** Restore a whole version: a screen version restores its screen, a project version the project. */
  const restore = useCallback(
    (versionId: string) =>
      run(async () => {
        const v = await load(versionId)
        if (v.scope === 'screen' && v.screenId) {
          const saved = v.screens[0]
          const now = getProject().screens.find((s) => s.id === v.screenId)
          if (!saved) throw new Error(tRef.current('versions.errNoScreen'))
          if (now) onUpdateScreen(now.id, restoreScreenPatch(now, saved))
          else {
            const { x: _x, y: _y, ...rest } = normalizeScreen({ ...saved, id: newId() }, 0)
            onAddScreen({ ...rest, createdAt: Date.now() })
          }
          return true
        }
        await safetyCopy(tRef.current('versions.autoBeforeRestore', { label: v.label || new Date(v.createdAt).toLocaleString() }))
        onRestoreProject(v)
        return true
      }),
    [getProject, load, onAddScreen, onRestoreProject, onUpdateScreen, run, safetyCopy],
  )

  /**
   * Start a branch from the working copy. Two saves: the state being left, on
   * the branch it belonged to — so that branch keeps it as its head — and the
   * same state as the new branch's first version, so switching back to the new
   * branch before anything is saved on it still finds a head.
   */
  const createBranch = useCallback(
    (name: string) =>
      run(async () => {
        const wanted = normalizeBranch(name)
        const p = getProject()
        const from = currentBranch(p)
        if (!wanted || wanted === from) return false
        if (versions.some((v) => v.branch === wanted)) throw new Error(tRef.current('versions.errBranchExists'))
        await safetyCopy(tRef.current('versions.autoBeforeSwitch', { branch: branchName(wanted) }))
        await saveVersion({
          ...projectSnapshot(p),
          branch: wanted,
          kind: 'branch',
          label: tRef.current('versions.branchFrom', { branch: branchName(from) }),
        })
        onSetBranch(wanted === MAIN_BRANCH ? null : wanted)
        return true
      }),
    [getProject, onSetBranch, run, safetyCopy, versions],
  )

  /** Leave this branch (saved first) for the head of another. */
  const switchBranch = useCallback(
    (name: string) =>
      run(async () => {
        const p = getProject()
        if (name === currentBranch(p)) return false
        const head = versions
          .filter((v) => v.scope === 'project' && v.branch === name)
          .sort((a, b) => b.createdAt - a.createdAt)[0]
        if (!head) throw new Error(tRef.current('versions.errNoHead'))
        await safetyCopy(tRef.current('versions.autoBeforeSwitch', { branch: branchName(name) }))
        onRestoreProject(await load(head.id))
        return true
      }),
    [getProject, load, onRestoreProject, run, safetyCopy, versions],
  )

  const removeBranch = useCallback(
    (name: string) =>
      run(async () => {
        if (name === currentBranch(getProject())) throw new Error(tRef.current('versions.errDeleteCurrent'))
        return deleteBranch(projectId, name)
      }),
    [getProject, projectId, run],
  )

  const rename = useCallback(
    (id: string, label: string) =>
      run(() => {
        // The comparison titles a side with the cached copy's label.
        cache.current.delete(id)
        return renameVersion(id, label)
      }),
    [run],
  )

  const remove = useCallback(
    (id: string) =>
      run(async () => {
        cache.current.delete(id)
        return deleteVersion(id)
      }),
    [run],
  )

  return {
    versions,
    loading,
    working,
    error,
    clearError: () => setError(null),
    refresh,
    load,
    saveProject,
    saveScreen,
    autoSaveScreen,
    restore,
    restoreScreen,
    keepBeside,
    createBranch,
    switchBranch,
    removeBranch,
    rename,
    remove,
  }
}

export type VersionsApi = ReturnType<typeof useVersions>
