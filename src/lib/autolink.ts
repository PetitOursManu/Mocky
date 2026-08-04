import type { Screen } from './project'

/**
 * Guessing which button leads to which screen.
 *
 * Wiring a prototype today means entering Link mode, clicking one element,
 * choosing a target, and repeating — once per navigation, for every screen. On a
 * six-screen flow that is thirty deliberate acts before the demo shows anything.
 * This proposes the obvious ones so the user only has to disagree.
 *
 * IT PROPOSES. It does not write. Three properties of the model make silent
 * creation unsafe: `Hotspot` has no provenance field, so a machine-made link is
 * indistinguishable from one the user drew; `addHotspot` appends without any
 * uniqueness check, so a second pass doubles every link; and a wrong hotspot
 * does not error — it sends the demo to the wrong screen, in front of whoever
 * is being shown it. Everything here returns candidates for review.
 *
 * WHAT IT MATCHES ON, strongest first
 *
 * 1. The `href` the model itself wrote. A generated screen routinely carries
 *    `<a href="/tarifs">`, which the preview neuters at render time — but it is
 *    the model stating where that link goes, and nothing else in the system is
 *    that direct.
 * 2. The button's own words against the target screen's PROMPT. The prompt, not
 *    the name: `deriveName` is the prompt cut to 48 characters, so the name is a
 *    lossy copy of a field sitting right there intact.
 * 3. The button's words appearing in the target screen's CODE — a "Voir les
 *    tarifs" button and a screen whose markup says "Tarifs".
 *
 * Below a floor it proposes nothing at all. A wrong guess costs more than a
 * missing one: the missing one is a click, the wrong one is a demo that goes
 * somewhere nobody expected and that the user has no reason to re-check.
 */

/** One interactive element found in a screen, as the preview reports it. */
export interface LinkableElement {
  /** CSS path into the rendered tree — only the live DOM can mint this. */
  selector: string
  /** Visible text, trimmed. */
  label: string
  /** The `href` the model wrote, if this was an anchor. */
  href?: string
  /** Normalised rect, for drawing the hotspot. */
  rect: { x: number; y: number; w: number; h: number }
}

export interface LinkCandidate {
  selector: string
  label: string
  /** Carried through from the swept element — a Hotspot needs it to be drawn. */
  rect: { x: number; y: number; w: number; h: number }
  /** Target screen id. */
  target: string
  /** 0..1. Only what cleared the floor is returned. */
  score: number
  /** Which signal carried it — shown to the user, so it must be honest. */
  why: 'href' | 'prompt' | 'content'
}

/**
 * Below this, propose nothing.
 *
 * Tuned so a single shared common word cannot carry a match on its own: one
 * token in common out of several scores well under it, while a slug that names
 * the target, or two or three substantive words in common, clears it.
 */
export const MIN_SCORE = 0.34

/** Words too common to be evidence of anything, in both languages Mocky speaks. */
const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'a', 'au', 'aux',
  'ce', 'cette', 'ces', 'pour', 'par', 'avec', 'sur', 'dans', 'en', 'plus', 'tout',
  'toute', 'tous', 'votre', 'vos', 'mon', 'ma', 'mes', 'son', 'sa', 'ses', 'nos',
  'page', 'ecran', 'screen', 'the', 'a', 'an', 'and', 'or', 'for', 'with', 'to',
  'of', 'in', 'on', 'your', 'our', 'my', 'this', 'that', 'all', 'more', 'new',
  'voir', 'aller', 'view', 'go', 'see', 'open', 'click', 'here', 'ici',
])

/**
 * Words of a string, lowercased, unaccented, stopwords removed.
 *
 * Accents are folded because a button reading "Tarifs détaillés" and a prompt
 * reading "page de tarifs detailles" are the same intention typed twice, and a
 * matcher that misses that is worse than useless — it is confidently silent.
 */
export function tokens(text: string): string[] {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

/**
 * How much of the SMALLER set the two share.
 *
 * Deliberately not Jaccard. A two-word button against a thirty-word prompt has a
 * tiny union, so Jaccard would score a perfect match near zero and the feature
 * would propose nothing on exactly the screens it is meant for. What matters is
 * whether the shorter phrase is contained in the longer one.
 */
export function overlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const [small, large] = a.length <= b.length ? [a, b] : [b, a]
  const set = new Set(large)
  const hits = small.filter((w) => set.has(w)).length
  return hits / small.length
}

