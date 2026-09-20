import { describe, it, expect } from 'vitest'
import { IconsSource } from './Icons'

/**
 * Evaluates the snippet as the preview does — as source, in one scope — with a
 * React stand-in that records what it is asked to create.
 */
function loadIcons() {
  const React = { createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }) }
  // eslint-disable-next-line no-new-func
  return new Function('React', `${IconsSource}\nreturn Icon;`)(React) as Record<string, unknown>
}

describe('the Icon namespace', () => {
  it('draws the media and mood icons generated pages reach for', () => {
    const Icon = loadIcons()
    for (const name of ['Play', 'Pause', 'Music', 'Moon', 'Coffee', 'BookOpen', 'Video', 'Headphones', 'Sparkles', 'Leaf']) {
      expect(typeof Icon[name], name).toBe('function')
    }
  })

  /**
   * <Icon.Play /> before Play existed was undefined, React threw #130 and the
   * whole screen was lost — twice on one prompt. A name nobody drew is a detail;
   * it must render something rather than take the page down.
   */
  it('answers an unknown icon with a component, never undefined', () => {
    const Icon = loadIcons()
    const Unknown = Icon.Dribbble as (p?: object) => { type: string }
    expect(typeof Unknown).toBe('function')
    expect(Unknown().type).toBe('svg')
    // The idiom the capability documents still works.
    expect(Icon['Nope'] || Icon.MoreHorizontal).toBe(Icon['Nope'])
  })

  it('stays a plain namespace for everything that is not an icon name', () => {
    const Icon = loadIcons()
    expect(Icon.then).toBeUndefined()
    expect(Icon.toJSON).toBeUndefined()
    expect('Home' in Icon).toBe(true)
  })
})
