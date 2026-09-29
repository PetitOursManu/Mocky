import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/*
 * Plain Node: no Web Audio, no localStorage. Both are faked, and the module is
 * re-imported per test because it keeps the page's one AudioContext.
 */

type Call = [string, ...number[]]

class FakeParam {
  value = 0
  calls: Call[] = []
  setValueAtTime(v: number, t: number) {
    this.calls.push(['set', v, t])
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push(['linear', v, t])
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    if (v <= 0) throw new RangeError('exponential ramp to a non-positive value')
    this.calls.push(['exp', v, t])
  }
}

class FakeNode {
  connect() {}
  disconnect() {}
}

class FakeOsc extends FakeNode {
  type = ''
  frequency = new FakeParam()
  onended: (() => void) | null = null
  started = -1
  stopped = -1
  start(t: number) {
    this.started = t
  }
  stop(t: number) {
    this.stopped = t
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam()
}

let contexts: FakeContext[] = []
let resumeAllowed = true

class FakeContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended'
  currentTime = 10
  destination = new FakeNode()
  oscs: FakeOsc[] = []
  gains: FakeGain[] = []
  buffers = 0
  constructor() {
    contexts.push(this)
  }
  resume() {
    if (resumeAllowed) {
      this.state = 'running'
      return Promise.resolve()
    }
    return new Promise<void>(() => {}) // a refused resume may never settle
  }
  createOscillator() {
    const o = new FakeOsc()
    this.oscs.push(o)
    return o
  }
  createGain() {
    const g = new FakeGain()
    this.gains.push(g)
    return g
  }
  createBuffer() {
    this.buffers++
    return {}
  }
  createBufferSource() {
    return { buffer: null, connect() {}, start() {} }
  }
}

const store = new Map<string, string>()
const storage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
}

async function load() {
  vi.resetModules()
  return import('./chime')
}

beforeEach(() => {
  contexts = []
  resumeAllowed = true
  store.clear()
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('AudioContext', FakeContext)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the phrases', () => {
  it('are short and quiet', async () => {
    const { CHIME_NOTES, chimeLength } = await load()
    for (const kind of ['done', 'failed'] as const) {
      expect(chimeLength(kind)).toBeLessThan(1)
      for (const n of CHIME_NOTES[kind]) expect(n.peak).toBeLessThanOrEqual(0.1)
    }
  })

  it('"done" rises and "failed" falls, lower', async () => {
    const { CHIME_NOTES } = await load()
    const [d1, d2] = CHIME_NOTES.done
    const [f1, f2] = CHIME_NOTES.failed
    expect(d2.freq).toBeGreaterThan(d1.freq)
    expect(f2.freq).toBeLessThan(f1.freq)
    expect(f1.freq).toBeLessThan(d1.freq)
  })

  it('every envelope starts at silence, ramps, and stops after it has decayed (no click)', async () => {
    const { scheduleChime, CHIME_FLOOR, chimeLength } = await load()
    const c = new FakeContext()
    scheduleChime(c as unknown as BaseAudioContext, 'done', 1)
    expect(c.oscs.length).toBeGreaterThan(0)
    c.gains.forEach((g, i) => {
      const [first, attack, decay] = g.gain.calls
      expect(first).toEqual(['set', 0, expect.any(Number)])
      expect(attack[0]).toBe('linear')
      expect(attack[1]).toBeGreaterThan(0)
      expect(decay).toEqual(['exp', CHIME_FLOOR, expect.any(Number)])
      // The oscillator outlives its own fade, never the other way round.
      expect(c.oscs[i].stopped).toBeGreaterThan(decay[2])
      expect(c.oscs[i].stopped).toBeLessThanOrEqual(1 + chimeLength('done') + 1e-9)
    })
  })
})

describe('the preference', () => {
  it('is on by default and remembered', async () => {
    const { loadChimeEnabled, saveChimeEnabled } = await load()
    expect(loadChimeEnabled()).toBe(true)
    saveChimeEnabled(false)
    expect(loadChimeEnabled()).toBe(false)
    saveChimeEnabled(true)
    expect(loadChimeEnabled()).toBe(true)
  })

  it('survives blocked storage', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    const { loadChimeEnabled, saveChimeEnabled } = await load()
    expect(() => saveChimeEnabled(false)).not.toThrow()
    expect(loadChimeEnabled()).toBe(true)
  })
})

describe('priming and playing', () => {
  it('primes one context inside the gesture, and reuses it', async () => {
    const { primeChime, playChime } = await load()
    primeChime()
    primeChime()
    expect(contexts).toHaveLength(1)
    expect(contexts[0].state).toBe('running')
    expect(contexts[0].buffers).toBe(1) // the silent unlock, once
    expect(await playChime('done')).toBe(true)
    expect(contexts).toHaveLength(1)
    expect(contexts[0].oscs.length).toBeGreaterThan(0)
  })

  it('opens no audio device when the chime is off', async () => {
    const { primeChime, playChime, saveChimeEnabled } = await load()
    saveChimeEnabled(false)
    primeChime()
    expect(contexts).toHaveLength(0)
    expect(await playChime('done')).toBe(false)
    expect(contexts).toHaveLength(0)
  })

  it('the test button plays even when the chime is off', async () => {
    const { playChime, saveChimeEnabled } = await load()
    saveChimeEnabled(false)
    expect(await playChime('failed', { force: true })).toBe(true)
  })

  it('stays silent, without hanging, when the browser refuses to resume', async () => {
    vi.useFakeTimers()
    resumeAllowed = false
    const { playChime } = await load()
    const p = playChime('done')
    await vi.advanceTimersByTimeAsync(300)
    expect(await p).toBe(false)
    expect(contexts[0].oscs).toHaveLength(0)
  })

  it('is silent where there is no Web Audio at all', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const { playChime, primeChime } = await load()
    expect(() => primeChime()).not.toThrow()
    expect(await playChime('done', { force: true })).toBe(false)
  })
})
