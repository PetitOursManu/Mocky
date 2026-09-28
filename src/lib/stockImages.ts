/**
 * Free stock photos (Pexels, Pixabay) as an alternative to GENERATED pictures.
 *
 * Two uses, one server module (`server/images/stock.js`):
 *
 *  - by hand, in Media: search, look, import — the photo lands in the image
 *    library like an upload, with its author's credit, and can be pinned for a
 *    screen like any other picture;
 *  - by the generation, when the composer says "Images: free": Muse's hero and
 *    a Motion Ultra series are FOUND instead of generated. Same slots, same
 *    library, same absolute URLs in the prompt — only the source changes, so
 *    everything downstream (the preamble, the vision reference, the canvas
 *    card, Ultra's recipes) works unchanged.
 *
 * HOW A PHOTO IS CHOSEN, AND WHY IT TOOK TWO TRIES
 *
 * The first version chose on words alone: keywords cut out of the image prompt,
 * a random draw among the first results, and — to make a series hang together —
 * a colour filter. On a space-exploration page it came back with a gas mask and
 * a golden sphere. Nothing was LOOKING at the photos, and a wrong photo is worse
 * than a missing one: the generation then spends a whole page building around it.
 *
 * So now three steps, each doing what it is good at:
 *  1. the MODEL that planned the picture writes the search (`query` on a Motion
 *     Ultra picture, `searchQuery` on a Muse slot): two to four English words a
 *     library understands. `stockQuery` is only the fallback for a plan that
 *     has none.
 *  2. the server returns a handful of THUMBNAILS for that search.
 *  3. a vision model looks at them, with the subject, its role on the page and
 *    the photos already chosen for the series, and picks one — or none, and the
 *    slot is left to the page rather than filled with something absurd.
 *    Coherence comes from that last look, not from a filter.
 *
 * One vision call on ~350 px thumbnails per picture: a fraction of what one
 * generated image costs. A model without vision skips step 3 and takes the
 * search engine's first result, which is the best judgement available blind.
 */
import { absoluteUrl, type GeneratedSlotImage, type MuseImagerySlot } from './muse'
import { stripDataUrl } from './generate'
import { proxyFetch } from './proxy'
import type { Settings } from './settings'
import { STOCK_LABELS, STOCK_PROVIDERS, type StockCredit, type StockProvider } from './videoLibrary'

export { STOCK_LABELS, STOCK_PROVIDERS }
export type { StockProvider }

/** Where the pictures of a generation come from. */
export type ImageSource = 'ai' | 'stock'

export type StockOrientation = 'landscape' | 'portrait' | 'square'

/** One search result. The thumbnail is the library's own; nothing is stored. */
export interface StockPhoto {
  provider: StockProvider
  id: string
  title: string
  thumbnail: string
  width: number
  height: number
  author: string
  authorUrl: string
  pageUrl: string
}

/** A search result with its thumbnail already fetched, for a model to look at. */
export interface StockCandidate extends StockPhoto {
  /** `data:image/…;base64,…` */
  thumb: string
}

export interface StockImageStatus {
  /** Libraries this ACCOUNT can use: a key exists and the admin allows it. */
  providers: Record<StockProvider, boolean>
  allowed: boolean
}

/** At least one library answers for this account. */
export function stockUsable(s: StockImageStatus | null | undefined): boolean {
  return !!s && s.allowed && STOCK_PROVIDERS.some((p) => s.providers?.[p])
}

export async function stockImageStatus(signal?: AbortSignal): Promise<StockImageStatus> {
  try {
    const res = await fetch('/api/images/stock/status', { signal })
    if (!res.ok) return { providers: { pexels: false, pixabay: false }, allowed: false }
    return res.json()
  } catch {
    return { providers: { pexels: false, pixabay: false }, allowed: false }
  }
}

export async function searchStockImages(
  provider: StockProvider,
  q: string,
  page = 1,
  signal?: AbortSignal,
): Promise<{ results: StockPhoto[]; page: number; hasMore: boolean }> {
  const p = new URLSearchParams({ provider, q, page: String(page) })
  const res = await fetch(`/api/images/stock/search?${p}`, { signal })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error ? String(j.error) : `Search HTTP ${res.status}`)
  return { results: j.results || [], page: Number(j.page) || page, hasMore: Boolean(j.hasMore) }
}

