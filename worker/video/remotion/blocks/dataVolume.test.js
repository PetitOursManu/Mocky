// The two data blocks that are drawn by a renderer, as arithmetic.
//
// Everything a `.jsx` computes is out of reach of every test in this repository —
// Remotion and `three` are installed in `worker/video/` and nowhere else — so the
// only part of a GL block that can be held is the part that is not JSX. This file
// is that part, and the two claims it exists for are the two a rendered frame
// would otherwise be the first to check:
//
//   1. **the columns of a `solidChart` are comparable**, which is a statement
//      about the projection and not about the drawing: a vertical of world height
//      `h` has to project to `h·cos(elevation)` WHEREVER it stands, and no bar may
//      hide another. A 3D chart that fails either is a decoration, and the brief
//      that asked for this block said so before it was written;
//   2. **nothing holds still and nothing is random**, which is where 3D has
//      already cost this feature a defect: a solid turned through a whole number
//      of quarter-turns rendered three frames byte for byte identical, and the
//      shortest route to a "scattered" field of points is a die.
import { describe, it, expect } from 'vitest'
import { FIGURE_GAP_SHARE, LAND_MARK, LAND_ROWS, MAP_COLUMNS, MAP_NORTH, MAP_ROWS, MAP_SOUTH } from './dataFigures.js'
import { SOLID_BOUND } from './setPiece.js'
import {
  CHART_AZIMUTH,
  CHART_BAR_MAX,
  CHART_BAR_MIN,
  CHART_ELEVATION,
  CHART_LIGHT_CYCLES,
  GLOBE_ARC_KNIT,
  GLOBE_ARC_LIFT,
  GLOBE_ARC_STEPS_MAX,
  GLOBE_GRATICULE_STEPS,
  GLOBE_LAND_ALPHA,
  GLOBE_LIMB_BAND,
  GLOBE_MAX_TILT,
  GLOBE_MERIDIANS,
  GLOBE_PITCH_PX,
  GLOBE_POINTS_MAX,
  GLOBE_POINTS_MIN,
  GLOBE_RADIUS,
  GLOBE_RIPPLE_SPAN,
  GLOBE_SHELL_FLOOR,
  GLOBE_TURNS,
  SCENE_LIGHT,
  chartLightAt,
  chartOcclusion,
  chartProject,
  chartRowWidth,
  globeArc,
  globeArcSteps,
  globeArcs,
  globeCanvas,
  globeDotPx,
  globeFaceRotation,
  globeFacing,
  globeField,
  globeGraticule,
  globeIsLand,
  globeLattice,
  globeMarkerLight,
  globeMarkerRadius,
  globeMarkerRipple,
  globeMarkers,
  globeOrientation,
  globePointCount,
  globeRotate,
  globeScale,
  globeShell,
  globeVisible,
  joinPoints,
} from './dataVolume.js'

const DEG = Math.PI / 180
const box = (width, height) => ({ left: 0, top: 0, width, height })

/** Every box shape a zone can turn out to be, in the three ratios. */
const BOXES = [
  ['16:9 whole', box(1690, 950)],
  ['16:9 cell', box(563, 316)],
  ['16:9 strip', box(563, 118)],
  ['9:16 whole', box(906, 1288)],
  ['9:16 cell', box(302, 429)],
  ['1:1 whole', box(950, 950)],
]

