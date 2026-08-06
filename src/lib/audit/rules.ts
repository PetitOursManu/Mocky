/**
 * The SEO and accessibility rules, and what a screen scores against them.
 *
 * WHY THESE RULES AND NOT WCAG
 *
 * A Mocky screen is one self-contained React component. It has no `<head>`, no
 * URL, no routing, and the generation prompt forbids it from having any — so
 * canonical tags, Open Graph, sitemaps and hreflang have nothing to attach to,
 * and a report that graded them would be grading a document that does not
 * exist. What IS here is markup, and the half of both disciplines that lives in
 * markup is the same half: a heading order a crawler can follow is the heading
 * order a screen reader announces, and an `alt` is read by both.
 *
 * So the catalogue is deliberately the intersection of "measurable on this
 * component" and "actually matters", and each rule says which discipline it
 * counts for — several count for both, because they genuinely do.
 *
 * WHY NOT A CONFORMANCE CLAIM
 *
 * Nothing here says "WCAG 2.2 AA". Half of that standard is about rendered
 * output — contrast, focus visibility, reflow, target size — and this analysis
 * never renders anything (Q4). Claiming a conformance level from source alone
 * would be the exact dishonesty the confidence model exists to prevent.
 *
 * WHY SOME RULES ONLY ADVISE
 *
 * Same reasoning as the quality pass's policy.js (Q2): a rule that fights the
 * generation prompt loses, and takes the user's screen with it. A decorative
 * image is SUPPOSED to have an empty alt, a landing page legitimately has one
 * `<main>` and no `<nav>`, and a screen with no form has nothing to label. Those
 * are advisory: reported, never spent a correction pass on.
 */

import type { QualityFinding } from '../quality'
import { classTokens, contrastRatio, declaredColors, utilityBase } from './colors'
import { attr, attrText, hasAttr, type ElementFact, type ScreenFacts } from './inspect'

/** Which discipline a finding counts against. Several count for both. */
export type AuditDimension = 'seo' | 'a11y'

/**
 * What a rule is *about*, as opposed to which discipline it counts for.
 *
 * `dimensions` answers "does this move the SEO number or the accessibility
 * one", which is a scoring question. This answers "where do I go to fix it",
 * which is the reader's question — and the two genuinely do not line up: an
 * unnamed control and a missing `alt` are both accessibility errors and have
 * nothing to do with each other, while `img-alt` and `img-alt-redundant` are
 * one afternoon's work in one file. A flat list of twenty-seven findings reads
 * as twenty-seven separate emergencies.
 *
 * `links` covers controls generally, not only anchors: a button with no name
 * and a div with an onClick are the same problem wearing different tags.
 */
export type AuditFamily =
  | 'headings'
  | 'images'
  | 'links'
  | 'forms'
  | 'color'
  | 'typography'
  | 'targets'
  | 'landmarks'

/**
 * How much of a family's verdict is a fact rather than a deduction (Q4).
 *
 * Declared on the family rather than computed, because it is a property of the
 * METHOD and not of the run: whether an `<img>` carries an `alt` is readable in
 * the source and always will be, and a tap target worked out from `py-2` is a
 * deduction however many of them a screen has. What a run decides is whether
 * the method got to say anything at all — that is `FamilyState`, and keeping
 * the two apart is what lets a family be honest twice over: "this is only ever
 * a deduction" and "and this time it could not even be made".
 */
export type FamilyConfidence = 'high' | 'medium' | 'low'

/**
 * The families in the order the panel shows them, with the key of their label.
 *
 * Fixed, and deliberately not derived from the report. A list ordered by score
 * or by how many findings each family has reshuffles itself on every re-run,
 * so the row someone was reading moves under their cursor between two clicks
 * of "Evaluate". The order below is roughly "what shuts someone out first" —
 * an unreachable control before a cramped paragraph — but the property that
 * matters is that it never changes.
 *
 * The `confidence` column is the honest half. Five of these read markup and say
 * `high`: an `alt`, a heading level, a `for`/`id` pair and a `<main>` are either
 * in the source or they are not. `color` says `medium` because it can only
 * compare the elements that paint both of their own colours, and every other
 * element on the screen escapes it. `typography` and `targets` say `low`
 * because `py-2` plus a line box is a statement about a box nobody rendered.
 */
export const RULE_FAMILIES: readonly {
  id: AuditFamily
  labelKey: string
  confidence: FamilyConfidence
  /** i18n key for what that confidence rests on. The panel prints it, not a tooltip. */
  confidenceKey: string
}[] = [
  { id: 'headings', labelKey: 'audit.family.headings', confidence: 'high', confidenceKey: 'audit.family.why.markup' },
  { id: 'images', labelKey: 'audit.family.images', confidence: 'high', confidenceKey: 'audit.family.why.markup' },
  { id: 'links', labelKey: 'audit.family.links', confidence: 'high', confidenceKey: 'audit.family.why.markup' },
  { id: 'forms', labelKey: 'audit.family.forms', confidence: 'high', confidenceKey: 'audit.family.why.markup' },
  { id: 'color', labelKey: 'audit.family.color', confidence: 'medium', confidenceKey: 'audit.family.why.colorPairs' },
  {
    id: 'typography',
    labelKey: 'audit.family.typography',
    confidence: 'low',
    confidenceKey: 'audit.family.why.deduced',
  },
  { id: 'targets', labelKey: 'audit.family.targets', confidence: 'low', confidenceKey: 'audit.family.why.deduced' },
  { id: 'landmarks', labelKey: 'audit.family.landmarks', confidence: 'high', confidenceKey: 'audit.family.why.markup' },
]

export interface AuditRule {
  id: string
  dimensions: AuditDimension[]
  /** Where the reader goes to fix it. See `AuditFamily`. */
  family: AuditFamily
  severity: 'error' | 'warning' | 'advisory'
  /** Advisory rules are reported but never force a correction pass (Q2). */
  disposition: 'enforce' | 'advise'
  /** i18n key for the short name, and for the "why it matters" line. */
  nameKey: string
  descKey: string
}

/**
 * Weight of one failure, by severity.
 *
 * A screen loses points per DISTINCT rule, not per element: twenty images with
 * no alt is one thing to fix, and scoring it twenty times would drown every
 * other finding and make the number meaningless.
 */
const WEIGHT = { error: 25, warning: 12, advisory: 4 } as const

