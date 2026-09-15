/**
 * What keeps two films from being the same film.
 *
 * ── The defect, measured rather than felt ───────────────────────────────────
 *
 * Thirty-one films rendered on a real instance: `heading` in all thirty-one,
 * eleven of thirty-six blocks ever used, sixty per cent of every layer anchored
 * `center-left`, and nine of the last ten films OPENING on the same scene —
 * gradient, kicker, heading, separator, left column. That scene was the first of
 * five worked examples printed, verbatim and in the same order, into every
 * compose prompt. A model shown one good answer writes that answer; temperature
 * does not fix it, because the example is the most probable document there is.
 *
 * So three things here, and none of them is a template:
 *
 * 1. The worked examples are a POOL, and a request is shown a few of them, drawn.
 *    Only examples made entirely of what this request offers are eligible — an
 *    example naming a withheld block teaches the one refusal that costs a call.
 * 2. A STARTING POINT is drawn for each fresh film — how it opens, where its
 *    weight sits, which rarely used blocks are worth a scene — out of closed lists
 *    whose entries each say what they need. The brief still wins over all of it.
 * 3. What the account's last films already did is COUNTED and printed, so "do
 *    something else" names the thing to avoid rather than hoping.
 *
 * ── And the case where variety is the bug ───────────────────────────────────
 *
 * A person who asks for the same film in blue does not want another film. That
 * is `revisionMode`: with a current film on the panel and a brief that CHANGED,
 * the film is revised — the draw and the history are not printed at all, and the
 * prompt says to change only what the new brief asks. The same brief pressed
 * again is the opposite request, "another one", and gets the draw plus the
 * current film counted as the most recent thing not to repeat.
 *
 * Everything printed here is server-owned vocabulary — block and ground names out
 * of the closed enums, and sentences written in this file. Nothing a user or a
 * model wrote passes through, which is why it may live in the SYSTEM turn (Q5).
 * The current film under revision does carry their words, and travels in the
 * user turn for that reason (`compose.js`).
 */

/** How many of the account's recent films are counted. Past a handful the counts stop saying "recently". */
export const HISTORY_FILMS = 6

/** How many worked examples one request is shown. Three is a range; five was a menu read top to bottom. */
export const STACKS_SHOWN = 3

/**
 * The column an anchor sits in. `full` is its own, because a field is not "the
 * centre" — counting it there is how a globe film would read as centred type.
 */
export function anchorColumn(anchor) {
  const a = typeof anchor === 'string' ? anchor : 'center'
  if (a === 'full') return 'full'
  if (a.endsWith('left')) return 'left'
  if (a.endsWith('right')) return 'right'
  return 'center'
}

/** A composed scene's shape in one line: its ground and its blocks, in the order written. */
export function sceneShape(scene) {
  const ground = scene?.background?.kind ?? 'solid'
  const layers = Array.isArray(scene?.layers) ? scene.layers : []
  return `${ground}: ${layers.map((l) => `${l.kind}@${l.anchor ?? 'center'}`).join(' + ')}`
}

/**
 * What a list of films already did, counted.
 *
 * Blocks and grounds are counted per FILM, not per occurrence: a heading in
 * every scene of one film is one film that used a heading, and the sentence this
 * feeds is "used in N of the last M films". Columns are counted per layer,
 * because placement is a habit of every scene rather than of a film.
 *
 * Anything that is not a composed film is skipped rather than refused — the
 * journal holds slideshows, drafts saved before blocks existed, and whatever an
 * older build wrote.
 */
export function filmUsage(timelines) {
  const films = (Array.isArray(timelines) ? timelines : []).filter(
    (t) => t && t.template === 'composed' && Array.isArray(t.scenes) && t.scenes.length,
  )
  const blocks = {}
  const grounds = {}
  const columns = { left: 0, center: 0, right: 0, full: 0 }
  const openings = {}
  let layers = 0
  for (const film of films) {
    const usedBlocks = new Set()
    const usedGrounds = new Set()
    for (const scene of film.scenes) {
      usedGrounds.add(scene?.background?.kind ?? 'solid')
      for (const layer of Array.isArray(scene?.layers) ? scene.layers : []) {
        usedBlocks.add(layer.kind)
        columns[anchorColumn(layer.anchor)] += 1
        layers += 1
      }
    }
    for (const b of usedBlocks) blocks[b] = (blocks[b] || 0) + 1
    for (const g of usedGrounds) grounds[g] = (grounds[g] || 0) + 1
    const opening = sceneShape(film.scenes[0])
    openings[opening] = (openings[opening] || 0) + 1
  }
  return { films: films.length, blocks, grounds, columns, openings, layers }
}

