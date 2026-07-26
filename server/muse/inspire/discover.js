// Discover — merge user-pasted URLs with tag-matched registry sources, then
// fetch them (deduped, ≤6/run) via the InspirationFetcher (Phase 1). User URLs
// take priority over registry sources so the user's own references always win a
// slot. Returns the raw fetched pages for the Distill stage.
import { selectSources } from './sources.js'

/**
 * @param {object} args
 * @param {string} args.prompt
 * @param {string[]} [args.urls]  user-pasted inspiration URLs
 * @param {number} [args.maxSources]  registry sources to add (default 3)
 * @param {object} deps  { fetcher, onNotice? }
 * @returns {Promise<{fetched: Array<{url,markdown,fromCache}>, sources: Array}>}
 */
export async function discover(args, deps) {
  const onNotice = deps.onNotice || (() => {})
  const userUrls = (args.urls || []).map((u) => String(u).trim()).filter(Boolean)
  const sources = selectSources(args.prompt, { max: args.maxSources ?? 3 })

  // User URLs first, then registry sources — the fetcher caps the total at 6.
  const urls = [...userUrls, ...sources.map((s) => s.url)]
  if (!urls.length || !deps.fetcher) {
    return { fetched: [], sources }
  }
  const fetched = await deps.fetcher.fetch(urls, { onNotice })
  return { fetched, sources }
}
