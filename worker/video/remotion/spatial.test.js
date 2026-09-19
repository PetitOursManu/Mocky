// Step four's arithmetic: the transitions that move both scenes, the continuous
// 3D world, and the swarm that draws a title. Its own file because each of the
// three is a new kind of claim — "the two faces of a cube meet on every frame",
// "the camera never stops", "the resting frame is the real text" — and each is
// checked here without Remotion, three or a browser, like the rest of the renderer.
import { describe, it, expect } from 'vitest'
import { contrastRatio } from './contrast.js'
import {
  EMPHASIS_ENTER_FRAMES,
  FPS,
  MESH_REACH,
  MIN_CUE_TAIL_FRAMES,
  PARTICLE_ENTER_FRAMES,
  SPATIAL_TRANSITIONS,
  SPATIAL_TRANSITION_MS,
  TRANSITION_MS,
  WORLD_REACHES,
  composedPalette,
  entranceStyle,
  exitStyle,
  particleSpan,
  planTimeline,
  resolveTheme,
  sceneMotion,
} from './composition.js'
import {
  WORLD_CORRIDOR,
  WORLD_STATION_DEPTH,
  worldCamera,
  worldColors,
  worldFlights,
  worldPath,
  worldShapes,
  worldStones,
  worldTravel,
} from './world.js'
import { PARTICLE_EXIT_FROM, particleOffset, particlePhase } from './blocks/text.js'

const scene = (extra = {}) => ({ durationMs: 4000, layers: [{ kind: 'heading', text: 'Hello' }], ...extra })
const film = (scenes) => ({ template: 'composed', scenes })

