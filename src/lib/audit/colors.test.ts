import { describe, expect, it } from 'vitest'
import {
  TAILWIND_COLORS,
  contrastRatio,
  declaredColors,
  parseColorClass,
  parseCssColor,
  relativeLuminance,
} from './colors'
import { inspectScreen, type ElementFact } from './inspect'

/** The element the test is about, found by tag, from real JSX through the real AST pass. */
async function factFor(jsx: string, tag: string): Promise<ElementFact> {
  const facts = await inspectScreen(`function App(){ return (${jsx}) }`)
  const el = facts.elements.find((e) => e.tag === tag)
  if (!el) throw new Error(`no <${tag}> in the parsed screen`)
  return el
}

describe('the palette table', () => {
  it('holds the values Tailwind actually ships', () => {
    // Spot checks against `tailwindcss/colors.js` and the bytes of the vendored
    // Play CDN build. A single wrong digit here is a contrast finding about a
    // colour that is not on the screen — the failure nobody would think to look
    // for, because the code around it is correct.
    expect(TAILWIND_COLORS.gray['400']).toBe('#9ca3af')
    expect(TAILWIND_COLORS.slate['950']).toBe('#020617')
    expect(TAILWIND_COLORS.indigo['600']).toBe('#4f46e5')
    expect(TAILWIND_COLORS.rose['50']).toBe('#fff1f2')
  })

  it('has all eleven shades for every family, as six-digit lower-case hex', () => {
    // A hand-edited table drifts: a missing 950, an uppercase #FFF, a five-digit
    // typo. `parseCssColor` would swallow some of those and `resolveValue` would
    // return the rest as a resolved colour, so the drift has to fail here.
    const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
    for (const [family, scale] of Object.entries(TAILWIND_COLORS)) {
      expect(Object.keys(scale).sort()).toEqual([...shades].sort())
      for (const shade of shades) {
        expect(`${family}-${shade}: ${scale[shade]}`).toBe(`${family}-${shade}: ${scale[shade].toLowerCase()}`)
        expect(scale[shade]).toHaveLength(7)
        expect(scale[shade].startsWith('#')).toBe(true)
      }
    }
  })

  it('covers the twenty-two families generated screens use', () => {
    expect(Object.keys(TAILWIND_COLORS)).toHaveLength(22)
  })
})

describe('contrastRatio', () => {
  it('matches the WCAG reference pairs', () => {
    // The three anchors of the formula: the maximum, the minimum, and the value
    // right at the AA threshold. #767676 on white is the canonical 4.54 — if the
    // luminance curve is wrong anywhere, that one moves first.
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 6)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 6)
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })

  it('does not care which colour is named first', () => {
    // The formula puts the lighter colour on top; passing text before background
    // or the other way round must not change the answer.
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(contrastRatio('#000000', '#ffffff'), 10)
  })

  it('is NaN rather than a number when a colour cannot be read', () => {
    // The safety mechanism, not an oversight: every comparison with NaN is
    // false, so a caller that forgets to check still cannot produce
    // `ratio < 4.5` and report a screen nobody measured.
    expect(contrastRatio('var(--brand)', '#ffffff')).toBeNaN()
    expect(contrastRatio('oklch(0.7 0.1 200)', '#ffffff')).toBeNaN()
    expect(4.5 > contrastRatio('#eeeeee', 'nonsense')).toBe(false)
  })

  it('refuses a translucent colour instead of ignoring its alpha', () => {
    // Black at 20% over white is light grey. Dropping the alpha would report
    // 21:1 for text that is barely visible — the worst possible direction for
    // this module to be wrong in.
    expect(contrastRatio('rgba(0, 0, 0, 0.2)', '#ffffff')).toBeNaN()
    expect(relativeLuminance('#00000033')).toBeNaN()
  })
})