async function postJson(url: string, body: unknown, signal?: AbortSignal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error ? String(j.error) : `Stock photo HTTP ${res.status}`)
  return j
}

/** Import one photo — chosen by a person in Media, or by the vision model. */
export async function importStockImage(
  provider: StockProvider,
  id: string,
  opts: { project?: string; tags?: string[]; ultra?: number; signal?: AbortSignal } = {},
): Promise<{ hash: string; url: string; credit: StockCredit | null }> {
  const j = await postJson(
    '/api/images/stock/import',
    { provider, id, project: opts.project || '', tags: opts.tags || [], ...(opts.ultra ? { ultra: opts.ultra } : {}) },
    opts.signal,
  )
  return { hash: String(j.hash), url: String(j.url), credit: j.meta?.credit || null }
}

/** Thumbnails for a search, to be looked at before anything is stored. */
export async function fetchStockCandidates(
  query: string,
  opts: { orientation?: StockOrientation; exclude?: string[]; count?: number; signal?: AbortSignal } = {},
): Promise<{ query: string | null; candidates: StockCandidate[] }> {
  const j = await postJson(
    '/api/images/stock/candidates',
    { query, orientation: opts.orientation, exclude: opts.exclude || [], count: opts.count },
    opts.signal,
  )
  return { query: j.query ?? null, candidates: Array.isArray(j.candidates) ? j.candidates : [] }
}

export interface PickedStockImage {
  hash: string
  /** Absolute — the preview iframe has an opaque origin (M6). */
  url: string
  /** `provider:id`, to keep a series from showing one photo twice. */
  stockId: string
  credit: StockCredit | null
}

/**
 * The blind pick, for a model without vision: the server takes the first
 * result of the best query and stores it. Null when nothing matched.
 */
export async function pickStockImage(
  query: string,
  opts: {
    project?: string
    orientation?: StockOrientation
    exclude?: string[]
    tags?: string[]
    /** The Motion Ultra series size, checked by the server like a generation. */
    ultra?: number
    signal?: AbortSignal
  } = {},
): Promise<PickedStockImage | null> {
  if (!query.trim()) return null
  const j = await postJson(
    '/api/images/stock/pick',
    {
      query,
      orientation: opts.orientation,
      exclude: opts.exclude || [],
      project: opts.project || '',
      tags: opts.tags || [],
      ...(opts.ultra ? { ultra: opts.ultra } : {}),
    },
    opts.signal,
  )
  if (!j.found) return null
  return { hash: String(j.hash), url: absoluteUrl(String(j.url)), stockId: String(j.stockId || ''), credit: j.credit || null }
}

/**
 * Words that describe how a picture is MADE, not what it shows. They are what
 * an image prompt is full of and what a stock search must not be given: a
 * photo tagged "cinematic" is not more likely to be a lighthouse.
 */
const NOT_A_SUBJECT = new Set(
  (
    // articles and prepositions, English and French
    'a an the of with and or in on at for to from by into over under near its their his her this that ' +
    'un une le la les des du de d l et ou avec sur sous dans pour par au aux en ' +
    // the photograph itself
    'photo photos photograph photography photographic image picture shot still render rendering illustration ' +
    'cinematic editorial realistic hyperrealistic photorealistic detailed high quality resolution 4k 8k hd sharp ' +
    'wide closeup close-up macro portrait landscape view angle composition framing frame style aesthetic ' +
    'soft hard natural dramatic studio lighting lit light shadows mood moody atmosphere atmospheric ' +
    'background backdrop plate isolated centred centered seamless plain minimal minimalist ' +
    'beautiful stunning elegant modern premium luxury professional clean subtle vibrant ' +
    'no text letters words logo watermark interface ui'
  ).split(/\s+/),
)

/**
 * A search out of an image prompt: the subject words, in order, at most five.
 * Only the FALLBACK — a plan the model wrote a `query` for uses that. The first
 * clause only: past the first comma an image prompt is almost always style.
 */
