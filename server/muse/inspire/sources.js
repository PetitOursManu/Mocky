// Source registry loader + request tag classification. Classification is
// deterministic (no LLM) so Discover works offline and is trivially testable:
// we map keywords in the request to a small tag vocabulary, then pick the
// registry sources whose tags overlap most.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** keyword → tag. Multiple keywords can map to the same tag. */
const KEYWORD_TAGS = {
  landing: 'landing', 'landing page': 'landing', hero: 'landing', marketing: 'marketing',
  portfolio: 'portfolio', 'personal site': 'portfolio', resume: 'portfolio',
  saas: 'saas', dashboard: 'dashboard', analytics: 'dashboard', admin: 'dashboard',
  ecommerce: 'ecommerce', shop: 'shop', store: 'shop', product: 'product', pricing: 'saas',
  restaurant: 'restaurant', bakery: 'restaurant', cafe: 'restaurant', menu: 'restaurant', food: 'food',
  blog: 'blog', magazine: 'magazine', article: 'blog', news: 'blog',
  app: 'app', mobile: 'app', ios: 'app', android: 'app',
  agency: 'agency', studio: 'agency', creative: 'creative',
  startup: 'startup', fintech: 'fintech', crypto: 'web3', web3: 'web3', ai: 'ai',
  health: 'health', medical: 'health', clinic: 'health', wellness: 'wellness',
  fashion: 'fashion', luxury: 'luxury', hotel: 'luxury', jewelry: 'luxury',
  event: 'event', conference: 'event', wedding: 'event',
  developer: 'developer', devtool: 'developer', api: 'developer', 'open source': 'developer',
  education: 'education', course: 'education', school: 'education',
  brand: 'brand', animation: 'animation', motion: 'animation',
}

/** Extract a tag set from the request text. */
export function classifyTags(prompt) {
  const text = String(prompt || '').toLowerCase()
  const tags = new Set()
  for (const [kw, tag] of Object.entries(KEYWORD_TAGS)) {
    if (text.includes(kw)) tags.add(tag)
  }
  return Array.from(tags)
}

export function loadSources() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'sources.json'), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.sources) ? parsed.sources : []
  } catch {
    return []
  }
}

/**
 * Pick registry sources matching the request's tags, best first.
 * @param {string} prompt
 * @param {object} [opts] { sources?, max? }
 * @returns {Array} source descriptors
 */
export function selectSources(prompt, opts = {}) {
  const sources = opts.sources || loadSources()
  const max = opts.max ?? 3
  const tags = new Set(classifyTags(prompt))
  const scored = sources.map((s) => {
    const overlap = (s.tags || []).filter((t) => tags.has(t)).length
    return { source: s, score: overlap }
  })
  scored.sort((a, b) => b.score - a.score)
  const matched = scored.filter((s) => s.score > 0).slice(0, max).map((s) => s.source)
  // If nothing matched (unusual request), fall back to the broad "landing"
  // galleries so there's still something to fetch.
  if (matched.length === 0) {
    return sources.filter((s) => (s.tags || []).includes('landing')).slice(0, max)
  }
  return matched
}
