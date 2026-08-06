/**
 * The SEO and accessibility questions a pattern cannot settle.
 *
 * The browser-side rules in `src/lib/audit/` answer everything structural: does
 * this `<img>` have an `alt`, is there one `<h1>`, can a keyboard reach that
 * clickable `<div>`. What they cannot answer is whether any of it is any GOOD —
 * whether the alt describes the picture, whether the heading describes the
 * section beneath it, whether link text still means something read aloud out of
 * context by a screen reader that has stripped the page away.
 *
 * Those are the questions here, and they are the only reason to spend a model
 * call on this at all. Anything a regex can decide is deliberately absent: it
 * has already been decided, for free, before this route is reached.
 *
 * Phrased so that `true` means CLEAN, exactly like `catalog.js`. A question
 * whose natural answer is "yes there is a problem" inverts under fatigue, and a
 * catalogue where half the ids read one way and half the other is a catalogue
 * whose verdicts get flipped by whoever adds the next one.
 */

/**
 * @typedef {object} AuditQuestion
 * @property {string} id
 * @property {string} name       short label, shown in the panel
 * @property {string} question   phrased so `true` = clean
 * @property {'seo'|'a11y'} dimension
 * @property {'error'|'warning'|'advisory'} severity
 * @property {string} family     which `AuditFamily` in src/lib/audit/rules.ts it belongs to
 */

/*
 * WHY A QUESTION DECLARES A FAMILY
 *
 * The panel groups its report by what a finding is ABOUT — headings, images,
 * colour — and the browser-side catalogue says so on each rule. A judged
 * finding's id exists only here, so nothing on that side can place it, and the
 * breakdown would show "headings: 100" directly under a model finding saying
 * the headings describe nothing. The question knows what it is about; it is the
 * only place that does.
 *
 * The names have to match `RULE_FAMILIES`, and a test in `audit-judge.test.js`
 * imports that list and checks it. A name the browser cannot place is dropped
 * there rather than filed under an invented heading.
 */

/** @type {AuditQuestion[]} */
export const AUDIT_QUESTIONS = [
  {
    id: 'alt-describes-image',
    name: 'Alt text describes the picture',
    question:
      'Does every non-empty alt text describe what its image actually SHOWS, rather than repeating nearby text, naming a file, or stating that it is an image? Answer true if there are no images, or if every alt is deliberately empty on a decorative image.',
    dimension: 'a11y',
    severity: 'warning',
    family: 'images',
  },
  {
    id: 'heading-describes-section',
    name: 'Headings describe their sections',
    question:
      'Does each heading actually describe the content beneath it, rather than being a slogan, a single generic word ("Features", "Section"), or filler? Answer true if there are no headings.',
    dimension: 'seo',
    severity: 'warning',
    family: 'headings',
  },
  {
    id: 'link-text-standalone',
    name: 'Link text works out of context',
    question:
      'Would every link\'s text identify its destination if it were read aloud on its own, with the surrounding sentence removed? Answer true if there are no links.',
    dimension: 'a11y',
    severity: 'warning',
    family: 'links',
  },
  {
    id: 'h1-matches-page',
    name: 'The h1 states what the page is',
    question:
      'Does the top-level heading state what this page IS, in words someone would search for — rather than a greeting, a brand tagline, or a call to action? Answer true if there is no h1.',
    dimension: 'seo',
    severity: 'warning',
    family: 'headings',
  },
  {
    id: 'content-not-in-images',
    name: 'Real text, not text baked into pictures',
    question:
      'Is the screen\'s substantive text present as real text, rather than implied to live inside images or icon fonts? Answer true if the text content is genuinely in the markup.',
    dimension: 'seo',
    severity: 'warning',
    family: 'images',
  },
  {
    id: 'status-not-colour-only',
    name: 'Meaning is not carried by colour alone',
    question:
      'Is every status, error or state distinguishable by something other than colour — an icon, a label, a word? Answer true if the screen conveys no status at all.',
    dimension: 'a11y',
    severity: 'warning',
    family: 'color',
  },
  {
    id: 'reading-order-matches',
    name: 'Source order matches reading order',
    question:
      'Does the order of the markup match the order a person would read the screen, without relying on CSS ordering to rearrange it? Answer true when the source reads top to bottom the way the design does.',
    dimension: 'a11y',
    severity: 'warning',
    family: 'landmarks',
  },
  {
    id: 'form-errors-described',
    name: 'Form errors are described in text',
    question:
      'Are validation states and required fields communicated in text a screen reader would reach, rather than only by styling? Answer true if there is no form.',
    dimension: 'a11y',
    severity: 'warning',
    family: 'forms',
  },
]

export const AUDIT_MAP = Object.fromEntries(AUDIT_QUESTIONS.map((q) => [q.id, q]))