export function stockQuery(text: string): string {
  const first = String(text || '').split(/[,.;:\n(]/)[0] || ''
  const words = first
    .toLowerCase()
    .replace(/['’]/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ''))
    .filter((w) => w.length > 1 && !NOT_A_SUBJECT.has(w) && !/^\d+$/.test(w))
  // A first clause made only of style words ("Cinematic, soft light") says
  // nothing; fall back on the whole text rather than search for nothing.
  if (!words.length && first !== text) return stockQuery(String(text).slice(first.length + 1))
  return words.slice(0, 5).join(' ')
}

/** A query the model wrote, tidied: letters, digits and spaces, six words at most. */
export function cleanQuery(q: string | undefined | null): string {
  return String(q || '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(' ')
    .toLowerCase()
}

/** The shape a slot asks for, read off its `aspectRatio` ("16:9", "4/5", "square"…). */
export function orientationOf(aspect: string | undefined): StockOrientation | undefined {
  const a = String(aspect || '').toLowerCase()
  if (/square|carr/.test(a)) return 'square'
  const m = /(\d+(?:\.\d+)?)\s*[:/x×]\s*(\d+(?:\.\d+)?)/.exec(a)
  if (!m) return /portrait|vertical/.test(a) ? 'portrait' : /landscape|wide|horizontal/.test(a) ? 'landscape' : undefined
  const r = Number(m[1]) / Number(m[2])
  if (!Number.isFinite(r) || r <= 0) return undefined
  return r > 1.15 ? 'landscape' : r < 0.87 ? 'portrait' : 'square'
}

/** What a picture is FOR, in words a judge can use. Unknown roles pass through. */
const ROLE_WORDS: Record<string, string> = {
  backdrop: 'a background for a section, with calm areas where text will be laid over it — no busy subject',
  subject: 'ONE object shown on its own, ideally on a plain or simple background',
  scene: 'a photograph of a place, of people or of the product in use — the subject must be obvious',
  texture: 'a close-up of a material or surface, abstract, filling the frame',
  hero: 'the main image at the top of the page — it sets the tone of the whole page',
}

export const JUDGE_SYSTEM = [
  'You choose stock photographs for a web page. You are shown CANDIDATE photos, numbered from 1 in the order they are attached, and possibly, after them, photos ALREADY CHOSEN for the same page.',
  'Pick the ONE candidate that best: (1) clearly shows the wanted subject; (2) suits its role on the page; (3) belongs with the photos already chosen — same world, similar light and colour temperature, so the page reads as one series.',
  'Reject every candidate (pick 0) when none clearly shows the subject, or when the best one would look odd, off-topic, cheesy or out of place on this page. An empty slot is better than a wrong photo: the page is then designed without it.',
  'Avoid photos with visible text, watermarks or logos whenever another candidate is acceptable.',
  'Respond with ONLY a JSON object: {"pick": <number>, "reason": "<one short sentence>"}.',
].join('\n')

const JUDGE_SCHEMA = {
  type: 'object',
  properties: { pick: { type: 'integer' }, reason: { type: 'string' } },
  required: ['pick'],
}

/** The user turn of the judge, as text. Exported for the tests. */
export function judgeBrief(want: { subject: string; role?: string; brief?: string }, candidates: number, chosen: number): string {
  const role = want.role ? ROLE_WORDS[want.role] || want.role : ''
  return [
    want.brief ? `Page: ${String(want.brief).replace(/\s+/g, ' ').slice(0, 500)}` : '',
    `Wanted subject: ${want.subject}`,
    role ? `Role on the page: ${role}` : '',
    `Candidates: images 1 to ${candidates}.`,
    chosen ? `Already chosen for this page (NOT candidates, for coherence only): images ${candidates + 1} to ${candidates + chosen}.` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** The `{…}` in an answer, fenced or not. */
function firstJson(content: string): Record<string, unknown> | null {
  const m = /\{[\s\S]*\}/.exec(content || '')
  if (!m) return null
  try {
    const v = JSON.parse(m[0])
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const JUDGE_TIMEOUT_MS = 60_000

/**
 * Ask the vision model which candidate to use.
 *
 * Returns `{ pick: 0 }` for "none of these", `{ pick: n }` (1-based) for a
 * choice, and null when the judge could not answer at all — a network error, a
 * timeout, prose instead of JSON, a number out of range. Null is not a verdict:
 * the caller falls back on the search engine's first result, which is what it
 * would have had without eyes. Never throws except on the user's own cancel.
 */
export async function judgeStockCandidates(
  s: Settings,
  want: { subject: string; role?: string; brief?: string },
  candidates: StockCandidate[],
  chosen: string[] = [],
  signal?: AbortSignal,
): Promise<{ pick: number; reason: string } | null> {
  if (!candidates.length) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), JUDGE_TIMEOUT_MS)
  const onAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await proxyFetch(s, '/api/chat', {
      method: 'POST',
      // For Admin → Activity only; see `chat` in generate.ts.
      headers: { 'x-mocky-purpose': 'stock-pick' },
      body: JSON.stringify({
        model: s.model,
        stream: false,
        format: JUDGE_SCHEMA,
        messages: [
          { role: 'system', content: JUDGE_SYSTEM },
          {
            role: 'user',
            content: judgeBrief(want, candidates.length, chosen.length),
            images: [...candidates.map((c) => c.thumb), ...chosen].map(stripDataUrl),
          },
        ],
        // num_predict MUST stay positive (I8). Generous for a two-field answer
        // because a reasoning model spends tokens before it writes one.
        options: { temperature: 0.1, num_ctx: 16384, num_predict: 1024 },
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { message?: { content?: string }; choices?: Array<{ message?: { content?: string } }> }
    const answer = firstJson(data.message?.content ?? data.choices?.[0]?.message?.content ?? '')
    const pick = Number(answer?.pick)
    if (!Number.isInteger(pick) || pick < 0 || pick > candidates.length) return null
    return { pick, reason: typeof answer?.reason === 'string' ? answer.reason.slice(0, 200) : '' }
  } catch (err) {
    if (signal?.aborted) throw err
    return null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** What a caller wants found. */
export interface StockWant {
  /** What the picture shows, in the planner's words. */
  subject: string
  /** The search the planner wrote for it, when it wrote one. */
  query?: string
  orientation?: StockOrientation
  /** 'backdrop' | 'subject' | 'scene' | 'texture' | a Muse slot name. */
  role?: string
  tags?: string[]
}

export interface StockFinder {
  find(want: StockWant): Promise<PickedStockImage | null>
  /** Why the last `find` came back empty, in words a person can read. */
  lastMiss: string
  /**
   * The thumbnails of the photos chosen so far, in the order they were found —
   * what the page's author is shown so it designs AROUND them (see
   * `photoReferenceNote`). Empty on the blind path: nobody fetched a thumbnail,
   * and a model without vision could not look at one anyway.
   */
  chosen(): string[]
}

/** How many found photos the page's author is shown. The rest are still used. */
export const PHOTO_REFERENCES_MAX = 3

/**
 * The instruction that goes with the found photos attached to the generation.
 *
 * Why show them at all: the direction (dossier, storyboard) is written BEFORE
 * the photos are found — it decides what to search for — so until now the page
 * was designed without ever seeing the pictures it embeds, and a warm, grainy
 * hero could land in a page tuned for cold chrome. The thumbnails are already in
 * memory (the judge looked at them), so showing them costs one small image each.
 *
 * They are the LAST images of the request, after any annotation the user
 * attached — the note says so, because `withImageNote` numbers everything as
 * "reference screenshots" and the two must not be confused.
 */
export function photoReferenceNote(count: number): string {
  if (count <= 0) return ''
  const which = count === 1 ? 'The LAST attached image is' : `The LAST ${count} attached images are`
  return [
    `REAL PHOTOS — ${which} the real photograph${count === 1 ? '' : 's'} this page embeds (the URLs given above), shown small so you can SEE ${count === 1 ? 'it' : 'them'}. They are not screenshots of a design.`,
    'Design the page AROUND them: take the accent colours from them within the palette you were given, match light or dark sections to their mood, leave them room, and keep any text laid over one readable against what that photo actually shows (use a veil or a solid panel where it is busy or bright).',
    'Embed them only through their listed URLs, exactly as instructed above. Do not describe them in the copy.',
  ].join('\n')
}

/**
 * One finder per generation: it remembers the photos already used, so a series
 * never repeats one, and shows the judge the ones already chosen, so the next
 * pick is made FOR the same page.
 */
export function createStockFinder(opts: {
  project: string
  /** The model to judge with. Absent or `vision: false` = the blind pick. */
  settings?: Settings
  vision: boolean
  /** The user's request, so the judge knows what page this is. */
  brief?: string
  /** The Motion Ultra series size, for the server's gate. */
  ultra?: number
  signal?: AbortSignal
  /** How many thumbnails the judge sees per picture. */
  count?: number
}): StockFinder {
  const used: string[] = []
  const chosenThumbs: string[] = []
  const finder: StockFinder = {
    lastMiss: '',
    chosen: () => chosenThumbs.slice(),
    async find(want) {
      finder.lastMiss = ''
      const query = cleanQuery(want.query) || stockQuery(want.subject)
      if (!query) {
        finder.lastMiss = `Aucune recherche possible pour « ${want.subject} ».`
        return null
      }
      if (!opts.vision || !opts.settings) {
        const got = await pickStockImage(query, {
          project: opts.project,
          orientation: want.orientation,
          exclude: used,
          tags: want.tags,
          ultra: opts.ultra,
          signal: opts.signal,
        })
        if (got) used.push(got.stockId)
        else finder.lastMiss = `Aucune photo libre trouvée pour « ${query} ».`
        return got
      }

      const { candidates } = await fetchStockCandidates(query, {
        orientation: want.orientation,
        exclude: used,
        count: opts.count,
        signal: opts.signal,
      })
      if (!candidates.length) {
        finder.lastMiss = `Aucune photo libre trouvée pour « ${query} ».`
        return null
      }
      const verdict = await judgeStockCandidates(
        opts.settings,
        { subject: want.subject, role: want.role, brief: opts.brief },
        candidates,
        chosenThumbs.slice(-3),
        opts.signal,
      )
      if (verdict && verdict.pick === 0) {
        finder.lastMiss = `Aucune photo ne convenait pour « ${query} »${verdict.reason ? ` : ${verdict.reason}` : ''}.`
        return null
      }
      const chosen = candidates[verdict ? verdict.pick - 1 : 0]
      const stored = await importStockImage(chosen.provider, chosen.id, {
        project: opts.project,
        tags: want.tags,
        ultra: opts.ultra,
        signal: opts.signal,
      })
      const stockId = `${chosen.provider}:${chosen.id}`
      used.push(stockId)
      chosenThumbs.push(chosen.thumb)
      return { hash: stored.hash, url: absoluteUrl(stored.url), stockId, credit: stored.credit }
    },
  }
  return finder
}

/**
 * Muse's imagery slots, filled from the stock libraries instead of a model.
 * Same contract as `generateSlotImages`: failures are reported and skipped,
 * never thrown (M3) — except a cancel.
 */
export async function pickStockSlotImages(
  slots: MuseImagerySlot[],
  finder: StockFinder,
  opts: {
    max?: number
    signal?: AbortSignal
    onImage?: (img: GeneratedSlotImage) => void
    onError?: (message: string) => void
  } = {},
): Promise<GeneratedSlotImage[]> {
  const out: GeneratedSlotImage[] = []
  for (const slot of (slots || []).slice(0, opts.max ?? 1)) {
    const subject = String(slot.subject || slot.prompt || '').trim()
    if (!subject) continue
    try {
      const got = await finder.find({
        subject,
        query: slot.searchQuery,
        orientation: orientationOf(slot.aspectRatio),
        role: slot.slot === 'hero' || slot.id === 'hero' ? 'hero' : slot.slot,
        tags: [slot.slot || 'image', 'muse'],
      })
      if (!got) {
        opts.onError?.(finder.lastMiss)
        continue
      }
      const img = { slot: slot.slot || slot.id, id: slot.id, url: got.url }
      out.push(img)
      opts.onImage?.(img)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err
      if (opts.signal?.aborted) throw err
      opts.onError?.(err instanceof Error ? err.message : String(err))
    }
  }
  return out
}

const SOURCE_KEY = 'mocky.imageSource.v1'

/**
 * The composer's choice, remembered per browser like Muse's own settings. Read
 * defensively: storage can be absent, and anything but 'stock' means the
 * historical behaviour.
 */
export function loadImageSource(): ImageSource {
  try {
    return localStorage.getItem(SOURCE_KEY) === 'stock' ? 'stock' : 'ai'
  } catch {
    return 'ai'
  }
}

export function saveImageSource(source: ImageSource): void {
  try {
    localStorage.setItem(SOURCE_KEY, source)
  } catch {
    /* private mode — the choice lasts the session */
  }
}
