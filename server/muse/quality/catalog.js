/**
 * The rules no deterministic engine can settle.
 *
 * Two sources, one list:
 *
 *   1. Impeccable publishes 64 anti-patterns and ships detectors for 59 of
 *      them. The remaining five are documented as needing human or model
 *      judgement — they describe a composition, not a token, and no regex or
 *      cascade walk decides them. Those five are restated here in our own
 *      words, as questions a judge can answer about one screen.
 *
 *   2. Mocky's own `anti-slop.json` lists 18 clichés. Until now every one of
 *      them was prompt-side only: the strings are pasted into the dossier
 *      prompt and hoped for. Most are structural ("three identical feature
 *      cards", "centered hero with nothing distinctive") and are exactly the
 *      kind of thing a judge can see and a regex cannot. They get stable ids
 *      here so the prompt side and the checking side can finally refer to the
 *      same rule by name.
 *
 * This file deliberately contains no code from Impeccable's agentic layer — no
 * skill, no slash-command, no prompt of theirs. The catalogue of anti-patterns
 * is public documentation; the questions below are ours, written for Mocky's
 * pipeline and answerable in one pass over one screen.
 *
 * Each entry is phrased so that `true` means CLEAN. A judge that fails to
 * answer leaves the rule unjudged rather than failing the screen — see
 * critique.js.
 */

/**
 * @typedef {object} JudgedRule
 * @property {string} id        Stable id, referenced by findings and the audit.
 * @property {string} name      Short human label.
 * @property {string} question  What the judge is asked. Phrased so YES = clean.
 * @property {'slop'|'quality'} category
 * @property {'composition'|'copy'|'imagery'|'craft'} dimension
 */

/** The five Impeccable anti-patterns with no deterministic detector. */
export const IMPECCABLE_JUDGED = [
  {
    id: 'glassmorphism-everywhere',
    name: 'Glassmorphism as decoration',
    question:
      'Is blur/glass/translucency either absent, or used to express real layering (something genuinely sits above something else) rather than sprinkled on as decoration?',
    category: 'slop',
    dimension: 'craft',
  },
  {
    id: 'extreme-card-radius',
    name: 'Extreme border-radius on cards',
    question:
      'Are card corners proportionate to the card size, rather than very large radii (roughly 24px and above) applied to small cards?',
    category: 'slop',
    dimension: 'craft',
  },
  {
    id: 'amateur-svg-illustration',
    name: 'Hand-coded amateur illustration',
    question:
      'Is the screen free of hand-coded SVG scenes, mascots or spot illustrations assembled from basic shapes (circles, blobs, stick figures)?',
    category: 'slop',
    dimension: 'imagery',
  },
  {
    id: 'hero-metric-layout',
    name: 'Hero metric layout',
    question:
      'Does the screen avoid the stock "one huge number, a small label, and exactly three supporting stats" hero arrangement?',
    category: 'slop',
    dimension: 'composition',
  },
  {
    id: 'identical-card-grid',
    name: 'Identical card grid',
    question:
      'Does the screen avoid repeating an identical icon + heading + one-sentence card enough times that the grid carries no hierarchy or emphasis?',
    category: 'slop',
    dimension: 'composition',
  },
]

/**
 * Mocky's own clichés, given ids. The `text` of each mirrors an entry in
 * `server/muse/anti-slop.json`, which remains the prompt-side source of truth;
 * these are the ones worth CHECKING for afterwards, i.e. the structural and
 * compositional ones a judge can actually see in a rendered screen.
 *
 * Deliberately omitted from this list, because another mechanism already owns
 * them: the placeholder-text clichés (covered deterministically by
 * `src/lib/lint.ts`), and the imagery clichés about 3D mascots, stock photos
 * and glossy blobs (covered by the mandatory `negative` prompt on every image
 * slot, `server/muse/inspire/dossier.js`).
 */
export const MOCKY_JUDGED = [
  {
    id: 'generic-saas-hero',
    name: 'Generic SaaS hero',
    question:
      'Does the hero avoid the stock "Get Started / Sign up free" headline-plus-two-buttons arrangement with no idea of its own?',
    category: 'slop',
    dimension: 'composition',
  },
  {
    id: 'centered-everything',
    name: 'Centered hero with nothing distinctive',
    question:
      'Does the composition do something other than centre a heading, a subheading and two buttons on an empty background?',
    category: 'slop',
    dimension: 'composition',
  },
  {
    id: 'three-feature-cards',
    name: 'Three identical feature cards',
    question:
      'Does the screen avoid a row of three interchangeable feature cards, each a generic icon plus a title plus one sentence?',
    category: 'slop',
    dimension: 'composition',
  },
  {
    id: 'stat-card-dashboard',
    name: 'Point-of-view-free dashboard',
    question:
      'If this is a dashboard, does it say something specific — rather than three stat cards and a single line chart with no point of view?',
    category: 'slop',
    dimension: 'composition',
  },
  {
    id: 'fake-logo-strip',
    name: 'Fake "Trusted by" strip',
    question:
      'Is the screen free of a "Trusted by" logo strip made of grey placeholder rectangles?',
    category: 'slop',
    dimension: 'composition',
  },
  {
    id: 'shadow-on-everything',
    name: 'Drop shadows everywhere',
    question:
      'Is elevation used selectively to signal hierarchy, rather than a drop shadow on nearly every surface?',
    category: 'slop',
    dimension: 'craft',
  },
  {
    id: 'pill-buttons-no-hierarchy',
    name: 'Pill buttons with no hierarchy',
    question:
      'Do buttons express a primary/secondary hierarchy, rather than every button being an identical rounded pill?',
    category: 'slop',
    dimension: 'craft',
  },
  {
    id: 'emoji-as-icons',
    name: 'Emoji standing in for icons',
    question:
      'Are UI affordances (nav items, actions, list markers) drawn with real icons rather than emoji standing in for them?',
    category: 'slop',
    dimension: 'craft',
  },
  {
    id: 'meaningless-tagline',
    name: 'Meaningless tagline',
    question:
      'Does the copy say something concrete about this product, rather than "Empower your workflow" style filler that would fit any product?',
    category: 'slop',
    dimension: 'copy',
  },
  {
    id: 'placeholder-identities',
    name: 'Placeholder names and addresses',
    question:
      'Are the names, companies and addresses plausible for this product, rather than John Doe / Acme Inc / example@email.com used without context?',
    category: 'slop',
    dimension: 'copy',
  },
  {
    id: 'default-shadcn-look',
    name: 'Untouched default component look',
    question:
      'Does the screen carry a deliberate palette, rather than the untouched default zinc/slate component look with no brand of its own?',
    category: 'slop',
    dimension: 'craft',
  },
]

/** Everything a critique pass judges, in the order it is asked. */
export const JUDGED_RULES = [...IMPECCABLE_JUDGED, ...MOCKY_JUDGED]

/** Lookup by id. */
export const JUDGED_MAP = Object.fromEntries(JUDGED_RULES.map((r) => [r.id, r]))
