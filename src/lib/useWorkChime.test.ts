import { describe, it, expect, vi } from 'vitest'
import { attachChimeListeners, type ChimeDocument } from './useWorkChime'

/**
 * A document with just enough of one: listeners keyed by type AND capture
 * flag, like the real thing, so a remove that does not match its add leaks
 * here too.
 */
function fakeDocument(title = 'Mocky') {
  const listeners = new Map<string, Set<(e: Event) => void>>()
  const key = (type: string, capture?: boolean) => `${type}:${capture ? 1 : 0}`
  const doc: ChimeDocument & { fire(e: Event): void; count(): number } = {
    visibilityState: 'visible',
    title,
    addEventListener(type, fn, capture) {
      const k = key(type, capture)
      if (!listeners.has(k)) listeners.set(k, new Set())
      listeners.get(k)!.add(fn)
    },
    removeEventListener(type, fn, capture) {
      listeners.get(key(type, capture))?.delete(fn)
    },
    fire(e) {
      for (const capture of [true, false]) {
        for (const fn of listeners.get(key(e.type, capture)) ?? []) fn(e)
      }
    },
    count() {
      let n = 0
      for (const set of listeners.values()) n += set.size
      return n
    },
  }
  return doc
}

function keydown(key: string): Event {
  return Object.assign(new Event('keydown'), { key })
}

function setup(title?: string) {
  const doc = fakeDocument(title)
  const watcher = { noteVisible: vi.fn(), dispose: vi.fn() }
  const prime = vi.fn()
  const detach = attachChimeListeners(doc, watcher, prime)
  return { doc, watcher, prime, detach }
}

describe('attachChimeListeners', () => {
  it('primes on a click and on Enter, not on other keys', () => {
    const { doc, prime } = setup()
    doc.fire(new Event('click'))
    doc.fire(keydown('Enter'))
    doc.fire(keydown('a'))
    doc.fire(keydown('Escape'))
    expect(prime).toHaveBeenCalledTimes(2)
  })

  it('clears the mark and tells the watcher when the tab becomes visible', () => {
    const { doc, watcher } = setup('✓ Mocky')
    doc.visibilityState = 'hidden'
    doc.fire(new Event('visibilitychange'))
    expect(watcher.noteVisible).not.toHaveBeenCalled()
    expect(doc.title).toBe('✓ Mocky')
    doc.visibilityState = 'visible'
    doc.fire(new Event('visibilitychange'))
    expect(watcher.noteVisible).toHaveBeenCalledTimes(1)
    expect(doc.title).toBe('Mocky')
  })

  it('leaves a title that carries no mark alone', () => {
    const { doc } = setup('Mocky — Projet')
    doc.fire(new Event('visibilitychange'))
    expect(doc.title).toBe('Mocky — Projet')
  })

  it('removes every listener, disposes the watcher and clears the mark on cleanup', () => {
    const { doc, watcher, prime, detach } = setup('⚠ Mocky')
    expect(doc.count()).toBe(3)
    detach()
    expect(doc.count()).toBe(0)
    expect(watcher.dispose).toHaveBeenCalledTimes(1)
    expect(doc.title).toBe('Mocky')
    doc.fire(new Event('click'))
    expect(prime).not.toHaveBeenCalled()
  })
})

describe('attachChimeListeners releases the audio device on return', () => {
  function withRelease(busy: boolean) {
    const doc = fakeDocument()
    const release = vi.fn()
    const detach = attachChimeListeners(doc, { noteVisible: () => {}, dispose: () => {}, busy: () => busy }, () => {}, release)
    return { doc, release, detach }
  }

  it('releases when the person comes back to an idle tab', () => {
    const { doc, release, detach } = withRelease(false)
    doc.visibilityState = 'visible'
    doc.fire(new Event('visibilitychange'))
    expect(release).toHaveBeenCalledTimes(1)
    detach()
  })

  it('keeps the device while work still runs — the person may leave again before it ends', () => {
    const { doc, release, detach } = withRelease(true)
    doc.visibilityState = 'visible'
    doc.fire(new Event('visibilitychange'))
    expect(release).not.toHaveBeenCalled()
    detach()
  })
})