export const RULES: Record<string, AuditRule> = {
  'img-alt': {
    id: 'img-alt',
    dimensions: ['a11y', 'seo'],
    family: 'images',
    severity: 'error',
    disposition: 'enforce',
    nameKey: 'audit.rule.imgAlt',
    descKey: 'audit.rule.imgAltDesc',
  },
  'img-alt-redundant': {
    id: 'img-alt-redundant',
    dimensions: ['a11y', 'seo'],
    family: 'images',
    severity: 'warning',
    disposition: 'enforce',
    nameKey: 'audit.rule.imgAltRedundant',
    descKey: 'audit.rule.imgAltRedundantDesc',
  },
  'img-meaningful-empty-alt': {
    id: 'img-meaningful-empty-alt',
    dimensions: ['a11y', 'seo'],
    family: 'images',
    severity: 'warning',
    // Advise, not enforce, and the reason is a genuine disagreement rather
    // than caution: the HTML spec allows omitting the alternative when a
    // <figcaption> already supplies it, so an author who wrote alt="" under a
    // caption may well have read the same paragraph we did. A rule that argues
    // with the specification must not be able to spend the user's tokens.
    disposition: 'advise',
    nameKey: 'audit.rule.imgMeaningfulEmptyAlt',
    descKey: 'audit.rule.imgMeaningfulEmptyAltDesc',
  },
  'img-no-dimensions': {
    id: 'img-no-dimensions',
    // SEO alone: layout shift is a Core Web Vital and a ranking signal. It is
    // unpleasant for everyone, but nothing in WCAG makes it an accessibility
    // failure, and inventing one to make the number move would be dishonest.
    dimensions: ['seo'],
    family: 'images',
    severity: 'advisory',
    // `w-full rounded-xl` with no intrinsic size is the idiom the generation
    // prompt's "style everything with Tailwind utility classes" produces, so
    // this fires on almost every generated image. Enforcing it would hand the
    // correction loop a rewrite of every screen (Q2).
    disposition: 'advise',
    nameKey: 'audit.rule.imgNoDimensions',
    descKey: 'audit.rule.imgNoDimensionsDesc',
  },
  'heading-missing-h1': {
    id: 'heading-missing-h1',
    dimensions: ['seo', 'a11y'],
    family: 'headings',
    severity: 'error',
    disposition: 'enforce',
    nameKey: 'audit.rule.missingH1',
    descKey: 'audit.rule.missingH1Desc',
  },
  'heading-multiple-h1': {
    id: 'heading-multiple-h1',
    dimensions: ['seo'],
    family: 'headings',
    severity: 'warning',
    disposition: 'enforce',
    nameKey: 'audit.rule.multipleH1',
    descKey: 'audit.rule.multipleH1Desc',
  },
  'heading-skipped-level': {
    id: 'heading-skipped-level',
    dimensions: ['a11y', 'seo'],
    family: 'headings',
    severity: 'warning',
    disposition: 'enforce',
    nameKey: 'audit.rule.skippedHeading',
    descKey: 'audit.rule.skippedHeadingDesc',
  },
  'heading-empty': {
    id: 'heading-empty',
    dimensions: ['a11y', 'seo'],
    family: 'headings',
    severity: 'warning',
    disposition: 'enforce',
    nameKey: 'audit.rule.emptyHeading',
    descKey: 'audit.rule.emptyHeadingDesc',
  },
  'control-no-name': {
    id: 'control-no-name',
    dimensions: ['a11y'],
    family: 'links',
    severity: 'error',
    disposition: 'enforce',
    nameKey: 'audit.rule.controlNoName',
    descKey: 'audit.rule.controlNoNameDesc',
  },
  'link-text-generic': {
    id: 'link-text-generic',
    dimensions: ['seo', 'a11y'],
    family: 'links',
    severity: 'warning',
    disposition: 'enforce',
    nameKey: 'audit.rule.genericLink',
    descKey: 'audit.rule.genericLinkDesc',
  },
  'input-no-label': {
    id: 'input-no-label',
    dimensions: ['a11y'],
    family: 'forms',
    severity: 'error',
    disposition: 'enforce',
    nameKey: 'audit.rule.inputNoLabel',
    descKey: 'audit.rule.inputNoLabelDesc',
  },
  'clickable-non-interactive': {
    id: 'clickable-non-interactive',
    dimensions: ['a11y'],
    family: 'links',
    severity: 'error',
    disposition: 'enforce',
    nameKey: 'audit.rule.clickableDiv',
    descKey: 'audit.rule.clickableDivDesc',
  },
  'positive-tabindex': {
    id: 'positive-tabindex',
    dimensions: ['a11y'],
    family: 'links',
    severity: 'warning',
    disposition: 'enforce',
    nameKey: 'audit.rule.positiveTabindex',
    descKey: 'audit.rule.positiveTabindexDesc',
  },
  'aria-hidden-interactive': {
    id: 'aria-hidden-interactive',
    dimensions: ['a11y'],
    family: 'links',
    severity: 'error',
    disposition: 'enforce',
    nameKey: 'audit.rule.ariaHiddenInteractive',
    descKey: 'audit.rule.ariaHiddenInteractiveDesc',
  },
  'duplicate-id': {
    id: 'duplicate-id',
    dimensions: ['a11y'],
    // Filed under forms because that is where it bites: the description says
    // so, and the pair it breaks is label/field.
    family: 'forms',
    severity: 'warning',
    disposition: 'enforce',
    nameKey: 'audit.rule.duplicateId',
    descKey: 'audit.rule.duplicateIdDesc',
  },
  'list-structure': {
    id: 'list-structure',
    dimensions: ['a11y', 'seo'],
    family: 'landmarks',
    severity: 'warning',
    disposition: 'enforce',
    nameKey: 'audit.rule.listStructure',
    descKey: 'audit.rule.listStructureDesc',
  },
  'no-landmarks': {
    id: 'no-landmarks',
    dimensions: ['seo', 'a11y'],
    family: 'landmarks',
    severity: 'warning',
    // Advisory: a single hero panel is legitimately one <section> and nothing
    // else, and forcing a <main> into it would be markup for the report's sake.
    disposition: 'advise',
    nameKey: 'audit.rule.noLandmarks',
    descKey: 'audit.rule.noLandmarksDesc',
  },
  'div-soup-nav': {
    id: 'div-soup-nav',
    dimensions: ['seo', 'a11y'],
    family: 'landmarks',
    severity: 'advisory',
    disposition: 'advise',
    nameKey: 'audit.rule.divNav',
    descKey: 'audit.rule.divNavDesc',
  },
  'table-no-header': {
    id: 'table-no-header',
    dimensions: ['a11y'],
    family: 'landmarks',
    severity: 'warning',
    disposition: 'enforce',
    nameKey: 'audit.rule.tableNoHeader',
    descKey: 'audit.rule.tableNoHeaderDesc',
  },
  'autofocus': {
    id: 'autofocus',
    dimensions: ['a11y'],
    family: 'forms',
    severity: 'advisory',
    disposition: 'advise',
    nameKey: 'audit.rule.autofocus',
    descKey: 'audit.rule.autofocusDesc',
  },
  'low-contrast': {
    id: 'low-contrast',
    dimensions: ['a11y'],
    family: 'color',
    severity: 'error',
    // The one new rule that enforces, and the only one that can: legibility is
    // not a matter of taste, and this fires ONLY when both colours are painted
    // by classes on the same element (see `declaredColors`), so there is
    // nothing left to be uncertain about. Everything an art direction might
    // legitimately want — a gradient, an opacity, a colour from a parent —
    // lands in `resolvable: false` and is never reported at all.
    disposition: 'enforce',
    nameKey: 'audit.rule.lowContrast',
    descKey: 'audit.rule.lowContrastDesc',
  },
  'text-too-small': {
    id: 'text-too-small',
    dimensions: ['a11y'],
    family: 'typography',
    severity: 'warning',
    // Below Tailwind's own smallest step takes an arbitrary value, so it is
    // always deliberate — and a supplied art direction is exactly the thing
    // allowed to ask for 10px eyebrow labels (generate.ts:50). Q2: report it,
    // never spend a pass undoing a decision the user made.
    disposition: 'advise',
    nameKey: 'audit.rule.textTooSmall',
    descKey: 'audit.rule.textTooSmallDesc',
  },
  'leading-cramped': {
    id: 'leading-cramped',
    dimensions: ['a11y'],
    family: 'typography',
    severity: 'advisory',
    // WCAG 1.4.12 asks that content survive a reader setting 1.5 line-height,
    // not that the author ship it. Enforcing would be reading the criterion
    // backwards, on a property an editorial direction owns.
    disposition: 'advise',
    nameKey: 'audit.rule.leadingCramped',
    descKey: 'audit.rule.leadingCrampedDesc',
  },
  'uppercase-body': {
    id: 'uppercase-body',
    dimensions: ['a11y'],
    family: 'typography',
    severity: 'advisory',
    disposition: 'advise',
    nameKey: 'audit.rule.uppercaseBody',
    descKey: 'audit.rule.uppercaseBodyDesc',
  },
  'text-justify': {
    id: 'text-justify',
    dimensions: ['a11y'],
    family: 'typography',
    severity: 'advisory',
    disposition: 'advise',
    nameKey: 'audit.rule.textJustify',
    descKey: 'audit.rule.textJustifyDesc',
  },
  'tap-target-small': {
    id: 'tap-target-small',
    dimensions: ['a11y'],
    family: 'targets',
    severity: 'advisory',
    // A deduction from class names, not a measurement — see `deducedHeight`.
    // It also uses the 44px platform guideline rather than WCAG 2.2's 24px
    // floor, so it fires on the perfectly ordinary `px-4 py-2` button. Both
    // reasons point the same way: this may advise and must never correct.
    disposition: 'advise',
    nameKey: 'audit.rule.tapTargetSmall',
    descKey: 'audit.rule.tapTargetSmallDesc',
  },
  'targets-adjacent': {
    id: 'targets-adjacent',
    dimensions: ['a11y'],
    family: 'targets',
    severity: 'advisory',
    disposition: 'advise',
    nameKey: 'audit.rule.targetsAdjacent',
    descKey: 'audit.rule.targetsAdjacentDesc',
  },
}

