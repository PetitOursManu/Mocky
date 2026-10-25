import { useEffect, useState, type ReactNode } from 'react'
import type { MuseConfig, MuseResult, GeneratedSlotImage, MuseVideoAvailability } from '../lib/muse'
import { imageUrl, pinInserts, pinInspires, type PinnedImage } from '../lib/imageLibrary'
import { stockStatus } from '../lib/videoLibrary'
import { haptic } from '../lib/touch'
import type { MediaTab } from './Bibliotheque'
import { Button, Icon, IconButton, Spinner, type IconName } from '../ui'
import { useT } from '../i18n'

/** Domain of a URL, for reference chips (we show text only — never a third-party image, M2). */
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * The ✨ Muse panel: inspiration addresses, the person's own pictures with what
 * each is FOR, how many pictures the page gets, the clip, the streamed stage,
 * and a mini moodboard of the last Design Dossier (concept, palette, copy,
 * references, pictures). Rendered under the composer when Muse is on.
 *
 * Laid out as labelled rows since 2026-10. It was a lime frame around a kicker,
 * a "Bibliothèque" button, a textarea, an "Inspiration live" checkbox and a
 * three-way "Image générée" switch, one after the other: on a phone nothing in
 * it said what any control changed, and the switch asked people to decide what
 * ONE picture was for. Live inspiration is now simply what Muse does, and the
 * switch became two plainer questions — which of YOUR pictures are references
 * and which go in the page, and how many Muse should add (`MuseConfig`).
 *
 * No third-party image is ever shown (M2) — reference cards are text + palette
 * chips; only Mocky-served images (/api/images) are displayed.
 */
