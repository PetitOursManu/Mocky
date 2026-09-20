import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import {
  ACCEPTABLE_WAIT_MS,
  BENCHMARK_FILMS,
  BENCHMARK_FILM_MS,
  BENCHMARK_TIERS,
  TYPICAL_FILM_MS,
  benchmarkEstimates,
  runBenchmark,
} from './benchmark.js'
import { RenderTimelineSchema, totalDurationMs } from './timeline.js'
import { fullTierFeaturesIn, threeDBlocksIn } from './three-d.js'
import { VideoQueue } from './queue.js'
import {
  DEFAULT_RENDER_TIER,
  RENDER_TIERS,
  VideoConfigStore,
  mergeVideoConfig,
  publicVideoConfig,
  videoThreeDEnabledFor,
} from './config.js'
import { createVideoAdminRouter } from './routes.js'

describe('the reference films', () => {
  /** A reference film the worker refuses measures nothing but the refusal. */
  it('are documents the renderer accepts, each as long as the estimates assume', () => {
    for (const tier of BENCHMARK_TIERS) {
      const parsed = RenderTimelineSchema.safeParse(BENCHMARK_FILMS[tier])
      expect(parsed.success, tier).toBe(true)
      expect(totalDurationMs(parsed.data)).toBe(BENCHMARK_FILM_MS)
    }
  })

  it('climb in cost: nothing in 3D, one 3D block, a 3D field under a 3D block', () => {
    expect(threeDBlocksIn(BENCHMARK_FILMS.flat)).toEqual([])
    expect(threeDBlocksIn(BENCHMARK_FILMS.limited)).toHaveLength(1)
    // The full film measures what full ADDS: every feature of the heavy set, and a solid.
    expect(fullTierFeaturesIn(BENCHMARK_FILMS.full)).toEqual(['world', 'cube', 'particles'])
    expect(threeDBlocksIn(BENCHMARK_FILMS.full)).toHaveLength(1)
    expect(fullTierFeaturesIn(BENCHMARK_FILMS.limited)).toEqual([])
  })
})

describe('what the timings say', () => {
  /** This desktop's own numbers: 16.0 s, 28.3 s and 31.4 s for five seconds of film. */
  const measured = { flat: 16_000, limited: 28_300, full: 31_400 }

  it('scales each timing to a typical film, and counts films an hour and people served at once', () => {
    const { tiers } = benchmarkEstimates(measured)
    expect(tiers.flat.perSecond).toBeCloseTo(3.2, 2)
    expect(tiers.flat.typicalMs).toBe(Math.round((16_000 / BENCHMARK_FILM_MS) * TYPICAL_FILM_MS))
    expect(tiers.full.filmsPerHour).toBe(Math.floor(3_600_000 / tiers.full.typicalMs))
    expect(tiers.full.simultaneousUsers).toBe(Math.floor(ACCEPTABLE_WAIT_MS / tiers.full.typicalMs))
  })

  it('recommends the most this machine carries, and flat when nothing fits', () => {
    expect(benchmarkEstimates(measured).recommended).toBe('full')
    // A small VPS: the 3D films take minutes.
    expect(benchmarkEstimates({ flat: 40_000, limited: 90_000, full: 140_000 }).recommended).toBe('flat')
    expect(benchmarkEstimates({ flat: 20_000, limited: 45_000, full: 80_000 }).recommended).toBe('limited')
  })
})

