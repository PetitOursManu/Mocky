import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { confirmImage, generateImage, imageUrl } from '../lib/imageLibrary'
import {
  IMAGE_CAP,
  addImage,
  addImages,
  aspectRatioOverridden,
  composeBlocker,
  effectiveAspectRatio,
  emptyDraft,
  filmDurationMs,
  filmSummary,
  forcedThreeD,
  formatSeconds,
  pictureScenes,
  proposalStale,
  removeImage,
  renderBlocker,
  setAspectRatio,
  setBrief,
  setForceThreeD,
  setOutputFormat,
  toRenderInputFrom,
  withProposal,
  type ComposeBlocker,
  type RenderBlocker,
  type VideoDraft,
} from '../lib/video/draft'
import {
  BRIEF_IMAGE_BLOCKER_KEYS,
  MIN_BRIEF_IMAGES,
  briefImagesBlocker,
  briefImagesCeiling,
  briefImagesDiscarded,
  briefImagesStep,
  clampBriefImageCount,
  emptyBriefImages,
  plannedBriefImages,
  resetBriefImages,
  toggleBriefChosen,
  type BriefImagesState,
} from '../lib/video/briefImages'
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
  jobBudgetMs,
  OUTPUT_FORMATS,
  type KenBurns,
  type RenderTimeline,
  type VideoTheme,
} from '../lib/video/timeline'
import {
  FRAME_DIMENSIONS,
  SOURCE_DIMENSIONS,
  formatMagnification,
  undersizedScenes,
  worstMagnification,
  type PixelSize,
  type TemplateOrAuto,
} from '../lib/video/resolution'
import { themeFromDesign } from '../lib/video/theme'
import { directionBriefFrom } from '../lib/video/directionBrief'
import { mergeFilmTheme, themeFromBrief, type ThemeColorRole } from '../lib/video/briefTheme'
import { getThumb } from '../lib/thumbnails'
import { ImagePicker } from './ImagePicker'
import {
  Banner,
  Button,
  ButtonLink,
  Field,
  Icon,
  IconButton,
  Modal,
  Segmented,
  Select,
  Spinner,
  Textarea,
} from '../ui'
import { useLang, useT } from '../i18n'

/**
 * Where the optional pictures come from. NOT what kind of film is being made.
 *
 * That distinction is the whole point of this rewrite. The switch used to choose
 * between two ways of FILLING A TIMELINE, beside a grid of six composition cards
 * — six layouts, twenty scene rows, and a duration slider each. None of that is
 * on the panel any more: the model composes the film, and the only thing this
 * switch still separates is where a picture comes from — one that already exists
 * in the media library, or one being generated now.
 *
 * A session preference, deliberately not persisted: which way somebody wants
 * their pictures is a fact about the film they are making now, and a setting
 * that remembered it would open the panel on the paid path for a user who chose
 * that once, months ago, for one project.
 *
 * There is a THIRD source and it is deliberately not a third position here —
 * `GenerateFromBrief` makes pictures out of the film's own context, and it is an
 * opt-in that applies whichever picker is showing. A radio would have made
 * asking for pictures mean giving up the library, which is backwards: somebody
 * who has two photographs and wants two more is the ordinary case.
 */
export type FillMode = 'library' | 'generate'

export const FILL_MODE_KEYS: Record<FillMode, string> = {
  library: 'video.fromLibraryTitle',
  generate: 'video.fromImageTitle',
}

/**
 * Why "Propose a film" will not fire, and why "Start the render" will not.
 *
 * Two maps of one entry each, which looks like an over-formality and is the
 * convention this panel is held to: the reason is named next to the disabled
 * button, in the reader's language, and a control that refuses to fire without
 * saying why is what this whole screen was built to avoid. They are kept apart
 * because they are about different buttons — and because the failure they guard
 * is different in kind: one is a sentence nobody wrote, the other is a film
 * nobody has composed yet.
 *
 * Held as KEYS rather than sentences, like every other map on this panel: the
 * component calls `t(COMPOSE_BLOCKER_KEYS[blocker])`, so no repo-wide scan for
 * `t('…')` literals would ever see these, and a test is the only thing that can.
 */
export const COMPOSE_BLOCKER_KEYS: Record<ComposeBlocker, string> = {
  'no-brief': 'video.composeNeedBrief',
}

