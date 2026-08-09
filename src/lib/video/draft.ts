// The timeline while somebody is still building it.
//
// `VideoTimeline` is the finished document: every scene has a duration, an
// overlay is present or absent, and the whole thing is either valid or refused.
// A form is none of those things — rows get reordered, an overlay is typed one
// character at a time, and the total crosses the ceiling on the way to a
// timeline that fits. So the editor has its own shape, and `toTimelineInput()`
// is the one place it becomes something the schema will look at.
//
// Everything here is pure, which is the point: the dialog is untestable in this
// repository (no DOM, no testing-library), so the arithmetic that decides
// whether the button is live has to live somewhere a test can reach it.
//
// ── One record for five compositions, and why it is not a union ──────────────
//
// The schema is a discriminated union: a slideshow scene carries a caption, an
// overlay scene carries a band, a title scene carries no picture at all. The
// DRAFT is one flat record carrying every one of those fields, which looks like
// the sloppier choice and is the deliberate one.
//
// A union here would force a lossy conversion at every switch of the selector,
// and switching is exactly what happens: somebody picks `product` to see what it
// looks like, reads the fields, and goes back. With a union, the four pictures
// they had chosen and the headline they had typed are gone by the time they get
// back — punishing a click on a radio button. The flat record keeps them, and
// `toTimelineInput` switches on the template and emits ONLY the fields that
// composition reads. Nothing left over ever reaches the schema, which is
// `.strict()` and would refuse the whole document for it.
import {
  DEFAULT_KEN_BURNS,
  DEFAULT_OVERLAY_MOVE,
  MAX_SCENES,
  MAX_TOTAL_DURATION_MS,
  OverlaySceneSchema,
  ProductSceneSchema,
  SlideshowSceneSchema,
  TEMPLATE_LIMITS,
  TEXT_LIMITS,
  TextOverlaySchema,
  TitleSceneSchema,
  VerticalSceneSchema,
  type AspectRatio,
  type BandPosition,
  type KenBurns,
  type OutputFormat,
  type OverlayMove,
  type OverlayPosition,
  type TitleAnimation,
  type Transition,
  type VideoTemplate,
  type VideoTimeline,
  type VideoTimelineInput,
} from './timeline'

/**
 * What the composition selector is on.
 *
 * `auto` is a sixth position and not a sixth template: it means the composition
 * has not been chosen yet, and the model will choose it from the brief. That is
 * the DEFAULT — the catalogue exists so that the film matches what was asked
 * for, and a default of `slideshow` would make the other four an option people
 * discover by accident, if at all.
 *
 * It is a real state rather than a stand-in for slideshow, and everything below
 * follows from that: under `auto` there are no scene settings, because the
 * composition that would read them is unknown, and there is no timeline to
 * render. `toTimelineInput` answers `null` rather than quietly assembling the
 * slideshow that would have passed.
 */
export type TemplateChoice = 'auto' | VideoTemplate

/**
 * The scene schemas, by name — read for their SHAPE, never re-described.
 *
 * `templateUsesImages` asks zod whether a scene kind has an `imageId`, instead
 * of a hand-kept table saying which four of the five do. A sixth composition
 * with no picture in it then answers correctly the day it lands, without anybody
 * remembering that a boolean somewhere else needed a new row.
 */
const SCENE_SCHEMAS = {
  slideshow: SlideshowSceneSchema,
  overlay: OverlaySceneSchema,
  vertical: VerticalSceneSchema,
  titles: TitleSceneSchema,
  product: ProductSceneSchema,
} as const

/** Does this composition put a picture on the screen? Asked of the schema. */
export function templateUsesImages(template: VideoTemplate): boolean {
  return 'imageId' in SCENE_SCHEMAS[template].shape
}

/**
 * How many scenes this choice may hold.
 *
 * `auto` gets the widest cap in the catalogue: the composition is not decided,
 * so the only honest ceiling is the one no composition exceeds — and it is the
 * same number `compose.js` refuses a larger selection with, before spending a
 * call to discover the contradiction.
 */
export function sceneCap(choice: TemplateChoice): number {
  return choice === 'auto' ? MAX_SCENES : TEMPLATE_LIMITS[choice].maxScenes
}

