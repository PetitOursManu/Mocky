import { useT } from '../i18n'
import { Icon } from '../ui'
import type { ProjectUltra } from '../lib/project'
import { ULTRA_IMAGE_COUNTS } from '../lib/ultra/storyboard'

/**
 * Motion Ultra in a composer — one component for both, so the first screen of a
 * project (Welcome) and the following ones (the bar) cannot disagree.
 *
 * Three states, each a different question:
 *  - off for the project → one quiet chip; clicking it turns the PROJECT on;
 *  - on → the chip is lit and clicking it PAUSES it here, for this session;
 *    the ×3 / ×6 choice sits beside it, with the cost in its title, so nobody
 *    learns what six pictures cost from the bill;
 *  - paused → the chip says so; clicking resumes.
 * Turning the project setting back off is the small ✕, and only reachable while
 * it is on — the one action here that undoes a project-level decision is never
 * the one under the thumb.
 */
export default function UltraControl({
  ultra,
  paused,
  onSetUltra,
  onTogglePause,
  videoAvailable = false,
  size = 14,
  className = '',
}: {
  ultra: ProjectUltra | undefined
  paused: boolean
  onSetUltra: (ultra: ProjectUltra | null) => void
  onTogglePause: () => void
  /** Whether this account can render a Motion `background` film right now. */
  videoAvailable?: boolean
  size?: number
  className?: string
}) {
  const t = useT()

  if (!ultra) {
    return (
      <button
        type="button"
        onClick={() => onSetUltra({ count: 3 })}
        className={`inline-flex items-center gap-1 text-ink-faint transition hover:text-ink-muted ${className}`}
        title={t('project.ultraEnableTitle')}
        aria-pressed={false}
      >
        <Icon name="film" size={size} />
        {t('project.ultraChip')}
      </button>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={onTogglePause}
        className={`inline-flex items-center gap-1 transition ${
          paused ? 'text-ink-faint hover:text-ink-muted' : 'text-accent-ink hover:opacity-80'
        }`}
        title={t(paused ? 'project.ultraPausedTitle' : 'project.ultraActiveTitle')}
        aria-pressed={!paused}
      >
        <Icon name="film" size={size} />
        {t('project.ultraChip')}
        {paused && <span>· {t('project.ultraPaused')}</span>}
      </button>
      {!paused && (
        <span role="group" aria-label={t('project.ultraChip')} className="inline-flex overflow-hidden rounded border border-line">
          {ULTRA_IMAGE_COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => onSetUltra({ ...ultra, count })}
              aria-pressed={ultra.count === count}
              title={t('project.ultraCountTitle', { count, minutes: count === 3 ? '1' : '2–3' })}
              className={`px-1.5 py-0.5 text-caption tabular-nums transition ${
                ultra.count === count ? 'bg-accent text-on-accent' : 'text-ink-muted hover:bg-ink/5'
              }`}
            >
              ×{count}
            </button>
          ))}
        </span>
      )}
      {/* The cost in plain sight, not only in a title: a tooltip is invisible on
          a touch screen and easy to miss everywhere else, and ×6 is six pictures
          on somebody's bill. */}
      {!paused && (
        <span className="text-caption tabular-nums text-ink-faint">
          {t('project.ultraCost', { minutes: ultra.count === 3 ? '1' : '2–3' })}
        </span>
      )}
      {/* The video background, off by default and said to cost what it costs.
          Offered only when a film can actually be rendered: a switch that turns
          on something the server cannot make is a promise nobody keeps. */}
      {!paused && videoAvailable && (
        <button
          type="button"
          onClick={() => onSetUltra({ ...ultra, video: !ultra.video })}
          aria-pressed={!!ultra.video}
          title={t('project.ultraVideoTitle')}
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-caption transition ${
            ultra.video ? 'border-accent bg-accent text-on-accent' : 'border-line text-ink-muted hover:bg-ink/5'
          }`}
        >
          <Icon name="play" size={11} />
          {t('project.ultraVideo')}
          {ultra.video && <span className="tabular-nums">{t('project.ultraVideoCost')}</span>}
        </button>
      )}
      <button
        type="button"
        onClick={() => onSetUltra(null)}
        className="inline-flex items-center rounded p-0.5 text-ink-faint transition hover:text-ink"
        title={t('project.ultraDisable')}
        aria-label={t('project.ultraDisable')}
      >
        <Icon name="close" size={12} />
      </button>
    </span>
  )
}
