// The TYPES of Motion — what a film is FOR, as a closed enum.
//
// ── Why this is not a second catalogue ───────────────────────────────────────
//
// The request that produced this file asked for "templates de création Motion",
// and named a globe, a background, a button, a hero. Read as templates those are
// four more entries in `VIDEO_TEMPLATES` — four more compositions to write, four
// more branches in the worker, and the sixth template's whole argument thrown
// away: `composed` exists precisely so that a new look is a COMBINATION rather
// than a card somebody wrote.
//
// So a Motion kind is a DOORWAY into the catalogue that already exists. It names
// no component, adds no field to the schema, and cannot be rendered: every kind
// resolves to a subset of `BLOCK_KINDS`, a subset of `BACKGROUND_KINDS`, one
// `ASPECT_RATIOS` value and a window inside `TEMPLATE_LIMITS.composed`. A film
// composed under a kind is an ordinary `composed` document — the worker never
// learns the kind existed, `validate.js` is untouched, and a saved draft from
// before this file parses exactly as it did.
//
// That is also why the enum lives HERE and not in `timeline.js`. Same argument
// `three-d.js` makes about itself one file over: a kind is not a fact about the
// schema, it is a fact about what is OFFERED, and `timeline.js` is a hand-kept
// mirror whose corpus test is the reason nobody may add to it casually. Putting
// a sixth hand-kept mirror in this module's way is how the five became four
// separate bugs.
//
// ── And why the browser does not hold a copy ─────────────────────────────────
//
// The panel needs the list to draw a selector. It reads it off `GET
// /api/video/status`, beside `limits`, exactly as it already reads `maxScenes`
// rather than retyping it — "quoting the bounds from the schema rather than the
// panel is what keeps the two from drifting apart". What travels is the IDS
// alone: the prose below is a prompt in English addressed to a model, and the
// sentence a user reads is a translation key in `src/i18n/parts/muse.ts` — the
// selector lives in the Muse panel, not in the export panel — one per id, which
// a parity test requires in both languages.
import { BLOCK_KINDS, BACKGROUND_KINDS, TEMPLATE_LIMITS, ASPECT_RATIOS } from './timeline.js'

const COMPOSED_LIMITS = TEMPLATE_LIMITS.composed

/**
 * What each kind is, what it is made of, and how it goes wrong.
 *
 * The shape mirrors `BLOCK_NOTES` in `compose.js` on purpose — three sentences,
 * the third of which argues against the entry — because it is read by the same
 * model in the same prompt and a card that changed voice halfway down would read
 * as two documents. And like that table, **no number and no enum value appears
 * in the prose**: every bound below is a field, `motionKindCard` prints it, and
 * `kinds.test.js` reads these strings looking for digits.
 *
 * `blocks` is a NARROWING and never an instruction. A model shown twenty-seven
 * blocks and told "use the first six" uses all twenty-seven — that is the lesson
 * `availableBlocks` already learned about pictures and about 3D — so a kind
 * removes the rest from the catalogue instead of arguing about them.
 *
 * `signature` is the part without which the kind is not itself. It exists
 * because a narrowing can come back EMPTY: `globe` on an account with no 3D
 * permission, `showcase` on an empty selection. A kind whose signature blocks
 * have all been withheld is refused by NAME, saying which door to knock on —
 * the module's rule that a refusal states what is still possible.
 */
