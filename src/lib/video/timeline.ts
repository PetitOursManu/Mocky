// The video-export data contract, shared by the browser, the server queue and
// the Remotion worker.
//
// The founding rule of the feature is that the model NEVER writes Remotion
// code: it writes one JSON object, validated here, and hand-written
// compositions consume it. Everything below follows from that. This schema is
// the entire surface the model is allowed to reach, so anything it can express
// has to be something a composition already knows how to render — and anything
// it cannot express is unreachable, not merely discouraged.
//
// ── Why this is a catalogue and not one shape ────────────────────────────────
//
// Templates, discriminated on `template`, each with its own scene kind and its
// own bounds. That is what buys variety WITHOUT reopening the founding rule:
// every new look is a composition somebody wrote and a reviewer read, not a
// string the model got to turn into code. A new template is a normal pull
// request; it is never a field that lets a document describe its own rendering.
//
// ── Why one of them is a stack of blocks ─────────────────────────────────────
//
// Five monolithic templates buy variety by the handful: a brief either fits one
// of five layouts or it does not, and a model shown five cards picks the most
// elaborate one. `composed` is the sixth entry and the different kind: a scene
// is a background plus a stack of typed BLOCKS, and the model chooses which
// blocks, in what order, where, and with what parameters.
//
// That does not reopen the founding rule, and the distinction is worth stating
// because it looks as though it might. The model still never describes its own
// rendering: every `kind` is one name out of a closed enum, every block is a
// component somebody wrote and a reviewer read, every field is bounded, and
// there is no colour, no font, no unit and no free string anywhere in it. What
// changed is the ARITHMETIC of variety — five looks became a combination of
// twenty-four blocks over ten placements — not who is allowed to write code.
//
// The five stay, whole and renderable. Saved drafts and the queue's journal are
// full of them, and a template removed is every one of those documents refused
// at validation with nothing anywhere naming the change that caused it.
//
// The corollary runs through every string below: nothing here becomes JSX, a
// CSS rule, a file name or a URL. `imageId` is a library address, colours are
// hex, a font is a bare family name, and there is no `src`, no `className`, no
// `style`.
import { z } from 'zod'

/**
 * The catalogue: every template the schema discriminates on, the worker has a
 * composition for, and `RENDERABLE_TEMPLATES` mirrors.
 */
export const VIDEO_TEMPLATES = ['slideshow', 'overlay', 'vertical', 'titles', 'product', 'composed'] as const

/**
 * The templates a person can build by hand, one row per scene.
 *
 * `composed` is deliberately not among them, and the absence is the feature
 * rather than a gap. Its scene is a stack of typed blocks with anchors and
 * arrival ranks; a form for that is a form with twenty-four shapes of row in it,
 * and the whole point of the composable variant is that nobody has to choose a
 * layout — a brief and a starting picture are the input. So the panel's
 * selector, `draft.ts`'s flat record and the compose catalogue are keyed on THIS
 * list, and the schema, the worker and the palettes are keyed on the one above.
 *
 * Two lists rather than one with a flag, because the difference is which
 * question is being asked: "can this be rendered" and "can this be typed in" are
 * not the same question and they have not had the same answer since the day the
 * blocks arrived.
 */
export const EDITABLE_TEMPLATES = ['slideshow', 'overlay', 'vertical', 'titles', 'product'] as const

/**
 * Scene count and per-scene duration, per template.
 *
 * Exported as one table because the UI and the compose prompt both quote it,
 * and because a per-template bound typed a second time somewhere else is a
 * disagreement waiting to happen — the half that loses is always the one that
 * accepts, which then fails at the schema with a number nobody printed.
 *
 * The numbers differ on purpose. A slideshow beat can be one second because the
 * eye only has a picture to take in; a banded screenshot has a sentence on it
 * and 1000 ms is not a reading, it is a flash. A product card has a headline,
 * three arguments and a call to action, so its floor is three seconds — under
 * that the template renders text nobody can finish.
 */
export const TEMPLATE_LIMITS = {
  slideshow: { maxScenes: 20, minSceneMs: 1000, maxSceneMs: 15000 },
  overlay: { maxScenes: 10, minSceneMs: 1500, maxSceneMs: 15000 },
  vertical: { maxScenes: 12, minSceneMs: 1000, maxSceneMs: 8000 },
  titles: { maxScenes: 8, minSceneMs: 1500, maxSceneMs: 10000 },
  product: { maxScenes: 6, minSceneMs: 3000, maxSceneMs: 15000 },
  /**
   * The composable variant, and its two numbers are bounded by DENSITY rather
   * than by reading time.
   *
   * The floor is 1500 ms because a composed scene is a cascade — `cueFrames`
   * compresses the whole arrival when the scene is too short for it, and under a
   * second and a half a stack of eight blocks lands on one frame, which is a
   * pile rather than a composition.
   *
   * Twelve scenes and not twenty, and it is the layer cap next door that decides
   * it. The render deadline scales with the film's LENGTH
   * (`tests/video-render-budget.test.js`) and is blind to how many elements each
   * frame carries, so density is the one cost the budget cannot see: twenty
   * scenes of eight blocks is 160 elements against the busiest thing anybody has
   * written by hand, a product card of about eight. Twelve keeps the worst case
   * inside the same order of magnitude as the catalogue it joins.
   */
  composed: { maxScenes: 12, minSceneMs: 1500, maxSceneMs: 15000 },
} as const

/**
 * The slideshow's bounds, under the names they had before the catalogue existed.
 *
 * `MAX_SCENES` is still load-bearing and is not really a slideshow bound at all:
 * it is the WIDEST cap in the catalogue, which is what `/status` publishes, what
 * `compose.js` refuses an oversized selection against, and what the panel offers
 * while no composition has been chosen. The two duration aliases are now quoted
 * by nothing but the mirrors and their tests — the editor asks
 * `TEMPLATE_LIMITS` for the window of the composition it is editing, because a
 * vertical beat stops at 8 s where a slideshow beat runs to 15.
 *
 * Aliases rather than copies, so a slideshow bound revised in the table above
 * cannot leave a stale twin behind.
 */
export const MAX_SCENES = TEMPLATE_LIMITS.slideshow.maxScenes
export const MIN_SCENE_DURATION_MS = TEMPLATE_LIMITS.slideshow.minSceneMs
export const MAX_SCENE_DURATION_MS = TEMPLATE_LIMITS.slideshow.maxSceneMs

/**
 * The whole-timeline ceiling, and the reason the refinement at the bottom
 * exists: 20 scenes × 15 s is 300 s, so the per-scene bounds alone permit a
 * five-minute render. A render is minutes of CPU on a worker nobody is
 * watching, which is exactly the kind of cost that should be refused at
 * validation rather than discovered at the end of the queue.
 *
 * It applies to EVERY template, and it is written once, on the union, for that
 * reason. Per-variant ceilings would be five numbers to keep under the queue's
 * single deadline, and the fifth one would be the one that got it wrong.
 */
export const MAX_TOTAL_DURATION_MS = 120000

/**
 * How long the browser should expect a render of `totalDurationMs` to take.
 *
 * The THIRD copy of this arithmetic — `server/video/queue.js` and
 * `worker/video/server.js` carry the other two — and the reason is the same one
 * that makes `VideoTimelineSchema` a hand-kept mirror: a bundle cannot import
 * the server's `.js`, and `worker/` is excluded from Mocky's Docker build
 * context so that Remotion's licence stays out of the default image.
 * `tests/video-render-budget.test.js` holds all three to the same answer.
 *
 * The panel needs it because the poll deadline used to be
 * `MAX_TOTAL_DURATION_MS`, and that conflated two different quantities that
 * happened to both be 120 s: how long a film may BE, and how long rendering it
 * may TAKE. Rendering 1080p in a headless browser costs about four times real
 * time, so the two have now separated — and a panel still using the old number
 * would tell a user their sixty-second film had timed out while the worker was
 * calmly halfway through it.
 */
export const JOB_BUDGET_BASE_MS = 45_000
export const JOB_BUDGET_PER_FILM_MS = 6
export const JOB_TIMEOUT_MS = 120_000

export function jobBudgetMs(totalDurationMs: number): number {
  const film = Math.max(0, Number(totalDurationMs) || 0)
  return Math.max(JOB_TIMEOUT_MS, JOB_BUDGET_BASE_MS + film * JOB_BUDGET_PER_FILM_MS)
}

/**
 * Every text bound in the catalogue, in one place, for the reason
 * `TEMPLATE_LIMITS` is: the compose prompt states them and the panel counts
 * against them.
 *
 * These are legibility limits, not storage ones. Text in a film is burnt into
 * the frame at a size the composition fixes, so a headline that does not fit is
 * not a smaller headline — it is a line that runs off the edge, or a block that
 * covers the picture underneath it.
 */
export const TEXT_LIMITS = {
  overlay: 120,
  bandTitle: 60,
  bandSubtitle: 90,
  titleHeadline: 70,
  titleSubtitle: 120,
  productHeadline: 70,
  productBullet: 60,
  productBullets: 3,
  productCta: 30,
} as const

/**
 * Every bound the composable variant applies, in one table, for the reason
 * `TEXT_LIMITS` and `TEMPLATE_LIMITS` are tables: the compose prompt states them
 * and the worker restates them, and a floor retyped in a prompt drifts from the
 * validator with the call already spent.
 *
 * The lengths are legibility limits. A block is burnt into the frame at a size
 * its component fixes, and a quote of three hundred characters is not a smaller
 * quote — it is a paragraph laid over whatever the scene was about.
 *
 * The counts are cost limits, and `layersPerScene` is the one that matters. Eight
 * is not a taste: `cueFrames` gives each element of a cascade its own beat and
 * refuses to place one with less than half a second of scene left, so a ninth
 * block on the shortest legal scene arrives at the same frame as the eighth —
 * and a frame carrying more than eight elements is denser than any composition
 * anybody in this directory wrote by hand.
 */