describe('parseCssColor', () => {
  it('reads the literal forms a generated screen writes', () => {
    expect(parseCssColor('#112233')).toEqual({ hex: '#112233', alpha: 1 })
    expect(parseCssColor('#123')).toEqual({ hex: '#112233', alpha: 1 })
    expect(parseCssColor('#FFF')).toEqual({ hex: '#ffffff', alpha: 1 })
    expect(parseCssColor('rgb(1, 2, 3)')).toEqual({ hex: '#010203', alpha: 1 })
    // Modern CSS syntax: spaces, and a slash before the alpha.
    expect(parseCssColor('rgb(255 255 255 / 50%)')).toEqual({ hex: '#ffffff', alpha: 0.5 })
    expect(parseCssColor('hsl(0 0% 100%)')).toEqual({ hex: '#ffffff', alpha: 1 })
    expect(parseCssColor('hsl(210deg 100% 50%)')).toEqual({ hex: '#0080ff', alpha: 1 })
  })

  it('refuses what it does not actually understand', () => {
    // Named colours and oklch are not half-supported: a colour space guessed at
    // is a report that is confidently wrong, where a refusal is merely quiet.
    expect(parseCssColor('rebeccapurple')).toBeNull()
    expect(parseCssColor('oklch(0.7 0.1 200)')).toBeNull()
    expect(parseCssColor('var(--brand)')).toBeNull()
    expect(parseCssColor('#12345')).toBeNull()
    // `Number('0x1f')` is 31, so this used to read as a real red.
    expect(parseCssColor('rgb(0x1f, 0, 0)')).toBeNull()
    // `Number('')` is 0, so this used to read as black.
    expect(parseCssColor('rgb(, , )')).toBeNull()
  })
})

describe('parseColorClass', () => {
  it('resolves the ordinary palette classes', () => {
    expect(parseColorClass('text-gray-400')).toMatchObject({ role: 'text', hex: '#9ca3af', resolvable: true })
    expect(parseColorClass('bg-white')).toMatchObject({ role: 'bg', hex: '#ffffff', resolvable: true })
    expect(parseColorClass('border-red-500')).toMatchObject({ role: 'border', hex: '#ef4444', resolvable: true })
    // A side does not change the colour; `border-b-slate-200` is the single most
    // common border class a generated screen writes.
    expect(parseColorClass('border-b-slate-200')).toMatchObject({ role: 'border', hex: '#e2e8f0' })
    // `!` changes precedence, never the value.
    expect(parseColorClass('!bg-black')).toMatchObject({ hex: '#000000', resolvable: true })
  })

  it('resolves arbitrary values', () => {
    expect(parseColorClass('bg-[#112233]')).toMatchObject({ role: 'bg', hex: '#112233', resolvable: true })
    expect(parseColorClass('text-[rgb(1,2,3)]')).toMatchObject({ role: 'text', hex: '#010203', resolvable: true })
    // Tailwind escapes spaces inside an arbitrary value as underscores.
    expect(parseColorClass('bg-[rgb(1_2_3)]')).toMatchObject({ hex: '#010203', resolvable: true })
  })

  it('returns null for a class that declares no colour at all', () => {
    // The distinction the whole module rests on: `null` is "not a colour class",
    // `resolvable: false` is "a colour we cannot read". Conflating them would
    // make every arbitrary font size look like a mystery colour.
    expect(parseColorClass('text-lg')).toBeNull()
    expect(parseColorClass('border-2')).toBeNull()
    expect(parseColorClass('text-[13px]')).toBeNull()
    expect(parseColorClass('flex')).toBeNull()
    expect(parseColorClass('')).toBeNull()
    // Object.prototype leaks a function through a bare property lookup, which
    // would have come back as a resolved colour.
    expect(parseColorClass('bg-constructor')).toBeNull()
  })

  it('never returns a hex it will not stand behind', () => {
    // The one invariant a caller is allowed to rely on: `hex` is non-null
    // exactly when `resolvable` is true. Anything else and a caller who reads
    // `hex` without checking gets a colour that is not painted.
    const unresolvable = [
      'bg-black/50',
      'bg-transparent',
      'text-current',
      'text-inherit',
      'bg-[var(--brand)]',
      'text-[color:var(--ink)]',
      'bg-[oklch(0.7_0.1_200)]',
      'hover:bg-black',
      'dark:text-white',
      'md:bg-slate-900',
    ]
    for (const cls of unresolvable) {
      const parsed = parseColorClass(cls)
      expect(`${cls}: ${parsed?.resolvable}`).toBe(`${cls}: false`)
      expect(`${cls}: ${parsed?.hex}`).toBe(`${cls}: null`)
    }
  })

  it('names why it could not resolve, because the reasons read differently', () => {
    expect(parseColorClass('bg-black/50')?.reason).toBe('translucent')
    expect(parseColorClass('bg-transparent')?.reason).toBe('transparent')
    expect(parseColorClass('text-current')?.reason).toBe('contextual')
    expect(parseColorClass('bg-[var(--brand)]')?.reason).toBe('variable')
    expect(parseColorClass('bg-[oklch(0.7_0.1_200)]')?.reason).toBe('unparseable')
    expect(parseColorClass('hover:bg-black')?.reason).toBe('stateful')
  })

  it('accepts an opacity modifier of 100 as fully opaque', () => {
    // `/100` is what a model writes when it means "no transparency"; refusing it
    // would drop a perfectly readable colour on the floor.
    expect(parseColorClass('bg-black/100')).toMatchObject({ hex: '#000000', resolvable: true })
    expect(parseColorClass('bg-black/[.06]')).toMatchObject({ resolvable: false, reason: 'translucent' })
  })

  it('is not fooled by a colon or a slash inside an arbitrary value', () => {
    // `bg-[url(data:image/png;base64,…)]` carries both separators inside its
    // value. Splitting the class on the first colon turns the URL into a variant
    // and the rest into a broken value.
    const parsed = parseColorClass('bg-[url(data:image/png;base64,iVBORw0KGgo=)]')
    expect(parsed).toMatchObject({ role: 'bg', resolvable: false, reason: 'image' })
  })
})

