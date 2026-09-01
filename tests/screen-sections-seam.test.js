import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findScreenSections } from '../src/lib/screenSections'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const prompt = fs.readFileSync(path.join(root, 'src/lib/generate.ts'), 'utf8')

/**
 * The reader is only useful if generation actually writes the ids, and the two
 * live in different files with nothing between them. This is the seam.
 *
 * It reads the prompt as text rather than calling a model: what is being
 * asserted is that the INSTRUCTION exists and names the same vocabulary the
 * placement pass prefers. A model that ignores it is a different problem, and
 * one no test can settle.
 */
describe('the generation prompt and the reader agree', () => {
  it('asks for an id on every top-level section', async () => {
    expect(prompt).toMatch(/TOP-LEVEL section a stable, lowercase id/)
    // The names the placement pass prefers must be the names the prompt
    // suggests, or every screen is generated with ids nothing looks for.
    for (const id of ['hero', 'features', 'product', 'cta', 'footer']) {
      expect(prompt, id).toContain(`id="${id}"`)
    }
  })

  it('reads back exactly what that instruction describes', async () => {
    // The shape the prompt asks for, parsed by the reader that has to find it.
    const generated = `
      <main>
        <section id="hero"><h1>x</h1></section>
        <section id="how-it-works"><p>y</p></section>
        <section id="product"><img src="/api/images/a" /></section>
        <footer id="footer" />
      </main>`
    const found = await findScreenSections(generated)
    expect(found.map((s) => s.id)).toEqual(['hero', 'how-it-works', 'product', 'footer'])
  })
})