describe('running it', () => {
  let dir
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-bench-'))
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('renders the three films in the queue’s exclusive slot, and releases it', async () => {
    let clock = 0
    const rendered = []
    const worker = {
      render: async (timeline) => {
        rendered.push(timeline)
        clock += 10_000
        return { buffer: Buffer.from('x') }
      },
    }
    const queue = new VideoQueue({ dataDir: dir, render: async () => ({ videoHash: null }) })
    const result = await runBenchmark({ worker, queue, now: () => clock })
    expect(rendered).toEqual(BENCHMARK_TIERS.map((t) => BENCHMARK_FILMS[t]))
    expect(result.tiers.flat.renderMs).toBe(10_000)
    expect(queue.running).toBeNull()
  })

  /** A measurement taken behind somebody's film measures the wait. */
  it('refuses while a render is running, and a job waits for it to finish', async () => {
    let release
    const gate = new Promise((r) => (release = r))
    const queue = new VideoQueue({ dataDir: dir, render: async () => ({ videoHash: null }) })
    const running = queue.runExclusive('benchmark', () => gate)
    await expect(queue.runExclusive('again', async () => 1)).rejects.toMatchObject({ code: 'busy' })
    const job = queue.enqueue({ userId: 'u1', timeline: BENCHMARK_FILMS.flat })
    expect(job.status).toBe('queued')
    release()
    await running
    await queue.whenIdle()
    expect(job.status).toBe('done')
  })
})

describe('the server’s tier', () => {
  it('defaults to what every instance did before it existed', () => {
    expect(DEFAULT_RENDER_TIER).toBe('limited')
    expect(RENDER_TIERS).toEqual(['flat', 'limited', 'full'])
    expect(mergeVideoConfig({}, {}).renderTier).toBe('limited')
    expect(mergeVideoConfig({}, { renderTier: 'turbo' }).renderTier).toBe('limited')
    expect(mergeVideoConfig({}, { renderTier: 'full' }).renderTier).toBe('full')
  })

  /** A tier is about the machine; the lists are about people. Both must say yes. */
  it('turns 3D off for everyone at flat, whatever the lists say', () => {
    const cfg = { enabled: true, access: 'all', threeDAccess: 'all' }
    expect(videoThreeDEnabledFor({ ...cfg, renderTier: 'limited' }, { id: 'u1' })).toBe(true)
    expect(videoThreeDEnabledFor({ ...cfg, renderTier: 'flat' }, { id: 'u1' })).toBe(false)
  })

  /** A measurement an administrator could type in is not a measurement. */
  it('keeps the last test, and never lets the panel write one', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-bench-cfg-'))
    try {
      const store = new VideoConfigStore(dir)
      store.recordBenchmark({ at: 1, recommended: 'full' })
      store.update({ benchmark: { at: 2, recommended: 'flat' }, renderTier: 'full' })
      expect(store.publicView().benchmark).toEqual({ at: 1, recommended: 'full' })
      expect(store.publicView().renderTier).toBe('full')
      expect(publicVideoConfig(store.get()).renderTiers).toEqual(RENDER_TIERS)
      // Survives a restart.
      expect(new VideoConfigStore(dir).publicView().benchmark).toEqual({ at: 1, recommended: 'full' })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('POST /api/admin/video/benchmark', () => {
  async function call(deps) {
    const app = express()
    app.use(express.json())
    app.use('/admin', createVideoAdminRouter(deps))
    const server = app.listen(0)
    try {
      const { port } = server.address()
      const res = await fetch(`http://127.0.0.1:${port}/admin/benchmark`, { method: 'POST' })
      return { status: res.status, body: await res.json() }
    } finally {
      server.close()
    }
  }
  const config = () => {
    const saved = []
    return { saved, publicView: () => ({}), recordBenchmark: (r) => saved.push(r) }
  }

  it('reports and records a finished test', async () => {
    const cfg = config()
    const out = await call({
      config: cfg,
      worker: { render: async () => ({}) },
      queue: { runExclusive: async (_label, fn) => fn() },
    })
    expect(out.status).toBe(200)
    expect(out.body.recommended).toBeTruthy()
    expect(cfg.saved).toHaveLength(1)
  })

  it('says 409 while a render holds the worker, and 503 with no worker at all', async () => {
    const busy = Object.assign(new Error('A render is in progress or waiting.'), { code: 'busy' })
    const out = await call({
      config: config(),
      worker: { render: async () => ({}) },
      queue: { runExclusive: async () => { throw busy } },
    })
    expect(out.status).toBe(409)
    expect((await call({ config: config() })).status).toBe(503)
  })
})
