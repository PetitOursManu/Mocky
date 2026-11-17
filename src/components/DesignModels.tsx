import { useEffect, useMemo, useRef, useState } from 'react'
import { deleteDesignEntry, listDesigns, renameDesignEntry, type DesignEntry } from '../lib/design'
import {
  activeGlobalDesign,
  deleteTemplate,
  getTemplate,
  listTemplates,
  mergeTemplates,
  renameTemplate,
  renameTemplateSection,
  saveTemplate,
  setTemplateSection,
  templateFromProject,
  templateSections,
  templateThumbUrl,
  type ProjectTemplate,
  type TemplateSection,
  type TemplateSummary,
} from '../lib/templates'
import { backfillTemplateThumbs, saveTemplateThumbs } from '../lib/templateThumbs'
import type { Project } from '../lib/project'
import { previewFromMarkdown } from './DesignLibrary'
import { ScaledMockup } from './DesignMockup'
import { Banner, Button, Field, Icon, IconButton, Input, Modal, Select, Spinner } from '../ui'
import { useT } from '../i18n'

/**
 * The account's templates, with the state every reader needs: still loading,
 * failed, or the list. Media's tab and the first composer both read it.
 */
export function useTemplates(enabled = true) {
  const [list, setList] = useState<TemplateSummary[]>([])
  const [loading, setLoading] = useState(enabled)
  const [failed, setFailed] = useState(false)
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let live = true
    setLoading(true)
    listTemplates().then(
      (l) => {
        if (!live) return
        setList(l)
        setFailed(false)
        setLoading(false)
      },
      () => {
        if (!live) return
        // No server (local-only mode) or not signed in: there are simply none.
        setList([])
        setFailed(true)
        setLoading(false)
      },
    )
    return () => {
      live = false
    }
  }, [enabled, nonce])
  return { list, setList, loading, failed, refresh: () => setNonce((n) => n + 1) }
}

const screensLabel = (t: ReturnType<typeof useT>, n: number) =>
  t(n === 1 ? 'templates.screens_one' : 'templates.screens_other', { count: n })

function Swatch({ markdown, name }: { markdown?: string; name: string }) {
  const t = useT()
  const preview = useMemo(() => (markdown ? previewFromMarkdown(markdown) : null), [markdown])
  return preview ? (
    <ScaledMockup p={preview} name={name} />
  ) : (
    <div className="flex h-24 items-center justify-center bg-sunken text-body-sm text-ink-faint">{t('design.noPreview')}</div>
  )
}

/**
 * What a template LOOKS like: the pictures of its screens, the reference one
 * large. A template saved before pictures were kept shows its direction's
 * swatch until its pictures are taken (`backfillTemplateThumbs`).
 */
function TemplatePreview({ tpl, height = 'h-32' }: { tpl: TemplateSummary; height?: string }) {
  const thumbs = tpl.thumbs ?? []
  if (!thumbs.length) return <Swatch markdown={tpl.design} name={tpl.name} />
  const img = (sid: string, cls: string) => (
    <img key={sid} src={templateThumbUrl(tpl.id, sid, tpl.updatedAt)} alt="" loading="lazy" className={`h-full w-full object-cover object-top ${cls}`} />
  )
  if (thumbs.length === 1) return <div className={`${height} overflow-hidden bg-sunken`}>{img(thumbs[0], '')}</div>
  return (
    <div className={`${height} grid grid-cols-3 gap-0.5 overflow-hidden bg-sunken`}>
      <div className="col-span-2 min-h-0">{img(thumbs[0], '')}</div>
      <div className="grid min-h-0 grid-rows-2 gap-0.5">{thumbs.slice(1, 3).map((sid) => <div key={sid} className="min-h-0">{img(sid, '')}</div>)}</div>
    </div>
  )
}

/** Every template of a section, loaded and laid side by side as one (lib/templates.ts, `mergeTemplates`). */
async function loadSection(section: TemplateSection): Promise<ProjectTemplate> {
  const full: ProjectTemplate[] = []
  for (const s of section.templates) full.push(await getTemplate(s.id))
  return mergeTemplates(full, section.name)
}

/** A name edited in place: Enter or leaving the field keeps it, Escape does not. */
function InlineName({ initial, onDone }: { initial: string; onDone: (name: string | null) => void }) {
  const [draft, setDraft] = useState(initial)
  return (
    <input
      className="input"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={() => onDone(draft.trim() && draft.trim() !== initial ? draft.trim() : null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') onDone(null)
      }}
    />
  )
}

