import { describe, expect, it, vi, afterEach } from 'vitest'
import { audit as auditStrings } from '../../i18n/parts/audit'
import { auditExport, auditScreen } from './index'
import { inspectScreen } from './inspect'
import { RULES, RULE_FAMILIES } from './rules'

/** Wrap a fragment in the component shape every generated screen has. */
const screen = (jsx: string) => `function App() {\n  return (\n${jsx}\n  )\n}`

/** The rule ids an audit reports, for terse assertions. */
async function rules(jsx: string): Promise<string[]> {
  const report = await auditScreen(screen(jsx))
  return report.findings.map((f) => f.rule).sort()
}

const has = async (jsx: string, rule: string) => (await rules(jsx)).includes(rule)

afterEach(() => vi.unstubAllGlobals())

describe('inspectScreen', () => {
  it('reads tags, attributes and text', async () => {
    const facts = await inspectScreen(screen(`<main><h1 className="t">Bonjour</h1></main>`))
    expect(facts.parsed).toBe(true)
    const h1 = facts.elements.find((e) => e.tag === 'h1')!
    expect(h1.text).toBe('Bonjour')
    expect(h1.attrs['class']).toEqual({ kind: 'string', value: 't' })
    expect(h1.ancestors).toContain('main')
  })

  it('tells a component apart from a host element', async () => {
    // `<Card />` has no HTML semantics, so no accessibility rule applies to it.
    const facts = await inspectScreen(screen(`<Card><div /></Card>`))
    expect(facts.elements.find((e) => e.tag === 'Card')?.host).toBe(false)
    expect(facts.elements.find((e) => e.tag === 'div')?.host).toBe(true)
  })

  it('says it could not parse rather than reporting an empty screen', async () => {
    // A clean bill of health for a file nobody could open is the worst answer
    // available: it hides the error AND asserts there is nothing wrong.
    expect((await inspectScreen('function App() { return <div ; ; > }')).parsed).toBe(false)
  })
})

describe('accessibility rules', () => {
  it('flags an image with no alt at all', async () => {
    expect(await has(`<img src="/x.jpg" />`, 'img-alt')).toBe(true)
  })

  it('accepts an empty alt on a decorative image', async () => {
    // `alt=""` is the CORRECT answer for decoration. Reporting it would train
    // people to write `alt="image"` to make the tool stop complaining.
    expect(await has(`<img src="/x.jpg" alt="" />`, 'img-alt')).toBe(false)
  })

  it('treats a bare `alt` as missing, because it means true', async () => {
    expect(await has(`<img src="/x.jpg" alt />`, 'img-alt')).toBe(true)
  })

  it('does not claim an alt is missing when it comes from an expression', async () => {
    // `alt={caption}` is good code. Failing it would punish exactly the screens
    // that got it right.
    expect(await has(`<img src="/x.jpg" alt={caption} />`, 'img-alt')).toBe(false)
  })

  it('flags an alt that only says "image"', async () => {
    expect(await has(`<img src="/x.jpg" alt="image" />`, 'img-alt-redundant')).toBe(true)
  })

  it('flags a button with no name a screen reader could announce', async () => {
    expect(await has(`<button className="p-2"><svg /></button>`, 'control-no-name')).toBe(true)
  })

  it('accepts a button named by aria-label, including a translated one', async () => {
    expect(await has(`<button aria-label="Fermer"><svg /></button>`, 'control-no-name')).toBe(false)
    expect(await has(`<button aria-label={t('close')}><svg /></button>`, 'control-no-name')).toBe(false)
  })

  it('flags a clickable div a keyboard cannot reach', async () => {
    expect(await has(`<div onClick={go}>Ouvrir</div>`, 'clickable-non-interactive')).toBe(true)
  })

  it('accepts a clickable div that opted into being a control', async () => {
    expect(await has(`<div onClick={go} role="button" tabIndex={0}>Ouvrir</div>`, 'clickable-non-interactive')).toBe(
      false,
    )
  })

  it('flags an input with nothing to label it', async () => {
    expect(await has(`<form><input type="email" placeholder="E-mail" /></form>`, 'input-no-label')).toBe(true)
  })

  it('accepts an input wrapped in its label, and one linked by id', async () => {
    expect(await has(`<label>E-mail <input type="email" /></label>`, 'input-no-label')).toBe(false)
    expect(
      await has(`<div><label htmlFor="e">E-mail</label><input id="e" type="email" /></div>`, 'input-no-label'),
    ).toBe(false)
  })

  it('does not ask a submit button to carry a label', async () => {
    expect(await has(`<input type="submit" value="Envoyer" />`, 'input-no-label')).toBe(false)
  })

  it('flags a positive tabindex', async () => {
    expect(await has(`<button tabIndex={3}>Go</button>`, 'positive-tabindex')).toBe(true)
    expect(await has(`<button tabIndex={0}>Go</button>`, 'positive-tabindex')).toBe(false)
  })

  it('flags an interactive element hidden from screen readers', async () => {
    expect(await has(`<button aria-hidden="true">Go</button>`, 'aria-hidden-interactive')).toBe(true)
  })

  it('flags a duplicate id', async () => {
    expect(await has(`<div><span id="a" /><span id="a" /></div>`, 'duplicate-id')).toBe(true)
  })

  it('flags a list item outside a list', async () => {
    expect(await has(`<div><li>Un</li></div>`, 'list-structure')).toBe(true)
    expect(await has(`<ul><li>Un</li></ul>`, 'list-structure')).toBe(false)
  })

  it('flags a table with no header cell', async () => {
    expect(await has(`<table><tbody><tr><td>1</td></tr></tbody></table>`, 'table-no-header')).toBe(true)
    expect(await has(`<table><thead><tr><th>A</th></tr></thead></table>`, 'table-no-header')).toBe(false)
  })
})

