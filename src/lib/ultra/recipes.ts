/**
 * Motion Ultra's recipe catalogue — the closed list a storyboard picks from.
 *
 * Same founding rule as Motion's block catalogue and `<Animated preset>`: the
 * model NAMES a treatment, it does not describe one. A storyboard that could say
 * "an aurora with a floating product and glass cards" in its own words would be
 * a storyboard nobody can check, and a generation prompt that receives prose
 * has nothing to hold the model to. A name out of this list is both.
 *
 * Each card is three sentences with a fixed job, the way the Motion block cards
 * are: what the treatment IS, how it is BUILT with the Ultra kit (the `u-*`
 * classes and `<Backdrop>`, see capabilities/snippets/Ultra.ts), and how it
 * FAILS — because a model shown a catalogue with only the upsides reaches for
 * every entry at once.
 *
 * The catalogue was read off a corpus of motionsites.ai pages (landing, SaaS,
 * portfolio, e-commerce, 3D). What recurs there is not a layout but a handful of
 * moves: a living ground, one isolated hero object, display type far past body
 * scale, frosted surfaces, reveals tied to the scroll, a grain that stops a
 * gradient looking like a gradient. The app-side entries exist because Motion
 * Ultra runs on EVERY kind of screen, and a dashboard dressed as a landing page
 * is the failure the user named first — so on an app surface the expression
 * stays in the chrome and the data keeps an opaque floor.
 */
import type { ScreenMode } from '../plan'

/** What a generated picture is FOR — decides how it is prompted and shaped. */
export type UltraImageRole = 'backdrop' | 'subject' | 'scene' | 'texture'

export const ULTRA_IMAGE_ROLES: UltraImageRole[] = ['backdrop', 'subject', 'scene', 'texture']

export const ULTRA_RECIPE_IDS = [
  'aurora-hero',
  'object-hero',
  'cinematic-hero',
  'giant-type',
  'glass-cards',
  'image-mosaic',
  'sticky-stack',
  'parallax-band',
  'marquee-strip',
  'spotlight-feature',
  'glow-metrics',
  'cinematic-cta',
  'ambient-shell',
  'banner-panel',
  'illustrated-state',
  'editorial-read',
] as const

export type UltraRecipeId = (typeof ULTRA_RECIPE_IDS)[number]

export interface UltraRecipe {
  id: UltraRecipeId
  /** The surfaces this treatment is written for — a preference, never a gate. */
  modes: ScreenMode[]
  /** The picture roles it can use, most wanted first. Empty: it needs none. */
  images: UltraImageRole[]
  /** What it is · how it is built · how it fails. English: it is prompt text. */
  card: [string, string, string]
}

