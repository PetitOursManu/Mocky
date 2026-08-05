#!/usr/bin/env node
/**
 * Verifies that docs-site/data/*.json still matches the source it was generated
 * from.
 *
 * The documentation site cannot import from src/ — it is static, has no build
 * step, and is served from a different host. So the design presets and the
 * quality rules exist twice: once as the real thing, once as JSON beside the
 * docs. A second copy is not avoidable here; a second copy that can drift in
 * silence is.
 *
 * This is `check-vendor.mjs`'s shape, applied to generated data instead of
 * vendored bundles: one script writes, this one verifies, and CI runs it. The
 * failure mode it exists to prevent is quiet and slow — someone edits a preset,
 * the documentation keeps showing last month's palette, and no test anywhere
 * notices.
 *
 * Exits non-zero on any difference. Fix with: npm run docs:data
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stylePresets, qualityRules } from './build-docs-data.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'docs-site', 'data')

const CHECKS = [
  ['style-presets.json', stylePresets],
  ['quality-rules.json', qualityRules],
]

let failed = 0
for (const [name, build] of CHECKS) {
  const file = path.join(dir, name)
  if (!fs.existsSync(file)) {
    console.error(`missing  ${name} — run: npm run docs:data`)
    failed++
    continue
  }
  const onDisk = fs.readFileSync(file, 'utf8')
  const expected = JSON.stringify(build(), null, 1) + '\n'
  if (onDisk !== expected) {
    // Say WHAT drifted, not just that something did: the whole point is that
    // the difference is otherwise invisible.
    const a = JSON.parse(onDisk)
    const b = build()
    const ids = (x) => new Set(x.map((v) => v.id))
    const on = ids(a)
    const ex = ids(b)
    const added = [...ex].filter((i) => !on.has(i))
    const gone = [...on].filter((i) => !ex.has(i))
    console.error(`stale    ${name} (${a.length} on disk, ${b.length} in source)`)
    if (added.length) console.error(`         missing from the docs: ${added.join(', ')}`)
    if (gone.length) console.error(`         no longer in source:   ${gone.join(', ')}`)
    if (!added.length && !gone.length) console.error('         same ids, changed content')
    failed++
  } else {
    console.log(`ok       ${name}`)
  }
}

if (failed) {
  console.error(`\ncheck-docs-data: ${failed} file(s) out of date. Run: npm run docs:data`)
  process.exit(1)
}
console.log(`check-docs-data: ${CHECKS.length} file(s) verified.`)