describe('heading rules', () => {
  it('flags headings with no h1 among them', async () => {
    expect(await has(`<section><h2>Titre</h2></section>`, 'heading-missing-h1')).toBe(true)
  })

  it('says nothing about headings on a screen that has none', async () => {
    // A card or a toolbar legitimately has no heading, and demanding one would
    // be markup added for the report's sake.
    expect(await has(`<div className="p-4">Texte</div>`, 'heading-missing-h1')).toBe(false)
  })

  it('flags a second h1', async () => {
    expect(await has(`<main><h1>A</h1><h1>B</h1></main>`, 'heading-multiple-h1')).toBe(true)
  })

  it('flags a skipped heading level, once', async () => {
    const found = await rules(`<main><h1>A</h1><h3>B</h3><h5>C</h5></main>`)
    expect(found.filter((r) => r === 'heading-skipped-level')).toHaveLength(1)
  })

  it('accepts going back up a level', async () => {
    expect(await has(`<main><h1>A</h1><h2>B</h2><h3>C</h3><h2>D</h2></main>`, 'heading-skipped-level')).toBe(false)
  })

  it('flags an empty heading', async () => {
    expect(await has(`<main><h1></h1></main>`, 'heading-empty')).toBe(true)
  })
})

describe('SEO rules', () => {
  it('flags link text that names no destination', async () => {
    expect(await has(`<a href="/x">En savoir plus</a>`, 'link-text-generic')).toBe(true)
    expect(await has(`<a href="/x">Click here</a>`, 'link-text-generic')).toBe(true)
  })

  it('accepts link text that does', async () => {
    expect(await has(`<a href="/x">Voir les tarifs</a>`, 'link-text-generic')).toBe(false)
  })

  it('flags a screen with no landmark element', async () => {
    expect(await has(`<div><p>Bonjour</p></div>`, 'no-landmarks')).toBe(true)
    expect(await has(`<main><p>Bonjour</p></main>`, 'no-landmarks')).toBe(false)
  })

  it('flags a row of links with no nav around it', async () => {
    const jsx = `<main><a href="/a">Tarifs</a><a href="/b">Produit</a><a href="/c">Blog</a><a href="/d">Contact</a></main>`
    expect(await has(jsx, 'div-soup-nav')).toBe(true)
  })
})

