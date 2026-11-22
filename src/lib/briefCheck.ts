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
import type { TranslationKey } from '../i18n'

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
  return !names.some((n) => namedIn(code, n))
}

/** Whether the code names an identifier, as a whole word. */
function namedIn(code: string, name: string): boolean {
  return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(code)
}

export interface InteractLoss {
  /** Interaction components the code used before the edit and not after. */
  components: string[]
  /** Picture addresses (an imposed sheet, a library picture) it named before and not after. */
  pictures: string[]
  /** Element ids it had before and not after — the handles links, crops and transitions hang on. */
  ids: string[]
}

const PICTURE_URL = /https?:\/\/[^\s"'`)<>]+|\/api\/images\/[0-9a-f]{16,64}/g
const ID_ATTR = /\bid=["']([A-Za-z][\w-]{0,60})["']/g

/**
 * What an edit took away from an interactive screen, or null when nothing —
 * the `ultraLoss` of this pack, for the same reason (U5): an edit about one
 * line comes back without the shelf's gesture or the sheet its crops cut, and
 * nobody notices until the demo. Said, never undone: Revert is one click away.
 */
export function interactLoss(before: string, after: string): InteractLoss | null {
  const names = (CAPABILITY_MAP.interact?.snippets ?? []).flatMap((s) => s.exports)
  const uses = (code: string, n: string) => namedIn(code, n)
  const components = names.filter((n) => uses(before, n) && !uses(after, n))
  const set = (code: string, re: RegExp, g = 0) => new Set([...code.matchAll(re)].map((m) => m[g]))
  const picsAfter = set(after, PICTURE_URL)
  const pictures = [...set(before, PICTURE_URL)].filter((u) => !picsAfter.has(u))
  const idsAfter = set(after, ID_ATTR, 1)
  const ids = [...set(before, ID_ATTR, 1)].filter((i) => !idsAfter.has(i))
  return components.length || pictures.length || ids.length ? { components, pictures, ids } : null
}

/** The sentence for an edit's loss, in the caller's language. */
export function interactLossNotice(
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
  screen: string,
  loss: InteractLoss,
): string {
  const parts = [
    loss.components.length ? t('project.interactLossComponents', { list: loss.components.slice(0, 4).join(', ') }) : '',
    loss.pictures.length ? t('project.interactLossPictures', { count: loss.pictures.length }) : '',
    loss.ids.length ? t('project.interactLossIds', { list: loss.ids.slice(0, 4).map((i) => `#${i}`).join(', ') }) : '',
  ].filter(Boolean)
  return t('project.interactEditLoss', { name: screen, what: parts.join(' · ') })
}
