import { describe, it, expect } from 'vitest'
import { DEFAULT_ENGINE, enginesFor, renderWithFallback, warmUpEngines } from './engine.js'

/**
 * The order the two engines are tried in, and the one case where the second
 * must NOT be tried. Both engines are stubs: neither is installed where this
 * suite runs, which is exactly why `engine.js` imports them lazily.
 */

const quiet = { warn() {}, log() {}, error() {} }
const film = { buffer: Buffer.from('mp4'), contentType: 'video/mp4' }

function engines(behaviour) {
  const calls = []
  const load = async (engine) => ({
    renderTimeline: async () => {
      calls.push(engine)
      const outcome = behaviour[engine]
      if (outcome instanceof Error) throw outcome
      return outcome
    },
    warmUp: async () => {
      if (behaviour[engine] instanceof Error) throw behaviour[engine]
      return { warm: true }
    },
  })
  return { calls, load }
}

describe('enginesFor', () => {
  it('starts with HyperFrames and keeps Remotion as the fallback', () => {
    expect(DEFAULT_ENGINE).toBe('hyperframes')
    expect(enginesFor({})).toEqual(['hyperframes', 'remotion'])
  })

  it('lets the administrator put Remotion first', () => {
    expect(enginesFor({ MOCKY_VIDEO_ENGINE: ' Remotion ' })).toEqual(['remotion', 'hyperframes'])
  })

  it('reads a mistyped engine as the default, not as a third engine', () => {
    expect(enginesFor({ MOCKY_VIDEO_ENGINE: 'remotoin' })).toEqual(['hyperframes', 'remotion'])
  })

  it('drops the fallback when asked to', () => {
    expect(enginesFor({ MOCKY_VIDEO_FALLBACK: 'none' })).toEqual(['hyperframes'])
    expect(enginesFor({ MOCKY_VIDEO_FALLBACK: 'false' })).toEqual(['hyperframes'])
    expect(enginesFor({ MOCKY_VIDEO_FALLBACK: 'true' })).toEqual(['hyperframes', 'remotion'])
    expect(enginesFor({ MOCKY_VIDEO_ENGINE: 'remotion', MOCKY_VIDEO_FALLBACK: 'none' })).toEqual(['remotion'])
  })
})

describe('renderWithFallback', () => {
  it('returns the first engine’s film and names it', async () => {
    const { calls, load } = engines({ hyperframes: film, remotion: film })
    const result = await renderWithFallback({}, { engines: ['hyperframes', 'remotion'], load, log: quiet })
    expect(result.engine).toBe('hyperframes')
    expect(calls).toEqual(['hyperframes'])
  })

  it('falls back to Remotion when HyperFrames fails', async () => {
    const { calls, load } = engines({ hyperframes: new Error('a frame was still waiting'), remotion: film })
    const warnings = []
    const result = await renderWithFallback({}, { engines: ['hyperframes', 'remotion'], load, log: { warn: (m) => warnings.push(m) } })
    expect(result.engine).toBe('remotion')
    expect(calls).toEqual(['hyperframes', 'remotion'])
    expect(warnings.join('\n')).toMatch(/hyperframes could not render this film, trying remotion — a frame was still waiting/)
  })

  it('reports the chosen engine’s error when both fail', async () => {
    const { load } = engines({ hyperframes: new Error('first'), remotion: new Error('second') })
    await expect(renderWithFallback({}, { engines: ['hyperframes', 'remotion'], load, log: quiet })).rejects.toThrow('first')
  })

  it('treats an engine that will not even load as a failure to fall back from', async () => {
    const load = async (engine) => {
      if (engine === 'hyperframes') throw new Error('Cannot find package @hyperframes/producer')
      return { renderTimeline: async () => film }
    }
    const result = await renderWithFallback({}, { engines: ['hyperframes', 'remotion'], load, log: quiet })
    expect(result.engine).toBe('remotion')
  })

  /**
   * The deadline speaking. A second engine started after an abort renders a
   * film nobody is waiting for, on a slot the route has already freed.
   */
  it('never falls back once the caller has given up', async () => {
    const controller = new AbortController()
    const calls = []
    const load = async (engine) => ({
      renderTimeline: async () => {
        calls.push(engine)
        controller.abort()
        throw new Error('RenderCancelledError')
      },
    })
    await expect(
      renderWithFallback({ signal: controller.signal }, { engines: ['hyperframes', 'remotion'], load, log: quiet }),
    ).rejects.toThrow('RenderCancelledError')
    expect(calls).toEqual(['hyperframes'])
  })
})

describe('warmUpEngines', () => {
  it('warms every engine and survives one that cannot load', async () => {
    const { load } = engines({ hyperframes: film, remotion: new Error('no Remotion in this image') })
    const report = await warmUpEngines({ engines: ['hyperframes', 'remotion'], load, log: quiet })
    expect(report.hyperframes).toEqual({ warm: true })
    expect(report.remotion).toEqual({ warm: false, detail: 'no Remotion in this image' })
  })
})