export const BLOCK_LIMITS = {
  layersPerScene: 8,

  heading: 70,
  kicker: 40,
  quote: 180,
  attribution: 40,
  highlight: 90,
  highlightMark: 40,
  typewriter: 120,
  listItem: 60,
  listItems: 6,
  counterTo: 1000000,
  counterAffix: 8,
  counterLabel: 40,
  logoType: 24,
  buttonLabel: 30,
  formTitle: 40,
  formField: 30,
  formFields: 4,
  formSubmit: 24,
  noticeTitle: 40,
  noticeBody: 90,
  lowerTitle: 50,
  lowerSubtitle: 70,
  barValuesMin: 2,
  barValues: 8,
  barLabel: 12,
  lineValuesMin: 2,
  lineValues: 12,
  lineLabel: 24,
  equalizerBarsMin: 4,
  equalizerBars: 24,
  waveSamplesMin: 24,
  waveSamples: 96,
  mapMarkers: 8,
  caption: 70,
  galleryImagesMin: 2,
  galleryImages: 6,
  carouselImagesMin: 2,
  carouselImages: 8,
  /**
   * A stage holds one picture, or two — the face and what is on the back.
   *
   * Two and not more, because a panel has two faces. A third would be a field
   * nothing draws, which is the unknown key `.strict()` exists to refuse arriving
   * as a legal one.
   */
  stageImagesMin: 1,
  stageImages: 2,
  /**
   * A ring holds three to six.
   *
   * THREE at the floor and not two, which is the one bound here that is not a
   * copy of its neighbour's: two panels on a ring are one panel and its reverse,
   * so a viewer reads a card turning over — which is `photoStage`'s `turn` drawn
   * by the wrong block, at half the size and with a gap down the middle. Six at
   * the ceiling for `gallery`'s reason: past that the panel at the front is a
   * thumbnail, and a carousel nobody can read is a texture.
   */
  ringImagesMin: 3,
  ringImages: 6,
  clockLabel: 24,
  dateStamp: 30,
  progressLabel: 24,
  gridCellsMin: 4,
  gridCells: 16,
  particleDensity: 3,

  funTitle: 40,
  codeLinesMin: 2,
  codeLines: 10,
  codeLine: 64,
  codeCaption: 30,
  extrudedType: 24,

  // The two fields in volume that count something, and both ceilings are
  // MEASURED rather than chosen — the numbers are in `docs/video-export.md`.
  // Six hundred particles is where the ENCODER stops being affordable rather
  // than the renderer: hundreds of small bright squares in motion are the
  // high-frequency detail h264 spends its whole allowance on, and nine hundred
  // of them drawn smaller measured 3.9 MB for six seconds against this
  // ceiling's 2.0. Sixteen rules is where a floor stops reading as a floor and
  // starts reading as the wireframe this feature already refused — and where
  // the densest tunnel it can make costs 4.1 MB against a lit solid's 0.9.
  particlesMin: 60,
  particles: 600,
  gridLinesMin: 5,
  gridLines: 16,
} as const

/**
 * Where a block sits, as a ZONE and never as a pixel.
 *
 * A coordinate is the founding rule going out of the window in the quietest
 * possible way: `{ x: 37, y: 12 }` is a layout the model described, it depends on
 * a frame size the document cannot see, and it has no answer at all in the two
 * ratios it was not written for. Nine cells of a grid plus the whole frame are
 * something a composition can lay out in `16:9`, `9:16` and `1:1` alike.
 *
 * Two blocks in one zone STACK, in the order the document lists them. That is
 * why `center` can be the default without anything landing on top of anything:
 * a zone is a flex cell, not a coordinate, and the arrangement is the
 * composition's business — which is exactly the line the whole feature is drawn
 * on.
 */
export const ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
  'full',
] as const

/**
 * The block catalogue, by family.
 *
 * The families are not decoration: the compose prompt reads this map so a model
 * is shown twenty-four names in six groups rather than a flat list it will pick
 * the first four of, and `blocks.test.ts` asserts every kind belongs to exactly
 * one — a block added to the enum and forgotten here is a block no prompt ever
 * offers, which is the same as not having written it.
 */
export const BLOCK_FAMILIES = {
  text: ['heading', 'kicker', 'quote', 'textHighlight', 'funTitle'],
  animatedText: ['typewriter', 'animatedList', 'counter', 'logoType'],
  interface: ['button', 'form', 'notification', 'lowerThird'],
  /**
   * `globe` and `solidChart` are here rather than in `setPiece`, and the choice
   * is about where a model LOOKS rather than about what they cost.
   *
   * Both are drawn by a renderer, so both are rationed by the 3D permission
   * (`server/video/three-d.js`) and both are a whole scene when they are in one —
   * which is the sentence `setPiece` exists to say. But a family is how twenty-
   * odd names stop being a list a model takes the first four of: somebody asking
   * for a map of the world or for a chart with weight in it reads DATA, and a
   * block filed under the expensive ones is a block that family never offers. The
   * cost is stated on the cards instead, where the third sentence of every entry
   * already says how a block fails.
   */
  data: ['barChart', 'lineChart', 'equalizer', 'soundWave', 'map', 'globe', 'solidChart'],
  media: ['imageFrame', 'gallery', 'carousel', 'clock', 'dateStamp', 'photoStage', 'photoRing'],
  misc: ['separator', 'progressBar'],
  /**
   * The blocks that cost a scene rather than a corner of one.
   *
   * A family of its own because the compose prompt needs somewhere to say "one
   * per film": `codeBlock` fills a zone with ten lines of monospace, `solidScene`
   * puts a lit solid in it and `extrudedType` sets a line of type in real space,
   * and a stack that holds two of them holds nothing else. The other six
   * families group blocks by what they ARE; this one groups by what they cost,
   * which is the only property the model has to be warned about.
   *
   * Two of the three have a renderer that is a dependency — see
   * `worker/video/package.json`. Both are measured rather than assumed: a
   * full-frame lit solid adds about 0.9 s of render per second of film on the
   * two-core worker and a full-frame extruded title about 0.8, against the
   * 1.7 s/s the duration-scaled deadline leaves spare at the schema's longest
   * film. A wireframe was in this enum until it was measured at 2.7 s/s and
   * 13 Mbit/s of output — see `SolidSceneBlockSchema` — and a per-LETTER
   * extrusion until it was measured at eight times the budget, which is why
   * `extrudedType` draws a line as at most three words.
   */
  setPiece: ['codeBlock', 'solidScene', 'extrudedType'],
  /**
   * The three that are a SPACE rather than a thing standing in one.
   *
   * A family of its own and not three more set pieces, because the sentence the
   * set-piece header carries — each of these is a whole scene, at most one in
   * the film — is false of these three in one direction and truer in the other.
   * A field is what a scene is made OF: it is painted under the nine cells, a
   * heading is meant to stand on it, and a film may well want one in every other
   * scene. What it must not do is share a frame with a second field, and that is
   * what the family header says instead.
   *
   * All three are drawn by the renderer `solidScene` already brought in, so all
   * three are named in `server/video/three-d.js` and rationed by the same
   * administrator setting. That list is held against this one from both ends by
   * `tests/video-3d-permission.test.js`: a field added here and forgotten there
   * is a block the permission does not cover, offered to every account, and
   * nothing about that failure is visible — the feature simply works.
   */
  field: ['particleField', 'waveMesh', 'depthGrid'],
} as const

/** Every block kind, flattened. The discriminator of the layer union. */
export const BLOCK_KINDS = [
  ...BLOCK_FAMILIES.text,
  ...BLOCK_FAMILIES.animatedText,
  ...BLOCK_FAMILIES.interface,
  ...BLOCK_FAMILIES.data,
  ...BLOCK_FAMILIES.media,
  ...BLOCK_FAMILIES.misc,
  ...BLOCK_FAMILIES.setPiece,
  ...BLOCK_FAMILIES.field,
] as const

/**
 * How a `funTitle` treats its line.
 *
 * The user asked for "fun titles" and the obvious way to get them is Skia:
 * `@remotion/skia` gives text on a path, real blurs and shader fills in a few
 * lines. It was measured before it was refused — 461 MB of node_modules, of
 * which 443 MB is `@shopify/react-native-skia` and its prebuilt `.a`/`.so`
 * binaries for iOS, tvOS, macOS and Android, none of which can execute in this
 * container — against a whole worker image of 1.57 GB. Its 2.x peer set is React
 * 19 plus react-native and reanimated, and this worker is React 18. So these
 * five are what a browser already does: a per-letter arc, an alternating
 * baseline, a stretched measure, a colour swap on one word, and a shadowed
 * offset. No path, no shader, no glyph outline.
 */
export const FUN_TITLE_TREATMENTS = ['arc', 'bounce', 'stretch', 'swap', 'stack'] as const

/**
 * What a `solidScene` draws. Four solids, and no wireframe.
 *
 * The absence is measured, not aesthetic. A full-frame wireframe torus at 1080p
 * cost 25.4 s of render for 6 s of film against 9.2 s for a plain title — 2.7 s
 * of render per second of film, where the deadline leaves 1.7 — and it came back
 * at 9.8 MB for those six seconds against 0.6 MB, because a mesh of lines is the
 * high-frequency detail h264 cannot compress and it spends the whole bitrate
 * allowance `worstCaseBytes` sizes the disk budget against. A lit solid costs
 * 0.9 s/s and 0.6 MB. One of those fits and the other does not.
 */
export const SOLIDS = ['cube', 'prism', 'sphere', 'torus'] as const

/** How a `solidScene` turns. A named move, never an axis and never an angle. */
export const SPINS = ['tumble', 'turn', 'rock'] as const

/**
 * What a picture stands in, on a `photoStage` or a `photoRing`.
 *
 * A shape and never a size: the three differ in how much body shows past the
 * picture and how thick the slab is, all of it in units of the PICTURE's own
 * height, so a `card` reads as the same card in a corner cell and across a whole
 * frame. `STAGE_FRAMES` in `worker/video/remotion/blocks/stage.js` holds the
 * numbers and the argument for each.
 *
 * `device` is three rather than two-with-a-depth-knob because of one asymmetry:
 * it has a CHIN, a wider band under the picture than over it, which is the whole
 * difference between a screen in a case and a mounted print.
 */
export const STAGE_FRAMES = ['plain', 'card', 'device'] as const

/**
 * How a `photoStage` moves. A named move, never an axis and never an angle — the
 * same rule `SPINS` states, and here it also covers the camera.
 *
 * `orbit` is the camera walking round the subject, which is what it looks like
 * rather than what it is: the panel turns and the camera holds still, because a
 * camera the document moved would be a camera the composition does not own. The
 * amplitude is bounded in `STAGE_MOVES` by the frustum rather than by taste — a
 * wider swing buys both a more distorted picture and a smaller one.
 *
 * `turn` is the card turning over to show its back, which is what the optional
 * second `imageId` is for; `sway` is the smallest amount of life that keeps a
 * held frame from reading as a stalled render, which is `OVERLAY_MOVES`'s
 * argument in three dimensions. There is no `static`, for that same paragraph's
 * reason: this family exists to move, and a still panel is a flat `imageFrame`
 * that cost a renderer.
 */
export const STAGE_MOVES = ['orbit', 'turn', 'sway'] as const

