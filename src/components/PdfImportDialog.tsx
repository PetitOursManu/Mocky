import { useEffect, useRef, useState } from 'react'
import { Banner, Button, Checkbox, Icon, Modal, Spinner, Textarea } from '../ui'
import { useT } from '../i18n'
import { BRIEF_MAX } from '../lib/campaign'
import { PdfImportError, readPdf, releasePdfReading, type PdfPicture, type PdfReading } from '../lib/pdfImport'

/** What the person kept, handed to the campaign. */
export interface PdfImportResult {
  name: string
  text: string
  /** `insert`: placed in the pieces; `inspire`: a page, as a style reference. */
  pictures: { picture: PdfPicture; use: 'insert' | 'inspire' }[]
}

/**
 * The review between a PDF and a campaign (lib/pdfImport.ts): what was read,
 * shown before anything leaves the browser. The text is editable — it is the
 * brief — the pictures found are ticked by default, the pages are not.
 */
export default function PdfImportDialog({
  hasBrief,
  onUse,
  onClose,
}: {
  hasBrief: boolean
  onUse: (r: PdfImportResult) => void
  onClose: () => void
}) {
  const t = useT()
  const [reading, setReading] = useState<PdfReading | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [pictures, setPictures] = useState<Set<number>>(new Set())
  const [pages, setPages] = useState<Set<number>>(new Set())
  const abort = useRef<AbortController | null>(null)
  const latest = useRef<PdfReading | null>(null)
  latest.current = reading
  const kept = useRef(false)

  // The object URLs go with the dialog — unless they were handed on.
  useEffect(
    () => () => {
      abort.current?.abort()
      if (!kept.current) releasePdfReading(latest.current)
    },
    [],
  )

  async function read(file: File) {
    releasePdfReading(reading)
    setReading(null)
    setError(null)
    const ac = new AbortController()
    abort.current = ac
    setProgress(t('campaign.pdf.reading', { n: 1, total: 1 }))
    try {
      const r = await readPdf(file, { signal: ac.signal, onProgress: (n, total) => setProgress(t('campaign.pdf.reading', { n, total })) })
      setReading(r)
      setText(r.text)
      setPictures(new Set(r.pictures.map((_, i) => i)))
      setPages(new Set())
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      setError(t(`campaign.pdf.err.${e instanceof PdfImportError ? e.code : 'unreadable'}`))
    } finally {
      abort.current = null
      setProgress(null)
    }
  }

  const toggle = (set: Set<number>, i: number) => {
    const next = new Set(set)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    return next
  }

  function use() {
    if (!reading) return
    kept.current = true
    // What is not handed on is released now.
    reading.pictures.forEach((p, i) => !pictures.has(i) && URL.revokeObjectURL(p.url))
    reading.pageShots.forEach((p, i) => !pages.has(i) && URL.revokeObjectURL(p.url))
    onUse({
      name: reading.name,
      text: text.trim().slice(0, BRIEF_MAX),
      pictures: [
        ...reading.pictures.filter((_, i) => pictures.has(i)).map((picture) => ({ picture, use: 'insert' as const })),
        ...reading.pageShots.filter((_, i) => pages.has(i)).map((picture) => ({ picture, use: 'inspire' as const })),
      ],
    })
  }

  const grid = (list: PdfPicture[], chosen: Set<number>, set: (s: Set<number>) => void, label: (p: PdfPicture) => string) => (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {list.map((p, i) => (
        <li key={i} className="space-y-1">
          <button
            type="button"
            aria-pressed={chosen.has(i)}
            aria-label={label(p)}
            onClick={() => set(toggle(chosen, i))}
            className={`block w-full overflow-hidden rounded-md border-2 bg-sunken ${chosen.has(i) ? 'border-accent' : 'border-transparent opacity-60'}`}
          >
            <img src={p.url} alt="" className="aspect-square w-full object-contain" />
          </button>
          <Checkbox checked={chosen.has(i)} onChange={() => set(toggle(chosen, i))}>
            <span className="truncate">{label(p)}</span>
          </Checkbox>
        </li>
      ))}
    </ul>
  )

  return (
    <Modal title={t('campaign.pdf.title')} size="lg" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-1.5 text-body-sm text-ink hover:border-accent">
            <Icon name="upload" size={14} />
            {t('campaign.pdf.pick')}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={!!progress}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void read(f)
              }}
            />
          </label>
          {progress ? (
            <span className="inline-flex items-center gap-2 text-body-sm text-ink-muted">
              <Spinner className="h-4 w-4" />
              {progress}
            </span>
          ) : reading ? (
            <span className="text-body-sm text-ink-muted">
              {reading.name} · {t('campaign.pdf.pagesRead', { read: reading.read, pages: reading.pages })}
            </span>
          ) : (
            <span className="text-caption text-ink-faint">{t('campaign.pdf.drop')}</span>
          )}
        </div>
        {error && <Banner tone="warn">{error}</Banner>}

        {reading && (
          <>
            {reading.read < reading.pages && <Banner tone="info">{t('campaign.pdf.pagesCut', { read: reading.read })}</Banner>}
            {reading.scanned && <Banner tone="warn">{t('campaign.pdf.scanned')}</Banner>}
            <section className="space-y-1">
              <h3 className="text-body-sm font-medium text-ink">{t('campaign.pdf.text')}</h3>
              <p className="text-caption text-ink-muted">{t('campaign.pdf.textHelp')}</p>
              <Textarea rows={10} value={text} aria-label={t('campaign.pdf.text')} onChange={(e) => setText(e.target.value)} />
              <p className={`text-caption ${text.length > BRIEF_MAX ? 'text-warn' : 'text-ink-faint'}`}>
                {t('campaign.pdf.chars', { n: text.length, max: BRIEF_MAX })}
                {text.length > BRIEF_MAX ? ` — ${t('campaign.pdf.tooLong', { max: BRIEF_MAX })}` : ''}
              </p>
            </section>
            <section className="space-y-1">
              <h3 className="text-body-sm font-medium text-ink">{t('campaign.pdf.pictures')}</h3>
              {reading.pictures.length ? (
                grid(reading.pictures, pictures, setPictures, (p) => t('campaign.pdf.pictureLabel', { page: p.page, w: p.w, h: p.h }))
              ) : (
                <p className="text-caption text-ink-faint">{t('campaign.pdf.noPictures')}</p>
              )}
            </section>
            {reading.pageShots.length > 0 && (
              <section className="space-y-1">
                <h3 className="text-body-sm font-medium text-ink">{t('campaign.pdf.pages')}</h3>
                <p className="text-caption text-ink-muted">{t('campaign.pdf.pagesHelp')}</p>
                {grid(reading.pageShots, pages, setPages, (p) => t('campaign.pdf.pageLabel', { page: p.page }))}
              </section>
            )}
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft pt-3">
              {hasBrief && <span className="mr-auto text-caption text-warn">{t('campaign.pdf.replaces')}</span>}
              <Button onClick={onClose}>{t('campaign.pdf.cancel')}</Button>
              <Button variant="primary" disabled={!text.trim() && !pictures.size && !pages.size} onClick={use}>
                {t('campaign.pdf.use')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
