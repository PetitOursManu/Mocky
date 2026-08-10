// Frontend Muse client. Talks to the backend Inspiration Engine (Phase 3) and
// image service (Phase 2), and turns a Design Dossier into the `extraSystem`
// preamble the existing generation path already consumes (exactly where
// DESIGN.md goes — so Muse OFF changes nothing, M1).
//
// Provider credentials are read from the browser Settings and sent per request
// via the same headers the /__provider proxy uses (ADR D7) — never stored server
// side.
import { loadSettings } from './settings'
import { extractPalette } from './palette'
import { extractProductName } from './design'
import type { PinnedVideo } from './videoLibrary'

export interface MuseImagerySlot {
  id: string
  slot?: string
  subject?: string
  style?: string
  lighting?: string
  aspectRatio?: string
  negative?: string
  prompt?: string
}
export interface MuseDossier {
  concept: string
  references?: { sourceUrl?: string; note?: string }[]
  tokens?: {
    colors?: { label: string; hex: string; role?: string }[]
    typography?: { display?: string; body?: string; scaleFeel?: string }
    radius?: string
  }
  layoutGrammar?: string[]
  motionLanguage?: { name: string; description?: string }[]
  voice?: {
    tone?: string
    headline?: string
    subheadline?: string
    valueProps?: string[]
    ctaLabels?: string[]
    footer?: string
  }
  imageryPlan?: MuseImagerySlot[]
  forbidden?: string[]
}
export interface MuseResult {
  dossier: MuseDossier
  markdown: string
  cards: unknown[]
  sources: { id: string; url: string }[]
  patterns: { id: string; name: string }[]
  notices: string[]
  source: 'llm' | 'fallback'
}

/**
 * What the generated image is FOR.
 *  - 'content'     — it is placed in the screen as a real <img> (hero photo…).
 *                    Works with any model; no vision needed.
 *  - 'inspiration' — it is NOT placed in the screen; it is handed to the model
 *                    as an art-direction reference to design from. Requires a
 *                    vision-capable model.
 */
/**
 *  - 'both' — the SAME generated image is shown to the model (so it designs
 *    around its palette and composition) AND embedded in the screen. Costs one
 *    image, needs vision.
 */
export type MuseImageMode = 'content' | 'inspiration' | 'both'

export interface MuseConfig {
  /** ✨ toggle state. */
  enabled: boolean
  /** Optional inspiration URLs, one per line. */
  urls: string
  /** Fetch live inspiration (spawns the fetcher MCP / Playwright). Off by default. */
  useFetch: boolean
  /** How the generated image is used. */
  imageMode: MuseImageMode
  /**
   * Also generate a clip for the hero and drive it from the scroll.
   *
   * Off by default and asked for explicitly every time, because unlike every
   * other Muse option this one has a per-use price and adds minutes to a
   * generation. Nobody should discover it by leaving a box ticked.
   */
  video: boolean
  /**
   * A sequence chosen from the Media library, to be used INSTEAD of generating
   * one. At most one, because a screen has one hero.
   *
   * It lives in the Muse config rather than in the project view for two
   * reasons: it survives a reload, and it can be chosen from the standalone
   * Media page, which knows about no project at all. Choosing one implies
   * `video: true` — picking a sequence is a clearer statement of intent than
   * the checkbox it would otherwise contradict.
   */
  videoPin: MuseVideoPin | null
  /**
   * Also cut a Motion film for this screen, from the dossier that was just
   * written.
   *
   * Off by default and asked for explicitly, for the reason `video` above it is:
   * it spends a model call and a render, and it adds a wait a person who ticked
   * a box at project creation has no reason to expect. Nobody should discover it
   * by leaving a box ticked.
   *
   * What it is NOT is a way of putting a film inside the mockup. The preview
   * iframe is sandboxed to an opaque origin and its CSP has no `media-src`, so
   * an `.mp4` cannot be played in it and the authenticated route that serves one
   * would answer 403 to it anyway. The film is attached to the SCREEN
   * (`AttachedMedia`) and drawn on the canvas beside the frame, which is what
   * `docs/video-export.md` says and what the interface already does.
   */
  motion: boolean
  /**
   * What the film is FOR — a hero, a background, a globe.
   *
   * A plain string and not a union, deliberately: the enum lives in
   * `server/video/kinds.js` and travels on `GET /api/video/status`, so a copy
   * here would be the sixth hand-kept mirror in a feature that has been bitten
   * by five. An id this build no longer offers is read as "no kind" by the
   * panel — the selector falls back to its first entry rather than showing a
   * blank — and `/compose` refuses it by name if it ever reaches the server.
   */
  motionKind: string
}

