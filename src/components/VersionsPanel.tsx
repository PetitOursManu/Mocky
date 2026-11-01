import { useMemo, useState } from 'react'
import { Banner, Button, Icon, IconButton, Input, Panel, Segmented, Spinner } from '../ui'
import { useLang, useT } from '../i18n'
import { branchesOf, MAIN_BRANCH, VERSION_LABEL_MAX, BRANCH_MAX, type VersionSummary } from '../lib/versions'
import type { VersionsApi } from '../lib/useVersions'

/**
 * Versions and branches of the open project, in the canvas' right-hand slot.
 *
 * Three blocks, in the order a person needs them: which branch the working copy
 * is on (and the others), saving the current state, and the history.
 *
 * The history has a trail — branch › all versions › one screen — because a
 * project's automatic versions arrive by the dozen, several screens mixed, and
 * a flat list of "Modification" gave no way to follow one screen. A screen's
 * name in a row narrows the list to it; the trail says where the list stands
 * and goes back up. Each row carries its NOTE, what changed in words. Comparing
 * is a selection — tick one version to compare it with what is on the canvas,
 * two to compare them with each other — because "compare" with no second term
 * is a question the interface would otherwise have to ask in a dialog.
 */
export default function VersionsPanel({
  api,
  branch,
  busy,
  screenName,
  onCompare,
  onClose,
}: {
  api: VersionsApi
  /** The branch the working copy is on. */
  branch: string
  /** A generation is running: nothing may replace the working copy under it. */
  busy: boolean
  screenName: (id: string) => string | null
  /** `b` null means "the working copy". */
  onCompare: (a: string, b: string | null) => void
  onClose: () => void
}) {
  const t = useT()
  const [lang] = useLang()
  const [label, setLabel] = useState('')
  const [newBranch, setNewBranch] = useState<string | null>(null)
  const [scope, setScope] = useState<'branch' | 'all'>('branch')
  const [picked, setPicked] = useState<string[]>([])
  /** The screen the history is narrowed to, or null for every version. */
  const [screenFocus, setScreenFocus] = useState<string | null>(null)

  const branches = useMemo(() => branchesOf(api.versions, branch), [api.versions, branch])
  const shown = useMemo(
    () =>
      api.versions.filter(
        (v) =>
          (scope === 'all' || v.branch === branch) &&
          // A screen's history is its own versions AND every project version
          // that holds it: a project saved ten times is ten moments of it.
          (!screenFocus || (v.scope === 'screen' ? v.screenId === screenFocus : v.screens.some((s) => s.id === screenFocus))),
      ),
    [api.versions, scope, branch, screenFocus],
  )
  const name = (b: string) => (b === MAIN_BRANCH ? t('versions.mainBranch') : b)
  const when = (at: number) => new Date(at).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })
  const locked = busy || api.working

  function togglePick(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]))
  }

  const nameOf = (id: string, fallback?: string) => screenName(id) ?? fallback ?? '?'

  function describe(v: VersionSummary) {
    if (v.scope === 'screen' && v.screenId) {
      const label = t('versions.ofScreen', { name: nameOf(v.screenId, v.screens[0]?.name) })
      if (screenFocus === v.screenId) return label
      const id = v.screenId
      return (
        <button
          type="button"
          className="underline decoration-line underline-offset-2 hover:text-ink"
          title={t('versions.showScreen')}
          onClick={() => setScreenFocus(id)}
        >
          {label}
        </button>
      )
    }
    return t('versions.screenCount', { count: v.screens.length })
  }

  const focusName = screenFocus
    ? nameOf(screenFocus, api.versions.flatMap((v) => v.screens).find((s) => s.id === screenFocus)?.name)
    : null

  return (
    <Panel
      title={t('versions.title')}
      onClose={onClose}
      className="absolute right-4 top-11 w-80 rounded-xl shadow-2xl"
      footer={
        picked.length > 0 ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              className="flex-1"
              onClick={() => onCompare(picked[0], picked[1] ?? null)}
            >
              <Icon name="grid" size={15} />
              {picked.length === 2 ? t('versions.compareTwo') : t('versions.compareCurrent')}
            </Button>
            <IconButton label={t('versions.clearPick')} variant="quiet" onClick={() => setPicked([])}>
              <Icon name="close" size={15} />
            </IconButton>
          </div>
        ) : undefined
      }
    >
      {api.error && (
        <div className="px-3 pt-3">
          <Banner tone="danger">{api.error}</Banner>
        </div>
      )}

      {/* Branches */}
      <section className="border-b border-line-soft px-3 py-3">
        <div className="kicker mb-2">{t('versions.branches')}</div>
        <ul className="flex flex-col gap-1">
          {branches.map((b) => {
            const here = b.name === branch
            return (
              <li key={b.name} className="flex items-center gap-2">
                <Icon name={here ? 'check' : 'branch'} size={14} className={here ? 'text-accent-ink' : 'text-ink-faint'} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-body-sm ${here ? 'font-semibold text-ink' : 'text-ink'}`}>
                    {name(b.name)}
                    {here && <span className="ml-1 text-caption font-normal text-ink-faint">{t('versions.current')}</span>}
                  </span>
                  <span className="block text-caption text-ink-faint">
                    {b.head ? t('versions.branchMeta', { count: b.count, date: when(b.head.createdAt) }) : t('versions.branchEmpty')}
                  </span>
                </span>
                {!here && (
                  <>
                    <Button
                      size="sm"
                      disabled={locked || !b.head}
                      title={t('versions.openBranchTitle')}
                      onClick={() => {
                        if (confirm(t('versions.openBranchConfirm', { branch: name(b.name) }))) void api.switchBranch(b.name)
                      }}
                    >
                      {t('versions.openBranch')}
                    </Button>
                    {b.name !== MAIN_BRANCH && (
                      <IconButton
                        label={t('versions.deleteBranch', { branch: name(b.name) })}
                        variant="quiet"
                        disabled={locked}
                        onClick={() => {
                          if (confirm(t('versions.deleteBranchConfirm', { branch: name(b.name), count: b.count }))) {
                            void api.removeBranch(b.name)
                          }
                        }}
                      >
                        <Icon name="trash" size={15} />
                      </IconButton>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>
        {newBranch === null ? (
          <Button size="sm" variant="quiet" className="mt-2" disabled={locked} onClick={() => setNewBranch('')}>
            <Icon name="plus" size={15} />
            {t('versions.newBranch')}
          </Button>
        ) : (
          <form
            className="mt-2 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const n = newBranch.trim()
              if (!n) return
              void api.createBranch(n).then((ok) => {
                if (ok) setNewBranch(null)
              })
            }}
          >
            <Input
              autoFocus
              value={newBranch}
              maxLength={BRANCH_MAX}
              placeholder={t('versions.newBranchPlaceholder')}
              aria-label={t('versions.newBranchLabel')}
              onChange={(e) => setNewBranch(e.target.value)}
              className="min-w-0 flex-1"
            />
            <Button size="sm" variant="primary" type="submit" disabled={locked || !newBranch.trim()}>
              {t('versions.create')}
            </Button>
            <IconButton label={t('common.cancel')} variant="quiet" onClick={() => setNewBranch(null)}>
              <Icon name="close" size={15} />
            </IconButton>
          </form>
        )}
        <p className="mt-2 text-caption text-ink-faint">{t('versions.branchHelp')}</p>
      </section>

      {/* Save */}
      <section className="border-b border-line-soft px-3 py-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void api.saveProject(label.trim()).then((v) => {
              if (v) setLabel('')
            })
          }}
        >
          <Input
            value={label}
            maxLength={VERSION_LABEL_MAX}
            placeholder={t('versions.labelPlaceholder')}
            aria-label={t('versions.labelLabel')}
            onChange={(e) => setLabel(e.target.value)}
            className="min-w-0 flex-1"
          />
          <Button size="sm" variant="primary" type="submit" disabled={locked}>
            {t('versions.save')}
          </Button>
        </form>
      </section>

      {/* History */}
      <section className="px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="kicker">{t('versions.history')}</span>
          <Segmented
            value={scope}
            // Clicking the active segment answers null; a history always shows something.
            onChange={(v) => v && setScope(v)}
            options={[
              { value: 'branch', label: t('versions.thisBranch') },
              { value: 'all', label: t('versions.allBranches') },
            ]}
            label={t('versions.historyScope')}
          />
        </div>
        <nav aria-label={t('versions.crumbs')} className="mb-2">
          <ol className="flex min-w-0 flex-wrap items-center gap-1 text-caption text-ink-faint">
            <li>{scope === 'all' ? t('versions.allBranches') : name(branch)}</li>
            <li aria-hidden="true">›</li>
            <li>
              {screenFocus ? (
                <button type="button" className="underline decoration-line underline-offset-2 hover:text-ink" onClick={() => setScreenFocus(null)}>
                  {t('versions.crumbAll')}
                </button>
              ) : (
                <span aria-current="page" className="font-medium text-ink">
                  {t('versions.crumbAll')}
                </span>
              )}
            </li>
            {screenFocus && (
              <>
                <li aria-hidden="true">›</li>
                <li className="min-w-0 max-w-full">
                  <span aria-current="page" className="block truncate font-medium text-ink" title={focusName ?? undefined}>
                    {t('versions.ofScreen', { name: focusName ?? '?' })}
                  </span>
                </li>
              </>
            )}
          </ol>
        </nav>
        {api.loading && api.versions.length === 0 ? (
          <div className="flex justify-center py-4">
            <Spinner className="h-5 w-5" />
          </div>
        ) : shown.length === 0 ? (
          <p className="text-body-sm text-ink-faint">{t('versions.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {shown.map((v) => (
              <li
                key={v.id}
                className={`rounded-lg border px-2.5 py-2 ${picked.includes(v.id) ? 'border-accent bg-ink/5' : 'border-line-soft'}`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={picked.includes(v.id)}
                    onChange={() => togglePick(v.id)}
                    aria-label={t('versions.pickToCompare')}
                    title={t('versions.pickToCompare')}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body-sm text-ink">{v.label || t(`versions.kind.${v.kind}`)}</div>
                    {v.note && (
                      <p className="mt-0.5 line-clamp-3 break-words text-body-sm text-ink-muted" title={v.note}>
                        {v.note}
                      </p>
                    )}
                    <div className="text-caption text-ink-faint">
                      {when(v.createdAt)} · {describe(v)}
                      {scope === 'all' && <> · {name(v.branch)}</>}
                      {v.label && v.kind !== 'manual' && <> · {t(`versions.kind.${v.kind}`)}</>}
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    disabled={locked}
                    title={t(v.scope === 'screen' ? 'versions.restoreScreenTitle' : 'versions.restoreTitle')}
                    onClick={() => {
                      const ok =
                        v.scope === 'screen' ||
                        confirm(t('versions.restoreConfirm', { label: v.label || when(v.createdAt) }))
                      if (ok) void api.restore(v.id)
                    }}
                  >
                    <Icon name="undo" size={14} />
                    {t('versions.restore')}
                  </Button>
                  <IconButton
                    label={t('versions.rename')}
                    variant="quiet"
                    disabled={api.working}
                    onClick={() => {
                      const next = window.prompt(t('versions.renamePrompt'), v.label)
                      if (next !== null) void api.rename(v.id, next)
                    }}
                  >
                    <Icon name="pencil" size={14} />
                  </IconButton>
                  <IconButton
                    label={t('versions.delete')}
                    variant="quiet"
                    disabled={api.working}
                    onClick={() => {
                      if (confirm(t('versions.deleteConfirm'))) {
                        setPicked((p) => p.filter((x) => x !== v.id))
                        void api.remove(v.id)
                      }
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Panel>
  )
}
