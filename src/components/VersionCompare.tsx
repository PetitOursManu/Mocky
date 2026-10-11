import { useEffect, useMemo, useState } from 'react'
import { Banner, Button, Icon, Modal, Select, Spinner } from '../ui'
import { useLang, useT } from '../i18n'
import ScreenFit from './ScreenFit'
import type { Project, Screen } from '../lib/project'
import { diffVersions, MAIN_BRANCH, type VersionFull } from '../lib/versions'
import type { VersionsApi } from '../lib/useVersions'

/** One side of a comparison: the working copy, or a saved version. */
export type CompareSource = { kind: 'current' } | { kind: 'version'; id: string }

interface Side {
  title: string
  screens: (Partial<Screen> & { id: string })[]
  design: string | null
  version: VersionFull | null
}

const CURRENT = 'current'

/**
 * Two states of a project side by side, one screen at a time.
 *
 * The list of screens is the UNION of both sides, each marked with what
 * happened to it — changed, added, removed, the same — read off the code
 * itself, so a screen that moved on the canvas but kept its code reads "the
 * same", which is what someone comparing designs means by it. A screen absent
 * from one side says so in that pane rather than leaving it blank.
 *
 * Restoring from here restores ONE screen: the comparison is how someone finds
 * the screen they want back, and taking the whole project with it would undo
 * the screens they were happy with. The whole version is restored from the
 * panel, where the list says which one it is.
 */
export default function VersionCompare({
  api,
  project,
  left: leftInit,
  right: rightInit,
  initialScreenId,
  busy,
  onClose,
}: {
  api: VersionsApi
  project: Project
  left: CompareSource
  right: CompareSource
  initialScreenId?: string
  busy: boolean
  onClose: () => void
}) {
  const t = useT()
  const [lang] = useLang()
  const [leftSrc, setLeftSrc] = useState(sourceKey(leftInit))
  const [rightSrc, setRightSrc] = useState(sourceKey(rightInit))
  const [loaded, setLoaded] = useState<Record<string, VersionFull>>({})
  const [error, setError] = useState<string | null>(null)
  const [screenId, setScreenId] = useState<string | null>(initialScreenId ?? null)

  const when = (at: number) => new Date(at).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })
  const branchName = (b: string) => (b === MAIN_BRANCH ? t('versions.mainBranch') : b)

  // Load whichever versions the two sides name.
  useEffect(() => {
    let alive = true
    for (const key of [leftSrc, rightSrc]) {
      if (key === CURRENT || loaded[key]) continue
      api
        .load(key)
        .then((v) => alive && setLoaded((m) => ({ ...m, [key]: v })))
        .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
    }
    return () => {
      alive = false
    }
  }, [leftSrc, rightSrc, loaded, api])

  function side(key: string): Side | null {
    if (key === CURRENT) {
      return { title: t('versions.currentState'), screens: project.screens, design: project.design ?? null, version: null }
    }
    const v = loaded[key]
    if (!v) return null
    return {
      title: v.label || t(`versions.kind.${v.kind}`),
      screens: v.screens,
      design: v.project?.design ?? null,
      version: v,
    }
  }

  const left = side(leftSrc)
  const right = side(rightSrc)

  const diff = useMemo(() => {
    if (!left || !right) return null
    const asSummary = (s: Side) => ({
      designHash: s.design,
      screens: s.screens.map((x) => ({ id: x.id, name: x.name ?? '', codeHash: x.code ?? '' })),
    })
    return diffVersions(asSummary(left), asSummary(right))
  }, [left, right])

  // Every screen of either side, the right side's order first.
  const union = useMemo(() => {
    const out: { id: string; name: string }[] = []
    const seen = new Set<string>()
    for (const s of [...(right?.screens ?? []), ...(left?.screens ?? [])]) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      out.push({ id: s.id, name: s.name || '…' })
    }
    return out
  }, [left, right])

  const active = screenId && union.some((s) => s.id === screenId) ? screenId : (union[0]?.id ?? null)

  function mark(id: string): string {
    if (!diff) return ''
    if (diff.added.includes(id)) return t('versions.diffAdded')
    if (diff.removed.includes(id)) return t('versions.diffRemoved')
    if (diff.changed.includes(id)) return t('versions.diffChanged')
    return t('versions.diffSame')
  }

  const options = (
    <>
      <option value={CURRENT}>{t('versions.currentState')}</option>
      {api.versions
        .filter((v) => v.scope === 'project' || (active && v.screenId === active))
        .map((v) => (
          <option key={v.id} value={v.id}>
            {(v.label || t(`versions.kind.${v.kind}`)) + ' — ' + when(v.createdAt) + ' · ' + branchName(v.branch)}
          </option>
        ))}
    </>
  )

  function pane(key: string, s: Side | null, setKey: (k: string) => void, which: 'left' | 'right') {
    const screen = s && active ? s.screens.find((x) => x.id === active) : null
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <Select
          value={key}
          aria-label={t(which === 'left' ? 'versions.compareLeft' : 'versions.compareRight')}
          onChange={(e) => setKey(e.target.value)}
        >
          {options}
        </Select>
        <div className="relative min-h-0 flex-1 bg-sunken p-2">
          {!s ? (
            <div className="flex h-full items-center justify-center">
              <Spinner className="h-5 w-5" />
            </div>
          ) : !screen ? (
            <div className="flex h-full items-center justify-center text-body-sm text-ink-faint">
              {t('versions.screenAbsent')}
            </div>
          ) : (
            <ScreenFit
              screen={{
                id: `${key}:${screen.id}`,
                name: screen.name ?? '',
                code: screen.code ?? '',
                caps: screen.caps ?? [],
                componentName: screen.componentName ?? 'App',
                w: screen.w ?? 1440,
                h: screen.h ?? 900,
                page: screen.page,
              }}
            />
          )}
        </div>
        {s?.version && screen && (
          <Button
            size="sm"
            disabled={busy || api.working}
            onClick={() => {
              if (confirm(t('versions.restoreScreenConfirm', { name: screen.name ?? '' }))) {
                void api.restoreScreen(s.version!.id, screen.id)
              }
            }}
          >
            <Icon name="undo" size={14} />
            {t('versions.restoreThisScreen')}
          </Button>
        )}
      </div>
    )
  }

  return (
    <Modal title={t('versions.compareTitle')} size="full" onClose={onClose}>
      {(error || api.error) && <Banner tone="danger">{error || api.error}</Banner>}
      <div className="flex h-[72vh] flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {union.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === active}
              onClick={() => setScreenId(s.id)}
              className={`rounded-md border px-2 py-1 text-caption transition ${
                s.id === active ? 'border-accent bg-ink text-surface' : 'border-line-soft text-ink hover:border-line'
              }`}
            >
              {s.name}
              <span className={`ml-1.5 ${s.id === active ? 'opacity-80' : 'text-ink-faint'}`}>{mark(s.id)}</span>
            </button>
          ))}
          {diff?.designChanged && (
            <span className="ml-auto text-caption text-accent-ink">{t('versions.designChanged')}</span>
          )}
        </div>
        <div className="flex min-h-0 flex-1 gap-3">
          {pane(leftSrc, left, setLeftSrc, 'left')}
          {pane(rightSrc, right, setRightSrc, 'right')}
        </div>
      </div>
    </Modal>
  )
}

function sourceKey(s: CompareSource): string {
  return s.kind === 'current' ? CURRENT : s.id
}