describe('the globe’s lattice', () => {
  it('is a formula and not a die: the same count answers the same points, twice', () => {
    const once = globeLattice(500)
    const again = globeLattice(500)
    expect(once.map((p) => [p.x, p.y, p.z])).toEqual(again.map((p) => [p.x, p.y, p.z]))
  })

  /**
   * Every point is ON the sphere, which is the property the whole block rests on:
   * a lattice with a point inside the shell is a dot that reads as a hole.
   */
  it('puts every point on the unit sphere', () => {
    for (const point of globeLattice(1200)) {
      expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(1, 6)
    }
  })

  /**
   * And it covers the sphere EVENLY, which a latitude/longitude grid does not: at
   * 78° north a fixed step in both puts five times as many dots on the same
   * surface as it does at the equator, so the poles read as bright caps. Measured
   * by counting the points in eight equal-area bands of latitude, which is the
   * only way an "even" claim can be checked without a picture.
   */
  it('covers the sphere at nearly equal area', () => {
    const points = globeLattice(4000)
    const bands = Array.from({ length: 8 }, () => 0)
    for (const point of points) bands[Math.min(7, Math.floor(((point.y + 1) / 2) * 8))] += 1
    for (const count of bands) expect(count).toBeGreaterThan((4000 / 8) * 0.9)
    for (const count of bands) expect(count).toBeLessThan((4000 / 8) * 1.1)
  })

  /**
   * The land is the flat map's own mask, read through the sphere's coordinates.
   *
   * Sampled the other way round from `globeIsLand`: a cell of `LAND_ROWS` is
   * turned into a latitude and a longitude, then into a point, and the answer has
   * to come back the same. A globe whose Africa differed from the map's would be
   * two worlds in one film.
   */
  it('reads land off the same mask the flat map draws', () => {
    let land = 0
    for (let row = 0; row < MAP_ROWS; row += 7) {
      for (let col = 0; col < MAP_COLUMNS; col += 11) {
        const lat = MAP_NORTH - (row + 0.5) * ((MAP_NORTH - MAP_SOUTH) / MAP_ROWS)
        const lon = -180 + (col + 0.5) * (360 / MAP_COLUMNS)
        const point = {
          x: Math.cos(lat * DEG) * Math.sin(lon * DEG),
          y: Math.sin(lat * DEG),
          z: Math.cos(lat * DEG) * Math.cos(lon * DEG),
        }
        const expected = LAND_ROWS[row][col] === LAND_MARK
        expect(globeIsLand(point), `${row},${col}`).toBe(expected)
        if (expected) land += 1
      }
    }
    // A sweep that found no land at all would make the equality above vacuous.
    expect(land).toBeGreaterThan(20)
  })

  /**
   * Outside the mask's own window there is no land, and the field is the land
   * alone — the sea was measured and dropped, see `globeField`.
   */
  it('calls everything beyond the mask’s window sea, and keeps only the land', () => {
    expect(globeIsLand({ x: 0, y: 1, z: 0 })).toBe(false)
    expect(globeIsLand({ x: 0, y: -1, z: 0 })).toBe(false)
    const { land } = globeField(3000)
    expect(land.length).toBeGreaterThan(300)
    expect(land.length).toBeLessThan(3000)
    for (const point of land) expect(globeIsLand(point)).toBe(true)
  })

  /**
   * And the graticule is what makes the rest read as a ball: meridians that
   * converge at the poles and crowd towards the limb.
   */
  it('draws a graticule that is a sphere and not a scatter', () => {
    const grid = globeGraticule()
    expect(grid).toBe(globeGraticule())
    expect(grid.length).toBeGreaterThan(GLOBE_MERIDIANS * GLOBE_GRATICULE_STEPS)
    // Small enough to be the cheap half: the shell it replaced was several
    // thousand points and it cost twice the render budget this block is allowed.
    expect(grid.length).toBeLessThan(1400)
    for (const point of grid) expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(1, 6)
    // A meridian really does reach both hemispheres, or the mesh is a belt.
    expect(grid.some((point) => point.y > 0.9)).toBe(true)
    expect(grid.some((point) => point.y < -0.9)).toBe(true)
  })

  /**
   * The connections travel in the land's own buffer, because a buffer costs
   * about fifteen milliseconds a frame whatever is in it.
   */
  it('joins two buffers end to end without copying either away', () => {
    const a = Float32Array.from([1, 2, 3])
    const b = Float32Array.from([4, 5, 6])
    expect(Array.from(joinPoints(a, b))).toEqual([1, 2, 3, 4, 5, 6])
    expect(joinPoints(a, new Float32Array(0))).toBe(a)
    expect(joinPoints(new Float32Array(0), b)).toBe(b)
    expect(joinPoints(null, null)).toHaveLength(0)
  })
})

describe('the globe turns, and never all the way round', () => {
  it('does not end a scene where it started', () => {
    const first = globeOrientation('world', 0)
    const last = globeOrientation('world', 1)
    expect(last.yaw - first.yaw).toBeCloseTo(Math.PI * 2 * GLOBE_TURNS, 9)
    // The lesson `solidSpin` paid for: a whole number of turns is a last frame
    // identical to a first, which is what `tests/video-motion.test.js` compares.
    expect(GLOBE_TURNS % 1).not.toBe(0)
    expect(GLOBE_TURNS).toBeLessThan(1)
  })

  it('turns every dot of the shell to somewhere else', () => {
    const at = (life) => {
      const { yaw, tilt } = globeOrientation('world', life)
      return Array.from(globeVisible(globeGraticule(), yaw, tilt, GLOBE_RADIUS))
    }
    expect(at(0)).not.toEqual(at(1))
    // And on consecutive frames of an ordinary scene, which is the guarantee
    // `tests/video-motion.test.js` makes for every other block: a globe that
    // moved only between its two ends would still be a still frame in between.
    expect(at(0.5)).not.toEqual(at(0.5 + 1 / 180))
  })

  it('shows only the near side, which is about half of a shell', () => {
    const { yaw, tilt } = globeOrientation('world', 0.3)
    const points = globeLattice(1000)
    const shown = globeVisible(points, yaw, tilt, GLOBE_RADIUS)
    expect(shown.length / 3).toBeGreaterThan(400)
    expect(shown.length / 3).toBeLessThan(600)
    for (let i = 0; i < shown.length; i += 3) {
      expect(shown[i + 2]).toBeGreaterThan(0)
      expect(Math.hypot(shown[i], shown[i + 1], shown[i + 2])).toBeCloseTo(GLOBE_RADIUS, 6)
    }
  })

  /**
   * A region turns its own part of the world towards the camera, and never tips
   * the globe past the point where it stops looking like one.
   */
  it('faces the region the document named, within the tilt it is allowed', () => {
    for (const region of ['world', 'europe', 'americas', 'asia', 'africa']) {
      const facing = globeFacing(region)
      expect(facing.lon).toBeGreaterThanOrEqual(-180)
      expect(facing.lon).toBeLessThanOrEqual(180)
      const { yaw, tilt } = globeOrientation(region, 0)
      expect(Math.abs(tilt)).toBeLessThanOrEqual(GLOBE_MAX_TILT * DEG + 1e-9)
      // The centre of the region is on the near side at the start of the scene,
      // which is the whole of what naming one buys.
      const centre = globeRotate(
        {
          x: Math.cos(facing.lat * DEG) * Math.sin(facing.lon * DEG),
          y: Math.sin(facing.lat * DEG),
          z: Math.cos(facing.lat * DEG) * Math.cos(facing.lon * DEG),
        },
        yaw,
        tilt,
      )
      expect(centre.z, region).toBeGreaterThan(0.5)
    }
  })
})