/** The duration window this composition allows, per scene. */
export function durationWindow(template: VideoTemplate): { minSceneMs: number; maxSceneMs: number } {
  return TEMPLATE_LIMITS[template]
}

/**
 * Asked of the schema, never copied from it.
 *
 * The 120 in `TextOverlaySchema` is a legibility limit that could be revised;
 * the same number typed a second time into a `maxLength` attribute is a silent
 * disagreement waiting for that revision, and the half that loses is the form —
 * it would let a 140-character overlay be typed and the render refused.
 */
export const OVERLAY_MAX_LENGTH: number = TextOverlaySchema.shape.content.maxLength ?? TEXT_LIMITS.overlay

/**
 * How many argument boxes a product scene draws. Three, from the schema.
 *
 * The boxes are fixed and the document is not: `bullets` is one to three, so an
 * empty box is dropped on the way out exactly as an empty caption becomes
 * `null`. Three boxes with two filled is a two-argument card, never a card with
 * an empty bullet in it.
 */
export const BULLET_FIELDS: number = TEXT_LIMITS.productBullets

/**
 * What a freshly added scene lasts.
 *
 * Four seconds because twenty of them come to 80 s, comfortably under the 120 s
 * ceiling: adding a scene is never the click that makes the timeline illegal,
 * which would be a maddening thing for the "Add" button to do. Six would also
 * fit — at exactly 120 s — and would leave no room to lengthen anything.
 *
 * It is inside every composition's own window as well, which is not a
 * coincidence but is worth a test: the tightest floor in the catalogue is the
 * product card's 3000 ms and the tightest ceiling is the vertical cut's 8000 ms.
 */
export const DEFAULT_SCENE_DURATION_MS = 4000

/**
 * The step the duration control moves in. Half a second is the smallest change
 * worth making to a slideshow beat, and it keeps `durationMs` a whole number of
 * milliseconds, which the schema requires (`z.number().int()`).
 */
export const DURATION_STEP_MS = 500

/**
 * One row of the editor — every composition's fields at once. See the header.
 *
 * The names are the schema's wherever the schema has one. `headline` is shared
 * by `titles` and `product` on purpose: both are the line at the top of the
 * frame, and sharing the field is what makes switching between those two keep
 * the sentence somebody wrote.
 */
export interface DraftScene {
  /**
   * Stable across reorders, and the React key.
   *
   * Not the image id: a timeline may legitimately open and close on the same
   * picture, so image ids are not unique. Not the array index either — that is
   * what every reorder changes, and React would then keep the moved row's DOM
   * (and its focused overlay input) attached to the wrong scene.
   */
  key: string
  /** '' on a title card, the one scene kind the schema gives no `imageId`. */
  imageId: string
  durationMs: number
  transitionOut: Transition
  /** slideshow, vertical */
  kenBurns: KenBurns
  /** overlay. Its own field rather than a sixth `kenBurns` value: a capture is never panned. */
  move: OverlayMove
  /** slideshow, vertical. '' means no overlay; `toTimelineInput` makes that `null`. */
  overlayText: string
  overlayPosition: OverlayPosition
  /** overlay */
  bandTitle: string
  bandSubtitle: string
  bandPosition: BandPosition
  /** titles, product */
  headline: string
  /** titles */
  subtitle: string
  animation: TitleAnimation
  /** product. Always `BULLET_FIELDS` long — the empty ones are dropped on the way out. */
  bullets: string[]
  cta: string
}

export interface VideoDraft {
  /** Which composition the form is editing, or `auto`. See `TemplateChoice`. */
  template: TemplateChoice
  scenes: DraftScene[]
  aspectRatio: AspectRatio
  outputFormat: OutputFormat
  /**
   * Has anything here been arranged by hand?
   *
   * Recorded rather than inferred, because a proposal REPLACES this draft and
   * the panel has to warn before it does. Inferring it from the values — "this
   * scene is no longer four seconds" — cannot see the one edit that is hardest
   * to redo, a twenty-scene running order, since a reordered list of defaults is
   * indistinguishable from the order the pictures were picked in.
   *
   * Adding and removing images deliberately do NOT set it. The selection is the
   * proposal's INPUT — it is what the model is given to order — so choosing
   * pictures loses nothing when a proposal lands, and a confirmation on the
   * ordinary path is one people learn to click through, including the time it
   * was about to cost them an afternoon.
   */
  handEdited: boolean
}