export const MOTION_KIND_SPECS = {
  hero: {
    what: 'the opening statement of a page, at the top, behind or above the first words a visitor reads.',
    right: 'the screen needs one idea delivered before anything is scrolled.',
    wrong: 'when it carries a second and a third idea. A hero that says three things says none of them, and the page below it is where the rest goes.',
    blocks: [
      'heading',
      'kicker',
      'funTitle',
      'typewriter',
      'logoType',
      'separator',
      'button',
      'imageFrame',
      'extrudedType',
      'particleField',
      'waveMesh',
      'depthGrid',
    ],
    grounds: ['solid', 'gradient', 'hairlines', 'gridPulse', 'particles', 'image'],
    signature: ['heading', 'funTitle', 'typewriter', 'extrudedType'],
    aspectRatio: '16:9',
    scenes: { min: 1, max: 3 },
    sceneMs: { min: 2500, max: 6000 },
  },

  background: {
    what: 'a surface a section is laid on. It is what is BEHIND the words, and the words are not in it.',
    right: 'a band of the page needs depth or movement under type the page itself sets.',
    wrong: 'the moment it carries a line of text. Two headlines then compete — one in the film at a size the film chose, one in the page at a size the page chose — and neither can be corrected without re-rendering.',
    /*
     * Surfaces only, and nothing that sets type. The narrowing IS the rule
     * here: a `background` that could name a `heading` would name one, and the
     * defect this kind exists to avoid is exactly a headline burnt into a
     * backdrop.
     *
     * The last two are why this kind does not need the 3D permission to exist.
     * The three fields are all drawn in GL, so an account without it would have
     * had `background` starved — the one kind a page uses most, refused for a
     * reason about renderers. `soundWave` and `equalizer` anchored `full` are a
     * moving surface carrying no glyph, which is the same picture drawn flat;
     * the prompt's own worked example already composes one. So the kind
     * degrades instead of disappearing (Q1).
     */
    blocks: ['particleField', 'waveMesh', 'depthGrid', 'soundWave', 'equalizer'],
    grounds: ['solid', 'gradient', 'hairlines', 'gridPulse', 'particles'],
    signature: ['particleField', 'waveMesh', 'depthGrid', 'soundWave', 'equalizer'],
    aspectRatio: '16:9',
    // One scene. A background that cuts is a background that interrupts the
    // reading happening on top of it, and the film loops in the page.
    scenes: { min: 1, max: 1 },
    sceneMs: { min: 6000, max: 12000 },
  },

  banner: {
    what: 'a wide strip that announces one thing — a launch, a date, a name.',
    right: 'the page has a rail or a header band and the announcement has to fit in it.',
    wrong: 'as a small film. There is no room for a scene that develops: whatever is not readable in the first beat is not read.',
    blocks: ['kicker', 'heading', 'logoType', 'dateStamp', 'button', 'separator', 'progressBar', 'counter'],
    grounds: ['solid', 'gradient', 'hairlines', 'gridPulse'],
    signature: ['kicker', 'heading', 'logoType', 'dateStamp'],
    aspectRatio: '16:9',
    scenes: { min: 1, max: 2 },
    sceneMs: { min: 2000, max: 4500 },
  },

  showcase: {
    what: 'one object, its name, and the one reason to want it.',
    right: 'a product tile, a card in a grid, the thing a page is selling shown rather than described.',
    wrong: 'when it argues. A list of features is a section of the page; this is the picture and the noun.',
    blocks: [
      'imageFrame',
      'gallery',
      'carousel',
      'photoStage',
      'photoRing',
      'heading',
      'kicker',
      'counter',
      'button',
      'separator',
    ],
    grounds: ['solid', 'gradient', 'hairlines', 'image'],
    // Every one needs a picture, which is the point: a showcase with nothing to
    // show is refused by name rather than composed out of type.
    signature: ['imageFrame', 'gallery', 'carousel', 'photoStage', 'photoRing'],
    aspectRatio: '1:1',
    scenes: { min: 1, max: 4 },
    sceneMs: { min: 2500, max: 6000 },
  },

  figure: {
    what: 'the number the page is about, arriving.',
    right: 'a statistic, a result or a measurement is the argument, and a static digit does not read as one.',
    wrong: 'with a figure nobody gave you. A counter reads as true, and a round number invented to fill a frame is a claim in somebody else\'s film.',
    blocks: [
      'counter',
      'barChart',
      'lineChart',
      'solidChart',
      'progressBar',
      'heading',
      'kicker',
      'separator',
      'animatedList',
    ],
    grounds: ['solid', 'gradient', 'hairlines', 'gridPulse'],
    signature: ['counter', 'barChart', 'lineChart', 'solidChart'],
    aspectRatio: '16:9',
    scenes: { min: 1, max: 4 },
    sceneMs: { min: 2500, max: 6000 },
  },

  globe: {
    what: 'the world seen in volume, turning.',
    right: 'the page says where it operates, and a flat map has already been read as a decoration.',
    wrong: 'as a claim about places. What a viewer reads on it is the SHAPE of the continents; a border it seems to draw is at the scale of a continent and is not one.',
    blocks: ['globe', 'map', 'heading', 'kicker', 'counter', 'separator', 'dateStamp'],
    grounds: ['solid', 'gradient', 'hairlines', 'particles'],
    signature: ['globe'],
    aspectRatio: '16:9',
    scenes: { min: 1, max: 3 },
    sceneMs: { min: 3000, max: 7000 },
  },

  mark: {
    what: 'a name or a logotype assembling itself.',
    right: 'a sign-off, a footer, the last frame of anything, or the mark on its own at the head of a page.',
    wrong: 'when something else shares the frame. A mark that arrives beside a sentence is a sentence with an ornament next to it.',
    blocks: ['logoType', 'extrudedType', 'funTitle', 'kicker', 'separator', 'textHighlight'],
    grounds: ['solid', 'gradient', 'hairlines', 'particles'],
    signature: ['logoType', 'extrudedType', 'funTitle'],
    aspectRatio: '1:1',
    scenes: { min: 1, max: 2 },
    sceneMs: { min: 2000, max: 5000 },
  },

  story: {
    what: 'a vertical cut for a phone feed: full bleed, short beats, read with one thumb.',
    right: 'the film leaves the page — a post, a reel, anything held upright.',
    wrong: 'as a landscape film turned on its side. The frame keeps the feed\'s own bands top and bottom, so anything laid in them is under an interface.',
    blocks: [
      'heading',
      'kicker',
      'quote',
      'typewriter',
      'animatedList',
      'counter',
      'logoType',
      'imageFrame',
      'gallery',
      'button',
      'separator',
      'progressBar',
      'particleField',
      'waveMesh',
    ],
    grounds: ['solid', 'gradient', 'hairlines', 'gridPulse', 'particles', 'image'],
    signature: ['heading', 'kicker', 'quote', 'typewriter'],
    aspectRatio: '9:16',
    scenes: { min: 2, max: 6 },
    sceneMs: { min: 1500, max: 4000 },
  },
}

