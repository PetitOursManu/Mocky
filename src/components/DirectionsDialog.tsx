import { useEffect, useRef, useState } from 'react'
import { avoidFrom, proposeDirections, type DirectionProposals, type ProposedDirection } from '../lib/directions'
import { previewFromMarkdown } from './DesignLibrary'
import { ScaledMockup } from './DesignMockup'
import { useServedStack } from './DesignWebPreview'
import { Banner, Button, Field, Modal, Spinner, Textarea } from '../ui'
import { useT } from '../i18n'

/**
 * Three art directions for the brief, side by side, and the one picked becomes
 * the project's (`lib/directions.ts`, `server/muse/inspire/directions.js`).
 *
 * A card shows what a direction LOOKS like before what it is called: the
 * mock-up every saved design gets (`ScaledMockup`), the two faces drawn in
 * themselves, the palette. Nothing is generated until one is chosen — choosing
 * is a write of the project's direction, like adopting a saved design, and the
 * next screen follows it.
 */
export default function DirectionsDialog({
  brief: initialBrief,
  projects,
  projectId,
  hasDirection,
  creative,
  onChoose,
  onClose,
}: {
  brief: string
  /** The account's projects: their directions are what the proposals avoid. */
  projects: { id: string; design?: string; updatedAt?: number }[]
  projectId: string
  /** The project already has one, and choosing replaces it. */
  hasDirection: boolean
  creative?: boolean
  onChoose: (d: ProposedDirection) => void
  onClose: () => void
}) {
  const t = useT()
  const [brief, setBrief] = useState(initialBrief)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DirectionProposals | null>(null)
  const abort = useRef<AbortController | null>(null)
  useEffect(() => () => abort.current?.abort(), [])

  async function propose() {
    if (!brief.trim() || busy) return
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setBusy(true)
    setError(null)
    try {
      const out = await proposeDirections(brief.trim(), { avoid: avoidFrom(projects, projectId), creative, signal: ctrl.signal })
      if (!ctrl.signal.aborted) setResult(out)
    } catch (err) {
      if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (!ctrl.signal.aborted) setBusy(false)
    }
  }

  function choose(d: ProposedDirection) {
    if (hasDirection && !confirm(t('directions.replaceConfirm', { name: d.name }))) return
    onChoose(d)
  }

  return (
    <Modal
      title={t('directions.title')}
      onClose={onClose}
      size="full"
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t('directions.close')}
        </Button>
      }
    >
      <p className="measure text-body-sm text-ink-muted">{t('directions.intro')}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label={t('directions.brief')} className="flex-1">
          {(p) => <Textarea {...p} rows={2} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={t('directions.briefPlaceholder')} />}
        </Field>
        <Button variant={result ? 'ghost' : 'primary'} onClick={() => void propose()} disabled={!brief.trim() || busy}>
          {busy ? <Spinner /> : null} {t(result ? 'directions.again' : 'directions.propose')}
        </Button>
      </div>
      {error && (
        <Banner tone="danger" className="mt-3">
          {t('directions.failed', { detail: error })}
        </Banner>
      )}
      {result?.source === 'patterns' && (
        <Banner tone="info" className="mt-3">
          {t('directions.fromPatterns')}
        </Banner>
      )}
      {busy && !result && (
        <p className="mt-4 flex items-center gap-2 text-body-sm text-ink-faint">
          <Spinner /> {t('directions.busy')}
        </p>
      )}
      {result && (
        <div className={`mt-5 grid gap-4 ${result.directions.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`} style={{ opacity: busy ? 0.5 : 1 }}>
          {result.directions.map((d, i) => (
            <DirectionCard key={`${i}-${d.name}`} d={d} onChoose={() => choose(d)} />
          ))}
        </div>
      )}
    </Modal>
  )
}

function DirectionCard({ d, onChoose }: { d: ProposedDirection; onChoose: () => void }) {
  const t = useT()
  const preview = previewFromMarkdown(d.markdown)
  const display = useServedStack(d.display)
  const body = useServedStack(d.body)
  return (
    <article className="flex flex-col border border-line-soft">
      {preview && <ScaledMockup p={preview} name={d.name} />}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="text-h3 text-ink" style={{ fontFamily: display }}>
          {d.name}
        </h3>
        {d.school && <p className="kicker">{d.school}</p>}
        <p className="text-body-sm text-ink-muted" style={{ fontFamily: body }}>
          {d.concept}
        </p>
        <div className="mt-auto flex flex-wrap gap-1 pt-2" aria-label={t('directions.palette')}>
          {d.colors.map((c) => (
            <span key={`${c.label}-${c.hex}`} title={`${c.label} ${c.hex}`} className="block h-5 w-5 border border-line-soft" style={{ background: c.hex }} />
          ))}
        </div>
        <p className="text-caption text-ink-faint">{t('directions.faces', { display: d.display ?? '—', body: d.body ?? '—' })}</p>
        <Button variant="primary" size="sm" onClick={onChoose}>
          {t('directions.choose')}
        </Button>
      </div>
    </article>
  )
}
