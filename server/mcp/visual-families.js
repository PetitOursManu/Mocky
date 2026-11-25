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
}

export const VISUAL_FAMILY_IDS = Object.keys(VISUAL_FAMILY_USES)

/** The sizes a visual is made at — the Visual type's own formats in screenThemes.ts. */
export const VISUAL_FORMATS = ['slides', 'social-landscape', 'social-square', 'social-portrait', 'a4-landscape', 'a4']
