import { captureRegion } from './capture'
import { resolveCapabilities, selectCapabilities } from './capabilities/select'
import type { Screen } from './project'

/**
 * A cache of real screenshots, used to illustrate projects on the home page.
 *
 * WHERE THE PICTURE IS TAKEN, AND WHY IT MATTERS
 *
 * Taking it is not free and it is not innocent: html2canvas cannot read the
 * sandboxed preview (opaque origin) and cannot run inside it either — it clones
 * the document into an iframe of its own, and a sandbox without
 * allow-same-origin gives every descendant a FRESH opaque origin, so the frame
 * cannot read its own clone. The only way to screenshot a generated screen is
 * therefore a short-lived SAME-ORIGIN iframe, which for that moment runs
 * model-written code with Mocky's own origin.
 *
 * That was closed once, by snapshotting with snapdom — which serializes in place
 * and needs no such access — and then reopened, because snapdom scales far worse
 * with node count (measured: 4x html2canvas at 6400 nodes, and widening) and a
 * capture that takes tens of seconds holds the tab's main thread for that long.
 * See the note at the top of capture.ts. The hole is real and is documented in
 * docs/AUDIT-2026-07.md §2.1; the fix has to come back with the performance
 * work done, not before it.
 *
 * The picture is taken ONCE, in the project view, right after a screen settles
 * (see `queueThumbs`), rather than on every home-page visit as it originally
 * was — every visit used to re-run a same-origin capture for every project. The
 * home page only ever READS the cache: it mounts no iframe and executes no
 * generated code.
 *
 * The entry is keyed by a checksum of the code that produced it, so it is
 * retaken only when the screen actually changes.
 *
 * Two constraints shape everything below.
 *
 * 1. QUOTA. localStorage is already the tight resource in this app (the whole
 *    project list lives there, and a quota error there stops both local saving
 *    and server sync). A full-size PNG per screen — captureRegion renders at
 *    scale 2, so ~1–3 MB each — would blow the budget on its own. Every
 *    thumbnail is therefore redrawn at 480 px wide and re-encoded as JPEG q0.7,
 *    which lands around 10 kB, and the cache is capped.
 * 2. NO WRITE MAY THROW. A failed write here must degrade to "this project shows
 *    a placeholder", never to a blank home page. Every store access is wrapped,
 *    and a quota error drops the oldest entries and retries before giving up.
 */

const KEY = 'mocky.thumbs.v1'

/** Widest a stored thumbnail may be; the page draws them 96–340 px wide. */
const MAX_WIDTH = 480
const JPEG_QUALITY = 0.7
/** Hard ceiling on cached thumbnails, oldest evicted first. */
const MAX_ENTRIES = 40

/**
 * The top band of a screen: header plus hero. That is what makes a design
 * recognisable at a glance — below the fold it is mostly body copy, which at
 * thumbnail size is grey mush.
 */
export const THUMB_REGION = { x: 0, y: 0, w: 1, h: 0.55 }

interface ThumbEntry {
  dataUrl: string
  at: number
  codeHash: string
}

type ThumbStore = Record<string, ThumbEntry>

/**
 * Checksum of a screen's code. Deliberately not crypto: its only job is to
 * notice that the code changed since the picture was taken, so a stale
 * thumbnail is never shown. FNV-1a, with the length appended.
 */
export function hashCode(code: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i)
    // FNV prime (16777619) by shift-add, to stay inside 32 bits.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return (h >>> 0).toString(36) + '-' + code.length.toString(36)
}

function isEntry(v: unknown): v is ThumbEntry {
  const e = v as ThumbEntry | null
  return !!e && typeof e.dataUrl === 'string' && typeof e.codeHash === 'string'
}

/** Reads and validates the store; unreadable or corrupt storage reads as empty. */
function readStoreFresh(): ThumbStore {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: ThumbStore = {}
    for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (isEntry(entry)) out[id] = { dataUrl: entry.dataUrl, at: entry.at || 0, codeHash: entry.codeHash }
    }
    return out
  } catch {
    return {}
  }
}

// Parsing the store costs a JSON.parse of a few hundred kB, and the home page
// asks for one thumbnail per project in a tight loop. Reads go through this
// memo; writes always re-read from storage first, so a second tab's entries are
// merged instead of clobbered.
let memo: ThumbStore | null = null

function readStore(): ThumbStore {
  if (memo) return memo
  const fresh = readStoreFresh()
  memo = fresh
  return fresh
}

/** Persists the store. Returns false on quota (or any other) failure. */
function commit(store: ThumbStore): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
    memo = store
    return true
  } catch {
    return false
  }
}

/** Keeps the `keep` most recent entries. */
function keepNewest(store: ThumbStore, keep: number): ThumbStore {
  const ids = Object.keys(store).sort((a, b) => (store[b].at || 0) - (store[a].at || 0))
  const out: ThumbStore = {}
  for (const id of ids.slice(0, Math.max(1, keep))) out[id] = store[id]
  return out
}

/** The cached thumbnail for a screen, or null if absent or out of date. */
export function getThumb(screenId: string, code: string): string | null {
  const entry = readStore()[screenId]
  if (!entry) return null
  return entry.codeHash === hashCode(code) ? entry.dataUrl : null
}