/** One failing element, so the panel can point at a line. */
export interface RuleHit {
  rule: string
  line: number
  /** A short excerpt naming the offender, e.g. `<img class="hero">`. */
  snippet: string
}

const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
const INTERACTIVE = ['a', 'button', 'input', 'select', 'textarea', 'summary']
const LANDMARKS = ['main', 'nav', 'header', 'footer', 'aside', 'article', 'section']
const FIELDS = ['input', 'select', 'textarea']

/**
 * Link and button text that names no destination.
 *
 * Both disciplines care, for the same reason: a screen reader offers a list of
 * links out of context, and a crawler reads the text as the destination's
 * subject. "Read more" tells neither of them anything.
 */
const GENERIC_LINK_TEXT = [
  'click here',
  'here',
  'read more',
  'learn more',
  'more',
  'see more',
  'this link',
  'link',
  'cliquez ici',
  'ici',
  'en savoir plus',
  'lire la suite',
  'voir plus',
  'plus',
  'ce lien',
]

/** Alt text that repeats what the element already is. */
const REDUNDANT_ALT = ['image', 'photo', 'picture', 'img', 'graphic', 'illustration', 'photo de', 'image de']

const snippetOf = (el: ElementFact): string => {
  const cls = attrText(el, 'class')
  return cls ? `<${el.tag} class="${cls.slice(0, 40)}">` : `<${el.tag}>`
}

/** True when this element has a name a screen reader could announce. */
function hasAccessibleName(el: ElementFact): boolean {
  if (el.text.length > 0) return true
  // `<button>{label}</button>` is named; this analysis simply cannot read the
  // name. Reporting it would fail every control whose text comes from data,
  // which in a generated screen is most of them.
  if (el.hasDynamicText) return true
  // Present-but-unknowable counts as named: `aria-label={t('close')}` is good
  // code, and failing it would punish exactly the screens that got it right.
  if (hasAttr(el, 'aria-label') || hasAttr(el, 'aria-labelledby') || hasAttr(el, 'title')) return true
  // An <input type="submit" value="Send"> carries its name in `value`.
  if (el.tag === 'input' && hasAttr(el, 'value')) return true
  return false
}

// ---------------------------------------------------------------------------
// Geometry and typography, as far as a class name admits it
// ---------------------------------------------------------------------------

/**
 * WHY THIS SECTION IS ALLOWED TO EXIST AT ALL, GIVEN Q4
 *
 * Q4's rule is that the report declares what it did not look at, and nothing
 * here renders a page — so nothing here MEASURES anything. What it does is read
 * the numbers the author wrote down: `py-2` is eight pixels of padding because
 * Tailwind says so, not because we watched it paint. That is a deduction, and
 * every rule built on it says so in its own description and only ever advises.
 *
 * The line is the same one `colors.ts` draws: when the classes stop being
 * enough — an arbitrary unit, a computed class list, a child of unknown height —
 * the answer is "cannot say", never a plausible number.
 */

/** Tailwind's root font size, which is the browser's and which nothing here changes. */
const BASE_FONT_PX = 16
/** Preflight sets `line-height: 1.5` on `html`, so unsized text sits in a 24px box. */
const BASE_LINE_PX = 24

/** `font-size` for each step of the default scale, in px. */
const TEXT_SIZE_PX: Record<string, number> = {
  xs: 12, sm: 14, base: 16, lg: 18, xl: 20,
  '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48,
  '6xl': 60, '7xl': 72, '8xl': 96, '9xl': 128,
}

/** The `line-height` each step ships with. Above 4xl Tailwind uses a ratio of 1. */
const TEXT_LINE_PX: Record<string, number> = {
  xs: 16, sm: 20, base: 24, lg: 28, xl: 28,
  '2xl': 32, '3xl': 36, '4xl': 40, '5xl': 48,
  '6xl': 60, '7xl': 72, '8xl': 96, '9xl': 128,
}

