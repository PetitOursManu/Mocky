/**
 * Motion Ultra's storyboard: one model call that decides the SECTIONS of a
 * screen, the recipe each one uses, and the pictures to generate for them —
 * before a picture or a line of code exists.
 *
 * Why a separate step rather than more words in the generation prompt: the
 * pictures have to be generated BEFORE the code, and they have to be generated
 * as a SERIES. A generation model asked to "use three images" invents three
 * unrelated subjects at the moment it writes the `<img>`, which is too late to
 * make them. The storyboard is where the subjects, their roles and the one
 * visual style they share are decided together.
 *
 * Two things are never the model's to decide:
 *  - HOW MANY pictures. The user pressed ×3 or ×6 and was shown the cost of
 *    that; a storyboard that returns five is padded or cut to the number asked
 *    for, never obeyed.
 *  - WHETHER the run proceeds. A failed or malformed storyboard degrades to a
 *    deterministic one built from the screen's mode (Q1's rule, here): the
 *    user asked for an Ultra screen, and "the planner answered in prose" is not
 *    a reason to hand back an ordinary one.
 */
import type { Settings } from '../settings'
import { proxyFetch } from '../proxy'
import { SCREEN_MODES, type ScreenMode } from '../plan'
import {
  ULTRA_IMAGE_ROLES,
  ULTRA_RECIPES,
  ULTRA_RECIPE_IDS,
  asRecipeId,
  recipeAllowed,
  recipeCatalogue,
  type UltraImageRole,
  type UltraRecipeId,
} from './recipes'

/** The two sizes the composer offers. Anything else is refused upstream. */
export type UltraImageCount = 3 | 6
export const ULTRA_IMAGE_COUNTS: UltraImageCount[] = [3, 6]

export interface UltraSection {
  /** The section's `id` in the page — the handle every later pass places by. */
  id: string
  recipe: UltraRecipeId
  /** What goes in it, in one sentence of real content. */
  content: string
}

export interface UltraImagePlan {
  /** The section this picture belongs to — always one of the storyboard's. */
  section: string
  role: UltraImageRole
  /** What the picture shows, without the shared style (that is added once). */
  subject: string
}

export interface UltraStoryboard {
  /**
   * What the visitor of this screen is here to do — decided by the storyboard,
   * which reads the whole request, rather than by `inferMode`'s keywords.
   *
   * The keyword guess is biased towards 'operate' on purpose (see plan.ts), and
   * that bias was harmless while a mode was only a paragraph of advice. Here it
   * decides which recipes are ALLOWED, and a product page with no "landing" in
   * its prompt came back as an app shell. The guess is still passed along, as a
   * hint the model may overrule, and it is what a storyboard that names no
   * valid mode falls back on.
   */
  mode: ScreenMode
  /** The ONE visual style every picture shares — light, palette, material. */
  style: string
  sections: UltraSection[]
  images: UltraImagePlan[]
  /** True when the model's answer was unusable and this was built instead. */
  fallback: boolean
}

/** Bounds, so a storyboard can never ask for a page nobody can generate. */
export const MAX_SECTIONS = 8
const MAX_STYLE = 300
const MAX_SUBJECT = 240
const MAX_CONTENT = 240

const STORYBOARD_SCHEMA = {
  type: 'object',
  properties: {
    mode: { type: 'string', enum: SCREEN_MODES },
    style: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          recipe: { type: 'string', enum: [...ULTRA_RECIPE_IDS] },
          content: { type: 'string' },
        },
        required: ['id', 'recipe', 'content'],
      },
    },
    images: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          section: { type: 'string' },
          role: { type: 'string', enum: ULTRA_IMAGE_ROLES },
          subject: { type: 'string' },
        },
        required: ['section', 'role', 'subject'],
      },
    },
  },
  required: ['mode', 'style', 'sections', 'images'],
}

