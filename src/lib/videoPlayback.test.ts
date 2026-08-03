import { describe, it, expect } from 'vitest'
import {
  FIRST_FRAME,
  durationMs,
  elapsedForFrame,
  fetchOrder,
  frameAt,
  readyToPlay,
  timecode,
} from './videoPlayback'

describe('frameAt', () => {
  it('starts on the first frame, which is 1 and not 0', () => {
    // The wire is 1-based: /f/1.jpg is the first picture. An off-by-one here
    // requests /f/0.jpg on every clip, which 404s.
    expect(frameAt(0, 12, 24)).toBe(FIRST_FRAME)
    expect(FIRST_FRAME).toBe(1)
  })

  it('advances at the recorded rate', () => {
    // 12 fps: one frame every 83.3 ms.
    expect(frameAt(83, 12, 24)).toBe(1)
    expect(frameAt(84, 12, 24)).toBe(2)
    expect(frameAt(1000, 12, 24)).toBe(13)
  })

  it('wraps when looping', () => {
    expect(frameAt(2000, 12, 24)).toBe(1)
    expect(frameAt(2084, 12, 24)).toBe(2)
  })

  it('stops on the last frame when not looping', () => {
    expect(frameAt(999_999, 12, 24, false)).toBe(24)
  })

  it('does not divide by zero when the metadata lost its fps', () => {
    // A clip stored before fps was recorded would otherwise compute frame
    // Infinity and show a blank player, with nothing anywhere saying why.
    expect(Number.isFinite(frameAt(500, 0, 24))).toBe(true)
    expect(frameAt(500, 0, 24)).toBeGreaterThanOrEqual(1)
  })

  it('survives an empty sequence and negative time', () => {
    expect(frameAt(100, 12, 0)).toBe(FIRST_FRAME)
    expect(frameAt(-500, 12, 24)).toBe(FIRST_FRAME)
  })
})

describe('durationMs and elapsedForFrame are inverses', () => {
  it('round-trips a frame through its timestamp', () => {
    for (const frame of [1, 2, 13, 24]) {
      expect(frameAt(elapsedForFrame(frame, 12), 12, 24, false)).toBe(frame)
    }
  })

  it('measures the whole sequence', () => {
    expect(durationMs(24, 12)).toBe(2000)
    expect(durationMs(0, 12)).toBe(0)
  })
})

describe('timecode', () => {
  it('reads as minutes and seconds', () => {
    expect(timecode(0)).toBe('0:00')
    expect(timecode(2000)).toBe('0:02')
    expect(timecode(61_000)).toBe('1:01')
    expect(timecode(-100)).toBe('0:00')
  })
})

describe('fetchOrder', () => {
  it('asks for what is about to be shown first', () => {
    // Requesting 1..N in order buries the frames playback needs behind the
    // browser's per-host connection limit.
    expect(fetchOrder(5, 3)).toEqual([3, 4, 5, 1, 2])
  })

  it('covers every frame exactly once', () => {
    const out = fetchOrder(40, 17)
    expect(out).toHaveLength(40)
    expect(new Set(out).size).toBe(40)
    expect(Math.min(...out)).toBe(1)
    expect(Math.max(...out)).toBe(40)
  })

  it('clamps a position outside the sequence', () => {
    expect(fetchOrder(3, 99)).toEqual([3, 1, 2])
    expect(fetchOrder(3, -4)).toEqual([1, 2, 3])
  })

  it('returns nothing for an empty sequence', () => {
    expect(fetchOrder(0)).toEqual([])
  })
})

describe('readyToPlay', () => {
  it('waits for about half a second of material', () => {
    expect(readyToPlay(5, 60, 12)).toBe(false)
    expect(readyToPlay(6, 60, 12)).toBe(true)
  })

  it('does not wait for more frames than the clip has', () => {
    // A three-frame clip must not sit on a spinner forever waiting for six.
    expect(readyToPlay(3, 3, 12)).toBe(true)
  })

  it('always wants at least two, so playback never starts into a gap', () => {
    expect(readyToPlay(1, 10, 1)).toBe(false)
    expect(readyToPlay(2, 10, 1)).toBe(true)
  })
})
