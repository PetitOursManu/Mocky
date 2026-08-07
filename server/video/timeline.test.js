import { describe, it, expect } from 'vitest'
import * as node from './timeline.js'
// The TypeScript original. vitest resolves `.ts`; `node server/index.js` does
// not, which is the entire reason timeline.js exists — so this import is the one
// thing standing between the two copies and a silent divergence.
import * as web from '../../src/lib/video/timeline.ts'
import { readableIssues } from './timeline.js'

const ID_A = 'a'.repeat(64)
const ID_B = 'b'.repeat(64)
const scene = (over = {}) => ({ imageId: ID_A, durationMs: 3000, ...over })

/**
 * Every document below is run through BOTH schemas and the answers compared.
 *
 * A defect this catches, and the reason the corpus is this long: the two files
 * are edited months apart, by whoever is touching one side of the feature. A
 * bound raised on the browser alone gives a UI that accepts what the API then
 * refuses with a 400 nobody can reproduce; raised on the SERVER alone it is the
 * dangerous direction — the API accepts what nothing downstream can render.
 */
const CORPUS = [
  ['minimal, defaults unapplied', { scenes: [scene()] }],
  [
    'every field spelled out',
    {
      scenes: [
        scene({ kenBurns: 'pan-left', transitionOut: 'wipe-right', textOverlay: { content: 'Hi', position: 'top' } }),
        scene({ imageId: ID_B, durationMs: 15000, kenBurns: 'static', transitionOut: 'none', textOverlay: null }),
      ],
      outputFormat: 'webm',
      aspectRatio: '9:16',
    },
  ],
  ['exactly at the total ceiling', { scenes: Array.from({ length: 20 }, () => scene({ durationMs: 6000 })) }],
  [
    'one millisecond over the ceiling',
    { scenes: [...Array.from({ length: 19 }, () => scene({ durationMs: 6000 })), scene({ durationMs: 6001 })] },
  ],
  ['twenty scenes', { scenes: Array.from({ length: 20 }, () => scene({ durationMs: 1000 })) }],
  ['twenty-one scenes', { scenes: Array.from({ length: 21 }, () => scene({ durationMs: 1000 })) }],
  ['no scenes at all', { scenes: [] }],
  ['an unknown key on the timeline', { scenes: [scene()], audio: 'track.mp3' }],
  ['an unknown key on a scene', { scenes: [scene({ src: 'https://example.test/a.jpg' })] }],
  ['an unknown key on an overlay', { scenes: [scene({ textOverlay: { content: 'Hi', position: 'top', src: 'x' } })] }],
  ['an upper-case imageId', { scenes: [scene({ imageId: 'A'.repeat(64) })] }],
  ['an imageId that is a URL', { scenes: [scene({ imageId: 'https://example.test/a.jpg' })] }],
  ['a short imageId', { scenes: [scene({ imageId: 'a'.repeat(63) })] }],
  ['a scene shorter than the floor', { scenes: [scene({ durationMs: 999 })] }],
  ['a scene longer than the cap', { scenes: [scene({ durationMs: 15001 })] }],
  ['a fractional duration', { scenes: [scene({ durationMs: 3000.5 })] }],
  ['a duration sent as a string', { scenes: [scene({ durationMs: '3000' })] }],
  ['an unknown ken-burns move', { scenes: [scene({ kenBurns: 'dolly' })] }],
  ['an unknown transition', { scenes: [scene({ transitionOut: 'star-wipe' })] }],
  ['an unknown overlay position', { scenes: [scene({ textOverlay: { content: 'Hi', position: 'middle' } })] }],
  ['an empty overlay', { scenes: [scene({ textOverlay: { content: '', position: 'top' } })] }],
  ['an overlay of 121 characters', { scenes: [scene({ textOverlay: { content: 'x'.repeat(121), position: 'top' } })] }],
  ['an unknown output format', { scenes: [scene()], outputFormat: 'mov' }],
  ['an unknown aspect ratio', { scenes: [scene()], aspectRatio: '4:3' }],
  ['not an object at all', 'a video please'],
  ['null', null],
]

describe('the server copy matches src/lib/video/timeline.ts', () => {
  it('exports the same bounds and the same vocabularies', () => {
    expect(node.MAX_SCENES).toBe(web.MAX_SCENES)
    expect(node.MIN_SCENE_DURATION_MS).toBe(web.MIN_SCENE_DURATION_MS)
    expect(node.MAX_SCENE_DURATION_MS).toBe(web.MAX_SCENE_DURATION_MS)
    expect(node.MAX_TOTAL_DURATION_MS).toBe(web.MAX_TOTAL_DURATION_MS)
    expect(node.KEN_BURNS).toEqual([...web.KEN_BURNS])
    expect(node.TRANSITIONS).toEqual([...web.TRANSITIONS])
    expect(node.OVERLAY_POSITIONS).toEqual([...web.OVERLAY_POSITIONS])
    expect(node.OUTPUT_FORMATS).toEqual([...web.OUTPUT_FORMATS])
    expect(node.ASPECT_RATIOS).toEqual([...web.ASPECT_RATIOS])
  })

  for (const [label, doc] of CORPUS) {
    it(`agrees on ${label}`, () => {
      const a = node.VideoTimelineSchema.safeParse(doc)
      const b = web.VideoTimelineSchema.safeParse(doc)
      expect(a.success, label).toBe(b.success)
      if (a.success && b.success) {
        // Not just "both accepted": the DEFAULTS have to match too, or the
        // browser previews a crossfade the worker renders as a hard cut.
        expect(a.data).toEqual(b.data)
      } else {
        expect(readableIssues(a.error)).toEqual(readableIssues(b.error))
      }
    })
  }

  it('sums durations the same way', () => {
    const t = { scenes: [scene({ durationMs: 1000 }), scene({ durationMs: 2500 })] }
    expect(node.totalDurationMs(t)).toBe(web.totalDurationMs(t))
    expect(node.totalDurationMs(t)).toBe(3500)
  })
})

describe('readableIssues', () => {
  // `error.message` is a JSON dump of the issue tree. Put in a 400 body it reads
  // as a stack trace, and the one sentence the caller needs is buried in it.
  it('gives a path and a sentence per issue, not a JSON blob', () => {
    const parsed = node.VideoTimelineSchema.safeParse({ scenes: [scene({ imageId: 'nope' })] })
    expect(parsed.success).toBe(false)
    const issues = readableIssues(parsed.error)
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toBe('scenes.0.imageId')
    expect(issues[0].message).toMatch(/lower-case SHA-256/)
  })

  it('names the total-duration rule against the scenes list, not a scene', () => {
    const parsed = node.VideoTimelineSchema.safeParse({
      scenes: Array.from({ length: 20 }, () => scene({ durationMs: 15000 })),
    })
    const issues = readableIssues(parsed.error)
    expect(issues[0].path).toBe('scenes')
    expect(issues[0].message).toMatch(/300000 ms; the maximum is 120000 ms/)
  })

  it('survives something that is not a zod error', () => {
    expect(readableIssues(null)).toEqual([])
    expect(readableIssues({})).toEqual([])
  })
})
