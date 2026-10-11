import { describe, it, expect } from 'vitest'
import { factEditInstruction, replaceFacts } from './campaignFacts'

const page = (body: string) => `export default function App() {\n  return (\n    <Doc>\n      <Page>\n${body}\n      </Page>\n    </Doc>\n  )\n}\n`

describe('writing a changed fact directly', () => {
  it('replaces the text where the piece says it, and nothing else', async () => {
    const code = page('        <h1 className="text-8xl">Festival Lumières</h1>\n        <p className="mt-4">12 mars 2027 · Lyon</p>')
    const out = await replaceFacts(code, [{ from: '12 mars 2027', to: '19 mars 2027' }])
    expect(out.done).toHaveLength(1)
    expect(out.remaining).toEqual([])
    expect(out.code).toBe(code.replace('12 mars 2027', '19 mars 2027'))
  })

  it('replaces every place the fact appears', async () => {
    const code = page('        <p>12 mars</p>\n        <footer>Rendez-vous le 12 mars</footer>')
    const out = await replaceFacts(code, [{ from: '12 mars', to: '19 mars' }])
    expect(out.code).not.toContain('12 mars')
    expect(out.code.match(/19 mars/g)).toHaveLength(2)
  })

  it('keeps capitals where the piece wrote the value in capitals', async () => {
    const out = await replaceFacts(page('        <p>SAMEDI 12 MARS</p>'), [{ from: 'samedi 12 mars', to: 'dimanche 13 mars' }])
    expect(out.code).toContain('DIMANCHE 13 MARS')
    expect(out.done).toHaveLength(1)
  })

  it('folds whitespace the way JSX does, across a line break', async () => {
    const out = await replaceFacts(page('        <p>\n          12\n          mars\n        </p>'), [{ from: '12 mars', to: '19 mars' }])
    expect(out.code).toContain('19 mars')
    expect(out.remaining).toEqual([])
  })

  it('never touches a class name, a key or an import that happens to hold the same word', async () => {
    const code = `import Lyon from './lyon'\nexport default function App() {\n  const map = { Lyon: 1 }\n  return <div className="Lyon" key="Lyon"><p>Lyon</p></div>\n}\n`
    const out = await replaceFacts(code, [{ from: 'Lyon', to: 'Paris' }])
    expect(out.code).toContain("import Lyon from './lyon'")
    expect(out.code).toContain('{ Lyon: 1 }')
    expect(out.code).toContain('className="Lyon"')
    expect(out.code).toContain('key="Lyon"')
    expect(out.code).toContain('<p>Paris</p>')
  })

  it('never matches inside a longer word', async () => {
    const out = await replaceFacts(page('        <p>Le marsupial</p>'), [{ from: 'mars', to: 'avril' }])
    expect(out.code).toContain('marsupial')
    expect(out.remaining).toHaveLength(1)
  })

  it('escapes the new value inside a string, so the source still parses', async () => {
    const code = `export default function App() {\n  const facts = ['Entrée 15 €']\n  return <p>{facts[0]}</p>\n}\n`
    const out = await replaceFacts(code, [{ from: 'Entrée 15 €', to: "Entrée l'après-midi : 15 €" }])
    expect(out.code).toContain("'Entrée l\\'après-midi : 15 €'")
    expect(out.done).toHaveLength(1)
  })

  it('hands to the model a value split across two elements', async () => {
    const out = await replaceFacts(page('        <p><b>12</b> mars</p>'), [{ from: '12 mars', to: '19 mars' }])
    expect(out.remaining).toEqual([{ from: '12 mars', to: '19 mars' }])
  })

  it('hands to the model the place a direct write missed, even after writing the others', async () => {
    const out = await replaceFacts(page('        <p>12 mars</p>\n        <p><b>12</b> mars</p>'), [{ from: '12 mars', to: '19 mars' }])
    expect(out.code).toContain('<p>19 mars</p>')
    expect(out.remaining).toHaveLength(1)
  })

  it('does not mistake the new value for the old one when one contains the other', async () => {
    const out = await replaceFacts(page('        <p>Lyon</p>'), [{ from: 'Lyon', to: 'Lyon 3e' }])
    expect(out.code).toContain('<p>Lyon 3e</p>')
    expect(out.done).toHaveLength(1)
  })

  it('refuses to write a brace into JSX text', async () => {
    const code = page('        <p>Gratuit</p>')
    const out = await replaceFacts(code, [{ from: 'Gratuit', to: '{offert}' }])
    expect(out.code).toBe(code)
    expect(out.remaining).toHaveLength(1)
  })

  it('leaves a cleared fact to the model, which decides what closes the gap', async () => {
    const out = await replaceFacts(page('        <p>Entrée 15 €</p>'), [{ from: 'Entrée 15 €', to: '' }])
    expect(out.remaining).toHaveLength(1)
  })

  it('leaves code that does not parse untouched', async () => {
    const code = 'export default function App() { return <p>12 mars</p'
    const out = await replaceFacts(code, [{ from: '12 mars', to: '19 mars' }])
    expect(out.code).toBe(code)
    expect(out.remaining).toHaveLength(1)
  })
})

describe('the instruction for what is left', () => {
  it('names each change, and asks for nothing else to move', () => {
    const text = factEditInstruction([
      { label: 'Date', from: '12 mars', to: '19 mars' },
      { label: 'Prix', from: '15 €', to: '' },
    ])
    expect(text).toContain('change NOTHING else')
    expect(text).toContain('"12 mars" becomes "19 mars"')
    expect(text).toContain('"15 €" is no longer true')
  })
})
