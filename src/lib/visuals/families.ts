/**
 * The VISUAL families — the closed catalogue `<Visual>` draws a text with.
 *
 * A visual is a text's ideas laid out as a process, a cycle, a timeline, a
 * comparison, a chart… The model never draws one: it writes the CONTENT once
 * (`VisualDoc`, below) and names a family, and a hand-written layout in
 * `snippets/Visual.ts` does the drawing. That is the rule the films were built
 * on (the model names a block, it never describes its own rendering), and the
 * one Napkin's own API betrays — a layout has an id, a request "guides without
 * guaranteeing". Two things follow from it, and they are the point:
 *
 *  - the content does not depend on the family, so moving a visual from a
 *    cycle to a timeline is writing one attribute (`lib/visuals/read.ts`), no
 *    model call, nothing lost;
 *  - the look comes from the screen's palette and the layout's own arithmetic,
 *    so a visual cannot come back as an improvised SVG that is right on one
 *    text and broken on the next.
 *
 * This file is the ONE source of the families and their bounds. The snippet
 * receives `VISUAL_BOUNDS` as JSON, the capability's card reads its sentences
 * from here, the dialog reads `accepts`, and `families.test.ts` holds the three
 * together — a bound retyped in a prompt is a bound that drifts.
 */

/** The capability id of the `<Visual>` pack (capabilities/registry.ts). */
export const VISUALS_CAP = 'visuals'

/** The screen type that makes one (screenThemes.ts). */
export const VISUAL_THEME = 'visual'

/**
 * The other types that may DRAW one inside their pages: a report's process, an
 * article's comparison, a carousel page that explains steps. The kit is forced
 * there too, so the card is in the prompt; the figures check is not (see
 * `pipeline/newScreen.ts`), because those briefs ask for invented sample data.
 */
export const VISUAL_HOST_THEMES: readonly string[] = ['report', 'documentation', 'article', 'instagram', 'linkedin', 'facebook']

/** Whether a screen of this type gets the `<Visual>` kit. */
export function themeDrawsVisuals(theme: string | null | undefined): boolean {
  return theme === VISUAL_THEME || (!!theme && VISUAL_HOST_THEMES.includes(theme))
}

/*
 * The words a person uses to ASK for a diagram. A flyer asked for "a version
 * with diagrams" came back without one: the kit was forced only on the host
 * types, the pack is `forcedOnly`, so the model never heard of `<Visual>` and
 * laid boxes out by hand. "graphique" alone is a style word in French ("un
 * flyer très graphique", "la charte graphique"), so it counts only after a
 * determiner — "des graphiques", "un graphique", "en graphique".
 */
const ASKS_FOR_VISUAL = new RegExp(
  [
    '\\bsch[eé]mas?\\b', '\\bschematic', '\\bdiagram', '\\binfograph', '\\bcharts?\\b', '\\bgraphs?\\b',
    '\\b(?:un|une|des|les?|du|ce|ces|en|deux|trois|quelques|of|a)\\s+graphiques?\\b',
    '\\bfrises?\\b', '\\btimeline', '\\borganigramme', '\\borg chart', '\\bmind ?maps?\\b', '\\bcartes? mentales?\\b',
    '\\bflowchart', '\\blogigramme', '\\bcamembert', '\\bhistogramme', '\\broadmap', '\\bfeuilles? de route\\b',
  ].join('|'),
  'i',
)

/** Whether the request asks, in words, for a diagram. */
export function requestAsksForVisual(text: string | null | undefined): boolean {
  return !!text && ASKS_FOR_VISUAL.test(text)
}

/**
 * Whether a screen gets the kit: always on the visual and host types, and on
 * any OTHER document — a flyer, a poster, a menu, a social post — when the
 * request asks for a diagram. Not on an app or a site screen, which has the
 * charts pack for its dashboards and was never asked to draw paper diagrams.
 */