/**
 * Everything the preview needs to play a chosen sequence, and a label to show.
 * Aliased rather than redeclared: the library module owns the shape, and two
 * copies of it would drift the first time one gained a field.
 */
export type MuseVideoPin = PinnedVideo

const STORAGE_KEY = 'mocky.muse.v1'

export function defaultMuseConfig(): MuseConfig {
  return {
    enabled: false,
    urls: '',
    useFetch: false,
    imageMode: 'content',
    video: false,
    videoPin: null,
    motion: false,
    // 'hero' rather than '' so a saved config from before this field parses to a
    // usable selector instead of an empty one. `loadMuseConfig` spreads the
    // defaults under the stored object, which is what makes that true.
    motionKind: 'hero',
  }
}

/** What the backend says about the scroll-video feature being usable at all. */
export interface MuseVideoAvailability {
  available: boolean
  provider: string
  model: string
  ffmpeg: { available: boolean; version?: string; reason?: string }
  /** null when available; otherwise which of the two prerequisites is missing. */
  reason: 'no-provider' | 'no-key' | 'no-ffmpeg' | null
}

/**
 * Can a scroll sequence be produced right now?
 *
 * Two independent prerequisites — a configured video provider and ffmpeg in the
 * container — and the answer names which one is missing, because they are fixed
 * in completely different places.
 */
export async function checkVideoAvailability(signal?: AbortSignal): Promise<MuseVideoAvailability | null> {
  try {
    const res = await fetch('/api/videos/availability', { signal })
    if (!res.ok) return null
    return (await res.json()) as MuseVideoAvailability
  } catch {
    // Backend absent (frontend-only mode): the option simply never appears.
    return null
  }
}

/** A scroll sequence the server has cut and is ready to serve. */
export interface GeneratedVideo {
  hash: string
  /** Base URL: frames live at `${base}/f/1.jpg` … and the poster at `${base}/poster.jpg`. */
  base: string
  poster: string
  frames: number
  fromCache: boolean
}

/**
 * Generate (or reuse) the hero's scroll sequence.
 *
 * Deliberately NOT best-effort like the images are. An image that fails leaves
 * a screen with one picture missing; a video that fails leaves a screen built
 * around a component with nothing to play. The caller decides what to do, and
 * currently degrades to a still image.
 */
export async function generateScrollVideo(
  prompt: string,
  project: string,
  opts: { negative?: string; slot?: string; signal?: AbortSignal } = {},
): Promise<GeneratedVideo> {
  const res = await fetch('/api/videos/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, negative: opts.negative, slot: opts.slot || 'hero', project }),
    signal: opts.signal,
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(j?.error ? String(j.error) : `Génération vidéo échouée (HTTP ${res.status})`)
  }
  return {
    hash: String(j.hash),
    base: absoluteUrl(String(j.base)),
    poster: absoluteUrl(String(j.poster)),
    frames: Number(j.frames) || 0,
    fromCache: Boolean(j.fromCache),
  }
}

/**
 * Turn the hero's still-image prompt into a shot description.
 *
 * A prompt written for a photograph asks for a composition; a video model reads
 * the same words and, given no direction, either holds a static frame for four
 * seconds or invents a camera move that fights the layout. Naming a slow,
 * single-axis move is what makes the clip usable as a scroll sequence: it has
 * to read as one continuous gesture from first frame to last, because the
 * visitor controls where in it they are.
 */