export function buildStoryboardSystem(count: UltraImageCount, hint: ScreenMode, design?: string): string {
  const parts = [
    'You are the art director of a high-end, motion-led web page — the kind of page that wins awards for its opening seconds. PLAN one screen; do NOT write code.',
    'Respond with ONLY a JSON object matching the provided schema. No prose, no code fences.',
    '',
    'Fields:',
    `- mode: what the visitor of THIS screen is here to do, decided from the request. Exactly one of: "persuade" — they ${MODE_WORDS.persuade}; "operate" — they ${MODE_WORDS.operate}; "read" — they ${MODE_WORDS.read}; "experience" — they ${MODE_WORDS.experience}. A product page, a pricing page or a campaign is "persuade" even when it is full of facts. A keyword guess says "${hint}"; overrule it whenever the request says otherwise.`,
    `- sections: the screen's blocks, top to bottom, between 3 and ${MAX_SECTIONS}. Each has an \`id\` (lowercase, one word or two joined by a hyphen, naming what the block IS: "hero", "features", "pricing", "sidebar"…), a \`recipe\` chosen from the catalogue below, and \`content\`: one sentence of the REAL content it holds for this product (names, figures, promises) — never a description of the design.`,
    `- images: EXACTLY ${count} pictures to generate for this screen. Each names the \`section\` it belongs to (one of your ids), its \`role\`, and its \`subject\`: what the picture shows, concretely, in one sentence, WITHOUT style words — the style is given once, below.`,
    '  Roles: "backdrop" — an atmospheric ground with no subject, for text to sit on; "subject" — ONE isolated object on a plain ground, the hero of a section; "scene" — a photograph of a place, a person at work, a product in use; "texture" — a close-up of a material, abstract.',
    '  Give each picture to a section whose recipe lists that role. Spread them: the opening gets the strongest one, and no section gets more than two unless it is a mosaic.',
    '- style: ONE sentence every picture shares, so they read as a series from one shoot — the light, the palette, the material, the lens. Concrete ("soft studio light, deep violet and ice blue, matte ceramic, shallow depth of field"), never "modern" or "beautiful".',
    '',
    'Each recipe below says which modes it is written for ("for: …"). Prefer recipes written for your mode; on a page (persuade, read, experience) any recipe may be used where it genuinely serves the screen.',
    'If the mode is "operate", use ONLY recipes whose "for" includes operate — anything else is refused. It is then ONE application screen, not a page: the first section is the app shell (navigation + main area), and every other section is a PANEL inside that main area, never a page section stacked below it. Each panel shows DIFFERENT data; nothing is shown twice. Three or four sections is usually right.',
    'Motion Ultra is about the opening seconds and a few strong moments — not an effect on every block. Alternate expressive and quiet sections.',
    'Choose "glow-metrics" ONLY when the request states real figures, or the product has measurable facts worth showing (a battery life, a price, a count of customers). Never to restate qualities as numbers: "3 gestures, 1 material" is not a metric, it is a feature list set in large type.',
    '',
    'RECIPE CATALOGUE:',
    recipeCatalogue(),
  ]
  if (design) parts.push('', 'The project\'s art direction — the style sentence must agree with it:', design.slice(0, 4000))
  return parts.join('\n')
}

const MODE_WORDS: Record<ScreenMode, string> = {
  persuade: 'decide and act (a landing, a campaign, a pricing page)',
  operate: 'complete a task (an app, a dashboard, a form, settings) — keep the data calm, put the expression in the chrome and ONE panel',
  read: 'read and understand (docs, an article, a guide)',
  experience: 'are inside the work itself (a portfolio, a gallery, a showcase)',
}

