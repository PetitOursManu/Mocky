import { useEffect, useMemo, useRef, useState } from 'react'
import { Banner, Button, Icon, IconButton, Panel, Spinner, Textarea } from '../ui'
import { useT } from '../i18n'
import { DocumentImageControl } from './ImageSourceControl'
import type { DocumentImageChoice } from '../lib/documentPictures'
import type { Project, Screen } from '../lib/project'
import {
  BRIEF_MAX,
  CAMPAIGN_FORMATS,
  CAMPAIGN_FORMAT_IDS,
  FACT_LABEL_MAX,
  FACT_VALUE_MAX,
  FACTS_MAX,
  factChanges,
  newFactId,
  sortFormats,
  type Campaign,
  type CampaignFact,
  type CampaignFormatId,
} from '../lib/campaign'

/** How a piece came out of the last update. */
export interface PieceResult {
  how: 'direct' | 'model' | 'failed'
  /** Pages whose content runs past the trim after the update. */
  overflow?: number[]
  error?: string
}

/**
 * The campaign, in the canvas' right-hand slot: the brief, its key facts, the
 * formats, and the pieces — with which ones a changed fact left behind.
 *
 * The panel only edits the BRIEF and decides; every run is the view's
 * (ProjectView owns the abort, the busy state and the write-back conventions,
 * like every other pass). The draft is saved as it is typed, a moment later,
 * so closing the panel never loses a fact.
 *
 * Out of date is READ, never stored: a piece is behind exactly when a fact it
 * was written with (`Screen.campaign`) no longer has that value. Changing the
 * date therefore lights up the pieces that said the old date, and only them —
 * a story that never showed the address is not "out of date" when it moves.
 */