let counter = 0
/** Unique within one page life, which is all a React key has to be. */
const newKey = () => `s${++counter}`

const emptyBullets = (): string[] => Array.from({ length: BULLET_FIELDS }, () => '')

/**
 * The camera move a new scene opens on, per composition.
 *
 * The schema's own default and nothing livelier: a hand-built timeline and a
 * model-written one that named the same images must render the same film, and
 * they would not if the form opened on a move the schema does not default to. So
 * it is PARSED out of the scene schema rather than written down again — the day
 * `slideshow` stopped defaulting to `static`, this function was already right.
 *
 * `auto` has no scene schema to ask, and takes the reading a document with no
 * template gets: a slideshow. It is a placeholder either way — `setTemplate`
 * re-applies the real default the moment a composition is chosen — but it must
 * not be a held frame, because the panel shows that placeholder the moment the
 * user picks slideshow and then leaves it alone.
 */
function defaultKenBurns(template: TemplateChoice): KenBurns {
  if (template === 'auto') return DEFAULT_KEN_BURNS.slideshow
  const shape = SCENE_SCHEMAS[template].shape as { kenBurns?: { parse: (v: unknown) => KenBurns } }
  return shape.kenBurns ? shape.kenBurns.parse(undefined) : DEFAULT_KEN_BURNS.slideshow
}

export function emptyDraft(): VideoDraft {
  // `auto`, deliberately. The model choosing the composition is what serves a
  // brief best, so it is the position the panel opens on rather than one behind
  // a dropdown nobody opens.
  return { template: 'auto', scenes: [], aspectRatio: '16:9', outputFormat: 'mp4', handEdited: false }
}

function blankScene(imageId: string, template: TemplateChoice): DraftScene {
  return {
    key: newKey(),
    imageId,
    durationMs: DEFAULT_SCENE_DURATION_MS,
    transitionOut: 'crossfade',
    kenBurns: defaultKenBurns(template),
    move: DEFAULT_OVERLAY_MOVE,
    overlayText: '',
    overlayPosition: 'bottom',
    bandTitle: '',
    bandSubtitle: '',
    bandPosition: 'bottom',
    headline: '',
    subtitle: '',
    animation: 'fade',
    bullets: emptyBullets(),
    cta: '',
  }
}

/**
 * Append one scene on a picture.
 *
 * Refused past the composition's own cap rather than past one fixed number: a
 * product card holds six scenes and a slideshow twenty, and an "Add" button that
 * grew a list the schema will refuse is the defect `sceneCap` exists to prevent.
 */
export function addScene(draft: VideoDraft, imageId: string): VideoDraft {
  if (draft.scenes.length >= sceneCap(draft.template)) return draft
  return { ...draft, scenes: [...draft.scenes, blankScene(imageId, draft.template)] }
}

/**
 * Append one scene with no picture — a title card.
 *
 * Its own function because a title card has no image to be added FROM: the
 * picker is what adds a scene everywhere else, and `titles` is the composition
 * that shows no picker at all. Passing `''` to `addScene` would have worked and
 * would have read like a bug at every call site.
 */
export function addTextScene(draft: VideoDraft): VideoDraft {
  if (draft.scenes.length >= sceneCap(draft.template)) return draft
  return { ...draft, scenes: [...draft.scenes, blankScene('', draft.template)] }
}

export function removeScene(draft: VideoDraft, key: string): VideoDraft {
  return { ...draft, scenes: draft.scenes.filter((s) => s.key !== key) }
}

export function updateScene(draft: VideoDraft, key: string, patch: Partial<Omit<DraftScene, 'key'>>): VideoDraft {
  if (!draft.scenes.some((s) => s.key === key)) return draft
  return { ...draft, handEdited: true, scenes: draft.scenes.map((s) => (s.key === key ? { ...s, ...patch } : s)) }
}