describe('what one element declares', () => {
  it('reads text and background off the element itself', async () => {
    const el = await factFor('<p className="bg-white text-slate-700">Bonjour</p>', 'p')
    const colors = declaredColors(el)
    expect(colors.text).toMatchObject({ hex: '#334155', resolvable: true })
    expect(colors.background).toMatchObject({ hex: '#ffffff', resolvable: true })
    expect(colors.comparable).toBe(true)
    expect(contrastRatio(colors.text.hex!, colors.background.hex!)).toBeGreaterThan(4.5)
  })

  it('NEVER assumes a white background when none is declared', async () => {
    // The headline rule of the module. A background usually comes from a wrapper
    // this analysis cannot follow — `ancestors` is tag names only — and
    // defaulting to white reports every dark screen as unreadable. A missing
    // contrast finding costs nothing; a false one teaches the reader to ignore
    // the panel, including the day it is right.
    const el = await factFor('<div className="bg-slate-900"><p className="text-slate-300">Salut</p></div>', 'p')
    const colors = declaredColors(el)
    expect(colors.text).toMatchObject({ hex: '#cbd5e1', resolvable: true })
    expect(colors.background.resolvable).toBe(false)
    expect(colors.background.hex).toBeNull()
    expect(colors.background.reason).toBe('undeclared')
    expect(colors.comparable).toBe(false)
  })

  it('says so when the class list is computed at runtime', async () => {
    // `className={cn(...)}` is everywhere in generated screens. "No background"
    // would be true of the source and false of the screen.
    const el = await factFor('<p className={cn("p-4", dark && "bg-black")}>Salut</p>', 'p')
    const colors = declaredColors(el)
    expect(colors.text.reason).toBe('dynamic')
    expect(colors.background.reason).toBe('dynamic')
  })

  it('stands down when a style prop could be setting the colours', async () => {
    // `style={{ background: c }}` wins over the classes and cannot be read here,
    // so judging the classes would be judging the half of the styling that loses.
    const el = await factFor('<p className="bg-white text-white" style={{ background: c }}>Salut</p>', 'p')
    expect(declaredColors(el).comparable).toBe(false)
    expect(declaredColors(el).background.reason).toBe('inline-style')
  })

  it('does not read a gradient hero as its fallback colour', async () => {
    // `bg-white bg-gradient-to-r from-violet-600` paints the gradient; reading
    // the flat fallback would report white text on white for a hero that is
    // perfectly legible.
    const el = await factFor(
      '<div className="bg-white bg-gradient-to-r from-violet-600 to-indigo-600 text-white">Hero</div>',
      'div',
    )
    const colors = declaredColors(el)
    expect(colors.background).toMatchObject({ resolvable: false, reason: 'gradient' })
    expect(colors.comparable).toBe(false)
  })

  it('stands down on a translucent surface', async () => {
    // A sticky header is `bg-white/80` over whatever scrolls underneath. What is
    // painted there is a fact about the backdrop, which nothing here can see.
    const header = await factFor('<header className="bg-white/80 text-slate-900">Nav</header>', 'header')
    expect(declaredColors(header).background).toMatchObject({ resolvable: false, reason: 'translucent' })

    const legacy = await factFor('<section className="bg-black bg-opacity-50 text-white">x</section>', 'section')
    expect(declaredColors(legacy).background.reason).toBe('translucent')
  })

  it('stands down on both colours when the whole element is faded or blended', async () => {
    // `opacity-50` composites the text AND the background against whatever is
    // behind, so neither declared value is what gets painted.
    const faded = await factFor('<p className="bg-white text-slate-500 opacity-50">x</p>', 'p')
    expect(declaredColors(faded).text.reason).toBe('translucent')
    expect(declaredColors(faded).background.reason).toBe('translucent')

    const blended = await factFor('<p className="bg-white text-black mix-blend-difference">x</p>', 'p')
    expect(declaredColors(blended).text.reason).toBe('blend')
  })

  it('ignores a hover colour without letting it block the resting one', async () => {
    // `text-slate-900 hover:text-blue-600` is an ordinary link. Treating the
    // hover colour as a second declaration would report a conflict, and treating
    // it as the colour would judge a state nobody is looking at.
    const el = await factFor('<a className="bg-white text-slate-900 hover:text-blue-600">Tarifs</a>', 'a')
    const colors = declaredColors(el)
    expect(colors.text).toMatchObject({ hex: '#0f172a', resolvable: true })
    expect(colors.comparable).toBe(true)
  })

  it('refuses to pick a winner between two classes for the same property', async () => {
    // Which one wins is decided by the order Tailwind emitted its rules, not by
    // the order they appear in the attribute. Taking the first or the last would
    // be a coin flip dressed up as a measurement.
    const el = await factFor('<p className="bg-white text-red-500 text-blue-500">x</p>', 'p')
    expect(declaredColors(el).text).toMatchObject({ resolvable: false, reason: 'conflict' })
  })

  it('is not confused by a class list that spans several lines', async () => {
    // A long className is written as a template literal across lines, and
    // splitting on a single space loses every class after the first newline.
    const el = await factFor('<p className={`bg-white\n      text-slate-700`}>x</p>', 'p')
    expect(declaredColors(el).text).toMatchObject({ hex: '#334155', resolvable: true })
  })

  it('reports an element with no class at all as undeclared, not as black on white', async () => {
    const el = await factFor('<p>Bonjour</p>', 'p')
    const colors = declaredColors(el)
    expect(colors.text.hex).toBeNull()
    expect(colors.background.hex).toBeNull()
    expect(colors.comparable).toBe(false)
  })

  it('does not resolve a theme token it does not ship', async () => {
    // daisyUI is in the preview's vendor bundle, so `bg-primary` and
    // `text-base-content` are real classes whose values live in CSS variables.
    // A screen using them must come back unmeasurable, never guessed at.
    const el = await factFor('<p className="bg-primary text-base-content">x</p>', 'p')
    expect(declaredColors(el).comparable).toBe(false)
    expect(declaredColors(el).background.hex).toBeNull()
  })
})