export function screenDrawsVisuals(theme: string | null | undefined, isDocument: boolean, text: string | null | undefined): boolean {
  return themeDrawsVisuals(theme) || (isDocument && requestAsksForVisual(text))
}

/**
 * The line a document whose brief does not mention diagrams gets when the
 * request asked for one — the host types carry the same sentence in their brief.
 */
export const VISUAL_ASKED_SECTION = `DIAGRAMS: the request asks for one or more diagrams. Draw each with the <Visual> component (a family from its card, the content in its \`doc\`), sized by its own box inside the page's layout — never boxes, arrows, SVG or a chart of your own. At most one <Visual> per page; the rest of the page keeps its own design.`

export const VISUAL_FAMILIES = [
  'steps',
  'cycle',
  'timeline',
  'funnel',
  'pyramid',
  'comparison',
  'pros-cons',
  'matrix',
  'hub',
  'mindmap',
  'flow',
  'stats',
  'bars',
  'donut',
  'checklist',
  'venn',
  'swot',
  'before-after',
  'tree',
  'onion',
  'snake',
  'staircase',
  'converging',
  'diverging',
  'equation',
  'decision-tree',
  'user-journey',
  'fishbone',
  'treemap',
  'layers',
  'concept-map',
  'force-field',
  'quadrant-chart',
  'comparison-table',
  'radar',
  'columns',
  'line',
  'progress',
  'pictogram',
  'card-grid',
  'gantt',
  'roadmap',
  'kanban',
  'zigzag',
  'winding-road',
  'switchback',
] as const

export type VisualFamily = (typeof VISUAL_FAMILIES)[number]

/**
 * How a visual is RENDERED, independently of its family and its variant: flat,
 * lifted, in oblique 3D (top and side faces, cylinders, spheres, a road with
 * pins), frosted glass, gradients. The model picks it from the request and the
 * project's direction; the person switches it in "Visual…" for free.
 */
export const VISUAL_LOOKS = ['flat', 'raised', 'block', 'glass', 'gradient', 'neon'] as const
export type VisualLook = (typeof VISUAL_LOOKS)[number]
export function isVisualLook(v: unknown): v is VisualLook {
  return typeof v === 'string' && (VISUAL_LOOKS as readonly string[]).includes(v)
}

/**
 * Whether a visual moves, on a web page only: `none` (the default, and what
 * every document, post and export draws), `reveal` (an entrance in the order of
 * the content, ending on the still frame) and `flow` (that entrance, then a
 * pulse running along the connectors). The person switches it in "Visual…".
 */
export const VISUAL_MOTIONS = ['none', 'reveal', 'flow'] as const
export type VisualMotion = (typeof VISUAL_MOTIONS)[number]
export function isVisualMotion(v: unknown): v is VisualMotion {
  return typeof v === 'string' && (VISUAL_MOTIONS as readonly string[]).includes(v)
}

/** How the boxes are painted. Three, so a family is not one look. */
export const VISUAL_VARIANTS = ['soft', 'solid', 'outline'] as const
export type VisualVariant = (typeof VISUAL_VARIANTS)[number]

export function isVisualFamily(v: unknown): v is VisualFamily {
  return typeof v === 'string' && (VISUAL_FAMILIES as readonly string[]).includes(v)
}
export function isVisualVariant(v: unknown): v is VisualVariant {
  return typeof v === 'string' && (VISUAL_VARIANTS as readonly string[]).includes(v)
}

/** One idea of the text. */
export interface VisualItem {
  label: string
  detail?: string
  /** A name of the `Icon` namespace (snippets/Icons.ts). */
  icon?: string
  /** A figure TAKEN FROM THE TEXT — `numbers.ts` removes one it cannot find there. */
  value?: number
  unit?: string
  children?: (string | { label: string; detail?: string })[]
  /** The centre of a hub, the item a comparison recommends. One per document. */
  emphasis?: boolean
  /** A position, not a figure: a quadrant chart's x and y, a journey's feeling (y, −2 to 2). */
  x?: number
  y?: number
  /** A Gantt bar's span, in the unit of `axes.x` (week 1 to week 4). */
  start?: number
  end?: number
  /** What `value` is a part of, for a pictogram ("7 out of 10"). */
  total?: number
}

