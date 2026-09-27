import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * A screen's notes are the user's, and no model ever reads them.
 *
 * That was the requirement the feature was asked for with, and it is the kind
 * nothing else enforces: every prompt in Mocky is built from named fields —
 * `screen.code`, `screen.prompt`, `screen.design` — so the notes stay private
 * only as long as nobody names `userNotes` in a place that talks to a model.
 * One helpful "include the user's notes as context" in `generate.ts` and they
 * would travel to the provider on every edit, with nothing on screen to say so.
 *
 * So this is an ALLOWLIST, not a list of forbidden files: the handful of files
 * that store, draw or edit the notes may mention them, and a mention anywhere
 * else in `src/`, `server/` or `worker/` fails here. A new file that needs them
 * for a legitimate UI reason is added below — in a diff someone reviews, which
 * is the point. A prompt builder is never added.
 *
 * What this cannot see is a whole Screen serialised into a prompt
 * (`JSON.stringify(screen)`); none exists today, and `docs/architecture/
 * invariants.md` (I9) says why none may.
 *
 * Read as text, like the other tests in this directory.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const ALLOWED = new Set([
  'src/lib/project.ts', // the field and its whitelist entry
  'src/lib/screenNotes.ts', // the rules
  'src/lib/screenNotes.test.ts',
  'src/components/ScreenNotesDialog.tsx', // the editor
  'src/components/Canvas.tsx', // the badge and the label-bar button
  'src/components/ProjectView.tsx', // the menu item, the dialog, the duplicate that drops them
])

const MENTION = /\buserNotes\b|\bScreenNote\b|screenNotes['"]/

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (/\.(m?[jt]sx?)$/.test(entry.name)) yield full
  }
}

describe('screen notes never reach a model', () => {
  it('are mentioned only by the files that store, draw or edit them', () => {
    const offenders = []
    for (const dir of ['src', 'server', 'worker']) {
      const abs = path.join(root, dir)
      if (!fs.existsSync(abs)) continue
      for (const file of walk(abs)) {
        const rel = path.relative(root, file).split(path.sep).join('/')
        if (ALLOWED.has(rel)) continue
        if (MENTION.test(fs.readFileSync(file, 'utf8'))) offenders.push(rel)
      }
    }
    expect(offenders, 'screen notes are private to the user — see src/lib/screenNotes.ts').toEqual([])
  })

  it('every allowed file still exists, so the list cannot rot into a blank cheque', () => {
    for (const rel of ALLOWED) expect(fs.existsSync(path.join(root, rel)), rel).toBe(true)
  })
})
