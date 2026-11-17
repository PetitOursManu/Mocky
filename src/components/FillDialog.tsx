import { useEffect, useMemo, useState } from 'react'
import { Banner, Button, Checkbox, Icon, Input, Modal, Segmented, Spinner } from '../ui'
import { useT } from '../i18n'
import { defaultLabel, fillCandidates, locate, type FillCandidate, type FillField } from '../lib/fillFields'
import { imageUrl } from '../lib/imageLibrary'
import { newId } from '../lib/project'
import { ImagePicker } from './ImagePicker'
import FillSeries, { SERIES_FORM } from './FillSeries'

type Tab = 'fill' | 'setup' | 'series'

/**
 * "Remplir…" from a screen's menu (lib/fillFields.ts). Two tabs, because they
 * are two moments: choosing ONCE which words and pictures change, then filling
 * them every week. A screen with no field opens on the first, every other on
 * the second.
 *
 * The dialog writes nothing itself: it hands the fields, or the values, to
 * ProjectView, which owns the write-back conventions (Revert, notes, a copy
 * beside the screen).
 */
export default function FillDialog({
  screenName,
  code,
  fields,
  projectId,
  onSaveFields,
  onFill,
  onSeries,
  onClose,
}: {
  screenName: string
  code: string
  fields: FillField[]
  projectId: string
  onSaveFields: (fields: FillField[] | undefined) => void
  onFill: (values: Record<string, string>, into: 'copy' | 'here') => void
  onSeries: (rows: { label: string; values: Record<string, string> }[]) => void
  onClose: () => void
}) {
  const t = useT()
  const [tab, setTab] = useState<Tab>(fields.length ? 'fill' : 'setup')
  const [cands, setCands] = useState<FillCandidate[] | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void fillCandidates(code).then((c) => live && setCands(c))
    return () => {
      live = false
    }
  }, [code])

  return (
    <Modal
      title={t('fill.title', { name: screenName })}
      size="md"
      onClose={onClose}
      footer={
        cands ? (
          tab === 'setup' ? (
            <SetupFooter onCancel={onClose} />
          ) : tab === 'series' ? (
            <SeriesFooter onCancel={onClose} />
          ) : (
            <FillFooter onCancel={onClose} />
          )
        ) : null
      }
    >
      <div className="mb-3">
        <Segmented<Tab>
          label={t('fill.title', { name: screenName })}
          value={tab}
          onChange={(v) => v && setTab(v)}
          options={[
            { value: 'fill', label: t('fill.tabFill') },
            { value: 'setup', label: t('fill.tabSetup') },
            { value: 'series', label: t('fill.series.tab') },
          ]}
        />
      </div>
      {error && <Banner tone="warn">{error}</Banner>}
      {cands === undefined ? (
        <Spinner className="h-5 w-5" />
      ) : cands === null ? (
        <Banner tone="warn">{t('fill.unparsable')}</Banner>
      ) : tab === 'series' ? (
        <FillSeries
          cands={cands}
          fields={fields}
          screenName={screenName}
          onSetup={() => setTab('setup')}
          onSeries={(rows) => {
            onSeries(rows)
            onClose()
          }}
        />
      ) : tab === 'setup' ? (
        <Setup
          cands={cands}
          fields={fields}
          onSave={(next) => {
            onSaveFields(next.length ? next : undefined)
            if (next.length) setTab('fill')
            else onClose()
          }}
        />
      ) : (
        <Fill
          cands={cands}
          fields={fields}
          projectId={projectId}
          onSetup={() => setTab('setup')}
          onError={setError}
          onFill={(values, into) => {
            onFill(values, into)
            onClose()
          }}
        />
      )}
    </Modal>
  )
}

/* The footers are forms' submit buttons, so each tab owns its own action and the
   Modal's footer only carries Cancel plus a button pointing at that form. */
const SETUP_FORM = 'mocky-fill-setup'
const FILL_FORM = 'mocky-fill-values'

function SetupFooter({ onCancel }: { onCancel: () => void }) {
  const t = useT()
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button variant="primary" type="submit" form={SETUP_FORM}>
        <Icon name="check" size={16} />
        {t('fill.saveFields')}
      </Button>
    </>
  )
}

function FillFooter({ onCancel }: { onCancel: () => void }) {
  const t = useT()
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button variant="quiet" type="submit" form={FILL_FORM} name="into" value="here">
        {t('fill.here')}
      </Button>
      <Button variant="primary" type="submit" form={FILL_FORM} name="into" value="copy">
        <Icon name="copy" size={16} />
        {t('fill.copy')}
      </Button>
    </>
  )
}

function SeriesFooter({ onCancel }: { onCancel: () => void }) {
  const t = useT()
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button variant="primary" type="submit" form={SERIES_FORM}>
        <Icon name="copy" size={16} />
        {t('fill.series.create')}
      </Button>
    </>
  )
}

const keyOf = (c: Pick<FillCandidate, 'kind' | 'value' | 'nth'>) => `${c.kind}:${c.nth}:${c.value}`

