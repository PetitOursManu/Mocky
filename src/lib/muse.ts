// Frontend Muse client. Talks to the backend Inspiration Engine (Phase 3) and
// image service (Phase 2), and turns a Design Dossier into the `extraSystem`
// preamble the existing generation path already consumes (exactly where
// DESIGN.md goes — so Muse OFF changes nothing, M1).
//
// Provider credentials are read from the browser Settings and sent per request
// via the same headers the /__provider proxy uses (ADR D7) — never stored server
// side.
import { loadSettings } from './settings'

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
}

const STORAGE_KEY = 'mocky.muse.v1'

export function defaultMuseConfig(): MuseConfig {
  return { enabled: false, urls: '', useFetch: false, imageMode: 'content' }
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
  opts: { urls?: string[]; useFetch?: boolean; projectName?: string; signal?: AbortSignal } = {},
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
    const promptText = slot.prompt || slot.subject
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
): string {
  const lines = [
    'The following DESIGN DOSSIER is AUTHORITATIVE for this screen. Follow its concept, tokens (colors/radius/typography), layout grammar, motion language, and — critically — its VOICE & COPY VERBATIM: use the real headline, subheadline, value props, CTA labels and footer it provides. NEVER invent placeholder/generic copy. Respect the Forbidden list exactly.',
    '',
    '<DESIGN_DOSSIER>',
    markdown.trim(),
    '</DESIGN_DOSSIER>',
  ]
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