describe('the globe inhabits its box', () => {
  it('is square, on the smaller side of whatever box it is given', () => {
    for (const [where, shape] of BOXES) {
      expect(globeCanvas(shape, 1080), where).toBe(Math.min(shape.width, shape.height))
    }
    // A box with nothing in it falls back to the frame rather than to zero
    // pixels: a canvas of no size is a GL context that fails to initialise.
    expect(globeCanvas(null, 1080)).toBe(1080)
  })

  /**
   * The dot count follows the canvas so the PITCH stays constant, which is what
   * makes the same globe a field of continents at full frame and a legible one in
   * a cell rather than a grey disc.
   */
  it('keeps the pitch, not the count, when the box changes', () => {
    const pitch = (side) => side * Math.sqrt(Math.PI / globePointCount(side))
    for (const side of [480, 700, 900, 1300]) {
      // The count is solved FOR the pitch, so it comes back to the pixel — which
      // is the claim: the same globe is a field of continents at full frame and a
      // legible one in a cell, rather than the same dots at two scales.
      expect(pitch(side), String(side)).toBeCloseTo(GLOBE_PITCH_PX, 0)
    }
    // And the two ends are clamps rather than the formula: a tiny box would ask
    // for a dozen dots and a huge one for a bitrate nothing can pay.
    expect(globePointCount(40)).toBe(GLOBE_POINTS_MIN)
    expect(globePointCount(20000)).toBe(GLOBE_POINTS_MAX)
    // A dot is a share of the pitch, and it is never smaller than a pixel.
    for (const side of [40, 320, 900, 20000]) {
      expect(globeDotPx(side, globePointCount(side)), String(side)).toBeGreaterThanOrEqual(1)
    }
    expect(globeDotPx(900, globePointCount(900))).toBeLessThan(20)
    expect(globeDotPx(900, globePointCount(900))).toBeGreaterThan(6)
  })

  /** A marker is bigger than a dot and small enough to be a place rather than a continent. */
  it('draws a marker as a few dots across', () => {
    const side = 900
    const dot = globeDotPx(side, globePointCount(side))
    const radius = globeMarkerRadius(side, dot)
    const pixels = (radius / GLOBE_RADIUS) * (side / 2)
    expect(pixels).toBeGreaterThan(dot * 0.8)
    expect(pixels).toBeLessThan(dot * 3)
    expect(globeMarkerRadius(0, dot)).toBe(0)
  })
})

