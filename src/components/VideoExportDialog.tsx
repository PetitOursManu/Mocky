import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { confirmImage, generateImage, imageUrl } from '../lib/imageLibrary'
import {
  BULLET_FIELDS,
  DURATION_STEP_MS,
  OVERLAY_MAX_LENGTH,
  addScene,
  addTextScene,
  clampDuration,
  draftBlockers,
  draftFromTimeline,
  draftTotalMs,
  durationWindow,
  emptyDraft,
  formatSeconds,
  moveScene,
  removeScene,
  sceneCap,
  setAspectRatio,
  setBullet,
  setOutputFormat,
  setTemplate,
  templateUsesImages,
  toTimelineInput,
  updateScene,
  type DraftBlocker,
  type DraftScene,
  type TemplateChoice,
  type VideoDraft,
} from '../lib/video/draft'
import {
  BRIEF_MAX_LENGTH,
  POLL_INTERVAL_MS,
  VideoExportError,
  fetchVideoAccess,
  fetchVideoJob,
  pollDeadlinePassed,
  proposeVideoTimeline,
  requestVariants,
  startVideoRender,
  videoDownloadUrl,
  type VideoAccess,
  type VideoJob,
} from '../lib/video/client'
import {
  DERIVATION_KEYS,
  VARIANT_BLOCKER_KEYS,
  abandonModel,
  clampVariantCount,
  derivationOf,
  discardedCount,
  emptyVariantFlow,
  keepModel,
  pickModel,
  stepOf,
  toggleChosen,
  variantBlocker,
  variantLimits,
  type VariantFlowState,
} from '../lib/video/variantFlow'
import {
  ASPECT_RATIOS,
  BAND_POSITIONS,
  KEN_BURNS,
  MAX_TOTAL_DURATION_MS,
  jobBudgetMs,
  OUTPUT_FORMATS,
  OVERLAY_MOVES,
  OVERLAY_POSITIONS,
  TEMPLATE_LIMITS,
  TEXT_LIMITS,
  TITLE_ANIMATIONS,
  TRANSITIONS,
  VIDEO_TEMPLATES,
  type BandPosition,
  type KenBurns,
  type OverlayMove,
  type OverlayPosition,
  type TitleAnimation,
  type Transition,
  type VideoTheme,
} from '../lib/video/timeline'
import {
  FRAME_DIMENSIONS,
  SOURCE_DIMENSIONS,
  formatMagnification,
  undersizedScenes,
  worstMagnification,
  type PixelSize,
  type UndersizedScene,
} from '../lib/video/resolution'
import { themeFromDesign } from '../lib/video/theme'
import { getThumb } from '../lib/thumbnails'
import { ImagePicker } from './ImagePicker'
import {
  Banner,
  Button,
  ButtonLink,
  Field,
  Icon,
  IconButton,
  Input,
  Modal,
  Segmented,
  Select,
  Spinner,
  Textarea,
} from '../ui'
import { useLang, useT } from '../i18n'

export const MOTION_KEYS: Record<KenBurns, string> = {
  static: 'video.motionStatic',
  'zoom-in': 'video.motionZoomIn',
  'zoom-out': 'video.motionZoomOut',
  'pan-left': 'video.motionPanLeft',
  'pan-right': 'video.motionPanRight',
}

/**
 * The overlay's own move. Its own map rather than five more entries in
 * `MOTION_KEYS`, because the two vocabularies are not interchangeable: a capture
 * is never panned or zoomed, and a photograph is never asked to "settle".
 */