/**
 * Worked scenes. Each names a ground and its blocks with their zones, and says in
 * one clause why they belong together — the part a model can reuse without
 * reusing the scene.
 *
 * Deliberately spread: every family appears, all ten anchors appear, and no two
 * share an opening shape. `variety.test.js` checks every name against the enums,
 * so a renamed block fails there instead of teaching a refusal.
 */
export const WORKED_SCENES = [
  { ground: 'gridPulse', layers: [['counter', 'center'], ['kicker', 'top-center']], why: 'the figure that matters, with a line saying what is counted' },
  { ground: 'image', layers: [['lowerThird', 'bottom-left'], ['progressBar', 'bottom-center']], why: 'naming what is on screen, and how far through the film this is' },
  { ground: 'solid', layers: [['soundWave', 'full'], ['logoType', 'center']], why: 'a rhythm with nothing playing, and a name standing on it' },
  { ground: 'hairlines', layers: [['heading', 'center'], ['button', 'bottom-center']], why: 'a closing card: one sentence and the one thing to do' },
  { ground: 'solid', layers: [['typewriter', 'top-right']], why: 'a single thought typed out in the corner, the rest of the frame left empty on purpose' },
  { ground: 'gradient', layers: [['quote', 'center-right'], ['imageFrame', 'center-left']], why: 'a voice beside the thing it is about' },
  { ground: 'hairlines', layers: [['barChart', 'full'], ['kicker', 'top-left']], why: 'the data as the surface, and a short line saying what it measures' },
  { ground: 'particles', layers: [['funTitle', 'center']], why: 'one word with a personality, alone' },
  { ground: 'solid', layers: [['animatedList', 'center-left'], ['separator', 'center-left']], why: 'three short reasons arriving one after the other' },
  { ground: 'gradient', layers: [['notification', 'top-right'], ['heading', 'bottom-left']], why: 'the product speaking first, the sentence answering it from the opposite corner' },
  { ground: 'hairlines', layers: [['map', 'full'], ['dateStamp', 'bottom-right']], why: 'where and when, and nothing else' },
  { ground: 'solid', layers: [['textHighlight', 'center']], why: 'the sentence with its one important word marked' },
  { ground: 'gridPulse', layers: [['lineChart', 'center-right'], ['heading', 'center-left']], why: 'a trend and the claim it supports, side by side' },
  { ground: 'solid', layers: [['gallery', 'full']], why: 'the pictures themselves, as the whole scene' },
  { ground: 'gradient', layers: [['clock', 'center-left'], ['heading', 'center-right']], why: 'a moment in time and what happens at it' },
  { ground: 'hairlines', layers: [['form', 'center-right'], ['kicker', 'top-left']], why: 'the product in use, with its name in the corner' },
  { ground: 'solid', layers: [['extrudedType', 'center']], why: 'a name in volume, as the set piece of the film' },
  { ground: 'gradient', layers: [['waveMesh', 'full'], ['heading', 'bottom-center']], why: 'a moving surface with one line standing low on it' },
  { ground: 'image', layers: [['heading', 'top-left'], ['equalizer', 'bottom-right']], why: 'a picture with its title high and a pulse low, the middle left to the picture' },
  { ground: 'solid', layers: [['photoStage', 'center-left'], ['counter', 'center-right']], why: 'the object, and the number that makes it worth having' },
  { ground: 'hairlines', layers: [['codeBlock', 'center']], why: 'the thing a developer would actually type, alone' },
  { ground: 'particles', layers: [['globe', 'full'], ['kicker', 'bottom-left']], why: 'the world turning, and a word saying where' },
  // Surfaces with no word on them. Without these a `background` — which offers
  // no block that sets type — had not one eligible example and was shown none.
  { ground: 'gradient', layers: [['waveMesh', 'full']], why: 'a slow surface under whatever the page sets on it' },
  { ground: 'solid', layers: [['equalizer', 'full']], why: 'a pulse across the whole band' },
  { ground: 'particles', layers: [['depthGrid', 'full']], why: 'depth with nothing standing in it' },
  { ground: 'hairlines', layers: [['particleField', 'full']], why: 'drift, and room left for the page' },
  { ground: 'gridPulse', layers: [['soundWave', 'full']], why: 'a line breathing across the frame' },
  // The narrow doorways — `mark` and `banner` — each need a few of their own.
  { ground: 'hairlines', layers: [['logoType', 'center'], ['separator', 'center']], why: 'the name, and a rule drawn under it' },
  { ground: 'solid', layers: [['solidScene', 'center-left'], ['logoType', 'center-right']], why: 'an object in volume beside the name it belongs to' },
  { ground: 'gridPulse', layers: [['dateStamp', 'center-left'], ['heading', 'center-right']], why: 'the date, and what happens on it' },
  { ground: 'solid', layers: [['logoType', 'top-left'], ['button', 'bottom-right']], why: 'who is speaking, and the one thing to do, in opposite corners' },
  { ground: 'gradient', layers: [['counter', 'center-left'], ['globe', 'center-right']], why: 'how many places, beside the world they are in' },
]