/**
 * How thick an `extrudedType` is, as a share of its own TYPE SIZE.
 *
 * A share of the size and never of the frame, which is what makes `deep` mean
 * the same thing on a corner wordmark and on a full-frame title: the thickness
 * is a proportion of the letter, which is what a typographer means by a heavy
 * extrusion. The top of the range is a third of the size rather than anything
 * larger because past about four tenths the sides close over the counters of
 * `a`, `e` and `o` at the turn — see `SPATIAL_DEPTHS` in the worker, where the
 * numbers are.
 */
export const EXTRUDED_DEPTHS = ['shallow', 'medium', 'deep'] as const

/**
 * How an `extrudedType` moves. A named move, never an axis and never an angle —
 * `SPINS`'s rule, and the amplitudes are the difference between the two blocks.
 *
 * A solid may turn through a whole revolution because a cube seen edge-on is
 * still a cube. A word seen edge-on is a vertical bar, so all three of these are
 * small: the line sways, or it leans, or its words breathe in DEPTH one after
 * another inside a line that barely moves. Past about twenty-five degrees the
 * round letters close and the word stops being a word, which is the one thing
 * this block may not do.
 *
 * The third is a depth rather than a third angle, and that is a cost written
 * into the look: every angle has to be paid for in the stroke that closes the
 * seam between two copies of the extrusion, and a per-word rotation of fourteen
 * degrees put a ring of nine per cent of the em around every word — which fills
 * the aperture of an `e`. `SPATIAL_FLOAT_DEPTH` in the worker carries it.
 */
export const EXTRUDED_SPINS = ['sway', 'tilt', 'float'] as const

/**
 * What a `codeBlock` line is FOR, and the whole reason no highlighter is
 * installed.
 *
 * `shiki` costs 14.6 MB and `prismjs` 2.1 MB — neither is expensive, and neither
 * was refused on weight. A highlighter's output is a theme: twenty to forty hex
 * values, one per token type, none of them measured against the surface the film
 * paints them on. `composedPalette` offers four measured runs on a panel, so
 * thirty-odd token colours have nowhere to land: either the block writes hex
 * nobody measured — which `blocks.test.js` refuses and which is exactly the
 * defect that shipped a dark green headline on a near-black frame — or the
 * highlighter's thirty colours collapse onto a handful, at which point the
 * highlighter did nothing a role does not. The count moved from three to four
 * when `panelText` was added — `plain` is running text and had been reading a
 * run measured at the display floor — and the argument is untouched by it: the
 * trade is thirty unmeasured values against any number of measured ones.
 *
 * So the roles ARE the schema. The model says what each line is, the block draws
 * it in the run the palette resolved, and nothing infers language from a string.
 */
export const CODE_ROLES = ['plain', 'accent', 'muted'] as const

/**
 * What a composed scene is painted on.
 *
 * Six grounds, and the split that matters is not decorative: `solid` and
 * `hairlines` are ONE colour (plus a known tint), `gradient` is a ramp between
 * two known colours, and `image` is a photograph nobody in this process has
 * opened. Those are three different legibility problems and the palette solves
 * them as one — see `composedPalette` in the worker — but the schema is where
 * the model gets to say which.
 */
export const BACKGROUND_KINDS = ['solid', 'gradient', 'hairlines', 'gridPulse', 'particles', 'image'] as const

/** Which way a `gradient` ground runs. A direction, never an angle: an angle is a CSS unit. */
export const GRADIENT_DIRECTIONS = ['to-bottom', 'to-right', 'diagonal', 'radial'] as const

export const KEN_BURNS = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'static'] as const

/**
 * The camera move a scene gets when the document does not name one, per template.
 *
 * It used to be `static` on `slideshow`, and that one word is the whole of a
 * defect a user reported in four sentences: a model that omits an optional field
 * — which is what a model does with an optional field — got a photograph nailed
 * to the frame with a caption laid on it, for fifteen seconds, and said of the
 * result that it was not a film. It was right. Nothing in the document asked for
 * a freeze; the freeze was what silence meant.
 *
 * `static` stays IN the enum, and that is not a compromise. A capture of an
 * interface has real reasons to hold still, and an enum value removed is every
 * saved draft and every entry in the queue's journal that names it refused at
 * validation. What changed is which case you get by saying nothing: immobility is
 * now something a document ASKS for, and movement is what it gets by default.
 *
 * `zoom-in` on both, and the reason is the library rather than taste. A pan is
 * only a camera move on a picture wider than its frame; the image library mixes
 * portrait and landscape freely, and `cover` has already cropped a portrait still
 * inside a landscape frame, so a pan there slides the crop instead of revealing
 * anything. A zoom is the same move on every aspect ratio and every subject, and
 * it is the one that cannot drag the background in behind the picture.
 *
 * A table rather than two literals because `draft.ts` reads the defaults back off
 * these schemas — the panel has to open a new scene on the move the schema would
 * have applied, or a hand-built timeline and a model-written one naming the same
 * pictures render two different films.
 */
export const DEFAULT_KEN_BURNS = {
  slideshow: 'zoom-in',
  vertical: 'zoom-in',
} as const

/**
 * How an `overlay` scene moves — the one template whose picture must survive the
 * move intact.
 *
 * This template has no `kenBurns` and never will: a pan across a capture of an
 * interface slides half the interface out of frame and a zoom crops it, and the
 * reason to show a screenshot is that it can be read. That was taken to mean the
 * scene simply did not move, which is how the template of the reported film came
 * to be a still photograph with a band of text on it.
 *
 * The distinction the old reading missed is AMPLITUDE, not direction. A pan is
 * refused because it spends 4% of travel on a 12% overscale — an eighth of the
 * capture cropped, and a twentieth of it sliding past. A drift spends 1.2% on 3%:
 * the picture is a fortieth larger than the frame, the travel stays inside the
 * margin that leaves, and every pixel visible at rest is visible on every frame.
 * One is a camera move over a screenshot; the other is the smallest amount of
 * life that keeps a held frame from reading as a stalled render.
 *
 * There is no `still` here, deliberately, and it is the one place this file does
 * not offer the calm option: `static` exists on the other two templates because a
 * pan and a zoom really can destroy a capture and a document must be able to
 * refuse them. A drift destroys nothing, so immobility here would buy the defect
 * back and pay nothing for it.
 */
export const OVERLAY_MOVES = ['drift-up', 'drift-down', 'settle'] as const

/**
 * `drift-up`, so that a film composed before this field existed renders exactly
 * as it did: the drift was already unconditional in `OverlayBandVideo`, always in
 * that direction. The field turned one hard-coded move into a choice; it did not
 * change what anybody's saved timeline looks like.
 */
export const DEFAULT_OVERLAY_MOVE = 'drift-up'

export const TRANSITIONS = ['crossfade', 'wipe-left', 'wipe-right', 'none'] as const

/**
 * The transitions a `composed` scene may declare: the four above, plus a mosaic
 * dissolve.
 *
 * Built from `TRANSITIONS` rather than typed out, so a value added there arrives
 * here and cannot be forgotten. It is a per-template vocabulary for the reason
 * `OVERLAY_MOVES` and `BAND_POSITIONS` are — the other five have shipped for
 * months, their saved drafts name what they name, and widening a shared enum to
 * give one new template a device would put a fifth option on five selectors that
 * were designed with four.
 *
 * `entranceStyle` in the worker draws it, so the implementation is shared even
 * though the vocabulary is not: a second notion of "a scene arrives" is the
 * drift `composition.js` exists to prevent.
 */
export const COMPOSED_TRANSITIONS = [...TRANSITIONS, 'pixel'] as const

export const OVERLAY_POSITIONS = ['top', 'center', 'bottom'] as const
/**
 * A band sits above or below the screenshot's content, never across it: the
 * whole point of that template is that the capture stays readable, and `center`
 * is exactly where the thing being shown lives.
 */
export const BAND_POSITIONS = ['top', 'bottom'] as const
export const TITLE_ANIMATIONS = ['fade', 'rise', 'stagger'] as const
export const OUTPUT_FORMATS = ['mp4', 'webm'] as const
export const ASPECT_RATIOS = ['16:9', '9:16', '1:1'] as const

/** The image-library address: a SHA-256, lower-case, exactly as `digest('hex')` writes it. */
const IMAGE_ID = /^[0-9a-f]{64}$/

/**
 * A colour, and the one place in this file where letter case is tolerated.
 *
 * `imageId` is lower-case only because it is a PATH — two spellings of one hash
 * are two names for one file on a case-sensitive volume. A hex colour addresses
 * nothing: `#F6F4EE` and `#f6f4ee` are the same paint, and design documents are
 * written by people and by models who upper-case as often as not. Refusing the
 * capital would drop a stated token and hand the composition its own default
 * instead, which is the exact failure the theme exists to avoid.
 *
 * Three-digit hex is allowed because `parseColors` reads it out of documents.
 */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * ONE font family name — never a CSS font stack, and never anything that could
 * close a declaration.
 *
 * A colour cannot escape its own syntax; a font name can. This value ends up in
 * a `font-family`, and a comma, a quote, a semicolon or a brace there is the
 * difference between naming a typeface and writing CSS. So the charset is
 * letters, digits, spaces and hyphens, and the composition appends its own
 * fallback stack — which it has to do anyway, because nothing in Mocky loads a
 * webfont and the renderer may simply not have the face.
 */
const FONT_FAMILY = /^[\p{L}\p{N}][\p{L}\p{N} \-]{0,47}$/u

/**
 * Exported so `theme.ts` can ask whether a token is expressible instead of
 * retyping these two regexes — the same discipline `draft.ts` uses to read the
 * overlay length off the schema. It matters more here than there: the builder
 * drops what it cannot express, and a copy of the rule that drifted would emit
 * a theme the server then refuses whole.
 */
export const ThemeColorSchema = z.string().regex(HEX_COLOR, 'a colour must be a hex value such as #1a1a1a')
export const ThemeFontSchema = z
  .string()
  .regex(FONT_FAMILY, 'a font must be one family name — letters, digits, spaces and hyphens, no CSS')

const hex = ThemeColorSchema
const fontFamily = ThemeFontSchema

/**
 * The project's art direction, as much of it as a film can carry.
 *
 * **The model never writes this.** It is not in `VideoTimelineSchema` at all, so
 * a `theme` key in a model's answer is refused like any other unknown key; the
 * server attaches it afterwards, to `RenderTimelineSchema`, out of the direction
 * the project already has. That is what makes an export look like the site it
 * came from instead of like a generic template, and it costs zero tokens.
 *
 * **Every field is optional, and an absence is honest.** `parseDesignSpec`
 * distinguishes the tokens a document DECLARED from the ones `parseDesignSystem`
 * invented so that something always renders, and only the declared ones belong
 * here. A guessed accent presented as the project's accent is a false claim the
 * user cannot see through: the film would simply be the wrong colour, with
 * nothing anywhere saying so. When the direction says nothing, the composition
 * uses its own default — which is a choice somebody made, on purpose, once.
 *
 * The refinement refuses `{}` for the same reason. An empty theme block says "a
 * direction was read and it asks for nothing", which is not what "there is no
 * direction" means; the second is spelled by leaving `theme` out.
 */
