/**
 * What a generation left out of what the brief imposed — read off the code,
 * no model, after the screen exists (plans/sites-interactifs.md, §4.2 step 4).
 *
 * Report, never correct: the bounded correction pass is a separate decision
 * (one pass at most, agreed with the user) and these are its inputs. The same
 * stance as `ultra/check.ts`, for the same reason — a notice the person reads
 * is better than a rewrite they did not ask for.
 */
import type { BriefMedia } from './briefMedia'
import { CAPABILITY_MAP } from './capabilities/registry'

/** The file an address names, or the one a resizer proxies — what survives a rebuilt URL. */
function fileOf(url: string): string | null {
  try {
    const u = new URL(url)
    const inner = u.searchParams.get('url')
    const path = inner ? new URL(inner).pathname : u.pathname
    const name = path.split('/').pop() ?? ''
    // A name too short to be distinctive ("image.png") proves nothing.
    return name.length >= 12 ? name : null
  } catch {
    return null
  }
}

/**
 * The imposed pictures the code never names. A picture counts as used when its
 * exact address is in the code, or its file name is: a model that rebuilds the
 * resizer's address with encodeURIComponent still points at the same file.
 * Two addresses of one file (the proxy and the raw result) are one picture.
 */
export function missingBriefImages(code: string, media: BriefMedia[]): string[] {
  const byFile = new Map<string, string[]>()
  const loose: string[] = []
  for (const m of media) {
    if (m.kind !== 'image') continue
    const f = fileOf(m.url)
    if (f) byFile.set(f, [...(byFile.get(f) ?? []), m.url])
    else loose.push(m.url)
  }
  const missing: string[] = []
  for (const [file, urls] of byFile) {
    if (!code.includes(file) && !urls.some((u) => code.includes(u))) missing.push(urls[0])
  }
  for (const u of loose) if (!code.includes(u)) missing.push(u)
  return missing
}

/** How many distinct pictures the brief imposes (a proxy and its raw source are one). */
export function briefImageCount(media: BriefMedia[]): number {
  const seen = new Set<string>()
  for (const m of media) if (m.kind === 'image') seen.add(fileOf(m.url) ?? m.url)
  return seen.size
}

/**
 * The interaction kit was offered (the brief describes a page the visitor
 * handles) and the code uses none of it — the signal that tells "the model did
 * not find the capability" apart from "the engine failed", which is the first
 * question of every failed run (cahier §6, "Isoler le moteur").
 */
export function interactUnused(code: string, capIds: string[]): boolean {
  if (!capIds.includes('interact')) return false
  const names = (CAPABILITY_MAP.interact?.snippets ?? []).flatMap((s) => s.exports)
  return !names.some((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(code))
}