export default function CampaignPanel({
  project,
  busy,
  progress,
  results,
  pictureChoice,
  pictureChoices,
  onPictureChoice,
  onSave,
  onReadFacts,
  onCreate,
  onUpdate,
  onFocus,
  onFit,
  onClose,
}: {
  project: Project
  /** Anything else is running: the panel's own runs wait. */
  busy: boolean
  /** What the running campaign step is doing, said in a line. */
  progress: string | null
  results: Record<string, PieceResult>
  pictureChoice: DocumentImageChoice
  pictureChoices: DocumentImageChoice[]
  onPictureChoice: (c: DocumentImageChoice) => void
  onSave: (campaign: Campaign) => void
  onReadFacts: (brief: string) => Promise<CampaignFact[] | null>
  onCreate: (campaign: Campaign, formats: CampaignFormatId[]) => void
  onUpdate: (campaign: Campaign, screenIds: string[]) => void
  onFocus: (screenId: string) => void
  onFit: (screenId: string) => void
  onClose: () => void
}) {
  const t = useT()
  const [draft, setDraft] = useState<Campaign>(() => project.campaign ?? { brief: '', facts: [], formats: [...CAMPAIGN_FORMAT_IDS] })
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Out-of-date pieces the person unticked; everything else out of date is ticked. */
  const [skipped, setSkipped] = useState<Set<string>>(new Set())

  // Saved a moment after typing stops, and on the way out.
  const saved = useRef(JSON.stringify(project.campaign ?? null))
  const latest = useRef(draft)
  latest.current = draft
  useEffect(() => {
    const json = JSON.stringify(draft)
    if (json === saved.current) return
    const id = window.setTimeout(() => {
      saved.current = json
      onSave(draft)
    }, 500)
    return () => window.clearTimeout(id)
  }, [draft, onSave])
  useEffect(
    () => () => {
      if (JSON.stringify(latest.current) !== saved.current) onSave(latest.current)
    },
    // Once, on unmount: the last draft is read off the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const pieces = useMemo(
    () =>
      project.screens
        .filter((s): s is Screen & { campaign: NonNullable<Screen['campaign']> } => !!s.campaign)
        .sort(
          (a, b) =>
            CAMPAIGN_FORMAT_IDS.indexOf(a.campaign.format) - CAMPAIGN_FORMAT_IDS.indexOf(b.campaign.format) ||
            a.createdAt - b.createdAt,
        ),
    [project.screens],
  )
  const stale = pieces.filter((p) => factChanges(draft.facts, p.campaign).length > 0)
  const chosen = stale.filter((p) => !skipped.has(p.id))
  const madeFormats = new Set(pieces.map((p) => p.campaign.format))
  const toMake = sortFormats(draft.formats.filter((f) => !madeFormats.has(f)))
  const locked = busy || reading || !!progress

  const setFacts = (facts: CampaignFact[]) => setDraft((d) => ({ ...d, facts }))
  const setFact = (id: string, patch: Partial<CampaignFact>) =>
    setFacts(draft.facts.map((f) => (f.id === id ? { ...f, ...patch } : f)))

  async function readFacts(): Promise<CampaignFact[] | null> {
    if (!draft.brief.trim()) return null
    setReading(true)
    setError(null)
    try {
      const read = await onReadFacts(draft.brief)
      if (!read) return null
      // Merged by label: a fact the brief still states keeps its id, so the
      // pieces written with it see a new VALUE rather than a new fact.
      const merged = [...draft.facts]
      for (const f of read) {
        const same = merged.findIndex((m) => m.label.toLowerCase() === f.label.toLowerCase())
        if (same >= 0) merged[same] = { ...merged[same], value: f.value }
        else if (merged.length < FACTS_MAX) merged.push(f)
      }
      setFacts(merged)
      if (!read.length) setError(t('campaign.noFactsRead'))
      return merged
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    } finally {
      setReading(false)
    }
  }

  async function create() {
    let facts = draft.facts
    // A brief with no facts yet is read first: the pieces are told to write
    // them verbatim, which is what makes an update cheap later.
    if (!facts.some((f) => f.value.trim()) && draft.brief.trim()) facts = (await readFacts()) ?? facts
    const next = { ...draft, facts }
    saved.current = JSON.stringify(next)
    onSave(next)
    onCreate(next, toMake)
  }

  return (
    <Panel
      title={t('campaign.panelTitle')}
      onClose={onClose}
      className="absolute right-4 top-11 flex max-h-[calc(100%-4rem)] w-[22rem] max-w-[calc(100vw-2rem)] flex-col rounded-xl shadow-2xl"
    >
      <div className="min-h-0 space-y-3 overflow-y-auto px-3 py-3">
        <p className="text-body-sm text-ink-muted">{t('campaign.intro')}</p>
        {error && <Banner tone="warn">{error}</Banner>}
        {progress && (
          <div className="flex items-center gap-2 text-body-sm text-ink" role="status">
            <Spinner className="h-4 w-4" />
            {progress}
          </div>
        )}

        {/* The brief */}
        <section className="space-y-2">
          <label htmlFor="campaign-brief" className="kicker">
            {t('campaign.brief')}
          </label>
          <Textarea
            id="campaign-brief"
            rows={4}
            maxLength={BRIEF_MAX}
            value={draft.brief}
            placeholder={t('campaign.briefPlaceholder')}
            onChange={(e) => setDraft((d) => ({ ...d, brief: e.target.value }))}
          />
        </section>

        {/* The key facts */}
        <section className="space-y-2 border-t border-line-soft pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="kicker">{t('campaign.facts')}</span>
            <Button size="sm" variant="quiet" disabled={locked || !draft.brief.trim()} onClick={() => void readFacts()}>
              {reading ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="wand" size={14} />}
              {t('campaign.readFacts')}
            </Button>
          </div>
          <p className="text-caption text-ink-faint">{t('campaign.factsHelp')}</p>
          {draft.facts.length === 0 ? (
            <p className="text-body-sm text-ink-faint">{t('campaign.factsEmpty')}</p>
          ) : (
            <ul className="space-y-1.5">
              {draft.facts.map((f) => (
                <li key={f.id} className="flex items-center gap-1.5">
                  <input
                    className="input w-24 shrink-0 text-caption"
                    value={f.label}
                    maxLength={FACT_LABEL_MAX}
                    aria-label={t('campaign.factLabel')}
                    onChange={(e) => setFact(f.id, { label: e.target.value })}
                  />
                  <input
                    className="input min-w-0 flex-1 text-body-sm"
                    value={f.value}
                    maxLength={FACT_VALUE_MAX}
                    aria-label={t('campaign.factValue', { label: f.label })}
                    onChange={(e) => setFact(f.id, { value: e.target.value })}
                  />
                  <IconButton
                    label={t('campaign.removeFact', { label: f.label })}
                    size="sm"
                    onClick={() => setFacts(draft.facts.filter((x) => x.id !== f.id))}
                  >
                    <Icon name="close" size={13} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          {draft.facts.length < FACTS_MAX && (
            <Button
              size="sm"
              variant="quiet"
              onClick={() => setFacts([...draft.facts, { id: newFactId(), label: t('campaign.newFactLabel'), value: '' }])}
            >
              <Icon name="plus" size={14} />
              {t('campaign.addFact')}
            </Button>
          )}
        </section>

        {/* The formats */}
        <section className="space-y-2 border-t border-line-soft pt-3">
          <span className="kicker">{t('campaign.formats')}</span>
          <ul className="space-y-1">
            {CAMPAIGN_FORMATS.map((f) => {
              const on = draft.formats.includes(f.id)
              const made = madeFormats.has(f.id)
              return (
                <li key={f.id}>
                  <label className="flex items-center gap-2 text-body-sm text-ink">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setDraft((d) => ({
                          ...d,
                          formats: on ? d.formats.filter((x) => x !== f.id) : sortFormats([...d.formats, f.id]),
                        }))
                      }
                    />
                    <span className="flex-1">{t(`campaign.format.${f.id}`)}</span>
                    {made && <span className="text-caption text-ok">{t('campaign.made')}</span>}
                  </label>
                </li>
              )
            })}
          </ul>
          {/* One picture for the campaign, made by the first piece: the choice
              the composer offers a document, shown here because it is where
              this run's paid picture is decided. */}
          <DocumentImageControl value={pictureChoice} choices={pictureChoices} onChange={onPictureChoice} className="text-body-sm" />
          {/* Nothing left to make is said in words below, not as a dead button. */}
          {(toMake.length > 0 || pieces.length === 0) && (
            <Button
              variant="primary"
              className="w-full"
              disabled={locked || !draft.brief.trim() || toMake.length === 0}
              onClick={() => void create()}
            >
              <Icon name="sparkle" size={15} />
              {pieces.length
                ? t('campaign.createMissing', { count: toMake.length })
                : t('campaign.create', { count: toMake.length })}
            </Button>
          )}
          <p className="text-caption text-ink-faint">
            {toMake.length
              ? t(pieces.length ? 'campaign.costMore' : 'campaign.cost', { count: toMake.length })
              : t('campaign.allMade')}
          </p>
        </section>

        {/* The pieces */}
        {pieces.length > 0 && (
          <section className="space-y-2 border-t border-line-soft pt-3">
            <span className="kicker">{t('campaign.pieces', { count: pieces.length })}</span>
            <ul className="space-y-1.5">
              {pieces.map((p) => {
                const changes = factChanges(draft.facts, p.campaign)
                const result = results[p.id]
                return (
                  <li key={p.id} className="rounded-lg border border-line-soft px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      {changes.length > 0 && (
                        <input
                          type="checkbox"
                          checked={!skipped.has(p.id)}
                          aria-label={t('campaign.updateThis', { name: p.name })}
                          onChange={() =>
                            setSkipped((s) => {
                              const next = new Set(s)
                              if (next.has(p.id)) next.delete(p.id)
                              else next.add(p.id)
                              return next
                            })
                          }
                        />
                      )}
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-body-sm text-ink hover:underline"
                        onClick={() => onFocus(p.id)}
                        title={t('campaign.show')}
                      >
                        {p.name}
                      </button>
                      <span className={`shrink-0 text-caption ${changes.length ? 'text-accent-ink' : 'text-ink-faint'}`}>
                        {changes.length ? t('campaign.stale') : t('campaign.upToDate')}
                      </span>
                    </div>
                    {changes.length > 0 && (
                      <p className="mt-0.5 text-caption text-ink-faint">
                        {changes.map((c) => t('campaign.change', { label: c.label, from: c.from || '—', to: c.to || '—' })).join(' · ')}
                      </p>
                    )}
                    {result && (
                      <p className={`mt-0.5 text-caption ${result.how === 'failed' ? 'text-danger' : 'text-ink-faint'}`}>
                        {t(`campaign.how.${result.how}`)}
                        {result.error ? ` — ${result.error}` : ''}
                      </p>
                    )}
                    {result?.overflow?.length ? (
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-caption text-accent-ink">
                          {t('campaign.overflow', { pages: result.overflow.join(', ') })}
                        </span>
                        <Button size="sm" disabled={locked} onClick={() => onFit(p.id)}>
                          {t('project.docFit')}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            {stale.length > 0 && (
              <>
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={locked || chosen.length === 0}
                  onClick={() => onUpdate(draft, chosen.map((p) => p.id))}
                >
                  <Icon name="refresh" size={15} />
                  {t('campaign.update', { count: chosen.length })}
                </Button>
                <p className="text-caption text-ink-faint">{t('campaign.updateHelp')}</p>
              </>
            )}
          </section>
        )}
      </div>
    </Panel>
  )
}