export const VideoThemeSchema = z
  .object({
    colors: z
      .object({
        background: hex.optional(),
        text: hex.optional(),
        accent: hex.optional(),
        surface: hex.optional(),
      })
      .strict()
      .optional(),
    fonts: z
      .object({
        heading: fontFamily.optional(),
        body: fontFamily.optional(),
      })
      .strict()
      .optional(),
    /**
     * In pixels, and a number rather than a CSS length, so there is no unit to
     * parse and no `calc()` to smuggle. The ceiling is 9999 because that is what
     * `parseRadius` maps `rounded-full` to, and a pill is a real declared choice.
     */
    radiusPx: z.number().int().min(0).max(9999).optional(),
  })
  .strict()
  .refine(
    (theme) =>
      Boolean(
        theme.radiusPx !== undefined ||
          (theme.colors && Object.values(theme.colors).some((v) => v !== undefined)) ||
          (theme.fonts && Object.values(theme.fonts).some((v) => v !== undefined)),
      ),
    { message: 'A theme must state at least one token. Omit it entirely when the project has no direction.' },
  )

/**
 * A line of text somebody will actually read — not merely a non-empty string.
 *
 * `min(1)` counts CHARACTERS, so `" "` satisfies it, and the worker's own
 * `readText` has always refused a string that trims to nothing. Mocky therefore
 * validated a document its renderer refuses, which is the expensive direction of
 * a disagreement between the two: the timeline passes, the job is queued, the
 * user waits out a render, and the refusal arrives at the end of it about a
 * caption they can see on their own screen. The panel already agreed with the
 * worker — `draftBlockers` trims before it calls a required box filled — so this
 * is the schema catching up with both of its neighbours.
 *
 * A `regex` check and not a `refine`, deliberately: a refinement wraps the string
 * in a `ZodEffects`, and `draft.ts` reads
 * `TextOverlaySchema.shape.content.maxLength` off the schema precisely so a
 * `maxLength` attribute cannot drift from the rule. Wrapped, that read answers
 * `undefined` and falls through to a copy of the number — the drift it exists to
 * prevent, arriving silently.
 *
 * Refused, never trimmed. Trimming is a repair, and the caller is a model that
 * can simply be told.
 */
const NOT_BLANK = /\S/
const line = (max: number) => z.string().min(1).max(max).regex(NOT_BLANK, 'a line of text cannot be blank')

export const TextOverlaySchema = z
  .object({
    // 120 characters is a legibility limit, not a storage one: an overlay is
    // burnt into the frame at a fixed size, and a paragraph rendered there is
    // unreadable at any aspect ratio.
    content: line(TEXT_LIMITS.overlay),
    position: z.enum(OVERLAY_POSITIONS),
  })
  .strict()

/**
 * An identifier into Mocky's image library, never a location. M2 forbids
 * storing or displaying a third-party image and M8 makes the content hash the
 * identity of a stored one; accepting a URL here would hand the model a way to
 * pull remote bytes into a file Mocky then hosts as its own.
 *
 * Lower-case only. `data/image-library/{hash}` is a path, so `AB…` and `ab…`
 * would be two names for one file on a case-sensitive volume and one file with
 * two spellings elsewhere — a lookup miss that only reproduces on Linux is not
 * worth the tolerance.
 */
const imageId = z
  .string()
  .regex(IMAGE_ID, 'imageId must be a 64-character lower-case SHA-256 from the image library, not a URL')

/** A whole number of milliseconds, inside one template's own window. */
const duration = (limits: { minSceneMs: number; maxSceneMs: number }) =>
  z.number().int().min(limits.minSceneMs).max(limits.maxSceneMs)

// ── The five scene kinds ─────────────────────────────────────────────────────

export const SlideshowSceneSchema = z
  .object({
    imageId,
    durationMs: duration(TEMPLATE_LIMITS.slideshow),
    kenBurns: z.enum(KEN_BURNS).default(DEFAULT_KEN_BURNS.slideshow),
    transitionOut: z.enum(TRANSITIONS).default('crossfade'),
    // Absent and explicitly null mean the same thing — no overlay — because the
    // model writes this object and asking it to spell out `"textOverlay": null`
    // on every silent scene buys nothing but a retry.
    textOverlay: TextOverlaySchema.nullable().default(null),
  })
  .strict()

/**
 * A screenshot with a band of text on it.
 *
 * No `kenBurns`, and that is the template's whole discipline: a pan across a
 * capture of an interface slides half the interface out of frame, and a zoom
 * crops it. The reason to show a screenshot is that it can be read.
 *
 * `move` is what that discipline was missing. "No camera move" was written down
 * as a rule and read as "no movement", and the film that came back was the
 * complaint: a still capture with a title on it. The three moves this field
 * offers are all inside the margin the 3% overscale leaves — see `OVERLAY_MOVES`
 * for the arithmetic that separates them from the pan.
 */
export const OverlaySceneSchema = z
  .object({
    imageId,
    durationMs: duration(TEMPLATE_LIMITS.overlay),
    move: z.enum(OVERLAY_MOVES).default(DEFAULT_OVERLAY_MOVE),
    band: z
      .object({
        title: line(TEXT_LIMITS.bandTitle),
        subtitle: line(TEXT_LIMITS.bandSubtitle).nullable().default(null),
        position: z.enum(BAND_POSITIONS).default('bottom'),
      })
      .strict(),
    transitionOut: z.enum(TRANSITIONS).default('crossfade'),
  })
  .strict()

/** Full-bleed 9:16, one picture at a time, short beats. */
export const VerticalSceneSchema = z
  .object({
    imageId,
    durationMs: duration(TEMPLATE_LIMITS.vertical),
    kenBurns: z.enum(KEN_BURNS).default(DEFAULT_KEN_BURNS.vertical),
    transitionOut: z.enum(TRANSITIONS).default('crossfade'),
    textOverlay: TextOverlaySchema.nullable().default(null),
  })
  .strict()

/**
 * Words on the theme's own background. The only scene kind with no `imageId` at
 * all — which is the point of the template, and the reason `timelineImageIds`
 * exists rather than every caller reaching for `scene.imageId`.
 */
export const TitleSceneSchema = z
  .object({
    headline: line(TEXT_LIMITS.titleHeadline),
    subtitle: line(TEXT_LIMITS.titleSubtitle).nullable().default(null),
    durationMs: duration(TEMPLATE_LIMITS.titles),
    animation: z.enum(TITLE_ANIMATIONS).default('fade'),
    transitionOut: z.enum(TRANSITIONS).default('crossfade'),
  })
  .strict()

/**
 * One product: a picture, a line, up to three arguments and a call to action.
 *
 * `bullets` is one to three rather than exactly three. A composition that lays
 * out three lays out two, and demanding the third only teaches the model to pad
 * — a filler argument in somebody's advertisement is worse than a shorter card.
 */
export const ProductSceneSchema = z
  .object({
    imageId,
    durationMs: duration(TEMPLATE_LIMITS.product),
    headline: line(TEXT_LIMITS.productHeadline),
    bullets: z.array(line(TEXT_LIMITS.productBullet)).min(1).max(TEXT_LIMITS.productBullets),
    cta: line(TEXT_LIMITS.productCta).nullable().default(null),
    transitionOut: z.enum(TRANSITIONS).default('crossfade'),
  })
  .strict()

// ── The composable variant: a ground, and a stack of typed blocks ────────────
//
// Everything below is one union discriminated on `kind`, plus the ground it is
// painted on. Read the header of this file for why it does not reopen the
// founding rule; what follows is the shape.
//
// Three properties are asserted by construction rather than by a rule anybody
// has to remember, and they are what make a block safe:
//
//   1. **No colour, no font, no unit, anywhere.** A block says WHAT it is, never
//      what it looks like. The theme is attached by the server and the palette
//      is computed by the worker, so a block that could name a colour would be a
//      way around both — the guessed token `theme.ts` refuses, arriving through
//      a layer instead of through a key.
//   2. **No free string.** Every text field is `line(n)`, every choice is a
//      closed enum, every number is a bounded integer. There is nothing here a
//      composition has to interpret, which is the same thing as saying there is
//      nothing here that can become code.
//   3. **Placement and timing come from a shared vocabulary**, `anchor` and
//      `enter`, on every block without exception. A block that placed itself its
//      own way would be a block whose arrangement the composition does not own.

/** A whole number inside its own window. Blocks count things; nothing here is a length. */
const bounded = (min: number, max: number) => z.number().int().min(min).max(max)

/**
 * The two fields every block carries: where it sits, and when it arrives.
 *
 * `enter` is a RANK and not a delay in milliseconds, and that is the same
 * decision as `anchor` being a zone. A millisecond is a rhythm the model
 * described — it would have to know `cueFrames`, `MIN_CUE_TAIL_FRAMES` and the
 * scene's own length to place one that lands inside its scene, and it does not
 * know any of the three. A rank says "this comes after that", which is the only
 * part of the timing that is an editorial decision; the beat itself belongs to
 * the composition, exactly as it does for the five templates that have shipped.
 *
 * Blocks sharing a rank arrive TOGETHER. That is what makes rank a useful thing
 * to write: a heading and its rule are one arrival, and saying so costs one
 * repeated integer.
 *
 * Optional, and absent means "the position it was written in". A default of 0
 * would make every silent document a pile — everything at once, which is the
 * `kenBurns: 'static'` mistake in another costume: an optional field is a field
 * a model omits, so the case you get by saying nothing has to be the good one.
 * It is resolved in `layerCues` in the worker, which is where every other
 * question about a beat is answered.
 */
const placement = {
  anchor: z.enum(ANCHORS).default('center'),
  enter: bounded(0, BLOCK_LIMITS.layersPerScene - 1).optional(),
}

/** A block, as `z.object` shorthand: its own fields, plus the two everything has. */
const block = <K extends string, S extends z.ZodRawShape>(kind: K, shape: S) =>
  z.object({ kind: z.literal(kind), ...placement, ...shape }).strict()

// ── TEXT ─────────────────────────────────────────────────────────────────────

