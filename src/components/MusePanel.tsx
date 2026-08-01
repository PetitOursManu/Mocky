import type { MuseConfig, MuseResult, GeneratedSlotImage, MuseVideoAvailability } from '../lib/muse'
import { imageUrl, type PinnedImage } from '../lib/imageLibrary'
import { Button, Icon, Spinner } from '../ui'
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
 * The ✨ Muse panel: inspiration URLs + live-fetch opt-in, streamed stage, and a
 * mini moodboard of the last Design Dossier (concept, palette, copy, references,
 * generated images). Rendered inside the composer when Muse is enabled.
 *
 * No third-party image is ever shown (M2) — reference cards are text + palette
 * chips; only Mocky-generated images (served from /api/images) are displayed.
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
  onOpenLibrary: () => void
  pinned: PinnedImage[]
  onUnpin: (hash: string) => void
  /** Why an image slot stayed empty (bad model id, provider down, quota…). */
  imageError?: string | null
  /** null = not probed yet. false = the model refuses images. */
  vision?: boolean | null
  /** null = not probed, or no backend. Carries WHY when unavailable. */
  video?: MuseVideoAvailability | null
}) {
  const t = useT()
  const d = result?.dossier
  return (
    <div className="mb-2 rounded-xl border border-muse/40 bg-muse/5 p-2.5 text-body-sm">
      {/* Library access + pinned images */}
      <div className="mb-2 flex items-center gap-2">
        <span className="kicker text-muse">{t('muse.title')}</span>
        <Button variant="ghost" size="sm" onClick={onOpenLibrary}>
          <Icon name="library" size={16} />
          {t('muse.library')}
        </Button>
        {pinned.length > 0 && (
          <div className="flex flex-1 flex-wrap items-center gap-1">
            <span className="kicker">{t('muse.pinned')}</span>
            {pinned.map((p) => (
              <span key={p.hash} className="group relative h-7 w-9 overflow-hidden rounded border border-muse">
                <img src={imageUrl(p.hash)} alt={p.label} title={p.label} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onUnpin(p.hash)}
                  className="absolute inset-0 flex items-center justify-center bg-ink/60 text-surface opacity-0 transition group-hover:opacity-100"
                  aria-label={t('muse.unpinImage', { label: p.label })}
                  title={t('library.unpin')}
                >
                  <Icon name="close" size={14} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {imageError && (
        <div className="mb-2 rounded-lg border border-warn/40 bg-warn/10 px-2 py-1.5 text-warn">
          <span className="flex items-center gap-1.5">
            <Icon name="image" size={16} />
            {t('muse.imageFailed', { error: imageError })}
          </span>
          <span className="block text-caption text-warn/70">{t('muse.imageFailedHelp')}</span>
        </div>
      )}

      {available === false && (
        <div className="mb-2 rounded-lg border border-warn/40 bg-warn/10 px-2 py-1.5 text-warn">
          {t('muse.needsBackendPre')} <code>npm run dev:all</code> {t('muse.needsBackendPost')}
        </div>
      )}

      {/* Inspiration URLs + live-fetch opt-in */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <textarea
          rows={2}
          className="input min-h-[38px] flex-1 resize-none text-body-sm"
          placeholder={t('muse.urls')}
          value={config.urls}
          onChange={(e) => onChange({ ...config, urls: e.target.value })}
          disabled={busy}
        />
        <label
          className="flex shrink-0 cursor-pointer items-center gap-1.5 pt-1 text-ink-muted"
          title={t('muse.liveInspirationHint')}
        >
          <input
            type="checkbox"
            className="accent-accent"
            checked={config.useFetch}
            onChange={(e) => onChange({ ...config, useFetch: e.target.checked })}
            disabled={busy}
          />
          {t('muse.liveInspiration')}
        </label>
      </div>

      {/* What the generated image is for */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="kicker">{t('muse.imageMode')}</span>
        <span className="flex overflow-hidden border border-line-soft">
          <button
            type="button"
            onClick={() => onChange({ ...config, imageMode: 'content' })}
            disabled={busy}
            title={t('muse.modeContentHint')}
            className={`kicker border-b-2 px-2.5 py-1 ${
              config.imageMode === 'content'
                ? 'border-b-accent bg-ink text-surface'
                : 'border-b-transparent text-ink-muted hover:bg-ink/5'
            }`}
          >
            {t('muse.modeContent')}
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...config, imageMode: 'inspiration' })}
            disabled={busy || vision === false}
            title={vision === false ? t('muse.modeNeedsVision') : t('muse.modeInspirationHint')}
            className={`kicker border-b-2 border-l border-l-line-soft px-2.5 py-1 ${
              config.imageMode === 'inspiration'
                ? 'border-b-accent bg-ink text-surface'
                : 'border-b-transparent text-ink-muted hover:bg-ink/5'
            } ${vision === false ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            {t('muse.modeInspiration')}
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...config, imageMode: 'both' })}
            disabled={busy || vision === false}
            title={vision === false ? t('muse.modeNeedsVision') : t('muse.modeBothHint')}
            className={`kicker border-b-2 border-l border-l-line-soft px-2.5 py-1 ${
              config.imageMode === 'both'
                ? 'border-b-accent bg-ink text-surface'
                : 'border-b-transparent text-ink-muted hover:bg-ink/5'
            } ${vision === false ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            {t('muse.modeBoth')}
          </button>
        </span>
        {vision === true && (
          <span className="flex items-center gap-1 text-caption text-ok">
            <Icon name="check" size={14} />
            {t('muse.vision')}
          </span>
        )}
      </div>

      {/* The scroll sequence.
          A permanently greyed-out box teaches nothing, so when the instance is
          one prerequisite away the panel names which one — the two possible
          answers are fixed in two different places (Admin, or the container). */}
      {/* A chosen sequence outranks everything above: it is shown even when no
          provider is configured, because using one needs neither a key nor a
          generation — only ffmpeg, which already cut it. */}
      {config.videoPin ? (
        <div className="mt-2 flex items-center gap-2.5 border border-muse/50 bg-muse/5 p-2">
          <img
            src={config.videoPin.poster}
            alt=""
            className="h-12 w-20 shrink-0 border border-line-soft object-cover"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-muse">
              <Icon name="play" size={14} />
              {t('muse.videoChosenTitle')}
            </span>
            <span className="mt-0.5 block truncate text-caption text-ink-muted" title={config.videoPin.label}>
              {config.videoPin.label}
            </span>
            <span className="block text-caption text-ink-faint">
              {t('muse.videoChosenDetail', { count: config.videoPin.frames })}
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onChange({ ...config, videoPin: null })}
            title={t('muse.videoChosenDropHint')}
          >
            {t('muse.videoChosenDrop')}
          </Button>
        </div>
      ) : (
        video && (
          <div className="mt-2">
            <label
              className={`flex items-start gap-2 ${video.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
              title={video.available ? t('muse.videoHint') : undefined}
            >
              <input
                type="checkbox"
                className="mt-0.5 accent-accent"
                checked={config.video && video.available}
                onChange={(e) => onChange({ ...config, video: e.target.checked })}
                disabled={busy || !video.available}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-ink-muted">
                  <Icon name="play" size={14} />
                  {t('muse.video')}
                </span>
                <span className="mt-0.5 block text-caption text-ink-faint">
                  {video.available
                    ? t('muse.videoCost')
                    : video.reason === 'no-ffmpeg'
                      ? t('muse.videoNoFfmpeg')
                      : // ffmpeg is there, only the provider is missing — so
                        // GENERATING is off, but a clip the user imported still
                        // works. Saying only "no provider" reads as "feature
                        // unavailable" and hides a path that is open.
                        t('muse.videoNoProviderButImport')}
                </span>
              </span>
            </label>
            {/* The way in, stated where the decision is made. */}
            <button
              type="button"
              onClick={onOpenLibrary}
              className="mt-1 pl-6 text-caption text-ink-faint underline underline-offset-2 transition hover:text-accent-ink"
            >
              {t('muse.videoPickFromLibrary')}
            </button>
          </div>
        )
      )}

      {/* The saved choice is never rewritten — say plainly that THIS run will
          fall back, so the setting isn't silently undone behind the user. */}
      {vision === false && (
        <div className="mt-1.5 rounded-lg border border-warn/40 bg-warn/10 px-2 py-1.5 text-caption text-warn">
          {t('muse.noVision')}
          {config.imageMode !== 'content' ? (
            <>
              {' '}
              {t('muse.noVisionKeptPre', {
                mode: config.imageMode === 'both' ? t('muse.modeBoth') : t('muse.modeInspiration'),
              })}{' '}
              <strong>{t('muse.noVisionKeptWord')}</strong>
              {t('muse.noVisionKeptMid')} <strong>{t('muse.modeContent')}</strong>
              {t('muse.noVisionKeptPost')}
            </>
          ) : (
            ` ${t('muse.noVisionModes', {
              inspiration: t('muse.modeInspiration'),
              both: t('muse.modeBoth'),
            })}`
          )}
        </div>
      )}

      {/* Streamed stage */}
      {busy && stage && (
        <div className="mt-2 flex items-center gap-2 text-muse">
          <Spinner label={stage} />
          {stage}
        </div>
      )}

      {/* Moodboard */}
      {d && (
        <div className="mt-2.5 space-y-2 border-t border-line-soft pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="kicker flex items-center gap-1.5 text-muse">
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

          {/* Generated images (Mocky-origin only) */}
          {images.length > 0 && (
            <div className="space-y-1.5">
              {/* What these images are FOR. Without it there is no way to tell a
                  reference the model only looked at from one placed in the
                  screen — and so no way to check the mode did anything. */}
              <p className="kicker text-accent-ink">
                {config.imageMode === 'inspiration'
                  ? t('muse.imageRoleInspiration')
                  : config.imageMode === 'both'
                    ? t('muse.imageRoleBoth')
                    : t('muse.imageRoleContent')}
              </p>
              <div className="flex flex-wrap gap-2">
              {images.map((im) => (
                <div key={im.id} className="group relative h-16 w-24 overflow-hidden rounded-lg border border-line-soft bg-sunken">
                  <img src={im.url} alt={im.slot} className="h-full w-full object-cover" />
                  <span className="kicker absolute left-0 top-0 bg-ink/60 px-1 text-surface">{im.slot}</span>
                  <a
                    href={`${im.url}?download=1`}
                    className="absolute bottom-0 right-0 flex items-center bg-ink/60 p-1 text-surface opacity-0 transition group-hover:opacity-100"
                    aria-label={t('muse.downloadImage', { slot: im.slot })}
                    title={t('design.download')}
                  >
                    <Icon name="download" size={14} />
                  </a>
                </div>
              ))}
              </div>
            </div>
          )}

          {/* References (text only — M2) + notices */}
          {(result?.sources?.length || result?.patterns?.length) ? (
            <div className="flex flex-wrap items-center gap-1.5 text-caption text-ink-muted">
              <span className="kicker">{t('muse.sources')}</span>
              {result?.sources?.map((s) => (
                <span key={s.id} className="bg-ink/5 px-1.5 py-0.5" title={s.url}>
                  {domainOf(s.url)}
                </span>
              ))}
              {result?.patterns?.map((p) => (
                <span key={p.id} className="border border-line-soft px-1.5 py-0.5">
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
    </div>
  )
}