export const BLOCKER_KEYS: Record<RenderBlocker, string> = {
  'no-proposal': 'video.blockedNoProposal',
}

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
 * ── Three fields, and the model does the rest ────────────────────────────────
 *
 * This panel used to open on a grid of composition cards and grow a row per
 * scene, each with a duration slider, a camera move, a transition and its
 * composition's own text boxes. It is gone. Choosing among five layouts and then
 * dialling twenty rows is exactly what made every export look like the same five
 * exports, and it asked the person with the least information — the one who has
 * not seen a single frame — to make the decisions that need the most.
 *
 * What is left is what only a person knows: what the film is about, which
 * pictures it may use, and what comes out of it. `POST /api/video/compose`
 * answers with a whole document, and it is rendered as it came.
 *
 * ── The one recourse that stays ──────────────────────────────────────────────
 *
 * A plan nobody can see and nobody can refuse is a plan people submit to. So two
 * things survive the scene editor's removal, and only two.
 *
 * **One sentence about the film.** How many shots, how long, what shape — read
 * off the document, never written by a model. Not a scene list: that is the
 * thing the user asked not to be shown, and it is also the thing that invites
 * the question "how do I change scene 3?", which has no answer any more.
 *
 * **Ask again.** The compose button stays live after a proposal, and asking for
 * another film is the whole of the recourse.
 *
 * ── One press renders, too ────────────────────────────────────────────────────
 *
 * A proposal used to be inert: it costs one model call and seconds, a render
 * costs minutes of somebody else's CPU, and keeping them behind two buttons
 * meant nobody paid for a render before deciding the proposal was worth looking
 * at. That was deliberate, and it cost a second click to see the one thing this
 * whole panel exists to produce — a film. The user asked for the obvious fix:
 * pressing "Generate the film" now renders what comes back, without a second
 * gesture, and the button never turns into a different one to do it — see
 * `propose` for how, and for what still guards the render nobody asked for.
 *
 * "Start the render" is not gone. It survives as the retry for the render half
 * alone: a worker briefly unreachable or a quota hit fails the automatic render
 * without touching the film that was composed, and re-asking the model for a new
 * one to try again would spend a call this panel already paid for. Pressing it
 * asks for nothing new — see `launchRender`.
 *
 * ── Two modifiers, and neither is a setting ──────────────────────────────────
 *
 * Nothing above changed when these arrived: there is still no composition to
 * choose, no scene list and no scene parameter. What was added is one thing a
 * person can ask FOR and one thing they can ask to be MADE, and both are opt-in.
 *
 * **3D.** A pressed button beside "Generate the film", present only for an
 * account the administrator allowed. It does not describe a rendering — it makes
 * the prompt insist on one set piece out of the same closed catalogue — and the
 * server re-checks the permission at both doors, because hiding a control is
 * presentation while refusing a document is the control. It is honest about
 * costing render time, since the person waiting is the one who pressed it.
 *
 * **Pictures from the brief.** A tick box in the picture block that turns the
 * context already typed above into one to four generated stills. It asks for no
 * second subject — that would be asking the same person the same question twice
 * — it says how many paid calls it is about to make before it makes them, and
 * every picture it produces is `pending` until somebody has looked at it here.
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
  // The footer prints a duration and a magnification, and `1,9` and `1.9` are
  // different numbers to a French reader.
  const [lang] = useLang()
  const [access, setAccess] = useState<VideoAccess | null>(null)
  const [accessFailed, setAccessFailed] = useState(false)
  const [draft, setDraft] = useState<VideoDraft>(emptyDraft)
  const [job, setJob] = useState<VideoJob | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [pollStumbled, setPollStumbled] = useState(false)
  const [starting, setStarting] = useState(false)
  const [proposing, setProposing] = useState(false)
  /**
   * Where pictures are taken from. Component state, so it survives every round
   * trip inside the open panel and nothing more — see `FillMode`.
   */
  const [fill, setFill] = useState<FillMode>('library')
  /** What the server said about the proposal. English, verbatim — see the banner. */
  const [notices, setNotices] = useState<string[]>([])

  /**
   * The project's direction, as the handful of tokens a film may carry.
   *
   * Derived once per direction rather than per keystroke: `parseDesignSpec` walks
   * a markdown document, and this panel re-renders on every character typed into
   * the brief. That is also why the brief's own colours are a SECOND memo below
   * rather than a second argument here — the cheap parse runs on every character,
   * the expensive one does not.
   *
   * It travels to BOTH doors — `/compose` and `/render` — because both attach it
   * server-side, and a proposal that came back in the project's colours while the
   * render used somebody else's would be two films from one panel. Neither door
   * shows it to a model: the schema a composed document is validated against has
   * no `theme` key at all, and the server writes it only after that validation.
   */
  const projectTheme = useMemo<VideoTheme | null>(() => themeFromDesign(direction), [direction])
  /**
   * And the same document read for its WORDS, which travel to `/compose` alone.
   *
   * The two halves of one direction, and this panel was sending only the first:
   * the composer at project creation has sent both since `directionBrief.ts`
   * existed, so the same project composed from here produced films the direction
   * had coloured and not shaped. That is the asymmetry, not a decision — strip
   * the colours out of two films and the prose is the only thing left that tells
   * them apart.
   *
   * It does not reach `/render`, and the difference is the whole of rule 9: a
   * theme is attached to the document after validation and is part of the film,
   * while this is prose shown to a model in the user turn as data (Q5) and is
   * spent the moment the composition comes back. Memoised on the same document
   * for the same reason as the theme above it.
   */
  const directionWords = useMemo(() => directionBriefFrom(direction), [direction])
  /**
   * And the colours the user asked for, which come FIRST.
   *
   * Not a loosening of the rule that the model never writes a theme — the model
   * is not involved at all here, and nothing of this reaches the prompt. What it
   * says is that "declared" has two sources: a brief that names a ground is a
   * statement by the same person the dossier came from, made more recently and
   * about this film. It wins token by token, so asking for one colour does not
   * cost the project's typefaces. See `src/lib/video/briefTheme.ts`.
   */
  const briefTheme = useMemo<VideoTheme | null>(() => themeFromBrief(draft.brief), [draft.brief])
  const { theme, fromBrief } = useMemo(
    () => mergeFilmTheme(projectTheme, briefTheme),
    [projectTheme, briefTheme],
  )

  /**
   * Which pictures are smaller than the frame they are about to fill.
   *
   * The other half of "the video is pixelated", and the half no encoder setting
   * reaches: a 1024×1024 still in a 1920×1080 film is enlarged 1.88× by
   * `object-fit: cover` before a byte gets to the encoder, and a camera move
   * spends 12% more. `src/lib/video/resolution.ts` carries the arithmetic.
   *
   * Recomputed live rather than asked of the server, and that is the whole point
   * of doing it here: the answer changes with the aspect ratio and with the film
   * that has been proposed, and it has to be on screen while a picture can still
   * be swapped for a bigger one. A render is two minutes; a notice that arrives
   * with the finished file is a receipt, not a warning.
   *
   * It measures the PROPOSED film once there is one — the pictures it really
   * paints, which for a composed scene are on the background and inside the
   * blocks — and the selection before that. The two are not the same list: the
   * model is free to leave a picture out, and warning about a photograph that
   * ends up in no frame is the crying wolf that gets a warning ignored.
   */
  const film = draft.proposal?.timeline ?? null
  const filmPictures = useMemo(
    () =>
      film
        ? pictureScenes(film)
        : draft.imageIds.map((imageId) => ({ imageId, kenBurns: 'static' as KenBurns })),
    [film, draft.imageIds],
  )
  // The selection is measured as well as the film's own pictures, so the warning
  // is already on screen when somebody picks a small image — before a call has
  // been spent, which is the one moment it is cheapest to act on.
  const measuredIds = useMemo(
    () => [...draft.imageIds, ...filmPictures.map((p) => p.imageId)],
    [draft.imageIds, filmPictures],
  )
  const sizes = useIntrinsicSizes(measuredIds)
  /** `auto` until a film exists: the floor, never a guess. See `motionOverscale`. */
  const filmTemplate: TemplateOrAuto = film?.template ?? 'auto'
  const filmAspectRatio = effectiveAspectRatio(draft) ?? draft.aspectRatio
  const undersized = useMemo(
    () => undersizedScenes(filmPictures, { template: filmTemplate, aspectRatio: filmAspectRatio }, (id) => sizes[id]),
    [filmPictures, filmTemplate, filmAspectRatio, sizes],
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

  /**
   * A 3D button that is no longer allowed must not stay pressed.
   *
   * The draft can outlive the permission: /status is read again after a 403, and
   * an administrator narrowing the setting while this panel is open takes the
   * button off the screen with `access.threeD`. Left `true` underneath, the
   * draft would go on differing from every proposal's recorded request, and
   * `proposalStale` would mark a perfectly good film stale for ever — with no
   * control anywhere to unmark it, because the control is what just vanished.
   *
   * It clears the ambition and never grants one: this cannot set the flag.
   */
  useEffect(() => {
    if (access && access.threeD !== true) {
      setDraft((d) => (d.forceThreeD ? setForceThreeD(d, false) : d))
    }
  }, [access])

  // ---- polling ----------------------------------------------------------

  /** When this browser first saw the job rendering. See `pollDeadlinePassed`. */
  const renderingSince = useRef<number | null>(null)

  /**
   * How long to wait before saying the render stopped answering.
   *
   * Not the duration ceiling, which is how long a FILM may be. Rendering 1080p
   * in a headless browser costs about four times real time, so a minute of film
   * is minutes of render, and using the ceiling here told a user their long film
   * had timed out while the worker was calmly working on it — after which the
   * finished export appeared in Media with no panel left to show it.
   *
   * The JOB's own timeline first, and the proposal only as a fallback. The case
   * that made the order matter is a panel reopened on a render started before it
   * was closed: there is no proposal in this browser then, and a deadline
   * computed from an empty draft is the shortest possible one applied to the
   * longest film somebody has.
   */
  const pollBudgetMs = jobBudgetMs(filmDurationMs(job?.timeline ?? film))

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
   * Ask the composer for a film — and, once one comes back, render it.
   *
   * No confirmation, and its absence is a decision rather than an oversight.
   * This button used to overwrite a timeline somebody had spent ten minutes
   * arranging by hand, which is why it asked; there is no hand work left to
   * lose. What it replaces now is the previous PROPOSAL — a model's answer, not
   * a person's — and replacing it is the whole point: asking again is the one
   * recourse this panel keeps, and putting a dialog in front of it would make
   * the recourse cost more than the thing it is a recourse for.
   *
   * No `template` either. The catalogue the model is shown is the whole
   * catalogue, and picking from it is its job — naming one here is exactly the
   * choice this panel stopped asking a person to make.
   *
   * ── The old proposal does not wait around ────────────────────────────────
   *
   * A fresh press clears the panel first — the previous film AND whatever job
   * came of it — exactly as pressing "Nouveau montage" does. That reverses a
   * choice this file used to make on purpose: a proposal used to survive a
   * re-compose that came back empty, because the reasons a compose call fails —
   * no model configured, a provider that hung up, a document the schema
   * refused — have nothing to do with the film already accepted, and taking a
   * renderable film away as the price of asking a question was the opposite of
   * a recourse. The user asked for the other trade-off: a second press should
   * read as starting over, not as "maybe". The cost is real, so it is named
   * rather than hidden — if THIS call fails, or if it succeeds but the render
   * that follows does not, the panel is back to `no-proposal` with nothing to
   * show and nothing to attach to a screen. That is exactly the state the old
   * behaviour existed to avoid, and it is the price of the trade the user chose.
   *
   * ── One press, one film ───────────────────────────────────────────────────
   *
   * A successful answer is handed straight to `launchRender`, built from
   * `timeline` — the document this call just received — and not from
   * `draft.proposal`: `setDraft` below has not been applied to `draft` yet in
   * this closure, `React.useState`'s setter runs on the next render, and
   * `launchRender` firing off state that has not caught up would either render
   * nothing (`draft.proposal` still cleared) or the film this call just
   * replaced. `toRenderInputFrom` is what lets it read `timeline` directly.
   *
   * The recourse that survives this is the spinner's own cancel: pressed while
   * `proposing` is true, it aborts the compose call before a render is ever
   * asked for, so nobody pays for a render built from a document they changed
   * their mind about mid-call. Once the compose answer is in hand, though, the
   * render follows without asking again — unless `/status` already said the
   * worker is unreachable, which is the one refusal the panel can read off a
   * fact instead of discovering by spending the attempt. See the call site.
   */
  async function propose() {
    proposeCtrl.current?.abort()
    const ctrl = new AbortController()
    proposeCtrl.current = ctrl
    setProposing(true)
    setFailure(null)
    setNotices([])
    // Disappears on sight, like "Nouveau montage" — see the docstring above.
    setJob(null)
    setPollStumbled(false)
    onJobId(null)
    setDraft((d) => (d.proposal ? { ...d, proposal: null } : d))
    /*
     * What was really asked for, computed once and used twice — in the request
     * and in what the proposal records about it.
     *
     * `forcedThreeD` and not `draft.forceThreeD`: the permission wins over the
     * button, so a draft that outlived an administrator's decision never spends
     * a round trip discovering it. The two agree in every ordinary case.
     */
    const threeD = forcedThreeD(draft, access?.threeD)
    try {
      const proposal = await proposeVideoTimeline(draft.brief, draft.imageIds, {
        signal: ctrl.signal,
        theme,
        forceThreeD: threeD,
        // The dossier's own words. See `directionWords`: not the theme, and it
        // stops at this door.
        direction: directionWords,
      })
      // A newer proposal (or the panel closing) owns the panel now. Writing this
      // one in would replace the answer the user is actually waiting for.
      if (proposeCtrl.current !== ctrl) return
      setNotices(proposal.notices)
      /*
       * Whatever came back, kept whole — including `composed`, which is now the
       * point rather than the exception. The panel used to refuse it and load
       * only the five it had rows for; there are no rows, so there is nothing
       * left for a stack of typed blocks to be incompatible with.
       */
      if (proposal.timeline) {
        const timeline = proposal.timeline
        setDraft((d) => withProposal(d, timeline, threeD))
        /*
         * Single gesture: see the docstring above. `draft.outputFormat` and
         * `draft.aspectRatio` are read from THIS closure rather than a fresher
         * one — both selectors are disabled while `proposing` is true, so
         * neither can have moved since this call started.
         *
         * Except when the panel already KNOWS the render cannot start. An
         * unreachable worker is the one refusal `/status` reports before it is
         * asked for, and the panel has been showing `video.workerDown` at the
         * top of the body the whole time; firing anyway would replace that
         * sentence — which says what to do — with a transport error under the
         * footer, and would do it for a film that composed correctly. The
         * footer's own button carries the same condition, so the film simply
         * waits there for a worker that answers, which is what "Lancer le
         * rendu" survives for.
         */
        if (access?.worker.available) {
          await launchRender(timeline, draft.outputFormat, draft.aspectRatio)
        }
      }
    } catch (e) {
      // An abort is this panel cancelling, not something that went wrong.
      if ((e as { name?: string })?.name === 'AbortError') return
      setFailure(describe(e))
      /*
       * A 403 is a permission that moved under the panel, and this door cannot
       * say which one: it refuses a REQUEST for 3D before a document exists, so
       * it has no block list to send and one status covers "Motion is off" and
       * "3D is off".
       *
       * So the panel asks rather than guesses. /status answers with a fact, and
       * re-reading it also takes the offending control off the screen — which a
       * better-worded banner would not have done, leaving a button whose only
       * possible outcome is this same banner again.
       */
      if (e instanceof VideoExportError && e.status === 403) {
        fetchVideoAccess()
          .then(setAccess)
          .catch(() => {
            // The banner above already says the request was refused. Failing to
            // re-read the permission is not a second thing to report.
          })
      }
    } finally {
      if (proposeCtrl.current === ctrl) setProposing(false)
    }
  }

  function cancelPropose() {
    proposeCtrl.current?.abort()
    proposeCtrl.current = null
    setProposing(false)
  }

  /**
   * Queue a render for a document the composer already wrote.
   *
   * Takes the timeline and the two output settings as plain values rather than
   * reading `draft.proposal` — see the note above `propose` on why: the
   * single-gesture render fires the instant a compose call answers, before
   * `setDraft(withProposal(...))`'s update has necessarily reached `draft` in
   * that closure. `toRenderInputFrom` (the pure half of `toRenderInput`) is
   * what makes building the request from a plain timeline possible at all.
   *
   * Called from two places, and that is the whole reason it exists apart from
   * `propose`: automatically, the instant a proposal comes back, and by hand
   * from `start` — the footer's "Lancer le rendu" — when the automatic one
   * failed. A worker briefly unreachable or a quota hit fails the RENDER
   * without touching the film that was composed for it, and asking the model
   * again to get back the SAME document would spend a call this panel already
   * paid for.
   */
  async function launchRender(timeline: RenderTimeline, outputFormat: VideoDraft['outputFormat'], aspectRatio: VideoDraft['aspectRatio']) {
    setStarting(true)
    setFailure(null)
    setPollStumbled(false)
    try {
      const input = toRenderInputFrom(timeline, outputFormat, aspectRatio)
      // The project travels with the render, and it is what makes the finished
      // film findable afterwards: the store is content-addressed, so once the
      // bytes exist nothing else knows where they were cut from.
      const queued = await startVideoRender(input, { project: projectId, theme })
      setJob(queued)
      onJobId(queued.id)
    } catch (e) {
      setFailure(describe(e))
    } finally {
      setStarting(false)
    }
  }

  /**
   * The footer's "Lancer le rendu" — a render, and never a new film.
   *
   * The single gesture in `propose` covers the ordinary case; this is what is
   * left for the one it does not: the automatic render failed and the film it
   * failed on is still on the panel, still good. Re-composing would ask the
   * model for a new document to try again, on a call this panel already paid
   * for — this asks `launchRender` for the SAME one instead.
   */
  async function start() {
    /*
     * No proposal, no timeline — and no render.
     *
     * `draft.proposal` answers nothing rather than assembling anything, which
     * is the repair this feature refuses everywhere: a film nobody composed is
     * not a film anybody asked for. The button is already disabled by the
     * `no-proposal` blocker; this is the guard that makes the rule true rather
     * than merely displayed.
     */
    const timeline = draft.proposal?.timeline
    if (!timeline) return
    await launchRender(timeline, draft.outputFormat, draft.aspectRatio)
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
    // Everything the next proposal will be composed from is frozen while a call
    // is out. A picture added mid-call is one the model was never shown, on a
    // film that comes back looking as though it had been.
    const frozen = live || proposing
    const composeBlocked = composeBlocker(draft)
    /** How many more pictures the pool can hold — see `IMAGE_CAP`. */
    const room = IMAGE_CAP - draft.imageIds.length

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
            did not happen, and the film already accepted is deliberately left
            alone. `warn` rather than `danger` — an image left out of an
            otherwise good proposal is a remark, not a failure. The server's own
            words, kept verbatim, for the reason the error banner gives above. */}
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
          The one thing only a person knows, so the first thing on the panel.

          There is no composition picker above it any more, and that absence is
          the feature: six cards asking somebody who has seen no frame to choose
          a layout is the decision that made every export look alike. What is
          asked for here is the film's subject; the model answers with the film.
        */}
        <div className="mt-4 border border-line-soft bg-ink/5 p-3">
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('video.composeTitle')}</span>
          </div>
          <Field label={t('video.composeBrief')} hint={t('video.composeHint')}>
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                value={draft.brief}
                disabled={frozen}
                maxLength={BRIEF_MAX_LENGTH}
                placeholder={t('video.composePlaceholder')}
                // Read BEFORE the updater, never inside it — see the note on the
                // container select below.
                onChange={(e) => {
                  const brief = e.currentTarget.value
                  edit((d) => setBrief(d, brief))
                }}
              />
            )}
          </Field>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" disabled={frozen || composeBlocked !== null} onClick={propose}>
              <Icon name="sparkle" size={15} />
              {/* The label changes once a film exists, because the button's
                  meaning does: the second press is the recourse — "not this one,
                  try again" — and a button still reading "Generate the film"
                  beside a film that is already there reads as having done
                  nothing. The verb is the same in both; the object is not. */}
              {proposing ? t('video.composing') : t(draft.proposal ? 'video.composeAgain' : 'video.compose')}
            </Button>
            {/*
              The 3D button, and it is absent rather than disabled for an account
              that may not spend one.

              Absence is the honest state here: a greyed control invites "why is
              this off for me", which has no answer this panel is allowed to give
              — /status answers a BOOLEAN about the account and deliberately not
              the mode or the list. And absence is only presentation: `/compose`
              refuses a forced request and `/render` refuses a document carrying
              a 3D block, both from the config on every call, so a stale tab
              cannot spend one.

              `active` rather than a checkbox: it is a modifier on the button
              beside it, pressed or not, and `Button` sets aria-pressed from it.
              The label is "3D" in both languages, so `title` carries the rest.
            */}
            {access.threeD === true && (
              <Button
                size="sm"
                active={draft.forceThreeD}
                disabled={frozen}
                title={t('video.threeDForceLabel')}
                onClick={() => edit((d) => setForceThreeD(d, !d.forceThreeD))}
              >
                {t('video.threeDForce')}
              </Button>
            )}
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
              {t('video.briefCount', { n: draft.brief.length, max: BRIEF_MAX_LENGTH })}
            </span>
          </div>
          {/* Next to the disabled button: a control that will not fire and will
              not say why is what this whole panel was built to avoid. */}
          {composeBlocked && !proposing && (
            <p className="measure mt-1.5 text-body-sm text-ink-muted">{t(COMPOSE_BLOCKER_KEYS[composeBlocked])}</p>
          )}
          {/* Said when the button is DOWN, which is when it applies. A render in
              3D is longer — the deadline is scaled to the film's duration, so it
              is not a risk of failure — and somebody watching a spinner for
              longer than last time deserves the reason rather than a suspicion. */}
          {access.threeD === true && draft.forceThreeD && (
            <p className="measure mt-1.5 text-body-sm text-ink-muted">{t('video.threeDForceOn')}</p>
          )}
        </div>

        {/*
          The pictures — optional, and said to be.

          They were the montage itself when a scene was a picture; a composed
          film can be words, shapes and movement with no photograph anywhere in
          it. So this is a POOL offered to the composer, not a running order: no
          number beside a thumbnail, no arrows, nothing that implies scene three.

          The switch is where a picture comes FROM. Both halves stay mounted —
          hidden, never unmounted — because the variant flow holds a picture the
          provider has already been paid for and nobody has confirmed yet, plus a
          call that may be in flight. Unmounting it would abort that call and
          forget that image, which is not a deletion (M8): it would stay on the
          volume, pending for good, with nothing left pointing at it.
        */}
        <div className="mt-4 border border-line-soft bg-ink/5 p-3">
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('video.sourceTitle')}</span>
            <span className="ml-auto flex items-center gap-3">
              <span className="font-mono text-caption text-accent-ink">
                {t('video.imageCount', { n: draft.imageIds.length, max: IMAGE_CAP })}
              </span>
              <Segmented
                label={t('video.sourceTitle')}
                value={fill}
                options={[
                  { value: 'library', label: t(FILL_MODE_KEYS.library) },
                  { value: 'generate', label: t(FILL_MODE_KEYS.generate) },
                ]}
                /* Segmented turns itself off when the active segment is clicked
                   again — correct for a canvas mode, wrong here: there is no
                   third state, and clicking the position you are already on
                   would empty the block. */
                onChange={(v) => v && setFill(v)}
              />
            </span>
          </div>
          <p className="measure text-body-sm text-ink-muted">{t('video.sourceHint')}</p>

          {/*
            The third place a picture can come from, and the one that is not on
            the switch.

            The switch answers "which of these two pickers am I using"; this
            answers "make some for me, out of what I already wrote". It is an
            opt-in and not a third segment for that reason — it applies whichever
            picker is showing, and a radio position would have made choosing it
            mean giving up the library.

            It is not `StartFromImage` again either, and the difference is the
            SUBJECT. That path asks for one of its own, makes a model image,
            gates it and derives siblings from it — a whole decision about one
            photograph. This one has no subject to ask for: the brief is three
            centimetres above, and asking for it twice is asking twice.
          */}
          <GenerateFromBrief
            projectId={projectId}
            brief={draft.brief}
            aspectRatio={draft.aspectRatio}
            room={room}
            disabled={frozen}
            onAdd={(hashes) => edit((d) => addImages(d, hashes))}
            onFailure={setFailure}
          />

          <ChosenImages ids={draft.imageIds} disabled={frozen} onRemove={(id) => edit((d) => removeImage(d, id))} />

          <div hidden={fill !== 'library'} className="mt-3">
            {room <= 0 ? (
              <p className="text-body-sm text-ink-faint">{t('video.imagesFull', { max: IMAGE_CAP })}</p>
            ) : (
              <ImagePicker
                projectId={projectId}
                heading={t('video.pickScene')}
                selected={draft.imageIds}
                disabled={frozen}
                onPick={(hash) => edit((d) => addImage(d, hash))}
                onError={(message) => setFailure({ titleKey: 'common.error', detail: message })}
              />
            )}
          </div>

          {/* Beside the library picker, never instead of it. That one is how
              somebody uses pictures they already have and stays the short way
              in; this one is for when they do not exist yet, and it costs up to
              seven provider calls and two confirmations to walk. */}
          <div hidden={fill !== 'generate'} className="mt-3">
            <StartFromImage
              projectId={projectId}
              access={access}
              aspectRatio={draft.aspectRatio}
              room={room}
              cap={IMAGE_CAP}
              disabled={frozen}
              onAdd={(hashes) => edit((d) => addImages(d, hashes))}
              onFailure={setFailure}
            />
          </div>
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
        {/* The one case where the selector above does not decide: a vertical cut
            is typed on the literal `9:16`, so forcing another ratio onto it
            would not widen the film, it would refuse the document. Said as a
            fact rather than by disabling the control, which would leave somebody
            wondering why their ratio stopped working. */}
        {aspectRatioOverridden(draft) && (
          <p className="measure mt-1.5 text-body-sm text-ink-muted">{t('video.aspectLockedVertical')}</p>
        )}

        {/* What the film will LOOK like, next to what comes out of it. Nobody
            chooses this and nothing here can: see `ThemeNote`. */}
        <div className="mt-3 border border-line-soft bg-ink/5 p-3">
          <ThemeNote
            theme={theme}
            fromProject={Boolean(projectTheme)}
            fromBrief={fromBrief}
            hasDirection={Boolean(direction && direction.trim())}
          />
        </div>
      </>
    )
  })()

  /*
   * The proposed film and the render button live in the Modal's FOOTER, which is
   * `shrink-0` while the body scrolls.
   *
   * The footer used to carry a duration budget, because the film was assembled
   * upstairs a slider at a time and the sum could quietly cross two minutes. The
   * schema is what refuses that now — nothing on this panel can build an
   * over-long film — so what is pinned here is the pair of facts worth having
   * under your eye at the moment of spending: what is about to be rendered, and
   * whether any of its pictures is too small for the frame.
   */
  const footer = access?.enabled ? (
    <div className="w-full">
      <ProposalNote draft={draft} lang={lang} />
      {/*
        In the FOOTER for the reason everything here is: this is the pinned
        strip. A note about definition that lives next to a picker is a note
        somebody scrolls past on the way to the button — and this one has exactly
        one moment to be read, the moment before two minutes of somebody else's
        CPU are spent.

        It never disables the button. A soft still is a film people ship on
        purpose, and refusing it would be the panel overruling a judgement that is
        not its own (Q1). It says how bad the worst one is, and that the only
        remedy is a larger original.
      */}
      {undersized.length > 0 && (
        <p className="measure mt-1.5 text-body-sm text-warn">
          {t('video.resFooter', {
            n: undersized.length,
            w: FRAME_DIMENSIONS[filmAspectRatio].width,
            h: FRAME_DIMENSIONS[filmAspectRatio].height,
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
            // A render started here would queue the film that is about to be
            // replaced, and pay minutes of CPU for one nobody will look at.
            proposing ||
            job?.status === 'queued' ||
            job?.status === 'rendering' ||
            !access.worker.available ||
            renderBlocker(draft) !== null
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
 * The pictures the composer will be given, and the one thing that can be done to
 * them: take one back out.
 *
 * A strip and not a list of rows. The rows this replaces were SCENES — numbered,
 * reorderable, each with a duration and a camera move — and every one of those
 * affordances now belongs to the model. What is left is a pool, so the strip
 * says nothing about order and nothing about what any picture becomes: it is the
 * receipt for "these are the images it may use", and its only control is the one
 * that would otherwise be impossible, since the picker below only ever adds.
 *
 * The remove button is a real button with an accessible name rather than a cross
 * drawn on the thumbnail, because this is the one destructive control in the
 * block and it has to be reachable from the keyboard like everything else here.
 */
function ChosenImages({
  ids,
  disabled,
  onRemove,
}: {
  ids: string[]
  disabled: boolean
  onRemove: (imageId: string) => void
}) {
  const t = useT()
  // Nothing at all, said in a sentence: an empty strip would read as a grid that
  // failed to load, and "no pictures" is a legitimate film here rather than an
  // unfinished form.
  if (ids.length === 0) return <p className="mt-2 text-body-sm text-ink-faint">{t('video.noImages')}</p>

  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {ids.map((id) => (
        <li key={id} className="relative">
          <img src={imageUrl(id)} alt="" className="h-16 w-24 border border-line-soft object-cover" />
          {/* On its own opaque ground rather than floated over the photograph:
              a quiet icon on an arbitrary picture is a control whose contrast is
              whatever that picture happens to be. */}
          <span className="absolute right-0.5 top-0.5 border border-line-soft bg-surface">
            <IconButton label={t('video.removeImage')} variant="quiet" disabled={disabled} onClick={() => onRemove(id)}>
              <Icon name="trash" size={14} />
            </IconButton>
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * A grid of pictures nobody has confirmed yet, each with a tick box.
 *
 * Both gates in this panel draw this one component: the variants taken from a
 * model image, and the pictures made from the film's own brief. They ask the
 * same question about the same kind of object — "which of these unconfirmed
 * pictures are worth keeping?" — and written twice, two answers to one question
 * start differing in their hit area, their keyboard behaviour and, eventually,
 * in whether anything is ticked to begin with.
 *
 * The label wraps the checkbox AND the picture, so the whole cell is the target:
 * a 96-pixel image beside a 13-pixel box is a control people miss.
 *
 * `note` is whatever the server said about that one — the variant's axis, and
 * nothing at all for a picture made from a brief. Untranslated on purpose where
 * it exists: it is the server's own identifier, and inventing French labels for
 * a field that may grow a sixth value is how a listing ends up showing a key.
 */
function PendingPicks({
  items,
  chosen,
  disabled,
  labelOf,
  onToggle,
}: {
  items: readonly { hash: string; note?: string }[]
  chosen: readonly string[]
  disabled: boolean
  labelOf: (index: number) => string
  onToggle: (hash: string) => void
}) {
  return (
    <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item, i) => (
        <li key={item.hash}>
          <label
            className={`flex cursor-pointer flex-col gap-1 border p-1 ${
              chosen.includes(item.hash) ? 'border-accent bg-accent/10' : 'border-line-soft'
            }`}
          >
            <img src={imageUrl(item.hash)} alt="" className="h-24 w-full object-cover" />
            <span className="flex items-center gap-1.5 text-body-sm text-ink">
              <input
                type="checkbox"
                className="accent-accent"
                checked={chosen.includes(item.hash)}
                disabled={disabled}
                onChange={() => onToggle(item.hash)}
              />
              {labelOf(i)}
            </span>
            {item.note && <span className="font-mono text-caption text-ink-faint">{item.note}</span>}
          </label>
        </li>
      ))}
    </ul>
  )
}

/**
 * Make pictures for THIS film, out of the sentence that is already on the panel.
 *
 * ── Why it is not a third position on the switch ─────────────────────────────
 *
 * The switch above answers "which picker am I using", and both of its positions
 * are ways of CHOOSING an existing picture — one from the library, one derived
 * from a picture somebody settled on. This is not a picker: it is an opt-in that
 * applies whichever of the two is showing. A third radio position would have
 * made asking for pictures mean giving up the library, which is exactly
 * backwards — somebody who has two photographs and wants two more is the
 * ordinary case.
 *
 * ── Why it is not `StartFromImage` with a different label ────────────────────
 *
 * The difference is the SUBJECT, and it is the whole of what this control is
 * for. That path asks for a subject of its own, buys one model image, gates it,
 * and derives siblings from it: a long, careful decision about one photograph,
 * worth its seven provider calls when the picture does not exist yet. This one
 * has no subject to ask for. The brief is three centimetres up the panel, and
 * asking somebody what their film is about twice is asking them twice.
 *
 * So the prompt IS the brief, verbatim. Not a rewrite of it, and not a second
 * model call to turn it into an image prompt: that would be another paid call,
 * another moving part, and a sentence nobody wrote standing between what was
 * asked for and what came back. When the pictures are wrong the recourse is the
 * one the film already has — reword the brief and ask again — and the gate below
 * is what makes that recourse free.
 *
 * ── The two things it must not get wrong ─────────────────────────────────────
 *
 * **It costs money.** Every one of these is a paid provider call, so the number
 * is on screen before the press, twice: in the sentence and in the button's own
 * label. Both read `plannedBriefImages`, so a label promising four over a loop
 * that runs three is not expressible.
 *
 * **Nothing is confirmed by being made.** The pictures arrive `pending: true`
 * and stay out of every listing and every montage until somebody has looked at
 * them here. That is courtesy — the guard is `pendingAmong()` and the 409 in
 * server/video/routes.js — and the courtesy is what stops the server ever having
 * to refuse anybody.
 */
function GenerateFromBrief({
  projectId,
  brief,
  aspectRatio,
  room,
  disabled,
  onAdd,
  onFailure,
}: {
  projectId?: string
  /** The film's own context, and the subject of these pictures. Sent as typed. */
  brief: string
  /**
   * The film's shape, so a picture is MADE for it.
   *
   * `SOURCE_DIMENSIONS` and not the frame's own size — a generator is not a
   * scaler, and asking for 1920×1080 buys artefacts rather than detail. See the
   * table for which buckets these are and why.
   */
  aspectRatio: VideoDraft['aspectRatio']
  /** How many more pictures the pool can hold. `addImage` refuses past the cap. */
  room: number
  disabled: boolean
  onAdd: (hashes: string[]) => void
  /** `null` clears the banner — a fresh attempt should not run under an old refusal. */
  onFailure: (failure: Failure | null) => void
}) {
  const t = useT()
  const [state, setState] = useState<BriefImagesState>(() => emptyBriefImages())
  const [busy, setBusy] = useState<'make' | 'add' | null>(null)

  /** The call in flight, so every step is cancellable and none survives the panel. */
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
  const aborted = (e: unknown) => (e as { name?: string })?.name === 'AbortError'

  const step = briefImagesStep(state)
  const ceiling = briefImagesCeiling(room)
  const planned = plannedBriefImages(state, room)
  const blocker = briefImagesBlocker(state, brief, room)
  const frozen = disabled || busy !== null
  const discarded = briefImagesDiscarded(state)

  /**
   * One call per picture, in series.
   *
   * Series and not `Promise.all`: the default provider is rate-limited, the
   * variants route already spends its six calls one at a time for the same
   * reason, and four parallel requests is how a batch comes back as four
   * failures instead of four pictures.
   *
   * A batch that comes back short still SUCCEEDS, with the shortfall named
   * above the grid — one provider hiccup out of four is a degradation, not a
   * failed request (Q1). Nothing at all is the one case that gets a banner,
   * because a grid of zero would be indistinguishable from a button that did
   * not fire.
   */
  async function make() {
    const mine = begin()
    setBusy('make')
    onFailure(null)
    const made: string[] = []
    let refusal: unknown = null
    try {
      for (let i = 0; i < planned; i++) {
        if (stale(mine)) return
        try {
          const out = await generateImage(brief.trim(), {
            project: projectId,
            // Unconfirmed by construction: the gate below is the whole point.
            pending: true,
            /*
             * A fresh seed per picture, and it is what makes this a batch.
             *
             * The library caches on provider+prompt+seed+size (M8), so four
             * calls with one sentence and no seed are one image served four
             * times — instantly, free, and identical. Correct everywhere else,
             * and the exact opposite of what "generate four" means.
             */
            seed: Math.floor(Math.random() * 2_147_483_647),
            tags: ['video-source'],
            ...SOURCE_DIMENSIONS[aspectRatio],
            signal: mine.signal,
          })
          // Deduplicated on the way in: the store is content-addressed, so two
          // seeds that land on identical bytes are ONE entry, and two tick boxes
          // wired to one picture is a gate that cannot be answered. It counts as
          // a shortfall below, which is the honest reading either way — the call
          // was paid for and there is one fewer picture to choose from.
          if (out && !made.includes(out.hash)) made.push(out.hash)
        } catch (e) {
          if (aborted(e)) return
          // Kept rather than reported here: one failure out of four is a
          // shortfall, and only a batch that produced nothing is a banner.
          refusal = e
        }
      }
      if (stale(mine)) return
      if (made.length === 0) {
        onFailure(refusal ? describe(refusal) : { titleKey: 'common.error', bodyKey: 'video.briefImagesNothing' })
        return
      }
      setState((s) => ({ ...s, batch: made, chosen: [], missed: Math.max(0, planned - made.length) }))
    } finally {
      if (!stale(mine)) setBusy(null)
    }
  }

  /**
   * Confirm what was ticked, then hand it to the pool.
   *
   * Confirmed FIRST, and one at a time, exactly as the variant gate does it:
   * `addImage` on an unconfirmed hash builds a selection that /render refuses
   * with a 409 — the guard doing its job, to somebody who did tick the box. Only
   * the ones that really cleared are offered, and a confirmation that failed is
   * counted out loud (Q1).
   */
  async function addChosen() {
    const mine = begin()
    setBusy('add')
    onFailure(null)
    const confirmed: string[] = []
    let failed = 0
    try {
      for (const hash of state.chosen) {
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
      if (failed) onFailure({ titleKey: 'common.error', bodyKey: 'video.briefImagesConfirmFailed', vars: { n: failed } })
      // Ready for another round rather than switched off: somebody who has just
      // added two and wants two more is in the middle of one decision. What was
      // not ticked stays in the store, unconfirmed for good — that is what the
      // note under the grid warned about, and undoing it here would make the
      // warning false.
      setState(resetBriefImages)
    } finally {
      if (!stale(mine)) setBusy(null)
    }
  }

  function cancel() {
    ctrl.current?.abort()
    ctrl.current = null
    setBusy(null)
  }

  return (
    <div className="mt-2 border border-line-soft p-2">
      {/*
        The opt-in. Unticking HIDES the gate rather than dropping it — a batch
        already paid for comes back when the box is ticked again. Forgetting it
        would not delete anything (M8): those pictures would simply stay on the
        volume, pending for good, with nothing left pointing at them.
      */}
      <label className="flex cursor-pointer items-center gap-2 text-body-sm text-ink">
        <input
          type="checkbox"
          className="accent-accent"
          checked={state.on}
          disabled={frozen}
          onChange={() => setState((s) => ({ ...s, on: !s.on }))}
        />
        {t('video.briefImagesToggle')}
      </label>

      {state.on && (
        <div className="mt-2">
          <p className="measure text-body-sm text-ink-muted">{t('video.briefImagesHint')}</p>

          {step === 'ask' && (
            <>
              {ceiling > 0 && (
                <Field label={t('video.briefImagesCount')} className="mt-2 w-32">
                  {(p) => (
                    <Select
                      {...p}
                      value={String(planned)}
                      disabled={frozen}
                      // Read outside the updater — a synthetic event's
                      // currentTarget is null by the time React runs one. See
                      // the container select at the top of this file.
                      onChange={(e) => {
                        const count = clampBriefImageCount(Number(e.currentTarget.value), room)
                        setState((s) => ({ ...s, count }))
                      }}
                    >
                      {Array.from({ length: ceiling - MIN_BRIEF_IMAGES + 1 }, (_, i) => MIN_BRIEF_IMAGES + i).map(
                        (n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ),
                      )}
                    </Select>
                  )}
                </Field>
              )}
              {/* The bill, before the click. Same number as the button's own
                  label, from the same call — a generation is a paid call, and
                  "how many am I buying" must not be a thing to count afterwards. */}
              {planned > 0 && (
                <p className="measure mt-2 text-body-sm text-ink-muted">{t('video.briefImagesCost', { n: planned })}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm" disabled={frozen || blocker !== null} onClick={make}>
                  <Icon name="image" size={15} />
                  {busy === 'make' ? t('video.briefImagesMaking') : t('video.briefImagesMake', { n: planned })}
                </Button>
                {/* Cancellable, and visibly so: this is a series of paid calls,
                    and the only alternative to a stop button is closing the
                    panel to get out of it. */}
                {busy === 'make' && (
                  <>
                    <Spinner />
                    <Button variant="ghost" size="sm" onClick={cancel}>
                      {t('common.cancel')}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}

          {/* THE GATE. Multiple selection, and nothing ticked to begin with. */}
          {step === 'choose' && state.batch && (
            <div className="mt-3">
              <p className="text-body font-medium text-ink">{t('video.briefImagesGateTitle')}</p>
              <p className="measure mt-1 text-body-sm text-ink-muted">{t('video.briefImagesGateBody')}</p>
              {/* What was paid for and did not arrive. Left unsaid, it is a grid
                  shorter than the number on the button with nothing to account
                  for the difference. */}
              {state.missed > 0 && (
                <p className="measure mt-1 text-body-sm text-warn">{t('video.briefImagesMissed', { n: state.missed })}</p>
              )}
              <PendingPicks
                items={state.batch.map((hash) => ({ hash }))}
                chosen={state.chosen}
                disabled={frozen}
                labelOf={(i) => t('video.briefImageNumber', { n: i + 1 })}
                onToggle={(hash) => setState((s) => toggleBriefChosen(s, hash))}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm" disabled={frozen || blocker !== null} onClick={addChosen}>
                  <Icon name="plus" size={15} />
                  {busy === 'add' ? t('video.adding') : t('video.briefImagesAdd')}
                </Button>
                <span className="font-mono text-caption text-ink-faint">
                  {t('video.variantChosen', { n: state.chosen.length })}
                </span>
                {busy === 'add' && <Spinner />}
              </div>
              {/* Said before the button, not after: what is left unticked stays
                  unconfirmed for good, and that is not a thing to discover later. */}
              {discarded > 0 && (
                <p className="measure mt-1.5 text-body-sm text-ink-muted">
                  {t('video.briefImagesDiscardNote', { n: discarded })}
                </p>
              )}
            </div>
          )}

          {/* Next to the disabled control, as everywhere else on this panel. */}
          {blocker && !frozen && (
            <p className="measure mt-1.5 text-body-sm text-ink-muted">{t(BRIEF_IMAGE_BLOCKER_KEYS[blocker], { room })}</p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The film that is about to be rendered, in one sentence — and the two things
 * that can be said about it without showing its insides.
 *
 * This is the whole of what replaced the scene list, and the line it walks is
 * deliberate. The user asked not to see the scenes and their settings; they did
 * not ask to be handed a film they cannot recognise. Shot count, duration and
 * shape are read off the document — never written by a model, which would make
 * them a claim rather than a fact — and none of them names a layout or invites
 * the question "how do I change scene 3?", which now has no answer.
 *
 * The stale line is the second thing. Editing the brief or the selection after a
 * proposal leaves a film on the panel that answers a question nobody is asking
 * any more, and nothing else on screen could tell. It never blocks the render:
 * that film is still valid, and refusing it would turn a remark into a wall.
 */
function ProposalNote({ draft, lang }: { draft: VideoDraft; lang: string }) {
  const t = useT()
  const summary = filmSummary(draft)
  const blocker = renderBlocker(draft)

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="kicker text-ink">{t('video.proposalTitle')}</span>
        {summary && (
          <span className="font-mono text-body-sm text-ink-muted">
            {t('video.proposalSummary', {
              n: summary.scenes,
              s: formatSeconds(summary.durationMs, lang),
              ratio: summary.aspectRatio,
            })}
          </span>
        )}
      </div>
      {/* Muted, not red: "nothing has been proposed yet" is the state the panel
          OPENS in, and a red line under a disabled button on a panel nobody has
          touched reads as something already broken. */}
      {blocker && <p className="measure mt-1.5 text-body-sm text-ink-muted">{t(BLOCKER_KEYS[blocker])}</p>}
      {proposalStale(draft) && (
        <p className="measure mt-1.5 text-body-sm text-warn">{t('video.proposalStale')}</p>
      )}
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
 *
 * And the brief's own colours get the second line, for a reason the first one
 * does not cover: a colour read out of prose is a READING, and a reading nobody
 * is shown is indistinguishable from a request that was ignored. Somebody who
 * writes "en rouge et noir" gets nothing — which of the two is the ground is the
 * guess this feature refuses to make — and the only thing that turns that into
 * one edit rather than a mystery is the panel saying which roles it understood.
 * The sentence names them; the swatches above already say what colour.
 */
/**
 * The four roles, named for a reader rather than by their schema key.
 *
 * Held as a record beside the component and not inlined, for the reason
 * `BRIEF_IMAGE_BLOCKER_KEYS` gives one module over: a repo-wide scan for
 * `t('video.…')` cannot see a key built by interpolation, so the keys have to be
 * written out somewhere a grep and the parity test can both reach them.
 */
export const THEME_ROLE_KEYS: Record<ThemeColorRole, string> = {
  background: 'video.themeRoleBackground',
  text: 'video.themeRoleText',
  accent: 'video.themeRoleAccent',
  surface: 'video.themeRoleSurface',
}

function ThemeNote({
  theme,
  hasDirection,
  fromProject,
  fromBrief,
}: {
  theme: VideoTheme | null
  hasDirection: boolean
  /**
   * Whether the DIRECTION contributed, as opposed to the merged theme existing.
   *
   * The two came apart the moment a brief could state a colour: a project with
   * no direction and a brief that names a ground has a theme, and printing "the
   * colours come from this project's art direction" over it would be a sentence
   * about a document that does not exist.
   */
  fromProject: boolean
  fromBrief: ThemeColorRole[]
}) {
  const t = useT()
  const colors = theme?.colors ?? {}
  const swatches = (Object.entries(colors) as [string, string | undefined][]).filter(
    (entry): entry is [string, string] => Boolean(entry[1]),
  )
  const fonts = [theme?.fonts?.heading, theme?.fonts?.body].filter(Boolean) as string[]

  return (
    // No border of its own any more: it used to hang under the composition
    // cards, inside their block, and it now IS a block — one rule drawn twice is
    // the hairline nobody can explain.
    <div>
      <p className="measure text-body-sm text-ink-muted">
        {t(fromProject ? 'video.themeFromProject' : hasDirection ? 'video.themeStatesNothing' : 'video.themeNone')}
      </p>
      {fromBrief.length > 0 && (
        // `text-ink` and not `text-ink-muted`: this is the one line on the block
        // that reports something the reader just did, and it has to be findable
        // from the box they typed it in.
        <p className="measure mt-1.5 text-body-sm text-ink">
          {t('video.themeFromBrief', { roles: fromBrief.map((role) => t(THEME_ROLE_KEYS[role])).join(', ') })}
        </p>
      )}
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
  /** How many more pictures the pool can hold. `addImage` refuses past the cap. */
  room: number
  /**
   * The pool's ceiling, only so the "full" sentence can quote it. Passed in
   * rather than read here, so this component states the number the panel above
   * it is really enforcing rather than a second opinion about it.
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
    return <p className="text-body-sm text-ink-faint">{t('video.imagesFull', { max: cap })}</p>
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
          {/* The same grid the brief-images gate draws — one component, because
              both ask "which of these unconfirmed pictures are worth keeping?"
              and two hand-written answers to one question drift. The axis rides
              along as this gate's `note`. */}
          <PendingPicks
            items={flow.batch.images.map((v) => ({ hash: v.hash, note: v.axis }))}
            chosen={flow.chosen}
            disabled={frozen}
            labelOf={(i) => t('video.variantNumber', { n: i + 1 })}
            onToggle={(hash) => setFlow((f) => toggleChosen(f, hash))}
          />
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
    /*
     * Its own heading, and not a flavour of `no-access`.
     *
     * The document is well formed and every file is on disk; what is wrong is
     * who is asking, which points at a different setting and a different person
     * to ask. "Motion is no longer enabled for this account" would have been
     * false and would have sent somebody to the wrong switch.
     *
     * The server's own sentence rides along because it names the blocks the film
     * really carries and how many of the catalogue are still available — the
     * module's rule that a refusal says what is STILL possible.
     */
    case 'three-d':
      return { titleKey: 'video.err3D', bodyKey: 'video.err3DHint', detail: e.message }
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