/** A line of display type. `level` is a ROLE, never a size: sizes are the composition's. */
export const HeadingBlockSchema = block('heading', {
  text: line(BLOCK_LIMITS.heading),
  level: z.enum(['display', 'title', 'subtitle']).default('title'),
})

/** A surtitle. The house's most-used device, and here it is one the document asks for. */
export const KickerBlockSchema = block('kicker', {
  text: line(BLOCK_LIMITS.kicker),
})

export const QuoteBlockSchema = block('quote', {
  text: line(BLOCK_LIMITS.quote),
  attribution: line(BLOCK_LIMITS.attribution).nullable().default(null),
})

/**
 * A line with one run of it marked.
 *
 * `mark` is a substring of `text` and the composition finds it by string search.
 * That is prose being laid out, not structure being discovered (I1 names the
 * exemption): there is no pattern, no name, and a `mark` that does not occur is
 * simply a line with nothing highlighted — never an error, and never a repair.
 */
export const TextHighlightBlockSchema = block('textHighlight', {
  text: line(BLOCK_LIMITS.highlight),
  mark: line(BLOCK_LIMITS.highlightMark).nullable().default(null),
  treatment: z.enum(['marker', 'underline', 'box']).default('marker'),
})

/**
 * A title that plays with its own letters.
 *
 * Forty characters and not seventy, which is `heading`'s bound: every treatment
 * here spends horizontal room a plain line does not — an arc pushes its ends
 * down, a stretch opens the tracking to fill the measure — so a line long enough
 * for a heading is a line that leaves the zone once it is bent.
 *
 * `treatment` is a look and never a parameter of one: there is no amplitude, no
 * angle and no per-letter offset, because those are the fields through which a
 * model starts describing its own rendering. The five are five compositions,
 * chosen the way a template is.
 */
export const FunTitleBlockSchema = block('funTitle', {
  text: line(BLOCK_LIMITS.funTitle),
  treatment: z.enum(FUN_TITLE_TREATMENTS).default('bounce'),
})

// ── ANIMATED TEXT ────────────────────────────────────────────────────────────

export const TypewriterBlockSchema = block('typewriter', {
  text: line(BLOCK_LIMITS.typewriter),
  caret: z.boolean().default(true),
})

export const AnimatedListBlockSchema = block('animatedList', {
  items: z.array(line(BLOCK_LIMITS.listItem)).min(1).max(BLOCK_LIMITS.listItems),
  marker: z.enum(['numeral', 'rule', 'dot']).default('numeral'),
})

/**
 * A number that counts up to itself.
 *
 * `prefix` and `suffix` are eight characters because they are a currency mark or
 * a unit — "€", "%", " k". Anything longer is a sentence, and a sentence beside a
 * number is a `heading` next to a `counter`, which is two blocks and reads
 * better as two.
 */
export const CounterBlockSchema = block('counter', {
  to: bounded(0, BLOCK_LIMITS.counterTo),
  from: bounded(0, BLOCK_LIMITS.counterTo).default(0),
  prefix: line(BLOCK_LIMITS.counterAffix).nullable().default(null),
  suffix: line(BLOCK_LIMITS.counterAffix).nullable().default(null),
  label: line(BLOCK_LIMITS.counterLabel).nullable().default(null),
})

/** A wordmark drawn in type, with an optional mark beside it. Never an image, never an SVG path. */
export const LogoTypeBlockSchema = block('logoType', {
  text: line(BLOCK_LIMITS.logoType),
  mark: z.enum(['none', 'square', 'circle', 'slash']).default('square'),
})

// ── INTERFACE ────────────────────────────────────────────────────────────────

export const ButtonBlockSchema = block('button', {
  label: line(BLOCK_LIMITS.buttonLabel),
  variant: z.enum(['filled', 'outline']).default('filled'),
  /** Whether the button is pressed during the scene. A gesture, not a state machine. */
  press: z.boolean().default(true),
})

export const FormBlockSchema = block('form', {
  title: line(BLOCK_LIMITS.formTitle).nullable().default(null),
  fields: z.array(line(BLOCK_LIMITS.formField)).min(1).max(BLOCK_LIMITS.formFields),
  submit: line(BLOCK_LIMITS.formSubmit).nullable().default(null),
})

/**
 * A notification card.
 *
 * `mark` is a SHAPE and not a tone, and the difference is the legibility
 * guarantee. A `tone: 'success'` would have to become green, and green is not a
 * token any direction states — the composition would be inventing a colour, which
 * is the one thing nothing in this feature is allowed to do. A shape is drawn in
 * the accent the project already declared, and the accent is measured.
 */
export const NotificationBlockSchema = block('notification', {
  title: line(BLOCK_LIMITS.noticeTitle),
  body: line(BLOCK_LIMITS.noticeBody).nullable().default(null),
  mark: z.enum(['none', 'dot', 'check', 'bell']).default('dot'),
})

/** The broadcast lower third: a name, a role, and a rule that runs out from one edge. */
export const LowerThirdBlockSchema = block('lowerThird', {
  title: line(BLOCK_LIMITS.lowerTitle),
  subtitle: line(BLOCK_LIMITS.lowerSubtitle).nullable().default(null),
  side: z.enum(['left', 'right']).default('left'),
})

// ── DATA ─────────────────────────────────────────────────────────────────────
//
// Every chart here is drawn from numbers the document states, on a scale the
// composition owns. The values are 0–100 and not "whatever the data is", because
// a chart in a film has no axis anybody can read at a glance and an outlier of
// 10 000 flattens every other bar to a hairline. A percentage is a shape.
//
// `labels` is allowed to be a different length from `values` and the composition
// draws the pairs it has. Enforcing equality would need a refinement, a
// refinement wraps the object in a `ZodEffects`, and `z.discriminatedUnion`
// accepts objects only — so the rule would have to move somewhere nobody reading
// this file would find it, to refuse a document whose worst outcome is a bar
// without a caption under it.

export const BarChartBlockSchema = block('barChart', {
  values: z.array(bounded(0, 100)).min(BLOCK_LIMITS.barValuesMin).max(BLOCK_LIMITS.barValues),
  labels: z.array(line(BLOCK_LIMITS.barLabel)).max(BLOCK_LIMITS.barValues).nullable().default(null),
  baseline: z.boolean().default(true),
})

export const LineChartBlockSchema = block('lineChart', {
  values: z.array(bounded(0, 100)).min(BLOCK_LIMITS.lineValuesMin).max(BLOCK_LIMITS.lineValues),
  label: line(BLOCK_LIMITS.lineLabel).nullable().default(null),
  area: z.boolean().default(true),
})

/**
 * An equalizer, and a soundWave beside it — and **there is no audio in this
 * feature**.
 *
 * That absence is decided rather than pending: the schema is `.strict()` from
 * top to bottom precisely so a document asking for a track is refused whole
 * instead of rendering silence and being reported as a success. So these two are
 * what they say they are, which is a MOTIF: bars and a waveform driven by a
 * deterministic curve the composition owns, with no `@remotion/media-utils`, no
 * file and nothing being listened to. An equalizer whose bars follow a fixed
 * curve is an equalizer; it would only be a lie if something claimed it was
 * hearing anything, and nothing does.
 *
 * `tempo` and `shape` are the two ways to ask for a different curve, and they
 * are enums for the same reason every other choice here is: a period in
 * milliseconds is a rhythm the model described.
 */
export const EqualizerBlockSchema = block('equalizer', {
  bars: bounded(BLOCK_LIMITS.equalizerBarsMin, BLOCK_LIMITS.equalizerBars).default(12),
  tempo: z.enum(['slow', 'steady', 'fast']).default('steady'),
})

export const SoundWaveBlockSchema = block('soundWave', {
  samples: bounded(BLOCK_LIMITS.waveSamplesMin, BLOCK_LIMITS.waveSamples).default(48),
  shape: z.enum(['pulse', 'sweep', 'breathe']).default('sweep'),
})

/**
 * A world map, drawn as a field of dots.
 *
 * `region` frames it and nothing more: this container has no egress and no map
 * asset, so what a composition can draw is an abstraction of a coastline in the
 * house's own vocabulary, not a projection of real geography. Marker POSITIONS
 * are the composition's — a document that placed them would be placing pixels,
 * and a latitude is a coordinate under another name.
 */
export const MapBlockSchema = block('map', {
  region: z.enum(['world', 'europe', 'americas', 'asia', 'africa']).default('world'),
  markers: bounded(0, BLOCK_LIMITS.mapMarkers).default(3),
  connections: z.boolean().default(true),
})

/**
 * The same world, on a sphere — and the same three fields, deliberately.
 *
 * `map` gave up its sub-regions once already, and the reason was resolution: a
 * flat mask fine enough to draw a border is a mask that draws the wrong border,
 * so what it draws is a coastline at the scale of a continent. A globe does not
 * have that problem, because a sphere has no border to miss — what a viewer reads
 * is the shape of the continents and the fact that they curve away, and both
 * survive at whatever resolution the box can carry. It draws from the SAME mask
 * (`LAND_ROWS`), because a globe whose Africa differed from the map's would be two
 * worlds in one film.
 *
 * `region` frames it exactly as it frames the flat map: it says which part of the
 * world faces the camera when the scene opens, and nothing about where a marker
 * goes. Marker POSITIONS are the composition's for `map`'s own reason — a document
 * that placed one would be placing a coordinate, and a latitude is a coordinate
 * under another name.
 *
 * It is drawn by a renderer, so it is one of the blocks
 * `server/video/three-d.js` rations.
 */
export const GlobeBlockSchema = block('globe', {
  region: z.enum(['world', 'europe', 'americas', 'asia', 'africa']).default('world'),
  markers: bounded(0, BLOCK_LIMITS.mapMarkers).default(3),
  connections: z.boolean().default(true),
})

/**
 * A column chart with volume — and the one block in the catalogue whose whole
 * design is an argument about a projection.
 *
 * A 3D bar chart is a data-visualisation anti-pattern wherever it appears, and
 * the reason is the vanishing point: two equal values at two depths draw two
 * different columns, so the one thing a bar chart is FOR is what the picture
 * destroys. The brief that asked for this block said so in advance — a histogram
 * whose values cannot be read is a decoration, and if it cannot be made readable
 * it should be something else.
 *
 * It can. Drawn under a PARALLEL projection a vertical of world height `h` maps to
 * `h·cos(elevation)` on the screen wherever it stands, so equal values draw equal
 * columns; and with the row at a single depth and the yaw bounded by the air
 * between two columns, no bar can hide another. Both are arithmetic rather than
 * taste — `chartProject` and `chartOcclusion` in
 * `worker/video/remotion/blocks/dataVolume.js`, held by that file's own corpus.
 *
 * The fields are `barChart`'s, because it IS `barChart`: the same percentages on
 * the same scale, with `plinth` where the flat one has `baseline` — a plate rather
 * than a rule, since a line drawn in space is the one element whose thickness a
 * projection is free to change. The labels are flat type over the canvas, for the
 * reason the block's own header gives at length.
 */