describe('the globe’s markers and its connections', () => {
  it('puts every marker on land, once each', () => {
    const field = globeField(3000)
    const markers = globeMarkers(field, 8)
    expect(markers).toHaveLength(8)
    for (const marker of markers) expect(globeIsLand(marker)).toBe(true)
    expect(new Set(markers.map((m) => `${m.x},${m.y},${m.z}`)).size).toBe(8)
  })

  it('draws none when the document asked for none', () => {
    expect(globeMarkers(globeField(1000), 0)).toEqual([])
    expect(globeArcs([], 0, 0, GLOBE_RADIUS, 0.5)).toHaveLength(0)
  })

  /**
   * A marker fades out at the limb rather than blinking off, and it is lit on its
   * own phase — markers in step read as a status board rather than as places.
   */
  it('fades a marker into the limb and pulses each on its own phase', () => {
    const field = globeField(3000)
    const markers = globeMarkers(field, 6)
    const lights = markers.map((point, i) => globeMarkerLight(point, 0, 0, 0.37, i))
    const shown = lights.filter((one) => one.shown)
    expect(shown.length).toBeGreaterThan(0)
    for (const one of shown) {
      expect(one.light).toBeGreaterThan(0)
      expect(one.light).toBeLessThanOrEqual(1)
    }
    expect(new Set(shown.map((one) => Math.round(one.light * 1000))).size).toBeGreaterThan(1)
    // Behind the globe there is nothing to draw at all.
    expect(globeMarkerLight({ x: 0, y: 0, z: -1 }, 0, 0, 0.5, 0).shown).toBe(false)
  })

  /**
   * A MARKER IS NEVER DIMMER THAN THE CONTINENT IT STANDS ON, which is the
   * defect: the near-side fade was `z`, the cosine of the angle off the line of
   * sight, so a place halfway to the limb ran at a third of the land's own
   * strength while being drawn in the land's own ink. Six markers nobody could
   * find, on a rendered frame.
   *
   * The fade belongs at the limb — a marker about to pass behind the globe would
   * otherwise blink — and `GLOBE_LIMB_BAND` is where it starts: a cosine of 0.3
   * is the outer twentieth of the projected radius and nothing else.
   */
  it('never draws a place fainter than the land it is standing on', () => {
    const field = globeField(3000)
    const markers = globeMarkers(field, 8)
    for (let step = 0; step <= 40; step += 1) {
      const life = step / 40
      for (const [i, point] of markers.entries()) {
        const at = globeMarkerLight(point, 0, 0, life, i)
        if (!at.shown) continue
        // Anywhere but the limb band, a marker is at least as loud as the land.
        if (at.z >= GLOBE_LIMB_BAND) expect(at.light, `${i} @ ${life}`).toBeGreaterThanOrEqual(GLOBE_LAND_ALPHA - 1e-9)
        expect(at.light).toBeLessThanOrEqual(1 + 1e-9)
      }
    }
    // And it still goes out rather than blinking out: at the silhouette itself
    // there is nothing left of it.
    const edge = globeMarkerLight({ x: 0, y: 0, z: 1e-9 }, Math.PI / 2, 0, 0.3, 0)
    expect(edge.shown).toBe(true)
    expect(edge.light).toBeLessThan(0.01)
  })

  /**
   * THE RIPPLE, which is the distinction a single ink can still make.
   *
   * It has to leave the marker as the marker lights — two rhythms for one event
   * read as two events — so its phase is `markerPulse`'s own, and it has to be
   * GONE before the next one starts or six places become six targets.
   */
  it('sends a ripple out of each marker, in step with its own pulse', () => {
    for (const index of [0, 1, 5, 7]) {
      let seen = 0
      for (let step = 0; step < 60; step += 1) {
        const at = globeMarkerRipple(step / 60, index)
        expect(at.at, `${index} @ ${step}`).toBeGreaterThanOrEqual(1)
        expect(at.at).toBeLessThanOrEqual(GLOBE_RIPPLE_SPAN)
        expect(at.light).toBeGreaterThanOrEqual(0)
        expect(at.light).toBeLessThanOrEqual(1)
        // It fades as it grows: no ripple is both wide and loud.
        if (at.at > 1 + (GLOBE_RIPPLE_SPAN - 1) * 0.8) expect(at.light).toBeLessThan(0.05)
        if (at.light > 0.5) seen += 1
      }
      expect(seen).toBeGreaterThan(0)
    }
    // Two markers are never rippling in step, for `markerPulse`'s own reason.
    const together = [0, 1, 2, 3].map((i) => Math.round(globeMarkerRipple(0.31, i).at * 1000))
    expect(new Set(together).size).toBe(4)
  })

  /**
   * The ring lies ON the sphere rather than facing the camera, and the claim is
   * the one thing an Euler triple can get wrong: applied in `three`'s own `XYZ`
   * order it has to carry the ring's normal, `(0,0,1)`, onto the marker.
   */
  it('lays the ripple flat on the surface, wherever the place is', () => {
    const field = globeField(1500)
    for (const point of globeMarkers(field, 8)) {
      const [a, b] = globeFaceRotation(point)
      // Rx(a)·Ry(b)·(0,0,1), written out — the same composition `poseCorners`
      // derives one file over, and the reason this is arithmetic and not a
      // `lookAt`: that is a `three` method and this directory imports none.
      const turned = {
        x: Math.sin(b),
        y: -Math.sin(a) * Math.cos(b),
        z: Math.cos(a) * Math.cos(b),
      }
      expect(turned.x).toBeCloseTo(point.x, 9)
      expect(turned.y).toBeCloseTo(point.y, 9)
      expect(turned.z).toBeCloseTo(point.z, 9)
    }
    // `Math.abs`, because `atan2(-0, 0)` is `-0` and that is the same angle.
    expect(globeFaceRotation(undefined).map((v) => Math.abs(v))).toEqual([0, 0, 0])
  })

  /**
   * A connection follows the sphere rather than cutting through it — a chord
   * between two distant markers passes inside a shell whose far side is not
   * drawn — and it is lifted off the surface so it can be seen at all.
   */
  it('bows a connection over the surface instead of through it', () => {
    const from = { x: 0, y: 0, z: 1 }
    const to = { x: 1, y: 0, z: 0 }
    const arc = globeArc(from, to)
    expect(arc[0].x).toBeCloseTo(from.x, 6)
    expect(arc[arc.length - 1].x).toBeCloseTo(to.x, 6)
    for (const point of arc) expect(Math.hypot(point.x, point.y, point.z)).toBeGreaterThanOrEqual(1 - 1e-9)
    const middle = arc[Math.floor(arc.length / 2)]
    expect(Math.hypot(middle.x, middle.y, middle.z)).toBeCloseTo(1 + GLOBE_ARC_LIFT, 2)
    // Two markers that are the same point have no great circle between them; the
    // answer is a drawing rather than a division by zero (Q1).
    for (const point of globeArc(from, from)) expect(Number.isFinite(point.x)).toBe(true)
  })

  /**
   * A CONNECTION IS A STROKE AND NOT A SECOND LATTICE, which is the other field
   * a rendered frame showed nobody could read.
   *
   * It is drawn in the land's ink, at the land's size, in the land's own buffer —
   * so the ONLY thing that tells it from the continents it crosses is that its
   * points touch. Twenty-six of them did not: a fixed count spread over arcs whose
   * lengths differ by a factor of six is a row of separated dots on any
   * connection longer than a country, which is more land. The spacing is what is
   * held here, and the count is whatever delivers it.
   */
  it('spaces a connection so it reads as a stroke rather than as more land', () => {
    const field = globeField(3000)
    const markers = globeMarkers(field, 8)
    for (const [, shape] of BOXES) {
      const side = globeCanvas(shape, 900)
      const dot = globeDotPx(side, globePointCount(side))
      // The world-to-pixel conversion `globeMarkerRadius` makes, the other way.
      const perWorld = side / (2 * GLOBE_RADIUS)
      for (let i = 0; i + 1 < markers.length; i += 1) {
        const steps = globeArcSteps(markers[i], markers[i + 1], side, dot)
        expect(steps).toBeLessThanOrEqual(GLOBE_ARC_STEPS_MAX)
        const arc = globeArc(markers[i], markers[i + 1], steps)
        let widest = 0
        for (let k = 1; k < arc.length; k += 1) {
          const a = arc[k - 1]
          const b = arc[k]
          widest = Math.max(widest, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) * GLOBE_RADIUS * perWorld)
        }
        // Consecutive points closer than a dot's own width, so the discs overlap
        // and what the frame carries is one unbroken curve.
        expect(widest, `${i} on ${side}px`).toBeLessThanOrEqual(dot * GLOBE_ARC_KNIT + 1e-6)
      }
    }
    // A caller with no canvas still draws a trail rather than nothing (Q1).
    expect(globeArcs(markers, 0, 0, GLOBE_RADIUS, 0.5).length).toBeGreaterThan(0)
  })

  /**
   * The travel, at two frames that are NOT a whole number of link cycles apart —
   * which is the trap this test fell into for one pass. `LINK_PULSES` is 2, so
   * `life` 0.1 and 0.6 are exactly one cycle apart and the two frames really do
   * draw the same prefix of the same arcs; the assertion passed on the ULP that
   * separated `0.2` from `0.19999999999999996`. `solidSpin`'s lesson, arriving
   * through the test rather than through the code.
   */
  it('travels: the arcs drawn on one frame are not the arcs drawn on the next', () => {
    const markers = globeMarkers(globeField(3000), 5)
    const canvas = { side: 900, dot: 6 }
    const early = globeArcs(markers, 0, 0, GLOBE_RADIUS, 0.1, canvas)
    const later = globeArcs(markers, 0, 0, GLOBE_RADIUS, 0.43, canvas)
    expect(Array.from(early)).not.toEqual(Array.from(later))
  })

  it('arrives rather than appearing, and at full size when it has', () => {
    expect(globeScale(0)).toBeLessThan(1)
    expect(globeScale(1)).toBe(1)
  })
})