export default function MusePanel({
  config,
  onChange,
  available,
  result,
  images,
  stage,
  busy,
  onOpenLibrary,
  pinned,
  onUnpin,
  onPinChange,
  plateOn = false,
  imageError,
  vision,
  video,
}: {
  config: MuseConfig
  onChange: (c: MuseConfig) => void
  available: boolean | null
  result: MuseResult | null
  images: GeneratedSlotImage[]
  stage: string | null
  busy: boolean
  /** Opens Media; on the videos tab when the free-video choice asks for it. */
  onOpenLibrary: (tab?: MediaTab) => void
  pinned: PinnedImage[]
  onUnpin: (hash: string) => void
  /** Rewrites what a chosen picture is for (in the page, a reference, both). */
  onPinChange: (hash: string, use: { insert: boolean; inspire: boolean }) => void
  /** Whether this run will paint Muse's own mood plate (generated pictures are on and usable). */
  plateOn?: boolean
  /** Why an image slot stayed empty (bad model id, provider down, quota…). */
  imageError?: string | null
  /** null = not probed yet. false = the model refuses images. */
  vision?: boolean | null
  /** null = not probed, or no backend. Carries WHY when unavailable. */
  video?: MuseVideoAvailability | null
}) {
  const t = useT()
  const d = result?.dossier
  /*
   * Where the clip comes from, as a choice rather than a checkbox and a link.
   * The link was the only way to the free path, and a person who did not think
   * to click it never learned there was one. What the account may pick is the
   * administrator's decision (`video.access`), read off the server; an older
   * server that does not say allowed everything.
   */
  const access = video?.access ?? { generate: true, stock: true }
  const [stockOn, setStockOn] = useState(false)
  // Chosen "free" before any clip was picked: the choice must hold while Media
  // is open, or the row would snap back to "none" behind the dialog.
  const [picking, setPicking] = useState(false)
  useEffect(() => {
    if (!video || !access.stock) return
    const ac = new AbortController()
    stockStatus(ac.signal)
      .then((st) => setStockOn(st.allowed !== false && Boolean(st.providers?.pexels || st.providers?.pixabay)))
      .catch(() => {})
    return () => ac.abort()
  }, [video, access.stock])
  const generateReady = Boolean(video?.available)
  const source: 'off' | 'generate' | 'free' =
    config.videoPin || picking ? 'free' : config.video && generateReady ? 'generate' : 'off'
  // "Free" means the stock libraries when this account has them, and the
  // person's own clips either way; named for what it will actually offer.
  const stockReady = access.stock && stockOn
  const chooseSource = (next: 'off' | 'generate' | 'free') => {
    haptic()
    if (next === 'free') {
      setPicking(true)
      if (!config.videoPin) {
        onChange({ ...config, video: false })
        onOpenLibrary('videos')
      }
      return
    }
    setPicking(false)
    onChange({ ...config, video: next === 'generate', videoPin: null })
  }
  const sourceOptions = [
    { id: 'off' as const, label: t('muse.videoSourceOff'), hint: undefined, disabled: false },
    ...(access.generate
      ? [
          {
            id: 'generate' as const,
            label: t('muse.videoSourceGenerated'),
            hint: generateReady
              ? t('muse.videoSourceGeneratedHint')
              : video?.reason === 'no-ffmpeg'
                ? t('muse.videoNoFfmpeg')
                : t('muse.videoGenerateOff'),
            disabled: !generateReady,
          },
        ]
      : []),
    {
      id: 'free' as const,
      label: t(stockReady ? 'muse.videoSourceFree' : 'muse.videoSourceMine'),
      hint: t(stockReady ? 'muse.videoSourceFreeHint' : 'muse.videoSourceMineHint'),
      disabled: false,
    },
  ]
  /** Unticking the last box of a picture takes it out of the run. */
  const setUse = (p: PinnedImage, patch: { insert?: boolean; inspire?: boolean }) => {
    const next = { insert: pinInserts(p), inspire: pinInspires(p), ...patch }
    if (!next.insert && !next.inspire) onUnpin(p.hash)
    else onPinChange(p.hash, next)
  }
  const count = config.contentImages
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface text-body-sm shadow-sm">
      {/* A head that says what Muse IS, once. */}
      <header className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muse/15 text-muse-ink">
          <Icon name="sparkle" size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{t('muse.title')}</span>
          <span className="block text-caption leading-snug text-ink-faint">{t('muse.subtitle')}</span>
        </span>
        {vision === true && (
          <span
            className="hidden shrink-0 items-center gap-1 rounded-full bg-ok/10 px-2 py-0.5 text-caption text-ok sm:inline-flex"
            title={t('muse.visionTitle')}
          >
            <Icon name="check" size={13} />
            {t('muse.vision')}
          </span>
        )}
      </header>

      {(imageError || available === false) && (
        <div className="space-y-2 border-b border-line-soft px-4 py-3">
          {imageError && (
            <div className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-warn">
              <span className="flex items-center gap-1.5">
                <Icon name="image" size={16} />
                {t('muse.imageFailed', { error: imageError })}
              </span>
              <span className="block text-caption text-warn/70">{t('muse.imageFailedHelp')}</span>
            </div>
          )}
          {available === false && (
            <div className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-warn">
              {t('muse.needsBackendPre')} <code>npm run dev:all</code> {t('muse.needsBackendPost')}
            </div>
          )}
        </div>
      )}

      <div className="divide-y divide-line-soft">
        {/* Inspiration is always fetched live now: the box that switched it on
            is gone, and only the person's own addresses are asked for. */}
        <MuseRow icon="globe" label={t('muse.inspirationLabel')} hint={t('muse.inspirationHint')}>
          <textarea
            rows={2}
            className="input min-h-[44px] w-full resize-none text-body-sm"
            placeholder={t('muse.urls')}
            value={config.urls}
            onChange={(e) => onChange({ ...config, urls: e.target.value })}
            disabled={busy}
          />
        </MuseRow>

        {/* The person's own pictures, each with what it is FOR. */}
        <MuseRow icon="library" label={t('muse.ownImages')} hint={t('muse.ownImagesHint')}>
          {pinned.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {pinned.map((p) => (
                <li key={p.hash} className="flex items-center gap-2.5 rounded-xl border border-line-soft bg-raised/60 p-1.5">
                  <img src={imageUrl(p.hash)} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-caption text-ink-muted" title={p.label}>
                      {p.label || t('muse.ownImageUntitled')}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-x-3">
                      <UseBox checked={pinInserts(p)} label={t('muse.useInsert')} disabled={busy} onChange={(v) => setUse(p, { insert: v })} />
                      <UseBox
                        checked={pinInspires(p)}
                        label={t('muse.useInspire')}
                        // A reference nobody can look at is a promise the run
                        // breaks; the box says so rather than greying out for no
                        // stated reason.
                        disabled={busy || vision === false}
                        title={vision === false ? t('muse.modeNeedsVision') : t('muse.useInspireHint')}
                        onChange={(v) => setUse(p, { inspire: v })}
                      />
                    </span>
                  </span>
                  <IconButton label={t('muse.unpinImage', { label: p.label })} variant="quiet" disabled={busy} onClick={() => onUnpin(p.hash)}>
                    <Icon name="close" size={15} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" size="sm" onClick={() => onOpenLibrary()} disabled={busy}>
            <Icon name="library" size={16} />
            {t(pinned.length ? 'muse.ownImagesMore' : 'muse.ownImagesPick')}
          </Button>
        </MuseRow>

        {/* How many pictures go IN the page. The mood plate is Muse's own and
            is not counted: it is never placed. */}
        <MuseRow icon="image" label={t('muse.contentImages')} hint={t(plateOn ? 'muse.contentImagesHintPlate' : 'muse.contentImagesHint')}>
          <div role="group" aria-label={t('muse.contentImages')} className="inline-flex flex-wrap gap-0.5 rounded-lg border border-line bg-raised p-0.5">
            {([null, 1, 2, 3, 4] as const).map((n) => {
              const on = count === n
              return (
                <button
                  key={String(n)}
                  type="button"
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => {
                    haptic()
                    onChange({ ...config, contentImages: n })
                  }}
                  title={n === null ? t('muse.contentImagesAutoHint') : undefined}
                  className={`tap-target inline-flex min-h-8 min-w-9 items-center justify-center rounded-md px-2.5 text-body-sm font-medium transition ${
                    on ? 'bg-selected text-on-selected' : 'text-ink-muted hover:bg-ink/5 hover:text-ink'
                  }`}
                >
                  {n === null ? t('muse.contentImagesAuto') : n}
                </button>
              )
            })}
          </div>
          {vision === false && <p className="mt-1.5 text-caption text-warn">{t('muse.noVisionPlate')}</p>}
        </MuseRow>

        {/* The video, and where it comes from. Shown only when this account may
            use at least one kind: a row of choices that are all refused is
            furniture. A generated option that cannot run says why under the row,
            so the free one beside it reads as the way that IS open. */}
        {video && (access.generate || access.stock) && (
          <MuseRow icon="film" label={t('muse.videoSource')} hint={t('muse.videoSourceHint')}>
            <span className="inline-flex flex-wrap gap-0.5 rounded-lg border border-line bg-raised p-0.5" role="group" aria-label={t('muse.videoSource')}>
              {sourceOptions.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={source === o.id}
                  onClick={() => chooseSource(o.id)}
                  disabled={busy || o.disabled}
                  title={o.hint}
                  className={`tap-target inline-flex min-h-8 items-center rounded-md px-2.5 text-body-sm font-medium transition ${
                    source === o.id ? 'bg-selected text-on-selected' : 'text-ink-muted hover:bg-ink/5 hover:text-ink'
                  } ${o.disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  {o.label}
                </button>
              ))}
            </span>

            {source === 'generate' && <p className="mt-1.5 text-caption text-ink-faint">{t('muse.videoCost')}</p>}

            {access.generate && !generateReady && source !== 'free' && video.reason !== 'no-access' && (
              <p className="mt-1.5 text-caption text-ink-faint">
                {video.reason === 'no-ffmpeg' ? t('muse.videoNoFfmpeg') : t('muse.videoNoProviderButImport')}
              </p>
            )}

            {source === 'free' && !config.videoPin && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-muse/50 p-2">
                <span className="min-w-0 flex-1 text-caption text-ink-muted">
                  {t(stockReady ? 'muse.videoFreePick' : 'muse.videoMinePick')}
                </span>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => onOpenLibrary('videos')}>
                  <Icon name="library" size={15} />
                  {t('muse.videoFreeButton')}
                </Button>
              </div>
            )}

            {config.videoPin && (
              <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-muse/50 bg-muse/5 p-2">
                <img src={config.videoPin.poster} alt="" className="h-12 w-20 shrink-0 rounded-lg border border-line-soft object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-muse-ink">
                    <Icon name="play" size={14} />
                    {t('muse.videoChosenTitle')}
                  </span>
                  <span className="mt-0.5 block truncate text-caption text-ink-muted" title={config.videoPin.label}>
                    {config.videoPin.label}
                  </span>
                  <span className="block text-caption text-ink-faint">
                    {t(config.videoPin.drive === 'pointer' ? 'muse.videoChosenDetailPointer' : 'muse.videoChosenDetail', {
                      count: config.videoPin.frames,
                    })}
                  </span>
                  {/* What steers the clip decides WHERE it can go: the scroll needs the
                      top of the page, the pointer goes wherever the prompt says. So
                      the choice is shown with the clip rather than buried in a menu. */}
                  <span className="mt-1 inline-flex rounded-md border border-line-soft" role="group" aria-label={t('muse.videoDrive')}>
                    {(['scroll', 'pointer'] as const).map((drive) => {
                      const on = (config.videoPin?.drive ?? 'scroll') === drive
                      return (
                        <button
                          key={drive}
                          type="button"
                          aria-pressed={on}
                          disabled={busy}
                          onClick={() => config.videoPin && onChange({ ...config, videoPin: { ...config.videoPin, drive } })}
                          title={t(drive === 'pointer' ? 'muse.videoDrivePointerHint' : 'muse.videoDriveScrollHint')}
                          className={`kicker px-2 py-0.5 ${drive === 'pointer' ? 'border-l border-l-line-soft' : ''} ${
                            on ? 'bg-selected text-on-selected' : 'text-ink-muted hover:bg-ink/5'
                          }`}
                        >
                          {t(drive === 'pointer' ? 'muse.videoDrivePointer' : 'muse.videoDriveScroll')}
                        </button>
                      )
                    })}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    // Still on "free": removing a clip is usually choosing another.
                    setPicking(true)
                    onChange({ ...config, videoPin: null, video: false })
                  }}
                  title={t('muse.videoChosenDropHint')}
                >
                  {t('muse.videoChosenDrop')}
                </Button>
              </div>
            )}
          </MuseRow>
        )}
      </div>

      {/* Streamed stage */}
      {busy && stage && (
        <div className="flex items-center gap-2 border-t border-line-soft px-4 py-3 text-muse-ink">
          <Spinner label={stage} />
          {stage}
        </div>
      )}

      {/* Moodboard */}
      {d && (
        <div className="space-y-2.5 border-t border-line-soft bg-raised/30 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="kicker flex items-center gap-1.5 text-muse-ink">
              <Icon name="sparkle" size={14} />
              {t('muse.dossier')}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-caption ${result?.source === 'llm' ? 'bg-ok/20 text-ok' : 'bg-ink/5 text-ink-muted'}`}>
              {result?.source === 'llm' ? t('muse.writtenByModel') : t('muse.offlinePatterns')}
            </span>
          </div>

          {d.concept && <p className="measure leading-snug text-ink">{d.concept}</p>}

          {/* Palette */}
          {d.tokens?.colors?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {d.tokens.colors.map((c, i) => (
                <span key={i} className="flex items-center gap-1 rounded-md border border-line-soft bg-surface py-0.5 pl-0.5 pr-1.5" title={`${c.label}: ${c.hex}`}>
                  <span className="h-4 w-4 rounded" style={{ backgroundColor: c.hex }} />
                  <span className="font-mono text-caption text-ink-muted">{c.hex}</span>
                </span>
              ))}
            </div>
          ) : null}

          {/* Copy */}
          {d.voice?.headline && (
            <div className="rounded-lg border border-line-soft bg-surface p-2">
              <div className="font-semibold text-ink">{d.voice.headline}</div>
              {d.voice.subheadline && <div className="text-ink-muted">{d.voice.subheadline}</div>}
              {d.voice.valueProps?.length ? (
                <ul className="mt-1 list-disc pl-4 text-ink-muted">
                  {d.voice.valueProps.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              ) : null}
              {d.voice.ctaLabels?.length ? (
                <div className="mt-1 flex gap-1.5">
                  {d.voice.ctaLabels.map((c, i) => (
                    <span key={i} className="rounded bg-ink px-2 py-0.5 text-caption font-medium text-surface">
                      {c}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* Pictures (Mocky-origin only) */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((im) => (
                <div key={im.id} className="group relative h-16 w-24 overflow-hidden rounded-lg border border-line-soft bg-sunken">
                  <img src={im.url} alt={im.slot} className="h-full w-full object-cover" />
                  {/* The plate is looked at, never placed: said on the picture,
                      or a person counting the page's pictures counts one too many. */}
                  <span className="kicker absolute left-0 top-0 bg-black/60 px-1 text-white">
                    {im.slot === 'inspiration' ? t('muse.plateLabel') : im.slot}
                  </span>
                  <a
                    href={`${im.url}?download=1`}
                    className="absolute bottom-0 right-0 flex items-center bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                    aria-label={t('muse.downloadImage', { slot: im.slot })}
                    title={t('design.download')}
                  >
                    <Icon name="download" size={14} />
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* References (text only — M2) + notices */}
          {(result?.sources?.length || result?.patterns?.length) ? (
            <div className="flex flex-wrap items-center gap-1.5 text-caption text-ink-muted">
              <span className="kicker">{t('muse.sources')}</span>
              {result?.sources?.map((s) => (
                <span key={s.id} className="rounded bg-ink/5 px-1.5 py-0.5" title={s.url}>
                  {domainOf(s.url)}
                </span>
              ))}
              {result?.patterns?.map((p) => (
                <span key={p.id} className="rounded border border-line-soft px-1.5 py-0.5">
                  {p.name}
                </span>
              ))}
            </div>
          ) : null}

          {result?.notices?.length ? (
            <div className="text-caption text-warn">{result.notices[result.notices.length - 1]}</div>
          ) : null}
        </div>
      )}
    </section>
  )
}

/**
 * One line of the panel: what the setting is, one sentence of what it changes,
 * and the control. Stacked on a phone, the label in its own column from `sm`.
 */
function MuseRow({ icon, label, hint, children }: { icon: IconName; label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:grid sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
      <div className="flex min-w-0 gap-2">
        <Icon name={icon} size={16} className="mt-0.5 shrink-0 text-muse-ink" />
        <span className="min-w-0">
          <span className="block font-medium text-ink">{label}</span>
          <span className="block text-caption leading-snug text-ink-faint">{hint}</span>
        </span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** A checkbox with its word, sized for a thumb and lime when ticked. */
function UseBox({
  checked,
  label,
  onChange,
  disabled,
  title,
}: {
  checked: boolean
  label: string
  onChange: (v: boolean) => void
  disabled?: boolean
  title?: string
}) {
  return (
    <label
      title={title}
      className={`tap-target inline-flex min-h-8 items-center gap-1.5 text-caption ${checked ? 'text-ink' : 'text-ink-muted'} ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
    >
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 accent-accent"
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          haptic()
          onChange(e.target.checked)
        }}
      />
      {label}
    </label>
  )
}
