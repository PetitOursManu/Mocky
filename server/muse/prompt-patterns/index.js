// Prompt-pattern library — loads the curated art-direction patterns and matches
// them to a request by tag/keyword overlap. This keeps Muse useful with ZERO
// network access (offline fallback) and blends with live InspirationCards when
// fetching succeeds (prompt §5.4).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadPatterns() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'patterns.json'), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.patterns) ? parsed.patterns : []
  } catch {
    return []
  }
}

export class PromptPatternLibrary {
  constructor(patterns) {
    this.patterns = patterns || loadPatterns()
  }

  all() {
    return this.patterns
  }

  get(id) {
    return this.patterns.find((p) => p.id === id) || null
  }

  /**
   * Rank patterns by how well their tags/keywords match the request text.
   * Returns the top `limit` (always at least one, so Muse never has nothing).
   * @param {string} prompt
   * @param {number} [limit]
   */
  match(prompt, limit = 3) {
    const text = String(prompt || '').toLowerCase()
    const scored = this.patterns.map((p) => {
      let score = 0
      for (const tag of p.tags || []) {
        if (text.includes(tag.toLowerCase())) score += 2
      }
      // Soft signal from the name/description words.
      for (const w of `${p.name} ${p.description}`.toLowerCase().split(/[^a-z]+/)) {
        if (w.length > 4 && text.includes(w)) score += 1
      }
      return { pattern: p, score }
    })
    scored.sort((a, b) => b.score - a.score)
    const top = scored.filter((s) => s.score > 0).slice(0, limit).map((s) => s.pattern)
    // Guarantee a fallback direction even with no tag hits.
    if (top.length === 0 && this.patterns.length) return [this.patterns[0]]
    return top
  }
}

export function createPatternLibrary() {
  return new PromptPatternLibrary(loadPatterns())
}