/**
 * Media → Design: the saved directions and the project templates.
 *
 * Two sections and not one list, because the two do different things to a
 * project: a direction changes how its NEXT screens look, a template brings
 * screens. In a project (`onApplyDirection`), a direction is applied to THAT
 * project's direction — never to the global DESIGN.md, which every other project
 * without its own direction follows. On the Media page, both start a new project.
 */
export function DesignModelsTab({
  templates,
  onTemplatesChange,
  templatesFailed,
  directionsVersion,
  onDirectionsChanged,
  currentDirection,
  onApplyDirection,
  onNewProjectWithDirection,
  onNewProjectFromTemplate,
  wide = false,
}: {
  templates: TemplateSummary[]
  onTemplatesChange: (next: TemplateSummary[]) => void
  templatesFailed: boolean
  /** Bumped by the parent to re-read the design library. */
  directionsVersion: number
  onDirectionsChanged: () => void
  currentDirection?: string
  onApplyDirection?: (markdown: string) => void
  onNewProjectWithDirection?: (entry: DesignEntry) => void
  onNewProjectFromTemplate?: (template: ProjectTemplate) => void
  wide?: boolean
}) {
  const t = useT()
  const directions = useMemo(() => listDesigns(), [directionsVersion])
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renamingSection, setRenamingSection] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cols = wide ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
  const { sections, loose } = useMemo(() => templateSections(templates), [templates])
  // The list as it is NOW, for answers that land after it changed.
  const latest = useRef(templates)
  latest.current = templates
  const replace = (next: TemplateSummary) => onTemplatesChange(latest.current.map((x) => (x.id === next.id ? next : x)))

  // Templates saved before pictures were kept get theirs, once, in the background.
  useEffect(() => {
    backfillTemplateThumbs(templates, replace)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates])

  async function openSection(section: TemplateSection) {
    if (!onNewProjectFromTemplate) return
    setOpening(`section:${section.name}`)
    setError(null)
    try {
      onNewProjectFromTemplate(await loadSection(section))
    } catch (e) {
      setError(t('templates.openFailed', { reason: e instanceof Error ? e.message : String(e) }))
    } finally {
      setOpening(null)
    }
  }

  async function moveTo(tpl: TemplateSummary, value: string) {
    let section = value
    if (value === '__new') {
      section = (prompt(t('templates.section.newPrompt')) ?? '').trim()
      if (!section) return
    }
    try {
      replace(await setTemplateSection(tpl.id, section))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function renameSection(from: string, to: string) {
    try {
      await renameTemplateSection(from, to)
      onTemplatesChange(latest.current.map((x) => (x.section === from ? { ...x, ...(to ? { section: to } : { section: undefined }) } : x)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function open(summary: TemplateSummary) {
    if (!onNewProjectFromTemplate) return
    setOpening(summary.id)
    setError(null)
    try {
      onNewProjectFromTemplate(await getTemplate(summary.id))
    } catch (e) {
      setError(t('templates.openFailed', { reason: e instanceof Error ? e.message : String(e) }))
    } finally {
      setOpening(null)
    }
  }

  const sectionNames = sections.map((x) => x.name)

  const card = (tpl: TemplateSummary) => (
    <article key={tpl.id} className="overflow-hidden rounded-xl border border-line-soft bg-surface">
      <TemplatePreview tpl={tpl} />
      <div className="px-3 py-2.5">
        {renaming === tpl.id ? (
          <InlineName
            initial={tpl.name}
            onDone={(name) => {
              setRenaming(null)
              if (!name) return
              renameTemplate(tpl.id, name).then(replace, (e) => setError(e instanceof Error ? e.message : String(e)))
            }}
          />
        ) : (
          <div className="truncate text-body font-medium text-ink" title={tpl.name}>
            {tpl.name}
          </div>
        )}
        <div className="mt-0.5 truncate text-caption text-ink-faint" title={tpl.screenNames.join(', ')}>
          <span className="font-mono text-accent-ink">{screensLabel(t, tpl.screenCount)}</span>
          {tpl.screenNames.length > 0 && ` · ${tpl.screenNames.join(', ')}`}
        </div>
        <Select
          className="mt-2 !py-1 text-caption"
          aria-label={t('templates.section.move', { name: tpl.name })}
          value={tpl.section ?? ''}
          onChange={(e) => void moveTo(tpl, e.currentTarget.value)}
        >
          <option value="">{t('templates.section.none')}</option>
          {sectionNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
          <option value="__new">{t('templates.section.new')}</option>
        </Select>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {onNewProjectFromTemplate && (
            <Button variant="ghost" size="sm" disabled={opening !== null} onClick={() => void open(tpl)}>
              {opening === tpl.id ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="plus" size={14} />}
              {t('templates.newProjectFrom')}
            </Button>
          )}
          <span className="ml-auto flex items-center">
            <IconButton label={t('templates.rename')} variant="quiet" onClick={() => setRenaming(tpl.id)}>
              <Icon name="pencil" size={14} />
            </IconButton>
            <IconButton
              label={t('templates.delete')}
              variant="quiet"
              onClick={() => {
                if (!confirm(t('templates.deleteConfirm', { name: tpl.name }))) return
                deleteTemplate(tpl.id).then(
                  () => onTemplatesChange(latest.current.filter((x) => x.id !== tpl.id)),
                  (e) => setError(e instanceof Error ? e.message : String(e)),
                )
              }}
            >
              <Icon name="trash" size={14} />
            </IconButton>
          </span>
        </div>
      </div>
    </article>
  )

  return (
    <div className="space-y-8">
      {error && <Banner tone="danger">{error}</Banner>}

      <section>
        <div className="mb-3">
          <div className="kicker">
            {t('templates.directions')} <span className="text-ink-faint">({directions.length})</span>
          </div>
          <p className="mt-1 text-body-sm text-ink-faint">{t('templates.directionsHint')}</p>
        </div>
        {directions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-body-sm text-ink-faint">
            {t('templates.directionsEmpty')}
          </p>
        ) : (
          <div className={`grid gap-3 ${cols}`}>
            {directions.map((e) => {
              const isCurrent = !!currentDirection && e.markdown.trim() === currentDirection.trim()
              return (
                <article
                  key={e.id}
                  className={`overflow-hidden rounded-xl border bg-surface ${isCurrent ? 'border-accent ring-1 ring-accent/50' : 'border-line-soft'}`}
                >
                  <Swatch markdown={e.markdown} name={e.name} />
                  <div className="px-3 py-2.5">
                    {renaming === e.id ? (
                      <InlineName
                        initial={e.name}
                        onDone={(name) => {
                          if (name) renameDesignEntry(e.id, name)
                          setRenaming(null)
                          onDirectionsChanged()
                        }}
                      />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-body font-medium text-ink" title={e.name}>
                          {e.name}
                        </span>
                        {isCurrent && <Icon name="check" size={14} className="text-accent" />}
                      </div>
                    )}
                    {isCurrent && <div className="mt-0.5 text-caption text-accent-ink">{t('templates.current')}</div>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {onApplyDirection && (
                        <Button variant="ghost" size="sm" disabled={isCurrent} onClick={() => onApplyDirection(e.markdown)}>
                          {t('templates.applyHere')}
                        </Button>
                      )}
                      {onNewProjectWithDirection && (
                        <Button variant="ghost" size="sm" onClick={() => onNewProjectWithDirection(e)}>
                          <Icon name="plus" size={14} />
                          {t('templates.newProjectWith')}
                        </Button>
                      )}
                      <span className="ml-auto flex items-center">
                        <IconButton label={t('design.rename')} variant="quiet" onClick={() => setRenaming(e.id)}>
                          <Icon name="pencil" size={14} />
                        </IconButton>
                        <IconButton
                          label={t('design.deleteEntry')}
                          variant="quiet"
                          onClick={() => {
                            if (!confirm(t('design.deleteEntryConfirm', { name: e.name }))) return
                            deleteDesignEntry(e.id)
                            onDirectionsChanged()
                          }}
                        >
                          <Icon name="trash" size={14} />
                        </IconButton>
                      </span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3">
          <div className="kicker">
            {t('templates.templates')} <span className="text-ink-faint">({templates.length})</span>
          </div>
          <p className="mt-1 text-body-sm text-ink-faint">{t('templates.templatesHint')}</p>
          <p className="mt-1 text-body-sm text-ink-faint">{t('templates.section.hint')}</p>
        </div>
        {templatesFailed ? (
          <Banner tone="warn">{t('templates.loadFailed')}</Banner>
        ) : templates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-body-sm text-ink-faint">
            {t('templates.templatesEmpty')}
          </p>
        ) : (
          <div className="space-y-6">
            {sections.map((sec) => (
              <div key={sec.name} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 border-b border-line-soft pb-1.5">
                  <Icon name="folder" size={14} className="text-accent-ink" />
                  {renamingSection === sec.name ? (
                    <InlineName
                      initial={sec.name}
                      onDone={(name) => {
                        setRenamingSection(null)
                        if (name) void renameSection(sec.name, name)
                      }}
                    />
                  ) : (
                    <span className="text-body font-medium text-ink">{sec.name}</span>
                  )}
                  <span className="text-caption text-ink-faint">
                    {t('templates.section.count', { count: sec.templates.length, screens: sec.templates.reduce((n, x) => n + x.screenCount, 0) })}
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    {onNewProjectFromTemplate && (
                      <Button variant="ghost" size="sm" disabled={opening !== null} onClick={() => void openSection(sec)}>
                        {opening === `section:${sec.name}` ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="plus" size={14} />}
                        {t('templates.section.newProject')}
                      </Button>
                    )}
                    <IconButton label={t('templates.section.rename')} variant="quiet" onClick={() => setRenamingSection(sec.name)}>
                      <Icon name="pencil" size={14} />
                    </IconButton>
                    <IconButton
                      label={t('templates.section.ungroup')}
                      variant="quiet"
                      onClick={() => {
                        if (confirm(t('templates.section.ungroupConfirm', { name: sec.name }))) void renameSection(sec.name, '')
                      }}
                    >
                      <Icon name="close" size={14} />
                    </IconButton>
                  </span>
                </div>
                <div className={`grid gap-3 ${cols}`}>{sec.templates.map((tpl) => card(tpl))}</div>
              </div>
            ))}
            {loose.length > 0 && (
              <div className="space-y-2">
                {sections.length > 0 && <div className="border-b border-line-soft pb-1.5 text-caption text-ink-faint">{t('templates.section.loose')}</div>}
                <div className={`grid gap-3 ${cols}`}>{loose.map((tpl) => card(tpl))}</div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * Name a project's template, then keep it on the server.
 *
 * Says what is kept and what is not before saving, because "template" alone
 * does not answer whether the notes or the versions come along.
 */
export function SaveTemplateDialog({
  project,
  onClose,
  onSaved,
}: {
  project: Project
  onClose: () => void
  onSaved?: (template: TemplateSummary) => void
}) {
  const t = useT()
  const [name, setName] = useState(project.name)
  const [section, setSection] = useState('')
  const { list: existing } = useTemplates()
  const sectionNames = useMemo(() => templateSections(existing).sections.map((x) => x.name), [existing])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<TemplateSummary | null>(null)

  async function save() {
    if (busy || !name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const draft = { ...templateFromProject(project, name, activeGlobalDesign()), ...(section.trim() ? { section: section.trim() } : {}) }
      const out = await saveTemplate(draft)
      setSaved(out)
      onSaved?.(out)
      // The pictures, after: a template is kept even when a screen cannot be photographed.
      void saveTemplateThumbs(out.id, { ...draft, id: out.id, createdAt: out.createdAt, updatedAt: out.updatedAt })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('templates.saveAs')} onClose={onClose} size="sm">
      {saved ? (
        <>
          <Banner tone="ok">{t('templates.saved', { name: saved.name })}</Banner>
          <div className="mt-4">
            <Button variant="primary" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </>
      ) : (
        <>
          {error && (
            <div className="mb-3">
              <Banner tone="danger">{error}</Banner>
            </div>
          )}
          <p className="mb-3 text-body-sm text-ink-muted">{t('templates.saveHint')}</p>
          <Field label={t('templates.name')}>
            {(p) => (
              <Input
                {...p}
                autoFocus
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void save()
                }}
              />
            )}
          </Field>
          <div className="mt-3">
            <Field label={t('templates.sectionField')} hint={t('templates.sectionFieldHint')}>
              {(p) => (
                <>
                  <Input {...p} list="mocky-template-sections" value={section} onChange={(e) => setSection(e.currentTarget.value)} />
                  <datalist id="mocky-template-sections">
                    {sectionNames.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={() => void save()} disabled={busy || !name.trim()}>
              {busy ? t('templates.saving') : t('common.save')}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}

/**
 * The first composer's "From my designs": saved directions and templates in one
 * row, beside the style presets. A direction sets this project's direction; a
 * template fills this (empty) project. What either DOES is the caller's — this
 * only says which one was chosen, loading a template's code first.
 */
export function FromMyDesigns({
  onDirection,
  onTemplate,
  disabled = false,
}: {
  onDirection: (markdown: string) => void
  onTemplate: (template: ProjectTemplate) => void
  disabled?: boolean
}) {
  const t = useT()
  const directions = useMemo(() => listDesigns(), [])
  const { list: templates } = useTemplates()
  const { sections } = useMemo(() => templateSections(templates), [templates])
  const [opening, setOpening] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (directions.length === 0 && templates.length === 0) return null

  async function pickSection(section: TemplateSection) {
    setOpening(`section:${section.name}`)
    setError(null)
    try {
      onTemplate(await loadSection(section))
    } catch (e) {
      setError(t('templates.openFailed', { reason: e instanceof Error ? e.message : String(e) }))
    } finally {
      setOpening(null)
    }
  }

  async function pickTemplate(summary: TemplateSummary) {
    setOpening(summary.id)
    setError(null)
    try {
      onTemplate(await getTemplate(summary.id))
    } catch (e) {
      setError(t('templates.openFailed', { reason: e instanceof Error ? e.message : String(e) }))
    } finally {
      setOpening(null)
    }
  }

  const tile = 'group shrink-0 rounded-xl border border-line-soft bg-surface p-2 text-left transition hover:border-accent hover:bg-ink/5 disabled:opacity-50'
  return (
    <div className="rule-thin mt-6 pb-2 sm:pb-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-center">
        <span className="kicker">{t('templates.fromMine')}</span>
        <span className="text-caption text-ink-faint">{t('templates.fromMineHint')}</span>
      </div>
      {error && (
        <div className="mb-2">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sections.map((sec) => (
          <button
            key={`section:${sec.name}`}
            type="button"
            disabled={disabled || opening !== null}
            onClick={() => void pickSection(sec)}
            title={t('templates.section.useTitle', { count: sec.templates.length, name: sec.name })}
            className={tile}
            style={{ width: 168 }}
          >
            <TileImage tpl={sec.templates[0]} />
            <div className="mt-1.5 flex items-center gap-1 text-caption font-medium text-ink-muted transition group-hover:text-accent-ink">
              {opening === `section:${sec.name}` ? <Spinner className="h-3 w-3" /> : <Icon name="folder" size={12} />}
              <span className="truncate">{sec.name}</span>
            </div>
            <div className="truncate text-caption text-ink-faint">
              {t('templates.section.kind')} · {t('templates.section.count', { count: sec.templates.length, screens: sec.templates.reduce((n, x) => n + x.screenCount, 0) })}
            </div>
          </button>
        ))}
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            disabled={disabled || opening !== null}
            onClick={() => void pickTemplate(tpl)}
            title={t('templates.useTemplateTitle', { count: tpl.screenCount, name: tpl.name })}
            className={tile}
            style={{ width: 148 }}
          >
            <TileImage tpl={tpl} />
            <div className="mt-1.5 flex items-center gap-1 text-caption font-medium text-ink-muted transition group-hover:text-accent-ink">
              {opening === tpl.id ? <Spinner className="h-3 w-3" /> : <Icon name="grid" size={12} />}
              <span className="truncate">{tpl.name}</span>
            </div>
            <div className="truncate text-caption text-ink-faint">
              {t('templates.kindTemplate')} · {screensLabel(t, tpl.screenCount)}
            </div>
          </button>
        ))}
        {directions.map((d) => (
          <button
            key={d.id}
            type="button"
            disabled={disabled || opening !== null}
            onClick={() => onDirection(d.markdown)}
            title={t('templates.useDirectionTitle', { name: d.name })}
            className={tile}
            style={{ width: 148 }}
          >
            <MiniPalette markdown={d.markdown} />
            <div className="mt-1.5 truncate text-caption font-medium text-ink-muted transition group-hover:text-accent-ink">{d.name}</div>
            <div className="truncate text-caption text-ink-faint">{t('templates.kindDirection')}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

/** A template's first picture in a composer tile, or its direction's colours. */
function TileImage({ tpl }: { tpl?: TemplateSummary }) {
  const sid = tpl?.thumbs?.[0]
  if (!tpl || !sid) return <MiniPalette markdown={tpl?.design} />
  return <img src={templateThumbUrl(tpl.id, sid, tpl.updatedAt)} alt="" loading="lazy" className="h-10 w-full rounded-md bg-sunken object-cover object-top" />
}

/** Four bands of a direction's colours, like the style presets beside it. */
function MiniPalette({ markdown }: { markdown?: string }) {
  const p = useMemo(() => (markdown ? previewFromMarkdown(markdown) : null), [markdown])
  if (!p) return <div className="h-10 rounded-md bg-sunken" />
  return (
    <div className="flex h-10 overflow-hidden rounded-md" style={{ background: p.bg }}>
      <span className="flex-1" style={{ background: p.cardBg }} />
      <span className="flex-1" style={{ background: p.accent }} />
      <span className="flex-1" style={{ background: p.text }} />
      <span className="flex-1" style={{ background: p.mutedText }} />
    </div>
  )
}