describe('the rule catalogue', () => {
  it('files every rule under a declared family, and leaves no family empty', () => {
    // A rule with no family falls into whatever bucket the panel keeps for
    // leftovers, which is where a finding goes to be ignored. A family with no
    // rule is a heading over an empty list, which is worse than absent: it
    // reads as "nothing wrong here" for a check that does not exist.
    const families = RULE_FAMILIES.map((f) => f.id)
    for (const rule of Object.values(RULES)) expect(families).toContain(rule.family)
    for (const family of families) {
      expect(Object.values(RULES).some((r) => r.family === family), family).toBe(true)
    }
  })

  it('has a name, a description and a family label in both languages', () => {
    // `toFindings` puts KEYS in `name` and `description`. A missing one is not
    // a blank in the panel — it prints `audit.rule.lowContrast` at the reader,
    // and `findingsToPrompt` hands the same string to the model as the whole
    // instruction. Both failures look like the feature working.
    for (const rule of Object.values(RULES)) {
      for (const key of [rule.nameKey, rule.descKey]) {
        expect(auditStrings.fr[key], `fr ${key}`).toBeTruthy()
        expect(auditStrings.en[key], `en ${key}`).toBeTruthy()
      }
    }
    for (const { labelKey } of RULE_FAMILIES) {
      expect(auditStrings.fr[labelKey], `fr ${labelKey}`).toBeTruthy()
      expect(auditStrings.en[labelKey], `en ${labelKey}`).toBeTruthy()
    }
  })

  it('enforces nothing that a supplied art direction is allowed to decide', () => {
    // Invariant Q2, and here it is not hypothetical: AUDIT_FIX_PROMPT tells the
    // model to keep every Tailwind class and every colour. A typography or
    // tap-target rule set to `enforce` would spend an iteration asking for a
    // change the same prompt forbids, get the screen back unchanged, and stop
    // on `no-progress` having paid for a model call.
    const enforced = Object.values(RULES).filter((r) => r.disposition === 'enforce')
    expect(enforced.filter((r) => r.family === 'typography' || r.family === 'targets').map((r) => r.id)).toEqual([])
    // Contrast is the one exception, and the prompt carries an explicit carve-out
    // for it. If that carve-out ever goes, this rule has to be demoted with it.
    expect(enforced.map((r) => r.id)).toContain('low-contrast')
  })
})

describe('contrast', () => {
  it('flags text and background that cannot be read together', async () => {
    const jsx = `<main><h1>Tarifs</h1><p className="bg-slate-100 text-slate-300">Nos tarifs changent au 1er janvier.</p></main>`
    expect(await has(jsx, 'low-contrast')).toBe(true)
  })

  it('accepts a pair that clears the bar', async () => {
    const jsx = `<main><h1>Tarifs</h1><p className="bg-white text-slate-900">Nos tarifs changent au 1er janvier.</p></main>`
    expect(await has(jsx, 'low-contrast')).toBe(false)
  })

  it('reports nothing at all when the background is not on the element', async () => {
    // The abstention the whole colour module exists for. The background lives
    // on a wrapper, `ancestors` carries tag names and nothing else, and
    // defaulting to white would report every dark panel on the canvas as
    // unreadable — a report that cries wolf on correct screens teaches the
    // reader to close the panel, including the day it is right.
    const jsx = `<main className="bg-slate-900"><h1>Tarifs</h1><p className="text-slate-800">Nos tarifs changent au 1er janvier.</p></main>`
    expect(await rules(jsx)).not.toContain('low-contrast')
  })

  it('does not read the flat fallback under a gradient as the painted background', async () => {
    // `bg-white bg-gradient-to-r` is the common pair: the flat colour is only
    // the fallback, and the gradient paints over it. Reading the fallback is
    // how a hero with white text on a violet gradient gets called white on white.
    const jsx = `<main><h1>Tarifs</h1><p className="bg-white bg-gradient-to-r text-white">Nos tarifs changent au 1er janvier.</p></main>`
    expect(await rules(jsx)).not.toContain('low-contrast')
  })

  it('holds large text to 3:1 and body text to 4.5:1', async () => {
    // slate-500 on slate-100 is 4.34:1 — under the body floor, over the large
    // one. The same pair has to be reported once and not the other time, which
    // is the only way to show the threshold is not a constant.
    const body = `<main><h1>Tarifs</h1><p className="bg-slate-100 text-slate-500">Nos tarifs changent au 1er janvier.</p></main>`
    const large = `<main><h1>Tarifs</h1><p className="bg-slate-100 text-slate-500 text-3xl">Nos tarifs changent au 1er janvier.</p></main>`
    expect(await has(body, 'low-contrast')).toBe(true)
    expect(await has(large, 'low-contrast')).toBe(false)
  })
})

