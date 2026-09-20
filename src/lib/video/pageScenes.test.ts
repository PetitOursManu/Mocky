import { describe, it, expect } from 'vitest'
import { pageScenesIn } from './pageScenes'
import { SCENE3D_PRESETS } from '../capabilities/snippets/Scene3D'

const screen = (body: string) => `export default function Screen() {\n  return (\n${body}\n  )\n}`

describe('what a page draws in 3D, read off the page', () => {
  it('reads the preset and whether the scene is a backdrop', async () => {
    const code = screen(`    <section className="relative">
      <Scene3D preset="grid" color="#303840" accent="#D64A36" className="absolute inset-0 h-full w-full" />
      <h1 className="relative z-10">Serveurs</h1>
    </section>`)
    expect(await pageScenesIn(code)).toEqual([{ preset: 'grid', backdrop: true }])
  })

  it('calls a sized box beside the text what it is: not a backdrop', async () => {
    const code = screen(`    <Scene3D preset="globe" className="h-72 w-full rounded-2xl" />`)
    expect(await pageScenesIn(code)).toEqual([{ preset: 'globe', backdrop: false }])
  })

  it('resolves an unknown preset the way the component does', async () => {
    // <Scene3D> draws an orb for a name it does not know, so the film is told
    // an orb — a film composed against an object nobody drew is worse than one
    // composed against the object that is really there.
    const code = screen(`    <Scene3D preset="dragon" className="absolute inset-0" />`)
    expect(await pageScenesIn(code)).toEqual([{ preset: 'orb', backdrop: true }])
    const bare = screen(`    <Scene3D className="h-64" />`)
    expect((await pageScenesIn(bare))[0].preset).toBe('orb')
    expect(SCENE3D_PRESETS).toContain('orb')
  })

  it('reads a className written as an expression, and gives up on a computed one', async () => {
    const wrapped = screen(`    <Scene3D preset="wave" className={"absolute inset-0"} />`)
    expect(await pageScenesIn(wrapped)).toEqual([{ preset: 'wave', backdrop: true }])
    const template = screen(`    <Scene3D preset="wave" className={\`absolute inset-0\`} />`)
    expect(await pageScenesIn(template)).toEqual([{ preset: 'wave', backdrop: true }])
    // Computed: no literal to read, so the scene is reported without claiming
    // it is a backdrop. Saying "it is not" is a guess; saying nothing is not.
    const computed = screen(`    <Scene3D preset="wave" className={dark ? 'absolute inset-0' : 'h-64'} />`)
    expect(await pageScenesIn(computed)).toEqual([{ preset: 'wave', backdrop: false }])
  })

  /** Invariant I1: the AST, not a regex — `Scene3D` occurs in prose and in strings. */
  it('ignores the name where it is not an element', async () => {
    const code = screen(`    <div>
      {/* A Scene3D would go here one day */}
      <p className="text-sm">Use &lt;Scene3D preset="orb" /&gt; for depth</p>
      <code>{"<Scene3D preset=\\"ring\\" />"}</code>
    </div>`)
    expect(await pageScenesIn(code)).toEqual([])
  })

  it('keeps at most three, and never throws on a page it cannot parse', async () => {
    const many = screen(
      `    <div>${Array.from({ length: 6 }, () => '<Scene3D preset="orb" />').join('')}</div>`,
    )
    expect(await pageScenesIn(many)).toHaveLength(3)
    expect(await pageScenesIn('function ( { <<< not javascript')).toEqual([])
    expect(await pageScenesIn('')).toEqual([])
    // A page with no scene costs no parse at all.
    expect(await pageScenesIn('export default function A() { return <div /> }')).toEqual([])
  })
})