/** The content, the same for every family. */
export interface VisualDoc {
  title?: string
  subtitle?: string
  items: VisualItem[]
  /** Arrows between items, by their index in `items` (a flowchart's paths). */
  relations?: { from: number; to: number; label?: string }[]
  /** A matrix's two axes. */
  axes?: { x?: string; y?: string }
  /** "Source: …" under a chart. */
  source?: string
  /** A comparison table's rows; each option's children are its cells, in this order. */
  criteria?: string[]
  /** A quadrant chart's four zones, top-left, top-right, bottom-left, bottom-right. */
  quadrants?: string[]
}

/**
 * What each family needs to be drawn honestly. `min`/`max` bound the items;
 * the flags are what a family cannot draw without. A family that refuses a
 * document is not offered for it, and the dialog says which bound it is.
 */
export interface FamilyBounds {
  min: number
  max: number
  /** Every item carries a `value` (a chart, a row of key figures). */
  values?: true
  /** Every item carries `children` (the columns of a comparison). */
  children?: true
  /** Exactly `min` items (`pros-cons` is two, `matrix` four). */
  exact?: true
  /** The document gives `relations` (a decision tree, a concept map). */
  relations?: true
  /** Every item carries `x` and `y` (a quadrant chart). */
  positions?: true
  /** Every item carries `y`, a feeling from −2 to 2 (a customer journey). */
  scores?: true
  /** Every item carries `start` and `end` (a Gantt chart). */
  spans?: true
}

export const VISUAL_BOUNDS: Record<VisualFamily, FamilyBounds> = {
  steps: { min: 2, max: 8 },
  cycle: { min: 3, max: 8 },
  timeline: { min: 2, max: 10 },
  funnel: { min: 3, max: 6 },
  pyramid: { min: 3, max: 6 },
  comparison: { min: 2, max: 3, children: true },
  'pros-cons': { min: 2, max: 2, children: true, exact: true },
  matrix: { min: 4, max: 4, exact: true },
  hub: { min: 3, max: 8 },
  mindmap: { min: 2, max: 6 },
  flow: { min: 2, max: 8 },
  stats: { min: 2, max: 6, values: true },
  bars: { min: 2, max: 10, values: true },
  donut: { min: 2, max: 6, values: true },
  checklist: { min: 2, max: 10 },
  venn: { min: 2, max: 4 },
  swot: { min: 4, max: 4, children: true, exact: true },
  'before-after': { min: 2, max: 2, exact: true },
  tree: { min: 2, max: 6 },
  onion: { min: 3, max: 5 },
  snake: { min: 5, max: 12 },
  staircase: { min: 3, max: 6 },
  converging: { min: 3, max: 6 },
  diverging: { min: 3, max: 6 },
  equation: { min: 3, max: 5 },
  'decision-tree': { min: 3, max: 12, relations: true },
  'user-journey': { min: 3, max: 8, scores: true },
  fishbone: { min: 3, max: 7 },
  treemap: { min: 2, max: 12, values: true },
  layers: { min: 3, max: 6 },
  'concept-map': { min: 4, max: 10, relations: true },
  'force-field': { min: 2, max: 2, children: true, exact: true },
  'quadrant-chart': { min: 3, max: 12, positions: true },
  'comparison-table': { min: 2, max: 4, children: true },
  radar: { min: 3, max: 8, values: true },
  columns: { min: 2, max: 12, values: true },
  line: { min: 3, max: 20, values: true },
  progress: { min: 2, max: 6, values: true },
  pictogram: { min: 1, max: 3, values: true },
  'card-grid': { min: 3, max: 9 },
  gantt: { min: 2, max: 10, spans: true },
  roadmap: { min: 3, max: 8 },
  kanban: { min: 2, max: 5, children: true },
  zigzag: { min: 3, max: 8 },
  'winding-road': { min: 3, max: 6 },
  switchback: { min: 3, max: 5 },
}