describe('typography rules', () => {
  it('flags text under twelve pixels', async () => {
    expect(await has(`<main><h1>A</h1><p className="text-[11px]">Mentions légales</p></main>`, 'text-too-small')).toBe(
      true,
    )
  })

  it('leaves Tailwind’s own smallest step alone', async () => {
    // text-xs IS twelve pixels. A rule that fired on it would fire on every
    // caption and every badge on the canvas.
    expect(await has(`<main><h1>A</h1><p className="text-xs">Mentions légales</p></main>`, 'text-too-small')).toBe(false)
    // And an arbitrary value that is a colour must not be read as a size:
    // `text-[#0f172a]` and `text-[11px]` have the same shape to the character.
    expect(await has(`<main><h1>A</h1><p className="text-[#0f172a]">Mentions</p></main>`, 'text-too-small')).toBe(false)
  })

  it('flags cramped leading on a paragraph', async () => {
    const jsx = `<main><h1>A</h1><p className="leading-none">Chaque pièce est dessinée puis assemblée dans notre atelier.</p></main>`
    expect(await has(jsx, 'leading-cramped')).toBe(true)
  })

  it('leaves leading-none on a display heading alone', async () => {
    // That is how a display title is set, not a defect — and headings are where
    // tight leading actually belongs.
    const jsx = `<main><h1 className="text-5xl leading-none">Des cuisines faites entièrement à la main</h1></main>`
    expect(await has(jsx, 'leading-cramped')).toBe(false)
  })

  it('flags a whole sentence in capitals', async () => {
    const jsx = `<main><h1>A</h1><p className="uppercase">Chaque pièce est dessinée puis assemblée dans notre atelier.</p></main>`
    expect(await has(jsx, 'uppercase-body')).toBe(true)
  })

  it('leaves a short eyebrow label in capitals alone', async () => {
    // Every generated hero has one and it is a correct treatment; a rule that
    // reported them would fire on nearly every screen.
    const jsx = `<main><h1>A</h1><p className="text-xs uppercase tracking-widest">Nouveau</p></main>`
    expect(await has(jsx, 'uppercase-body')).toBe(false)
  })

  it('flags justified text and says nothing about centred text', async () => {
    const copy = 'Chaque pièce est dessinée puis assemblée dans notre atelier lyonnais.'
    expect(await has(`<main><h1>A</h1><p className="text-justify">${copy}</p></main>`, 'text-justify')).toBe(true)
    expect(await has(`<main><h1>A</h1><p className="text-center">${copy}</p></main>`, 'text-justify')).toBe(false)
  })
})

describe('tap targets', () => {
  it('flags a control whose classes add up to less than 44px', async () => {
    expect(await has(`<main><h1>A</h1><button className="p-1 text-xs">Ajouter</button></main>`, 'tap-target-small')).toBe(
      true,
    )
  })

  it('accepts one that reaches the reference size, by padding or by height', async () => {
    // py-3 is 12px each side around a 20px line box: 44 exactly, which is not
    // under 44. An off-by-one here would flag every correctly sized button.
    expect(
      await has(`<main><h1>A</h1><button className="px-4 py-3 text-sm">Ajouter</button></main>`, 'tap-target-small'),
    ).toBe(false)
    expect(await has(`<main><h1>A</h1><button className="h-11 px-4">Ajouter</button></main>`, 'tap-target-small')).toBe(
      false,
    )
  })

  it('says nothing about an inline link inside a sentence', async () => {
    // WCAG 2.5.8 exempts those by name, and the only thing that separates a
    // button-shaped link from a word in a paragraph here is that someone gave
    // the first one a box.
    const jsx = `<main><h1>A</h1><p>Voir <a href="/x" className="text-sm underline">nos tarifs</a> pour en savoir plus.</p></main>`
    expect(await has(jsx, 'tap-target-small')).toBe(false)
  })

  it('abstains on an icon button whose height comes from its child', async () => {
    // The <svg className="h-8"> sets the height, and `ElementFact` gives no way
    // to reach a child and ask. Deducing from the line box would report a 40px
    // control as a 24px one — a false positive on exactly the elements this
    // rule exists for.
    const jsx = `<main><h1>A</h1><button className="p-1" aria-label="Fermer"><svg className="h-8 w-8" /></button></main>`
    expect(await has(jsx, 'tap-target-small')).toBe(false)
  })

  it('flags two controls touching in a gapless flex row', async () => {
    const jsx = `<main><h1>A</h1><div className="flex"><button className="px-4 py-3">Oui</button><button className="px-4 py-3">Non</button></div></main>`
    expect(await has(jsx, 'targets-adjacent')).toBe(true)
  })

  it('accepts the same row once the container declares a gap', async () => {
    const jsx = `<main><h1>A</h1><div className="flex gap-2"><button className="px-4 py-3">Oui</button><button className="px-4 py-3">Non</button></div></main>`
    expect(await has(jsx, 'targets-adjacent')).toBe(false)
  })

  it('does not treat two controls in ordinary flow as touching', async () => {
    // Only flex and grid collapse the whitespace between two elements to
    // nothing; a block stack keeps its own line boxes and does not touch.
    const jsx = `<main><h1>A</h1><div><button className="px-4 py-3">Oui</button><button className="px-4 py-3">Non</button></div></main>`
    expect(await has(jsx, 'targets-adjacent')).toBe(false)
  })
})

