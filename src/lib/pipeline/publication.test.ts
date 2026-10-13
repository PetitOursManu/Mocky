import { describe, expect, it, vi } from 'vitest'
import type { NewScreenHooks, NewScreenRequest } from './newScreen'
import type { Publication } from '../publication'

const calls: NewScreenRequest[] = []
vi.mock('./newScreen', () => ({
  runNewScreen: vi.fn(async (req: NewScreenRequest) => {
    calls.push(req)
    // The first sheet's run settles the direction; the later ones follow it.
    return { screenId: `screen-${calls.length}`, direction: req.publication?.direction ?? '# The dossier of sheet 1' }
  }),
}))

const { runPublication } = await import('./publication')

const PUB: Publication = {
  id: 'pub-1',
  kind: 'magazine',
  title: 'Lent',
  brief: 'Un magazine de voyage lent',
  page: 'a4',
  sheets: [
    { id: 's1', title: 'Couverture', role: 'cover', pages: 1, brief: '' },
    { id: 's2', title: 'Sommaire', role: 'contents', pages: 2, brief: '' },
    { id: 's3', title: 'Açores', role: 'feature', pages: 4, brief: '' },
  ],
  createdAt: 0,
}

describe('runPublication', () => {
  it('runs Muse on the first sheet only, and generates every later sheet under the direction it wrote', async () => {
    calls.length = 0
    const base = { museConfig: { enabled: false }, museAvail: true, flows: true } as unknown as NewScreenRequest
    const hooks = { signal: new AbortController().signal, currentScreens: () => [] } as unknown as NewScreenHooks
    const directions: string[] = []
    const made = await runPublication(base, hooks, PUB, {
      getProject: () => ({ id: 'p' }) as NewScreenRequest['project'],
      onDirection: (d) => directions.push(d),
    })
    expect(made.map((m) => m.sheet)).toEqual(['s1', 's2', 's3'])
    expect(calls.map((c) => c.museConfig.enabled)).toEqual([true, false, false])
    expect(calls.map((c) => c.publication?.direction)).toEqual([undefined, '# The dossier of sheet 1', '# The dossier of sheet 1'])
    expect(directions).toEqual(['# The dossier of sheet 1'])
    // Each sheet is a page of the magazine type, numbered where it falls, and
    // nothing of a typed request or a flow leaks into it.
    expect(calls.map((c) => c.publication?.record.firstPage)).toEqual([1, 2, 4])
    expect(calls.every((c) => c.themeId === 'magazine' && c.pageFormatId === 'a4' && c.flows === undefined)).toBe(true)
    expect(calls[2].publicationContext).toContain('It holds pages 4 to 7')
  })

  it('stops at once when cancelled', async () => {
    calls.length = 0
    const ac = new AbortController()
    ac.abort()
    const hooks = { signal: ac.signal, currentScreens: () => [] } as unknown as NewScreenHooks
    await expect(
      runPublication({ museConfig: {} } as unknown as NewScreenRequest, hooks, PUB, { getProject: () => ({}) as never, onDirection: () => {} }),
    ).rejects.toThrow(/Aborted/)
    expect(calls).toHaveLength(0)
  })
})
