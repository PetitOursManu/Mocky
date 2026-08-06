import { describe, expect, it } from 'vitest'
import { auditScreen } from './index'

/**
 * One realistic screen, of the kind the generator actually produces, run all
 * the way through. The unit tests above each poke one rule with a two-line
 * fragment; this checks the rules do not trip over each other on a real page —
 * fragments, maps, components, nested landmarks and all.
 *
 * Two details are more deliberate than they look, and both were added when the
 * tap-target and layout-shift rules arrived. The image carries `width`/`height`
 * and the buttons `py-3` rather than the `py-2` the generator tends to write,
 * because 8px of padding around a 24px line box is a 40px control — under the
 * 44px reference — and a `w-full` image with no ratio really does shift the
 * page. Neither was a false positive, so the fixture was corrected rather than
 * the rules loosened. That both rules fire on the idiom a generated screen
 * uses by default is exactly why they only ever advise.
 */
const REAL_SCREEN = `
function App() {
  const plans = [
    { id: 'a', name: 'Essentiel', price: '9' },
    { id: 'b', name: 'Studio', price: '29' },
  ]
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold">Atelier</span>
          <div className="flex gap-6">
            <a href="#tarifs" className="text-sm">Tarifs</a>
            <a href="#apropos" className="text-sm">À propos</a>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-4xl font-bold">Des cuisines faites à la main</h1>
        <p className="mt-4 max-w-prose text-neutral-600">Chaque pièce est dessinée puis assemblée dans notre atelier lyonnais.</p>
        <img src="http://localhost:5173/api/images/\${'a'.repeat(64)}" alt="Un plan de travail en chêne massif dans l'atelier" width={1600} height={900} className="mt-8 w-full rounded-xl" />
        <h2 className="mt-16 text-2xl font-semibold" id="tarifs">Tarifs</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {plans.map((p) => (
            <li key={p.id} className="rounded-xl border p-6">
              <h3 className="font-medium">{p.name}</h3>
              <p className="mt-2 text-3xl">{p.price} €</p>
              <button type="button" className="mt-4 rounded bg-black px-4 py-3 text-white">Choisir {p.name}</button>
            </li>
          ))}
        </ul>
        <form className="mt-16 flex gap-2">
          <label htmlFor="email" className="sr-only">Votre e-mail</label>
          <input id="email" type="email" className="flex-1 rounded border px-3 py-2" placeholder="vous@exemple.fr" />
          <button type="submit" className="rounded bg-black px-4 py-3 text-white">S'inscrire</button>
        </form>
      </main>
      <footer className="border-t py-8 text-center text-sm text-neutral-500">© 2026 Atelier</footer>
    </div>
  )
}
`

describe('a realistic generated screen', () => {
  it('passes cleanly when it is genuinely well built', async () => {
    const report = await auditScreen(REAL_SCREEN)
    expect(report.parsed).toBe(true)
    // Any finding here is a false positive on ordinary generated JSX, which is
    // the failure mode that would make the whole panel untrustworthy.
    expect(report.findings.map((f) => `${f.rule}: ${f.snippet}`)).toEqual([])
    expect(report.seo.score).toBe(100)
    expect(report.a11y.score).toBe(100)
  })

  it('is not fooled by items rendered from a map', async () => {
    // Each <li> comes from a .map inside a <ul>; the ancestor chain has to
    // survive the arrow function in between or every list item is reported.
    const report = await auditScreen(REAL_SCREEN)
    expect(report.findings.map((f) => f.rule)).not.toContain('list-structure')
  })
})

describe('text that comes from data', () => {
  const wrap = (jsx: string) => `function App(){ return (${jsx}) }`
  const rulesOf = async (jsx: string) => (await auditScreen(wrap(jsx))).findings.map((f) => f.rule)

  it('does not call a heading empty when its words come from a variable', async () => {
    expect(await rulesOf('<main><h1>{title}</h1></main>')).not.toContain('heading-empty')
  })

  it('still calls a genuinely empty heading empty', async () => {
    expect(await rulesOf('<main><h1></h1></main>')).toContain('heading-empty')
  })

  it('does not call a button unnamed when its label comes from a variable', async () => {
    expect(await rulesOf('<main><h1>A</h1><button>{label}</button></main>')).not.toContain('control-no-name')
  })

  it('finds the name one element down', async () => {
    // <button><span>{label}</span></button> is as named as the flat form; the
    // words simply live a level deeper.
    expect(await rulesOf('<main><h1>A</h1><button><span>{label}</span></button></main>')).not.toContain(
      'control-no-name',
    )
  })

  it('still calls an icon-only button unnamed', async () => {
    // The case the rule exists for: element children, but no words anywhere.
    expect(await rulesOf('<main><h1>A</h1><button><svg /></button></main>')).toContain('control-no-name')
  })
})
