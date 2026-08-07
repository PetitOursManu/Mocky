import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SCENE_DURATION_MS,
  OVERLAY_MAX_LENGTH,
  addScene,
  clampDuration,
  draftBlockers,
  draftTotalMs,
  emptyDraft,
  formatSeconds,
  moveScene,
  removeScene,
  toTimelineInput,
  updateScene,
  type VideoDraft,
} from './draft'
import { MAX_SCENES, MAX_TOTAL_DURATION_MS, VideoTimelineSchema } from './timeline'

const IMG = 'a'.repeat(64)
const IMG2 = 'b'.repeat(64)

/** A draft of `n` scenes, all on the same picture. */
function withScenes(n: number, id = IMG): VideoDraft {
  let d = emptyDraft()
  for (let i = 0; i < n; i++) d = addScene(d, id)
  return d
}

describe('addScene', () => {
  it('opens on the schema’s own defaults, not on something livelier', () => {
    // A hand-built timeline and a model-written one naming the same images must
    // render the same film. They would not if the form defaulted to a zoom the
    // schema does not.
    const [scene] = addScene(emptyDraft(), IMG).scenes
    expect(scene.kenBurns).toBe('static')
    expect(scene.transitionOut).toBe('crossfade')
    expect(scene.overlayText).toBe('')
  })

  it('never makes the timeline illegal by itself, even at the scene ceiling', () => {
    // The bug this forbids: an "Add" button whose last permitted click puts the
    // draft over the 120 s cap and disables the render button it just filled.
    expect(MAX_SCENES * DEFAULT_SCENE_DURATION_MS).toBeLessThanOrEqual(MAX_TOTAL_DURATION_MS)
    expect(draftBlockers(withScenes(MAX_SCENES))).toEqual([])
  })

  it('refuses past the scene ceiling instead of growing a list the API will reject', () => {
    const full = withScenes(MAX_SCENES)
    expect(addScene(full, IMG2).scenes).toHaveLength(MAX_SCENES)
  })

  it('gives every scene its own key, including two scenes on one picture', () => {
    // A timeline that opens and closes on the same image is normal, so the
    // image id cannot be the React key — two rows would share one.
    const d = addScene(addScene(emptyDraft(), IMG), IMG)
    expect(d.scenes[0].key).not.toBe(d.scenes[1].key)
  })
})

describe('moveScene', () => {
  const three = (): VideoDraft => {
    let d = emptyDraft()
    for (const id of [IMG, IMG2, 'c'.repeat(64)]) d = addScene(d, id)
    return d
  }

  it('reorders without touching anything else', () => {
    const d = three()
    const moved = moveScene(d, d.scenes[2].key, -1)
    expect(moved.scenes.map((s) => s.key)).toEqual([d.scenes[0].key, d.scenes[2].key, d.scenes[1].key])
  })

  it('clamps at the ends rather than wrapping', () => {
    // Wrapping sends "up" from the first row to the last, and the user reads
    // that as the row having vanished.
    const d = three()
    expect(moveScene(d, d.scenes[0].key, -1).scenes.map((s) => s.key)).toEqual(d.scenes.map((s) => s.key))
    expect(moveScene(d, d.scenes[2].key, 1).scenes.map((s) => s.key)).toEqual(d.scenes.map((s) => s.key))
  })

  it('ignores a key that is not there', () => {
    const d = three()
    expect(moveScene(d, 'nope', 1)).toEqual(d)
  })
})

describe('clampDuration', () => {
  it('snaps onto the half-second ladder and stays inside the schema’s bounds', () => {
    expect(clampDuration(4200)).toBe(4000)
    expect(clampDuration(4300)).toBe(4500)
    expect(clampDuration(100)).toBe(1000)
    expect(clampDuration(99000)).toBe(15000)
  })

  it('survives the empty number input', () => {
    // `Number('')` is 0 and `Number('x')` is NaN; both reach here from a control
    // mid-edit, and a NaN duration is a scene the schema refuses with a message
    // about a field the user never saw.
    expect(clampDuration(NaN)).toBe(DEFAULT_SCENE_DURATION_MS)
  })

  it('only ever produces whole milliseconds', () => {
    // `durationMs` is `z.number().int()`. A 0.1 s step would have made 4166.66.
    for (const raw of [1234, 5678.9, 12345.5]) expect(Number.isInteger(clampDuration(raw))).toBe(true)
  })
})