/**
 * NOTHING THIS BLOCK DRAWS LEAVES THE CANVAS — and the sphere is not the drawing.
 *
 * The export that made this section necessary: a globe on a pale ground whose
 * right half stopped on a straight vertical line a third of the way down the
 * frame. The sphere was innocent. `GLOBE_RADIUS` is `SOLID_BOUND`, whose own
 * sentence is "the exact radius at which a ball about the origin touches the edge
 * of its canvas and never crosses it" — and this block hangs four things off that
 * ball that are not on it: a connection bowing by `GLOBE_ARC_LIFT`, a marker
 * sphere standing proud of the surface, a ripple lying across it, and the dot
 * SPRITES themselves, which are pixels centred on their own point.
 *
 * So the claim held below is about the DRAWING and not about the shell: every
 * point of every cloud, plus the sprite that is painted around it, plus the rim
 * of every marker and of every ripple, lies inside the ball `SOLID_BOUND`
 * describes. That is a statement about world units and therefore about any
 * renderer — the alternative, measuring pixels, would be measuring the projection
 * `SOLID_BOUND` was derived from.
 *
 * It sweeps `life` because the failure was intermittent in exactly that
 * parameter: the globe turns, an arc's bulge crosses the limb during the scene,
 * and "not always well cropped" is what a user calls a frame that is cut on some
 * frames and not on others.
 */