const LEADING_RATIO: Record<string, number> = {
  none: 1, tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2,
}

/**
 * `Number`, with the coercions that would invent a measurement removed.
 *
 * `Number('')` is 0 and `Number('0x10')` is 16, so `h-` and `p-0xff` would both
 * come back as a confident pixel count. This is the same guard `colors.ts`
 * puts on colour channels, for the same reason: a wrong number here becomes a
 * finding about a control that is not on the screen.
 */
function numeric(text: string): number {
  if (!text) return NaN
  for (const c of text) if (!'0123456789.'.includes(c)) return NaN
  return Number(text)
}

/**
 * A CSS length in px. NaN for anything relative to something unseen.
 *
 * `em` and `%` are deliberately absent: they resolve against an ancestor's
 * font size or an ancestor's box, and this analysis has tag names for
 * ancestors and nothing else.
 */
function lengthPx(css: string): number {
  const v = css.trim().toLowerCase()
  if (v.endsWith('px')) return numeric(v.slice(0, -2))
  if (v.endsWith('rem')) return numeric(v.slice(0, -3)) * BASE_FONT_PX
  if (v.endsWith('pt')) return (numeric(v.slice(0, -2)) * 4) / 3
  return NaN
}

/** Tailwind's spacing scale: `p-4` is 4 × 0.25rem. `px` is the one exception. */
function spacingPx(value: string): number {
  if (value === 'px') return 1
  return numeric(value) * 4
}

/** The inside of an arbitrary value, with Tailwind's underscore-for-space undone. */
function bracketed(value: string): string | null {
  if (!value.startsWith('[') || !value.endsWith(']')) return null
  return value.slice(1, -1).split('_').join(' ')
}

/** The classes on this element, or null when the attribute cannot be read. */
function classesOf(el: ElementFact): string[] | null {
  const cls = attr(el, 'class')
  // `className={cn('p-4', big && 'py-6')}` is present and unknowable. Judging
  // the half we can see is how a correct control gets reported.
  if (!cls || cls.kind !== 'string') return null
  return classTokens(cls.value)
}

/** Only the utilities that apply with no variant in front of them. */
const restingBases = (tokens: string[]) =>
  tokens.map(utilityBase).filter((u) => !u.underVariant).map((u) => u.base)

/** Every utility, whichever state it belongs to. */
const anyStateBases = (tokens: string[]) => tokens.map((t) => utilityBase(t).base)

/** The font size a `text-*` utility sets, or NaN when it sets something else. */
function textSizeOf(base: string): number {
  if (!base.startsWith('text-')) return NaN
  const value = base.slice('text-'.length)
  const named = TEXT_SIZE_PX[value]
  // `typeof`, not truthiness: `text-constructor` reaches Object.prototype.
  if (typeof named === 'number') return named
  const inner = bracketed(value)
  // `text-[#0f172a]` and `text-[13px]` share every character of their shape,
  // and only one of them is a size. `lengthPx` is what tells them apart.
  return inner === null ? NaN : lengthPx(inner)
}

interface TypeBox {
  fontPx: number
  linePx: number
  /** 700 and up. `font-semibold` is 600 and does not count — WCAG says bold. */
  bold: boolean
  /** True when a `leading-*` was declared here rather than inherited. */
  leadingDeclared: boolean
}

/**
 * The type box an element's own classes describe.
 *
 * Falls back to the root's 16px/24px rather than to "unknown", and that is
 * defensible for exactly one reason: Tailwind's preflight resets headings to
 * `font-size: inherit`, so an `<h1>` carrying no `text-*` class really is body
 * size. Generated screens put the size on the element, not on a wrapper.
 */
function typeBoxOf(bases: string[]): TypeBox {
  let fontPx = BASE_FONT_PX
  let linePx = BASE_LINE_PX
  let bold = false
  for (const base of bases) {
    if (base === 'font-bold' || base === 'font-extrabold' || base === 'font-black') bold = true
    const size = textSizeOf(base)
    if (!Number.isFinite(size)) continue
    fontPx = size
    const named = TEXT_LINE_PX[base.slice('text-'.length)]
    // An arbitrary size sets font-size alone; the unitless 1.5 from preflight
    // is still inherited and recomputes against it.
    linePx = typeof named === 'number' ? named : size * 1.5
  }
  // Second pass: `leading-*` wins over the step's own line-height whatever
  // order the two appear in the attribute, because CSS specificity is equal
  // and Tailwind emits leading after font-size.
  let leadingDeclared = false
  for (const base of bases) {
    if (!base.startsWith('leading-')) continue
    const value = base.slice('leading-'.length)
    const ratio = LEADING_RATIO[value]
    if (typeof ratio === 'number') {
      linePx = fontPx * ratio
      leadingDeclared = true
      continue
    }
    const inner = bracketed(value)
    if (inner !== null) {
      const asLength = lengthPx(inner)
      const asRatio = numeric(inner)
      if (Number.isFinite(asLength)) {
        linePx = asLength
        leadingDeclared = true
      } else if (Number.isFinite(asRatio)) {
        linePx = fontPx * asRatio
        leadingDeclared = true
      }
      continue
    }
    const step = spacingPx(value)
    if (Number.isFinite(step)) {
      linePx = step
      leadingDeclared = true
    }
  }
  return { fontPx, linePx, bold, leadingDeclared }
}

/** A length utility's value: a number, `'unreadable'` when it is there but opaque, null when absent. */
function lengthUtility(bases: string[], prefixes: string[]): number | 'unreadable' | null {
  let out: number | 'unreadable' | null = null
  for (const base of bases) {
    const prefix = prefixes.find((p) => base.startsWith(p))
    if (!prefix) continue
    const value = base.slice(prefix.length)
    const inner = bracketed(value)
    const px = inner === null ? spacingPx(value) : lengthPx(inner)
    // `h-full`, `h-screen`, `h-[50%]`: a real height, decided by a box this
    // analysis never sees. Saying so beats pretending the class is not there.
    out = Number.isFinite(px) ? px : 'unreadable'
  }
  return out
}

/**
 * Vertical padding in px, or null when a padding utility is there but opaque.
 *
 * Asked one prefix at a time rather than all three at once, because the winner
 * is the most specific utility present — `pt-` over `py-` over `p-` — and
 * `lengthUtility` settles ties by last-one-wins, which is attribute order and
 * has nothing to do with which rule CSS applies.
 */
function verticalPadding(bases: string[]): number | null {
  const edge = (side: string): number | null => {
    for (const prefix of [side, 'py-', 'p-']) {
      const value = lengthUtility(bases, [prefix])
      if (value === 'unreadable') return null
      if (value !== null) return value
    }
    return 0
  }
  const top = edge('pt-')
  const bottom = edge('pb-')
  return top === null || bottom === null ? null : top + bottom
}