/** One argument box of a product scene, by position. Length is fixed; see `BULLET_FIELDS`. */
export function setBullet(draft: VideoDraft, key: string, index: number, text: string): VideoDraft {
  const scene = draft.scenes.find((s) => s.key === key)
  if (!scene || index < 0 || index >= BULLET_FIELDS) return draft
  const bullets = scene.bullets.map((b, i) => (i === index ? text : b))
  return updateScene(draft, key, { bullets })
}

/**
 * Choose the composition the form is editing.
 *
 * Three things happen, and each is here rather than in the panel because each is
 * a rule about what a draft may hold.
 *
 * **Durations are clamped into the new window.** This is not the repair
 * `timeline.ts` forbids, and the difference is which document is being touched:
 * that rule is about a timeline somebody already wrote, where clamping a 40 s
 * scene hands back a film nobody asked for. This runs on the way IN, on a slider
 * that cannot express 15 s under `vertical` in the first place — leaving the
 * value alone would put a draft into a state the form has no way to show and no
 * way to get out of.
 *
 * **Nothing is dropped.** A slideshow of ten scenes switched to `product`, which
 * holds six, keeps its ten rows and reports `too-many-scenes`; the user removes
 * four. Silently discarding somebody's pictures to honour a click on a radio
 * button is the kind of helpfulness this feature refuses everywhere else.
 *
 * **Leaving `auto` is when the scene settings first exist.** Under `auto` the
 * panel shows no camera move and no transition, because the composition that
 * would read them is unknown — so the values sitting in the record are
 * placeholders nobody chose, and they start on the new composition's own
 * defaults. Switching between two real compositions keeps them: those the user
 * did choose.
 */
export function setTemplate(draft: VideoDraft, template: TemplateChoice): VideoDraft {
  if (template === draft.template) return draft
  const fromAuto = draft.template === 'auto'
  const scenes =
    template === 'auto'
      ? draft.scenes
      : draft.scenes.map((s) => ({
          ...s,
          durationMs: clampDuration(s.durationMs, template),
          kenBurns: fromAuto ? defaultKenBurns(template) : s.kenBurns,
        }))
  return {
    ...draft,
    template,
    scenes,
    /*
     * The ratio IS the template for a vertical cut: `VerticalTimelineSchema`
     * types `aspectRatio` as the literal `9:16`, so 16:9 is unreachable rather
     * than discouraged. Setting it here is what keeps the output block honest —
     * the alternative is a select offering two values that refuse the document.
     */
    aspectRatio: template === 'vertical' ? '9:16' : draft.aspectRatio,
    // Not an edit: choosing what to build is not building it, and a warning
    // before the first proposal is one nobody can act on.
    handEdited: draft.handEdited,
  }
}

/** The two output settings, here rather than inline, so one place sets `handEdited`. */
export function setAspectRatio(draft: VideoDraft, aspectRatio: AspectRatio): VideoDraft {
  return { ...draft, aspectRatio, handEdited: true }
}

export function setOutputFormat(draft: VideoDraft, outputFormat: OutputFormat): VideoDraft {
  return { ...draft, outputFormat, handEdited: true }
}

/**
 * Move one scene by `delta` places. Clamped at both ends, never wrapped.
 *
 * Wrapping would send "up" from the first row to the last, which reads as the
 * row having disappeared — the user looks at the top of a twenty-scene list and
 * sees a different picture there.
 */
export function moveScene(draft: VideoDraft, key: string, delta: number): VideoDraft {
  const from = draft.scenes.findIndex((s) => s.key === key)
  if (from === -1) return draft
  const to = Math.min(draft.scenes.length - 1, Math.max(0, from + delta))
  if (to === from) return draft
  const scenes = [...draft.scenes]
  const [moved] = scenes.splice(from, 1)
  scenes.splice(to, 0, moved)
  return { ...draft, scenes, handEdited: true }
}

/**
 * Fill the editor from a proposal — whichever composition it turned out to be.
 *
 * The point of the whole "describe it" path: what comes back is not a mode of
 * its own, it is the SAME form somebody could have filled in by hand, with every
 * control still live. A read-only preview of a model's montage would have to be
 * accepted whole or thrown away whole, and the one thing everybody wants to do
 * with a proposed running order is move two scenes.
 *
 * It reads all five now, and that is the defect it closes. The editor used to be
 * a slideshow and nothing else, so a brief about a phone came back `vertical`,
 * was refused by the panel with a sentence, and the model call was spent for
 * nothing. The selector is what made the other four expressible.
 *
 * Fresh keys, never the index, for the reason `addScene` gives: reordering a
 * proposal is the first thing that happens to it.
 *
 * `handEdited: false`, because nothing here was arranged by hand yet — tune this
 * and ask for another proposal, and the warning fires again.
 */
