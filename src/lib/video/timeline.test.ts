import { describe, it, expect } from 'vitest'
import {
  VideoTimelineSchema,
  SceneSchema,
  totalDurationMs,
  MAX_TOTAL_DURATION_MS,
  type VideoTimelineInput,
} from './timeline'

const HASH = 'a'.repeat(64)
const OTHER = 'b'.repeat(64)

const scene = (patch: Record<string, unknown> = {}) => ({ imageId: HASH, durationMs: 3000, ...patch })
const timeline = (patch: Record<string, unknown> = {}) => ({ scenes: [scene()], ...patch }) as VideoTimelineInput

describe('SceneSchema', () => {
  it('applies the documented defaults so an omission is never an accident', () => {
    const s = SceneSchema.parse({ imageId: HASH, durationMs: 2000 })
    expect(s.kenBurns).toBe('static')
    expect(s.transitionOut).toBe('crossfade')
    expect(s.textOverlay).toBe(null)
  })

  // Guards M2/M8: the timeline addresses the image library, it does not fetch.
  // A URL here would let a generated document pull third-party bytes into an
  // mp4 Mocky then serves as its own.
  it('refuses anything that is not a library hash — URLs above all', () => {
    for (const bad of ['https://example.com/a.png', '/api/images/' + HASH, 'data:image/png;base64,AAAA', '']) {
      expect(SceneSchema.safeParse(scene({ imageId: bad })).success).toBe(false)
    }
  })

  // `data/image-library/{hash}` is a path. Two spellings of one hash is a lookup
  // that misses on a case-sensitive volume and works on the developer's laptop.
  it('refuses an upper-case hash rather than lower-casing it', () => {
    expect(SceneSchema.safeParse(scene({ imageId: HASH.toUpperCase() })).success).toBe(false)
    expect(SceneSchema.safeParse(scene({ imageId: 'a'.repeat(63) })).success).toBe(false)
    expect(SceneSchema.safeParse(scene({ imageId: 'z'.repeat(64) })).success).toBe(false)
  })

  // No repair: a 40-second scene is a rejection, not a 15-second one. Clamping
  // would hand back a video nobody asked for and call it a success.
  it('refuses an out-of-range duration instead of clamping it', () => {
    expect(SceneSchema.safeParse(scene({ durationMs: 40000 })).success).toBe(false)
    expect(SceneSchema.safeParse(scene({ durationMs: 999 })).success).toBe(false)
    expect(SceneSchema.safeParse(scene({ durationMs: 3000.5 })).success).toBe(false)
    expect(SceneSchema.safeParse(scene({ durationMs: '3000' })).success).toBe(false)
  })

  it('refuses an unknown animation or transition name', () => {
    expect(SceneSchema.safeParse(scene({ kenBurns: 'spin' })).success).toBe(false)
    expect(SceneSchema.safeParse(scene({ transitionOut: 'dissolve' })).success).toBe(false)
  })

  // Strictness is what makes "no audio" a fact rather than a wish: an ignored
  // key would validate, render silently, and be reported as a success.
  it('refuses an unknown field on a scene', () => {
    expect(SceneSchema.safeParse(scene({ audioTrack: 'x.mp3' })).success).toBe(false)
    expect(SceneSchema.safeParse(scene({ src: 'https://example.com/a.png' })).success).toBe(false)
  })

  it('refuses an over-long overlay instead of truncating it, and an unknown overlay field', () => {
    const overlay = (patch: Record<string, unknown>) => scene({ textOverlay: { position: 'top', ...patch } })
    expect(SceneSchema.safeParse(overlay({ content: 'x'.repeat(120) })).success).toBe(true)
    expect(SceneSchema.safeParse(overlay({ content: 'x'.repeat(121) })).success).toBe(false)
    expect(SceneSchema.safeParse(overlay({ content: '' })).success).toBe(false)
    expect(SceneSchema.safeParse(scene({ textOverlay: { content: 'hi', position: 'middle' } })).success).toBe(false)
    expect(SceneSchema.safeParse(scene({ textOverlay: { content: 'hi', position: 'top', size: 'xl' } })).success).toBe(false)
  })
})

describe('VideoTimelineSchema', () => {
  it('defaults the output to mp4 / 16:9', () => {
    const t = VideoTimelineSchema.parse(timeline())
    expect(t.outputFormat).toBe('mp4')
    expect(t.aspectRatio).toBe('16:9')
  })

  it('refuses an empty timeline and one past the scene cap', () => {
    expect(VideoTimelineSchema.safeParse({ scenes: [] }).success).toBe(false)
    const many = Array.from({ length: 21 }, () => scene({ durationMs: 1000 }))
    expect(VideoTimelineSchema.safeParse({ scenes: many }).success).toBe(false)
  })

  // The whole point of the refinement: every scene here is individually legal,
  // and together they are a five-minute render.
  it('refuses a timeline whose scenes are each valid but total more than two minutes', () => {
    const twenty = Array.from({ length: 20 }, () => scene({ durationMs: 15000 }))
    const res = VideoTimelineSchema.safeParse({ scenes: twenty })
    expect(res.success).toBe(false)
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path[0] === 'scenes')
      expect(issue?.message).toContain(String(MAX_TOTAL_DURATION_MS))
      expect(issue?.message).toContain('300000') // says what was actually asked for
    }
  })

  it('accepts exactly the ceiling — the limit is inclusive', () => {
    const eight = Array.from({ length: 8 }, () => scene({ durationMs: 15000 }))
    const res = VideoTimelineSchema.safeParse({ scenes: eight })
    expect(res.success).toBe(true)
    if (res.success) expect(totalDurationMs(res.data)).toBe(MAX_TOTAL_DURATION_MS)
  })

  it('refuses an unknown top-level field, including the audio nobody implemented', () => {
    expect(VideoTimelineSchema.safeParse({ scenes: [scene()], audio: { url: 'x.mp3' } }).success).toBe(false)
    expect(VideoTimelineSchema.safeParse({ scenes: [scene()], fps: 60 }).success).toBe(false)
  })

  it('refuses an unknown format or ratio', () => {
    expect(VideoTimelineSchema.safeParse(timeline({ outputFormat: 'mov' })).success).toBe(false)
    expect(VideoTimelineSchema.safeParse(timeline({ aspectRatio: '4:3' })).success).toBe(false)
  })

  it('keeps distinct scenes distinct through parsing', () => {
    const t = VideoTimelineSchema.parse({
      scenes: [scene({ imageId: HASH, kenBurns: 'zoom-in' }), scene({ imageId: OTHER, transitionOut: 'none' })],
      aspectRatio: '9:16',
    })
    expect(t.scenes.map((s) => s.imageId)).toEqual([HASH, OTHER])
    expect(t.scenes[0].kenBurns).toBe('zoom-in')
    expect(t.scenes[1].transitionOut).toBe('none')
    expect(t.aspectRatio).toBe('9:16')
  })

  // A rejection must leave nothing usable behind, or a caller will be tempted
  // to ship the half of the document that parsed.
  it('returns no data at all when it rejects', () => {
    const res = VideoTimelineSchema.safeParse({ scenes: [scene({ durationMs: 99999 })] })
    expect(res.success).toBe(false)
    expect((res as { data?: unknown }).data).toBeUndefined()
  })
})