const TARGET_MIN_PX = 44
const TARGET_SHAPE_PREFIXES = ['p-', 'py-', 'pt-', 'pb-', 'h-', 'min-h-', 'size-']

/**
 * The height a control's classes describe, or null when they do not describe one.
 *
 * Null is the common answer and the important one. It covers the control whose
 * class list is computed, the one whose height comes from an aspect ratio, and
 * — the case that matters most — the icon button, whose height is set by an
 * `<svg className="h-8">` inside it that `ElementFact` gives no way to reach.
 * Deducing that one from its line box would report a 32px control as a 24px
 * control, which is a false positive on the exact elements this rule is for.
 *
 * It also returns null for an element that declares neither padding nor height,
 * because that element is an inline link in a sentence, and WCAG 2.5.8 exempts
 * those by name. The only thing separating a button-shaped link from a word in
 * a paragraph, here, is that someone gave the first one a box.
 */
function deducedHeight(el: ElementFact): number | null {
  // A `style` prop can set a height, and `inspect.ts` records it as present and
  // unknowable — the same reason `declaredColors` stands down on one.
  if (hasAttr(el, 'style')) return null
  const tokens = classesOf(el)
  if (!tokens) return null
  // Resting state only: combining a base `py-2` with a `md:h-12` would describe
  // a control that exists at no width at all. Mobile is also where a tap target
  // is a tap target, and mobile is the unprefixed state.
  const bases = restingBases(tokens)
  if (!bases.some((b) => TARGET_SHAPE_PREFIXES.some((p) => b.startsWith(p)))) return null
  // A ratio box takes its height from its width, which is a rendered property.
  if (bases.some((b) => b.startsWith('aspect-'))) return null

  const fixed = lengthUtility(bases, ['h-', 'size-'])
  if (fixed === 'unreadable') return null
  if (fixed !== null) return fixed

  const floor = lengthUtility(bases, ['min-h-'])
  if (floor === 'unreadable') return null
  if (el.hasChildren) return null

  const padding = verticalPadding(bases)
  if (padding === null) return null
  const height = padding + typeBoxOf(bases).linePx
  return floor === null ? height : Math.max(height, floor)
}

/**
 * Body copy, as opposed to a label, an eyebrow or a heading.
 *
 * Both halves of this are load-bearing. Headings are excluded because
 * `leading-none` on a display title is not a defect, it is how display titles
 * are set. The length floor is what keeps `uppercase` off
 * `<p className="uppercase tracking-widest">Nouveau</p>`, the eyebrow every
 * generated hero has — a rule that reported those would fire on nearly every
 * screen and be switched off within a day.
 *
 * `hasChildren` excludes wrappers: `text` is recursive, so a `<div>` around a
 * navigation adds up to plenty of characters without containing a sentence.
 */
const BODY_TEXT_MIN_CHARS = 40
const isBodyText = (el: ElementFact): boolean =>
  !HEADINGS.includes(el.tag) && !el.hasChildren && el.text.trim().length >= BODY_TEXT_MIN_CHARS

/** Tailwind's own smallest step. Going under it takes an arbitrary value, so it is a decision. */
const MIN_READABLE_PX = 12

/**
 * A leaf that shows words of its own: the only element a contrast check may look at.
 *
 * Named and shared rather than inlined, because `familyCoverage` has to count
 * exactly the elements `runRules` looks at. Two copies of this condition drift,
 * and the drift is invisible: the panel would report "18 elements compared"
 * beside a check that compared some other number of them, which is a lie about
 * coverage — the one thing the coverage line exists to prevent.
 *
 * The leaf test is what makes it correct: `text` is recursive, so a wrapper's
 * words may belong to a child that overrides the colour.
 */
const paintsOwnText = (el: ElementFact): boolean =>
  !el.hasChildren && (el.text.length > 0 || el.hasDynamicText)

/** A button or a real link: the two things the tap-target rules take a view on. */
const isControl = (el: ElementFact): boolean =>
  el.tag === 'button' || (el.tag === 'a' && hasAttr(el, 'href'))

/**
 * WCAG's contrast floors, and where "large" starts.
 *
 * 24px, or 18px when bold. The standard's second boundary is 18.66px — 14pt —
 * and Tailwind's `text-lg` is 18px, a third of a pixel under it. Rounding that
 * one the lenient way is deliberate: the cost of being strict is a finding
 * against a bold subtitle that any reader would call legible, and one of those
 * teaches people to close the panel.
 */
const CONTRAST_MIN = 4.5
const CONTRAST_MIN_LARGE = 3
const isLargeText = (box: TypeBox) => box.fontPx >= 24 || (box.bold && box.fontPx >= 18)

/** Utilities that put space between the children of a flex or grid container. */
const SPACING_PREFIXES = ['gap-', 'gap-x-', 'gap-y-', 'space-x-', 'space-y-', 'divide-']
const SPREADING = ['justify-between', 'justify-around', 'justify-evenly']
const MARGIN_PREFIXES = ['m-', 'mx-', 'my-', 'mt-', 'mb-', 'ml-', 'mr-', 'ms-', 'me-']

/**
 * The index of each element's parent, reconstructed from the ancestor chains.
 *
 * Babel enters a JSX element before its children, so `facts.elements` is in
 * document order and a parent always precedes its children. The nearest earlier
 * element whose own chain is this element's chain minus its last tag, and whose
 * tag IS that last tag, is therefore the parent and not merely a look-alike:
 * any closer candidate would have had to open after it and would still be open.
 *
 * This is the only place a rule needs sibling relationships, and it is why it is
 * computed rather than added to `ElementFact` — one caller does not justify a
 * new fact on every element of every screen.
 */
function parentIndexes(host: ElementFact[]): number[] {
  const out: number[] = []
  for (let i = 0; i < host.length; i++) {
    const chain = host[i].ancestors
    let parent = -1
    for (let j = i - 1; j >= 0 && parent < 0; j--) {
      const candidate = host[j]
      if (
        chain.length > 0 &&
        candidate.tag === chain[chain.length - 1] &&
        candidate.ancestors.length === chain.length - 1 &&
        candidate.ancestors.every((tag, k) => tag === chain[k])
      ) {
        parent = j
      }
    }
    out.push(parent)
  }
  return out
}

/**
 * Run every rule over one screen's facts.
 *
 * Returns hits, not findings: the caller turns them into `QualityFinding`s so
 * the correction loop and the quality pass speak one language.
 */
