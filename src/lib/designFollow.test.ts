import { describe, expect, it } from 'vitest'
import { followRecolor, maskColors } from './designFollow'

const DESIGN = `# Design
## Colours
- Fond: #ffffff
- Encre: #111827
- Primaire: #dc2626
- Primaire foncé: #991b1b

Buttons are #dc2626 on white.`

const RED = `function App() {
  return (
    <main className="bg-white text-gray-900">
      <header className="bg-red-600 text-white">Atelier</header>
      <h1 className="text-red-600">Bonjour</h1>
      <a className="bg-red-600 hover:bg-red-800 text-white">Réserver</a>
      <p className="text-gray-900">Texte</p>
      <span style={{ color: '#dc2626' }}>•</span>
    </main>
  )
}`

const BLUE = RED.split('red-600').join('blue-600').split('red-800').join('blue-800').replace('#dc2626', '#2563eb')

describe('followRecolor', () => {
  it('moves the direction’s colours where the edit moved the screen’s', () => {
    const out = followRecolor(DESIGN, RED, BLUE)!
    expect(out.changes).toEqual([
      { label: 'Primaire', from: '#dc2626', to: '#2563eb' },
      { label: 'Primaire foncé', from: '#991b1b', to: '#1e40af' },
    ])
    expect(out.markdown).toContain('- Primaire: #2563eb')
    expect(out.markdown).toContain('Buttons are #2563eb on white.')
    expect(out.markdown).toContain('- Fond: #ffffff')
    expect(out.markdown).not.toMatch(/#dc2626/i)
  })

  it('leaves the accent alone when one element changed colour out of many', () => {
    const one = RED.replace('<h1 className="text-red-600">', '<h1 className="text-blue-600">')
    expect(followRecolor(DESIGN, RED, one)).toBeNull()
  })

  it('follows a recolour that rewrote the layout too, matching a background with a background', () => {
    const rewritten = `function App() {
  return (
    <section className="min-h-screen bg-white">
      <nav className="flex bg-blue-600 px-6 text-white">Atelier</nav>
      <div className="grid gap-4"><h2 className="text-4xl text-blue-600">Bonjour</h2></div>
      <button className="rounded bg-blue-600 px-4 hover:bg-blue-800">Réserver</button>
    </section>
  )
}`
    const out = followRecolor(DESIGN, RED, rewritten)!
    expect(out.changes).toContainEqual({ label: 'Primaire', from: '#dc2626', to: '#2563eb' })
    expect(out.markdown).toContain('- Fond: #ffffff')
  })

  it('changes nothing when nothing lines up, the colours did not move, or there is no direction', () => {
    expect(followRecolor(DESIGN, RED, 'function App(){ return <div className="bg-blue-600" /> }')).toBeNull()
    expect(followRecolor(DESIGN, RED, RED)).toBeNull()
    expect(followRecolor(DESIGN, RED, RED.replace('Bonjour', 'Salut'))).toBeNull()
    expect(followRecolor('', RED, BLUE)).toBeNull()
  })

  it('lines a background up with a background, and reads arbitrary values and literals', () => {
    const m = maskColors('<div className="bg-[#DC2626] text-red-600/80" style={{ fill: "#fff" }} />')
    expect(m.colors[0]).toEqual(['#dc2626', '#dc2626', '#ffffff'])
    expect(m.lines[0]).toBe('<div className="bg-\u0000 text-\u0000" style={{ fill: "\u0000" }} />')
  })
})