function clip(s: unknown, max: number): string {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

/** A section id the page can use as a DOM id and a later pass can find. */
function slug(s: unknown): string {
  return clip(s, 40)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Validate a model's answer into a storyboard, or null when nothing usable is
 * left. Lenient about the details, strict about the contract:
 *  - an unknown recipe drops ITS section, not the storyboard;
 *  - duplicate or empty ids are renamed rather than refused;
 *  - pictures are cut or padded to exactly `count`;
 *  - a picture naming a section that does not exist goes to the first section
 *    whose recipe takes that role, and failing that to the opening.
 */
export function validateStoryboard(raw: unknown, count: UltraImageCount, hint: ScreenMode = 'persuade'): UltraStoryboard | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.sections)) return null
  const mode = SCREEN_MODES.includes(o.mode as ScreenMode) ? (o.mode as ScreenMode) : hint

  const used = new Set<string>()
  const sections: UltraSection[] = []
  for (const item of o.sections as unknown[]) {
    if (!item || typeof item !== 'object') continue
    const s = item as Record<string, unknown>
    const recipe = asRecipeId(s.recipe)
    if (!recipe || !recipeAllowed(recipe, mode)) continue
    let id = slug(s.id) || recipe.split('-')[0]
    const base = id
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`
    used.add(id)
    sections.push({ id, recipe, content: clip(s.content, MAX_CONTENT) })
    if (sections.length >= MAX_SECTIONS) break
  }
  if (!sections.length) return null

  const style = clip(o.style, MAX_STYLE) || DEFAULT_STYLE
  const images: UltraImagePlan[] = []
  for (const item of Array.isArray(o.images) ? (o.images as unknown[]) : []) {
    if (images.length >= count) break
    if (!item || typeof item !== 'object') continue
    const im = item as Record<string, unknown>
    const role = ULTRA_IMAGE_ROLES.includes(im.role as UltraImageRole) ? (im.role as UltraImageRole) : null
    const subject = clip(im.subject, MAX_SUBJECT)
    if (!role || !subject) continue
    images.push({ section: homeFor(slug(im.section), role, sections), role, subject })
  }
  padImages(images, count, sections)
  return { mode, style, sections, images, fallback: false }
}

function homeFor(wanted: string, role: UltraImageRole, sections: UltraSection[]): string {
  if (sections.some((s) => s.id === wanted)) return wanted
  return (sections.find((s) => ULTRA_RECIPES[s.recipe].images.includes(role)) ?? sections[0]).id
}

/**
 * Fill up to `count` with pictures the sections can actually use.
 *
 * Padded from the sections' own recipes, in page order and round-robin, so a
 * storyboard that asked for two pictures on a ×6 run gets four more placed
 * where a recipe wants them, not four more stacked on the hero.
 */
function padImages(images: UltraImagePlan[], count: number, sections: UltraSection[]): void {
  const wants = sections.flatMap((s) => ULTRA_RECIPES[s.recipe].images.map((role) => ({ section: s.id, role, content: s.content })))
  const pool = wants.length ? wants : [{ section: sections[0].id, role: 'backdrop' as UltraImageRole, content: sections[0].content }]
  let i = 0
  while (images.length < count) {
    const w = pool[i % pool.length]
    const taken = images.filter((im) => im.section === w.section && im.role === w.role).length
    images.push({
      section: w.section,
      role: w.role,
      subject: taken ? `${SUBJECT_FOR_ROLE[w.role]}, a different angle — for: ${w.content}` : `${SUBJECT_FOR_ROLE[w.role]} — for: ${w.content}`,
    })
    i++
  }
}

const SUBJECT_FOR_ROLE: Record<UltraImageRole, string> = {
  backdrop: 'An atmospheric abstract ground of light and colour',
  subject: 'One emblematic object of this product, isolated',
  scene: 'A photograph of the product in real use',
  texture: 'A close-up of a material that evokes this product',
}

const DEFAULT_STYLE =
  'Cinematic studio light, deep shadows with one saturated accent colour, soft volumetric haze, matte materials, shallow depth of field'

/** The storyboard every mode falls back to — deliberately conservative. */
const FALLBACK_SECTIONS: Record<ScreenMode, Array<[string, UltraRecipeId]>> = {
  persuade: [['hero', 'aurora-hero'], ['features', 'glass-cards'], ['story', 'parallax-band'], ['metrics', 'glow-metrics'], ['cta', 'cinematic-cta']],
  experience: [['hero', 'cinematic-hero'], ['work', 'image-mosaic'], ['statement', 'giant-type'], ['cta', 'cinematic-cta']],
  read: [['header', 'cinematic-hero'], ['article', 'editorial-read'], ['related', 'image-mosaic']],
  operate: [['shell', 'ambient-shell'], ['overview', 'banner-panel'], ['activity', 'glass-cards']],
}

/**
 * A storyboard built without a model, for when the model's answer is unusable.
 * The sections carry the request itself as their content, which is thin — the
 * generation step writes the real copy from the prompt anyway.
 */
export function fallbackStoryboard(prompt: string, count: UltraImageCount, mode: ScreenMode): UltraStoryboard {
  const about = clip(prompt, MAX_CONTENT)
  const sections = FALLBACK_SECTIONS[mode].map(([id, recipe]) => ({ id, recipe, content: about }))
  const images: UltraImagePlan[] = []
  padImages(images, count, sections)
  return { mode, style: DEFAULT_STYLE, sections, images, fallback: true }
}

const STORYBOARD_TIMEOUT_MS = 45_000

/**
 * Ask for a storyboard. Never throws except on the user's own cancel: any other
 * failure — network, timeout, prose instead of JSON, a shape with nothing
 * usable in it — returns the fallback storyboard.
 */
export async function runStoryboard(
  s: Settings,
  prompt: string,
  count: UltraImageCount,
  mode: ScreenMode,
  opts: { design?: string; presetHint?: string; signal?: AbortSignal } = {},
): Promise<UltraStoryboard> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), STORYBOARD_TIMEOUT_MS)
  const onAbort = () => ctrl.abort()
  opts.signal?.addEventListener('abort', onAbort)
  try {
    const system = buildStoryboardSystem(count, mode, opts.design)
    const user = opts.presetHint ? `${prompt}\n\nTarget form factor: ${opts.presetHint}` : prompt
    const res = await proxyFetch(s, '/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        model: s.model,
        stream: false,
        format: STORYBOARD_SCHEMA,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        // num_predict MUST stay positive (I8).
        options: { temperature: 0.6, num_ctx: 16384, num_predict: 3072 },
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) return fallbackStoryboard(prompt, count, mode)
    const data = (await res.json()) as { message?: { content?: string }; choices?: Array<{ message?: { content?: string } }> }
    const content = data.message?.content ?? data.choices?.[0]?.message?.content ?? ''
    return validateStoryboard(parseJsonObject(content), count, mode) ?? fallbackStoryboard(prompt, count, mode)
  } catch (err) {
    if (opts.signal?.aborted) throw err
    return fallbackStoryboard(prompt, count, mode)
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * The JSON object in an answer, fenced or not.
 *
 * Structured output is requested, and a provider that ignores `format` still
 * answers — usually in a ```json fence with a sentence before it. Taking the
 * outermost braces is enough to recover that without guessing at anything else.
 */
export function parseJsonObject(content: string): unknown {
  const text = (content || '').trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    const a = text.indexOf('{')
    const b = text.lastIndexOf('}')
    if (a < 0 || b <= a) return null
    try {
      return JSON.parse(text.slice(a, b + 1))
    } catch {
      return null
    }
  }
}