/** The most items any family draws; the schema refuses more. */
export const VISUAL_MAX_ITEMS = Math.max(...Object.values(VISUAL_BOUNDS).map((b) => b.max))
/** Label and detail lengths the prompt asks for (the layout shrinks type before it gives up). */
export const VISUAL_LABEL_WORDS = 5
export const VISUAL_DETAIL_WORDS = 20

/**
 * When each family is the RIGHT one, in English for the model's card. Three
 * clauses: what the text says, what the family shows, and the common misuse.
 */
export const FAMILY_USE: Record<VisualFamily, string> = {
  steps: 'a linear process done in order (how to, onboarding, method) — not for things that merely sit side by side',
  cycle: 'a process that loops back to its start (a feedback loop, a yearly rhythm) — only if the last step really leads to the first',
  timeline: 'dated events or phases (a history, a roadmap): put the date or period in the label — not for an undated process',
  funnel: 'a stage-by-stage narrowing (a sales funnel, a selection), widest first; values, if the text gives them, must shrink',
  pyramid: 'a hierarchy built from a base (needs, priorities, levels), the TOP item first',
  comparison: 'two or three options compared point by point: each item is an option, its children are its points',
  'pros-cons': 'exactly two columns, advantages then drawbacks: the first item is the pros, the second the cons, the points are children',
  matrix: 'a 2×2 grid (priorities, positioning): exactly four items in reading order (top-left, top-right, bottom-left, bottom-right) and the two axes in `axes`',
  hub: 'one central idea and the parts around it (pillars, components, stakeholders): mark the centre `emphasis`, or it is the title',
  mindmap: 'a topic split into branches with sub-points: the title is the centre, each item a branch, its children the sub-points',
  flow: 'a flowchart with branches or merges: give `relations` between item indexes, with a short label for a decision path',
  stats: 'a few key figures, each item a number with its unit and what it measures — only figures the text states',
  bars: 'quantities to compare (a ranking, a breakdown): every item a value in the same unit',
  donut: 'shares of a whole (a budget, a mix): every item a part, in the same unit',
  checklist: 'things to do or to have (a to-do, criteria, a packing list): each item one check — not for a sequence whose order matters',
  venn: 'two or three sets and what they share: each set an item, and the overlap as ONE more item marked `emphasis` — not for options compared point by point',
  swot: 'strengths, weaknesses, opportunities, threats, in that order: exactly four items, their points as children',
  'before-after': 'a change from one state to another: exactly two items, before then after, with their points as children',
  tree: 'a hierarchy that branches (an org chart, a breakdown): the root marked `emphasis` (or it is the title), each branch an item, its leaves the children',
  onion: 'nested layers from a core outwards (an ecosystem, circles of influence): the FIRST item is the core, the last the outer ring',
  snake: 'a long process (six to twelve steps) laid in rows that turn back, like a board game',
  staircase: 'a progression that climbs (maturity levels, a career, growing stakes), lowest step first',
  converging: 'several causes, inputs or contributions that lead to ONE result: the result is the item marked `emphasis` (or the last)',
  diverging: 'ONE source that leads to several outcomes or uses: the source is the item marked `emphasis` (or the first)',
  equation: 'a few ingredients that add up to a result (A + B + C = D): the result is the last item',
  'decision-tree': 'questions answered yes or no that lead to outcomes: the first item is the first question, `relations` go from a question to its answers with the answer ("Oui", "Non") as label',
  'user-journey': 'a customer or user journey: each stage an item, with `y` how it feels from −2 (bad) to 2 (good) — judged from the text, not a figure',
  fishbone: 'the causes of one problem (an Ishikawa diagram): the problem is the item marked `emphasis` (or the title), each other item a category of causes with the causes as children',
  treemap: 'a whole split into parts of very different sizes (a budget, market shares): every item a value in the same unit',
  layers: 'a stack of layers, the top one first (an architecture, a tech stack, levels of a system): an item per layer, its parts as children',
  'concept-map': 'notions linked by named relations (a course, an ecosystem): `relations` between item indexes, each with a short verb as label',
  'force-field': 'forces for and against a change: exactly two items, the driving forces then the restraining ones, each force a child',
  'quadrant-chart': 'things placed on two axes (impact/effort, price/quality, power/interest): each item with `x` and `y` from 0 to 10, the two axes in `axes`, the four zones in `quadrants` (top-left, top-right, bottom-left, bottom-right)',
  'comparison-table': 'options compared on several criteria in a grid: each item an option, `criteria` the rows, each option\'s children its cells in that order ("Oui", "Non" or a short value)',
  radar: 'a profile scored on several axes (skills, a product on five criteria): every item an axis with a value in the same unit',
  columns: 'quantities over a few periods or categories, as vertical columns: every item a value in the same unit — not for a long series (that is a line)',
  line: 'a trend over time (months, years): every item a period with a value in the same unit, in order',
  progress: 'rates or completion (goals reached, scores): every item a value, a percentage when the unit is "%"',
  pictogram: 'one striking proportion ("7 people out of 10"): an item per proportion, `value` the part and `total` the whole when it is not a percentage',
  'card-grid': 'a set of equal points (benefits, features, services), each an item with an icon — not for a sequence',
  gantt: 'a schedule of tasks with durations: each task with `start` and `end` in one unit (week numbers, months), the unit in `axes.x`',
  roadmap: 'milestones along a road (a product roadmap, a plan for the year): the date or period in the label',
  kanban: 'work by status (to do, doing, done): each item a column, its cards as children',
  zigzag: 'a short list of key points read in turn, alternating left and right of a line',
  'winding-road': 'a journey of milestones drawn as a winding road with pins (a product roadmap, the stages of a project, a career path): the date or period in the label, three to six stops',
  switchback: 'a journey with big ups and downs drawn as a mountain road in wide bends, from the top of the frame to the bottom (a project with its hard and easy stretches, a climb towards a goal): three to five stops, the date or period in the label',
}

