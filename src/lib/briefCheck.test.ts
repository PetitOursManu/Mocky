import { describe, expect, it } from 'vitest'
import { briefImageCount, interactLoss, interactUnused, missingBriefImages } from './briefCheck'
import { extractBriefMedia } from './briefMedia'

const RAW = 'https://d8j0ntlcm91z4.cloudfront.net/user_x/hf_20261116_132032_30242d8c.png'
const PROXY = `https://images.higgs.ai/?default=1&output=webp&url=${encodeURIComponent(RAW)}&w=2200&q=85`
const OTHER = 'https://d8j0ntlcm91z4.cloudfront.net/user_x/hf_20261029_010644_837e04ca.png'
const media = extractBriefMedia(`sheet ${PROXY} (raw ${RAW}) and covers ${OTHER}`)

describe('missingBriefImages', () => {
  it('counts a proxy and its raw source as one picture', () => {
    expect(briefImageCount(media)).toBe(2)
  })

  it('accepts a picture named by its exact address or rebuilt around its file', () => {
    const rebuilt = "const S = 'https://images.higgs.ai/?url=' + encodeURIComponent('https://d8j0ntlcm91z4.cloudfront.net/user_x/hf_20261116_132032_30242d8c.png')"
    expect(missingBriefImages(`${rebuilt}; const C = "${OTHER}"`, media)).toEqual([])
  })

  it('names the pictures the code left out', () => {
    expect(missingBriefImages(`const C = "${OTHER}"`, media)).toEqual([PROXY])
    expect(missingBriefImages('<div className="bg-gray-200" />', media)).toHaveLength(2)
  })
})

describe('interactUnused', () => {
  it('flags an offered kit the code never reached for', () => {
    expect(interactUnused('function App(){ return <div/> }', ['icons', 'interact'])).toBe(true)
    expect(interactUnused('const t = useGlideTrack({ count: 5 })', ['interact'])).toBe(false)
    expect(interactUnused('function App(){ return <div/> }', ['icons'])).toBe(false)
  })
})

describe('interactLoss', () => {
  const before = `const S = { src: "${RAW}" }; function App(){ const t = useGlideTrack({count:3}); return <section id="hero"><SheetCrop sheet={S} box={[0,0,1,1]} /></section> }`
  it('says nothing when an edit kept everything', () => {
    expect(interactLoss(before, before.replace('hero"', 'hero" className="pt-8"'))).toBeNull()
  })
  it('names the gesture, the sheet and the handle an edit dropped', () => {
    const after = 'function App(){ return <section><div className="bg-gray-200" /></section> }'
    expect(interactLoss(before, after)).toEqual({ components: ['SheetCrop', 'useGlideTrack'], pictures: [RAW], ids: ['hero'] })
  })
})
