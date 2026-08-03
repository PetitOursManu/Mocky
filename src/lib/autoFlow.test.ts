import { describe, it, expect } from 'vitest'
import { autoFlow } from './project'
import type { Screen } from './project'

function screen(id: string, over: Partial<Screen> = {}): Screen {
  return {
    id,
    name: id,
    prompt: '',
    code: 'function App(){return null}',
    componentName: 'App',
    createdAt: 0,
    x: 0,
    y: 0,
    w: 1440,
    h: 900,
    device: 'none',
    links: [],
    ...over,
  }
}

describe('autoFlow', () => {
  it('plays the screens in array order', () => {
    expect(autoFlow([screen('a'), screen('b'), screen('c')])).toEqual(['a', 'b', 'c'])
  })

  it('ignores canvas position entirely', () => {
    // Position is downstream of the array here — Arrange derives x/y FROM the
    // array — so a chain read out of coordinates would be rewritten by a tidy-up.
    const out = autoFlow([
      screen('first', { x: 9000, y: 9000 }),
      screen('second', { x: 0, y: 0 }),
    ])
    expect(out).toEqual(['first', 'second'])
  })

  it('starts where asked and keeps what follows', () => {
    expect(autoFlow([screen('a'), screen('b'), screen('c')], 'b')).toEqual(['b', 'c'])
  })

  it('falls back to the beginning for an id it does not know', () => {
    // A stale id — the screen was deleted while the menu was open — must not
    // yield an empty walkthrough with no explanation.
    expect(autoFlow([screen('a'), screen('b')], 'gone')).toEqual(['a', 'b'])
  })

  it('drops screens that never generated', () => {
    // A blank step is a hole in the story, not a beat of it.
    const out = autoFlow([screen('a'), screen('empty', { code: '' }), screen('b')])
    expect(out).toEqual(['a', 'b'])
  })

  it('treats whitespace-only code as no code', () => {
    expect(autoFlow([screen('a'), screen('blank', { code: '   \n ' })])).toEqual(['a'])
  })

  it('still starts from the right place when a blank sits before it', () => {
    const out = autoFlow([screen('blank', { code: '' }), screen('a'), screen('b')], 'b')
    expect(out).toEqual(['b'])
  })

  it('returns nothing for nothing', () => {
    expect(autoFlow([])).toEqual([])
    expect(autoFlow([screen('x', { code: '' })])).toEqual([])
  })
})