describe('the transitions that move both scenes', () => {
  it('gets the longer budget, still capped by the shorter scene', () => {
    const plan = planTimeline(film([scene({ transitionOut: 'cube' }), scene({ transitionOut: 'crossfade' }), scene()]))
    expect(plan.scenes[1].enterFrames).toBe(Math.floor((SPATIAL_TRANSITION_MS * FPS) / 1000))
    expect(plan.scenes[2].enterFrames).toBe(Math.floor((TRANSITION_MS * FPS) / 1000))
    const short = planTimeline(film([scene({ durationMs: 1000, transitionOut: 'dive' }), scene()]))
    expect(short.scenes[1].enterFrames).toBe(10)
  })

  it('tells the leaving scene about the same overlap the arriving one reads', () => {
    const plan = planTimeline(film([scene({ transitionOut: 'cube' }), scene({ transitionOut: 'iris' }), scene()]))
    for (let i = 0; i + 1 < plan.scenes.length; i++) {
      expect(plan.scenes[i].exitFrames).toBe(plan.scenes[i + 1].enterFrames)
      expect(plan.scenes[i].exitTransition).toBe(plan.scenes[i + 1].enterTransition)
    }
    expect(plan.scenes[2].exitFrames).toBe(0)
    expect(plan.scenes[2].exitTransition).toBe('none')
  })

  it('shows nothing of the next scene on the first frame and all of it once landed', () => {
    for (const kind of SPATIAL_TRANSITIONS) {
      expect(entranceStyle(kind, 24, 24), kind).toBe(null)
      const first = entranceStyle(kind, 0, 24)
      expect(first, kind).not.toBe(null)
    }
    expect(entranceStyle('dive', 0, 24).opacity).toBe(0)
    expect(entranceStyle('iris', 0, 24).clipPath).toBe('circle(0% at 50% 50%)')
    // A cube face starts edge-on: turned a quarter, at the far side of the frame.
    expect(entranceStyle('cube', 0, 24).transform).toMatch(/translateX\(100%\) rotateY\(90deg\)/)
  })

  it('raises a liquid level from wholly below the frame to wholly above it', () => {
    const ys = (style) =>
      style.clipPath
        .slice('polygon('.length, -1)
        .split(', ')
        .slice(2)
        .map((point) => parseFloat(point.split(' ')[1]))
    expect(Math.min(...ys(entranceStyle('liquid', 0, 24)))).toBeGreaterThanOrEqual(100)
    const late = entranceStyle('liquid', 23.99, 24)
    expect(Math.max(...ys(late))).toBeLessThanOrEqual(1)
  })

  it('moves the leaving scene only for the cube and the dive, and only in its last frames', () => {
    expect(exitStyle('cube', 10, 120, 24)).toBe(null)
    expect(exitStyle('cube', 96, 120, 24)).toBe(null)
    expect(exitStyle('cube', 108, 120, 24).transform).toMatch(/rotateY\(-/)
    expect(exitStyle('dive', 110, 120, 24).opacity).toBeLessThan(1)
    for (const kind of ['crossfade', 'iris', 'liquid', 'pixel', 'wipe-left', 'none']) {
      expect(exitStyle(kind, 110, 120, 24), kind).toBe(null)
    }
  })

  /**
   * The two faces are hinged on ONE edge: the leaving face's right edge and the
   * arriving face's left edge are at the same x on every frame, so the fold never
   * opens a gap onto the void behind it.
   */
  it('keeps the two faces of a cube meeting on one edge', () => {
    const enter = 24
    for (let f = 1; f < enter; f++) {
      const incoming = entranceStyle('cube', f, enter)
      const outgoing = exitStyle('cube', 120 - enter + f, 120, enter)
      const inX = parseFloat(incoming.transform.match(/translateX\(([-\d.e]+)%\)/)[1])
      const outX = parseFloat(outgoing.transform.match(/translateX\(([-\d.e]+)%\)/)[1])
      // incoming's hinge is its left edge at inX; outgoing's is its right edge at 100 + outX.
      expect(inX).toBeCloseTo(100 + outX, 6)
    }
  })
})

describe('the continuous world', () => {
  const plan = planTimeline(
    film([
      scene({ background: { kind: 'world' }, transitionOut: 'crossfade' }),
      scene({ background: { kind: 'world' }, transitionOut: 'crossfade' }),
      scene({ background: { kind: 'solid' } }),
      scene({ background: { kind: 'world' } }),
    ]),
  )
  const flights = worldFlights(plan)

  it('flies one station per cut, and never stands still', () => {
    let previous = -Infinity
    for (let g = 0; g <= plan.totalFrames; g++) {
      const u = worldTravel(flights, g)
      expect(u).toBeGreaterThan(previous)
      previous = u
    }
    const end = worldTravel(flights, plan.totalFrames)
    const cruise = (0.1 * plan.totalFrames) / FPS
    expect(end).toBeCloseTo(flights.length + cruise, 6)
  })

  /**
   * The flight is centred on the cut: by the middle of the overlap the camera is
   * halfway to the next station, so the old blocks leave while it moves off and
   * the new ones arrive while it settles.
   */
  it('is halfway between two stations in the middle of the overlap', () => {
    const cut = plan.scenes[1].from + plan.scenes[0].exitFrames / 2
    const before = worldTravel(flights, cut - flights[0].span / 2)
    const at = worldTravel(flights, cut)
    const after = worldTravel(flights, cut + flights[0].span / 2)
    expect(at - before).toBeCloseTo(after - at, 1)
    expect(after - before).toBeGreaterThan(0.95)
  })

  it('draws the same camera for the same film frame, whichever scene asks', () => {
    // Two world scenes overlap during a crossfade; both look through this call.
    const g = plan.scenes[1].from + 3
    expect(worldCamera(flights, g)).toEqual(worldCamera(flights, g))
  })

  it('keeps every stone out of the corridor the camera flies down', () => {
    const travel = worldTravel(flights, plan.totalFrames)
    const stones = worldStones(travel)
    expect(stones.length).toBeGreaterThan(20)
    for (const stone of stones) {
      const centre = worldPath(-stone.z / WORLD_STATION_DEPTH).x
      expect(Math.abs(stone.x - centre) - stone.width / 2).toBeGreaterThan(WORLD_CORRIDOR - 1)
    }
    // Deterministic: the same film lays the same place in every render tab.
    expect(worldStones(travel)).toEqual(stones)
    expect(worldShapes(travel)).toEqual(worldShapes(travel))
  })

  it('reports a ground term, since the world moves', () => {
    const palette = composedPalette(resolveTheme({}), { kind: 'world' })
    const motion = sceneMotion('composed', plan.scenes[0], 30, { ground: true })
    expect(palette.groundTint?.length).toBeGreaterThan(0)
    expect(motion.ground).toBeGreaterThan(0)
  })
})

describe('the world is painted only in colours the palette measured', () => {
  const THEMES = [
    {},
    { colors: { background: '#0b0b10', text: '#f5f5f0', accent: '#7c5cff' } },
    { colors: { background: '#f6f4ee', text: '#1a1a18', accent: '#c2410c' } },
    { colors: { background: '#101820', text: '#e8f0f2', accent: '#2dd4bf' } },
    { colors: { background: '#fff8e7', text: '#2b2118', accent: '#e11d48' } },
  ]

  it('mixes no more accent than the ramp it was measured on reaches', () => {
    for (const declared of THEMES) {
      const palette = composedPalette(resolveTheme(declared), { kind: 'world' })
      const colors = worldColors(palette)
      if (!colors) continue
      expect(WORLD_REACHES).toContain(colors.reach)
      expect(colors.reach).toBeGreaterThanOrEqual(MESH_REACH)
      const far = palette.ground.tint[palette.ground.tint.length - 1]
      expect(colors.reach).toBeCloseTo(far.alpha, 10)
    }
  })

  /**
   * The claim `world.js` makes in its header, as arithmetic: every run clears
   * against every face the world can paint at full strength — the densest the
   * fog lets anything be.
   */
  it('keeps every run legible against every face of every stone', () => {
    for (const declared of THEMES) {
      const palette = composedPalette(resolveTheme(declared), { kind: 'world' })
      const colors = worldColors(palette)
      if (!colors) continue
      for (const face of [colors.top, colors.side, colors.face, colors.rule, colors.shape, colors.ground]) {
        expect(contrastRatio(palette.display.color, face)).toBeGreaterThanOrEqual(3)
        expect(contrastRatio(palette.body.color, face)).toBeGreaterThanOrEqual(4.5 - 1e-9)
      }
    }
  })

  it('paints nothing when the tint yielded', () => {
    expect(worldColors({ ground: { color: '#000000' }, groundTint: undefined })).toBe(null)
    expect(worldColors({ ground: { color: '#000000' }, groundTint: [] })).toBe(null)
  })
})

describe('the swarm that draws a title', () => {
  it('takes longer than any other arrival, and still lands before its scene ends', () => {
    expect(particleSpan(120, 2)).toBe(PARTICLE_ENTER_FRAMES)
    for (let duration = 30; duration <= 150; duration += 7) {
      for (let cue = 0; cue <= duration - MIN_CUE_TAIL_FRAMES; cue += 3) {
        const span = particleSpan(duration, cue)
        expect(span).toBeGreaterThanOrEqual(EMPHASIS_ENTER_FRAMES)
        expect(cue + span).toBeLessThanOrEqual(duration)
      }
    }
  })

  it('reports that span in the scene motion', () => {
    const entry = planTimeline(film([scene({ layers: [{ kind: 'heading', text: 'Hi', letters: 'particles' }] })])).scenes[0]
    const early = sceneMotion('composed', entry, 2 + EMPHASIS_ENTER_FRAMES, {})
    expect(early.layers[0]).toBeLessThan(1)
  })

  /** The resting frame is the real text and no dot: the frame every size and ink was measured on. */
  it('rests on the text alone', () => {
    const rest = particlePhase(1, 0.5)
    expect(rest).toMatchObject({ text: 1, dots: 0, leaving: 0 })
    const off = particleOffset(7, 0.3, 200, { arrival: 1, leaving: 0 })
    expect(off.x).toBeCloseTo(0, 9)
    expect(off.y).toBeCloseTo(0, 9)
  })

  it('never leaves before the title has formed', () => {
    expect(particlePhase(0.8, 0.99).leaving).toBe(0)
    expect(particlePhase(1, PARTICLE_EXIT_FROM + 0.05).leaving).toBeGreaterThan(0)
    expect(particlePhase(1, 1)).toMatchObject({ leaving: 1, text: 0 })
  })

  it('starts as a cloud and is the same cloud in every render tab', () => {
    const start = particleOffset(11, 0.5, 200, { arrival: 0, leaving: 0 })
    expect(Math.hypot(start.x, start.y)).toBeGreaterThan(50)
    expect(particleOffset(11, 0.5, 200, { arrival: 0.4, leaving: 0 })).toEqual(
      particleOffset(11, 0.5, 200, { arrival: 0.4, leaving: 0 }),
    )
  })
})