export function buildVideoPrompt(imagePrompt: string): string {
  const base = String(imagePrompt || '').trim().replace(/\s+/g, ' ')
  return [
    base,
    'Cinematic: ONE slow continuous camera move (a gentle push-in or a steady lateral drift), constant speed, no cuts, no scene change, no camera shake.',
    'The subject stays in frame throughout. Even, unchanging lighting.',
    'No text, no letters, no watermark, no logo, no user interface.',
  ]
    .filter(Boolean)
    .join(' ')
}

/** What Muse is told about the user's own picture or clip. */
export interface MuseUserMedia {
  kind: 'image' | 'video'
  swatches: { hex: string; weight: number }[]
  accent: string | null
  /** The picture itself, only when the model can actually look at it. */
  image?: string
}

/**
 * Describe the selected media for the dossier stage.
 *
 * Two channels, because they answer different questions and fail differently:
 *
 *  - the PALETTE is measured from the pixels. It works on every model, it is
 *    exact, and it is what stops the page from disagreeing with its own hero.
 *  - the PICTURE is attached only when the model has vision. It carries what a
 *    histogram cannot — subject, composition, density, light.
 *
 * A failure anywhere here returns null and Muse runs exactly as it did before;
 * this is an enrichment, never a prerequisite.
 *
 * @param source  a library image URL, or a video poster URL
 */
export async function describeUserMedia(
  source: string,
  kind: 'image' | 'video',
  opts: { vision?: boolean | null; signal?: AbortSignal } = {},
): Promise<MuseUserMedia | null> {
  try {
    const { swatches, accent } = await extractPalette(source)
    if (!swatches.length) return null
    const media: MuseUserMedia = { kind, swatches, accent }
    if (opts.vision === true) {
      const dataUrl = await imageAsDataUrl(source, opts.signal)
      // The sanitizer on the server accepts jpeg/png/webp data URLs only, and
      // caps the size; anything else is simply left out rather than rejected.
      if (dataUrl && /^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) media.image = dataUrl
    }
    return media
  } catch {
    return null
  }
}

/**
 * Does the active text model accept images? Needed before the 'inspiration'
 * mode can work. The backend probes the model once and caches the answer.
 */
export async function checkVision(signal?: AbortSignal): Promise<{ vision: boolean; model?: string; error?: string }> {
  const s = loadSettings()
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (s.baseUrl) headers['x-provider-base'] = s.baseUrl
  if (s.apiKey.trim()) headers['authorization'] = `Bearer ${s.apiKey.trim()}`
  try {
    const res = await fetch('/api/text/vision', {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: s.model }),
      signal,
    })
    if (!res.ok) return { vision: false, error: `HTTP ${res.status}` }
    return await res.json()
  } catch (err) {
    return { vision: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Read a Mocky-served image back as a base64 data URL, so it can be attached to
 * the generation request as a vision reference (same shape the screenshot
 * annotations already use). Same-origin, so no CORS issue.
 */
export async function imageAsDataUrl(url: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export function loadMuseConfig(): MuseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultMuseConfig()
    return { ...defaultMuseConfig(), ...(JSON.parse(raw) as Partial<MuseConfig>) }
  } catch {
    return defaultMuseConfig()
  }
}

export function saveMuseConfig(c: MuseConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
  } catch {
    /* ignore */
  }
}

/**
 * Choose — or clear — the sequence Muse uses for the hero.
 *
 * Usable from anywhere, including the standalone Media page, which has no
 * project and no Muse panel in scope. Choosing one also turns the scroll-video
 * option on: the user has just pointed at a specific clip, and leaving the
 * feature switched off would silently ignore them.
 */
export function setMuseVideoPin(pin: MuseVideoPin | null): MuseConfig {
  const current = loadMuseConfig()
  const next: MuseConfig = { ...current, videoPin: pin, video: pin ? true : current.video }
  saveMuseConfig(next)
  return next
}

/** Muse needs the backend. In pure-localStorage mode it's unavailable. */
export async function museAvailable(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch('/api/mcp/status', { signal })
    return res.ok
  } catch {
    return false
  }
}