export const OVERLAY_MOVE_KEYS: Record<OverlayMove, string> = {
  'drift-up': 'video.moveDriftUp',
  'drift-down': 'video.moveDriftDown',
  settle: 'video.moveSettle',
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

/**
 * Where a band may sit. Two values, not three — see `BAND_POSITIONS`: the whole
 * point of that composition is that the capture underneath stays readable, and
 * `center` is exactly where the thing being shown lives.
 */
export const BAND_KEYS: Record<BandPosition, string> = {
  top: 'video.bandTop',
  bottom: 'video.bandBottom',
}

export const ANIMATION_KEYS: Record<TitleAnimation, string> = {
  fade: 'video.animFade',
  rise: 'video.animRise',
  stagger: 'video.animStagger',
}

/**
 * The catalogue, in the order the panel lists it: `auto` first, then the five
 * compositions in the schema's own order.
 *
 * `auto` leads because it is the default and because it is the position that
 * serves a brief best — the model reads the sentence and picks the composition
 * built for it. Buried under the five it would be a setting nobody finds, which
 * is the thing this panel was rewritten to avoid.
 */
export const TEMPLATE_CHOICES: readonly TemplateChoice[] = ['auto', ...VIDEO_TEMPLATES] as const

/**
 * Three sentences per composition: its name, what it makes, and what it asks of
 * you before it can make it.
 *
 * The third is the one people actually need. "Animated titling" does not say
 * that it uses no picture at all, and somebody who has spent a minute choosing
 * images deserves to know that before they pick it — the same way `product`
 * saying "an argument per line" is what stops it being chosen for a brief with
 * no arguments in it.
 *
 * Held as KEYS, like every other enum map on this panel: the component calls
 * `t(TEMPLATE_NAME_KEYS[choice])`, so no repo-wide scan for `t('…')` literals
 * would ever see these, and a test is the only thing that can.
 */
export const TEMPLATE_NAME_KEYS: Record<TemplateChoice, string> = {
  auto: 'video.tplAuto',
  slideshow: 'video.tplSlideshow',
  overlay: 'video.tplOverlay',
  vertical: 'video.tplVertical',
  titles: 'video.tplTitles',
  product: 'video.tplProduct',
}

export const TEMPLATE_WHAT_KEYS: Record<TemplateChoice, string> = {
  auto: 'video.tplAutoWhat',
  slideshow: 'video.tplSlideshowWhat',
  overlay: 'video.tplOverlayWhat',
  vertical: 'video.tplVerticalWhat',
  titles: 'video.tplTitlesWhat',
  product: 'video.tplProductWhat',
}

export const TEMPLATE_NEEDS_KEYS: Record<TemplateChoice, string> = {
  auto: 'video.tplAutoNeeds',
  slideshow: 'video.tplSlideshowNeeds',
  overlay: 'video.tplOverlayNeeds',
  vertical: 'video.tplVerticalNeeds',
  titles: 'video.tplTitlesNeeds',
  product: 'video.tplProductNeeds',
}

/**
 * Which of the two ways of filling the timeline is on screen.
 *
 * They used to be two stacked blocks, both always drawn, and the panel was
 * taller than a 900-pixel window before a single scene had been added — so the
 * total, the ceiling and the render button, which live in the footer precisely
 * to stay visible, were the only things anybody could see without scrolling.
 * Behind a switch, one of them costs nothing.
 *
 * A session preference, deliberately not persisted: which form somebody wants is
 * a fact about the film they are making now, and a setting that remembered it
 * would open the panel on "start from an image" for a user who chose that once,
 * months ago, for one project.
 */
export type FillMode = 'compose' | 'image'

export const FILL_MODE_KEYS: Record<FillMode, string> = {
  compose: 'video.composeTitle',
  image: 'video.fromImageTitle',
}

/**
 * Why "Propose a cut" will not fire.
 *
 * The same shape as `BLOCKER_KEYS`, and for the same reason: the panel names the
 * reason next to the disabled button, and a control that refuses to fire without
 * saying why is what this whole screen was built to avoid.
 */
export type ComposeBlocker = 'no-images' | 'no-brief'

export const COMPOSE_BLOCKER_KEYS: Record<ComposeBlocker, string> = {
  'no-images': 'video.composeNeedImages',
  'no-brief': 'video.composeNeedBrief',
}

/**
 * Ordered, not alphabetical: there is nothing to propose a montage ON before
 * there is a selection, so asking for a sentence first would send somebody to
 * write one and then refuse them anyway.
 *
 * **The picture gate now follows the composition,** which is the whole reason
 * this takes a third argument. It used to be unconditional: the form was a
 * slideshow and nothing else, so a text-only proposal had no field that fitted
 * and the button was closed rather than spend a call reaching a refusal. With a
 * selector on the panel and a form that reads all five, `titles` is words on a
 * background and needs no picture at all — and `auto` needs none either, because
 * the server offers `titles` alone against an empty selection. Keeping the old
 * gate would have made the one composition written for a brief of words
 * unreachable through the panel that composes.
 *
 * **It counts PICTURES, not rows**, and the two are not the same number. A
 * `titles` row carries no `imageId`, and switching the selector keeps every row
 * — so a draft of three title cards moved to `product` had three scenes and no
 * pictures, passed a gate that counted rows, and spent a round trip on a request
 * the server refuses before it even reaches a model. `propose()` sends
 * `imageId`s filtered on truthiness; this is the same list, counted.
 */
/**
 * The real pixel size of every picture in the draft, measured by decoding it.
 *
 * The library's own `width`/`height` were the obvious source and they are the
 * wrong one: they record what was ASKED of a provider, not what came back. An
 * OpenAI request for 1344×768 is answered at 1536×1024 because `snapSize` reads
 * the ratio; an upload whose dimensions failed to decode in the browser is stored
 * as 0×0; entries that predate the field have nothing at all. A warning about
 * definition that quotes a number the file does not have is worse than no
 * warning, so this asks the file.
 *
 * It costs no network. Every one of these pictures is already on screen in a
 * scene row, so `new Image()` on the same URL is served from the browser's cache
 * — this is a decode, not a fetch, and it is the only way to learn a picture's
 * intrinsic size without shipping an image parser to the server.
 *
 * Ids that were already measured are re-decoded when the SET changes, and that
 * is deliberate rather than overlooked: skipping them would put `sizes` in the
 * effect's dependencies, which is the loop this hook exists to avoid. The second
 * decode is a cache hit and `setSizes` short-circuits on it.
 */
function useIntrinsicSizes(ids: readonly string[]): Record<string, PixelSize> {
  const [sizes, setSizes] = useState<Record<string, PixelSize>>({})
  // Sorted and joined, so a REORDER measures nothing new — the running order is
  // the thing people change most often in this panel.
  const key = useMemo(() => [...new Set(ids.filter(Boolean))].sort().join(' '), [ids])

  useEffect(() => {
    if (!key) return
    let live = true
    const decoding: HTMLImageElement[] = []
    for (const id of key.split(' ')) {
      const img = new Image()
      img.onload = () => {
        if (!live) return
        const size = { width: img.naturalWidth, height: img.naturalHeight }
        // Guarded, so a picture measured once is not a new object on every set
        // change — the memo below is keyed on this record's identity.
        setSizes((prev) => (prev[id] ? prev : { ...prev, [id]: size }))
      }
      // No `onerror` handler and nothing recorded on failure. An image that does
      // not load has no honest size, and the panel already has a route for a
      // picture that left the library: /render answers 404 naming it.
      img.src = imageUrl(id)
      decoding.push(img)
    }
    return () => {
      live = false
      // Detached as well as flagged: a decode that finishes after the panel
      // closes would otherwise hold this component's state setter alive.
      for (const img of decoding) img.onload = null
    }
  }, [key])

  return sizes
}

export function composeBlocker(
  imageCount: number,
  brief: string,
  template: TemplateChoice = 'slideshow',
): ComposeBlocker | null {
  const needsImages = template !== 'auto' && templateUsesImages(template)
  if (needsImages && imageCount === 0) return 'no-images'
  if (!brief.trim()) return 'no-brief'
  return null
}

/**
 * What the panel shows instead of the button, when the button cannot fire.
 *
 * One sentence per reason and never a shared one, because each names a
 * different box to go and fill in. A form with fourteen inputs and "something is
 * missing" under the button is a hunt.
 */
export const BLOCKER_KEYS: Record<DraftBlocker, string> = {
  'no-template': 'video.blockedNoTemplate',
  'no-scenes': 'video.blockedEmpty',
  'too-many-scenes': 'video.blockedTooMany',
  'over-budget': 'video.budgetOver',
  'image-missing': 'video.blockedImage',
  'headline-missing': 'video.blockedHeadline',
  'band-title-missing': 'video.blockedBandTitle',
  'bullets-missing': 'video.blockedBullets',
  'overlay-too-long': 'video.blockedOverlay',
  'text-too-long': 'video.blockedTextLong',
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
  /** Image ids the server refused because nobody has confirmed them. */
  pending?: string[]
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
 *
 * There are two ways to fill it in, one switch between them, and only one form.
 * "Propose a cut" sends a sentence and the images already picked to
 * POST /api/video/compose, and what comes back is written into the SAME
 * controls, all of them still live — the model proposes, the user disposes. It
 * is a pre-fill, not a mode: a read-only preview would have to be taken whole or
 * thrown away whole, and the first thing anyone wants to do with a proposed
 * running order is move two scenes. The switch is about which *assistant* is on
 * screen; neither of them is a mode the timeline is in.
 */
/**
 * One screen this panel may hang the finished film on.
 *
 * The three fields are what the picker draws and nothing more: `code` is there
 * only because `getThumb` keys its cache on it — a thumbnail taken from an older
 * source must not be shown for the screen as it is now. Handing the whole
 * `Screen` would have made this panel a second reader of a record it has no
 * business knowing, and the point of the picker is to be read-only.
 */
export interface AttachTarget {
  id: string
  name: string
  code: string
  /** The film already on that screen, if any — so the grid can say "this one". */
  attachedHash?: string
}

export default function VideoExportDialog({
  projectId,
  direction,
  screens,
  onAttachFilm,
  jobId,
  onJobId,
  onOpenMedia,
  onClose,
}: {
  projectId?: string
  /**
   * The art direction in force — the project's own, or the global DESIGN.md.
   *
   * The markdown, not a parsed theme, because `designForProject` is the one
   * place that rule lives and this panel has no business re-deciding it. What is
   * derived from it here is the handful of tokens a film can carry
   * (`themeFromDesign`), and the panel SHOWS them: a user who is told nothing
   * about colours assumes they get to choose, and every colour control this
   * panel could have grown would be one the composed document is forbidden to
   * carry.
   *
   * Absent means no direction at all, which is a real state and not an empty
   * one: each composition then renders on the defaults somebody chose for it, on
   * purpose, once.
   */
  direction?: string
  /**
   * The screens the film could be attached to.
   *
   * Absent when the panel was opened outside a project — from the standalone
   * Media page — and that is a real state rather than an empty list: there is no
   * screen to choose, so the panel says why instead of drawing a picker with
   * nothing in it.
   */
  screens?: AttachTarget[]
  /** Hangs the finished film on a screen. The caller owns the write-back. */
  onAttachFilm?: (screenId: string, hash: string) => void
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
  /**
   * Take the user to the film, rather than only naming where it went.
   *
   * Optional because this panel has to work without a media library to open —
   * and the sentence that says where the cut is stays either way. A download
   * link that vanishes when the panel closes was the whole defect: the file was
   * being produced and then being unreachable, so "it is in Media, under Motion,
   * attached to this project" is the part that must not depend on a callback
   * being wired.
   */
  onOpenMedia?: () => void
  onClose: () => void
}) {
  const t = useT()
  // Read here as well as in the rows below: the footer prints a magnification,
  // and `1,9` and `1.9` are different numbers to a French reader.
  const [lang] = useLang()
  const [access, setAccess] = useState<VideoAccess | null>(null)
  const [accessFailed, setAccessFailed] = useState(false)
  const [draft, setDraft] = useState<VideoDraft>(emptyDraft)
  const [job, setJob] = useState<VideoJob | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [pollStumbled, setPollStumbled] = useState(false)
  const [starting, setStarting] = useState(false)
  const [brief, setBrief] = useState('')
  const [proposing, setProposing] = useState(false)
  /**
   * Which form the switch is showing. Component state, so it survives every
   * round trip inside the open panel and nothing more — see `FillMode`.
   */
  const [fill, setFill] = useState<FillMode>('compose')
  /** What the server said about the proposal. English, verbatim — see the banner. */
  const [notices, setNotices] = useState<string[]>([])

  /**
   * The project's direction, as the handful of tokens a film may carry.
   *
   * Derived once per direction rather than per keystroke: `parseDesignSpec` walks
   * a markdown document, and this panel re-renders on every character typed into
   * the brief.
   *
   * It travels to BOTH doors — `/compose` and `/render` — because both attach it
   * server-side, and a proposal that came back in the project's colours while the
   * render used somebody else's would be two films from one panel. Neither door
   * shows it to a model: the schema a composed document is validated against has
   * no `theme` key at all, and the server writes it only after that validation.
   */
  const theme = useMemo<VideoTheme | null>(() => themeFromDesign(direction), [direction])

  /**
   * Which pictures are smaller than the frame they are about to fill.
   *
   * The other half of "the video is pixelated", and the half no encoder setting
   * reaches: a 1024×1024 still in a 1920×1080 film is enlarged 1.88× by
   * `object-fit: cover` before a byte gets to the encoder, and a camera move
   * spends 12% more. `src/lib/video/resolution.ts` carries the arithmetic.
   *
   * Recomputed live rather than asked of the server, and that is the whole point
   * of doing it here: the answer changes with the aspect ratio, the composition
   * and every camera move on the panel, and it has to be on screen while those
   * are still choices. A render is two minutes; a notice that arrives with the
   * finished file is a receipt, not a warning.
   */
  const sceneIds = useMemo(() => draft.scenes.map((s) => s.imageId), [draft.scenes])
  const sizes = useIntrinsicSizes(sceneIds)
  const undersized = useMemo(
    () =>
      undersizedScenes(
        draft.scenes,
        { template: draft.template, aspectRatio: draft.aspectRatio },
        (id) => sizes[id],
      ),
    [draft.scenes, draft.template, draft.aspectRatio, sizes],
  )
  /** By position, so a row can show its own number without scanning the list. */
  const undersizedAt = useMemo(
    () => new Map(undersized.map((found) => [found.index, found] as const)),
    [undersized],
  )

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

  /**
   * How long to wait before saying the render stopped answering — a different
   * quantity from `budgetMs` above, which is how long the FILM may be.
   *
   * They were the same expression once, because both were 120 s. They are not
   * the same thing: rendering 1080p in a headless browser costs about four
   * times real time, so a minute of film is minutes of render. Using the
   * duration ceiling here told a user their long film had timed out while the
   * worker was still calmly working on it — and then the finished export
   * appeared in Media with no panel left to show it.
   */
  const pollBudgetMs = jobBudgetMs(draftTotalMs(draft))

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
        if (pollDeadlinePassed(renderingSince.current, Date.now(), pollBudgetMs)) {
          setFailure({
            titleKey: 'video.errTimeout',
            bodyKey: 'video.errTimeoutHint',
            vars: { n: Math.round(pollBudgetMs / 1000) },
          })
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
  }, [jobId, pollBudgetMs])

  // ---- actions ----------------------------------------------------------

  const edit = useCallback((fn: (d: VideoDraft) => VideoDraft) => setDraft((d) => fn(d)), [])

  /**
   * The proposal in flight, so it can be cancelled — by the user, or by the
   * panel closing under it.
   *
   * A ref rather than state: nothing renders from it, and putting an
   * AbortController in state re-renders the whole panel twice per call for a
   * value only the handler reads.
   */
  const proposeCtrl = useRef<AbortController | null>(null)
  useEffect(
    () => () => {
      // Cleared as well as aborted, so the one guard below — "does this call
      // still own the form?" — covers the unmount too, and a call in flight
      // when the panel closes sets no state on its way out.
      proposeCtrl.current?.abort()
      proposeCtrl.current = null
    },
    [],
  )

  /**
   * Ask for a montage, and pre-fill the form with it.
   *
   * The confirmation is the load-bearing part. A proposal replaces the running
   * order, every duration, every motion and every caption at once, and doing
   * that silently to somebody who has spent ten minutes in this panel is the
   * worst possible moment to discover what the button does. It fires on hand
   * work only — see `handEdited` — so the ordinary path, pick pictures then
   * describe, never asks.
   */
  async function propose() {
    if (draft.handEdited && !confirm(t('video.composeOverwriteConfirm'))) return

    proposeCtrl.current?.abort()
    const ctrl = new AbortController()
    proposeCtrl.current = ctrl
    setProposing(true)
    setFailure(null)
    setNotices([])
    try {
      const proposal = await proposeVideoTimeline(
        brief,
        // `titles` has no picture on any scene, so its rows carry no id. Sending
        // a list of empty strings would fail `fileExists` on the server and
        // refuse the one composition written for a brief of words.
        draft.scenes.map((s) => s.imageId).filter(Boolean),
        {
          signal: ctrl.signal,
          theme,
          // Omitted on `auto`, which is the whole difference between the two
          // positions of the selector: named, the catalogue the model reads
          // holds that composition alone.
          template: draft.template === 'auto' ? undefined : draft.template,
        },
      )
      // A newer proposal (or the panel closing) owns the form now. Writing this
      // one in would replace the answer the user is actually waiting for.
      if (proposeCtrl.current !== ctrl) return
      setNotices(proposal.notices)
      /*
       * Nothing proposed leaves the form EXACTLY as it was.
       *
       * Clearing it would take a working timeline away as the price of asking a
       * question, and the reasons a proposal comes back empty — no model
       * configured, a provider that hung up, a document the schema refused —
       * have nothing to do with the montage already on screen (Q1).
       */
      /*
       * Whichever composition came back, loaded into the form — including the
       * selector, which follows it.
       *
       * This used to accept slideshows alone and refuse the other four with a
       * sentence, because the editor had one row shape. That was a model call
       * spent to produce something the panel then threw away: a brief about a
       * phone comes back `vertical` and there was nowhere to put it. The
       * selector is what made the other four expressible, and `draftFromTimeline`
       * reads all five.
       *
       * On `auto` this is also how the composition gets decided at all — the
       * proposal is the answer, and the selector moving to it is what tells the
       * user which film they are now looking at.
       */
      if (proposal.timeline) setDraft(draftFromTimeline(proposal.timeline))
    } catch (e) {
      // An abort is this panel cancelling, not something that went wrong.
      if ((e as { name?: string })?.name === 'AbortError') return
      setFailure(describe(e))
    } finally {
      if (proposeCtrl.current === ctrl) setProposing(false)
    }
  }

  function cancelPropose() {
    proposeCtrl.current?.abort()
    proposeCtrl.current = null
    setProposing(false)
  }

  async function start() {
    /*
     * No composition, no timeline — and no render.
     *
     * `toTimelineInput` answers `null` on `auto` rather than assembling the
     * slideshow that would have passed, which is the repair this feature refuses
     * everywhere: it would hand back a film in a composition nobody chose. The
     * button is already disabled by the `no-template` blocker; this is the guard
     * that makes the rule true rather than merely displayed.
     */
    const timeline = toTimelineInput(draft)
    if (!timeline) return

    setStarting(true)
    setFailure(null)
    setPollStumbled(false)
    try {
      // The project travels with the render, and it is what makes the finished
      // film findable afterwards: the store is content-addressed, so once the
      // bytes exist nothing else knows where they were cut from.
      const queued = await startVideoRender(timeline, { project: projectId, theme })
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
    // Every control the proposal is about to rewrite is frozen while it runs.
    // A slider moved during the call is an edit that vanishes when the answer
    // lands, with nothing to show it was ever made.
    const frozen = live || proposing
    // The pictures, not the rows — see `composeBlocker`. This is the same list
    // `propose()` puts in the request, so the gate cannot pass a call the server
    // is going to refuse for having no images in it.
    const composeBlocked = composeBlocker(
      draft.scenes.filter((s) => s.imageId).length,
      brief,
      draft.template,
    )
    /** The scene ceiling of the composition on the selector — see `sceneCap`. */
    const cap = sceneCap(draft.template)
    /*
     * `auto` shows no picture controls either, and that is not an oversight.
     *
     * Four of the five compositions put a picture on the screen and one does
     * not, so under `auto` the selection is what the MODEL is given to work
     * from — which is exactly why the picker stays. What disappears with a
     * composition that uses no image is the picker itself, because there is
     * nothing for a picture to be added to.
     */
    const usesImages = draft.template === 'auto' || templateUsesImages(draft.template)

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
            {[...(failure.missing ?? []), ...(failure.pending ?? [])].length > 0 && (
              <ul className="mt-1 font-mono text-caption text-ink-faint">
                {[...(failure.missing ?? []), ...(failure.pending ?? [])].map((id) => (
                  <li key={id}>{id.slice(0, 16)}…</li>
                ))}
              </ul>
            )}
          </Banner>
        )}

        {job && (
          <JobPanel
            job={job}
            stumbled={pollStumbled}
            inProject={Boolean(projectId)}
            screens={screens}
            onAttachFilm={onAttachFilm}
            onOpenMedia={onOpenMedia}
            onNewCut={newCut}
          />
        )}

        {/* Shown whether or not a timeline came back, and that is the point:
            with `timeline: null` these sentences are the only account of what
            did not happen, and the form below is deliberately untouched. `warn`
            rather than `danger` — an image left out of an otherwise good
            proposal is a remark, not a failure. The server's own words, kept
            verbatim, for the reason the error banner gives above. */}
        {notices.length > 0 && (
          <Banner tone="warn" title={t('video.composeNotices')} className="mt-3">
            <ul className="space-y-1">
              {notices.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </Banner>
        )}

        {/*
          The first decision, so the first control on the panel.

          Everything below reads differently depending on it: the scene rows are
          the chosen composition's fields, the picker is there or absent, the
          ratio is a choice or the template itself. Put lower down it would be a
          setting that retroactively rearranges the form somebody had already
          started filling in.
        */}
        <CompositionPicker
          value={draft.template}
          disabled={frozen}
          theme={theme}
          hasDirection={Boolean(direction && direction.trim())}
          onChange={(choice) => edit((d) => setTemplate(d, choice))}
        />

        {/*
          Above the scenes, not below them.

          What this block produces is the list underneath it, so it reads in the
          order it works: describe, and watch the form fill in. Put after the
          picker it would sit under twenty scene rows in a body that scrolls,
          where nobody discovers it — and the panel would look like a manual
          editor with a hidden shortcut rather than two ways in.

          ONE block for both ways in, and the switch is the section head. Stacked,
          the two of them filled a 900-pixel window on their own: everything that
          matters — the scenes, the total, the render button — started below the
          fold on a panel nobody had touched yet. They are also alternatives, not
          steps, and two open forms said the opposite.
        */}
        <div className="mt-4 border border-line-soft bg-ink/5 p-3">
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('video.sourceTitle')}</span>
            <span className="ml-auto flex">
              <Segmented
                label={t('video.sourceTitle')}
                value={fill}
                options={[
                  { value: 'compose', label: t(FILL_MODE_KEYS.compose) },
                  { value: 'image', label: t(FILL_MODE_KEYS.image) },
                ]}
                /* Segmented turns itself off when the active segment is clicked
                   again — correct for a canvas mode, wrong here: there is no
                   third state, and clicking the position you are already on
                   would empty the block. */
                onChange={(v) => v && setFill(v)}
              />
            </span>
          </div>

          {/*
            Hidden, never unmounted, and that is load-bearing on the second one.

            The variant flow holds a picture the provider has already been paid
            for and nobody has confirmed yet, plus a call that may be in flight.
            Unmounting it on a tab switch would abort that call and forget that
            image — which is not a deletion (M8), so the picture would stay on
            the volume, pending for good, with nothing left pointing at it. The
            compose form is kept the same way for the ordinary reason: a brief
            somebody typed must survive a look at the other tab.
          */}
          <div hidden={fill !== 'compose'}>
            <Field label={t('video.composeBrief')} hint={t('video.composeHint')}>
              {(p) => (
                <Textarea
                  {...p}
                  rows={2}
                  value={brief}
                  disabled={frozen}
                  maxLength={BRIEF_MAX_LENGTH}
                  placeholder={t('video.composePlaceholder')}
                  onChange={(e) => setBrief(e.currentTarget.value)}
                />
              )}
            </Field>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={frozen || composeBlocked !== null}
                onClick={propose}
              >
                <Icon name="sparkle" size={15} />
                {proposing ? t('video.composing') : t('video.compose')}
              </Button>
              {/* Cancellable, and visibly so: this is a model call on somebody
                  else's hardware, and the only alternative to a stop button is
                  closing the panel to get out of it. */}
              {proposing && (
                <>
                  <Spinner />
                  <Button variant="ghost" size="sm" onClick={cancelPropose}>
                    {t('common.cancel')}
                  </Button>
                </>
              )}
              <span className="ml-auto font-mono text-caption text-ink-faint">
                {t('video.briefCount', { n: brief.length, max: BRIEF_MAX_LENGTH })}
              </span>
            </div>
            {/* Next to the disabled button, for the reason the budget line
                exists: a control that will not fire and will not say why is what
                this whole panel was built to avoid. */}
            {composeBlocked && !proposing && (
              <p className="measure mt-1.5 text-body-sm text-ink-muted">{t(COMPOSE_BLOCKER_KEYS[composeBlocked])}</p>
            )}
          </div>

          {/* Beside the scene picker, never instead of it. The picker below is
              how somebody uses pictures they already have, and it stays the
              short way in; this one is for when they do not exist yet, and it
              costs up to seven provider calls and two decisions to walk. */}
          <div hidden={fill !== 'image'}>
            <StartFromImage
              projectId={projectId}
              access={access}
              aspectRatio={draft.aspectRatio}
              room={cap - draft.scenes.length}
              cap={cap}
              disabled={frozen}
              onAdd={(hashes) => edit((d) => hashes.reduce(addScene, d))}
              onFailure={setFailure}
            />
          </div>
        </div>

        <div className="section-head mt-5">
          <span className="kicker text-accent-ink">{t('video.scenesTitle')}</span>
          <span className="ml-auto font-mono text-caption text-accent-ink">
            {t('video.sceneCount', { n: draft.scenes.length, max: cap })}
          </span>
        </div>

        {draft.scenes.length === 0 ? (
          <div className="border border-line-soft bg-ink/5 p-4">
            <p className="text-body text-ink">{t('video.noScenes')}</p>
            {/* Two different next steps, because two different things are
                missing. A composition with no picture in it cannot be opened by
                choosing an image, and telling somebody to do that is a minute
                spent looking for a picker that is deliberately absent. */}
            <p className="measure mt-1 text-body-sm text-ink-muted">
              {t(usesImages ? 'video.noScenesHint' : 'video.noScenesHintText')}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {draft.scenes.map((scene, i) => (
              <SceneRow
                key={scene.key}
                scene={scene}
                template={draft.template}
                undersized={undersizedAt.get(i)}
                index={i}
                isLast={i === draft.scenes.length - 1}
                disabled={frozen}
                onMove={(delta) => edit((d) => moveScene(d, scene.key, delta))}
                onRemove={() => edit((d) => removeScene(d, scene.key))}
                onPatch={(patch) => edit((d) => updateScene(d, scene.key, patch))}
                onBullet={(index, text) => edit((d) => setBullet(d, scene.key, index, text))}
              />
            ))}
          </ul>
        )}

        {/*
          The picker, or the button that replaces it.

          `titles` is the one composition whose scenes hold no picture, so it
          gets an "add a card" button instead — a grid of thumbnails on a form
          with nowhere to put a thumbnail is an offer that cannot be honoured,
          and the user would reasonably conclude the picture goes somewhere they
          have not found yet.
        */}
        <div className="mt-3 border border-line-soft bg-ink/5 p-3">
          {draft.scenes.length >= cap ? (
            <p className="text-body-sm text-ink-faint">{t('video.addSceneFull', { max: cap })}</p>
          ) : usesImages ? (
            <ImagePicker
              projectId={projectId}
              heading={t('video.pickScene')}
              selected={draft.scenes.map((s) => s.imageId).filter(Boolean)}
              disabled={frozen}
              onPick={(hash) => edit((d) => addScene(d, hash))}
              onError={(message) => setFailure({ titleKey: 'common.error', detail: message })}
            />
          ) : (
            <>
              <p className="measure text-body-sm text-ink-muted">{t('video.addCardHint')}</p>
              <Button variant="primary" size="sm" className="mt-2" disabled={frozen} onClick={() => edit(addTextScene)}>
                <Icon name="plus" size={15} />
                {t('video.addCard')}
              </Button>
            </>
          )}
        </div>

        <div className="section-head mt-5">
          <span className="kicker text-accent-ink">{t('video.output')}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {/*
            A vertical cut has no ratio to choose: `VerticalTimelineSchema` types
            `aspectRatio` as the literal `9:16`, so the other two are unreachable
            rather than discouraged. A select offering three values, two of which
            refuse the document, is a control that exists to be got wrong — so it
            is replaced by the fact.
          */}
          {draft.template === 'vertical' ? (
            <div>
              <p className="mb-1.5 text-body-sm font-medium text-ink">{t('video.aspectRatio')}</p>
              <p className="text-body-sm text-ink-muted">{t('video.aspectLockedVertical')}</p>
            </div>
          ) : (
            <Field label={t('video.aspectRatio')}>
              {(p) => (
                <Select
                  {...p}
                  value={draft.aspectRatio}
                  disabled={frozen}
                  // Read BEFORE the updater, never inside it — see the note on
                  // the container select below.
                  onChange={(e) => {
                    const aspectRatio = e.currentTarget.value as VideoDraft['aspectRatio']
                    edit((d) => setAspectRatio(d, aspectRatio))
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
          )}
          <Field label={t('video.container')}>
            {(p) => (
              <Select
                {...p}
                value={draft.outputFormat}
                disabled={frozen}
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
                  edit((d) => setOutputFormat(d, outputFormat))
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
      <Budget
        total={draftTotalMs(draft)}
        max={budgetMs}
        cap={sceneCap(draft.template)}
        blockers={draftBlockers(draft)}
      />
      {/*
        In the FOOTER, beside the budget, for the reason the budget is here: this
        is the pinned strip, and everything else scrolls. A note about definition
        that lives next to the scenes is a note somebody scrolls past on their way
        to the button — and this one has exactly one moment to be read, the moment
        before two minutes of somebody else's CPU are spent.

        It never disables the button. A soft still is a film people ship on
        purpose, and refusing it would be the panel overruling a judgement that is
        not its own (Q1). The rows carry the per-scene numbers; this says how bad
        the worst of them is and what the only remedy is.
      */}
      {undersized.length > 0 && (
        <p className="measure mt-1.5 text-body-sm text-warn">
          {t('video.resFooter', {
            n: undersized.length,
            w: FRAME_DIMENSIONS[draft.aspectRatio].width,
            h: FRAME_DIMENSIONS[draft.aspectRatio].height,
            factor: formatMagnification(worstMagnification(undersized), lang),
          })}
        </p>
      )}
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
            // A render started here would queue the timeline that is about to be
            // replaced, and pay minutes of CPU for a film nobody will look at.
            proposing ||
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
 * Which of the five compositions the film is, or `auto` for "the model decides".
 *
 * A grid of radio cards rather than a `<Select>`, and the reason is the third
 * line on each card. A dropdown can carry a name and nothing else, and the
 * names alone are close to useless: "titrage animé" does not say that it uses no
 * picture, and somebody who has spent a minute choosing images will pick it and
 * then wonder where they went. What each composition REQUIRES is the fact that
 * decides the choice, so it has to be on screen at the moment of choosing rather
 * than discoverable by trying it.
 *
 * The bounds line is read off `TEMPLATE_LIMITS`, never typed into the
 * dictionary — the same discipline `templateCard()` follows in `compose.js`, and
 * for the same reason: a floor restated by hand drifts from the validator, and
 * the drift only shows as a refusal quoting a number nobody was shown.
 *
 * A native radio group, so arrow keys move between the cards and the whole set
 * is one tab stop. Buttons would have needed all of that written out, and
 * `Segmented` is the kit's control for two or three positions on one line — six
 * cards carrying three sentences each are not that control.
 */
function CompositionPicker({
  value,
  disabled,
  theme,
  hasDirection,
  onChange,
}: {
  value: TemplateChoice
  disabled: boolean
  /** The project's direction, as the tokens a film can carry. `null` = none stated. */
  theme: VideoTheme | null
  /**
   * Whether a direction exists at all, which is NOT `theme !== null`.
   *
   * A project can have a DESIGN.md that states nothing this schema can carry —
   * no colour, no typeface, no radius — and that is a third state: a direction
   * was read and it asks for nothing. Telling that user "no art direction" would
   * be false, and telling them their colours are applied would be worse.
   */
  hasDirection: boolean
  onChange: (choice: TemplateChoice) => void
}) {
  const t = useT()
  const [lang] = useLang()

  return (
    <div className="mt-4 border border-line-soft bg-ink/5 p-3">
      <fieldset disabled={disabled}>
        <legend className="kicker text-accent-ink">{t('video.templateTitle')}</legend>
        <p className="measure mt-1 text-body-sm text-ink-muted">{t('video.templateHint')}</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATE_CHOICES.map((choice) => {
            const active = value === choice
            const limits = choice === 'auto' ? null : TEMPLATE_LIMITS[choice]
            return (
              <li key={choice}>
                {/* The whole card is the hit area, as in the variant grid below:
                    a 13-pixel radio beside four lines of text is a target people
                    miss, and they miss it on the control that decides the film. */}
                <label
                  className={`flex h-full cursor-pointer flex-col gap-1 border p-2 transition ${
                    active ? 'border-accent bg-accent/10' : 'border-line-soft hover:border-line'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-body-sm font-medium text-ink">
                    <input
                      type="radio"
                      className="accent-accent"
                      name="video-template"
                      value={choice}
                      checked={active}
                      onChange={() => onChange(choice)}
                    />
                    {t(TEMPLATE_NAME_KEYS[choice])}
                  </span>
                  <span className="text-body-sm text-ink-muted">{t(TEMPLATE_WHAT_KEYS[choice])}</span>
                  <span className="text-caption text-ink-faint">{t(TEMPLATE_NEEDS_KEYS[choice])}</span>
                  {limits && (
                    <span className="mt-auto pt-1 font-mono text-caption text-ink-faint">
                      {t('video.templateBounds', {
                        max: limits.maxScenes,
                        min: formatSeconds(limits.minSceneMs, lang),
                        long: formatSeconds(limits.maxSceneMs, lang),
                      })}
                    </span>
                  )}
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>
      <ThemeNote theme={theme} hasDirection={hasDirection} />
    </div>
  )
}

/**
 * What the film will look like, and who decided it.
 *
 * Shown rather than left implicit, because the alternative reading is the wrong
 * one: a panel that says nothing about colour invites the assumption that colour
 * is a choice waiting further down, and there is no such control — the schema a
 * composed document is validated against has no `theme` key at all, precisely so
 * that a model cannot write one either. The project decided this, once, in its
 * direction; the honest thing is to say so where the film is being composed.
 *
 * The tokens are printed rather than summarised. "Your colours are applied" is
 * unfalsifiable from the outside, and the one failure this note has to make
 * visible is a direction that states less than the user thinks: only what
 * `parseDesignSpec` saw DECLARED travels, so a project whose accent was inferred
 * shows no accent here — which is the difference between a film in the project's
 * colours and a film in a guess.
 */
function ThemeNote({ theme, hasDirection }: { theme: VideoTheme | null; hasDirection: boolean }) {
  const t = useT()
  const colors = theme?.colors ?? {}
  const swatches = (Object.entries(colors) as [string, string | undefined][]).filter(
    (entry): entry is [string, string] => Boolean(entry[1]),
  )
  const fonts = [theme?.fonts?.heading, theme?.fonts?.body].filter(Boolean) as string[]

  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      <p className="measure text-body-sm text-ink-muted">
        {t(theme ? 'video.themeFromProject' : hasDirection ? 'video.themeStatesNothing' : 'video.themeNone')}
      </p>
      {theme && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {swatches.length > 0 && (
            <span className="flex items-center gap-1.5">
              {swatches.map(([role, hex]) => (
                // The hex comes from a schema whose charset is `#` and hex
                // digits, which is what makes it safe to put in a style
                // attribute at all — the same bound that lets a composition put
                // it in a `background`. `title` names the role rather than the
                // value: a column of six-digit hexes is not a thing anybody
                // reads.
                <span
                  key={role}
                  title={role}
                  className="h-4 w-4 border border-line-soft"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </span>
          )}
          {fonts.length > 0 && <span className="font-mono text-caption text-ink-faint">{fonts.join(' · ')}</span>}
        </div>
      )}
    </div>
  )
}

/**
 * The other way to fill the timeline: settle on one picture, take several
 * variants of it, and tick the ones worth cutting.
 *
 * The second position of the panel's switch, beside "describe the video" rather
 * than instead of it. It costs up to seven provider calls and two decisions,
 * which is only worth it when the pictures do not exist yet — so the scene
 * picker below the switch stays the short way in, and this path now offers the
 * library as its own starting point too.
 *
 * TWO GATES, and they are the point of the whole thing. Nothing generated here
 * enters the media library's listings or the montage until a human has looked at
 * it: the images arrive `pending: true`, and only `confirmImage` clears that.
 * The gates are courtesy — the guard is `pendingAmong()` and the 409 in
 * server/video/routes.js, which is what closing this panel cannot get past.
 *
 * A picture taken from the media library skips the first gate, and that is a
 * decision rather than a hole: it is not pending, nobody generated it here, and
 * the user chose it out of a grid of its own thumbnails one click ago. See
 * `pickModel`. The second gate is untouched — the variants it produces ARE
 * generated here, and they arrive pending like every other.
 *
 * The honesty about derivation is printed WHERE THE MONEY IS SPENT, next to the
 * button, from what /status promised — and again over the results, from what the
 * answer said actually happened. Somebody expecting a retouch of their own
 * photograph and getting a second photograph of the same subject has to learn
 * that before they pay for six of them, not in a footnote afterwards.
 */
function StartFromImage({
  projectId,
  access,
  aspectRatio,
  room,
  cap,
  disabled,
  onAdd,
  onFailure,
}: {
  projectId?: string
  access: VideoAccess
  /**
   * The film's shape, so the picture is MADE for it.
   *
   * This flow used to send no dimensions at all, which meant 1024×1024 — the
   * library's default — for every film. In a 16:9 export that square is cropped
   * of 44% of itself and what survives is enlarged 1.88×, and the provider call
   * cost exactly the same as one that would have come back the right shape. See
   * `SOURCE_DIMENSIONS` for why it is not simply the frame's own size.
   */
  aspectRatio: VideoDraft['aspectRatio']
  /** How many more scenes the timeline can hold. `addScene` refuses past the cap. */
  room: number
  /**
   * The chosen composition's scene ceiling, only so the "full" sentence can
   * quote it. Passed in rather than read here, because a product card holds six
   * scenes and a slideshow twenty — a component that quoted the widest one would
   * name a number the panel above it is not enforcing.
   */
  cap: number
  disabled: boolean
  onAdd: (hashes: string[]) => void
  /** `null` clears the banner — a fresh attempt should not run under an old refusal. */
  onFailure: (failure: Failure | null) => void
}) {
  const t = useT()
  const [flow, setFlow] = useState<VariantFlowState>(() => emptyVariantFlow())
  const [busy, setBusy] = useState<'model' | 'keep' | 'variants' | 'add' | null>(null)
  const limits = variantLimits(access.limits)
  const step = stepOf(flow)
  const blocker = variantBlocker(flow, room)

  /**
   * The call in flight, so every step is cancellable and none survives the panel.
   *
   * A ref for the reason `proposeCtrl` above is one: nothing renders from it. It
   * doubles as the "does this answer still own the flow?" token — a regeneration
   * started while the first was still out must not have the first one's picture
   * land on top of it.
   */
  const ctrl = useRef<AbortController | null>(null)
  useEffect(
    () => () => {
      ctrl.current?.abort()
      ctrl.current = null
    },
    [],
  )

  function begin() {
    ctrl.current?.abort()
    const mine = new AbortController()
    ctrl.current = mine
    return mine
  }
  const stale = (mine: AbortController) => ctrl.current !== mine

  /** An abort is this panel cancelling, never something to report. */
  const aborted = (e: unknown) => (e as { name?: string })?.name === 'AbortError'

  async function makeModel() {
    const mine = begin()
    setBusy('model')
    // Cleared at the start of every attempt in this flow, exactly as `propose`
    // and `start` do: a red banner left standing over a step that has since
    // succeeded is read as the step having failed.
    onFailure(null)
    try {
      const out = await generateImage(flow.subject.trim(), {
        project: projectId,
        // Unconfirmed by construction: the whole point of the gate below is that
        // nobody has seen this picture yet.
        pending: true,
        /*
         * A fresh seed every time, and "Regenerate" is why.
         *
         * The library caches on provider+prompt+seed+size (M8), so asking twice
         * with the same sentence and no seed is served the previous image out of
         * the cache — instantly, free, and identical. Correct everywhere else,
         * and the exact opposite of what a button offering another take means.
         */
        seed: Math.floor(Math.random() * 2_147_483_647),
        tags: ['video-source'],
        // The film's shape, not the library's square default — see the prop.
        // `makeVariants` copies the source's geometry on the server, so every
        // variant taken from this picture inherits it without being told.
        ...SOURCE_DIMENSIONS[aspectRatio],
        signal: mine.signal,
      })
      if (stale(mine)) return
      // A provider that answered and produced nothing. Not a transport failure,
      // and saying it as one sends somebody hunting a breakage that is not there.
      if (!out) return onFailure({ titleKey: 'common.error', bodyKey: 'video.modelSkipped' })
      setFlow((f) => ({ ...f, modelHash: out.hash, modelKept: false, batch: null, chosen: [] }))
    } catch (e) {
      if (aborted(e) || stale(mine)) return
      onFailure(describe(e))
    } finally {
      if (!stale(mine)) setBusy(null)
    }
  }

  async function keep() {
    if (!flow.modelHash) return
    const mine = begin()
    setBusy('keep')
    onFailure(null)
    try {
      await confirmImage(flow.modelHash, mine.signal)
      if (stale(mine)) return
      setFlow(keepModel)
    } catch (e) {
      if (aborted(e) || stale(mine)) return
      onFailure(describe(e))
    } finally {
      if (!stale(mine)) setBusy(null)
    }
  }

  async function makeBatch() {
    if (!flow.modelHash) return
    const mine = begin()
    setBusy('variants')
    onFailure(null)
    try {
      const batch = await requestVariants(flow.modelHash, flow.count, {
        project: projectId,
        signal: mine.signal,
      })
      if (stale(mine)) return
      // Everything ticked by default would make the second gate a formality, and
      // a formality is what people click through. The grid opens empty.
      setFlow((f) => ({ ...f, batch, chosen: [] }))
    } catch (e) {
      if (aborted(e) || stale(mine)) return
      onFailure(describe(e))
    } finally {
      if (!stale(mine)) setBusy(null)
    }
  }

  /**
   * Confirm what was ticked, then hand it to the timeline.
   *
   * Confirmed FIRST, and one at a time. `addScene` on an unconfirmed hash builds
   * a draft that /render will refuse with a 409 — the guard doing exactly its
   * job, to a user who did tick the box. So the flag is cleared before the
   * picture is offered to the montage, and only the ones that really cleared are
   * offered: a confirmation that failed leaves that variant out and says how many
   * (Q1 — degrade, and say what degraded).
   */
  async function addChosen() {
    const mine = begin()
    setBusy('add')
    onFailure(null)
    const confirmed: string[] = []
    let failed = 0
    try {
      for (const hash of flow.chosen) {
        if (stale(mine)) return
        try {
          await confirmImage(hash, mine.signal)
          confirmed.push(hash)
        } catch (e) {
          if (aborted(e)) return
          failed++
        }
      }
      if (stale(mine)) return
      if (confirmed.length) onAdd(confirmed)
      if (failed) onFailure({ titleKey: 'common.error', bodyKey: 'video.variantConfirmFailed', vars: { n: failed } })
      // Back to the start, count remembered. The variants that were not ticked
      // stay in the store, unconfirmed for good — that is what the note under
      // the grid warned about, and undoing it here would make the warning false.
      setFlow((f) => ({ ...emptyVariantFlow(f.count) }))
    } finally {
      if (!stale(mine)) setBusy(null)
    }
  }

  function cancel() {
    ctrl.current?.abort()
    ctrl.current = null
    setBusy(null)
  }

  /** What /status promised, before anything has been spent. */
  const promised = derivationOf(access.variantsDerived)
  /** What the answer says actually happened. The receipt wins over the promise. */
  const actual = flow.batch ? derivationOf(flow.batch.derived) : null
  const frozen = disabled || busy !== null

  /*
   * The timeline is full: there is nothing to make variants FOR.
   *
   * An early return rather than the caller dropping this component, which is
   * what it used to do. Unmounted, the flow's state goes with it — a model image
   * already paid for and not yet confirmed, and possibly a provider call in
   * flight — and forgetting a pending picture does not delete it (M8): it would
   * stay on the volume, unlisted and unmountable, with nothing left pointing at
   * it. Here the state survives the ceiling and comes back when a scene is
   * removed.
   */
  if (room <= 0) {
    return <p className="text-body-sm text-ink-faint">{t('video.addSceneFull', { max: cap })}</p>
  }

  return (
    <div>
      <p className="measure text-body-sm text-ink-muted">{t('video.fromImageHint')}</p>

      {step === 'describe' && (
        <>
          <Field label={t('video.fromImageSubject')} className="mt-2">
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                value={flow.subject}
                disabled={frozen}
                maxLength={BRIEF_MAX_LENGTH}
                placeholder={t('video.fromImagePlaceholder')}
                onChange={(e) => {
                  const subject = e.currentTarget.value
                  setFlow((f) => ({ ...f, subject }))
                }}
              />
            )}
          </Field>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" disabled={frozen || blocker !== null} onClick={makeModel}>
              <Icon name="image" size={15} />
              {busy === 'model' ? t('video.makingModel') : t('video.makeModel')}
            </Button>
            {busy === 'model' && (
              <>
                <Spinner />
                <Button variant="ghost" size="sm" onClick={cancel}>
                  {t('common.cancel')}
                </Button>
              </>
            )}
          </div>

          {/*
            The picture may already exist, and until now this path refused to
            admit it: the only way to a set of variants was to pay a provider for
            a model image, even with the very picture you wanted sitting in the
            media library. The same ImagePicker the scene list uses, so "choose
            an image" is one component in this panel rather than two that drift.

            A library image goes STRAIGHT to the variants — see `pickModel` for
            why gate 1 is skipped rather than forgotten — and the note below says
            so, because an unexplained missing confirmation is the kind of thing
            somebody puts back six months later.
          */}
          <div className="mt-3 border-t border-line-soft pt-3">
            <ImagePicker
              projectId={projectId}
              heading={t('video.pickModelHeading')}
              disabled={frozen}
              /* The second picker on this panel — see the prop. Its own generate
                 button would sit beside the gated one above it and mean
                 something different. */
              compact
              onPick={(hash) => setFlow((f) => pickModel(f, hash))}
              onError={(message) => onFailure({ titleKey: 'common.error', detail: message })}
            />
            <p className="measure mt-2 text-body-sm text-ink-muted">{t('video.pickModelNote')}</p>
          </div>
        </>
      )}

      {/* GATE 1. Large, because deciding from a thumbnail is not deciding. */}
      {step === 'keep' && flow.modelHash && (
        <div className="mt-3">
          <p className="text-body font-medium text-ink">{t('video.gateKeepTitle')}</p>
          <p className="measure mt-1 text-body-sm text-ink-muted">{t('video.gateKeepBody')}</p>
          <img
            src={imageUrl(flow.modelHash)}
            alt={t('video.modelImageAlt')}
            className="mt-2 max-h-72 w-full border border-line-soft object-contain"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" disabled={frozen} onClick={keep}>
              <Icon name="check" size={15} />
              {t('video.keep')}
            </Button>
            <Button variant="ghost" size="sm" disabled={frozen} onClick={makeModel}>
              <Icon name="refresh" size={15} />
              {busy === 'model' ? t('video.makingModel') : t('video.regenerate')}
            </Button>
            <Button variant="ghost" size="sm" disabled={frozen} onClick={() => setFlow(abandonModel)}>
              {t('video.abandon')}
            </Button>
            {busy !== null && <Spinner />}
          </div>
        </div>
      )}

      {step === 'ask' && (
        <div className="mt-3">
          {/* What the variants will be taken FROM, small but present. The step
              used to sit directly under a gate showing the picture full width,
              so there was nothing to say; two of the three ways into it no
              longer pass through that gate, and "produce 4 variants" of an
              unnamed image is a button nobody should have to trust. */}
          {flow.modelHash && (
            <img
              src={imageUrl(flow.modelHash)}
              alt={t('video.modelImageAlt')}
              className="mb-2 h-20 border border-line-soft object-contain"
            />
          )}
          <Field label={t('video.variantCount')}>
            {(p) => (
              <Select
                {...p}
                value={String(flow.count)}
                disabled={frozen}
                // Read outside the updater — a synthetic event's currentTarget is
                // null by the time React runs one. See the container select.
                onChange={(e) => {
                  const count = clampVariantCount(Number(e.currentTarget.value), limits)
                  setFlow((f) => ({ ...f, count }))
                }}
              >
                {Array.from({ length: limits.max - limits.min + 1 }, (_, i) => limits.min + i).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {/* The promise, at the click, before the money. */}
          <p className="measure mt-2 text-body-sm text-ink-muted">{t(DERIVATION_KEYS[promised])}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" disabled={frozen} onClick={makeBatch}>
              <Icon name="grid" size={15} />
              {busy === 'variants' ? t('video.makingVariants') : t('video.makeVariants', { n: flow.count })}
            </Button>
            {busy === 'variants' && (
              <>
                <Spinner />
                <Button variant="ghost" size="sm" onClick={cancel}>
                  {t('common.cancel')}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" disabled={frozen} onClick={() => setFlow(abandonModel)}>
              {t('video.abandon')}
            </Button>
          </div>
        </div>
      )}

      {/* GATE 2. Multiple selection, and nothing ticked to begin with. */}
      {step === 'choose' && flow.batch && (
        <div className="mt-3">
          <p className="text-body font-medium text-ink">{t('video.gateChooseTitle')}</p>
          <p className="measure mt-1 text-body-sm text-ink-muted">{t('video.gateChooseBody')}</p>
          {/* The receipt. Same three sentences as the promise above, chosen from
              what the server says actually happened — if the two ever disagree,
              this is the one that is true. */}
          {actual && <p className="measure mt-1 text-body-sm text-ink-muted">{t(DERIVATION_KEYS[actual])}</p>}
          {flow.batch.notices.length > 0 && (
            <Banner tone="warn" title={t('video.variantNotices')} className="mt-2">
              <ul className="space-y-1">
                {flow.batch.notices.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </Banner>
          )}
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {flow.batch.images.map((v, i) => (
              <li key={v.hash}>
                {/* A label wrapping the checkbox and the picture, so the whole
                    cell is the hit area. A 96-pixel-high image with a 13-pixel
                    box beside it is a target people miss. */}
                <label
                  className={`flex cursor-pointer flex-col gap-1 border p-1 ${
                    flow.chosen.includes(v.hash) ? 'border-accent bg-accent/10' : 'border-line-soft'
                  }`}
                >
                  <img src={imageUrl(v.hash)} alt="" className="h-24 w-full object-cover" />
                  <span className="flex items-center gap-1.5 text-body-sm text-ink">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={flow.chosen.includes(v.hash)}
                      disabled={frozen}
                      onChange={() => setFlow((f) => toggleChosen(f, v.hash))}
                    />
                    {t('video.variantNumber', { n: i + 1 })}
                  </span>
                  {/* The axis, as the server named it. Untranslated on purpose:
                      it is the server's own identifier, and inventing five
                      French labels for a field that may grow a sixth is how a
                      dropdown ends up showing a key. */}
                  <span className="font-mono text-caption text-ink-faint">{v.axis}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" disabled={frozen || blocker !== null} onClick={addChosen}>
              <Icon name="plus" size={15} />
              {busy === 'add' ? t('video.adding') : t('video.addChosen')}
            </Button>
            <span className="font-mono text-caption text-ink-faint">
              {t('video.variantChosen', { n: flow.chosen.length })}
            </span>
            <Button variant="ghost" size="sm" disabled={frozen} onClick={() => setFlow(abandonModel)}>
              {t('video.abandon')}
            </Button>
          </div>
          {/* Said before the button, not after: what is left unticked stays
              unconfirmed for good, and that is not a thing to discover later. */}
          {discardedCount(flow) > 0 && (
            <p className="measure mt-1.5 text-body-sm text-ink-muted">
              {t('video.variantDiscardNote', { n: discardedCount(flow) })}
            </p>
          )}
        </div>
      )}

      {/* Next to the disabled control, as everywhere else on this panel. */}
      {blocker && !frozen && (
        <p className="measure mt-1.5 text-body-sm text-ink-muted">
          {t(VARIANT_BLOCKER_KEYS[blocker], { room })}
        </p>
      )}
    </div>
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
function Budget({
  total,
  max,
  cap,
  blockers,
}: {
  total: number
  max: number
  /** The chosen composition's scene ceiling, quoted by `too-many-scenes`. */
  cap: number
  blockers: DraftBlocker[]
}) {
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

          An empty timeline is drawn muted rather than red, and so is a
          composition nobody has chosen yet. Those are the two states the dialog
          OPENS in, and a red line under a disabled button on a panel nobody has
          touched reads as something already broken. */}
      {blockers.length > 0 && (
        <p
          className={`measure mt-1.5 text-body-sm ${
            blockers[0] === 'no-scenes' || blockers[0] === 'no-template' ? 'text-ink-muted' : 'text-danger'
          }`}
        >
          {t(BLOCKER_KEYS[blockers[0]], {
            max: blockers[0] === 'overlay-too-long' ? OVERLAY_MAX_LENGTH : cap,
            over: formatSeconds(Math.max(0, over), lang),
          })}
        </p>
      )}
    </div>
  )
}

/**
 * One row of the editor, drawn with the fields of the composition on the
 * selector — and with none of the others.
 *
 * The rule this enforces is the one the panel was rewritten for: what is on
 * screen is what the chosen composition renders. A caption box on a product card
 * would be a line somebody writes and never sees, because `ProductSceneSchema`
 * has no `textOverlay` and `toTimelineInput` does not emit one; a camera-move
 * select on an overlay scene would offer a pan across a screenshot, which is
 * exactly what that composition exists to refuse.
 *
 * On `auto` the row is the picture and the running order, and nothing else. The
 * composition that would READ a duration or a camera move is not decided yet, so
 * every setting shown there would be a value the model is about to overwrite —
 * or worse, one it does not overwrite, silently kept from a form the user filled
 * in for a different film.
 */
function SceneRow({
  scene,
  template,
  undersized,
  index,
  isLast,
  disabled,
  onMove,
  onRemove,
  onPatch,
  onBullet,
}: {
  scene: DraftScene
  template: TemplateChoice
  /**
   * This scene's picture is smaller than the box it will be painted into.
   *
   * On the ROW rather than in a banner of its own, because the only useful
   * answer is "replace this picture" and the row is where that is done. A list
   * of scene numbers at the top of the panel would be a second index of
   * something already on screen, and it would go stale the moment anybody
   * reorders.
   */
  undersized?: UndersizedScene
  index: number
  isLast: boolean
  disabled: boolean
  onMove: (delta: number) => void
  onRemove: () => void
  onPatch: (patch: Partial<Omit<DraftScene, 'key'>>) => void
  onBullet: (index: number, text: string) => void
}) {
  const t = useT()
  const [lang] = useLang()
  const label = t('video.sceneNumber', { n: index + 1 })
  const window = template === 'auto' ? null : durationWindow(template)
  const showsPicture = template === 'auto' || templateUsesImages(template)

  return (
    <li className="border border-line-soft bg-surface">
      <div className="flex items-start gap-3 p-2">
        {showsPicture && scene.imageId && (
          <img
            src={imageUrl(scene.imageId)}
            alt=""
            className="h-16 w-24 shrink-0 border border-line-soft object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium text-ink">{label}</p>
          {showsPicture && scene.imageId && (
            <p className="font-mono text-caption text-ink-faint">{scene.imageId.slice(0, 12)}</p>
          )}
          {/* The measurement, next to the picture it is about. `warn` and not
              `danger`: a soft still is a film somebody may well ship, and the
              render is not refused over it (Q1). */}
          {undersized && (
            <p className="font-mono text-caption text-warn">
              {t('video.resScene', {
                w: undersized.source.width,
                h: undersized.source.height,
                factor: formatMagnification(undersized.magnification, lang),
              })}
            </p>
          )}
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

      {/* On `auto` the row stops here: a picture and its place in the running
          order, which is exactly what the selection is — the model's input. */}
      {window && template !== 'auto' && (
        <div className="grid gap-3 border-t border-line-soft p-3 sm:grid-cols-3">
          {/*
            A slider, not a number box, and its bounds are the CHOSEN
            composition's — a vertical beat stops at 8 s where a slideshow's runs
            to 15. The document is refused outright when a duration strays
            outside, with no clamping and no repair, so a control that cannot
            express the illegal value in the first place is how that rule is
            honoured here without ever correcting anything the user typed.
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
              min={window.minSceneMs}
              max={window.maxSceneMs}
              step={DURATION_STEP_MS}
              value={scene.durationMs}
              disabled={disabled}
              aria-label={`${label} — ${t('video.duration')}`}
              onChange={(e) => onPatch({ durationMs: clampDuration(Number(e.currentTarget.value), template) })}
            />
          </label>

          {/* The camera move exists on two of the five scene kinds. A product
              card lays its text out beside a picture that has to stay where it
              is, and a title card has no picture at all — so this is absent
              there rather than present and ignored. */}
          {(template === 'slideshow' || template === 'vertical') && (
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
          )}

          {/* The banded template has a movement of its own and a vocabulary of
              its own: a pan across a screenshot slides half the interface out of
              frame, so what it offers are drifts of about a percent. The field
              is here rather than absent because a move the model can choose and
              the panel cannot is a setting somebody can only get by asking. */}
          {template === 'overlay' && (
            <Field label={t('video.motion')}>
              {(p) => (
                <Select
                  {...p}
                  value={scene.move}
                  disabled={disabled}
                  onChange={(e) => onPatch({ move: e.currentTarget.value as OverlayMove })}
                >
                  {OVERLAY_MOVES.map((m) => (
                    <option key={m} value={m}>
                      {t(OVERLAY_MOVE_KEYS[m])}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}

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

          {(template === 'slideshow' || template === 'vertical') && (
            <>
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
                    // Nothing to position while the box is empty, and a live
                    // control that changes nothing is the kind of thing people
                    // click twice.
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
            </>
          )}

          {template === 'overlay' && (
            <>
              {/* Required — `band.title` is `min(1)` in the schema, so an empty
                  box is a refused document rather than a shorter film. The hint
                  says so at the box instead of leaving the sentence under the
                  render button to be the first anyone hears of it. */}
              <Field
                label={t('video.bandTitle')}
                className="sm:col-span-2"
                hint={t('video.bandTitleHint', { max: TEXT_LIMITS.bandTitle })}
              >
                {(p) => (
                  <Input
                    {...p}
                    value={scene.bandTitle}
                    disabled={disabled}
                    maxLength={TEXT_LIMITS.bandTitle}
                    placeholder={t('video.bandTitlePlaceholder')}
                    onChange={(e) => onPatch({ bandTitle: e.currentTarget.value })}
                  />
                )}
              </Field>

              <Field label={t('video.bandPosition')}>
                {(p) => (
                  <Select
                    {...p}
                    value={scene.bandPosition}
                    disabled={disabled}
                    onChange={(e) => onPatch({ bandPosition: e.currentTarget.value as BandPosition })}
                  >
                    {BAND_POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {t(BAND_KEYS[pos])}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field
                label={t('video.bandSubtitle')}
                className="sm:col-span-3"
                hint={t('video.overlayCount', { n: scene.bandSubtitle.length, max: TEXT_LIMITS.bandSubtitle })}
              >
                {(p) => (
                  <Input
                    {...p}
                    value={scene.bandSubtitle}
                    disabled={disabled}
                    maxLength={TEXT_LIMITS.bandSubtitle}
                    placeholder={t('video.bandSubtitlePlaceholder')}
                    onChange={(e) => onPatch({ bandSubtitle: e.currentTarget.value })}
                  />
                )}
              </Field>
            </>
          )}

          {template === 'titles' && (
            <>
              <Field
                label={t('video.headline')}
                className="sm:col-span-2"
                hint={t('video.headlineHint', { max: TEXT_LIMITS.titleHeadline })}
              >
                {(p) => (
                  <Input
                    {...p}
                    value={scene.headline}
                    disabled={disabled}
                    maxLength={TEXT_LIMITS.titleHeadline}
                    placeholder={t('video.headlinePlaceholder')}
                    onChange={(e) => onPatch({ headline: e.currentTarget.value })}
                  />
                )}
              </Field>

              <Field label={t('video.animation')}>
                {(p) => (
                  <Select
                    {...p}
                    value={scene.animation}
                    disabled={disabled}
                    onChange={(e) => onPatch({ animation: e.currentTarget.value as TitleAnimation })}
                  >
                    {TITLE_ANIMATIONS.map((a) => (
                      <option key={a} value={a}>
                        {t(ANIMATION_KEYS[a])}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field
                label={t('video.titleSubtitle')}
                className="sm:col-span-3"
                hint={t('video.overlayCount', { n: scene.subtitle.length, max: TEXT_LIMITS.titleSubtitle })}
              >
                {(p) => (
                  <Input
                    {...p}
                    value={scene.subtitle}
                    disabled={disabled}
                    maxLength={TEXT_LIMITS.titleSubtitle}
                    placeholder={t('video.titleSubtitlePlaceholder')}
                    onChange={(e) => onPatch({ subtitle: e.currentTarget.value })}
                  />
                )}
              </Field>
            </>
          )}

          {template === 'product' && (
            <>
              <Field
                label={t('video.headline')}
                className="sm:col-span-2"
                hint={t('video.headlineHint', { max: TEXT_LIMITS.productHeadline })}
              >
                {(p) => (
                  <Input
                    {...p}
                    value={scene.headline}
                    disabled={disabled}
                    maxLength={TEXT_LIMITS.productHeadline}
                    placeholder={t('video.headlinePlaceholder')}
                    onChange={(e) => onPatch({ headline: e.currentTarget.value })}
                  />
                )}
              </Field>

              <Field label={t('video.cta')} hint={t('video.ctaHint', { max: TEXT_LIMITS.productCta })}>
                {(p) => (
                  <Input
                    {...p}
                    value={scene.cta}
                    disabled={disabled}
                    maxLength={TEXT_LIMITS.productCta}
                    placeholder={t('video.ctaPlaceholder')}
                    onChange={(e) => onPatch({ cta: e.currentTarget.value })}
                  />
                )}
              </Field>

              {/*
                Three boxes, always, and the empty ones are dropped on the way
                out. The schema takes one to three arguments — never exactly
                three — so a card with two is a two-argument card rather than one
                with a gap in it. Drawn as a fixed set rather than an "add
                another" button because three is the ceiling and a control that
                can be pressed twice and then refuses is worse than three boxes
                that are simply there.
              */}
              <div className="sm:col-span-3">
                <p className="mb-1.5 text-body-sm font-medium text-ink">
                  {t('video.bullets', { max: BULLET_FIELDS })}
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {scene.bullets.map((bullet, i) => (
                    <Input
                      key={i}
                      value={bullet}
                      disabled={disabled}
                      maxLength={TEXT_LIMITS.productBullet}
                      aria-label={`${label} — ${t('video.bulletNumber', { n: i + 1 })}`}
                      placeholder={t('video.bulletPlaceholder', { n: i + 1 })}
                      onChange={(e) => onBullet(i, e.currentTarget.value)}
                    />
                  ))}
                </div>
                <p className="mt-1 text-caption text-ink-faint">
                  {t('video.bulletsHint', { max: TEXT_LIMITS.productBullet })}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  )
}

/**
 * What happened to the render, and — once it is finished — WHERE THE FILM IS.
 *
 * The second half is the reason this panel was rewritten. A finished export used
 * to offer one download link and nothing else, so closing the panel lost the
 * only route to a file that was sitting on the server the whole time: the job id
 * lives in this session, the journal forgets it after fifty more renders, and
 * the store is content-addressed, which says what a file contains and nothing
 * about who wanted it. The cut is now attached to the project it was made in and
 * listed in Media under Motion — and this banner says so, because a place nobody
 * is told about is the same as no place at all.
 */
function JobPanel({
  job,
  stumbled,
  inProject,
  screens,
  onAttachFilm,
  onOpenMedia,
  onNewCut,
}: {
  job: VideoJob
  stumbled: boolean
  /** Whether the sentence may promise a project. The Media page has none. */
  inProject: boolean
  screens?: AttachTarget[]
  onAttachFilm?: (screenId: string, hash: string) => void
  onOpenMedia?: () => void
  onNewCut: () => void
}) {
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
        <>
          {/* Before the buttons, not after: the download is what somebody does
              next, and where the film LIVES is what they need to know to come
              back tomorrow. Two sentences because the promise is not the same —
              a film cut from the standalone Media page belongs to no project,
              and saying it was filed under one would be a plain untruth. */}
          <p className="mt-1">{t(inProject ? 'video.savedInProject' : 'video.savedInMedia')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ButtonLink variant="primary" size="sm" href={videoDownloadUrl(job.videoHash)} download>
              <Icon name="download" size={15} />
              {t('video.download', { format: `.${format}` })}
            </ButtonLink>
            {onOpenMedia && (
              <Button variant="ghost" size="sm" onClick={onOpenMedia}>
                <Icon name="library" size={15} />
                {t('video.openInMedia')}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onNewCut}>
              {t('video.newCut')}
            </Button>
          </div>
          <AttachToScreen
            hash={job.videoHash}
            inProject={inProject}
            screens={screens}
            onAttach={onAttachFilm}
          />
        </>
      )}
    </Banner>
  )
}

/**
 * Hang the finished film on one of the project's screens.
 *
 * The third thing to do with a render, beside downloading it and going to find
 * it in Media, and the one that gives it a place in the work rather than in a
 * folder: `Screen.attachedMedia` is metadata, so the canvas draws the film on
 * the card column beside the frame and the screen's code is not touched. That
 * distinction is stated here rather than assumed, because "attach to a screen"
 * is exactly the phrase somebody would read as "put the video in the screen".
 *
 * OUTSIDE A PROJECT THERE IS NO PICKER. The panel opens from the standalone
 * Media page too, where there are no screens at all — a control that could only
 * ever be empty is worse than a sentence saying why it is absent, because an
 * empty grid reads as a listing that failed to load.
 *
 * Screens are drawn from the thumbnail cache and nothing else. `getThumb` keys
 * on the code that produced the picture, so a screen edited since its last
 * capture falls back to its name rather than showing a photograph of a version
 * that no longer exists. Nothing here mounts a preview: the capture runs
 * model-written code same-origin (see lib/thumbnails.ts), which belongs in the
 * project view and not inside a modal.
 */
function AttachToScreen({
  hash,
  inProject,
  screens,
  onAttach,
}: {
  hash: string
  inProject: boolean
  screens?: AttachTarget[]
  onAttach?: (screenId: string, hash: string) => void
}) {
  const t = useT()
  if (!onAttach) return null
  if (!inProject) return <p className="mt-3 text-body-sm">{t('video.attachNoProject')}</p>
  const list = screens ?? []

  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      <p className="text-body font-medium text-ink">{t('video.attachTitle')}</p>
      <p className="measure mt-1 text-body-sm text-ink-muted">{t('video.attachHint')}</p>
      {list.length === 0 ? (
        <p className="mt-2 text-body-sm text-ink-faint">{t('video.attachNoScreens')}</p>
      ) : (
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {list.map((s) => {
            const mine = s.attachedHash === hash
            const thumb = getThumb(s.id, s.code)
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onAttach(s.id, hash)}
                  className={`block w-full overflow-hidden border p-1 text-left transition ${
                    mine ? 'border-accent bg-accent/10' : 'border-line-soft hover:border-line'
                  }`}
                >
                  {thumb ? (
                    <img src={thumb} alt="" className="block aspect-[4/3] w-full object-cover object-top" />
                  ) : (
                    <span className="flex aspect-[4/3] w-full items-center justify-center bg-ink/5 text-ink-faint">
                      <Icon name="image" size={20} />
                    </span>
                  )}
                  <span className="mt-1 block truncate text-caption text-ink">{s.name}</span>
                  {mine && <span className="block text-caption text-accent-ink">{t('video.attachedHere')}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
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
    /*
     * Its own heading, and the ids with it.
     *
     * Reaching this means the server's guard fired where the panel's two gates
     * did not — a tab left open across a reload, a montage assembled somewhere
     * else, a client that never had the gates at all. The person has to be able
     * to find WHICH picture, and the timeline is the only place it still shows.
     */
    case 'pending-images':
      return { titleKey: 'video.errPending', bodyKey: 'video.errPendingHint', pending: e.pendingImageIds }
    case 'no-provider':
      return { titleKey: 'video.errNoProvider', bodyKey: 'video.errNoProviderHint', detail: e.message }
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
      /*
       * The provider's own words, when it left any.
       *
       * A batch where every variant failed answers 502 with one notice per
       * failed axis, and those sentences are the whole diagnosis: a 422 naming
       * the field fal did not recognise, a key it refused, a model that turned
       * out to be text-to-image. Dropping them left "no variant could be
       * produced" — a sentence that tells the reader only what they had already
       * seen on screen, and sent me reading container logs to find a field name
       * the server had already been told.
       */
      return {
        titleKey: 'common.error',
        detail: e.notices.length ? e.notices.join(' · ') : e.message,
      }
  }
}

