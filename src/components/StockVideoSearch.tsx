import { useEffect, useRef, useState } from 'react'
import { Banner, Button, Icon, Input, Spinner } from '../ui'
import { useT } from '../i18n'
import {
  importStock,
  searchStock,
  stockStatus,
  STOCK_HOME,
  STOCK_LABELS,
  STOCK_PROVIDERS,
  type StockProvider,
  type StockResult,
} from '../lib/videoLibrary'
import { importStockImage, searchStockImages, stockImageStatus, type StockPhoto } from '../lib/stockImages'

/**
 * What differs between searching footage and searching photos: the three
 * calls, and the words. Everything else — the libraries, the keys, the credit,
 * the layout — is the same search, and one component keeps it that way.
 */
type Kind = 'video' | 'image'
type Hit = StockResult | (StockPhoto & { duration?: undefined; preview?: undefined })

const WORDS: Record<Kind, Record<'title' | 'placeholder' | 'providedBy' | 'licence' | 'importHint' | 'imported' | 'none', string>> = {
  video: {
    title: 'library.stockTitle',
    placeholder: 'library.stockPlaceholder',
    providedBy: 'library.stockProvidedBy',
    licence: 'library.stockLicence',
    importHint: 'library.stockImportHint',
    imported: 'library.stockImported',
    none: 'library.stockNone',
  },
  image: {
    title: 'library.stockImagesTitle',
    placeholder: 'library.stockImagesPlaceholder',
    providedBy: 'library.stockImagesProvidedBy',
    licence: 'library.stockImagesLicence',
    importHint: 'library.stockImagesImportHint',
    imported: 'library.stockImagesImported',
    none: 'library.stockImagesNone',
  },
}

/**
 * Search the free stock libraries an administrator turned on, and import one
 * clip into the library — where it becomes a sequence like any other, ready to
 * be chosen for a screen.
 *
 * Absent, not greyed out, when no library has a key: a search box that can
 * only answer "ask your administrator" is furniture on every visit. The
 * "provided by" line is not decoration either — both libraries ask for it.
 *
 * Results show the library's own thumbnails, loaded from its CDN, and a small
 * preview on hover. Nothing is stored until a person presses Import.
 */
