// The inspiration sources Muse fetches, as the ADMINISTRATOR set them.
//
// They were a file in the repository (`sources.json`), so changing one gallery
// meant a fork and a rebuild — and a gallery that started refusing robots, or
// moved, stayed in every instance until a release removed it. The shipped file
// is now the DEFAULT: an instance with no `muse-sources.json` in its data dir
// uses it unchanged, and "Reset" deletes the file to come back to it, so an
// update that improves the defaults still reaches everyone who never edited.
//
// Admin-supplied addresses are fetched by the same InspirationFetcher as the
// defaults and the URLs a person pastes, behind the same SSRF guard: this is a
// list of web pages, not a bypass. That is why a URL here must be public http(s)
// and nothing else is checked at save time — the fetcher decides at fetch time,
// where DNS is resolved.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { loadSources, TAG_VOCABULARY } from './sources.js'

/** Enough to choose from per request (three are used), few enough to review at a glance. */
export const MAX_SOURCES = 30
const MAX_URL = 300
const MAX_TAGS = 12

/** A stable id from the address, so the panel and the logs can name a source. */
function idFor(url, taken) {
  let base = 'source'
  try {
    const u = new URL(url)
    base = `${u.hostname.replace(/^www\./, '')}${u.pathname}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 48) || 'source'
  } catch {
    /* falls back to "source" */
  }
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
  taken.add(id)
  return id
}

/**
 * One admin entry, normalised — or null when it is not a usable source. Tags are
 * kept only when the request classifier can produce them: a tag nothing maps to
 * would make a source that is never chosen, silently.
 */
export function cleanSource(raw, taken = new Set()) {
  if (!raw || typeof raw !== 'object') return null
  const url = String(raw.url || '').trim()
  if (!url || url.length > MAX_URL) return null
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  const tags = Array.from(
    new Set(
      (Array.isArray(raw.tags) ? raw.tags : String(raw.tags || '').split(','))
        .map((t) => String(t).trim().toLowerCase())
        .filter((t) => TAG_VOCABULARY.includes(t)),
    ),
  ).slice(0, MAX_TAGS)
  return {
    id: idFor(parsed.toString(), taken),
    url: parsed.toString(),
    type: 'gallery',
    tags,
    parser: 'generic',
    enabled: raw.enabled !== false,
  }
}

/** A list from the panel, normalised; unusable rows are dropped, never saved half-valid. */
export function cleanSources(list) {
  const taken = new Set()
  const out = []
  for (const raw of Array.isArray(list) ? list : []) {
    const s = cleanSource(raw, taken)
    if (s && !out.some((o) => o.url === s.url)) out.push(s)
    if (out.length >= MAX_SOURCES) break
  }
  return out
}

export function createSourceStore(dataDir) {
  const file = path.join(dataDir, 'muse-sources.json')
  const defaults = () => loadSources().map((s) => ({ ...s, enabled: true }))
  const read = () => {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
      return Array.isArray(parsed.sources) ? cleanSources(parsed.sources) : null
    } catch {
      return null
    }
  }
  return {
    /** What the panel shows: the admin's list, or the shipped one. */
    view() {
      const own = read()
      return { sources: own ?? defaults(), custom: own !== null, tags: TAG_VOCABULARY }
    },
    /** What Muse fetches from: the enabled ones only. */
    active() {
      return (read() ?? defaults()).filter((s) => s.enabled !== false)
    },
    save(list) {
      const sources = cleanSources(list)
      fs.mkdirSync(dataDir, { recursive: true })
      const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`
      fs.writeFileSync(tmp, JSON.stringify({ version: 1, sources }, null, 2))
      fs.renameSync(tmp, file)
      return this.view()
    },
    reset() {
      try {
        fs.unlinkSync(file)
      } catch {
        /* already the defaults */
      }
      return this.view()
    },
  }
}