describe('a globe draws inside its own canvas', () => {
  const LIVES = [0, 0.17, 0.33, 0.5, 0.68, 0.84, 1]
  const DOCUMENTS = [
    ['bare', { kind: 'globe', markers: 0, connections: false }],
    ['one place', { kind: 'globe', markers: 1, connections: true }],
    ['three places, no lines', { kind: 'globe', markers: 3, connections: false }],
    ['the schema’s own default', { kind: 'globe', markers: 3, connections: true }],
    ['eight places, all joined', { kind: 'globe', markers: 8, connections: true }],
  ]

  /** The furthest any point of one frame's drawing stands from the centre. */
  const reach = (block, side) => {
    const count = globePointCount(side)
    const field = globeField(count)
    const dot = globeDotPx(side, count)
    const shell = globeShell(block, side, dot)
    // The sprite is drawn in PIXELS around its point, so it comes back into world
    // units through the conversion the block itself makes — `globeMarkerRadius`
    // written the other way round.
    const sprite = ((dot / 2) * 2 * GLOBE_RADIUS) / side
    const radius = globeMarkerRadius(side, dot)
    const markers = globeMarkers(field, block.markers)
    let far = 0
    for (const life of LIVES) {
      const { yaw, tilt } = globeOrientation('world', life)
      const clouds = [
        globeVisible(globeGraticule(), yaw, tilt, shell),
        globeVisible(field.land, yaw, tilt, shell),
        block.connections ? globeArcs(markers, yaw, tilt, shell, life, { side, dot }) : new Float32Array(0),
      ]
      for (const cloud of clouds) {
        for (let i = 0; i + 2 < cloud.length; i += 3) {
          far = Math.max(far, Math.hypot(cloud[i], cloud[i + 1], cloud[i + 2]) + sprite)
        }
      }
      markers.forEach((point, i) => {
        const lit = globeMarkerLight(point, yaw, tilt, life, i)
        if (!lit.shown) return
        // A marker is a ball CENTRED on the surface, so it stands its own radius
        // proud of it; a ripple is a ring in the tangent plane, so its rim is the
        // hypotenuse. Both are measured at the widest the frame draws them.
        far = Math.max(far, shell + radius)
        far = Math.max(far, Math.hypot(shell, globeMarkerRipple(life, i).at * radius))
      })
    }
    return far
  }

  it('keeps every dot, arc, marker and ripple inside the ball the canvas was sized for', () => {
    for (const [, shape] of BOXES) {
      const side = globeCanvas(shape, 900)
      // A hundredth of a PIXEL, and it is stated in pixels on purpose: the
      // lattice arrives as unit vectors a square root built, so `|p|` is 1 to
      // within a few ulps and the shell multiplies that error by itself. A
      // tolerance written as `1e-9` would be a claim about floating point; this
      // one is a claim about the frame, which is what the section is about.
      const grain = (2 * GLOBE_RADIUS) / side / 100
      for (const [label, block] of DOCUMENTS) {
        expect(reach(block, side), `${label} on ${side}px`).toBeLessThanOrEqual(GLOBE_RADIUS + grain)
      }
    }
  })

  /**
   * And it is the ORNAMENTS that are paid for, not the block. A globe a document
   * hung nothing on keeps the radius it always had — the fix is a debt the
   * drawing owes, and a document that draws nothing owes nothing.
   */
  it('charges a globe for what it draws and for nothing else', () => {
    const side = globeCanvas(box(1690, 950), 900)
    const dot = globeDotPx(side, globePointCount(side))
    const sprite = ((dot / 2) * 2 * GLOBE_RADIUS) / side
    expect(globeShell({ kind: 'globe', markers: 0, connections: false }, side, dot)).toBeCloseTo(
      GLOBE_RADIUS - sprite,
      9,
    )
    // A single place draws no arc — `globeArcs` walks consecutive pairs — so it
    // pays for its own ball and its ripple and not for a bow nobody drew.
    const alone = globeShell({ kind: 'globe', markers: 1, connections: true }, side, dot)
    const joined = globeShell({ kind: 'globe', markers: 2, connections: true }, side, dot)
    expect(joined).toBeLessThan(alone)
    expect(globeShell({ kind: 'globe', markers: 2, connections: false }, side, dot)).toBe(alone)
  })

  /**
   * The floor is `Q1` and it is unreachable on any canvas a layout produces: a
   * box small enough for a marker to be wider than the world it stands on is a
   * box no zone of any of the three ratios can be. A globe drawn small beats a
   * globe that vanished from a film somebody waited two minutes for.
   */
  it('never solves a shell of nothing, however small the canvas', () => {
    for (const side of [1, 4, 17, 60]) {
      const dot = globeDotPx(side, globePointCount(side))
      const shell = globeShell({ kind: 'globe', markers: 8, connections: true }, side, dot)
      expect(shell, `${side}px`).toBeGreaterThanOrEqual(GLOBE_RADIUS * GLOBE_SHELL_FLOOR)
    }
    for (const [, shape] of BOXES) {
      const side = globeCanvas(shape, 900)
      const dot = globeDotPx(side, globePointCount(side))
      expect(
        globeShell({ kind: 'globe', markers: 8, connections: true }, side, dot),
        `${side}px is above the floor`,
      ).toBeGreaterThan(GLOBE_RADIUS * GLOBE_SHELL_FLOOR)
    }
  })
})

// ── solidChart ───────────────────────────────────────────────────────────────