/** Stores a thumbnail. Never throws: a full quota simply means no thumbnail. */
export function putThumb(screenId: string, code: string, dataUrl: string): void {
  const entry: ThumbEntry = { dataUrl, at: Date.now(), codeHash: hashCode(code) }
  let store: ThumbStore = { ...readStoreFresh(), [screenId]: entry }
  if (Object.keys(store).length > MAX_ENTRIES) store = keepNewest(store, MAX_ENTRIES)
  if (commit(store)) return

  // Quota exceeded. Halve the cache, oldest first — the new entry has the
  // freshest timestamp, so it survives — and try once more.
  const halved = keepNewest(store, Math.max(1, Math.floor(Object.keys(store).length / 2)))
  if (commit(halved)) return

  // Still no room: keep this one alone. If even that fails, drop it silently.
  commit({ [screenId]: entry })
}

/** Forgets thumbnails whose screen no longer exists. Never throws. */
export function pruneThumbs(liveScreenIds: Iterable<string>): void {
  const live = new Set(liveScreenIds)
  const store = readStore()
  const ids = Object.keys(store)
  const stale = ids.filter((id) => !live.has(id))
  if (stale.length === 0) return
  const next: ThumbStore = {}
  for (const id of ids) if (live.has(id)) next[id] = store[id]
  commit(next)
}

/**
 * Redraws a capture into a small JPEG.
 *
 * captureRegion renders at scale 2 and returns a PNG, i.e. megabytes. That is
 * the one thing this cache must not put in localStorage.
 */
function shrink(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const srcW = img.naturalWidth || MAX_WIDTH
      const srcH = img.naturalHeight || 1
      const scale = Math.min(1, MAX_WIDTH / srcW)
      const w = Math.max(1, Math.round(srcW * scale))
      const h = Math.max(1, Math.round(srcH * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('no 2d context'))
        return
      }
      // JPEG carries no alpha channel: without an opaque backdrop first, every
      // transparent pixel of the capture would encode as black.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      try {
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
      } catch (err) {
        reject(err instanceof Error ? err : new Error('encode failed'))
      }
    }
    img.onerror = () => reject(new Error('thumbnail decode failed'))
    img.src = dataUrl
  })
}

// A screen whose capture failed (a runtime error in the generated code, a
// timeout…) would otherwise be retried on every visit to the home page, at ~1 s
// of iframe work each time. One attempt per code version per session is enough.
const failed = new Set<string>()

/**
 * Captures, shrinks and caches the thumbnail of one screen.
 *
 * Resolves to the data URL, or to null if the screen cannot be captured — the
 * caller falls back to the drawn placeholder. Never rejects, so it can be
 * awaited in a plain loop.
 */
export async function captureThumb(screen: Screen): Promise<string | null> {
  if (!screen?.code || !screen.code.trim()) return null
  const mark = screen.id + ':' + hashCode(screen.code)
  if (failed.has(mark)) return null
  try {
    const w = screen.w > 0 ? screen.w : 1024
    const h = screen.h > 0 ? screen.h : 720
    // Same capabilities the screen was generated with — the shell needs the
    // Icon/Charts/Motion globals or the component throws on render. Screens
    // saved before `caps` was persisted fall back to re-deriving them.
    const caps = resolveCapabilities(
      screen.caps && screen.caps.length > 0 ? screen.caps : selectCapabilities(screen.prompt || ''),
    )
    // Render only as many pixels as the stored JPEG can use, plus a little for
    // sharpness. The default scale of 2 rendered a 2880 px canvas to produce a
    // 480 px file — on a screen with a full-bleed background image that alone
    // was enough to hit the capture timeout.
    const scale = Math.min(2, Math.max(0.5, (MAX_WIDTH * 1.5) / w))
    const raw = await captureRegion(screen.code, w, h, THUMB_REGION, caps, scale)
    const small = await shrink(raw)
    putThumb(screen.id, screen.code, small)
    return small
  } catch (err) {
    failed.add(mark)
    // Swallowing this made the feature undiagnosable: thumbnails were simply
    // absent, with nothing anywhere saying why. Still non-fatal, but audible.
    console.warn(`[mocky] thumbnail failed for screen ${screen.id}:`, err)
    return null
  }
}

// ---- the capture queue -----------------------------------------------------

/**
 * Screens waiting to be photographed, and the run in flight.
 *
 * Strictly one at a time. Each capture mounts an iframe that boots React,
 * Babel, Tailwind and html2canvas; several at once would lock the main thread
 * right where the user is working.
 */
const pending: Screen[] = []
let running = false
const listeners = new Set<(screenId: string, dataUrl: string) => void>()

/** Notified when a thumbnail lands, so a view can show it without polling. */
export function onThumb(cb: (screenId: string, dataUrl: string) => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

async function drain() {
  if (running) return
  running = true
  try {
    while (pending.length) {
      const screen = pending.shift()!
      // It may have been captured (or changed again) since it was queued.
      if (getThumb(screen.id, screen.code)) continue
      const url = await captureThumb(screen)
      if (url) for (const cb of listeners) cb(screen.id, url)
      // Breathing room: the user is generating in the same tab.
      await new Promise((r) => setTimeout(r, 250))
    }
  } finally {
    running = false
  }
}

/**
 * Ask for thumbnails of these screens, skipping any that are already current.
 *
 * Call it from the project view once a screen has settled — never from a list
 * view. See the note at the top of this file: the capture runs model code
 * same-origin, which belongs where the user is already generating.
 */
export function queueThumbs(screens: Screen[]): void {
  for (const s of screens) {
    if (!s?.code || !s.code.trim()) continue
    if (getThumb(s.id, s.code)) continue
    if (pending.some((p) => p.id === s.id && p.code === s.code)) continue
    pending.push(s)
  }
  if (pending.length) void drain()
}

/** True while a capture is in flight or queued — for a discreet indicator. */
export function isCapturing(): boolean {
  return running || pending.length > 0
}