export const ULTRA_RECIPES: Record<UltraRecipeId, UltraRecipe> = {
  'aurora-hero': {
    id: 'aurora-hero',
    modes: ['persuade', 'experience'],
    images: ['backdrop'],
    card: [
      'A full-viewport opening on a living colour field, with display type far past body scale.',
      'A `relative min-h-[90vh]` section, `<Backdrop preset="aurora">` (or "mesh"/"beams") as its first child, the copy in a `relative z-10` wrapper: a `u-eyebrow`, a `u-display` headline with ONE word in `u-text-gradient`, a short `u-reveal` subline, two actions of which the primary carries `u-sheen`. A backdrop image, when one is listed for it, goes in `<Backdrop image="…">`.',
      'It fails when the brightest part of the field sits behind the headline — raise `veil` rather than shrinking the type — and when every word is gradient, which reads as a template.',
    ],
  },
  'object-hero': {
    id: 'object-hero',
    modes: ['persuade', 'experience'],
    images: ['subject', 'backdrop'],
    card: [
      'A split opening: the words on one side, ONE isolated object on the other, floating in its own light.',
      'Two columns; the subject image in a `relative` box with a soft halo behind it (`absolute inset-0 rounded-full blur-3xl` in the accent at low opacity), the `<img>` itself `u-float u-cutout` and `object-contain` — `u-cutout` is NOT optional, it is what dissolves the background the picture was generated on, two or three small `u-glass` chips (a figure, a label) overlapping its edges. The text column is `u-display-sm` + `u-reveal`.',
      'It fails when the picture keeps a visible rectangle of its own background — which is what an `<img>` without `u-cutout` does — and when the chips cover the object instead of framing it.',
    ],
  },
  'cinematic-hero': {
    id: 'cinematic-hero',
    modes: ['persuade', 'experience', 'read'],
    images: ['scene', 'backdrop'],
    card: [
      'A full-bleed photograph as the opening, slowly breathing, with the headline set low over it like a film title.',
      'The scene `<img>` `absolute inset-0 h-full w-full object-cover u-kenburns`, a veil from transparent to the ground colour over its lower half (`bg-gradient-to-t`), then `u-display` type anchored bottom-left in a `relative z-10` block with a `u-eyebrow` and one action.',
      'It fails when the veil is skipped and the type lands on a bright patch of the picture; the headline must be readable on the darkest AND the lightest frame of the zoom.',
    ],
  },
  'giant-type': {
    id: 'giant-type',
    modes: ['persuade', 'experience', 'read'],
    images: [],
    card: [
      'One statement set so large it becomes the section — a manifesto line between two denser blocks.',
      'A generous section holding a single `u-display` line, mixing a solid run with a `u-text-outline` run and at most one `u-text-gradient` word, each line `u-reveal` so the sentence assembles as it scrolls in. Nothing else in the section but a one-line caption.',
      'It fails as a paragraph: past about eight words display type stops being read and starts being looked at.',
    ],
  },
  'glass-cards': {
    id: 'glass-cards',
    modes: ['persuade', 'operate', 'experience'],
    images: ['texture', 'backdrop'],
    card: [
      'Features or plans as frosted cards floating over a soft colour field.',
      'A `relative` section with `<Backdrop preset="mesh">` (a texture image may feed `image`), a grid of `u-glass` cards (`u-glass-light` on a pale ground) inside `<Animated preset="stagger-list">`, ONE highlighted card carrying `u-border-beam`, icons in small tinted squares.',
      'It fails when the field behind the cards is too busy for the text on them — glass blurs what is behind it, it does not erase it — and when every card has the beam.',
    ],
  },
  'image-mosaic': {
    id: 'image-mosaic',
    modes: ['experience', 'persuade'],
    images: ['scene', 'subject', 'texture'],
    card: [
      'A bento of generated pictures of unequal sizes, the gallery a portfolio or a product story opens onto.',
      'A CSS grid with `grid-rows-[…]` and spans, each tile a rounded `overflow-hidden` box whose `<img>` is `object-cover` with `transition duration-700 hover:scale-105`, one caption per tile in a `u-glass` pill at the bottom, tiles wrapped in `<Animated preset="stagger-list">`.',
      'It fails with tiles of one size (that is a table of thumbnails) and with captions longer than a line.',
    ],
  },
  'sticky-stack': {
    id: 'sticky-stack',
    modes: ['persuade', 'experience', 'read'],
    images: ['scene', 'subject'],
    card: [
      'Cards that pile onto each other as the visitor scrolls — a sequence of steps, cases or chapters.',
      'A `u-stack` container whose direct children are tall cards (`min-h-[70vh]`), each with `style={{ "--i": index }}` so they settle a little lower than the previous one; each card is a split of a picture and three lines of copy, on an OPAQUE ground so the card beneath disappears.',
      'It fails with translucent cards (the stack shows through and reads as a bug) and with more than five of them.',
    ],
  },
  'parallax-band': {
    id: 'parallax-band',
    modes: ['persuade', 'experience', 'read'],
    images: ['scene', 'backdrop', 'texture'],
    card: [
      'A wide band of picture between two sections that drifts against the scroll, carrying one quote or one figure.',
      'An `overflow-hidden` band `h-[60vh]`, the `<img>` `absolute -inset-y-[15%] w-full object-cover u-parallax`, a veil, and a centred `u-display-sm` quote or a `<CountUp>` figure over it.',
      'It fails without the negative inset — the drift then uncovers the band\'s edge — and when used twice on one page.',
    ],
  },
  'marquee-strip': {
    id: 'marquee-strip',
    modes: ['persuade', 'experience'],
    images: [],
    card: [
      'A strip of words or logos running forever, a breath between two sections.',
      '`<Ticker>` inside a `u-fade-x` wrapper, items alternating a solid `u-display-sm` word and a `u-text-outline` word, separated by a small accent glyph.',
      'It fails as content: nothing a visitor needs to READ may live in a moving strip.',
    ],
  },
  'spotlight-feature': {
    id: 'spotlight-feature',
    modes: ['persuade', 'operate', 'experience'],
    images: ['subject'],
    card: [
      'One feature shown in the dark, lit by a light that follows the cursor.',
      'A dark `relative` section, `<Backdrop preset="spotlight">`, a `u-glass` panel reproducing the feature\'s own interface in miniature (or the subject image when one is listed), and a short heading with a `u-eyebrow`.',
      'It fails on a pale ground, where the light has nothing to be brighter than.',
    ],
  },
  'glow-metrics': {
    id: 'glow-metrics',
    modes: ['persuade', 'operate'],
    images: [],
    card: [
      'Three or four figures set as display type, each under a soft glow.',
      'A row of cells over `<Backdrop preset="grid">`; each number a `<CountUp>` inside a `u-display-sm u-text-gradient` element, its label a `u-eyebrow`, the cells separated by 1px lines and one of them `u-glow`.',
      'It fails with more than four figures, and with figures that are not real ones for this product.',
    ],
  },
  'cinematic-cta': {
    id: 'cinematic-cta',
    modes: ['persuade', 'experience'],
    images: ['backdrop'],
    card: [
      'The closing call to action as a scene of its own rather than a banner.',
      'A `relative` section with `<Backdrop preset="beams">` (or the listed backdrop image), a `u-display-sm` line, one primary action with `u-border-beam` and `u-sheen`, a quiet secondary link.',
      'It fails when it repeats the hero word for word, and when it offers more than one primary action.',
    ],
  },
  'ambient-shell': {
    id: 'ambient-shell',
    modes: ['operate'],
    images: ['backdrop', 'texture'],
    card: [
      'An application whose CHROME is expressive and whose data is not: sidebar and top bar float as glass over a quiet colour field.',
      'The page root is `relative` with `<Backdrop preset="mesh" veil={0.5}>` (low contrast), the sidebar and top bar are `u-glass`, and every panel holding data, tables, forms or charts sits on an OPAQUE surface with its own solid background.',
      'It fails the moment a table or a form is put on glass: data is read, not looked at, and a moving field under it costs every glance.',
    ],
  },
  'banner-panel': {
    id: 'banner-panel',
    modes: ['operate', 'read'],
    images: ['texture', 'backdrop', 'scene'],
    card: [
      'The one expressive panel of an app screen — a welcome header, a featured card, a plan upgrade.',
      'A rounded `relative overflow-hidden` panel with the listed image as an `object-cover` ground and a veil, the panel\'s heading in `u-display-sm`, one KPI or one action; the rest of the screen stays in the app\'s ordinary grammar.',
      'It fails as a pattern: one such panel per screen, never a grid of them.',
    ],
  },
  'illustrated-state': {
    id: 'illustrated-state',
    modes: ['operate', 'read'],
    images: ['subject'],
    card: [
      'An empty state, an onboarding step or a success screen carried by one floating object.',
      'The subject `<img>` centred, `u-float u-cutout`, over a soft halo, then a short heading and one action; nothing else competes with it.',
      'It fails when the object is bigger than the action it is meant to lead to.',
    ],
  },
  'editorial-read': {
    id: 'editorial-read',
    modes: ['read', 'experience'],
    images: ['scene', 'texture'],
    card: [
      'Long-form reading under a cinematic header, with pull-quotes as display type.',
      'A header image `object-cover u-kenburns` with the title over its veil, then a comfortable measure (`max-w-[68ch]`), a drop cap, pull-quotes in `u-display-sm u-text-gradient` that `u-reveal`, and a `u-glass` table of contents that is `sticky`.',
      'It fails when the reading column itself moves: animate the pull-quotes, never the paragraphs.',
    ],
  },
}