/**
 * The enum. Declaration order, because it is printed in a refusal and read in a
 * selector, and two orderings of one list read as two lists.
 */
export const MOTION_KINDS = Object.keys(MOTION_KIND_SPECS)

const KINDS = new Set(MOTION_KINDS)

/**
 * The kind a request asked for, or `null` for "no kind — compose freely".
 *
 * Shaped like `requestedTemplate` in `compose.js` and for the same reason: the
 * value arrives from a request body, so anything that is not exactly one of the
 * names is nothing. It does NOT throw — `motionKindRefusal` is the caller's job,
 * and telling "absent" apart from "unknown" is what lets the route answer 400
 * for the second while composing freely for the first.
 */
export function motionKindOf(value) {
  return typeof value === 'string' && KINDS.has(value) ? value : null
}

/** Whether a value is a name this instance knows. `null`/`undefined` are not asks. */
export function isMotionKind(value) {
  return typeof value === 'string' && KINDS.has(value)
}

/**
 * The refusal for a name nobody offers.
 *
 * Names the whole enum rather than saying "unknown kind", because the caller is
 * a panel that was built against some version of this list and the useful half
 * of the answer is which names it may send instead.
 */
export function unknownMotionKindRefusal(asked, consequence) {
  const named = typeof asked === 'string' && asked.trim() ? `"${asked.trim().slice(0, 40)}"` : 'that'
  return (
    `${named} is not a kind of Motion this instance offers. The kinds are: ${MOTION_KINDS.join(', ')} — ` +
    `or none at all, which composes a film freely from the whole catalogue. ${consequence}`
  )
}

/**
 * The blocks a kind leaves on the catalogue, given what was already available.
 *
 * An INTERSECTION, and the order is `available`'s — which is `BLOCK_KINDS`'s,
 * which is the order the families print in. A kind may not add a block back:
 * `available` has already dropped what the selection cannot carry and what the
 * account may not spend, and a doorway that re-opened either of those would be a
 * permission written twice.
 */
export function narrowBlocks(available, kind) {
  const spec = MOTION_KIND_SPECS[kind]
  if (!spec) return available
  const wanted = new Set(spec.blocks)
  return available.filter((name) => wanted.has(name))
}

