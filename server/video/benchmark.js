/**
 * "Tester ce serveur": how much Motion this machine can carry, measured.
 *
 * ── Why a measurement and not a setting ────────────────────────────────────
 *
 * The cost of a film is not a property of Mocky, it is a property of the host.
 * With no graphics card, headless Chrome draws every WebGL frame on the CPU, so a
 * full-frame 3D field nearly doubles a render (measured on a twelve-core desktop:
 * 3.2 s of work per second of film flat, 5.7 with one 3D field, 6.3 with two 3D
 * blocks). An administrator deciding how much 3D their instance allows cannot
 * know that number, and a guess in either direction is wrong for somebody: too
 * cautious and a strong machine renders flat films, too bold and a small VPS
 * leaves people staring at a spinner for ten minutes.
 *
 * So the admin panel renders three reference films, times them, and turns the
 * seconds into the three answers an administrator actually needs: how long a
 * typical film takes at each tier, how many films an hour the queue gets
 * through, and how many people can launch one at the same moment and all have it
 * within three minutes. It RECOMMENDS a tier; the administrator decides.
 *
 * ── What "simultaneous users" honestly means here ──────────────────────────
 *
 * Renders run one at a time (`queue.js` explains why), so nothing is simultaneous
 * on the machine: the last of N people who press the button together waits N
 * renders. The number reported is therefore that N, for a three-minute wait —
 * a throughput stated in the only unit a person reading the panel has.
 *
 * The reference films are hand-written documents: no model call, no picture, no
 * export stored. They go through the worker exactly like a real render, under the
 * queue's exclusive slot so no job is refused a 429 while the test holds it.
 */

/** How long each reference film is. Long enough that start-up is not the whole cost. */
export const BENCHMARK_FILM_MS = 5000

/** The film a person typically asks for, in the estimates. */
export const TYPICAL_FILM_MS = 12000

/** The longest acceptable wait for the last person in a simultaneous batch. */
export const ACCEPTABLE_WAIT_MS = 180_000

/** Past these, a tier is not recommended: a typical film would take longer than this. */
export const TIER_CEILING_MS = { flat: 150_000, limited: 150_000, full: 120_000 }

const THEME = {
  colors: { background: '#f6f4ee', text: '#1a1a18', accent: '#c2410c', surface: '#ffffff' },
  fonts: { heading: 'Inter', body: 'Inter' },
}

const scene = (layers, background) => ({ durationMs: BENCHMARK_FILM_MS, background, layers, transitionOut: 'none' })

/**
 * One film per tier, each the heaviest thing that tier allows in ordinary use.
 *
 * `full` is the set that tier exists for, all in one film: two scenes in the
 * continuous 3D world with the camera flying between them, a title drawn by the
 * swarm, a cube turning from one to the other, and a lit solid on the second —
 * so the number an administrator reads is the cost of what they are enabling,
 * not of the 3D a lower tier already had. Two scenes of half the reference length
 * each, so the film is exactly as long as the other two.
 */
export const BENCHMARK_FILMS = {
  flat: {
    template: 'composed',
    aspectRatio: '16:9',
    outputFormat: 'mp4',
    theme: THEME,
    scenes: [
      scene(
        [
          { kind: 'kicker', text: 'Référence', anchor: 'top-left' },
          { kind: 'heading', text: 'Un film sans 3D', level: 'display', anchor: 'center-left' },
          { kind: 'counter', to: 42, label: 'essais', anchor: 'center-right' },
        ],
        { kind: 'gradient' },
      ),
    ],
  },
  limited: {
    template: 'composed',
    aspectRatio: '16:9',
    outputFormat: 'mp4',
    theme: THEME,
    scenes: [
      scene(
        [
          { kind: 'solidScene', solid: 'torus', anchor: 'center-right' },
          { kind: 'heading', text: 'Un objet en 3D', anchor: 'center-left' },
        ],
        { kind: 'gradient' },
      ),
    ],
  },
  full: {
    template: 'composed',
    aspectRatio: '16:9',
    outputFormat: 'mp4',
    theme: THEME,
    scenes: [
      {
        durationMs: BENCHMARK_FILM_MS / 2,
        background: { kind: 'world' },
        transitionOut: 'cube',
        layers: [{ kind: 'heading', text: 'Un monde en 3D', anchor: 'center', letters: 'particles' }],
      },
      {
        durationMs: BENCHMARK_FILM_MS / 2,
        background: { kind: 'world' },
        transitionOut: 'none',
        layers: [
          { kind: 'solidScene', solid: 'torus', anchor: 'center-right' },
          { kind: 'heading', text: 'Qui continue', anchor: 'center-left' },
        ],
      },
    ],
  },
}

export const BENCHMARK_TIERS = ['flat', 'limited', 'full']

/**
 * The three answers, from the three timings. Pure, so the arithmetic a panel
 * prints can be checked without rendering anything.
 *
 * @param {{flat:number, limited:number, full:number}} renderMs  wall time of each reference film
 */
export function benchmarkEstimates(renderMs) {
  const tiers = {}
  for (const tier of BENCHMARK_TIERS) {
    const ms = Math.max(1, Number(renderMs?.[tier]) || 0)
    // Seconds of work per second of film, start-up included: the conservative
    // reading, since a short reference film carries its whole start-up cost.
    const perSecond = ms / BENCHMARK_FILM_MS
    const typicalMs = Math.round(perSecond * TYPICAL_FILM_MS)
    tiers[tier] = {
      renderMs: Math.round(ms),
      perSecond: Math.round(perSecond * 100) / 100,
      typicalMs,
      filmsPerHour: Math.floor(3_600_000 / typicalMs),
      simultaneousUsers: Math.floor(ACCEPTABLE_WAIT_MS / typicalMs),
    }
  }
  const recommended = [...BENCHMARK_TIERS].reverse().find((tier) => tiers[tier].typicalMs <= TIER_CEILING_MS[tier]) ?? 'flat'
  return { tiers, recommended }
}

/**
 * Render the three reference films and report.
 *
 * @param {{worker:{render:Function}, queue:{runExclusive:Function}, now?:()=>number}} deps
 */
export async function runBenchmark({ worker, queue, now = () => Date.now() }) {
  return queue.runExclusive('benchmark', async () => {
    const renderMs = {}
    for (const tier of BENCHMARK_TIERS) {
      const started = now()
      await worker.render(BENCHMARK_FILMS[tier], [])
      renderMs[tier] = now() - started
    }
    return { at: now(), filmMs: BENCHMARK_FILM_MS, typicalFilmMs: TYPICAL_FILM_MS, ...benchmarkEstimates(renderMs) }
  })
}
