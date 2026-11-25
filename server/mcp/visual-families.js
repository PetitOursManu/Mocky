/**
 * The families of `<Visual>` — src/lib/visuals/families.ts — for the assistant
 * choosing one. A MIRROR, like screen-types.js and for its reason (the server
 * cannot import TypeScript at the 22.12 floor); `visual-families.test.js` holds
 * every value equal to the TypeScript one, so the two cannot drift.
 */
export const VISUAL_FAMILY_USES = {
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

export const VISUAL_FAMILY_IDS = Object.keys(VISUAL_FAMILY_USES)

/** The sizes a visual is made at — the Visual type's own formats in screenThemes.ts. */
export const VISUAL_FORMATS = ['slides', 'social-landscape', 'social-square', 'social-portrait', 'a4-landscape', 'a4']
