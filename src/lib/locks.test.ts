import { describe, expect, it } from 'vitest'
import { enforceLocks, isLocked, LOCK_ATTR, lockedElements, lockRule, setLocks } from './locks'
import { elementsOf } from './screenElements'

const SCREEN = `export default function App() {
  return (
    <main className="p-8">
      <header className="flex">
        <img src="/api/images/logo.png" alt="Logo Elisa30" className="h-12" />
        <nav className="gap-4">Menu</nav>
      </header>
      <h1 className="text-5xl">Portes ouvertes</h1>
    </main>
  )
}
`

/** The chain a click on the n-th JSX element (in source order) reports. */
const at = (rank: number) => [{ rank, index: 0 }]

async function rankOf(code: string, tag: string): Promise<number> {
  const paths = (await elementsOf(code))!
  return paths.findIndex((p) => p.node.openingElement.name.name === tag)
}

async function lockOn(code: string, tag: string): Promise<string> {
  return (await setLocks(code, [at(await rankOf(code, tag))], true))!
}

describe('setLocks', () => {
  it('writes the attribute after the element name, and takes it off again', async () => {
    const locked = await lockOn(SCREEN, 'img')
    expect(locked).toMatch(new RegExp(`<img ${LOCK_ATTR}="[a-z0-9]+" src=`))
    expect(await isLocked(locked, at(await rankOf(locked, 'img')))).toBe(true)
    const [l] = (await lockedElements(locked))!
    expect(l).toMatchObject({ tag: 'img', label: 'Logo Elisa30' })
    expect(await setLocks(locked, [at(await rankOf(locked, 'img'))], false)).toBe(SCREEN)
  })

  it('does nothing to an element already in the state asked for', async () => {
    const locked = await lockOn(SCREEN, 'h1')
    expect(await setLocks(locked, [at(await rankOf(locked, 'h1'))], true)).toBe(locked)
    expect(await setLocks(SCREEN, [at(await rankOf(SCREEN, 'h1'))], false)).toBe(SCREEN)
  })

  it('refuses a pick it cannot find', async () => {
    expect(await setLocks(SCREEN, [at(99)], true)).toBeNull()
    expect(await setLocks('<div', [at(0)], true)).toBeNull()
  })
})

describe('enforceLocks', () => {
  it('writes a changed locked element back as it was, and leaves the rest of the pass', async () => {
    const before = await lockOn(SCREEN, 'img')
    const after = before.replace('className="h-12"', 'className="h-20 rounded-full"').replace('Portes ouvertes', 'Journée portes ouvertes')
    const out = await enforceLocks(before, after)
    expect(out.restored).toEqual(['Logo Elisa30'])
    expect(out.lost).toEqual([])
    expect(out.code).toContain('className="h-12"')
    expect(out.code).toContain('Journée portes ouvertes')
  })

  it('finds the element again when the model dropped the attribute', async () => {
    const before = await lockOn(SCREEN, 'img')
    const after = SCREEN.replace('alt="Logo Elisa30" className="h-12"', 'alt="Logo Elisa30" className="h-16"')
    const out = await enforceLocks(before, after)
    expect(out.restored).toEqual(['Logo Elisa30'])
    expect(out.code).toBe(before)
  })

  it('reports a locked element the pass removed', async () => {
    const before = await lockOn(SCREEN, 'h1')
    const after = SCREEN.replace(/\s*<h1[^]*?<\/h1>/, '')
    const out = await enforceLocks(before, after)
    expect(out.lost).toEqual(['Portes ouvertes'])
  })

  it('keeps a lock inside a locked block by keeping the block', async () => {
    let code = await lockOn(SCREEN, 'img')
    code = await lockOn(code, 'header')
    const after = code.replace('>Menu<', '>Accueil<').replace('className="h-12"', 'className="h-8"')
    const out = await enforceLocks(code, after)
    expect(out.code).toBe(code)
    expect(out.restored).toHaveLength(1)
  })

  it('changes nothing on a screen with no lock, or a pass that kept them', async () => {
    const after = SCREEN.replace('p-8', 'p-6')
    expect(await enforceLocks(SCREEN, after)).toEqual({ code: after, restored: [], lost: [] })
    const locked = await lockOn(SCREEN, 'img')
    const kept = locked.replace('p-8', 'p-6')
    expect(await enforceLocks(locked, kept)).toEqual({ code: kept, restored: [], lost: [] })
  })
})

describe('lockRule', () => {
  it('names the locked elements for the model, and says nothing without one', async () => {
    expect(await lockRule(SCREEN)).toBe('')
    const rule = await lockRule(await lockOn(SCREEN, 'img'))
    expect(rule).toContain(LOCK_ATTR)
    expect(rule).toContain('<img> “Logo Elisa30”')
  })
})
