import { describe, it, expect } from 'vitest'
import { ScrollVideoSource } from './snippets/ScrollVideo'

/**
 * Which frame a pointer position picks.
 *
 * Lifted out of the shipped source and run, like Scene3D's arithmetic: the
 * snippet is a string no type-checker reads, and a frame off by one is a clip
 * that never reaches its last picture — nothing throws, the head just stops
 * turning a little early.
 */
const lift = (re: RegExp) => ScrollVideoSource.match(re)?.[0] ?? ''
const run = (name: string) =>
  new Function(`${lift(new RegExp(`function ${name}[\\s\\S]*?\\n\\}`))}\nreturn ${name}`)()

type Frame = (u: number, v: number, total: number, map?: unknown, axis?: string, reverse?: boolean) => number
const frame = run('mockySeqFrame') as Frame
const rest = run('mockySeqRest') as (r?: string) => { u: number; v: number }

describe('mockySeqFrame', () => {
  it('sweeps the whole clip along one axis, both ends reached', () => {
    expect(frame(0, 0.5, 60)).toBe(0)
    expect(frame(1, 0.5, 60)).toBe(59)
    expect(frame(0.5, 0.5, 61)).toBe(30)
    expect(frame(0.5, 0, 60, undefined, 'y')).toBe(0)
    expect(frame(0.5, 1, 60, undefined, 'y')).toBe(59)
  })

  it('reverses on request', () => {
    expect(frame(0, 0.5, 60, undefined, 'x', true)).toBe(59)
    expect(frame(1, 0.5, 60, undefined, 'x', true)).toBe(0)
  })

  it('clamps a pointer outside the box, and survives a nonsense position', () => {
    expect(frame(-3, 0, 60)).toBe(0)
    expect(frame(7, 0, 60)).toBe(59)
    expect(frame(NaN, NaN, 60)).toBe(0)
  })

  it('returns no frame for an empty clip', () => {
    expect(frame(0.5, 0.5, 0)).toBe(-1)
  })

  it('reads a gaze grid: rows top to bottom, cells left to right, frames counted from 1', () => {
    const map = [
      [10, 20, 30],
      [40, 50, 60],
    ]
    expect(frame(0, 0, 60, map)).toBe(9)
    expect(frame(0.99, 0, 60, map)).toBe(29)
    expect(frame(0.5, 0.99, 60, map)).toBe(49)
    // The far edge belongs to the last cell, not to a cell past it.
    expect(frame(1, 1, 60, map)).toBe(59)
  })

  it('treats a flat list as one row', () => {
    expect(frame(0, 0.9, 60, [5, 6, 7])).toBe(4)
    expect(frame(1, 0.1, 60, [5, 6, 7])).toBe(6)
  })

  it('keeps a map inside the clip, and falls back to the axis on a cell that names nothing', () => {
    expect(frame(0, 0, 48, [[999]])).toBe(47)
    expect(frame(1, 0.5, 60, [['x']])).toBe(59)
    expect(frame(1, 0.5, 60, [[0]])).toBe(59)
    expect(frame(1, 0.5, 60, [])).toBe(59)
  })
})

describe('mockySeqRest', () => {
  it('rests in the middle by default — a face at rest looks straight ahead', () => {
    expect(rest()).toEqual({ u: 0.5, v: 0.5 })
    expect(rest('nonsense')).toEqual({ u: 0.5, v: 0.5 })
    expect(rest('start')).toEqual({ u: 0, v: 0 })
    expect(rest('end')).toEqual({ u: 1, v: 1 })
  })
})