/**
 * Openings: how the FIRST scene begins. Each entry says which blocks it needs
 * (any one of them), so an opening that this request cannot compose is never
 * drawn. `needsScenes` is for the openings that are a promise about the SECOND
 * scene too.
 */
export const OPENINGS = [
  {
    id: 'subject',
    needs: ['imageFrame', 'gallery', 'carousel', 'photoStage', 'photoRing', 'particleField', 'waveMesh', 'depthGrid', 'solidScene', 'globe', 'map'],
    needsScenes: 2,
    text: 'Open on the SUBJECT with no words at all: the first scene is a picture, a field or a set piece alone, and the first line of text arrives in the second scene.',
  },
  {
    id: 'word',
    needs: ['heading', 'funTitle', 'extrudedType'],
    text: 'Open on ONE word or a very short name, set as large as the frame allows, with nothing beside it.',
  },
  {
    id: 'figure',
    needs: ['counter', 'barChart', 'lineChart', 'solidChart'],
    text: 'Open on the NUMBER: the figure arrives first, and the sentence explaining it comes after — only if the brief gives you a real figure.',
  },
  {
    id: 'typing',
    needs: ['typewriter'],
    text: 'Open mid-thought: the first line types itself out, and nothing else moves until it is finished.',
  },
  {
    id: 'surface',
    needs: ['soundWave', 'equalizer', 'particleField', 'waveMesh', 'depthGrid', 'map', 'globe', 'barChart'],
    text: 'Open IN MOTION: a moving surface anchored "full", with at most one short line standing on it.',
  },
  {
    id: 'voice',
    needs: ['quote'],
    text: 'Open on a VOICE: a quotation before any claim of your own.',
  },
  {
    id: 'list',
    needs: ['animatedList'],
    text: 'Open on a LIST: short items arriving one after another, and the headline, if any, afterwards.',
  },
  {
    id: 'interface',
    needs: ['notification', 'form', 'codeBlock', 'button'],
    text: 'Open on the product IN USE — a notification, a form, a line of code — before any headline.',
  },
  {
    id: 'mark',
    needs: ['logoType', 'extrudedType'],
    text: 'Open on the MARK: the name assembling itself, alone in the frame.',
  },
  {
    id: 'highlight',
    needs: ['textHighlight'],
    text: 'Open on the one sentence that matters, with its key word marked.',
  },
]

/**
 * Where the weight of the frame sits. `column` is what `filmUsage` counted, so a
 * habit the history shows is drawn less often; the two entries with no column
 * are shapes rather than sides, and are weighted as a fresh choice.
 */
export const AXES = [
  { id: 'right', column: 'right', text: 'Weight on the RIGHT: words live in the right column ("top-right", "center-right", "bottom-right"); the left of the frame is for the subject or for air.' },
  { id: 'left', column: 'left', text: 'Weight on the LEFT: words live in the left column, the right of the frame is for the subject or for air.' },
  { id: 'centre', column: 'center', text: 'CENTRED and symmetric: everything on the centre column, stacked, nothing pushed to a side.' },
  { id: 'split', column: null, text: 'TOP AND BOTTOM: one thing high ("top-…"), one thing low ("bottom-…"), and the middle of the frame left open.' },
  { id: 'diagonal', column: null, text: 'A DIAGONAL: the first thing in a top corner, the next in the opposite bottom corner, so the eye crosses the frame.' },
  { id: 'field', column: 'full', needs: ['particleField', 'waveMesh', 'depthGrid', 'soundWave', 'equalizer', 'map', 'globe', 'barChart', 'lineChart', 'gallery', 'imageFrame', 'photoStage'], text: 'The WHOLE FRAME: one block anchored "full", and whatever stands on it kept small, in one zone.' },
]