/** The same intersection for the grounds. See `narrowBlocks`. */
export function narrowGrounds(available, kind) {
  const spec = MOTION_KIND_SPECS[kind]
  if (!spec) return available
  const wanted = new Set(spec.grounds)
  return available.filter((name) => wanted.has(name))
}

/**
 * Has the narrowing left this kind unable to be itself?
 *
 * The case that makes this function necessary is `globe` on an account without
 * the 3D permission: the intersection is not empty — `heading`, `kicker` and
 * `map` survive — so nothing downstream would notice, and what comes back is a
 * flat film with a caption about the world. The user pressed a button that said
 * globe. So the question is asked of the SIGNATURE blocks, not of the count.
 *
 * @returns {string|null} the refusal, or null when the kind is still itself
 */
export function starvedMotionKind(kind, availableBlocks, consequence) {
  const spec = MOTION_KIND_SPECS[kind]
  if (!spec) return null
  const have = new Set(availableBlocks)
  if (spec.signature.some((name) => have.has(name))) return null
  return (
    `A "${kind}" film is made of ${spec.signature.join(', ')}, and ${
      spec.signature.length > 1 ? 'none of those blocks is' : 'that block is not'
    } available on this request — either no image is selected, or 3D rendering is not enabled for this ` +
    `account. Choose another kind, select the images first, or ask an administrator. ${consequence}`
  )
}

/**
 * The card the prompt prints for the kind that was asked for.
 *
 * Three sentences of prose then the bounds, exactly like `blockCard`, and every
 * bound is READ from the spec. The kind is stated as what the film IS rather
 * than as a constraint on it, for the reason the withheld blocks are stated as a
 * fact about the instance: a model told what it is making makes it, and a model
 * told what it may not make argues.
 */
export function motionKindCard(kind) {
  const spec = MOTION_KIND_SPECS[kind]
  if (!spec) return []
  return [
    '',
    `THIS FILM IS A ${kind.toUpperCase()}, AND THAT IS WHAT IT IS FOR`,
    `- ${spec.what}`,
    `- take this shape when ${spec.right}`,
    `- it goes wrong ${spec.wrong}`,
    `- scenes: ${spec.scenes.min} to ${spec.scenes.max}, each ${spec.sceneMs.min} to ${spec.sceneMs.max} ms.`,
    `  Those are this kind's own numbers and they are narrower than the catalogue's.`,
    `- aspectRatio: ${spec.aspectRatio}. It is the shape of the place this film is going, so it is the one to use.`,
    '- The catalogue below is already the part of it this kind is made of. Nothing was left out by mistake:',
    '  a block that is not there is one that would make this film something else.',
  ]
}

/**
 * What `/status` publishes, so the panel can draw a selector without holding a
 * copy of any of the above.
 *
 * The ids, the format and the window — never the prose. The three sentences are
 * a prompt written in English for a model; the sentence a person reads is
 * `muse.motionKind.<id>` in both dictionaries, and a panel that printed `what`
 * would be showing a French user an English instruction meant for a machine.
 */
export function publicMotionKinds() {
  return MOTION_KINDS.map((id) => ({
    id,
    aspectRatio: MOTION_KIND_SPECS[id].aspectRatio,
    minScenes: MOTION_KIND_SPECS[id].scenes.min,
    maxScenes: MOTION_KIND_SPECS[id].scenes.max,
    minSceneMs: MOTION_KIND_SPECS[id].sceneMs.min,
    maxSceneMs: MOTION_KIND_SPECS[id].sceneMs.max,
  }))
}

/**
 * The longest film a kind can ask for. Used to tell a caller what it is about to
 * wait for, before the render is queued rather than after.
 */
export function motionKindCeilingMs(kind) {
  const spec = MOTION_KIND_SPECS[kind]
  if (!spec) return COMPOSED_LIMITS.maxScenes * COMPOSED_LIMITS.maxSceneMs
  return spec.scenes.max * spec.sceneMs.max
}

/** Exported for the test that holds every window inside the composed template's. */
export { COMPOSED_LIMITS, BLOCK_KINDS, BACKGROUND_KINDS, ASPECT_RATIOS }
