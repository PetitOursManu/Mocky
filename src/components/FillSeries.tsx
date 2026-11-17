import { useEffect, useMemo, useState } from 'react'
import { Banner, Button, Icon, Select, Textarea } from '../ui'
import { useT } from '../i18n'
import { locate, type FillCandidate, type FillField } from '../lib/fillFields'
import { guessMapping, parseTable, seriesRows, seriesTemplate, SERIES_MAX, type SeriesMapping, type SeriesPicture, type Table } from '../lib/fillSeries'
import { listLibrary } from '../lib/imageLibrary'
import { downloadBlob } from '../lib/docExport/files'

export const SERIES_FORM = 'mocky-fill-series'

/**
 * The "Série" tab of "Remplir…" (lib/fillSeries.ts): a table in, one filled
 * copy per row out. The person brings the table (a file, or a block pasted
 * from a spreadsheet), checks which column fills which field, and sees what
 * will be made before anything is — including the rows that will be skipped
 * and the pictures the library does not know.
 */
export default function FillSeries({
  cands,
  fields,
  screenName,
  onSetup,
  onSeries,
}: {
  cands: FillCandidate[]
  fields: FillField[]
  screenName: string
  onSetup: () => void
  onSeries: (rows: { label: string; values: Record<string, string> }[]) => void
}) {
  const t = useT()
  const [source, setSource] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const table: Table | null = useMemo(() => (source.trim() ? parseTable(source) : null), [source])
  const [mapping, setMapping] = useState<SeriesMapping>({})
  const [nameColumn, setNameColumn] = useState(-1)
  const [library, setLibrary] = useState<SeriesPicture[]>([])

  // A new table is a new guess: the columns it has are not the last one's.
  useEffect(() => {
    if (!table) return
    setMapping(guessMapping(fields, table.headers))
    setNameColumn(-1)
  }, [table, fields])

  const needsLibrary = fields.some((f) => f.kind === 'image' && (mapping[f.id] ?? -1) >= 0)
  useEffect(() => {
    if (!needsLibrary) return
    const ctl = new AbortController()
    listLibrary({}, ctl.signal)
      .then((imgs) => setLibrary(imgs.map((i) => ({ hash: i.hash, prompt: i.prompt, createdAt: i.createdAt }))))
      .catch(() => {})
    return () => ctl.abort()
  }, [needsLibrary])

  const rows = useMemo(() => (table ? seriesRows(table, fields, mapping, library, nameColumn) : []), [table, fields, mapping, library, nameColumn])
  const made = rows.filter((r) => Object.keys(r.values).length > 0)
  const kept = made.slice(0, SERIES_MAX)
  const empty = rows.length - made.length
  const unknown = rows.flatMap((r) => r.unknownPictures.map((p) => `${p} (${t('fill.series.line', { n: r.line })})`))

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

  const downloadTemplate = () => {
    const current = fields.map((f) => {
      const at = locate(cands, f)
      return at ? (f.kind === 'image' ? at.value : at.text) : ''
    })
    const csv = seriesTemplate(fields, current)
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${screenName.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'serie'}.csv`)
  }

  return (
    <form
      id={SERIES_FORM}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (kept.length) onSeries(kept.map((r) => ({ label: r.label, values: r.values })))
      }}
    >
      <p className="text-body-sm text-ink-muted">{t('fill.series.help')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="quiet" onClick={downloadTemplate}>
          <Icon name="download" size={14} />
          {t('fill.series.template')}
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-soft px-2.5 py-1.5 text-body-sm text-ink hover:bg-sunken focus-within:ring-2 focus-within:ring-accent">
          <Icon name="upload" size={14} />
          {fileName ?? t('fill.series.file')}
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              void file.text().then((text) => {
                setFileName(file.name)
                setSource(text)
              })
            }}
          />
        </label>
      </div>
      <Textarea
        rows={4}
        className="w-full font-mono text-caption"
        aria-label={t('fill.series.paste')}
        placeholder={t('fill.series.paste')}
        value={source}
        onChange={(e) => {
          setFileName(null)
          setSource(e.target.value)
        }}
      />
      {source.trim() && !table && <Banner tone="warn">{t('fill.series.unreadable')}</Banner>}
      {table && (
        <>
          <fieldset className="space-y-1.5">
            <legend className="kicker mb-1">{t('fill.series.columns')}</legend>
            {fields.map((f) => (
              <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                <label htmlFor={`mocky-series-${f.id}`} className="truncate text-body-sm text-ink">
                  {f.label}
                </label>
                <Select
                  id={`mocky-series-${f.id}`}
                  className="w-full text-body-sm"
                  value={String(mapping[f.id] ?? -1)}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.id]: Number((e.target as HTMLSelectElement).value) }))}
                >
                  <option value="-1">{t('fill.series.keep')}</option>
                  {table.headers.map((h, i) => (
                    <option key={i} value={String(i)}>
                      {h}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 pt-1">
              <label htmlFor="mocky-series-name" className="truncate text-body-sm text-ink-muted">
                {t('fill.series.nameColumn')}
              </label>
              <Select
                id="mocky-series-name"
                className="w-full text-body-sm"
                value={String(nameColumn)}
                onChange={(e) => setNameColumn(Number((e.target as HTMLSelectElement).value))}
              >
                <option value="-1">{t('fill.series.nameAuto')}</option>
                {table.headers.map((h, i) => (
                  <option key={i} value={String(i)}>
                    {h}
                  </option>
                ))}
              </Select>
            </div>
          </fieldset>
          <div className="rounded-lg border border-line-soft p-2.5 text-body-sm">
            <p className="font-medium text-ink">{t('fill.series.summary', { n: kept.length, rows: table.rows.length })}</p>
            {kept.length > 0 && (
              <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-caption text-ink-muted">
                {kept.map((r) => (
                  <li key={r.line} className="truncate">
                    {t('fill.series.line', { n: r.line })} — {t('fill.copyName', { name: screenName, value: r.label })}
                  </li>
                ))}
              </ul>
            )}
            {empty > 0 && <p className="mt-1 text-caption text-ink-faint">{t('fill.series.empty', { n: empty })}</p>}
            {made.length > SERIES_MAX && <p className="mt-1 text-caption text-warn">{t('fill.series.tooMany', { max: SERIES_MAX, n: made.length - SERIES_MAX })}</p>}
            {unknown.length > 0 && (
              <p className="mt-1 text-caption text-warn">{t('fill.series.unknownPictures', { names: unknown.slice(0, 6).join(', ') + (unknown.length > 6 ? '…' : '') })}</p>
            )}
          </div>
        </>
      )}
    </form>
  )
}