/** The meaningful words of an href: `/pricing/annual?x=1` → ['pricing', 'annual']. */
export function slugTokens(href: string | undefined): string[] {
  if (!href) return []
  // Anything that leaves the mockup is not a screen reference.
  if (/^(https?:|mailto:|tel:)/i.test(href)) return []
  return tokens(href.replace(/[?#].*$/, '').replace(/\.[a-z0-9]+$/i, ''))
}

/**
 * An href that points inside the screen it lives on, e.g. `#waitlist`.
 *
 * These must not be proposed as links to another screen, and the reason is
 * easy to miss: `slugTokens` strips the fragment, so `#waitlist` contributes
 * nothing and the element ends up scored on its LABEL alone. "Join the quiet
 * list" then matches whichever screen happens to talk about joining, and the
 * feature offers to wire a jump-to-section into a navigation to somewhere else
 * — replacing behaviour the screen already had, since the preview bridge
 * performs fragment scrolling itself (see Preview.tsx).
 *
 * A bare "#" is excluded: it is the placeholder href of a button that goes
 * nowhere yet, which is exactly what this feature exists to give a destination.
 */
export function isInPageAnchor(href: string | undefined): boolean {
  return typeof href === 'string' && href.length > 1 && href.charAt(0) === '#'
}

/** Everything a screen can be recognised by, as one bag of words. */
function screenTokens(s: Screen): { name: string[]; content: string[] } {
  return {
    // The prompt is the richest description; the name is it, truncated.
    name: tokens(`${s.prompt || ''} ${s.name || ''}`),
    // Only the visible text of the code, so class names and imports do not
    // flood the bag: a screen full of `text-slate-700` would otherwise match
    // any button mentioning text.
    content: tokens(
      (s.code || '')
        .replace(/className\s*=\s*(["'`])[\s\S]*?\1/g, ' ')
        .replace(/\b(import|from|const|function|return|export)\b/g, ' ')
        .slice(0, 4000),
    ),
  }
}

/**
 * Propose one target per interactive element of `from`.
 *
 * Only the best target for each element, and only if it clears the floor: a list
 * offering three possible destinations per button is a puzzle, not a proposal.
 * A screen never links to itself.
 */
export function proposeLinks(
  elements: LinkableElement[],
  from: Screen,
  screens: Screen[],
): LinkCandidate[] {
  const others = screens.filter((s) => s.id !== from.id && s.code && s.code.trim())
  if (others.length === 0) return []

  const bags = new Map(others.map((s) => [s.id, screenTokens(s)]))
  const out: LinkCandidate[] = []

  for (const el of elements) {
    // A jump to a section of this same screen already works, and is not a
    // candidate for a link to another one.
    if (isInPageAnchor(el.href)) continue

    const label = tokens(el.label)
    const slug = slugTokens(el.href)
    if (label.length === 0 && slug.length === 0) continue

    let best: LinkCandidate | null = null
    for (const target of others) {
      const bag = bags.get(target.id)!

      // The model's own statement of where this goes. Weighted highest, and
      // scored against the name rather than the body: a slug names a
      // destination, it does not describe one.
      const bySlug = slug.length ? overlap(slug, bag.name) : 0
      const byPrompt = label.length ? overlap(label, bag.name) : 0
      const byContent = label.length ? overlap(label, bag.content) : 0

      const score = Math.max(bySlug, byPrompt * 0.9, byContent * 0.6)
      const why: LinkCandidate['why'] =
        score === bySlug && bySlug > 0 ? 'href' : score === byPrompt * 0.9 ? 'prompt' : 'content'

      if (score >= MIN_SCORE && (!best || score > best.score)) {
        best = { selector: el.selector, label: el.label, rect: el.rect, target: target.id, score, why }
      }
    }
    if (best) out.push(best)
  }

  // Best first: the user reads down a list and stops when it stops being
  // obvious, so the obvious ones have to be at the top.
  return out.sort((a, b) => b.score - a.score)
}

/**
 * Drop candidates the screen already has a link for.
 *
 * `addHotspot` appends without checking anything, so proposing something already
 * wired is how a second pass silently doubles every link — the canvas stacks the
 * overlays and the demo honours only the first match.
 */
export function withoutExisting(candidates: LinkCandidate[], from: Screen): LinkCandidate[] {
  const taken = new Set((from.links || []).map((h) => h.selector).filter(Boolean))
  return candidates.filter((c) => !taken.has(c.selector))
}
