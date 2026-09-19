import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ICON_NAMES, BLOCK_KINDS } from '../server/video/timeline.js'
import { ICON_NAMES as WORKER_ICON_NAMES } from '../worker/video/validate.js'

/**
 * The animated icons, held to ONE list across the schema and the worker.
 *
 * `ICON_NAMES` is what a model may write; `LOTTIE_ICONS` in the worker is what
 * can actually be drawn. A name in the first and not the second is a film the
 * validator accepts and the renderer draws an empty square for — half a minute
 * of render spent on a hole in a frame — and a name in the second and not the
 * first is an animation nobody can ask for.
 *
 * The worker's table is read as TEXT rather than imported, like
 * `tests/video-3d-permission.test.js` and for the same reason: it imports its
 * animations from a package installed in `worker/video/` and nowhere else, and
 * this suite has to run on a checkout that has never entered that directory.
 */
const here = path.dirname(fileURLToPath(import.meta.url))
const read = (rel) => fs.readFileSync(path.join(here, '..', rel), 'utf8')

const table = () => {
  const source = read('worker/video/remotion/lottieIcons.js')
  const body = source.slice(source.indexOf('export const LOTTIE_ICONS = {'))
  const row = /^ {2}([A-Za-z]+): \{ data: (\w+), mode: '(loop|toggle)'(?:, rest: '(start|end)')?(?:, to: [\d.]+)? \},$/gm
  return [...body.matchAll(row)].map((m) => ({ name: m[1], data: m[2], mode: m[3], rest: m[4] }))
}

describe('the animated icons', () => {
  it('is one list: the enum, both mirrors of it, and the worker’s table', () => {
    expect(WORKER_ICON_NAMES).toEqual([...ICON_NAMES])
    expect(table().map((entry) => entry.name)).toEqual([...ICON_NAMES])
  })

  it('draws every one of them from an animation it imports', () => {
    const source = read('worker/video/remotion/lottieIcons.js')
    for (const entry of table()) {
      expect(source, entry.name).toMatch(
        new RegExp(`^import ${entry.data} from 'react-useanimations/lib/\\w+/\\w+\\.json'$`, 'm'),
      )
    }
  })

  /**
   * No brand mark, and this is the check rather than a sentence in a comment.
   *
   * The library ships a dozen of them — a film that drew one would be speaking
   * for somebody else's company, in a product whose whole job is to produce
   * pages that look like a real site.
   */
  it('names no brand', () => {
    const brands = ['facebook', 'twitter', 'youtube', 'instagram', 'linkedin', 'github', 'behance', 'dribbble', 'codepen', 'pocket', 'airplay']
    const source = read('worker/video/remotion/lottieIcons.js').toLowerCase()
    for (const brand of brands) {
      expect(ICON_NAMES.map((n) => n.toLowerCase()), brand).not.toContain(brand)
      expect(source, brand).not.toContain(brand)
    }
  })

  /** The block is in the catalogue, and the library is the worker's alone. */
  it('keeps the library out of Mocky’s own manifest', () => {
    expect(BLOCK_KINDS).toContain('animatedIcon')
    const root = JSON.parse(read('package.json'))
    const deps = { ...root.dependencies, ...root.devDependencies, ...root.optionalDependencies }
    expect(Object.keys(deps)).not.toContain('lottie-web')
    expect(Object.keys(deps)).not.toContain('react-useanimations')
    const worker = JSON.parse(read('worker/video/package.json'))
    expect(worker.dependencies['lottie-web']).toBeTruthy()
    expect(worker.dependencies['react-useanimations']).toBeTruthy()
  })
})