/** Blocks that carry words for everything else. Never "featured": they are the default already. */
const STAPLES = new Set(['heading', 'kicker', 'separator'])

/** One entry out of a weighted list. `random` is injected so a test can pin the draw. */
function pickWeighted(items, weightOf, random) {
  const weights = items.map((item) => Math.max(0, weightOf(item)))
  const total = weights.reduce((a, b) => a + b, 0)
  if (!items.length || total <= 0) return items[0] ?? null
  let r = random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r < 0) return items[i]
  }
  return items[items.length - 1]
}

/** `n` distinct entries, each drawn by weight from what is left. */
function pickMany(items, n, weightOf, random) {
  const left = [...items]
  const out = []
  while (out.length < n && left.length) {
    const pick = pickWeighted(left, weightOf, random)
    out.push(pick)
    left.splice(left.indexOf(pick), 1)
  }
  return out
}

/**
 * The worked examples one request is shown.
 *
 * Eligible only when every block and the ground are on offer. Weighted AWAY from
 * what the history shows: an example whose blocks every recent film already used
 * teaches nothing the model was not about to write.
 */
export function drawStacks({ kinds, grounds, usage = filmUsage([]), random = Math.random, count = STACKS_SHOWN }) {
  const haveBlocks = new Set(kinds)
  const haveGrounds = new Set(grounds)
  const eligible = WORKED_SCENES.filter(
    (s) => haveGrounds.has(s.ground) && s.layers.every(([kind]) => haveBlocks.has(kind)),
  )
  const films = Math.max(1, usage.films)
  const staleness = (s) => {
    const shares = s.layers.map(([kind]) => (usage.blocks[kind] || 0) / films)
    return shares.reduce((a, b) => a + b, 0) / shares.length
  }
  return pickMany(eligible, count, (s) => 1.1 - staleness(s), random)
}

/** The drawn examples as prompt lines. The header is the one `compose.test.js` cuts the catalogue at. */
export function stackLines(stacks) {
  if (!stacks.length) return []
  return [
    'STACKS THAT WORK — each of these is ONE scene, drawn for this request out of a larger set',
    ...stacks.map(
      (s) => `- ${s.why}: ground "${s.ground}"; ${s.layers.map(([kind, anchor]) => `a "${kind}" in "${anchor}"`).join('; ')}.`,
    ),
    'They show how pieces COMBINE. Do not copy one as your scene: a film made of these is a film somebody',
    'already saw. Four scenes that are each different is a film; one scene with all of them in it is a poster.',
  ]
}

/**
 * The starting point of a fresh film: an opening, an axis, and up to two blocks
 * worth a scene.
 *
 * `motionKind` matters in exactly one way: a `background` sets no type, so an
 * opening and an axis — both about where WORDS go — are meaningless for it, and
 * only the featured surface is drawn.
 */
export function drawStartingPoint({ kinds, usage = filmUsage([]), random = Math.random, maxScenes = 12, motionKind = null }) {
  const have = new Set(kinds)
  const offers = (needs) => !needs || needs.some((k) => have.has(k))
  const films = Math.max(1, usage.films)
  const layers = Math.max(1, usage.layers)
  const typeless = motionKind === 'background'

  const opening = typeless
    ? null
    : pickWeighted(
        OPENINGS.filter((o) => offers(o.needs) && (o.needsScenes ?? 1) <= maxScenes),
        () => 1,
        random,
      )
  const axis = typeless
    ? null
    : pickWeighted(
        AXES.filter((a) => offers(a.needs)),
        (a) => (a.column ? Math.max(0.15, 1 - (usage.columns[a.column] || 0) / layers) : 0.8),
        random,
      )
  const featured = pickMany(
    kinds.filter((k) => !STAPLES.has(k)),
    2,
    (k) => 1 / (1 + (usage.blocks[k] || 0) * (6 / films)),
    random,
  )
  return { opening, axis, featured }
}

/** The starting point as prompt lines. The brief outranks it, and it says so. */
export function startingPointLines(point, usage = filmUsage([])) {
  const lines = ['THIS FILM\'S STARTING POINT — drawn for this request so that no two films begin alike']
  if (point.opening) lines.push(`- ${point.opening.text}`)
  if (point.axis) lines.push(`- ${point.axis.text} Keep that for most scenes; one scene may break it.`)
  if (point.featured.length) {
    const unused = point.featured.filter((k) => !usage.blocks[k])
    lines.push(
      `- Worth building a scene around, if the brief allows: ${point.featured.map((k) => `"${k}"`).join(' and ')}.` +
        (usage.films && unused.length === point.featured.length ? ' None of the recent films used them.' : ''),
    )
  }
  lines.push('The BRIEF outranks every line above: when it asks for something else, do what it asks.')
  return lines
}