export const SolidChartBlockSchema = block('solidChart', {
  values: z.array(bounded(0, 100)).min(BLOCK_LIMITS.barValuesMin).max(BLOCK_LIMITS.barValues),
  labels: z.array(line(BLOCK_LIMITS.barLabel)).max(BLOCK_LIMITS.barValues).nullable().default(null),
  plinth: z.boolean().default(true),
})

// ── MEDIA AND TIME ───────────────────────────────────────────────────────────

export const ImageFrameBlockSchema = block('imageFrame', {
  imageId,
  // A move and not `static` by default, for the reason `DEFAULT_KEN_BURNS` gives
  // at length: the case you get by saying nothing has to be the one that moves.
  move: z.enum(KEN_BURNS).default('zoom-in'),
  treatment: z.enum(['bleed', 'inset', 'card']).default('card'),
  caption: line(BLOCK_LIMITS.caption).nullable().default(null),
})

export const GalleryBlockSchema = block('gallery', {
  imageIds: z.array(imageId).min(BLOCK_LIMITS.galleryImagesMin).max(BLOCK_LIMITS.galleryImages),
  layout: z.enum(['grid', 'row', 'stack']).default('grid'),
})

export const CarouselBlockSchema = block('carousel', {
  imageIds: z.array(imageId).min(BLOCK_LIMITS.carouselImagesMin).max(BLOCK_LIMITS.carouselImages),
  direction: z.enum(['left', 'right']).default('left'),
})

/**
 * A picture standing in real perspective — the bridge between the image library
 * and a renderer.
 *
 * It is the commercial use of 3D and the one that pays for its own cost: a
 * photograph on a turning panel is what a product film is made of, and the
 * picture is one the user selected rather than a shape a model described. Like
 * every other block it stays inside the founding rule — a frame and a move out of
 * two closed enums, one or two ids out of the user's own selection, and the
 * geometry, the camera, the light rig, the fit and every colour are written by
 * hand in `worker/video/remotion/blocks/stage.js` and `composition.js`. There is
 * no mesh field, no coordinate, no material, no angle and no lens.
 *
 * `imageIds` and not `imageId` plus a `backImageId`, which is the one shape
 * decision here worth arguing. `timelineImageIds` walks `imageId` and `imageIds`
 * and nothing else, and it is what decides which files the worker stages and what
 * `/compose` checks against the user's selection — so a third spelling would be a
 * picture nobody staged and, worse, one nobody authorised. The first is the face
 * and the second is what is on the back.
 *
 * What it costs is on its card in `compose.js`, measured rather than assumed, and
 * `THREE_D_BLOCKS` is what keeps an administrator's permission covering it.
 */
export const PhotoStageBlockSchema = block('photoStage', {
  imageIds: z.array(imageId).min(BLOCK_LIMITS.stageImagesMin).max(BLOCK_LIMITS.stageImages),
  frame: z.enum(STAGE_FRAMES).default('card'),
  // A move and not a `static` by default, for the reason `DEFAULT_KEN_BURNS`
  // gives at length: the case you get by saying nothing has to be the one that
  // moves. There is no `static` in the enum at all here — see `STAGE_MOVES`.
  move: z.enum(STAGE_MOVES).default('orbit'),
})

/**
 * Several pictures on a carousel, turning past the camera.
 *
 * The flat `carousel` slides pictures across a strip; this one stands them on a
 * ring, so the ones at the sides are turned away and the one at the front is
 * square to the eye. That is the difference between a shelf and a display, and it
 * is the reason both exist rather than one taking a `depth` flag.
 *
 * No `frame: 'device'` is refused and none is special-cased: three panels in a
 * case is a legal document and an odd film, which is what the card's third
 * sentence is for.
 */
export const PhotoRingBlockSchema = block('photoRing', {
  imageIds: z.array(imageId).min(BLOCK_LIMITS.ringImagesMin).max(BLOCK_LIMITS.ringImages),
  frame: z.enum(STAGE_FRAMES).default('plain'),
  direction: z.enum(['left', 'right']).default('left'),
})

/**
 * A clock, and it does not tell the time.
 *
 * `time` is what the document states and nothing else. Reading the render host's
 * clock would burn a fact about the MACHINE into a film — the hour a container in
 * another timezone happened to start work — and two renders of one timeline would
 * then differ, which breaks the content addressing the export store is built on.
 * Absent, the hands sweep and no numerals are drawn, which is a clock as a motif.
 */
export const ClockBlockSchema = block('clock', {
  face: z.enum(['analog', 'digital']).default('analog'),
  /** `HH:MM` on a 24-hour dial. A charset with no letter in it, so it can never become anything. */
  time: z
    .string()
    .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'time must read HH:MM on a 24-hour clock, such as 09:30')
    .nullable()
    .default(null),
  sweep: z.enum(['real', 'fast']).default('fast'),
  label: line(BLOCK_LIMITS.clockLabel).nullable().default(null),
})

/** A date, as the document writes it. Same rule as the clock: never the host's own. */
export const DateStampBlockSchema = block('dateStamp', {
  text: line(BLOCK_LIMITS.dateStamp),
  treatment: z.enum(['plain', 'boxed', 'rule']).default('rule'),
})

// ── MISC ─────────────────────────────────────────────────────────────────────

export const SeparatorBlockSchema = block('separator', {
  treatment: z.enum(['rule', 'double', 'dots']).default('rule'),
  extent: z.enum(['short', 'measure', 'full']).default('measure'),
})

export const ProgressBarBlockSchema = block('progressBar', {
  to: bounded(0, 100),
  label: line(BLOCK_LIMITS.progressLabel).nullable().default(null),
  showValue: z.boolean().default(true),
})

// ── SET PIECES ───────────────────────────────────────────────────────────────

/**
 * Code, typed into a panel line by line.
 *
 * `lines` carries a `role` per line rather than a language name, and the note on
 * `CODE_ROLES` is where that decision is argued. Sixty-four characters is a
 * legibility bound like every other one here: monospace at a size a film can be
 * read at fits about that across a panel, and a longer line is not a longer line
 * — it is a line with its end off the frame or a wrap nobody wrote.
 *
 * Ten lines for the same reason: the panel is sized to hold them, and an
 * eleventh would shrink the type rather than lengthen the panel.
 */
export const CodeBlockSchema = block('codeBlock', {
  lines: z
    .array(
      z
        .object({
          text: line(BLOCK_LIMITS.codeLine),
          role: z.enum(CODE_ROLES).default('plain'),
        })
        .strict(),
    )
    .min(BLOCK_LIMITS.codeLinesMin)
    .max(BLOCK_LIMITS.codeLines),
  /** The file name or the language, written on the panel's tab. Never inferred from the code. */
  caption: line(BLOCK_LIMITS.codeCaption).nullable().default(null),
  /** Whether the lines type themselves in, or arrive one after another already written. */
  reveal: z.enum(['type', 'lines']).default('lines'),
})

/**
 * A lit solid, turning.
 *
 * The only block in the catalogue whose renderer is a dependency the worker
 * would not otherwise carry — `three`, `@react-three/fiber` and
 * `@remotion/three`, all MIT, 32 MB on a 1.57 GB image and 4 s on an 83 s build.
 * It stays inside the founding rule for the reason every other block does: a
 * document names a solid and a spin out of two closed enums, and the geometry,
 * the camera, the light rig and every colour are written by hand in
 * `worker/video/remotion/blocks/solidScene.jsx` and `composition.js`. There is no
 * mesh field, no coordinate, no material and no file name.
 *
 * `size` is a share of the block's own box and not a number of pixels, so it
 * reads the same in the three ratios — the `anchor` argument applied to depth.
 */
export const SolidSceneBlockSchema = block('solidScene', {
  solid: z.enum(SOLIDS).default('cube'),
  spin: z.enum(SPINS).default('tumble'),
  size: z.enum(['small', 'medium', 'large']).default('medium'),
})

/**
 * A line of type with real thickness, standing in the scene and turning in it.
 *
 * The second block whose renderer is a dependency, and it costs no NEW one: it
 * draws with the same `three`, `@react-three/fiber` and `@remotion/three` the
 * lit solid already brought. What it deliberately does not bring is
 * `@react-three/drei`, whose `<Text3D>` is the obvious way to extrude a glyph —
 * measured at +118.9 MiB installed and +59 packages on a base of 185.9 MiB, a
 * 64% larger install for one block, and refused on a second ground that no
 * amount of disk would have fixed. `Text3D` needs a `typeface.json`, a converted
 * outline dump baked into the image, and this container installs exactly one
 * font family. Every flat block in the catalogue names the direction's DECLARED
 * typeface first and falls back to that family; a baked outline set cannot, so a
 * 3D title would be Liberation Sans on every theme in the product while the
 * heading beside it honoured the art direction. A film in two typefaces is the
 * guessed token `theme.ts` refuses, arriving through a package.
 *
 * So the glyphs are rasterised by the browser that is already drawing the frame,
 * in the project's own font stack, and the third dimension is real geometry
 * carrying them. `funTitle` is what Skia became without a package; this is what
 * `Text3D` became without one.
 *
 * Twenty-four characters, which is `logoType`'s bound and not `funTitle`'s
 * forty. An extruded title is a SHORT one: the line cannot wrap — a second line
 * at a second depth reads as a shadow of the first — so its size is bounded by
 * its whole length across the measure, and forty characters across a full frame
 * is 54 px of type with a two-pixel thickness. That is a whole renderer drawing
 * a flat line.
 *
 * `level` is a ROLE and never a size, exactly as `heading`'s is: `display` is a
 * title card and `title` is a wordmark. There is no third — at the body step the
 * whole thickness of a `deep` extrusion is under four pixels, and a block that
 * costs a renderer has to be visibly worth it.
 */
export const ExtrudedTypeBlockSchema = block('extrudedType', {
  text: line(BLOCK_LIMITS.extrudedType),
  level: z.enum(['display', 'title']).default('display'),
  depth: z.enum(EXTRUDED_DEPTHS).default('medium'),
  spin: z.enum(EXTRUDED_SPINS).default('sway'),
})

// ── FIELDS IN VOLUME ─────────────────────────────────────────────────────────
//
// Three grounds with a depth to them, drawn by the renderer `solidScene` already
// brought in. They are the answer to "the background should be in 3D" and they
// are shaped exactly like everything else in this file: a name out of a closed
// enum and a whole number inside its own window. There is no seed, no position,
// no colour and no speed in any of them — a seed is the one field through which
// a document could render differently from itself, which is the same failure a
// `Math.random` is, arriving through a key instead of through a call.