export type RefusalReason = 'tooFew' | 'tooMany' | 'exact' | 'values' | 'children' | 'relations' | 'positions' | 'scores' | 'spans'

/** Why a family cannot draw this document, or null when it can. */
export function familyRefusal(family: VisualFamily, doc: VisualDoc | null): { reason: RefusalReason; n: number } | null {
  const b = VISUAL_BOUNDS[family]
  const items = doc?.items ?? []
  const n = items.length
  if (b.exact && n !== b.min) return { reason: 'exact', n: b.min }
  if (n < b.min) return { reason: 'tooFew', n: b.min }
  if (n > b.max) return { reason: 'tooMany', n: b.max }
  if (b.values && !items.every((it) => typeof it.value === 'number' && Number.isFinite(it.value))) return { reason: 'values', n: 0 }
  if (b.children && !items.every((it) => Array.isArray(it.children) && it.children.length > 0)) return { reason: 'children', n: 0 }
  const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
  if (b.relations && !(Array.isArray(doc?.relations) && doc!.relations.length > 0)) return { reason: 'relations', n: 0 }
  if (b.positions && !items.every((it) => isNum(it.x) && isNum(it.y))) return { reason: 'positions', n: 0 }
  if (b.scores && !items.every((it) => isNum(it.y))) return { reason: 'scores', n: 0 }
  if (b.spans && !items.every((it) => isNum(it.start) && isNum(it.end))) return { reason: 'spans', n: 0 }
  return null
}

export function accepts(family: VisualFamily, doc: VisualDoc | null): boolean {
  return familyRefusal(family, doc) === null
}
