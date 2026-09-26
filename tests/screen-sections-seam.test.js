import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const prompt = fs.readFileSync(path.join(root, 'src/lib/generate.ts'), 'utf8')

/**
 * Every top-level section carries a stable id — Motion Ultra's storyboard names
 * its sections by them, and the video background is planned into one of them.
 * The reader that used to parse them back (for the automatic film placement)
 * is gone with that placement; the instruction is what is still load-bearing.
 *
 * It reads the prompt as text rather than calling a model: what is being
 * asserted is that the INSTRUCTION exists and names the vocabulary the
 * storyboard uses. A model that ignores it is a different problem, and
 * one no test can settle.
 */
describe('the generation prompt names every section', () => {
  it('asks for an id on every top-level section', async () => {
    expect(prompt).toMatch(/TOP-LEVEL section a stable, lowercase id/)
    // The vocabulary the storyboard and every later pass place things by.
    for (const id of ['hero', 'features', 'product', 'cta', 'footer']) {
      expect(prompt, id).toContain(`id="${id}"`)
    }
  })
})