/**
 * How a `particleField` moves. A named drift, never a velocity.
 *
 * `rise` lifts the dust and wraps it off-frame, `orbit` turns the whole cloud
 * about the vertical — the one that reads as VOLUME, since the near dust crosses
 * the frame faster than the far — and `swarm` sends every particle round its own
 * small loop with the cloud staying put. There is no `still`, for the reason
 * `OVERLAY_MOVES` has none: dust that holds is a texture, and there are three of
 * those among the grounds already.
 */
export const PARTICLE_DRIFTS = ['rise', 'orbit', 'swarm'] as const

/**
 * A field of dust, drifting in real space.
 *
 * `count` is a number of particles and not a density, because the composition
 * cannot ask a document how large its box will turn out to be — a density would
 * be a count multiplied by a frame the model cannot see. Its ceiling is measured
 * and it is the ENCODER's rather than the renderer's: see `BLOCK_LIMITS`.
 *
 * The size of a particle is NOT in here, and that absence is the same one every
 * amplitude in this file is. It falls out of the count — roughly constant
 * coverage, so a sparse field is made of larger motes — in `particleSize`, where
 * it can be measured against the bitrate it costs.
 */
export const ParticleFieldBlockSchema = block('particleField', {
  count: bounded(BLOCK_LIMITS.particlesMin, BLOCK_LIMITS.particles).default(280),
  drift: z.enum(PARTICLE_DRIFTS).default('rise'),
})

/**
 * How a `waveMesh` swells, and how far it is raked away from the eye.
 *
 * Both are named looks and neither is a number: an amplitude, a wavelength and a
 * speed in a schema are the three fields through which a model starts describing
 * its own rendering, which is `funTitle`'s argument about treatments. These are
 * three seas and two viewpoints.
 *
 * The tilt stops at `rake` because of the CAMERA rather than because of taste:
 * past about a quarter turn the near edge of a sheet large enough to cover the
 * frustum comes through the lens. A floor seen at a steeper angle is a different
 * block, and it is the next one down.
 */
export const WAVE_SWELLS = ['calm', 'swell', 'ripple'] as const
export const WAVE_TILTS = ['face', 'rake'] as const

/**
 * A lit surface, swelling — the most expensive block in the catalogue.
 *
 * It costs no NEW dependency: the same `three`, `@react-three/fiber` and
 * `@remotion/three` the lit solid already brought. What it costs is fill, and
 * that was measured before it was taken — a full-frame lit sheet at its box's own
 * pixels is +1.7 s of render per second of film against the ~1.7 s/s the
 * duration-scaled deadline leaves spare, which is one block spending a whole
 * film's margin. Drawn inside `FIELD_PIXEL_BUDGET` and stretched back over its
 * box it is +1.0 s/s, which is a `solidScene` and change. A lit relief has
 * nothing on it finer than the gradient across it, so what that trade costs is
 * nothing anybody can see; the numbers are in `docs/video-export.md`.
 */
export const WaveMeshBlockSchema = block('waveMesh', {
  swell: z.enum(WAVE_SWELLS).default('swell'),
  tilt: z.enum(WAVE_TILTS).default('rake'),
})

/**
 * What a `depthGrid` is, and which way it runs.
 *
 * `tunnel` is the default rather than `floor` because a floor alone leaves the
 * top of the frame on the bare ground — a horizon, which is right for a scene
 * about distance and wrong for a scene that wanted the whole frame to be this.
 * The case a silent document gets has to be the good one, which is the lesson
 * `DEFAULT_KEN_BURNS` is named after.
 *
 * There is no `still` travel, and that is `OVERLAY_MOVES`' argument rather than
 * `kenBurns`': a floor drifting toward the eye crops nothing and hides nothing,
 * so a document buys nothing by asking it to hold, while what it would cost is
 * the one guarantee this feature refuses to lose by accident.
 */
export const GRID_FORMS = ['floor', 'tunnel'] as const
export const GRID_TRAVELS = ['toward', 'away', 'sway'] as const

/**
 * A grid of rules running away from the eye.
 *
 * The rules are drawn as long thin BOXES and not as lines, and that is measured
 * as well as compositional: a line primitive is one pixel wide whatever its
 * depth, so a floor made of them has no perspective in its own weight — and it
 * is the geometry that got a wireframe refused at 2.7 s of render per second of
 * film. Full frame it is +0.28 s/s as a floor and +0.85 s/s as the densest
 * tunnel the schema allows; what it really spends is bitrate, and the far end is
 * fogged into the ground for that reason.
 */
export const DepthGridBlockSchema = block('depthGrid', {
  lines: bounded(BLOCK_LIMITS.gridLinesMin, BLOCK_LIMITS.gridLines).default(10),
  form: z.enum(GRID_FORMS).default('tunnel'),
  travel: z.enum(GRID_TRAVELS).default('toward'),
})

/**
 * One layer of a composed scene.
 *
 * Discriminated on `kind`, `.strict()` on every member, and every member is a
 * component in `worker/video/remotion/blocks/` named after that same word. The
 * registry there is checked against this union by a test, because a kind the
 * schema accepts with no component behind it is an export that fails after the
 * user was told it was queued — the same failure `RENDERABLE_TEMPLATES` exists
 * to turn into a sentence one machine further along.
 */
export const BlockSchema = z.discriminatedUnion('kind', [
  HeadingBlockSchema,
  KickerBlockSchema,
  QuoteBlockSchema,
  TextHighlightBlockSchema,
  FunTitleBlockSchema,
  TypewriterBlockSchema,
  AnimatedListBlockSchema,
  CounterBlockSchema,
  LogoTypeBlockSchema,
  ButtonBlockSchema,
  FormBlockSchema,
  NotificationBlockSchema,
  LowerThirdBlockSchema,
  BarChartBlockSchema,
  LineChartBlockSchema,
  EqualizerBlockSchema,
  SoundWaveBlockSchema,
  MapBlockSchema,
  GlobeBlockSchema,
  SolidChartBlockSchema,
  ImageFrameBlockSchema,
  GalleryBlockSchema,
  CarouselBlockSchema,
  ClockBlockSchema,
  DateStampBlockSchema,
  PhotoStageBlockSchema,
  PhotoRingBlockSchema,
  SeparatorBlockSchema,
  ProgressBarBlockSchema,
  CodeBlockSchema,
  SolidSceneBlockSchema,
  ExtrudedTypeBlockSchema,
  ParticleFieldBlockSchema,
  WaveMeshBlockSchema,
  DepthGridBlockSchema,
])

// ── The ground ───────────────────────────────────────────────────────────────

const bg = <K extends string, S extends z.ZodRawShape>(kind: K, shape: S) =>
  z.object({ kind: z.literal(kind), ...shape }).strict()

export const SolidBackgroundSchema = bg('solid', {})
export const HairlinesBackgroundSchema = bg('hairlines', {})

export const GradientBackgroundSchema = bg('gradient', {
  direction: z.enum(GRADIENT_DIRECTIONS).default('to-bottom'),
})

export const GridPulseBackgroundSchema = bg('gridPulse', {
  cells: bounded(BLOCK_LIMITS.gridCellsMin, BLOCK_LIMITS.gridCells).default(8),
})

export const ParticlesBackgroundSchema = bg('particles', {
  density: bounded(1, BLOCK_LIMITS.particleDensity).default(2),
})

export const ImageBackgroundSchema = bg('image', {
  imageId,
  move: z.enum(KEN_BURNS).default('zoom-in'),
})

export const BackgroundSchema = z.discriminatedUnion('kind', [
  SolidBackgroundSchema,
  GradientBackgroundSchema,
  HairlinesBackgroundSchema,
  GridPulseBackgroundSchema,
  ParticlesBackgroundSchema,
  ImageBackgroundSchema,
])

/**
 * A composed scene: a ground, and one to eight blocks on it.
 *
 * The default ground is `hairlines`, which is the house's own field of 1 px
 * rules and the surface two of the five templates are already drawn on. It is
 * the one that holds still, and that is deliberate rather than an oversight of
 * the "nothing may hold still by accident" rule: a composed scene moves through
 * its layers — every block arrives, and the whole stack drifts across the scene
 * — and the ground is the surface every one of those runs was MEASURED against.
 * A ground that moved under fixed type would be text crossing a surface nobody
 * measured, which is the same argument `TITLE_BLOCK_DRIFT` already makes for
 * moving the block and not the field behind it. A document that wants a moving
 * ground asks for one, and three of the six move.
 *
 * The default must be a background with no other field, because `z.default` hands
 * its value through without re-parsing it: a default carrying an inner default
 * would be the one shape in this file whose stated and unstated forms differ.
 */
export const ComposedSceneSchema = z
  .object({
    durationMs: duration(TEMPLATE_LIMITS.composed),
    background: BackgroundSchema.default({ kind: 'hairlines' }),
    layers: z.array(BlockSchema).min(1).max(BLOCK_LIMITS.layersPerScene),
    transitionOut: z.enum(COMPOSED_TRANSITIONS).default('crossfade'),
  })
  .strict()

// ── The five documents ───────────────────────────────────────────────────────

const OUTPUT_SHAPE = {
  outputFormat: z.enum(OUTPUT_FORMATS).default('mp4'),
  aspectRatio: z.enum(ASPECT_RATIOS).default('16:9'),
}

export const SlideshowTimelineSchema = z
  .object({
    template: z.literal('slideshow'),
    scenes: z.array(SlideshowSceneSchema).min(1).max(TEMPLATE_LIMITS.slideshow.maxScenes),
    ...OUTPUT_SHAPE,
  })
  // `.strict()` here and on every nested object is the load-bearing part. An
  // unknown key is how a field the compositions do not read gets accepted in
  // silence: the model asks for an audio track, or an `src`, validation passes,
  // the render ignores it, and the user is told the export succeeded while
  // watching something it did not ask for. There is no audio, and a schema that
  // strips unknown keys cannot say so.
  .strict()

export const OverlayTimelineSchema = z
  .object({
    template: z.literal('overlay'),
    scenes: z.array(OverlaySceneSchema).min(1).max(TEMPLATE_LIMITS.overlay.maxScenes),
    ...OUTPUT_SHAPE,
  })
  .strict()