describe('image rules beyond the alt', () => {
  it('flags an image that reserves no space for itself', async () => {
    const jsx = `<main><h1>A</h1><img src="/x.jpg" alt="Un plan de travail en chêne" className="w-full rounded-xl" /></main>`
    expect(await has(jsx, 'img-no-dimensions')).toBe(true)
  })

  it('accepts one that declares its box, by attribute or by ratio', async () => {
    const attrs = `<main><h1>A</h1><img src="/x.jpg" alt="Un plan de travail" width={1600} height={900} className="w-full" /></main>`
    const ratio = `<main><h1>A</h1><img src="/x.jpg" alt="Un plan de travail" className="aspect-video w-full" /></main>`
    expect(await has(attrs, 'img-no-dimensions')).toBe(false)
    expect(await has(ratio, 'img-no-dimensions')).toBe(false)
  })

  it('flags an empty alt on an image the document captions', async () => {
    const jsx = `<figure><img src="/x.jpg" alt="" width={800} height={600} /><figcaption>Le plan de travail terminé</figcaption></figure>`
    expect(await has(jsx, 'img-meaningful-empty-alt')).toBe(true)
  })

  it('leaves an empty alt on a decorative image alone', async () => {
    // alt="" is the CORRECT answer outside a caption. Reporting it would train
    // people to write alt="image" to make the tool stop complaining, which is
    // the finding right above it in the catalogue.
    const jsx = `<main><h1>A</h1><img src="/x.jpg" alt="" width={40} height={40} className="rounded-full" /></main>`
    expect(await has(jsx, 'img-meaningful-empty-alt')).toBe(false)
  })
})

describe('scoring', () => {
  it('gives a clean screen full marks in both disciplines', async () => {
    const report = await auditScreen(
      screen(`<main><h1>Tarifs</h1><img src="/x.jpg" alt="Une boulangerie au petit matin" /></main>`),
    )
    expect(report.seo.score).toBe(100)
    expect(report.a11y.score).toBe(100)
    expect(report.findings).toEqual([])
  })

  it('counts a rule once however many elements break it', async () => {
    // Twenty images with no alt is ONE thing to fix. Scoring it twenty times
    // would drown every other finding and make the number meaningless.
    const one = await auditScreen(screen(`<main><h1>A</h1><img src="/1.jpg" /></main>`))
    const many = await auditScreen(
      screen(`<main><h1>A</h1><img src="/1.jpg" /><img src="/2.jpg" /><img src="/3.jpg" /></main>`),
    )
    expect(many.a11y.score).toBe(one.a11y.score)
  })

  it('lists every offender in the snippet even though it scores once', async () => {
    const report = await auditScreen(
      screen(`<main><h1>A</h1><img src="/1.jpg" className="hero" /><img src="/2.jpg" className="thumb" /></main>`),
    )
    const finding = report.findings.find((f) => f.rule === 'img-alt')!
    expect(finding.snippet).toContain('hero')
    expect(finding.snippet).toContain('thumb')
  })

  it('never scores below zero', async () => {
    const report = await auditScreen(
      screen(`<div><h2></h2><h2></h2><img src="/1.jpg" /><button /><div onClick={x}>a</div><li>b</li></div>`),
    )
    expect(report.a11y.score).toBeGreaterThanOrEqual(0)
  })

  it('always declares that it did not look at rendered properties', async () => {
    // Invariant Q4. Contrast, focus visibility and target size are properties
    // of a painted page, and nothing here paints anything.
    const report = await auditScreen(screen(`<main><h1>A</h1></main>`))
    expect(report.seo.confidence).toBe('partial')
    expect(report.a11y.confidence).toBe('partial')
  })

  it('reports an unreadable screen as unreadable, not as clean', async () => {
    const report = await auditScreen('function App() { return <div ; ; > }')
    expect(report.parsed).toBe(false)
    expect(report.coverage.deterministic).toBe(false)
    expect(report.findings).toEqual([])
  })
})