function Setup({ cands, fields, onSave }: { cands: FillCandidate[]; fields: FillField[]; onSave: (fields: FillField[]) => void }) {
  const t = useT()
  // What is ticked, by candidate, with its label — starting from the fields
  // this screen already has, so a second visit edits rather than restarts.
  const [picked, setPicked] = useState<Map<string, { id: string; label: string }>>(() => {
    const m = new Map<string, { id: string; label: string }>()
    for (const f of fields) {
      const c = locate(cands, f)
      if (c) m.set(keyOf(c), { id: f.id, label: f.label })
    }
    return m
  })
  const lost = fields.filter((f) => !locate(cands, f))

  if (!cands.length) return <p className="text-body-sm text-ink-muted">{t('fill.noCandidates')}</p>

  return (
    <form
      id={SETUP_FORM}
      onSubmit={(e) => {
        e.preventDefault()
        // In the order the page says them, which is the order the form asks.
        onSave(
          cands.flatMap((c) => {
            const p = picked.get(keyOf(c))
            return p ? [{ id: p.id, label: p.label.trim() || defaultLabel(c, t('fill.picture')), kind: c.kind, value: c.value, nth: c.nth }] : []
          }),
        )
      }}
    >
      <p className="mb-3 text-body-sm text-ink-muted">{t('fill.setupHelp')}</p>
      {lost.length > 0 && <Banner tone="warn">{t('fill.lost', { names: lost.map((f) => f.label).join(', ') })}</Banner>}
      <ul className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
        {cands.map((c) => {
          const k = keyOf(c)
          const p = picked.get(k)
          return (
            <li key={k} className={`rounded-lg border px-2.5 py-2 ${p ? 'border-accent/60 bg-accent/5' : 'border-line-soft'}`}>
              <Checkbox
                checked={!!p}
                onChange={(on) =>
                  setPicked((m) => {
                    const next = new Map(m)
                    if (on) next.set(k, { id: newId(), label: defaultLabel(c, t('fill.picture')) })
                    else next.delete(k)
                    return next
                  })
                }
              >
                <span className="flex min-w-0 items-center gap-2">
                  {c.kind === 'image' && <img src={imageUrl(c.value)} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />}
                  <span className="min-w-0 truncate text-body-sm">{c.kind === 'image' ? c.text || t('fill.picture') : c.text}</span>
                </span>
              </Checkbox>
              {p && (
                <Input
                  className="mt-1.5 w-full text-caption"
                  value={p.label}
                  aria-label={t('fill.labelOf', { text: c.text })}
                  placeholder={t('fill.labelPlaceholder')}
                  onChange={(e) => setPicked((m) => new Map(m).set(k, { ...p, label: e.target.value }))}
                />
              )}
            </li>
          )
        })}
      </ul>
    </form>
  )
}

function Fill({
  cands,
  fields,
  projectId,
  onSetup,
  onError,
  onFill,
}: {
  cands: FillCandidate[]
  fields: FillField[]
  projectId: string
  onSetup: () => void
  onError: (message: string) => void
  onFill: (values: Record<string, string>, into: 'copy' | 'here') => void
}) {
  const t = useT()
  const placed = useMemo(() => fields.map((f) => ({ field: f, at: locate(cands, f) })), [cands, fields])
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(placed.flatMap(({ field, at }) => (at ? [[field.id, field.kind === 'image' ? at.value : at.text]] : []))),
  )
  const [picking, setPicking] = useState<string | null>(null)

  if (!fields.length) {
    return (
      <div className="space-y-3">
        <p className="text-body-sm text-ink-muted">{t('fill.noFields')}</p>
        <Button size="sm" onClick={onSetup}>
          {t('fill.tabSetup')}
        </Button>
      </div>
    )
  }

  return (
    <form
      id={FILL_FORM}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
        onFill(values, submitter?.value === 'here' ? 'here' : 'copy')
      }}
    >
      <p className="text-body-sm text-ink-muted">{t('fill.fillHelp')}</p>
      {placed.map(({ field, at }) => (
        <div key={field.id}>
          <label className="mb-1 block text-body-sm font-medium text-ink" htmlFor={`mocky-fill-${field.id}`}>
            {field.label}
          </label>
          {!at ? (
            <p className="text-caption text-warn">{t('fill.missing')}</p>
          ) : field.kind === 'text' ? (
            <Input
              id={`mocky-fill-${field.id}`}
              className="w-full"
              value={values[field.id] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
            />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <img src={imageUrl(values[field.id] ?? at.value)} alt="" className="h-16 w-16 rounded object-cover" />
                <Button id={`mocky-fill-${field.id}`} size="sm" variant="quiet" onClick={() => setPicking((p) => (p === field.id ? null : field.id))}>
                  <Icon name="image" size={14} />
                  {t('fill.changePicture')}
                </Button>
              </div>
              {picking === field.id && (
                <ImagePicker
                  projectId={projectId}
                  heading={t('fill.pickFor', { label: field.label })}
                  selected={[values[field.id] ?? at.value]}
                  compact
                  onPick={(hash) => {
                    setValues((v) => ({ ...v, [field.id]: hash }))
                    setPicking(null)
                  }}
                  onError={onError}
                />
              )}
            </div>
          )}
        </div>
      ))}
    </form>
  )
}