export const VerticalTimelineSchema = z
  .object({
    template: z.literal('vertical'),
    scenes: z.array(VerticalSceneSchema).min(1).max(TEMPLATE_LIMITS.vertical.maxScenes),
    outputFormat: OUTPUT_SHAPE.outputFormat,
    /*
     * Not an enum with a default: the ratio is the template.
     *
     * A vertical composition lays out safe areas for a phone feed, and asked for
     * 16:9 it would produce a letterboxed rectangle with its captions in the
     * wrong third — a legal document rendering a film nobody described. Making
     * the other two ratios UNREACHABLE here is cheaper than a rule saying not to
     * ask for them, and it is the same trick as having no `fps` field at all.
     */
    aspectRatio: z.literal('9:16').default('9:16'),
  })
  .strict()

export const TitlesTimelineSchema = z
  .object({
    template: z.literal('titles'),
    scenes: z.array(TitleSceneSchema).min(1).max(TEMPLATE_LIMITS.titles.maxScenes),
    ...OUTPUT_SHAPE,
  })
  .strict()

export const ProductTimelineSchema = z
  .object({
    template: z.literal('product'),
    scenes: z.array(ProductSceneSchema).min(1).max(TEMPLATE_LIMITS.product.maxScenes),
    ...OUTPUT_SHAPE,
  })
  .strict()

export const ComposedTimelineSchema = z
  .object({
    template: z.literal('composed'),
    scenes: z.array(ComposedSceneSchema).min(1).max(TEMPLATE_LIMITS.composed.maxScenes),
    ...OUTPUT_SHAPE,
  })
  .strict()

/**
 * A document with no `template` is a slideshow.
 *
 * Not politeness: montages composed before the catalogue existed are sitting in
 * saved drafts and in the queue's journal, and every one of them would start
 * failing validation the day this file shipped. That is a silent regression —
 * the export panel would refuse a timeline the user had built and been shown.
 *
 * This is a DEFAULT, not the repair the schema forbids. `kenBurns` and `move`
 * are filled in exactly the same way. It adds nothing a document did not already
 * say, it can only ever produce the one shape those documents already had, and
 * a document that names a template it does not match is still refused whole.
 */
const withDefaultTemplate = (value: unknown): unknown => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const doc = value as Record<string, unknown>
  return doc.template === undefined ? { ...doc, template: 'slideshow' } : doc
}

/**
 * The ceiling, applied to the union rather than to each variant.
 *
 * It has to see the whole document — every scene kind carries `durationMs`, and
 * what no per-scene check can see is that legal scenes add up to an illegal
 * film.
 */
const refuseOverBudget = (timeline: { scenes: ReadonlyArray<{ durationMs: number }> }, ctx: z.RefinementCtx) => {
  const total = totalDurationMs(timeline)
  if (total > MAX_TOTAL_DURATION_MS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scenes'],
      message:
        `Total duration is ${total} ms; the maximum is ${MAX_TOTAL_DURATION_MS} ms ` +
        `(${MAX_TOTAL_DURATION_MS / 1000} seconds). Shorten or remove scenes.`,
    })
  }
}

/**
 * What a caller — a model, the editor, the API — may hand in.
 *
 * There is no `theme` here, and that is the whole enforcement of "the model does
 * not choose the look": the objects are `.strict()`, so a `theme` written by a
 * model is refused exactly like an `audio` key, with the same message and the
 * same absence of a repair path.
 */
export const VideoTimelineSchema = z
  .preprocess(
    withDefaultTemplate,
    z.discriminatedUnion('template', [
      SlideshowTimelineSchema,
      OverlayTimelineSchema,
      VerticalTimelineSchema,
      TitlesTimelineSchema,
      ProductTimelineSchema,
      ComposedTimelineSchema,
    ]),
  )
  .superRefine(refuseOverBudget)

const THEME_SHAPE = { theme: VideoThemeSchema.optional() }

/**
 * The document as the renderer receives it: the validated timeline, plus the
 * theme the SERVER attached to it.
 *
 * Two schemas rather than one optional field, because the difference is who is
 * allowed to write which key. Everything a model may say is in
 * `VideoTimelineSchema`; `theme` can only be added by code that already holds
 * the project's direction, after the model's document has been accepted. One
 * schema with an optional theme would accept a model that wrote its own, and
 * the whole point is that it cannot.
 */
export const RenderTimelineSchema = z
  .preprocess(
    withDefaultTemplate,
    z.discriminatedUnion('template', [
      SlideshowTimelineSchema.extend(THEME_SHAPE),
      OverlayTimelineSchema.extend(THEME_SHAPE),
      VerticalTimelineSchema.extend(THEME_SHAPE),
      TitlesTimelineSchema.extend(THEME_SHAPE),
      ProductTimelineSchema.extend(THEME_SHAPE),
      ComposedTimelineSchema.extend(THEME_SHAPE),
    ]),
  )
  .superRefine(refuseOverBudget)

/**
 * No repair, ever. There is no `clampScene`, no truncation of a 200-character
 * overlay, no dropping of the twenty-first scene — a rejection is a rejection,
 * and the caller retries with the message.
 *
 * The temptation is real, because every one of those repairs turns a failed
 * model call into a shipped video. It is also exactly the hole this schema was
 * written to close: a repaired document is one nobody validated. Clamping a 40 s
 * scene to 15 s does not produce the video that was asked for, it produces a
 * different one that happens to be legal, and the user has no way to tell which
 * they are looking at. Worse, repair is where the total-duration rule dies: fix
 * each scene independently and twenty of them still add up to five minutes.
 *
 * The catalogue does not soften it: a document naming `product` is validated as
 * a product and refused as a product. It is never re-tried as a slideshow
 * because that one would have passed.
 */
export type VideoTemplate = (typeof VIDEO_TEMPLATES)[number]
/** The five with a form behind them. See `EDITABLE_TEMPLATES`. */
export type EditableTemplate = (typeof EDITABLE_TEMPLATES)[number]
export type TextOverlay = z.infer<typeof TextOverlaySchema>
export type VideoTheme = z.infer<typeof VideoThemeSchema>

export type Block = z.infer<typeof BlockSchema>
export type BlockKind = (typeof BLOCK_KINDS)[number]
export type BlockFamily = keyof typeof BLOCK_FAMILIES
export type Background = z.infer<typeof BackgroundSchema>
export type BackgroundKind = (typeof BACKGROUND_KINDS)[number]
export type Anchor = (typeof ANCHORS)[number]
export type GradientDirection = (typeof GRADIENT_DIRECTIONS)[number]
export type ComposedTransition = (typeof COMPOSED_TRANSITIONS)[number]
export type ComposedScene = z.infer<typeof ComposedSceneSchema>
export type ComposedTimeline = z.infer<typeof ComposedTimelineSchema>

export type SlideshowScene = z.infer<typeof SlideshowSceneSchema>
export type OverlayScene = z.infer<typeof OverlaySceneSchema>
export type VerticalScene = z.infer<typeof VerticalSceneSchema>
export type TitleScene = z.infer<typeof TitleSceneSchema>
export type ProductScene = z.infer<typeof ProductSceneSchema>

export type SlideshowTimeline = z.infer<typeof SlideshowTimelineSchema>
export type OverlayTimeline = z.infer<typeof OverlayTimelineSchema>
export type VerticalTimeline = z.infer<typeof VerticalTimelineSchema>
export type TitlesTimeline = z.infer<typeof TitlesTimelineSchema>
export type ProductTimeline = z.infer<typeof ProductTimelineSchema>

export type VideoTimeline = z.infer<typeof VideoTimelineSchema>
export type RenderTimeline = z.infer<typeof RenderTimelineSchema>

/**
 * What a caller may hand in — defaults not yet applied.
 *
 * Written out rather than taken from `z.input`, because `z.preprocess` declares
 * its own input as `unknown` and that would silently disable every check the
 * editor gets from this type. The second arm is the compatibility rule in the
 * type system: a slideshow may arrive without naming itself.
 */
export type SlideshowTimelineInput = z.input<typeof SlideshowTimelineSchema>

export type VideoTimelineInput =
  | z.input<typeof SlideshowTimelineSchema>
  | Omit<z.input<typeof SlideshowTimelineSchema>, 'template'>
  | z.input<typeof OverlayTimelineSchema>
  | z.input<typeof VerticalTimelineSchema>
  | z.input<typeof TitlesTimelineSchema>
  | z.input<typeof ProductTimelineSchema>
  | z.input<typeof ComposedTimelineSchema>

export type KenBurns = (typeof KEN_BURNS)[number]
export type OverlayMove = (typeof OVERLAY_MOVES)[number]
export type Transition = (typeof TRANSITIONS)[number]
export type OverlayPosition = (typeof OVERLAY_POSITIONS)[number]
export type BandPosition = (typeof BAND_POSITIONS)[number]
export type TitleAnimation = (typeof TITLE_ANIMATIONS)[number]
export type OutputFormat = (typeof OUTPUT_FORMATS)[number]
export type AspectRatio = (typeof ASPECT_RATIOS)[number]

/** Sum of the scene durations, in ms. The render budget, and what the UI shows. */
export function totalDurationMs(timeline: { scenes: ReadonlyArray<{ durationMs: number }> }): number {
  return timeline.scenes.reduce((sum, scene) => sum + scene.durationMs, 0)
}

/**
 * Every library image a timeline needs, deduplicated, in first-use order.
 *
 * A function and not `scenes.map((s) => s.imageId)` at each call site, because
 * one template has no images at all: a `titles` film would produce `[undefined]`
 * there, and the two callers that matter — the existence check in `/render` and
 * `collectImages` in the worker client — would then look up a file called
 * "undefined" and report the wrong failure for it.
 *
 * A composed scene made that indirection worth much more than it was. Its
 * pictures are not on the scene at all: they are on the ground when it is a
 * photograph, and on `imageFrame`, `gallery` and `carousel` blocks anywhere in
 * the stack — and a gallery holds six. Every caller that walked `scene.imageId`
 * by hand would have sent a film to the worker with no bytes for most of its
 * pictures, which `validate.js` refuses by name AFTER the queue accepted the job.
 */
export function timelineImageIds(timeline: Pick<VideoTimeline, 'scenes'>): string[] {
  const ids: string[] = []
  const push = (value: unknown) => {
    if (typeof value === 'string' && value && !ids.includes(value)) ids.push(value)
  }
  for (const scene of timeline.scenes) {
    // `in` rather than a cast, so the day another template arrives without an
    // image the compiler already knows this loop handles it.
    if ('imageId' in scene) push(scene.imageId)
    if ('background' in scene && scene.background.kind === 'image') push(scene.background.imageId)
    if ('layers' in scene) {
      for (const layer of scene.layers) {
        if ('imageId' in layer) push(layer.imageId)
        if ('imageIds' in layer) for (const id of layer.imageIds) push(id)
      }
    }
  }
  return ids
}