describe('the breakdown by family', () => {
  /** The families of one screen, keyed by id, for terse assertions. */
  async function families(jsx: string) {
    const report = await auditScreen(screen(jsx))
    return Object.fromEntries(report.families.map((f) => [f.family, f]))
  }

  it('reports every declared family, once, in the declared order', async () => {
    // Order fixed and not derived from the report: a list sorted by score
    // reshuffles on every re-run, and the row someone was reading moves under
    // their cursor between two clicks of "Evaluate".
    const report = await auditScreen(screen(`<main><h1>Tarifs</h1></main>`))
    expect(report.families.map((f) => f.family)).toEqual(RULE_FAMILIES.map((f) => f.id))
  })

  it('says "nothing to check here" rather than awarding full marks', async () => {
    // The trap Q4 names, one level below the panel's own caveat: this screen has
    // no image and no form, so a perfect score for images and forms would be the
    // report claiming it looked at something that is not there.
    const found = await families(`<main><h1>Tarifs</h1><p>Nos tarifs changent au 1er janvier.</p></main>`)
    expect(found.images.state).toBe('not-applicable')
    expect(found.images.score).toBeNull()
    expect(found.forms.state).toBe('not-applicable')
    expect(found.forms.score).toBeNull()
    expect(found.targets.state).toBe('not-applicable')
  })

  it('scores a family that had subjects and found nothing wrong', async () => {
    const found = await families(`<main><h1>Tarifs</h1><img src="/x.jpg" alt="Une vitrine au petit matin" width={800} height={600} /></main>`)
    expect(found.images.state).toBe('scored')
    expect(found.images.score).toBe(100)
    expect(found.images.failing).toBe(0)
  })

  it('counts the distinct rules failing and takes them off that family alone', async () => {
    const found = await families(`<main><h1>Tarifs</h1><img src="/1.jpg" /><img src="/2.jpg" /></main>`)
    // One rule, two offenders — the same arithmetic as the head scores.
    expect(found.images.failing).toBe(1)
    expect(found.images.score).toBeLessThan(100)
    // And nothing lands on a family that had nothing to do with it.
    expect(found.headings.score).toBe(100)
  })

  it('leaves the two head scores exactly as they were', async () => {
    // The breakdown is a re-cut of the same findings, not a new measurement.
    // Re-deriving `seo` or `a11y` from it would change what a number someone
    // has been reading for weeks means, without saying so.
    const report = await auditScreen(screen(`<main><h1>A</h1><img src="/1.jpg" /></main>`))
    expect(report.a11y.score).toBe(100 - 25)
    expect(report.seo.score).toBe(100 - 25)
  })

  it('files a finding under its family even when nothing else there was examined', async () => {
    // `duplicate-id` lives under forms because that is where it bites, and this
    // screen has no field at all. A finding is proof that something was looked
    // at, so the row is scored — "not applicable" printed directly above a
    // finding of its own would be absurd.
    const found = await families(`<div><span id="a" /><span id="a" /></div>`)
    expect(found.forms.state).toBe('scored')
    expect(found.forms.failing).toBe(1)
  })

  it('does not let an id on a heading pass for a form', async () => {
    // The reason the form subject count is fields and labels and nothing else:
    // `id="tarifs"` on an anchor target is on half the landing pages there are,
    // and counting it would print a reassuring "forms: 100" on every one.
    const found = await families(`<main><h1 id="tarifs">Tarifs</h1></main>`)
    expect(found.forms.state).toBe('not-applicable')
  })

  it('says colour was not measured rather than scoring what it never compared', async () => {
    // The background lives on the wrapper, so no element paints both of its own
    // colours and the contrast rule abstained on every one of them. Printing
    // 100 there would be the report claiming a check it declined to make.
    const found = await families(
      `<main className="bg-slate-900"><h1>Tarifs</h1><p className="text-slate-300">Nos tarifs changent au 1er janvier.</p></main>`,
    )
    expect(found.color.state).toBe('not-measured')
    expect(found.color.score).toBeNull()
  })

  it('scores colour once a single pair could be compared', async () => {
    const found = await families(
      `<main><h1>Tarifs</h1><p className="bg-white text-slate-900">Nos tarifs changent au 1er janvier.</p></main>`,
    )
    expect(found.color.state).toBe('scored')
    expect(found.color.score).toBe(100)
  })

  it('declares what each family rests on', async () => {
    // Invariant Q4 again, per family this time. Markup is readable and says so;
    // colour can only speak for the pairs it could compare; typography and tap
    // targets are deductions from class names and must never claim more.
    const found = await families(`<main><h1>A</h1></main>`)
    expect(found.headings.confidence).toBe('high')
    expect(found.color.confidence).toBe('medium')
    expect(found.typography.confidence).toBe('low')
    expect(found.targets.confidence).toBe('low')
  })

  it('names a confidence reason that exists in both languages', () => {
    // The reason is a key, like every other string in the report. A missing one
    // prints `audit.family.why.deduced` at the reader.
    for (const { labelKey, confidenceKey } of RULE_FAMILIES) {
      for (const key of [labelKey, confidenceKey]) {
        expect(auditStrings.fr[key], `fr ${key}`).toBeTruthy()
        expect(auditStrings.en[key], `en ${key}`).toBeTruthy()
      }
    }
  })

  it('reports an unreadable screen as unmeasured, never as having nothing to check', async () => {
    const report = await auditScreen('function App() { return <div ; ; > }')
    expect(report.families.every((f) => f.state === 'not-measured')).toBe(true)
    expect(report.families.every((f) => f.score === null)).toBe(true)
  })
})