export function draftFromTimeline(timeline: VideoTimeline): VideoDraft {
  const base = {
    template: timeline.template,
    aspectRatio: timeline.aspectRatio,
    outputFormat: timeline.outputFormat,
    handEdited: false,
  }
  const row = (imageId: string): DraftScene => blankScene(imageId, timeline.template)

  switch (timeline.template) {
    case 'overlay':
      return {
        ...base,
        template: 'overlay',
        scenes: timeline.scenes.map((s) => ({
          ...row(s.imageId),
          durationMs: s.durationMs,
          transitionOut: s.transitionOut,
          move: s.move,
          bandTitle: s.band.title,
          // No subtitle is an empty box, which `toTimelineInput` turns back into
          // `null`. The position falls back to the schema's own value rather
          // than being left undefined: a select with no value reads as its first
          // option, which is not `bottom`.
          bandSubtitle: s.band.subtitle ?? '',
          bandPosition: s.band.position,
        })),
      }
    case 'titles':
      return {
        ...base,
        template: 'titles',
        scenes: timeline.scenes.map((s) => ({
          ...row(''),
          durationMs: s.durationMs,
          transitionOut: s.transitionOut,
          headline: s.headline,
          subtitle: s.subtitle ?? '',
          animation: s.animation,
        })),
      }
    case 'product':
      return {
        ...base,
        template: 'product',
        scenes: timeline.scenes.map((s) => ({
          ...row(s.imageId),
          durationMs: s.durationMs,
          transitionOut: s.transitionOut,
          headline: s.headline,
          // Padded to the fixed number of boxes, never truncated: the schema
          // caps `bullets` at the same number these boxes are drawn from, so a
          // longer array cannot arrive — and if it ever could, dropping the
          // fourth argument in silence is how a form lies about a document.
          bullets: emptyBullets().map((_, i) => s.bullets[i] ?? ''),
          cta: s.cta ?? '',
        })),
      }
    case 'vertical':
    case 'slideshow':
      return {
        ...base,
        template: timeline.template,
        scenes: timeline.scenes.map((s) => ({
          ...row(s.imageId),
          durationMs: s.durationMs,
          transitionOut: s.transitionOut,
          kenBurns: s.kenBurns,
          overlayText: s.textOverlay?.content ?? '',
          overlayPosition: s.textOverlay?.position ?? 'bottom',
        })),
      }
  }
}

/**
 * Snap a duration onto the legal ladder for one composition.
 *
 * This is not the repair `timeline.ts` forbids, and the difference is which
 * document is being touched. That rule is about a timeline somebody already
 * wrote — clamping a model's 40-second scene to 15 hands back a film nobody
 * asked for and reports it as a success. This runs on the way IN, on a slider
 * that has no way to express 40 seconds in the first place, so nothing invalid
 * is ever recorded and nothing has to be corrected afterwards.
 */
export function clampDuration(ms: number, template: VideoTemplate): number {
  const { minSceneMs, maxSceneMs } = durationWindow(template)
  if (!Number.isFinite(ms)) return Math.min(maxSceneMs, Math.max(minSceneMs, DEFAULT_SCENE_DURATION_MS))
  const snapped = Math.round(ms / DURATION_STEP_MS) * DURATION_STEP_MS
  return Math.min(maxSceneMs, Math.max(minSceneMs, snapped))
}

export function draftTotalMs(draft: VideoDraft): number {
  return draft.scenes.reduce((sum, s) => sum + s.durationMs, 0)
}

/**
 * Why the render button is off.
 *
 * A list rather than a boolean, because the panel names the reason next to the
 * disabled button: a control that will not fire and will not say why is the
 * thing this whole screen was built to avoid. Ordered from "there is nothing to
 * render" outwards, so the first entry is the one worth showing when several
 * hold at once.
 *
 * `no-template` is first because it is the state the panel OPENS in and the one
 * that makes every other check meaningless: with no composition chosen there is
 * no scene shape, no duration window and no required field, so there is nothing
 * for the rest of this list to be about.
 */
