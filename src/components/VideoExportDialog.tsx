import { useCallback, useEffect, useRef, useState } from 'react'
import { imageUrl } from '../lib/imageLibrary'
import {
  DURATION_STEP_MS,
  OVERLAY_MAX_LENGTH,
  addScene,
  clampDuration,
  draftBlockers,
  draftTotalMs,
  emptyDraft,
  formatSeconds,
  moveScene,
  removeScene,
  toTimelineInput,
  updateScene,
  type DraftBlocker,
  type DraftScene,
  type VideoDraft,
} from '../lib/video/draft'
import {
  POLL_INTERVAL_MS,
  VideoExportError,
  fetchVideoAccess,
  fetchVideoJob,
  pollDeadlinePassed,
  startVideoRender,
  videoDownloadUrl,
  type VideoAccess,
  type VideoJob,
} from '../lib/video/client'
import {
  ASPECT_RATIOS,
  KEN_BURNS,
  MAX_SCENE_DURATION_MS,
  MAX_SCENES,
  MAX_TOTAL_DURATION_MS,
  MIN_SCENE_DURATION_MS,
  OUTPUT_FORMATS,
  OVERLAY_POSITIONS,
  TRANSITIONS,
  type KenBurns,
  type OverlayPosition,
  type Transition,
} from '../lib/video/timeline'
import { ImagePicker } from './ImagePicker'
import { Banner, Button, ButtonLink, Field, Icon, IconButton, Input, Modal, Select, Spinner } from '../ui'
import { useLang, useT } from '../i18n'

export const MOTION_KEYS: Record<KenBurns, string> = {
  static: 'video.motionStatic',
  'zoom-in': 'video.motionZoomIn',
  'zoom-out': 'video.motionZoomOut',
  'pan-left': 'video.motionPanLeft',
  'pan-right': 'video.motionPanRight',
}

export const TRANSITION_KEYS: Record<Transition, string> = {
  crossfade: 'video.transitionCrossfade',
  'wipe-left': 'video.transitionWipeLeft',
  'wipe-right': 'video.transitionWipeRight',
  none: 'video.transitionNone',
}

export const OVERLAY_KEYS: Record<OverlayPosition, string> = {
  top: 'video.overlayTop',
  center: 'video.overlayCenter',
  bottom: 'video.overlayBottom',
}

/** What the panel shows instead of the button, when the button cannot fire. */
export const BLOCKER_KEYS: Record<DraftBlocker, string> = {
  'no-scenes': 'video.blockedEmpty',
  'too-many-scenes': 'video.blockedTooMany',
  'over-budget': 'video.budgetOver',
  'overlay-too-long': 'video.blockedOverlay',
}

/**
 * A refusal, as a heading and a next step — held as KEYS, not as sentences.
 *
 * Translating at the point of failure looked simpler and froze the banner in
 * whichever language was current when the render broke: switch to English with
 * the error on screen and everything around it changes while the one paragraph
 * that matters stays in French. It also dragged `t` into the polling effect's
 * dependencies, so a language switch restarted the poll and reset the deadline
 * with it.
 */
interface Failure {
  titleKey: string
  bodyKey?: string
  vars?: Record<string, string | number>
  /** The server's own sentence. English, and shown verbatim — see the banner. */
  detail?: string
  /** Image ids the library no longer has. */
  missing?: string[]
}

/**
 * Compose a video export and watch it render.
 *
 * Opened from the canvas toolbar rather than from a screen's context menu, and
 * that is a statement about what the feature is: the film is cut from the media
 * library, not from a screen. Hanging it off one screen's menu would have
 * promised a relationship — this screen becomes this video — that nothing in the
 * pipeline honours, and every scene picker in it would have ignored the screen
 * it was launched from.
 *
 * The founding rule of the feature applies here as much as anywhere: no string
 * this panel collects becomes JSX, CSS or a URL. Every control writes into one
 * field of a `VideoTimeline`, and a hand-written composition in the worker is
 * the only thing that ever turns those fields into pixels.
 */