describe('draftBlockers', () => {
  it('says nothing is there rather than letting an empty render be queued', () => {
    expect(draftBlockers(emptyDraft())).toEqual(['no-scenes'])
  })

  it('catches the total ceiling, which no per-scene bound can', () => {
    // 20 × 15 s is 300 s: every scene legal, the film two and a half times too
    // long. This is the check the per-scene slider cannot make.
    let d = withScenes(MAX_SCENES)
    d = { ...d, scenes: d.scenes.map((s) => ({ ...s, durationMs: 15000 })) }
    expect(draftTotalMs(d)).toBeGreaterThan(MAX_TOTAL_DURATION_MS)
    expect(draftBlockers(d)).toContain('over-budget')
  })

  it('catches an overlay past the legibility limit', () => {
    const d = updateScene(withScenes(1), withScenes(1).scenes[0].key, {})
    const long = { ...d, scenes: [{ ...d.scenes[0], overlayText: 'x'.repeat(OVERLAY_MAX_LENGTH + 1) }] }
    expect(draftBlockers(long)).toContain('overlay-too-long')
  })
})

describe('OVERLAY_MAX_LENGTH', () => {
  it('comes from the schema, so the input attribute cannot drift from the rule', () => {
    // Typed twice, the form is the half that loses: it would accept 140
    // characters and the render would be refused for a field the user filled in
    // on purpose.
    expect(OVERLAY_MAX_LENGTH).toBe(120)
    const overlong = VideoTimelineSchema.safeParse({
      scenes: [
        {
          imageId: IMG,
          durationMs: 2000,
          textOverlay: { content: 'x'.repeat(OVERLAY_MAX_LENGTH + 1), position: 'bottom' },
        },
      ],
    })
    expect(overlong.success).toBe(false)
  })
})

describe('toTimelineInput', () => {
  it('produces a document the schema accepts', () => {
    let d = withScenes(2)
    d = updateScene(d, d.scenes[0].key, { kenBurns: 'zoom-in', overlayText: 'Bonjour', overlayPosition: 'top' })
    expect(VideoTimelineSchema.safeParse(toTimelineInput(d)).success).toBe(true)
  })

  it('turns an empty overlay box into null, never into an empty string', () => {
    // `content` is `min(1)`, so '' is a validation failure — and a scene with no
    // caption is the ordinary case, not an error.
    const d = withScenes(1)
    expect(toTimelineInput(d).scenes[0].textOverlay).toBeNull()
    const spaces = { ...d, scenes: [{ ...d.scenes[0], overlayText: '   ' }] }
    expect(toTimelineInput(spaces).scenes[0].textOverlay).toBeNull()
  })

  it('trims the overlay it does keep', () => {
    const d = withScenes(1)
    const typed = { ...d, scenes: [{ ...d.scenes[0], overlayText: '  Chapitre 1  ' }] }
    expect(toTimelineInput(typed).scenes[0].textOverlay).toEqual({ content: 'Chapitre 1', position: 'bottom' })
  })

  it('drops the editor’s own fields — the schema is .strict()', () => {
    // `key` exists for React and for nothing else. Leaking it would be refused
    // by the whole-object strictness, which is the point of that strictness.
    const sent = toTimelineInput(withScenes(1)) as Record<string, unknown>
    expect(Object.keys(sent.scenes as object[])).toBeTruthy()
    expect((sent.scenes as Record<string, unknown>[])[0]).not.toHaveProperty('key')
    expect(VideoTimelineSchema.safeParse(sent).success).toBe(true)
  })
})

describe('removeScene', () => {
  it('removes exactly one row when two share a picture', () => {
    const d = withScenes(2)
    const left = removeScene(d, d.scenes[0].key)
    expect(left.scenes.map((s) => s.key)).toEqual([d.scenes[1].key])
  })
})

describe('formatSeconds', () => {
  it('follows the reader’s decimal mark', () => {
    // A hard-coded dot in a French panel is how an interface reads as
    // translated rather than written.
    expect(formatSeconds(4500, 'fr')).toBe('4,5')
    expect(formatSeconds(4500, 'en')).toBe('4.5')
  })

  it('always shows one decimal, so a column of durations does not jitter', () => {
    expect(formatSeconds(4000, 'en')).toBe('4.0')
    expect(formatSeconds(120000, 'en')).toBe('120.0')
  })
})
