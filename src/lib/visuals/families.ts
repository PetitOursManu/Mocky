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
] as const

export type VisualFamily = (typeof VISUAL_FAMILIES)[number]

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
}

export type RefusalReason = 'tooFew' | 'tooMany' | 'exact' | 'values' | 'children'

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
  return null
}

export function accepts(family: VisualFamily, doc: VisualDoc | null): boolean {
  return familyRefusal(family, doc) === null
}
