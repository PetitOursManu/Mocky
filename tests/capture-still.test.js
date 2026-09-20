import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * A screen with a 3D scene, seen from the one frame whose whole output is a
 * picture.
 *
 * `lib/capture.ts` renders the component fresh in an offscreen iframe and lets
 * html2canvas snapshot it — for the home page's thumbnails and for an
 * annotation snip. Two things made a `<Scene3D>` come out as an empty gradient
 * there, and both are checked here rather than in the capability's own suite,
 * because they are agreements BETWEEN two files: the shell decides what to
 * load, the component decides what to do about it.
 *
 * 1. The shell loads no CDN bundle at all. That is right for Motion — a still
 *    of an animated element is the element — and wrong for three.js, which is
 *    the picture itself. `drawsContent` is the distinction.
 * 2. html2canvas copies a live WebGL canvas BLANK: it clones the document, and
 *    by then the drawing buffer is gone (nothing here keeps one alive — that is
 *    memory every scene on the canvas would pay). So the shell asks for a
 *    still instead, and an <img> is something html2canvas copies perfectly.
 *
 * Read as source rather than run: mounting an iframe, a WebGL context and
 * html2canvas is not something a unit test has. The browser bench that proved
 * it is in the commit message.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const capture = read('src/lib/capture.ts')
const scene = read('src/lib/capabilities/snippets/Scene3D.ts')
const registry = read('src/lib/capabilities/registry.ts')

describe('a 3D scene in a capture frame', () => {
  it('is asked for one frame and its context back', () => {
    expect(capture).toContain('window.__mockyStill = true')
    expect(scene).toContain('window.__mockyStill === true')
    // One frame, and `settled` is what keeps it at one however many grant,
    // resize or visibility events follow.
    expect(scene).toContain('if (reduced || stillOnly) { owe(true); settle(); if (!settled) ladder(); return; }')
    expect(scene).toMatch(/settled = true;\s*\n\s*size\(\);\s*\n\s*draw\(0\);\s*\n\s*keepStill\(\);\s*\n\s*stop\(false\);/)
  })

  it('waits for the element to have a size before taking it', () => {
    // Tailwind's JIT runtime applies a class after the first paint, so an
    // effect firing on mount measures 0x0 — the still came back 1x1 and was
    // refused, and the capture kept showing the fallback gradient. Measured in
    // a browser, which is also where the fix was checked.
    expect(scene).toContain('if (node.clientWidth < 2 || node.clientHeight < 2) return;')
    // And the shell waits for a scene that has not managed it yet, rather than
    // shooting on a fixed delay and hoping.
    expect(capture).toContain('window.__mockyStillPending')
    expect(scene).toContain('window.__mockyStillPending = Math.max(0,')
    expect(scene).toMatch(/new ResizeObserver\(function \(\) \{ size\(\); measure\(\); if \(reduced \|\| stillOnly\) settle\(\); \}\)/)
  })

  it('loads the bundles that DRAW, and not the ones that only move', () => {
    expect(capture).toContain("c.kind === 'cdn-script' && c.drawsContent")
    expect(capture).toContain('${capScripts}')
    // three.js is the picture; Motion only moves markup that is already there.
    expect(registry).toMatch(/id: 'three-lib'[\s\S]{0,400}drawsContent: true/)
    expect(registry).not.toMatch(/id: 'motion-lib'[\s\S]{0,400}drawsContent/)
  })

  it('still loads nothing from a CDN into that privileged frame', () => {
    // The shell runs model-generated code with Mocky's own origin (see the note
    // at the top of capture.ts), so a bundle added here must be vendored. The
    // new tag is built from the capability's own `cdn.url`, and every one of
    // those is pinned to an existing /vendor file by preview-sandbox.test.js —
    // what is checked here is that nothing was hard-coded beside it.
    const literals = [...capture.matchAll(/<script src="([^"$]+)"/g)].map((m) => m[1])
    expect(literals.length).toBeGreaterThan(0)
    for (const url of literals) expect(url.startsWith('/vendor/'), url).toBe(true)
    expect(capture).toContain('`<script src="${c.cdn!.url}"></script>`')
  })
})
