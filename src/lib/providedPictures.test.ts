import { describe, it, expect } from 'vitest'
import { buildProvidedPicturesSection, PROVIDED_PICTURES_MAX } from './providedPictures'

const pic = (n: number, use = `picture ${n}`) => ({ hash: String(n).repeat(64).slice(0, 64), url: `https://m.example/api/images/${n}`, use })

describe('pictures handed to a generation', () => {
  it('builds nothing without pictures, so the prompt is the one it always was', () => {
    expect(buildProvidedPicturesSection([])).toBe('')
  })

  it('says which picture is for what, by URL, and forbids inventing others', () => {
    const s = buildProvidedPicturesSection([pic(1, 'hero: the storefront'), pic(2, 'the team')])
    expect(s).toContain('1. hero: the storefront → https://m.example/api/images/1')
    expect(s).toContain('2. the team → https://m.example/api/images/2')
    expect(s).toMatch(/Invent no other picture URL/)
  })

  it('keeps a requester\'s words on one bounded line', () => {
    const s = buildProvidedPicturesSection([pic(1, 'a\nmulti-line\n\nuse ' + 'x'.repeat(500))])
    const line = s.split('\n').find((l) => l.startsWith('1. '))!
    expect(line).not.toContain('\n')
    expect(line.length).toBeLessThan(260)
  })

  it('caps the count', () => {
    const many = Array.from({ length: PROVIDED_PICTURES_MAX + 3 }, (_, i) => pic(i + 1))
    expect(buildProvidedPicturesSection(many).split('\n').filter((l) => /^\d+\. /.test(l))).toHaveLength(PROVIDED_PICTURES_MAX)
  })

  it('keeps pixel art crisp and whole: no crop, no smoothing, a fixed size', () => {
    const s = buildProvidedPicturesSection([{ ...pic(1, 'the hero sprite'), pixelArt: true }])
    expect(s).toContain('1. the hero sprite [PIXEL ART] → https://m.example/api/images/1')
    expect(s).toContain('[image-rendering:pixelated]')
    expect(s).toContain('object-contain')
    expect(s).toMatch(/Never crop it/)
    // A screen with only sprites is never told to crop them.
    expect(s).not.toContain('object-cover')
  })

  it('gives photos and sprites their own rule when both are supplied', () => {
    const s = buildProvidedPicturesSection([pic(1, 'hero photo'), { ...pic(2, 'a coin icon'), pixelArt: true }])
    expect(s).toContain('1. hero photo → ')
    expect(s).toContain('2. a coin icon [PIXEL ART] → ')
    expect(s).toMatch(/each other picture .*object-cover/)
    expect(s).toContain('[image-rendering:pixelated]')
  })
})