/**
 * What the recent films already did, as the thing NOT to repeat.
 *
 * Only what is worth avoiding is printed — an opening seen once is not a habit,
 * and a block in one film out of six is not either — so a quiet history prints
 * nothing at all rather than a paragraph of zeros.
 */
export function historyLines(usage) {
  if (!usage.films) return []
  const out = []
  const openings = Object.entries(usage.openings).sort((a, b) => b[1] - a[1])
  if (openings.length) {
    out.push(
      `- ${usage.films === 1 ? 'It' : 'They'} opened on: ${openings
        .slice(0, 3)
        .map(([shape, n]) => `${shape}${n > 1 ? ` (${n} times)` : ''}`)
        .join('; ')}. Do not open on ${openings.length === 1 ? 'that' : 'any of those'}.`,
    )
  }
  const habitual = Object.entries(usage.blocks)
    .filter(([, n]) => n >= Math.max(2, Math.ceil(usage.films / 2)))
    .sort((a, b) => b[1] - a[1])
  if (habitual.length) {
    out.push(
      `- Blocks already in most of them: ${habitual.map(([k, n]) => `"${k}" (${n} of ${usage.films})`).join(', ')}.` +
        ' Use one only where this brief needs exactly that, never as the default.',
    )
  }
  const [column, count] = Object.entries(usage.columns).sort((a, b) => b[1] - a[1])[0] ?? []
  if (column && usage.layers >= 4 && count / usage.layers >= 0.4) {
    out.push(
      `- ${Math.round((100 * count) / usage.layers)}% of ${usage.films === 1 ? 'its' : 'their'} blocks sat in the ${column === 'full' ? '"full" zone' : `${column} column`}. Place this film elsewhere.`,
    )
  }
  const grounds = Object.entries(usage.grounds)
    .filter(([, n]) => n >= Math.max(2, Math.ceil(usage.films / 2)))
    .sort((a, b) => b[1] - a[1])
  if (grounds.length) {
    out.push(`- Grounds they kept returning to: ${grounds.map(([g, n]) => `"${g}" (${n} of ${usage.films})`).join(', ')}.`)
  }
  if (!out.length) return []
  return [
    usage.films === 1
      ? 'WHAT THE LAST FILM ON THIS ACCOUNT ALREADY DID — this one must not look like it'
      : `WHAT THE LAST ${usage.films} FILMS ON THIS ACCOUNT ALREADY DID — this one must not look like them`,
    ...out,
  ]
}

/**
 * Fresh, again, or a revision.
 *
 * - `fresh`: no current film. The draw and the history.
 * - `again`: a current film, and the person asked for ANOTHER one — the draw,
 *   the history, and the current film counted first.
 * - `revise`: a current film, and the person changed what they asked for.
 *   Change what changed.
 *
 * The panel decides between the last two and says so in `revise`, because the
 * panel is also what LABELS the button — "Modifier le film" against "Générer
 * autre chose" — and two readings of "did the brief change" in two languages
 * would be a button promising one prompt while the server printed the other.
 * Decided from the strings rather than by a model reading intent either way: the
 * modes print different prompts, and a guess here would be a guess nobody could
 * see. The one judgement left to the model is "the new brief is a different film
 * altogether", and the revision prompt hands it that exit.
 */
export function revisionMode(previous, revise) {
  if (!previous || !previous.timeline) return 'fresh'
  return revise === true ? 'revise' : 'again'
}

/** The revision instruction. Its data — the current film and its brief — is in the user turn. */
export function revisionLines() {
  return [
    'YOU ARE REVISING A FILM, NOT COMPOSING A NEW ONE',
    '- The next message holds the CURRENT film, the brief it was made from, and the NEW brief.',
    '- Change only what the new brief asks for that the old one did not. Every scene, block, anchor, rank,',
    '  ground, duration, transition and line of text the new brief does not mention stays EXACTLY as it is,',
    '  in the same order.',
    '- A request about colour, typeface or contrast changes NOTHING in this document: those are attached',
    '  afterwards from the brief itself. Return the current film as it is.',
    '- If the new brief describes a different film altogether — another subject, another purpose — compose',
    '  that film from the catalogue instead, and ignore this section.',
  ]
}