describe('a solid chart is readable, and the projection is what says so', () => {
  /**
   * THE CLAIM. A vertical of world height `h` projects to `h·cos(elevation)`
   * wherever it stands — which is what a parallel projection means and what a
   * perspective one destroys. Checked over a grid of positions and depths rather
   * than at the origin, because the defect it refuses is precisely a bar that
   * draws differently BECAUSE of where it stands.
   */
  it('draws two equal values as two equal columns, wherever they stand', () => {
    const expected = Math.cos(CHART_ELEVATION * DEG)
    for (const x of [-3, -1, 0, 0.5, 2, 7]) {
      for (const z of [-1, -0.2, 0, 0.4, 1]) {
        for (const h of [0.1, 0.5, 1, 3]) {
          const foot = chartProject({ x, y: 0, z })
          const head = chartProject({ x, y: h, z })
          expect(head.y - foot.y, `x=${x} z=${z} h=${h}`).toBeCloseTo(h * expected, 9)
          // And the horizontal position does not depend on the height, which is
          // the other half of "parallel": a tall bar leans nowhere.
          expect(head.x, `x=${x} z=${z} h=${h}`).toBeCloseTo(foot.x, 9)
        }
      }
    }
  })

  /**
   * And no column hides another, which is the second thing a perspective chart
   * gets wrong. The inequality is `w + d·tan(azimuth) ≤ p` — the silhouette of a
   * yawed box against the pitch between two of them — and it is held rather than
   * the angle, so a yaw somebody widens fails here instead of in an export.
   */
  it('never lets one column hide another', () => {
    const { spread, pitch } = chartOcclusion()
    expect(spread).toBeLessThan(pitch)
    // The bound the angle really has, so the margin is visible rather than
    // implied: past it the row starts to overlap.
    const limit = Math.atan(FIGURE_GAP_SHARE / (1 - FIGURE_GAP_SHARE)) / DEG
    expect(CHART_AZIMUTH).toBeLessThan(limit)
    expect(chartOcclusion(limit + 2).spread).toBeGreaterThan(1)
    // A yaw of zero would be a flat chart with a lit top; the block is meant to
    // have volume, so the angle is not allowed to be nothing either.
    expect(CHART_AZIMUTH).toBeGreaterThan(5)
    expect(CHART_ELEVATION).toBeGreaterThan(5)
  })
})