/** Turn a "/api/images/:hash" path into an absolute, Mocky-origin URL (M6). */
export function absoluteUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${window.location.origin}${path}`
}

/** Parse the URL textarea into a clean list. */
export function parseUrls(text: string): string[] {
  return (text || '')
    .split(/\s+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u))
}

/** Run Discover → Distill → Dossier for a prompt. Throws on transport/HTTP error. */
export async function runMuseDossier(
  prompt: string,
  opts: {
    urls?: string[]
    useFetch?: boolean
    projectName?: string
    /** The user's own picture or clip, so the dossier is written around it. */
    userMedia?: MuseUserMedia | null
    signal?: AbortSignal
  } = {},
): Promise<MuseResult> {
  const s = loadSettings()
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (s.baseUrl) headers['x-provider-base'] = s.baseUrl
  if (s.apiKey.trim()) headers['authorization'] = `Bearer ${s.apiKey.trim()}`
  const res = await fetch('/api/muse/dossier', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt,
      urls: opts.urls || [],
      useFetch: opts.useFetch === true,
      model: s.model,
      projectName: opts.projectName,
      userMedia: opts.userMedia,
    }),
    signal: opts.signal,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Muse failed (HTTP ${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`)
  }
  return (await res.json()) as MuseResult
}

export interface GeneratedSlotImage {
  slot: string
  id: string
  url: string
}

/**
 * Which image model generates a slot. The two jobs need different models:
 *  - 'inspiration' — the art-direction reference the model looks at. It must
 *    render a convincing site/app layout, so it's worth a stronger, slower one.
 *  - 'content' — hero/product/background pictures embedded in the screen. There
 *    can be several per screen, so fast and cheap wins.
 */
export type MuseImageProfile = 'content' | 'inspiration'

/** The image model to use for a given Muse image mode. In 'both' the image is
 *  embedded in the screen as real content, so it's a content image. */
export function profileForMode(mode: MuseImageMode): MuseImageProfile {
  return mode === 'inspiration' ? 'inspiration' : 'content'
}

/**
 * The prompt for an ART-DIRECTION reference image.
 *
 * An inspiration image used to be generated from the imagery plan's own prompt —
 * exactly the same photographic subject as the hero, only routed to a different
 * model. That is not an art-direction reference, it is a second hero photo, and
 * it explains why turning "Inspiration" on so often changed nothing about the
 * result: the model was handed a picture of the product and told to read its
 * palette and composition from it.
 *
 * A reference plate is a different object entirely: no subject, no narrative,
 * just the palette, the material and the light. Colours come from the dossier's
 * own tokens, so the model sees the palette it is being asked to design with.
 */
export function buildInspirationPrompt(dossier: MuseDossier): string {
  const colors = (dossier.tokens?.colors || []).slice(0, 5)
  const palette = colors.length
    ? colors.map((c) => `${c.label} ${c.hex}`).join(', ')
    : 'a restrained, coherent palette'
  const style = dossier.imageryPlan?.[0]?.style || 'editorial'
  const concept = (dossier.concept || '').split(/[.;]/)[0]?.trim()

  return [
    'An abstract art-direction reference plate.',
    concept ? `Mood: ${concept}.` : '',
    `Colour palette, used faithfully: ${palette}.`,
    `Feel: ${style}.`,
    'Composition: large flat colour fields, generous negative space, one clear focal area, a subtle paper or fabric texture, soft directional light.',
    'It is a MOOD BOARD PLATE, not a picture of a product: no people, no objects, no scene, no story.',
    'high quality, no text, no letters, no words, no logo, no user interface, no website, no app screen, no mockup, no charts, no icons',
  ]
    .filter(Boolean)
    .join(' ')
}

/** The negative prompt that goes with an art-direction plate. */
export const INSPIRATION_NEGATIVE =
  'text, letters, words, watermark, logo, user interface, website, app screen, dashboard, mockup, screenshot, browser window, charts, icons, buttons, people, faces, product photography'