export type DraftBlocker =
  | 'no-template'
  | 'no-scenes'
  | 'too-many-scenes'
  | 'over-budget'
  | 'image-missing'
  | 'headline-missing'
  | 'band-title-missing'
  | 'bullets-missing'
  | 'overlay-too-long'
  | 'text-too-long'

/** `'  '` is not a line of text — the schema's `min(1)` sees the trimmed value. */
const filled = (s: string) => s.trim().length > 0
const over = (s: string, max: number) => s.trim().length > max

export function draftBlockers(draft: VideoDraft): DraftBlocker[] {
  const out: DraftBlocker[] = []
  if (draft.template === 'auto') out.push('no-template')
  if (draft.scenes.length === 0) out.push('no-scenes')
  if (draft.scenes.length > sceneCap(draft.template)) out.push('too-many-scenes')
  if (draftTotalMs(draft) > MAX_TOTAL_DURATION_MS) out.push('over-budget')

  /*
   * A row with no picture, under a composition that puts one on the screen.
   *
   * Reachable in one click and invisible until the render. `titles` is the one
   * scene kind the schema gives no `imageId`, so its rows carry `''` — and
   * `setTemplate` deliberately keeps every row when the selector moves, because
   * discarding somebody's scenes to honour a click on a radio button is the
   * helpfulness this feature refuses. Fill in a `titles` draft, switch to
   * `product`, and the form looks finished: the row draws no thumbnail because
   * there is none to draw, no box is empty, and nothing says a picture is
   * missing. `toTimelineInput` then emits `imageId: ''`, the schema refuses the
   * whole document, and the 400 arrives after the click.
   *
   * Named on its own rather than folded into `no-scenes`, because it is the one
   * missing thing no box on that row can supply: the fix is to remove the row
   * and add it back from the picker.
   */
  if (draft.template !== 'auto' && templateUsesImages(draft.template) && draft.scenes.some((s) => !s.imageId)) {
    out.push('image-missing')
  }

  /*
   * The required lines, per composition.
   *
   * Each one is `min(1)` in the schema, so an empty box is a refused document
   * rather than a shorter film — which is the difference between these and the
   * optional fields beside them. Naming them separately rather than as one
   * "something is missing" is what lets the sentence under the button say which
   * box to type in; a form with fourteen inputs and a generic complaint is a
   * hunt.
   */
  if (draft.template === 'overlay' && draft.scenes.some((s) => !filled(s.bandTitle))) out.push('band-title-missing')
  if (
    (draft.template === 'titles' || draft.template === 'product') &&
    draft.scenes.some((s) => !filled(s.headline))
  ) {
    out.push('headline-missing')
  }
  if (draft.template === 'product' && draft.scenes.some((s) => !s.bullets.some(filled))) out.push('bullets-missing')

  // Reachable by paste in browsers that ignore `maxLength` on a programmatic
  // set, and by any future control that forgets the attribute. Cheap to check,
  // and the alternative is a 400 arriving after the queue accepted nothing.
  if (
    (draft.template === 'slideshow' || draft.template === 'vertical') &&
    draft.scenes.some((s) => over(s.overlayText, OVERLAY_MAX_LENGTH))
  ) {
    out.push('overlay-too-long')
  }
  if (draft.template !== 'auto' && draft.scenes.some((s) => longTextIn(s, draft.template as VideoTemplate))) {
    out.push('text-too-long')
  }
  return out
}

/** Every bound in `TEXT_LIMITS` this composition applies, on one row. */
function longTextIn(scene: DraftScene, template: VideoTemplate): boolean {
  switch (template) {
    case 'overlay':
      return over(scene.bandTitle, TEXT_LIMITS.bandTitle) || over(scene.bandSubtitle, TEXT_LIMITS.bandSubtitle)
    case 'titles':
      return over(scene.headline, TEXT_LIMITS.titleHeadline) || over(scene.subtitle, TEXT_LIMITS.titleSubtitle)
    case 'product':
      return (
        over(scene.headline, TEXT_LIMITS.productHeadline) ||
        over(scene.cta, TEXT_LIMITS.productCta) ||
        scene.bullets.some((b) => over(b, TEXT_LIMITS.productBullet))
      )
    default:
      // The caption has `overlay-too-long`, which names the field. Reporting it
      // twice would put two sentences under the button about one box.
      return false
  }
}

