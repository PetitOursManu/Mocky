#!/usr/bin/env node
/**
 * Writes the JSON the documentation's interactive parts read.
 *
 * The docs site is static, has no build step and shares no module graph with
 * the application — so anything it wants to show about Mocky's own data has to
 * be copied across. This makes that copy a GENERATED artefact rather than a
 * hand-written one.
 *
 * The distinction matters. A hand-copied palette drifts silently: someone edits
 * a preset in `src/lib/styles.ts`, the documentation keeps showing the old one,
 * and nothing anywhere goes red. Generating it does not remove the second copy
 * — nothing can, short of a build step the site deliberately does not have —
 * but `scripts/check-docs-data.mjs` then turns undetectable divergence into a
 * failing check. That is the same shape as `public/vendor/`: one script writes,
 * another verifies, and CI runs the verifier.
 *
 * The source is read as TypeScript directly. `src/lib/styles.ts` has zero
 * imports and is pure data, so Node's type stripping is enough and no bundler
 * is involved.
 *
 * Run: npm run docs:data       Verify: npm run check:docs-data
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { STYLE_PRESETS } from '../src/lib/styles.ts'
import { ANTIPATTERNS } from 'impeccable'
import { JUDGED_RULES } from '../server/muse/quality/catalog.js'
import { RULE_POLICY, DEFAULT_DISPOSITION } from '../server/muse/quality/policy.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'docs-site', 'data')

/**
 * The presets, minus their Markdown.
 *
 * The document itself is the largest part of each preset and the gallery does
 * not display it — a reader who wants the document opens Mocky. Shipping 17
 * full DESIGN.md files into a documentation page would multiply its weight for
 * something nobody reads on that page.
 */
export function stylePresets() {
  return STYLE_PRESETS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    swatches: p.swatches,
    preview: p.preview,
    // Enough of the document to show what a DESIGN.md looks like, without
    // shipping all of it: the headings, which are the interesting shape.
    sections: p.markdown
      .split(/\r?\n/)
      .filter((l) => /^#{1,3}\s/.test(l))
      .map((l) => l.replace(/^#+\s*/, '')),
  }))
}

/**
 * Every rule the quality pass can report, with what Mocky does about it.
 *
 * `disposition` is the RESOLVED policy for a project with no established art
 * direction. The gallery flips the nine `direction` rules live, which is the
 * only way to show invariant Q2 rather than assert it.
 */
export function qualityRules() {
  const det = ANTIPATTERNS.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    category: a.category,
    kind: 'deterministic',
    ...policyOf(a.id),
  }))
  const judged = JUDGED_RULES.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.question,
    category: r.category,
    kind: 'judged',
    ...policyOf(r.id),
  }))
  return [...det, ...judged]
}

function policyOf(id) {
  const entry = RULE_POLICY[id]
  return {
    disposition: entry ? entry.disposition : DEFAULT_DISPOSITION,
    reason: entry ? entry.reason : null,
  }
}

function write(name, value) {
  const file = path.join(outDir, name)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 1) + '\n', 'utf8')
  return file
}

// Importing this module from the checker must not rewrite the files.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = stylePresets()
  const b = qualityRules()
  write('style-presets.json', a)
  write('quality-rules.json', b)
  console.log(`docs data: ${a.length} preset(s), ${b.length} rule(s) → docs-site/data/`)
}