/** Generate the imagery-plan images (capped) and return their absolute URLs. */
export async function generateSlotImages(
  slots: MuseImagerySlot[],
  project: string,
  opts: {
    max?: number
    signal?: AbortSignal
    /** Which image model to run. Defaults to the content one. */
    profile?: MuseImageProfile
    onImage?: (img: GeneratedSlotImage) => void
    /** Called with a human-readable reason when a slot fails (provider down,
     *  bad model id, quota…). Image failures never block generation, but the
     *  user deserves to know why a slot stayed empty. */
    onError?: (message: string) => void
  } = {},
): Promise<GeneratedSlotImage[]> {
  const max = opts.max ?? 1 // Pollinations is rate-limited (~1/15s); default to the hero only.
  const out: GeneratedSlotImage[] = []
  for (const slot of (slots || []).slice(0, max)) {
    /**
     * Trimmed, because the server's idea of "empty" is not JavaScript's.
     *
     * The route rejects `!String(prompt).trim()` with a 400, while this guard
     * was a plain truthiness test — and `"  "` is truthy. A slot whose subject
     * came back as whitespace therefore sailed past here and was refused there,
     * which surfaced as a bare `POST /api/images/generate 400` in the console
     * and a screen with no picture in it, with nothing anywhere saying why.
     *
     * A blank subject is not exotic: it is what a dossier looks like when the
     * model ran out of output tokens mid-JSON, which is exactly when this was
     * seen.
     */
    const promptText = String(slot.prompt || slot.subject || '').trim()
    if (!promptText) continue
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          negative: slot.negative,
          tags: [slot.slot || 'image', opts.profile || 'content'].filter(Boolean),
          slotType: slot.slot,
          profile: opts.profile || 'content',
          project,
        }),
        signal: opts.signal,
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        // The backend puts the provider's real reason in `error` — surface it
        // instead of leaving the user with an opaque 502 in the console.
        opts.onError?.(j?.error ? String(j.error) : `Génération d'image échouée (HTTP ${res.status})`)
        continue
      }
      if (j.skipped || !j.url) continue
      const img = { slot: slot.slot || slot.id, id: slot.id, url: absoluteUrl(j.url) }
      out.push(img)
      opts.onImage?.(img)
    } catch (err) {
      // Best-effort: a failed image never blocks generation.
      if (err instanceof Error && err.name === 'AbortError') throw err
      opts.onError?.(err instanceof Error ? err.message : String(err))
    }
  }
  return out
}

/**
 * Build the generation preamble from a dossier + any generated images. Goes into
 * `extraSystem`, exactly where DESIGN.md goes. The dossier is a DESIGN.md
 * superset, so its tokens drive the palette; its Voice & Copy drive the text.
 */
