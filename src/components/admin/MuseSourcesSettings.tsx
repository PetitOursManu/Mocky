import { useEffect, useState } from 'react'
import { api, type MuseSource, type MuseSourcesView } from '../../lib/api'
import { Button, Icon, IconButton, Input } from '../../ui'
import { useT } from '../../i18n'

type Row = Pick<MuseSource, 'url' | 'tags' | 'enabled'> & { key: string }

const toRows = (view: MuseSourcesView): Row[] =>
  view.sources.map((s) => ({
    key: s.id,
    url: s.url,
    tags: s.tags,
    enabled: s.enabled,
  }))

/**
 * The galleries Muse reads for inspiration, as the administrator sets them.
 *
 * They were a file in the repository, so retiring a gallery that started
 * refusing robots took a fork. The rows are web pages fetched behind the same
 * SSRF guard as every other address, which is why the panel asks for nothing
 * but a URL and the tags that decide when a page is chosen.
 *
 * Tags are toggled from the closed vocabulary the request classifier speaks:
 * a free-text tag nothing maps to would make a source that is never chosen,
 * silently.
 */
export default function MuseSourcesSettings() {
  const t = useT()
  const [view, setView] = useState<MuseSourcesView | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const apply = (v: MuseSourcesView) => {
    setView(v)
    setRows(toRows(v))
  }

  useEffect(() => {
    api.admin
      .museSources()
      .then(apply)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const dirty =
    view !== null && JSON.stringify(rows.map(({ key: _k, ...r }) => r)) !== JSON.stringify(toRows(view).map(({ key: _k, ...r }) => r))

  const update = (key: string, patch: Partial<Row>) => {
    setSaved(false)
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const add = () => {
    const url = draft.trim()
    if (!url) return
    let parsed: URL
    try {
      parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
    } catch {
      setError(t('settings.museSources.badUrl'))
      return
    }
    if (rows.some((r) => r.url === parsed.toString())) {
      setError(t('settings.museSources.duplicate'))
      return
    }
    const key = `new-${Date.now()}`
    setRows((rs) => [...rs, { key, url: parsed.toString(), tags: ['landing'], enabled: true }])
    setOpen(key)
    setDraft('')
    setError(null)
    setSaved(false)
  }

  const run = async (op: () => Promise<MuseSourcesView>) => {
    setBusy(true)
    setError(null)
    try {
      apply(await op())
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const head = (
    <header className="rule-thin mb-4 border-accent/40 pb-2">
      <span className="kicker text-muse-ink">Muse</span>
      <h3 className="mt-1 text-h3 text-ink">{t('settings.museSources.title')}</h3>
    </header>
  )

  if (!view) {
    return (
      <section>
        {head}
        <p className="text-body text-ink-faint">{error || t('common.loading')}</p>
      </section>
    )
  }

  const enabled = rows.filter((r) => r.enabled).length

  return (
    <section>
      {head}
      <p className="measure mb-3 text-body-sm text-ink-muted">{t('settings.museSources.blurb')}</p>
      <p className="mb-4 text-caption text-ink-muted">
        {view.custom ? t('settings.museSources.custom') : t('settings.museSources.shipped')} ·{' '}
        {t('settings.museSources.count', { n: enabled, total: rows.length })}
      </p>

      <ul className="divide-y divide-line-soft border-y border-line-soft">
        {rows.map((r) => (
          <li key={r.key} className="py-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-body-sm">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => update(r.key, { enabled: e.target.checked })}
                  aria-label={t('settings.museSources.enabled', { url: r.url })}
                />
              </label>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer noopener"
                className={`min-w-0 flex-1 truncate font-mono text-body-sm ${r.enabled ? 'text-ink' : 'text-ink-faint line-through'}`}
                title={r.url}
              >
                {r.url}
              </a>
              <button
                type="button"
                className="text-caption text-ink-muted underline-offset-2 hover:underline"
                aria-expanded={open === r.key}
                onClick={() => setOpen(open === r.key ? null : r.key)}
              >
                {r.tags.length ? r.tags.join(' · ') : t('settings.museSources.noTags')}
              </button>
              <IconButton
                label={t('settings.museSources.remove', { url: r.url })}
                onClick={() => {
                  setSaved(false)
                  setRows((rs) => rs.filter((x) => x.key !== r.key))
                }}
              >
                <Icon name="trash" size={16} />
              </IconButton>
            </div>
            {open === r.key && (
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t('settings.museSources.tagsFor', { url: r.url })}>
                {view.tags.map((tag) => {
                  const on = r.tags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        update(r.key, {
                          tags: on ? r.tags.filter((x) => x !== tag) : [...r.tags, tag],
                        })
                      }
                      className={`border px-2 py-0.5 text-caption transition ${
                        on ? 'border-muse bg-muse/10 text-muse-ink' : 'border-line-soft text-ink-muted hover:border-line'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            )}
          </li>
        ))}
        {rows.length === 0 && <li className="py-3 text-body-sm text-ink-faint">{t('settings.museSources.empty')}</li>}
      </ul>

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://…"
          aria-label={t('settings.museSources.newUrl')}
          className="min-w-[16rem] flex-1"
        />
        <Button type="submit" disabled={!draft.trim()}>
          <Icon name="plus" size={16} /> {t('settings.museSources.add')}
        </Button>
      </form>
      <p className="mt-2 text-caption text-ink-muted">{t('settings.museSources.tagsHint')}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={!dirty || busy} onClick={() => run(() => api.admin.saveMuseSources(rows))}>
          {t('common.save')}
        </Button>
        {view.custom && (
          <Button disabled={busy} onClick={() => run(() => api.admin.resetMuseSources())}>
            <Icon name="undo" size={16} /> {t('settings.museSources.reset')}
          </Button>
        )}
        {saved && !dirty && <span className="text-caption text-ok">{t('settings.museSources.saved')}</span>}
        {error && <span className="text-caption text-danger">{error}</span>}
      </div>
    </section>
  )
}
