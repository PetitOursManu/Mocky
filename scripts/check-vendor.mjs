#!/usr/bin/env node
/**
 * Verifies that every file in public/vendor matches the SHA-256 recorded in
 * public/vendor/VENDOR.md.
 *
 * These bundles are executed inside the preview iframes, which run
 * model-generated code. They are the one place in the repo where a silent byte
 * change would be both invisible in review (minified) and dangerous, so the
 * hashes are checked rather than trusted.
 *
 * Exits non-zero on any mismatch, extra file, or missing file.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'public', 'vendor')
const manifest = path.join(dir, 'VENDOR.md')

const md = fs.readFileSync(manifest, 'utf8')
// Rows look like: | `file.js` | package | version | `sha256` |
const expected = new Map(
  [...md.matchAll(/^\|\s*`([^`]+)`\s*\|[^|]*\|[^|]*\|\s*`([a-f0-9]{64})`\s*\|/gm)].map((m) => [m[1], m[2]]),
)

if (expected.size === 0) {
  console.error('check-vendor: no hashes found in VENDOR.md — has the table format changed?')
  process.exit(1)
}

const onDisk = fs.readdirSync(dir).filter((f) => f.endsWith('.js') || f.endsWith('.css'))
let failed = 0

for (const [file, want] of expected) {
  const full = path.join(dir, file)
  if (!fs.existsSync(full)) {
    console.error(`MISSING  ${file} — listed in VENDOR.md but not on disk`)
    failed++
    continue
  }
  const got = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')
  if (got !== want) {
    console.error(`MISMATCH ${file}\n  expected ${want}\n  actual   ${got}`)
    failed++
  } else {
    console.log(`ok       ${file}`)
  }
}

for (const file of onDisk) {
  if (!expected.has(file)) {
    console.error(`UNLISTED ${file} — present in public/vendor but absent from VENDOR.md`)
    failed++
  }
}

if (failed) {
  console.error(`\ncheck-vendor: ${failed} problem(s). See public/vendor/VENDOR.md.`)
  process.exit(1)
}
console.log(`\ncheck-vendor: ${expected.size} bundle(s) verified.`)