export function runRules(facts: ScreenFacts): RuleHit[] {
  const hits: RuleHit[] = []
  const add = (rule: string, el: ElementFact | null, line = 0) =>
    hits.push({ rule, line: el?.line ?? line, snippet: el ? snippetOf(el) : '' })

  const host = facts.elements.filter((e) => e.host)
  const headings = host.filter((e) => HEADINGS.includes(e.tag))
  const parents = parentIndexes(host)

  // --- images ---
  for (let i = 0; i < host.length; i++) {
    const el = host[i]
    if (el.tag !== 'img') continue
    // Absent, or `<img alt />` which is the boolean `true` rather than a caption.
    if (!hasAttr(el, 'alt') || el.attrs['alt']?.kind === 'bare') {
      add('img-alt', el)
    } else {
      const alt = attrText(el, 'alt')
      // `alt=""` is the CORRECT answer for a decorative image and must never be
      // reported; `alt={caption}` is unknowable and must not be guessed at.
      if (alt && REDUNDANT_ALT.includes(alt.trim().toLowerCase())) add('img-alt-redundant', el)
      // …except under a caption. A <figure> is the markup for content the
      // document refers to, so an image inside one is by construction not
      // decoration, and `alt=""` there hides it from the only readers who
      // needed it described. Deliberately narrow: a bare `alt=""` on a
      // background flourish stays correct and stays unreported.
      const captioned =
        el.ancestors.includes('figure') ||
        host.some((e, j) => e.tag === 'figcaption' && parents[j] >= 0 && parents[j] === parents[i])
      if (alt !== null && alt.trim() === '' && captioned) add('img-meaningful-empty-alt', el)
    }

    // Layout shift: without an intrinsic ratio the browser reserves no space,
    // and everything below the image jumps once it loads.
    if (hasAttr(el, 'width') && hasAttr(el, 'height')) continue
    const tokens = classesOf(el)
    // An unreadable class list may well carry the `aspect-` that saves it.
    if (!tokens) continue
    const bases = anyStateBases(tokens)
    const reserved =
      bases.some((b) => b.startsWith('aspect-')) || lengthUtility(bases, ['h-', 'size-']) !== null
    if (!reserved) add('img-no-dimensions', el)
  }

  // --- headings ---
  const h1s = headings.filter((e) => e.tag === 'h1')
  if (headings.length > 0 && h1s.length === 0) add('heading-missing-h1', headings[0])
  if (h1s.length > 1) add('heading-multiple-h1', h1s[1])
  for (const el of headings) {
    // `hasDynamicText` is what separates "this heading is empty" from "this
    // heading's words come from data" — `<h3>{plan.name}</h3>` is every item
    // rendered from a map, and reporting those made the panel cry wolf on
    // essentially every real screen.
    if (!el.text && !hasAttr(el, 'aria-label') && !el.hasChildren && !el.hasDynamicText) {
      add('heading-empty', el)
    }
  }
  // Skipped levels, in source order. Source order is not always paint order,
  // which is why this is a warning and not an error.
  let previous = 0
  for (const el of headings) {
    const level = Number(el.tag.slice(1))
    if (previous && level > previous + 1) {
      add('heading-skipped-level', el)
      break // One report per screen: the first skip is the one to fix.
    }
    previous = level
  }

  // --- controls ---
  for (const el of host) {
    const clickable = hasAttr(el, 'onclick')
    if (isControl(el)) {
      if (!hasAccessibleName(el)) add('control-no-name', el)
      else if (el.tag === 'a' && GENERIC_LINK_TEXT.includes(el.text.trim().toLowerCase())) {
        add('link-text-generic', el)
      }
    }
    // A div with a click handler is a control a keyboard cannot reach and a
    // screen reader does not announce. `role` + `tabindex` is the escape hatch.
    if (clickable && !INTERACTIVE.includes(el.tag) && !hasAttr(el, 'role') && !hasAttr(el, 'tabindex')) {
      add('clickable-non-interactive', el)
    }
    const tabindex = Number(attrText(el, 'tabindex'))
    if (Number.isFinite(tabindex) && tabindex > 0) add('positive-tabindex', el)
    if (hasAttr(el, 'aria-hidden') && (INTERACTIVE.includes(el.tag) || clickable)) {
      add('aria-hidden-interactive', el)
    }
    if (hasAttr(el, 'autofocus')) add('autofocus', el)
  }

  // --- form fields ---
  const labelledIds = new Set(
    host.filter((e) => e.tag === 'label').map((e) => attrText(e, 'for')).filter(Boolean) as string[],
  )
  for (const el of host) {
    if (!FIELDS.includes(el.tag)) continue
    // Hidden inputs and buttons-as-inputs carry no label of their own.
    const type = (attrText(el, 'type') || '').toLowerCase()
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue
    const id = attrText(el, 'id')
    const wrapped = el.ancestors.includes('label')
    if (
      !wrapped &&
      !(id && labelledIds.has(id)) &&
      !hasAttr(el, 'aria-label') &&
      !hasAttr(el, 'aria-labelledby')
    ) {
      add('input-no-label', el)
    }
  }

  // --- ids ---
  const seen = new Set<string>()
  for (const el of host) {
    const id = attrText(el, 'id')
    if (!id) continue
    if (seen.has(id)) add('duplicate-id', el)
    seen.add(id)
  }

  // --- lists and tables ---
  for (const el of host.filter((e) => e.tag === 'li')) {
    const parent = el.ancestors[el.ancestors.length - 1]
    if (parent !== 'ul' && parent !== 'ol' && parent !== 'menu') add('list-structure', el)
  }
  for (const el of host.filter((e) => e.tag === 'table')) {
    // `th` anywhere in the screen is a weak test, but the facts are flat and a
    // table without a single `th` in the whole screen is the case worth naming.
    if (!host.some((e) => e.tag === 'th')) add('table-no-header', el)
  }

  // --- colour and typography ---
  for (const el of host) {
    const tokens = classesOf(el)
    if (!tokens) continue
    const resting = restingBases(tokens)
    const box = typeBoxOf(resting)

    // Contrast, and the abstention that makes it worth printing. `comparable`
    // is true only when this element paints BOTH colours itself — a text
    // colour over a background inherited from a wrapper is unknowable here, and
    // guessing white would report every dark panel on the canvas as unreadable.
    if (paintsOwnText(el)) {
      const colors = declaredColors(el)
      if (colors.comparable) {
        const ratio = contrastRatio(colors.text.hex!, colors.background.hex!)
        // NaN fails both comparisons, which is `contrastRatio`'s whole design.
        if (ratio < (isLargeText(box) ? CONTRAST_MIN_LARGE : CONTRAST_MIN)) add('low-contrast', el)
      }
    }

    // Font size is checked in every state, not just the resting one: a size
    // that only applies under `sm:` is still a size somebody reads. This is the
    // opposite call from the tap-target deduction below, and deliberately so —
    // one asks "how small does this ever get", the other "what does this
    // control look like", and only the second needs one coherent breakpoint.
    for (const base of anyStateBases(tokens)) {
      const size = textSizeOf(base)
      if (Number.isFinite(size) && size < MIN_READABLE_PX) {
        add('text-too-small', el)
        break
      }
    }

    if (!isBodyText(el)) continue
    if (box.leadingDeclared && box.linePx < box.fontPx * 1.15) add('leading-cramped', el)
    if (resting.includes('uppercase')) add('uppercase-body', el)
    if (resting.includes('text-justify')) add('text-justify', el)
  }

  // --- tap targets ---
  // Every finding here is a deduction from class names rather than a
  // measurement (Q4), which is why both rules only advise.
  for (const el of host) {
    if (!isControl(el)) continue
    const height = deducedHeight(el)
    if (height !== null && height < TARGET_MIN_PX) add('tap-target-small', el)
  }

  const controlsByParent = new Map<number, ElementFact[]>()
  for (let i = 0; i < host.length; i++) {
    const el = host[i]
    if (!isControl(el)) continue
    if (parents[i] < 0) continue
    const list = controlsByParent.get(parents[i])
    if (list) list.push(el)
    else controlsByParent.set(parents[i], [el])
  }
  for (const [index, controls] of controlsByParent) {
    if (controls.length < 2) continue
    const tokens = classesOf(host[index])
    if (!tokens) continue
    const bases = restingBases(tokens)
    // Only flex and grid, because only they collapse the whitespace between
    // two elements to nothing. In normal flow an inline gap survives and a
    // block stack has its own line boxes, so reporting those would be
    // reporting a layout that does not touch.
    if (!bases.some((b) => b === 'flex' || b === 'inline-flex' || b === 'grid' || b === 'inline-grid')) continue
    if (bases.some((b) => SPACING_PREFIXES.some((p) => b.startsWith(p)))) continue
    if (bases.some((b) => SPREADING.includes(b))) continue
    // A margin on the children does the same job as a gap on the parent, and
    // a control whose class list cannot be read might well carry one.
    const spaced = controls.some((c) => {
      const own = classesOf(c)
      return own === null || restingBases(own).some((b) => MARGIN_PREFIXES.some((p) => b.startsWith(p)))
    })
    if (!spaced) add('targets-adjacent', controls[0])
  }

  // --- document structure ---
  if (host.length > 0 && !host.some((e) => LANDMARKS.includes(e.tag))) add('no-landmarks', null, 1)
  // A row of links that is plainly a navigation bar, in a screen with no <nav>.
  const linkCount = host.filter((e) => e.tag === 'a').length
  if (linkCount >= 4 && !host.some((e) => e.tag === 'nav')) add('div-soup-nav', null, 1)

  return hits
}

