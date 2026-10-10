import { describe, it, expect } from 'vitest'
import { buildReuseSection, projectPictures, REUSE_MAX } from './projectPictures'

const h = (c: string) => c.repeat(64)

describe('the pictures a project already shows', () => {
  it('offers a Motion Ultra series, most recent screen first, without duplicates and within bounds', () => {
    const screens = [
      { createdAt: 1, ultra: { recipes: [], images: [h('a'), h('b')], planned: 3 as const } },
      { createdAt: 2, ultra: { recipes: [], images: [h('c'), h('a')], planned: 3 as const } },
      { createdAt: 3 },
    ]
    expect(projectPictures(screens)).toEqual([h('c'), h('a'), h('b')])
    expect(projectPictures([{ createdAt: 1 }])).toEqual([])
    const many = [{ createdAt: 1, ultra: { recipes: [], images: 'abcdef0123'.split('').map(h), planned: 6 as const } }]
    expect(projectPictures(many)).toHaveLength(REUSE_MAX)
  })

  // The case the series alone missed: a screen whose pictures came from Muse,
  // a free photo or a site capture, recorded nowhere but in its own code.
  it('reads every library picture a screen embeds, absolute or not', () => {
    const code = `
      <img src="https://mocky.example/api/images/${h('d')}" alt="" />
      <img src="/api/images/${h('e')}" />
      <div style={{ backgroundImage: 'url(https://mocky.example/api/images/${h('d')})' }} />`
    expect(projectPictures([{ createdAt: 1, code }])).toEqual([h('d'), h('e')])
  })

  it('takes the newer screen first, and its series before its code', () => {
    const screens = [
      { createdAt: 1, code: `<img src="/api/images/${h('a')}" />` },
      { createdAt: 2, code: `<img src="/api/images/${h('b')}" />`, ultra: { recipes: [], images: [h('c')], planned: 3 as const } },
    ]
    expect(projectPictures(screens)).toEqual([h('c'), h('b'), h('a')])
  })

  it('ignores what is not a picture of the library', () => {
    const code = [
      '<img src="https://images.example/api/images/library" />',
      `<a href="/api/images/${h('a')}abc">`, // not a hex boundary
      '<img src="/api/images/abc123" />', // too short to be a hash
      '<ScrollSequence base="/api/videos/0123456789abcdef/frames" />',
    ].join('\n')
    expect(projectPictures([{ createdAt: 1, code }])).toEqual([])
  })

  it('asks for them to be reused unless the request says otherwise, and says nothing when there are none', () => {
    const text = buildReuseSection([{ url: 'http://x/api/images/abc', about: 'the speaker' }])
    expect(text).toContain('REUSE them')
    expect(text).toContain('explicitly asks for other pictures or for none')
    expect(text).toContain('http://x/api/images/abc — shows: the speaker')
    expect(buildReuseSection([])).toBe('')
  })
})