describe('the deep pass', () => {
  it('is not attempted unless it is asked for', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await auditScreen(screen(`<main><h1>A</h1></main>`))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('merges judged findings and says the model contributed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          judged: true,
          findings: [
            { rule: 'alt-describes-image', name: 'Alt text', description: 'The alt repeats the caption.', dimension: 'a11y' },
          ],
        }),
      })),
    )
    const report = await auditScreen(screen(`<main><h1>A</h1></main>`), { deep: true })
    expect(report.coverage.judged).toBe(true)
    expect(report.findings.map((f) => f.rule)).toContain('alt-describes-image')
    // It has to move a score, or it is a button that spends tokens for nothing.
    expect(report.a11y.score).toBeLessThan(100)
  })

  it('sends the model name, or the server cannot reach a browser-configured provider', async () => {
    // `proxyHeaders` carries the base URL, the dialect and the key — never the
    // model. The server reads it from the body, and without it `credsFromReq`
    // returns null and the deep pass silently never runs.
    let sent: any = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: any) => {
        sent = JSON.parse(init.body)
        return { ok: true, json: async () => ({ judged: true, findings: [] }) }
      }),
    )
    await auditScreen(screen(`<main><h1>A</h1></main>`), {
      deep: true,
      settings: { baseUrl: 'http://x', model: 'llama3.1', apiKey: '', kind: 'ollama' } as never,
    })
    expect(sent.model).toBe('llama3.1')
  })

  it('does not claim the model looked when the route says it did not', async () => {
    // The route answers 200 with an empty list when no model is configured.
    // Reading that as "judged" makes an unchecked screen read exactly like a
    // spotless one — the distinction Q4 exists to keep.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          judged: false,
          findings: [],
          notices: ['No text model is configured, so the deep pass did not run.'],
        }),
      })),
    )
    const report = await auditScreen(screen(`<main><h1>A</h1></main>`), { deep: true })
    expect(report.coverage.judged).toBe(false)
    // And the reason reaches the panel rather than being dropped on the floor.
    expect(report.notices).toContain('No text model is configured, so the deep pass did not run.')
  })

  it('carries a notice back even when the pass did run', async () => {
    // Truncation: the model judged only the first part of a long screen. It
    // really did run, so `judged` stays true — but the caveat must be shown.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ judged: true, findings: [], notices: ['judged only its first part'] }),
      })),
    )
    const report = await auditScreen(screen(`<main><h1>A</h1></main>`), { deep: true })
    expect(report.coverage.judged).toBe(true)
    expect(report.notices).toContain('judged only its first part')
  })

  it('under-claims rather than invents coverage when the field is missing', async () => {
    // A server older than the field. False is the safe direction.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ findings: [] }) })))
    const report = await auditScreen(screen(`<main><h1>A</h1></main>`), { deep: true })
    expect(report.coverage.judged).toBe(false)
  })

  it('keeps the deterministic report when the model is unreachable', async () => {
    // Invariant Q1: losing a complete, free report because a network call
    // failed would be absurd.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: 'no model' }) })))
    const report = await auditScreen(screen(`<main><h1>A</h1><img src="/1.jpg" /></main>`), { deep: true })
    expect(report.coverage.judged).toBe(false)
    expect(report.notices).toHaveLength(1)
    expect(report.findings.map((f) => f.rule)).toContain('img-alt')
  })

  it('drops a judged finding that names no known question', async () => {
    // A model inventing rule ids is how a report starts containing findings
    // nobody wrote.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ findings: [{ rule: 'invented', description: 'x', dimension: 'seo' }] }),
      })),
    )
    const report = await auditScreen(screen(`<main><h1>A</h1></main>`), { deep: true })
    // It survives as a finding — the server catalogue is the gate — but it can
    // never be spent a correction pass on.
    const judged = report.findings.find((f) => f.rule === 'invented')
    expect(judged?.disposition).toBe('advise')
  })

  it('files a judged finding under the family its question declared', async () => {
    // Without this the breakdown contradicts the number above it: a model
    // finding about headings takes points off SEO while the headings row still
    // reads 100. The rule id is the server's, so only the server can place it.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          judged: true,
          findings: [
            {
              rule: 'heading-describes-section',
              name: 'Headings describe their sections',
              description: 'The h1 is a slogan.',
              dimension: 'seo',
              severity: 'warning',
              family: 'headings',
            },
          ],
        }),
      })),
    )
    const report = await auditScreen(screen(`<main><h1>A</h1></main>`), { deep: true })
    const headings = report.families.find((f) => f.family === 'headings')!
    expect(headings.failing).toBe(1)
    expect(headings.score).toBeLessThan(100)
  })

  it('drops a family name it cannot place, and keeps the finding', async () => {
    // Same discipline as an unknown rule id: a heading nobody wrote must not
    // appear in the report because a payload asked for it. The finding is still
    // shown and still moves the dimension score — only its filing is refused.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          judged: true,
          findings: [
            {
              rule: 'link-text-standalone',
              description: 'Two links both read “here”.',
              dimension: 'a11y',
              family: 'vibes',
            },
          ],
        }),
      })),
    )
    const report = await auditScreen(screen(`<main><h1>A</h1></main>`), { deep: true })
    expect(report.findings.map((f) => f.rule)).toContain('link-text-standalone')
    expect(report.families.every((f) => f.failing === 0)).toBe(true)
    expect(report.a11y.score).toBeLessThan(100)
  })
})

