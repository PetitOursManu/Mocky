import { describe, expect, it } from 'vitest'
import { buildBriefMediaSection, classifyMediaUrl, extractBriefMedia } from './briefMedia'

const PROXY =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_x%2Fhf_1.png&w=1744&q=85'

describe('extractBriefMedia', () => {
  it('reads addresses out of markdown tables and backticks, without their wrapping', () => {
    const text = `| covers | 1744 × 2336 | all 12 covers | ${PROXY} |\n(raw result: \`https://d8j0ntlcm91z4.cloudfront.net/user_x/hf_1.png\`).`
    const got = extractBriefMedia(text)
    expect(got.map((m) => m.url)).toEqual([PROXY, 'https://d8j0ntlcm91z4.cloudfront.net/user_x/hf_1.png'])
    expect(got.every((m) => m.kind === 'image')).toBe(true)
  })

  it('drops sentence punctuation and repeats', () => {
    const got = extractBriefMedia('See https://a.example/x.png. And again https://a.example/x.png, then stop.')
    expect(got).toEqual([{ url: 'https://a.example/x.png', kind: 'image' }])
  })
})

describe('classifyMediaUrl', () => {
  it('tells what the preview can do with each address', () => {
    expect(classifyMediaUrl(PROXY)).toBe('image')
    expect(classifyMediaUrl('https://d8j0ntlcm91z4.cloudfront.net/u/hf_2.mp4')).toBe('video')
    expect(classifyMediaUrl('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js')).toBe('script')
    expect(classifyMediaUrl('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/')).toBe('script')
    expect(classifyMediaUrl('https://fonts.googleapis.com/css2?family=Newsreader')).toBe('font')
    expect(classifyMediaUrl('https://fonts.google.com/specimen/Oswald')).toBe('font')
    expect(classifyMediaUrl('https://example.com/about')).toBe('other')
  })
})

describe('buildBriefMediaSection', () => {
  it('builds nothing for a brief without media, so its prompt is unchanged', () => {
    expect(buildBriefMediaSection(extractBriefMedia('A landing page, see https://example.com/about'))).toBe('')
  })

  it('allows each picture by its exact address and says what cannot load', () => {
    const s = buildBriefMediaSection(
      extractBriefMedia(`${PROXY} https://x.example/clip.mp4 https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`),
    )
    expect(s).toContain(`1. ${PROXY}`)
    expect(s).toContain('override the rule against external images, for these addresses only')
    expect(s).toContain('do not put these in a <video>')
    expect(s).toContain('these will NOT be available')
  })
})
