import { describe, it, expect } from 'vitest'
import { capabilitiesFor, capabilitiesUsedBy } from './select'

/**
 * The gap this closes, in one sentence: capabilities were chosen from the PROMPT
 * before any code existed, so a screen reaching for `<Animated>` on a prompt that
 * never mentioned animation rendered `undefined` — React error #130, once per
 * use, survived only because an error boundary caught it.
 */

describe('capabilitiesUsedBy', () => {
  it('finds a component used as a JSX tag', () => {
    expect(capabilitiesUsedBy('<Animated preset="fade-up">hello</Animated>')).toContain('animate')
  })

  it('finds a namespace used before a dot', () => {
    expect(capabilitiesUsedBy('<Icon.Mail className="h-4" />')).toContain('icons')
  })

  it('finds a self-closing tag with no space', () => {
    expect(capabilitiesUsedBy('<Animated/>')).toContain('animate')
  })

  it('catches the real screen that surfaced this', () => {
    // Four <Animated> and five Icon.* on a prompt about a design studio — no
    // word in it would have triggered the animation capability.
    const code = `
      <Animated preset="fade-up" delay={0.15}>
        <Icon.Menu className="h-5 w-5" />
        <Icon.ArrowRight strokeWidth={1.5} />
      </Animated>`
    const out = capabilitiesUsedBy(code)
    expect(out).toContain('animate')
    expect(out).toContain('icons')
  })

  it('ignores a name that only appears in text or a class', () => {
    // Every capability costs a script in every preview, so a word in a paragraph
    // must not pull one in.
    const code = '<p className="animated-thing">The Animated series was good</p>'
    expect(capabilitiesUsedBy(code)).not.toContain('animate')
  })

  it('is empty for code that uses nothing', () => {
    expect(capabilitiesUsedBy('function App(){ return <div className="p-4">hi</div> }')).toEqual([])
  })

  it('survives empty input', () => {
    expect(capabilitiesUsedBy('')).toEqual([])
    expect(capabilitiesUsedBy('   ')).toEqual([])
  })
})

describe('capabilitiesFor', () => {
  it('unions what was asked for with what was used', () => {
    expect(capabilitiesFor(['charts'], '<Animated/>').sort()).toEqual(['animate', 'charts'])
  })

  it('keeps a capability the prompt chose even if the code has not used it yet', () => {
    // Dropping it would break the screen on a later edit that adds the component
    // back, with no change to the screen's own text to explain why.
    expect(capabilitiesFor(['charts'], '<div/>')).toEqual(['charts'])
  })

  it('does not duplicate one that both agree on', () => {
    expect(capabilitiesFor(['animate'], '<Animated/>')).toEqual(['animate'])
  })
})