export interface DimensionScore {
  /** 0–100. */
  score: number
  band: 'excellent' | 'good' | 'acceptable' | 'poor'
  /** Distinct rules failing in this dimension. */
  failing: number
  /**
   * How much of the discipline this analysis can actually see (Q4).
   *
   * Always 'partial' for now, and honestly so: contrast, focus visibility,
   * reflow and target size are rendered properties, and nothing here renders.
   */
  confidence: 'partial'
}

function bandFor(score: number): DimensionScore['band'] {
  if (score >= 90) return 'excellent'
  if (score >= 75) return 'good'
  if (score >= 50) return 'acceptable'
  return 'poor'
}

/**
 * Which disciplines a finding counts against.
 *
 * A catalogued rule says so itself. A judged finding — one the model raised,
 * whose id is not in the catalogue — carries its dimension on the finding, and
 * has to be scored too: a deep pass whose findings changed nothing would be a
 * button that spends tokens and moves no number.
 */
function dimensionsOf(f: QualityFinding): AuditDimension[] {
  const known = RULES[f.rule]
  if (known) return known.dimensions
  if (f.dimension === 'seo' || f.dimension === 'a11y') return [f.dimension]
  return []
}

/**
 * Score one dimension out of 100.
 *
 * Distinct rules, never element counts — see WEIGHT. Floored at 0 rather than
 * allowed to go negative, because "how much worse than nothing" is not a
 * question a score can answer.
 */
export function scoreDimension(findings: QualityFinding[], dimension: AuditDimension): DimensionScore {
  const failing = new Map<string, QualityFinding>()
  for (const f of findings) {
    if (dimensionsOf(f).includes(dimension)) failing.set(f.rule, f)
  }
  let penalty = 0
  for (const f of failing.values()) penalty += WEIGHT[f.severity]
  const score = Math.max(0, 100 - penalty)
  return { score, band: bandFor(score), failing: failing.size, confidence: 'partial' }
}

// ---------------------------------------------------------------------------
// The same findings, arranged by what they are about
// ---------------------------------------------------------------------------

/**
 * Whether a family's rules reached a verdict at all, and when they did not, why.
 *
 * This is the whole reason the breakdown is not simply eight more numbers. A
 * family with nothing to look at and a family that looked at everything and
 * found nothing produce the SAME empty list of findings, and printing 100 for
 * both is Q4's failure repeated once per row: a screen with no form would
 * report perfect forms, and a screen whose colours all come from a wrapper
 * would report perfect contrast, when neither was ever examined.
 *
 * The two negatives are kept apart because they are different facts about the
 * screen. `not-applicable` is "there was nothing here to check" — no image, no
 * field, no control. `not-measured` is "there was, and the source does not say
 * enough to decide" — text whose background lives on an ancestor, a control
 * whose `className` is computed. Collapsing them would lose the difference
 * between a screen that needs no contrast check and one that quietly escaped it.
 */
export type FamilyState = 'scored' | 'not-applicable' | 'not-measured'

/** What one family's rules had in front of them. Internal: only the state it produces leaves. */
interface FamilyCoverage {
  /** Subjects the family could reach a verdict on. */
  examined: number
  /** Subjects it saw and had to stand down on. Only colour, typography and targets ever abstain. */
  abstained: number
}

export interface FamilyScore {
  family: AuditFamily
  labelKey: string
  /** 0–100, and non-null exactly when `state` is `'scored'`. */
  score: number | null
  band: DimensionScore['band'] | null
  /** Distinct rules of this family that are failing — the count the panel shows. */
  failing: number
  state: FamilyState
  confidence: FamilyConfidence
  /** i18n key for what that confidence rests on. */
  confidenceKey: string
}

/**
 * What each family actually had in front of it on this screen.
 *
 * Subject counts, not element counts: the subjects of `images` are the `<img>`
 * elements, and a screen of forty divs around one picture has one of them. What
 * the number is used for is only ever the zero test, but counting the right
 * things is what makes that test mean "nothing to check here" instead of
 * "nothing on the screen".
 *
 * Duplicating `runRules`'s own conditions was the alternative and is the trap:
 * the two would drift, and the drift is silent — a family would report a score
 * for subjects it never looked at, or "not applicable" beside a finding about
 * it. The shared predicates (`paintsOwnText`, `isControl`, `classesOf`) are
 * there so both sides ask the same question in the same words.
 */