/** A recipe id, or null when the string is not one. */
export function asRecipeId(value: unknown): UltraRecipeId | null {
  return typeof value === 'string' && (ULTRA_RECIPE_IDS as readonly string[]).includes(value)
    ? (value as UltraRecipeId)
    : null
}

/**
 * Whether a recipe may be used on a surface at all.
 *
 * Everywhere, except on an APPLICATION screen, where only the recipes written
 * for one are allowed. The first real dashboard showed why a preference was
 * not enough: offered the whole catalogue, the storyboard stacked an editorial
 * section and a banner under the app shell, and the screen became a landing
 * page that listed the same orders twice — once in a table, once under a
 * display headline. On a page the visitor reads, a strong moment is the point;
 * on a screen the visitor works in, it is a second copy of the data.
 */
export function recipeAllowed(id: UltraRecipeId, mode?: ScreenMode): boolean {
  return mode !== 'operate' || ULTRA_RECIPES[id].modes.includes('operate')
}

/**
 * The catalogue as the storyboard prompt prints it.
 *
 * Recipes written for the requested surface come FIRST and are marked, the rest
 * follow — the model is steered, never fenced in, because "every kind of screen"
 * includes the settings page that genuinely wants a cinematic header.
 */
export function recipeCatalogue(mode?: ScreenMode): string {
  const all = ULTRA_RECIPE_IDS.map((id) => ULTRA_RECIPES[id]).filter((r) => recipeAllowed(r.id, mode))
  const fits = mode ? all.filter((r) => r.modes.includes(mode)) : all
  const rest = mode ? all.filter((r) => !r.modes.includes(mode)) : []
  const line = (r: UltraRecipe, preferred: boolean) =>
    `- ${r.id}${preferred ? ' (fits this surface)' : ''} — for: ${r.modes.join(', ')}. ${r.card[0]} Images: ${
      r.images.length ? r.images.join(' / ') : 'none'
    }. ${r.card[2]}`
  return [...fits.map((r) => line(r, !!mode)), ...rest.map((r) => line(r, false))].join('\n')
}