export function buildMusePreamble(
  markdown: string,
  images: GeneratedSlotImage[] = [],
  mode: MuseImageMode = 'content',
  dossier?: MuseDossier,
  video?: GeneratedVideo | null,
): string {
  const lines = [
    'The following DESIGN DOSSIER is AUTHORITATIVE for this screen. Follow its concept, tokens (colors/radius/typography), layout grammar, motion language, and — critically — its VOICE & COPY VERBATIM: use the real headline, subheadline, value props, CTA labels and footer it provides. NEVER invent placeholder/generic copy. Respect the Forbidden list exactly.',
    '',
    '<DESIGN_DOSSIER>',
    markdown.trim(),
    '</DESIGN_DOSSIER>',
  ]

  /*
   * The name, restated outside the document.
   *
   * It is already in the dossier's `## Product` section, and that was not
   * enough: the model reads the whole block as art direction and treats a bare
   * name as one more note, so screens still shipped whatever wordmark suited
   * the moment. Naming it as an instruction — and saying WHERE it has to
   * appear — is the difference between a fact the model has and a fact the
   * model uses. This is the same job buildIdentityReference does from a
   * reference screen, done from the direction instead, so it works on the very
   * first screen of a project rather than only on the second.
   */
  const productName = extractProductName(markdown)
  if (productName) {
    lines.push(
      '',
      `PRODUCT NAME — this product is called "${productName}". Use exactly that spelling and casing wherever the product is named: the header wordmark, the page copy, the footer. Do not invent another name, and do not translate it.`,
    )
  }

  /*
   * The palette, restated as classes the model can paste.
   *
   * The dossier already lists its colours — as hex values, in prose, inside a
   * long markdown block. Two things then went wrong every time: the base rules
   * named concrete Tailwind families ("slate/indigo/emerald/amber/rose"), which
   * is a far more actionable instruction than a list of hexes, and nothing ever
   * said HOW to apply a hex with Tailwind. So the model quietly fell back on
   * indigo-and-slate and the screens ignored the art direction.
   *
   * Naming the exact classes removes both problems: there is nothing left to
   * translate, and the instruction is now more concrete than the one it has to
   * beat.
   */
  const colors = (dossier?.tokens?.colors || []).filter((c) => /^#[0-9a-f]{3,8}$/i.test(c.hex || ''))
  if (colors.length) {
    lines.push(
      '',
      'PALETTE — NON-NEGOTIABLE. These are the only colours this screen may use. Apply them with Tailwind arbitrary values, exactly as written; do NOT substitute a named Tailwind shade that looks close.',
    )
    for (const c of colors) {
      lines.push(`- ${c.label}${c.role ? ` (${c.role})` : ''}: ${c.hex} → bg-[${c.hex}] · text-[${c.hex}] · border-[${c.hex}]`)
    }
    lines.push(
      'Neutrals (white, black, and greys you need for text contrast) are allowed on top of these. Everything else is not.',
    )
  }

  const radius = dossier?.tokens?.radius
  if (radius) {
    lines.push(
      '',
      `RADIUS — use \`${radius}\` as the corner treatment throughout, including when it means square corners. Do not soften it.`,
    )
  }
  /*
   * The scroll sequence.
   *
   * Stated before the images and in stronger terms, because it decides the
   * SHAPE of the screen rather than filling a slot in it: the hero stops being
   * a block with a picture in it and becomes a pinned section the visitor
   * scrolls through. A model told about it in passing writes a normal hero and
   * drops <ScrollSequence> somewhere below the fold, which is the one place the
   * effect cannot work.
   */
  if (video && video.frames > 0) {
    lines.push(
      '',
      'SCROLL SEQUENCE — a video has been generated for this screen and cut into frames. It MUST be the hero, and it MUST be the FIRST element the visitor sees.',
      `Use the predefined <ScrollSequence> component EXACTLY like this, at the very top of the page:`,
      '',
      `<ScrollSequence base="${video.base}" frames={${video.frames}} height={300}>`,
      '  {/* headline + subheadline + CTA go here, overlaid on the clip */}',
      '</ScrollSequence>',
      '',
      'Rules: do NOT wrap it in a container with a fixed height, do NOT put it inside a section that already scrolls, and do NOT add an <img> or a <video> for the hero — the component draws the frames itself. `base` and `frames` are exactly the values above; changing either breaks it.',
      'The overlaid children are centred and do not receive pointer events, so put the CTA button after the component if it must be clickable.',
      'Everything else on the page follows the sequence, as normal sections.',
    )
  }

  const embeds = mode === 'content' || mode === 'both'
  if (images.length && embeds) {
    lines.push(
      '',
      'GENERATED IMAGERY — these images are served by THIS app. For the matching visual slots you MUST use an <img> tag with the EXACT absolute URL below (this overrides the general rule against external images — ONLY these listed URLs are allowed, and never add a crossorigin attribute):',
    )
    for (const im of images) lines.push(`- slot "${im.slot}": <img src="${im.url}" alt="" className="..." />`)
  }
  if (images.length && mode === 'inspiration') {
    lines.push(
      '',
      'VISUAL REFERENCE — an image is attached to this request. It is MOOD/ART-DIRECTION ONLY: read its palette, lighting, composition and overall feel, and let them guide the colors, spacing and atmosphere of the screen you write.',
      'Do NOT embed it, do NOT reference its URL, and do NOT describe it as the product. It is not content — it is a style reference.',
    )
  }
  if (images.length && mode === 'both') {
    lines.push(
      '',
      'You can SEE the attached image — it is the very image you are embedding above. Design the surrounding screen around it: pull your accent colors from it, leave it room to breathe, and match the layout to its composition and orientation.',
    )
  }
  return lines.join('\n')
}