function familyCoverage(facts: ScreenFacts): Record<AuditFamily, FamilyCoverage> {
  const out = {} as Record<AuditFamily, FamilyCoverage>
  for (const { id } of RULE_FAMILIES) out[id] = { examined: 0, abstained: 0 }
  if (!facts.parsed) return out

  const host = facts.elements.filter((e) => e.host)
  const count = (family: AuditFamily, readable: boolean) => {
    if (readable) out[family].examined++
    else out[family].abstained++
  }

  for (const el of host) {
    if (HEADINGS.includes(el.tag)) out.headings.examined++
    if (el.tag === 'img') out.images.examined++
    if (INTERACTIVE.includes(el.tag) || hasAttr(el, 'onclick') || hasAttr(el, 'tabindex')) out.links.examined++
    // Fields and labels, and nothing else. `duplicate-id` and `autofocus` are
    // filed under forms because that is where they bite, but counting every
    // element carrying an `id` as a form subject would make `id="tarifs"` on a
    // heading enough to report "forms: 100" on a landing page with no form —
    // exactly the reassurance this whole mechanism exists to withhold. A
    // finding is proof of examination on its own, and `scoreFamilies` uses it.
    if (FIELDS.includes(el.tag) || el.tag === 'label') out.forms.examined++
    // A control the family can say something about is one whose classes can be
    // read; the height deduction may still decline afterwards, and an inline
    // link is exempt rather than unreadable.
    if (isControl(el)) count('targets', classesOf(el) !== null)
    if (paintsOwnText(el)) count('color', declaredColors(el).comparable)
    if (el.text.length > 0 || el.hasDynamicText) count('typography', classesOf(el) !== null)
  }

  // Structure is a property of the screen, not of any one element: the rules ask
  // whether a landmark exists ANYWHERE, so the subject is the markup itself and
  // the only screen they cannot answer for is one with no markup at all.
  out.landmarks.examined = host.length
  return out
}

/**
 * Score every family, in the fixed order of `RULE_FAMILIES`.
 *
 * Beside `scoreDimension`, never instead of it. The two head scores answer
 * "how does this screen do for SEO, and for accessibility", which is the
 * question the user already reads; this answers "where do I go to fix it",
 * which is a different cut of the same findings. Rewriting the first in terms
 * of the second would silently change what a number someone has been watching
 * for weeks means.
 *
 * `judgedFamilies` carries the deep pass's contribution: a judged finding's id
 * is not in `RULES`, so its family can only come from the catalogue that asked
 * the question. Without it a model finding about headings would lower the SEO
 * score while the headings row still read 100 — the breakdown contradicting the
 * number directly above it.
 */
export function scoreFamilies(
  findings: QualityFinding[],
  facts: ScreenFacts,
  judgedFamilies: Record<string, AuditFamily> = {},
): FamilyScore[] {
  const blank = (state: FamilyState) =>
    RULE_FAMILIES.map((f) => ({
      family: f.id,
      labelKey: f.labelKey,
      score: null,
      band: null,
      failing: 0,
      state,
      confidence: f.confidence,
      confidenceKey: f.confidenceKey,
    }))

  // A screen Babel could not read was not examined — reporting its families as
  // "nothing to check here" would be the unopened file scoring full marks all
  // over again, one level further down.
  if (!facts.parsed) return blank('not-measured')

  const coverage = familyCoverage(facts)
  const failing = new Map<AuditFamily, Map<string, QualityFinding>>()
  for (const f of findings) {
    const family = RULES[f.rule]?.family ?? judgedFamilies[f.rule]
    if (!family) continue
    const seen = failing.get(family) ?? new Map<string, QualityFinding>()
    // Distinct rules, exactly like `scoreDimension`: twenty images with no alt
    // is one thing to fix here too.
    seen.set(f.rule, f)
    failing.set(family, seen)
  }

  return RULE_FAMILIES.map((f) => {
    const rules = failing.get(f.id)
    const { examined, abstained } = coverage[f.id]
    // A finding IS proof that something was examined, and it outranks the
    // subject count: the rules filed under a family are not always about the
    // things counted for it, and a row reading "not applicable" directly above
    // a finding of its own would be absurd.
    const state: FamilyState =
      rules && rules.size > 0
        ? 'scored'
        : examined > 0
          ? 'scored'
          : abstained > 0
            ? 'not-measured'
            : 'not-applicable'
    let penalty = 0
    for (const finding of rules?.values() ?? []) penalty += WEIGHT[finding.severity]
    const score = state === 'scored' ? Math.max(0, 100 - penalty) : null
    return {
      family: f.id,
      labelKey: f.labelKey,
      score,
      band: score === null ? null : bandFor(score),
      failing: rules?.size ?? 0,
      state,
      confidence: f.confidence,
      confidenceKey: f.confidenceKey,
    }
  })
}

/**
 * Turn hits into the finding shape the rest of the app already speaks.
 *
 * `QualityFinding` rather than a type of our own: the correction loop, the
 * findings-to-prompt renderer and the progress signature all take it, and a
 * parallel type would mean parallel copies of all three.
 *
 * `name` and `description` carry i18n KEYS, not sentences. The report is read
 * in two languages and is also handed to a model — the panel translates for the
 * reader, and `findingsToPrompt` resolves them to English so the instruction is
 * stable whatever language the UI happens to be in.
 *
 * That resolution is load-bearing, not cosmetic: without it the model receives
 * `audit.rule.imgAlt: audit.rule.imgAltDesc` and has to guess from the rule id
 * alone. It also means the English descriptions in `src/i18n/parts/audit.ts`
 * are read by a model as well as by a person — write them as instructions
 * ("Add an alt describing what the image shows; a decorative image takes
 * alt=\"\"") rather than as labels.
 */
export function toFindings(hits: RuleHit[]): QualityFinding[] {
  const byRule = new Map<string, RuleHit[]>()
  for (const h of hits) {
    const list = byRule.get(h.rule)
    if (list) list.push(h)
    else byRule.set(h.rule, [h])
  }
  const out: QualityFinding[] = []
  for (const [id, list] of byRule) {
    const rule = RULES[id]
    if (!rule) continue
    out.push({
      rule: id,
      source: 'mocky',
      name: rule.nameKey,
      description: rule.descKey,
      severity: rule.severity,
      category: rule.dimensions.join('+'),
      dimension: rule.dimensions[0],
      priority: rule.severity === 'error' ? 'P1' : rule.severity === 'warning' ? 'P2' : 'P3',
      disposition: rule.disposition,
      line: list[0].line || undefined,
      // Every offender, so "3 images" is visible without opening the code.
      snippet: list.map((h) => h.snippet).filter(Boolean).slice(0, 5).join(' '),
    })
  }
  return out
}
