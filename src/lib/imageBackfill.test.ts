import { describe, it, expect } from 'vitest'
import { matchImagesToScreens, MATCH_WINDOW_MS } from './imageBackfill'
import type { LibraryImage } from './imageLibrary'

const T = 1_700_000_000_000

const img = (hash: string, createdAt: number, projects: string[]): LibraryImage => ({
  hash,
  prompt: 'p',
  provider: 'fal',
  width: 1024,
  height: 1024,
  createdAt,
  tags: ['hero'],
  projects,
  favorite: false,
})

const screen = (id: string, createdAt: number, imageHash?: string) => ({ id, createdAt, imageHash })

describe('matchImagesToScreens', () => {
  // The real case this exists for: image stored 33 ms before the screen is added.
  it('matches an image to the screen created right after it', () => {
    const out = matchImagesToScreens([screen('s1', T + 33)], [img('h1', T, ['p1'])], 'p1')
    expect(out).toEqual([{ screenId: 's1', hash: 'h1' }])
  })

  it('ignores images belonging to another project', () => {
    expect(matchImagesToScreens([screen('s1', T + 33)], [img('h1', T, ['other'])], 'p1')).toEqual([])
  })

  it('never touches a screen that already has an image', () => {
    expect(matchImagesToScreens([screen('s1', T + 33, 'already')], [img('h1', T, ['p1'])], 'p1')).toEqual([])
  })

  it('refuses a screen created BEFORE the image (it cannot be its screen)', () => {
    expect(matchImagesToScreens([screen('s1', T - 1000)], [img('h1', T, ['p1'])], 'p1')).toEqual([])
  })

  it('refuses a match outside the time window rather than guessing', () => {
    const far = screen('s1', T + MATCH_WINDOW_MS + 1)
    expect(matchImagesToScreens([far], [img('h1', T, ['p1'])], 'p1')).toEqual([])
  })

  it('pairs several screens in order, one image each', () => {
    const screens = [screen('s1', T + 50), screen('s2', T + 10_050)]
    const images = [img('h1', T, ['p1']), img('h2', T + 10_000, ['p1'])]
    expect(matchImagesToScreens(screens, images, 'p1')).toEqual([
      { screenId: 's1', hash: 'h1' },
      { screenId: 's2', hash: 'h2' },
    ])
  })

  it('never assigns the same screen twice when images outnumber screens', () => {
    const images = [img('h1', T, ['p1']), img('h2', T + 100, ['p1'])]
    const out = matchImagesToScreens([screen('s1', T + 200)], images, 'p1')
    expect(out).toHaveLength(1)
    expect(out[0].screenId).toBe('s1')
    expect(out[0].hash).toBe('h1') // the earliest image wins
  })

  it('picks the closest screen when two are in range', () => {
    const screens = [screen('s1', T + 5_000), screen('s2', T + 20)]
    expect(matchImagesToScreens(screens, [img('h1', T, ['p1'])], 'p1')).toEqual([{ screenId: 's2', hash: 'h1' }])
  })

  it('is safe on empty / malformed input', () => {
    expect(matchImagesToScreens([], [], 'p1')).toEqual([])
    expect(matchImagesToScreens([screen('s1', T)], [], 'p1')).toEqual([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(matchImagesToScreens([screen('s1', T)], [{ hash: 'h' } as any], 'p1')).toEqual([])
  })
})