export default function StockVideoSearch({
  projectId,
  onImported,
  kind = 'video',
}: {
  projectId?: string
  /** Called with the library hash of what was just imported. */
  onImported: (hash?: string) => void
  /** Footage (cut into a sequence) or photos (stored as a library image). */
  kind?: Kind
}) {
  const t = useT()
  const w = WORDS[kind]
  const [enabled, setEnabled] = useState<StockProvider[]>([])
  const [ffmpeg, setFfmpeg] = useState(true)
  const [provider, setProvider] = useState<StockProvider>('pexels')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Hit[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [searching, setSearching] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [imported, setImported] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const searchAbort = useRef<AbortController | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    const status =
      kind === 'image'
        ? stockImageStatus(ac.signal).then((s) => ({ ...s, ffmpeg: true }))
        : stockStatus(ac.signal)
    status
      .then((s) => {
        const on = STOCK_PROVIDERS.filter((p) => s.providers?.[p])
        setEnabled(on)
        // A photo is stored as it is; only footage needs ffmpeg to be cut.
        setFfmpeg(s.ffmpeg)
        if (on.length) setProvider(on[0])
      })
      .catch(() => {})
    return () => ac.abort()
  }, [kind])

  useEffect(() => () => searchAbort.current?.abort(), [])

  if (!enabled.length) return null

  async function run(nextPage: number) {
    const query = q.trim()
    if (!query) return
    searchAbort.current?.abort()
    const ac = new AbortController()
    searchAbort.current = ac
    setSearching(true)
    setError(null)
    try {
      const out =
        kind === 'image'
          ? await searchStockImages(provider, query, nextPage, ac.signal)
          : await searchStock(provider, query, nextPage, ac.signal)
      setResults((prev) => (nextPage === 1 ? out.results : [...prev, ...out.results]))
      setPage(out.page)
      setHasMore(out.hasMore)
      setSearched(true)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (searchAbort.current === ac) setSearching(false)
    }
  }

  async function onImport(r: Hit) {
    const key = `${r.provider}:${r.id}`
    setImporting(key)
    setError(null)
    try {
      const out =
        kind === 'image'
          ? await importStockImage(r.provider, r.id, { project: projectId })
          : await importStock(r.provider, r.id, { project: projectId })
      setImported((prev) => new Set(prev).add(key))
      onImported(out.hash)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setImporting(null)
    }
  }

  const switchTo = (p: StockProvider) => {
    if (p === provider) return
    setProvider(p)
    setResults([])
    setHasMore(false)
    setPage(1)
    setSearched(false)
  }

  return (
    <section className="mb-5 border border-line-soft p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="kicker flex items-center gap-1.5 text-accent-ink">
          <Icon name="search" size={14} />
          {t(w.title)}
        </span>
        {enabled.length > 1 && (
          <span className="inline-flex border border-line-soft" role="group" aria-label={t('library.stockLibrary')}>
            {enabled.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={p === provider}
                onClick={() => switchTo(p)}
                className={`kicker border-b-2 px-2 py-0.5 ${p === 'pixabay' ? 'border-l border-l-line-soft' : ''} ${
                  p === provider ? 'border-b-accent bg-ink text-surface' : 'border-b-transparent text-ink-muted hover:bg-ink/5'
                }`}
              >
                {STOCK_LABELS[p]}
              </button>
            ))}
          </span>
        )}
        <form
          className="flex min-w-[14rem] flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void run(1)
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(w.placeholder)}
            aria-label={t(w.placeholder)}
            maxLength={100}
            className="flex-1"
          />
          <Button type="submit" variant="ghost" size="sm" disabled={searching || !q.trim()}>
            {searching ? <Spinner /> : <Icon name="search" size={15} />}
            {t('library.stockSearch')}
          </Button>
        </form>
      </div>

      <p className="mt-1.5 text-caption text-ink-faint">
        {t(w.providedBy)}{' '}
        <a href={STOCK_HOME[provider]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {STOCK_LABELS[provider]}
        </a>
        {' — '}
        {t(w.licence)}
      </p>

      {!ffmpeg && (
        <Banner tone="warn" className="mt-2">
          {t('library.stockNoFfmpeg')}
        </Banner>
      )}
      {error && (
        <Banner tone="danger" className="mt-2">
          {error}
        </Banner>
      )}

      {results.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((r) => {
            const key = `${r.provider}:${r.id}`
            const done = imported.has(key)
            return (
              <div key={key} className="group overflow-hidden border border-line-soft bg-surface">
                <StockPreview result={r} kind={kind} />
                <div className="p-1.5">
                  <div className="truncate text-caption text-ink-muted" title={r.title}>
                    {r.title || `${STOCK_LABELS[r.provider]} ${r.id}`}
                  </div>
                  <div className="mt-0.5 truncate text-caption text-ink-faint">
                    {r.author &&
                      (r.authorUrl ? (
                        <a href={r.authorUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {r.author}
                        </a>
                      ) : (
                        r.author
                      ))}
                    {!!r.duration && r.duration > 0 && <span className="font-mono"> · {Math.round(r.duration)} s</span>}
                  </div>
                  <Button
                    variant={done ? 'ghost' : 'primary'}
                    size="sm"
                    className="mt-1.5 w-full"
                    disabled={done || importing !== null || !ffmpeg}
                    onClick={() => void onImport(r)}
                    title={t(w.importHint)}
                  >
                    {importing === key ? (
                      <>
                        <Spinner />
                        {t('library.stockImporting')}
                      </>
                    ) : done ? (
                      <>
                        <Icon name="check" size={14} />
                        {t(w.imported)}
                      </>
                    ) : (
                      <>
                        <Icon name="download" size={14} />
                        {t('library.stockImport')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {searched && !searching && results.length === 0 && error === null && (
        <p className="mt-3 text-body-sm text-ink-faint">{t(w.none)}</p>
      )}
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="ghost" size="sm" disabled={searching} onClick={() => void run(page + 1)}>
            {t('library.stockMore')}
          </Button>
        </div>
      )}
    </section>
  )
}

/**
 * The library's thumbnail, and its small preview playing while the pointer is
 * on it. The video element exists only while hovered: twenty-four previews
 * preloading at once would be megabytes nobody asked to download.
 */
function StockPreview({ result, kind }: { result: Hit; kind: Kind }) {
  const [hover, setHover] = useState(false)
  return (
    <a
      href={result.pageUrl || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`relative block w-full overflow-hidden bg-sunken ${kind === 'image' ? 'aspect-[4/3]' : 'aspect-[16/9]'}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      {result.thumbnail && (
        <img src={result.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      )}
      {hover && result.preview && (
        <video
          src={result.preview}
          muted
          autoPlay
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </a>
  )
}