export default function VideoExportDialog({
  projectId,
  jobId,
  onJobId,
  onClose,
}: {
  projectId?: string
  /**
   * A render this account started earlier in the session.
   *
   * Held by the parent, not here, because closing the panel must not lose a
   * render that is still running: the queue keeps working, the file lands in the
   * store, and without this the only way back to the download link would be a
   * job id nobody wrote down.
   */
  jobId: string | null
  onJobId: (id: string | null) => void
  onClose: () => void
}) {
  const t = useT()
  const [access, setAccess] = useState<VideoAccess | null>(null)
  const [accessFailed, setAccessFailed] = useState(false)
  const [draft, setDraft] = useState<VideoDraft>(emptyDraft)
  const [job, setJob] = useState<VideoJob | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [pollStumbled, setPollStumbled] = useState(false)
  const [starting, setStarting] = useState(false)

  // ---- access -----------------------------------------------------------

  useEffect(() => {
    const ctrl = new AbortController()
    fetchVideoAccess(ctrl.signal)
      .then(setAccess)
      .catch((e) => {
        // An abort is this component unmounting, not a failure to report.
        if ((e as { name?: string })?.name !== 'AbortError') setAccessFailed(true)
      })
    return () => ctrl.abort()
  }, [])

  // ---- polling ----------------------------------------------------------

  /** When this browser first saw the job rendering. See `pollDeadlinePassed`. */
  const renderingSince = useRef<number | null>(null)
  // The server's copy of the ceiling, not the bundled constant: /status quotes
  // it precisely so a panel and a schema cannot drift into disagreeing about
  // what "too long" means. The constant is only the answer before /status lands.
  const budgetMs = access?.limits.maxTotalDurationMs ?? MAX_TOTAL_DURATION_MS

  useEffect(() => {
    if (!jobId) return
    const ctrl = new AbortController()
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    renderingSince.current = null

    const again = () => {
      timer = setTimeout(tick, POLL_INTERVAL_MS)
    }

    async function tick() {
      if (!live) return
      try {
        const next = await fetchVideoJob(jobId!, ctrl.signal)
        if (!live) return
        setJob(next)
        setPollStumbled(false)
        // Done and error are terminal; polling past them is requests spent on
        // an answer that cannot change.
        if (next.status === 'done' || next.status === 'error') return
        if (next.status === 'rendering' && renderingSince.current === null) renderingSince.current = Date.now()
        if (pollDeadlinePassed(renderingSince.current, Date.now(), budgetMs)) {
          setFailure({ titleKey: 'video.errTimeout', bodyKey: 'video.errTimeoutHint', vars: { n: Math.round(budgetMs / 1000) } })
          return
        }
        again()
      } catch (e) {
        if (!live || ctrl.signal.aborted) return
        if (e instanceof VideoExportError && (e.code === 'not-found' || e.code === 'no-access')) {
          // Terminal too: the journal has forgotten this job, or it was never
          // ours. Retrying would poll a 404 for as long as the panel is open.
          setFailure(
            e.code === 'not-found'
              ? { titleKey: 'video.errJobGone', bodyKey: 'video.errJobGoneHint' }
              : { titleKey: 'video.errNoAccess' },
          )
          return
        }
        // Anything else is the network, and the network comes back. Saying so
        // quietly beats declaring the render dead over one dropped request.
        setPollStumbled(true)
        again()
      }
    }

    tick()
    return () => {
      // All three, and each covers a different way this leaks: `live` stops the
      // chain from scheduling itself again, `abort` drops a request that is
      // already out, and the timer is what would otherwise fire once more after
      // the dialog is gone and set state on an unmounted component.
      live = false
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [jobId, budgetMs])

  // ---- actions ----------------------------------------------------------

  const edit = useCallback((fn: (d: VideoDraft) => VideoDraft) => setDraft((d) => fn(d)), [])

  async function start() {
    setStarting(true)
    setFailure(null)
    setPollStumbled(false)
    try {
      const queued = await startVideoRender(toTimelineInput(draft))
      setJob(queued)
      onJobId(queued.id)
    } catch (e) {
      setFailure(describe(e))
    } finally {
      setStarting(false)
    }
  }

  function newCut() {
    setJob(null)
    setFailure(null)
    setPollStumbled(false)
    onJobId(null)
  }

  // ---- render -----------------------------------------------------------

  const body = (() => {
    if (accessFailed) return <Banner tone="warn">{t('video.statusUnknown')}</Banner>
    if (!access) {
      return (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )
    }
    // Nothing else: not the worker's state, not the scope, not the number of
    // accounts that do have it. An account without the feature has no business
    // learning how the instance is configured.
    if (!access.enabled) return <Banner tone="info">{t('video.notEnabled')}</Banner>

    const live = job?.status === 'queued' || job?.status === 'rendering'
    const workerDown = !access.worker.available

    return (
      <>
        <p className="measure text-body-sm text-ink-muted">{t('video.exportBlurb')}</p>

        {workerDown && (
          <Banner tone="warn" title={t('video.workerDown')} className="mt-3">
            {t('video.workerDownBody')}
          </Banner>
        )}

        {failure && (
          <Banner tone="danger" title={t(failure.titleKey, failure.vars)} className="mt-3">
            {failure.bodyKey && <p>{t(failure.bodyKey, failure.vars)}</p>}
            {/* The server's own words, kept verbatim. Rewriting them in the
                panel's voice is how a detail that names the actual file or host
                gets lost on the way to whoever has to fix it. */}
            {failure.detail && <p className="mt-1 font-mono text-caption text-ink-faint">{failure.detail}</p>}
            {failure.missing && failure.missing.length > 0 && (
              <ul className="mt-1 font-mono text-caption text-ink-faint">
                {failure.missing.map((id) => (
                  <li key={id}>{id.slice(0, 16)}…</li>
                ))}
              </ul>
            )}
          </Banner>
        )}

        {job && <JobPanel job={job} stumbled={pollStumbled} onNewCut={newCut} />}

        <div className="section-head mt-5">
          <span className="kicker text-accent-ink">{t('video.scenesTitle')}</span>
          <span className="ml-auto font-mono text-caption text-accent-ink">
            {t('video.sceneCount', { n: draft.scenes.length, max: MAX_SCENES })}
          </span>
        </div>

        {draft.scenes.length === 0 ? (
          <div className="border border-line-soft bg-ink/5 p-4">
            <p className="text-body text-ink">{t('video.noScenes')}</p>
            <p className="measure mt-1 text-body-sm text-ink-muted">{t('video.noScenesHint')}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {draft.scenes.map((scene, i) => (
              <SceneRow
                key={scene.key}
                scene={scene}
                index={i}
                isLast={i === draft.scenes.length - 1}
                disabled={live}
                onMove={(delta) => edit((d) => moveScene(d, scene.key, delta))}
                onRemove={() => edit((d) => removeScene(d, scene.key))}
                onPatch={(patch) => edit((d) => updateScene(d, scene.key, patch))}
              />
            ))}
          </ul>
        )}

        <div className="mt-3 border border-line-soft bg-ink/5 p-3">
          {draft.scenes.length >= MAX_SCENES ? (
            <p className="text-body-sm text-ink-faint">{t('video.addSceneFull', { max: MAX_SCENES })}</p>
          ) : (
            <ImagePicker
              projectId={projectId}
              heading={t('video.pickScene')}
              selected={draft.scenes.map((s) => s.imageId)}
              disabled={live}
              onPick={(hash) => edit((d) => addScene(d, hash))}
              onError={(message) => setFailure({ titleKey: 'common.error', detail: message })}
            />
          )}
        </div>

        <div className="section-head mt-5">
          <span className="kicker text-accent-ink">{t('video.output')}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('video.aspectRatio')}>
            {(p) => (
              <Select
                {...p}
                value={draft.aspectRatio}
                disabled={live}
                // Read BEFORE the updater, never inside it — see the note on
                // the container select below.
                onChange={(e) => {
                  const aspectRatio = e.currentTarget.value as VideoDraft['aspectRatio']
                  setDraft((d) => ({ ...d, aspectRatio }))
                }}
              >
                {ASPECT_RATIOS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('video.container')}>
            {(p) => (
              <Select
                {...p}
                value={draft.outputFormat}
                disabled={live}
                /**
                 * The value is read here, not inside the updater.
                 *
                 * A functional `setState` updater does not run when it is
                 * written — React calls it during the render pass that follows.
                 * By then the synthetic event has had `currentTarget` reset to
                 * null, because it only means anything while the event is
                 * propagating. `e.currentTarget.value` inside the updater
                 * therefore threw "Cannot read properties of null", took the
                 * whole dialog down through the error boundary, and did it on
                 * the first change of container — before anyone pressed Export.
                 *
                 * `e.target` would have survived, which is what makes this easy
                 * to write and easy to miss.
                 */
                onChange={(e) => {
                  const outputFormat = e.currentTarget.value as VideoDraft['outputFormat']
                  setDraft((d) => ({ ...d, outputFormat }))
                }}
              >
                {OUTPUT_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    .{f}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </>
    )
  })()

  /*
   * The total, the ceiling and the button live in the Modal's FOOTER, which is
   * `shrink-0` while the body scrolls.
   *
   * Put in the body they scroll away, and at twenty scenes they are a very long
   * way down — which is the same failure as checking the budget on click, only
   * slower: you compose the whole film with the one number that governs it out
   * of sight, and meet the refusal at the end. Pinned, the button greys out
   * under your hand the moment a slider crosses the line.
   */
  const footer = access?.enabled ? (
    <div className="w-full">
      <Budget total={draftTotalMs(draft)} max={budgetMs} blockers={draftBlockers(draft)} />
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        {job && job.status !== 'queued' && job.status !== 'rendering' && (
          <Button variant="ghost" size="sm" onClick={newCut}>
            {t('video.newCut')}
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={start}
          disabled={
            starting ||
            job?.status === 'queued' ||
            job?.status === 'rendering' ||
            !access.worker.available ||
            draftBlockers(draft).length > 0
          }
        >
          <Icon name="film" size={15} />
          {starting ? t('video.starting') : t('video.startRender')}
        </Button>
      </div>
    </div>
  ) : undefined

  return (
    <Modal title={t('video.exportTitle')} onClose={onClose} footer={footer} size="lg">
      {body}
    </Modal>
  )
}

/**
 * The running total against the ceiling.
 *
 * Not a check performed on click. Each per-scene slider looks reasonable while
 * the sum quietly passes two minutes, and learning that from a refusal — after
 * twenty scenes have been chosen, ordered and captioned — is the worst possible
 * moment for the information to arrive.
 */
function Budget({ total, max, blockers }: { total: number; max: number; blockers: DraftBlocker[] }) {
  const t = useT()
  const [lang] = useLang()
  const over = total - max
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="kicker text-ink">{t('video.budget')}</span>
        <span className={`font-mono text-body-sm ${over > 0 ? 'text-danger' : 'text-ink-muted'}`}>
          {t('video.budgetValue', { used: formatSeconds(total, lang), max: Math.round(max / 1000) })}
        </span>
      </div>
      {/* A bar, because "84 s of 120 s" is a number you have to read and this is
          a proportion you can see. `aria-hidden`: the same fact is already in
          the line above, in words. */}
      <div className="mt-1.5 h-1 w-full bg-ink/10" aria-hidden>
        <div
          className={`h-full ${over > 0 ? 'bg-danger' : 'bg-accent'}`}
          style={{ width: `${Math.min(100, (total / max) * 100)}%` }}
        />
      </div>
      {/* Only the first, when several hold at once: the list is ordered from
          "there is nothing to render" outwards, so the first is the one that has
          to be dealt with before any of the others can be seen to matter.

          An empty timeline is drawn muted rather than red. It is the state the
          dialog OPENS in, and a red line under a disabled button on a panel
          nobody has touched yet reads as something already broken. */}
      {blockers.length > 0 && (
        <p
          className={`measure mt-1.5 text-body-sm ${
            blockers[0] === 'no-scenes' ? 'text-ink-muted' : 'text-danger'
          }`}
        >
          {t(BLOCKER_KEYS[blockers[0]], {
            max: blockers[0] === 'overlay-too-long' ? OVERLAY_MAX_LENGTH : MAX_SCENES,
            over: formatSeconds(Math.max(0, over), lang),
          })}
        </p>
      )}
    </div>
  )
}

function SceneRow({
  scene,
  index,
  isLast,
  disabled,
  onMove,
  onRemove,
  onPatch,
}: {
  scene: DraftScene
  index: number
  isLast: boolean
  disabled: boolean
  onMove: (delta: number) => void
  onRemove: () => void
  onPatch: (patch: Partial<Omit<DraftScene, 'key'>>) => void
}) {
  const t = useT()
  const [lang] = useLang()
  const label = t('video.sceneNumber', { n: index + 1 })

  return (
    <li className="border border-line-soft bg-surface">
      <div className="flex items-start gap-3 p-2">
        <img
          src={imageUrl(scene.imageId)}
          alt=""
          className="h-16 w-24 shrink-0 border border-line-soft object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium text-ink">{label}</p>
          <p className="font-mono text-caption text-ink-faint">{scene.imageId.slice(0, 12)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label={t('video.moveUp')}
            variant="quiet"
            disabled={disabled || index === 0}
            onClick={() => onMove(-1)}
          >
            {/* `chevronDown` turned over, rather than a left/right glyph
                rotated: the kit has no `chevronUp`, and rotating a horizontal
                chevron by a quarter turn gets the direction wrong as often as
                right — the accessible name is on the button, but the arrow is
                what everyone actually reads. */}
            <Icon name="chevronDown" size={16} className="rotate-180" />
          </IconButton>
          <IconButton
            label={t('video.moveDown')}
            variant="quiet"
            disabled={disabled || isLast}
            onClick={() => onMove(1)}
          >
            <Icon name="chevronDown" size={16} />
          </IconButton>
          <IconButton label={t('video.removeScene')} variant="quiet" disabled={disabled} onClick={onRemove}>
            <Icon name="trash" size={16} />
          </IconButton>
        </div>
      </div>

      <div className="grid gap-3 border-t border-line-soft p-3 sm:grid-cols-3">
        {/*
          A slider, not a number box.
          The schema takes 1 000–15 000 ms and the model's document is refused
          outright when it strays outside — no clamping, no repair. A control
          that cannot express 40 seconds in the first place is how that rule is
          honoured on this side without ever having to correct anything the user
          typed.
        */}
        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between text-body-sm font-medium text-ink">
            {t('video.duration')}
            <output className="font-mono text-caption text-ink-muted">
              {t('video.seconds', { n: formatSeconds(scene.durationMs, lang) })}
            </output>
          </span>
          <input
            type="range"
            className="w-full accent-accent disabled:opacity-50"
            min={MIN_SCENE_DURATION_MS}
            max={MAX_SCENE_DURATION_MS}
            step={DURATION_STEP_MS}
            value={scene.durationMs}
            disabled={disabled}
            aria-label={`${label} — ${t('video.duration')}`}
            onChange={(e) => onPatch({ durationMs: clampDuration(Number(e.currentTarget.value)) })}
          />
        </label>

        <Field label={t('video.motion')}>
          {(p) => (
            <Select
              {...p}
              value={scene.kenBurns}
              disabled={disabled}
              onChange={(e) => onPatch({ kenBurns: e.currentTarget.value as KenBurns })}
            >
              {KEN_BURNS.map((k) => (
                <option key={k} value={k}>
                  {t(MOTION_KEYS[k])}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={t('video.transition')} hint={isLast ? t('video.transitionLast') : undefined}>
          {(p) => (
            <Select
              {...p}
              value={scene.transitionOut}
              disabled={disabled}
              onChange={(e) => onPatch({ transitionOut: e.currentTarget.value as Transition })}
            >
              {TRANSITIONS.map((tr) => (
                <option key={tr} value={tr}>
                  {t(TRANSITION_KEYS[tr])}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label={t('video.overlay')}
          className="sm:col-span-2"
          hint={t('video.overlayCount', { n: scene.overlayText.length, max: OVERLAY_MAX_LENGTH })}
        >
          {(p) => (
            <Input
              {...p}
              value={scene.overlayText}
              disabled={disabled}
              maxLength={OVERLAY_MAX_LENGTH}
              placeholder={t('video.overlayPlaceholder')}
              onChange={(e) => onPatch({ overlayText: e.currentTarget.value })}
            />
          )}
        </Field>

        <Field label={t('video.overlayPosition')}>
          {(p) => (
            <Select
              {...p}
              value={scene.overlayPosition}
              // Nothing to position while the box is empty, and a live control
              // that changes nothing is the kind of thing people click twice.
              disabled={disabled || !scene.overlayText.trim()}
              onChange={(e) => onPatch({ overlayPosition: e.currentTarget.value as OverlayPosition })}
            >
              {OVERLAY_POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {t(OVERLAY_KEYS[pos])}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </li>
  )
}

function JobPanel({ job, stumbled, onNewCut }: { job: VideoJob; stumbled: boolean; onNewCut: () => void }) {
  const t = useT()
  const format = job.timeline?.outputFormat ?? 'mp4'

  const tone = job.status === 'error' ? 'danger' : job.status === 'done' ? 'ok' : 'info'
  const title = {
    queued: t('video.jobQueued'),
    rendering: t('video.jobRendering'),
    done: t('video.jobDone'),
    error: t('video.jobFailed'),
  }[job.status]

  return (
    <Banner tone={tone} title={`${t('video.jobTitle')} — ${title}`} className="mt-3">
      {job.status === 'queued' && <p>{t('video.jobQueuedHint')}</p>}
      {job.status === 'rendering' && (
        <p className="flex items-center gap-2">
          <Spinner />
          {t('video.jobRenderingHint')}
        </p>
      )}
      {/* The server's sentence, verbatim: it is the only place the real reason
          exists, and it was written for a person to read. */}
      {job.status === 'error' && job.error && <p className="font-mono text-caption">{job.error}</p>}
      {/* A job can finish without a stored file — the store refuses before it
          writes when the volume is at its ceiling. "Done" with no download link
          and no explanation is the worst reading of that. */}
      {job.status === 'done' && !job.videoHash && <p>{t('video.downloadGone')}</p>}
      {stumbled && job.status !== 'done' && job.status !== 'error' && (
        <p className="text-caption text-ink-faint">{t('video.pollRetry')}</p>
      )}
      {job.status === 'done' && job.videoHash && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ButtonLink variant="primary" size="sm" href={videoDownloadUrl(job.videoHash)} download>
            <Icon name="download" size={15} />
            {t('video.download', { format: `.${format}` })}
          </ButtonLink>
          <Button variant="ghost" size="sm" onClick={onNewCut}>
            {t('video.newCut')}
          </Button>
        </div>
      )}
    </Banner>
  )
}

/**
 * A thrown error, as a heading and a next step.
 *
 * Switched on `code`, never on the message: the server's sentences are English
 * and subject to rewording, and matching on them is how a branch nobody
 * exercises stops working without anything failing.
 */
export function describe(e: unknown): Failure {
  if (!(e instanceof VideoExportError)) {
    return { titleKey: 'common.error', detail: e instanceof Error ? e.message : String(e) }
  }
  switch (e.code) {
    case 'quota':
      return { titleKey: 'video.errQuota', bodyKey: 'video.errQuotaHint', detail: e.message }
    case 'missing-images':
      return { titleKey: 'video.errMissing', bodyKey: 'video.errMissingHint', missing: e.missingImageIds }
    case 'no-access':
      return { titleKey: 'video.errNoAccess' }
    case 'offline':
      return { titleKey: 'video.errOffline', bodyKey: 'video.errOfflineHint', detail: e.message }
    case 'invalid':
      return {
        titleKey: 'video.errInvalid',
        // The issue list, joined. `path: message` is the shape the server sends
        // and the shape zod produces here, so a refusal reads the same whichever
        // side made it.
        detail: e.issues.length ? e.issues.map((i) => `${i.path}: ${i.message}`).join(' · ') : e.message,
      }
    default:
      return { titleKey: 'common.error', detail: e.message }
  }
}

