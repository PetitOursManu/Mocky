import { describe, expect, it } from 'vitest'
import { DEFAULT_FRAME_SHAPE, FRAME_FAMILIES, FRAME_SHAPES, FRAME_SHAPE_IDS, frameShape, isFrameShape } from './frameShapes'

/**
 * The paths are numbers nobody reads, so the test reads them: every command is
 * one a renderer and an exporter both understand, every subpath is closed, and
 * every point the curve passes through stays in the 0–100 box — a shape that
 * pokes out of its box is cut by the frame and reads as a bug.
 */

type Pt = [number, number]

/** The points a path passes through, its curves sampled. Arcs are taken at their end points. */
function trace(d: string): { points: Pt[]; commands: string[]; closedSubpaths: boolean } {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
  const points: Pt[] = []
  const commands: string[] = []
  let i = 0
  let cur: Pt = [0, 0]
  let start: Pt = [0, 0]
  let open = false
  let closedSubpaths = true
  const num = () => Number(tokens[i++])
  let cmd = ''
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++]
    commands.push(cmd)
    switch (cmd) {
      case 'M':
        if (open) closedSubpaths = false
        cur = [num(), num()]
        start = cur
        open = true
        points.push(cur)
        break
      case 'L':
        cur = [num(), num()]
        points.push(cur)
        break
      case 'H':
        cur = [num(), cur[1]]
        points.push(cur)
        break
      case 'V':
        cur = [cur[0], num()]
        points.push(cur)
        break
      case 'Q': {
        const c: Pt = [num(), num()]
        const p: Pt = [num(), num()]
        for (let t = 0; t <= 1; t += 0.05) {
          const u = 1 - t
          points.push([u * u * cur[0] + 2 * u * t * c[0] + t * t * p[0], u * u * cur[1] + 2 * u * t * c[1] + t * t * p[1]])
        }
        cur = p
        break
      }
      case 'C': {
        const c1: Pt = [num(), num()]
        const c2: Pt = [num(), num()]
        const p: Pt = [num(), num()]
        for (let t = 0; t <= 1; t += 0.05) {
          const u = 1 - t
          points.push([
            u * u * u * cur[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p[0],
            u * u * u * cur[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p[1],
          ])
        }
        cur = p
        break
      }
      case 'A': {
        i += 5 // rx ry rotation large-arc sweep
        cur = [num(), num()]
        points.push(cur)
        break
      }
      case 'Z':
        cur = start
        open = false
        break
      default:
        throw new Error(`unexpected command ${cmd} in ${d.slice(0, 40)}`)
    }
  }
  if (open) closedSubpaths = false
  return { points, commands, closedSubpaths }
}

const layers = (s: (typeof FRAME_SHAPES)[number]) =>
  [
    ['clip', s.clip],
    ['paper', s.paper],
    ['over', s.over],
  ].filter((l): l is [string, string] => !!l[1])

describe('the frame catalogue', () => {
  it('has a few dozen shapes in four families, each named once', () => {
    expect(FRAME_SHAPES.length).toBeGreaterThanOrEqual(40)
    expect(new Set(FRAME_SHAPE_IDS).size).toBe(FRAME_SHAPE_IDS.length)
    for (const id of FRAME_SHAPE_IDS) expect(id).toMatch(/^[a-z][a-z0-9-]*$/)
    for (const f of FRAME_FAMILIES) expect(FRAME_SHAPES.filter((s) => s.family === f).length, f).toBeGreaterThanOrEqual(6)
  })

  for (const s of FRAME_SHAPES) {
    it(`${s.id}: closed paths that stay in their box`, () => {
      expect(s.ratio).toBeGreaterThan(0.3)
      expect(s.ratio).toBeLessThan(3)
      for (const [name, d] of layers(s)) {
        expect(d, name).not.toMatch(/NaN|Infinity/)
        const { points, commands, closedSubpaths } = trace(d)
        expect(closedSubpaths, name).toBe(true)
        expect(new Set(commands.filter((c) => !'MLHVCQAZ'.includes(c))), name).toEqual(new Set())
        for (const [x, y] of points) {
          expect(x, `${name} x`).toBeGreaterThanOrEqual(-0.05)
          expect(x, `${name} x`).toBeLessThanOrEqual(100.05)
          expect(y, `${name} y`).toBeGreaterThanOrEqual(-0.05)
          expect(y, `${name} y`).toBeLessThanOrEqual(100.05)
        }
      }
    })
  }

  it('fills its box: a picture that never reaches its own edges wastes the frame', () => {
    // A photo frame keeps a margin on purpose. Arcs are only traced at their
    // ends here, so the shapes drawn with them (written by hand to their box)
    // are left to the eye.
    for (const s of FRAME_SHAPES.filter((x) => x.family !== 'photo' && !x.clip.includes('A'))) {
      const { points } = trace(s.clip)
      const xs = points.map((p) => p[0])
      const ys = points.map((p) => p[1])
      expect(Math.max(...xs) - Math.min(...xs), s.id).toBeGreaterThan(90)
      expect(Math.max(...ys) - Math.min(...ys), s.id).toBeGreaterThan(80)
    }
  })

  it('writes its numbers to two decimals: a path is part of every preview\u2019s source', () => {
    for (const s of FRAME_SHAPES) for (const [, d] of layers(s)) expect(d).not.toMatch(/\.\d{3}/)
  })

  it('answers an unknown name with the soft rectangle, never nothing', () => {
    expect(frameShape('nope').id).toBe(DEFAULT_FRAME_SHAPE)
    expect(frameShape(undefined).id).toBe(DEFAULT_FRAME_SHAPE)
    expect(frameShape('blob-3').id).toBe('blob-3')
    expect(isFrameShape('heart')).toBe(true)
    expect(isFrameShape('Heart')).toBe(false)
  })
})