describe('solidChartLayout', () => {
  const CHART = { kind: 'solidChart', values: [40, 70, 55, 90], labels: ['Lun', 'Mar', 'Mer', 'Jeu'], plinth: true }

  /** Rebuilt here rather than imported: the layout is what is under test. */
  const layoutOf = async (block, shape, unit = 42) =>
    (await import('./dataVolume.js')).solidChartLayout(block, shape, { unit, base: Math.min(shape.width, shape.height) })

  it('spends the whole box: the canvas plus the caption band', async () => {
    for (const [where, shape] of BOXES) {
      const layout = await layoutOf(CHART, shape)
      const band = layout.label.shown ? layout.label.height + layout.label.gap : 0
      expect(layout.canvas.height + band, where).toBe(layout.height)
      expect(layout.canvas.width, where).toBe(layout.width)
      expect(layout.width, where).toBe(shape.width)
      expect(layout.height, where).toBe(shape.height)
    }
  })

  /**
   * The drawing fills its canvas on at least one axis, exactly — which is the
   * fit — and crosses neither edge, which is the margin `composedSafeArea`
   * promises nothing crosses.
   */
  it('fits the canvas without crossing it', async () => {
    for (const [where, shape] of BOXES) {
      const layout = await layoutOf(CHART, shape)
      const corners = []
      for (const bar of layout.world.bars) {
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            for (const y of [0, 1]) {
              corners.push({ x: bar.x + (sx * bar.width) / 2, y, z: (sz * bar.depth) / 2 })
            }
          }
        }
      }
      const shot = corners.map((corner) => chartProject(corner))
      const across = shot.map((p) => p.x * layout.scale + layout.offset.x + layout.canvas.width / 2)
      const down = shot.map((p) => -(p.y * layout.scale + layout.offset.y) + layout.canvas.height / 2)
      expect(Math.min(...across), where).toBeGreaterThanOrEqual(-1)
      expect(Math.max(...across), where).toBeLessThanOrEqual(layout.canvas.width + 1)
      expect(Math.min(...down), where).toBeGreaterThanOrEqual(-1)
      expect(Math.max(...down), where).toBeLessThanOrEqual(layout.canvas.height + 1)
      // And it really uses one of the two, or the block is floating in its box.
      const width = Math.max(...across) - Math.min(...across)
      const height = Math.max(...down) - Math.min(...down)
      expect(
        Math.max(width / layout.canvas.width, height / layout.canvas.height),
        where,
      ).toBeGreaterThan(0.8)
    }
  })

  /** Double the box, double the drawing: the rule at the top of `composition.js`. */
  it('doubles what it draws when its box doubles', async () => {
    const one = await layoutOf(CHART, box(600, 400))
    const two = await layoutOf(CHART, box(1200, 800), 84)
    expect(two.scale / one.scale).toBeCloseTo(2, 1)
    expect(two.lanes[0].size / one.lanes[0].size).toBeCloseTo(2, 1)
  })

  /**
   * The value scale is the same on every chart, which is the difference between a
   * chart and a picture of one: nothing rescales to the data's own range, so a row
   * whose highest value is twenty draws a fifth of the plot rather than all of it.
   */
  it('does not rescale to the tallest column', async () => {
    const small = await layoutOf({ ...CHART, values: [8, 20, 12, 16] }, box(1690, 950))
    const large = await layoutOf({ ...CHART, values: [40, 100, 60, 80] }, box(1690, 950))
    expect(small.scale).toBeCloseTo(large.scale, 6)
    expect(small.world.bars[1].height).toBeCloseTo(0.2, 9)
    expect(large.world.bars[1].height).toBeCloseTo(1, 9)
  })

  /** A column stays a column: neither a paving slab in a strip nor a hair in a cell. */
  it('keeps a bar between the two proportions a bar has', async () => {
    for (const [where, shape] of BOXES) {
      for (const count of [2, 4, 8]) {
        const row = chartRowWidth(count, shape.width / shape.height)
        const bar = (row * (1 - FIGURE_GAP_SHARE)) / count
        expect(bar, `${where} × ${count}`).toBeGreaterThanOrEqual(CHART_BAR_MIN - 1e-9)
        expect(bar, `${where} × ${count}`).toBeLessThanOrEqual(CHART_BAR_MAX + 1e-9)
      }
    }
  })

  /**
   * The captions sit under the columns they name, in the order the document wrote
   * them — and the lane is the PROJECTION of a column's centre line rather than
   * its world position, which is the one number a flat caption over a turned
   * drawing has to get right.
   */
  it('centres a caption on the column it names', async () => {
    for (const [where, shape] of BOXES) {
      const layout = await layoutOf(CHART, shape)
      let last = -Infinity
      for (let i = 0; i < layout.lanes.length; i++) {
        const lane = layout.lanes[i]
        const centre = lane.start + lane.size / 2
        expect(centre, `${where} ${i}`).toBeGreaterThan(last)
        last = centre
        const drawn = chartProject({ x: layout.world.bars[i].x, y: 0, z: 0 })
        // Within a pixel: the lane's edges are rounded independently, exactly as
        // `tracks` rounds a flat chart's, so half a pixel on each of them is the
        // whole of the tolerance.
        const projected = drawn.x * layout.scale + layout.offset.x + layout.canvas.width / 2
        expect(Math.abs(centre - projected), `${where} ${i}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('reserves nothing for captions a document did not write', async () => {
    const bare = await layoutOf({ ...CHART, labels: null }, box(1690, 950))
    expect(bare.label.shown).toBe(false)
    expect(bare.canvas.height).toBe(bare.height)
  })

  /** A value of zero is a column that is not there, rather than a box with no faces. */
  it('draws no column for a value of zero', async () => {
    const layout = await layoutOf({ ...CHART, values: [0, 50] }, box(900, 600))
    expect(layout.world.bars[0].height).toBe(0)
    expect(layout.world.bars[1].height).toBeCloseTo(0.5, 9)
  })
})

describe('the light is what keeps a solid chart alive', () => {
  /**
   * The columns must NOT move once they have grown — a value that breathes is a
   * value nobody can read — so the continuous motion is the light. It differs on
   * every frame and it comes back nowhere near where it started, which is
   * `solidSpin`'s lesson written for a lamp.
   */
  it('moves on every frame and does not end where it began', () => {
    expect(chartLightAt(0)).not.toEqual(chartLightAt(1))
    expect(CHART_LIGHT_CYCLES % 1).not.toBe(0)
    const seen = new Set()
    for (let i = 0; i <= 30; i++) seen.add(chartLightAt(i / 30).map((n) => n.toFixed(6)).join(','))
    expect(seen.size).toBe(31)
  })

  /**
   * And it never swings behind the row: a chart lit from the back is a chart whose
   * every face sits at the ambient end of its own segment, which is a silhouette.
   */
  it('never lights the row from behind', () => {
    const length = Math.hypot(...SCENE_LIGHT)
    for (let i = 0; i <= 60; i++) {
      const at = chartLightAt(i / 60)
      expect(Math.hypot(...at)).toBeCloseTo(length, 6)
      // Still in front of the row and still above it, which is what the two
      // faces a viewer reads — the front and the top — need to be lit at all.
      expect(at[2]).toBeGreaterThan(0)
      expect(at[1]).toBeGreaterThan(0)
    }
  })
})

describe('the lens is the catalogue’s own', () => {
  /**
   * A globe is seen through the camera every lit object in this catalogue is seen
   * through, and it is drawn to the radius that camera's frustum touches. Two
   * objects in one film seen through two lenses read as two films — the argument
   * `easeOutCubic` already makes about movement.
   */
  it('shares the solid’s camera and its bounding radius', () => {
    expect(GLOBE_RADIUS).toBe(SOLID_BOUND)
  })
})