describe('auditExport', () => {
  it('passes a project that has a title, a language and a description', async () => {
    const report = await auditExport('Ma Boulangerie', { lang: 'fr', description: 'Boulangerie artisanale à Lyon' })
    expect(report.findings).toEqual([])
  })

  it('reports a missing description', async () => {
    const report = await auditExport('Ma Boulangerie', { lang: 'fr' })
    expect(report.findings.map((f) => f.rule)).toEqual(['export-description'])
  })

  it('never lets the export audit spend a correction pass', async () => {
    // Nothing here is fixable by rewriting a screen: it is the project's
    // exported document, not any one component.
    const report = await auditExport('X')
    expect(report.findings.every((f) => f.disposition === 'advise')).toBe(true)
  })
})

describe('judged findings speak the reader’s language', () => {
  it('labels a judged finding with a dictionary key, not the server’s English', async () => {
    // The eight question names are fixed catalogue strings, as translatable as
    // any deterministic rule. Sent through raw they printed "Headings describe
    // their sections" in the middle of a French panel.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          judged: true,
          findings: [
            { rule: 'heading-describes-section', name: 'Headings describe their sections', description: '' },
          ],
        }),
      })),
    )
    const report = await auditScreen(screen(`<main><h1>A</h1></main>`), { deep: true })
    const f = report.findings.find((x) => x.rule === 'heading-describes-section')!
    expect(f.name).toBe('audit.judged.headingDescribesSection')
    // And the key exists in both dictionaries, or it would render as itself.
    expect(auditStrings.fr[f.name]).toBeTruthy()
    expect(auditStrings.en[f.name]).toBeTruthy()
  })

  it('substitutes a translated description when the model wrote no note', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          judged: true,
          findings: [{ rule: 'h1-matches-page', description: '' }],
        }),
      })),
    )
    const report = await auditScreen(screen(`<main><h1>A</h1></main>`), { deep: true })
    const f = report.findings.find((x) => x.rule === 'h1-matches-page')!
    expect(f.description).toBe('audit.judged.h1MatchesPageDesc')
    expect(auditStrings.fr[f.description]).toBeTruthy()
    expect(auditStrings.en[f.description]).toBeTruthy()
  })

  it('leaves the model’s own note alone', async () => {
    // Prose about this screen, in the language the model answered in. Not a key.
    const note = 'The h1 is a tagline, not a subject.'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ judged: true, findings: [{ rule: 'h1-matches-page', description: note }] }),
      })),
    )
    const report = await auditScreen(screen(`<main><h1>A</h1></main>`), { deep: true })
    expect(report.findings.find((x) => x.rule === 'h1-matches-page')!.description).toBe(note)
  })
})