/**
 * The draft as something the schema will look at — or `null`.
 *
 * **`null` under `auto`, and that is the whole reason this returns a nullable.**
 * Assembling the slideshow that would have passed is precisely the repair this
 * feature refuses: it would hand somebody a film in a composition they did not
 * choose and report it as the one they asked for. No composition means no
 * timeline; the panel's `no-template` blocker is what says so before the click.
 *
 * The optional text fields are the only ones that change shape: an empty box
 * means "not there", which the schema spells `null`, and `''` would fail
 * `min(1)`. Everything is trimmed for the same reason a space-only box is not a
 * caption.
 */
export function toTimelineInput(draft: VideoDraft): VideoTimelineInput | null {
  if (draft.template === 'auto') return null
  const { outputFormat, aspectRatio } = draft
  const text = (s: string) => s.trim()
  const optional = (s: string) => (s.trim() ? s.trim() : null)

  switch (draft.template) {
    case 'overlay':
      return {
        template: 'overlay',
        outputFormat,
        aspectRatio,
        scenes: draft.scenes.map((s) => ({
          imageId: s.imageId,
          durationMs: s.durationMs,
          move: s.move,
          band: { title: text(s.bandTitle), subtitle: optional(s.bandSubtitle), position: s.bandPosition },
          transitionOut: s.transitionOut,
        })),
      }
    case 'vertical':
      return {
        template: 'vertical',
        outputFormat,
        // The literal, not `draft.aspectRatio`: the schema types this field as
        // `9:16` and nothing else, so reading it off the draft would be reading
        // a value the form cannot set and the document cannot carry.
        aspectRatio: '9:16',
        scenes: draft.scenes.map((s) => ({
          imageId: s.imageId,
          durationMs: s.durationMs,
          kenBurns: s.kenBurns,
          transitionOut: s.transitionOut,
          textOverlay: s.overlayText.trim() ? { content: text(s.overlayText), position: s.overlayPosition } : null,
        })),
      }
    case 'titles':
      return {
        template: 'titles',
        outputFormat,
        aspectRatio,
        scenes: draft.scenes.map((s) => ({
          headline: text(s.headline),
          subtitle: optional(s.subtitle),
          durationMs: s.durationMs,
          animation: s.animation,
          transitionOut: s.transitionOut,
        })),
      }
    case 'product':
      return {
        template: 'product',
        outputFormat,
        aspectRatio,
        scenes: draft.scenes.map((s) => ({
          imageId: s.imageId,
          durationMs: s.durationMs,
          headline: text(s.headline),
          // The empty boxes go, and the order of the ones that stay is the order
          // they were typed in. A card with two arguments is two arguments, not
          // three with a gap.
          bullets: s.bullets.map(text).filter(Boolean),
          cta: optional(s.cta),
          transitionOut: s.transitionOut,
        })),
      }
    case 'slideshow':
      return {
        // Named, although a document without it is still read as a slideshow.
        // That compatibility rule is there for montages saved before the
        // catalogue existed; a document written today should say what it is, so
        // the one place it can be read wrong is the past and not the present.
        template: 'slideshow',
        outputFormat,
        aspectRatio,
        scenes: draft.scenes.map((s) => ({
          imageId: s.imageId,
          durationMs: s.durationMs,
          kenBurns: s.kenBurns,
          transitionOut: s.transitionOut,
          textOverlay: s.overlayText.trim() ? { content: text(s.overlayText), position: s.overlayPosition } : null,
        })),
      }
  }
}

/**
 * Seconds, in the reader's language.
 *
 * One decimal always, so "4,0 s" and "4,5 s" line up in a column and the total
 * does not jump a character wide every time a slider moves. The locale matters
 * more than it looks: French writes 4,5 and English 4.5, and a hard-coded dot in
 * a French panel is the kind of detail that makes a whole interface feel
 * translated rather than written.
 */
export function formatSeconds(ms: number, lang = 'fr'): string {
  return (ms / 1000).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
