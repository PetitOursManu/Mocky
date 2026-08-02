import { describe, it, expect, beforeEach } from 'vitest'
import {
  listDesigns,
  saveDesignToLibrary,
  renameDesignEntry,
  deleteDesignEntry,
  applyDesignEntry,
  findDesignByMarkdown,
  uniqueDesignName,
  setDesignEnabled,
  loadDesign,
  saveDesign,
  MAX_LIBRARY_ENTRIES,
} from './design'

/**
 * DESIGN.md used to be one mutable document: adopting a second look destroyed
 * the first. What is pinned here is the part that makes a library trustworthy —
 * saving never silently overwrites, applying is always undoable, and the store
 * survives the shapes it will actually meet (a config written before the
 * library existed, a corrupt blob).
 */

/** localStorage does not exist in the node test environment. */
beforeEach(() => {
  const mem = new Map<string, string>()
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
  }
})

describe('saving', () => {
  it('keeps a system under a name', () => {
    const e = saveDesignToLibrary('House style', '# Design System\n- Primary: #123456')
    expect(e.name).toBe('House style')
    expect(listDesigns()).toHaveLength(1)
  })

  it('suffixes a duplicate name instead of refusing the save', () => {
    // Being told "that name is taken" mid-save is an interruption, not a service.
    saveDesignToLibrary('Brand', '# a')
    const second = saveDesignToLibrary('Brand', '# b')
    expect(second.name).toBe('Brand (2)')
    expect(listDesigns()).toHaveLength(2)
  })

  it('falls back to a usable name when given none', () => {
    expect(saveDesignToLibrary('   ', '# a').name).toBe('Design')
  })

  it('is bounded', () => {
    for (let i = 0; i < MAX_LIBRARY_ENTRIES; i++) saveDesignToLibrary(`d${i}`, `# ${i}`)
    expect(() => saveDesignToLibrary('one more', '# x')).toThrow(/delete one first/i)
  })

  it('records where a system came from', () => {
    expect(saveDesignToLibrary('From a screen', '# a', 'screen').origin).toBe('screen')
  })
})

describe('applying', () => {
  it('makes a saved system current', () => {
    const e = saveDesignToLibrary('Brand', '# Design System\n- Primary: #abcdef')
    applyDesignEntry(e.id)
    expect(loadDesign().markdown).toContain('#abcdef')
    expect(loadDesign().enabled).toBe(true)
  })

  it('keeps the replaced document recoverable', () => {
    saveDesign({ ...loadDesign(), markdown: '# the one I had' })
    const e = saveDesignToLibrary('Other', '# the new one')
    applyDesignEntry(e.id)
    expect(loadDesign().previousMarkdown).toBe('# the one I had')
  })

  it('does nothing for an unknown id rather than blanking the document', () => {
    saveDesign({ ...loadDesign(), markdown: '# keep me' })
    expect(applyDesignEntry('nope')).toBeNull()
    expect(loadDesign().markdown).toBe('# keep me')
  })
})

describe('renaming and deleting', () => {
  it('renames', () => {
    const e = saveDesignToLibrary('Old', '# a')
    renameDesignEntry(e.id, 'New')
    expect(listDesigns()[0].name).toBe('New')
  })

  it('does not collide a rename with another entry', () => {
    saveDesignToLibrary('Taken', '# a')
    const e = saveDesignToLibrary('Free', '# b')
    renameDesignEntry(e.id, 'Taken')
    expect(listDesigns().find((x) => x.id === e.id)!.name).toBe('Taken (2)')
  })

  it('lets an entry keep its own name on a no-op rename', () => {
    const e = saveDesignToLibrary('Same', '# a')
    renameDesignEntry(e.id, 'Same')
    expect(listDesigns()[0].name).toBe('Same')
  })

  it('deletes', () => {
    const e = saveDesignToLibrary('Bye', '# a')
    deleteDesignEntry(e.id)
    expect(listDesigns()).toHaveLength(0)
  })

  it('deleting a saved system does not touch the current document', () => {
    const e = saveDesignToLibrary('Brand', '# brand')
    applyDesignEntry(e.id)
    deleteDesignEntry(e.id)
    expect(loadDesign().markdown).toBe('# brand')
  })
})

describe('enabled, distinct from cleared', () => {
  it('turning off keeps the text', () => {
    saveDesign({ ...loadDesign(), markdown: '# still here', enabled: true })
    setDesignEnabled(false)
    expect(loadDesign().enabled).toBe(false)
    expect(loadDesign().markdown).toBe('# still here')
  })
})

describe('shapes it will actually meet', () => {
  it('a config written before the library existed', () => {
    localStorage.setItem('mocky.design.v1', JSON.stringify({ markdown: '# old', enabled: true }))
    expect(listDesigns()).toEqual([])
    expect(() => saveDesignToLibrary('First', '# a')).not.toThrow()
  })

  it('a library field that is not an array', () => {
    localStorage.setItem('mocky.design.v1', JSON.stringify({ markdown: '', enabled: true, library: 'nope' }))
    expect(listDesigns()).toEqual([])
  })
})

describe('helpers', () => {
  it('finds an already-saved document so a duplicate is not offered', () => {
    saveDesignToLibrary('Brand', '# Design System\n- Primary: #111111')
    expect(findDesignByMarkdown('  # Design System\n- Primary: #111111  ')).not.toBeNull()
    expect(findDesignByMarkdown('# something else')).toBeNull()
  })

  it('uniqueDesignName leaves a free name alone', () => {
    expect(uniqueDesignName('Fresh', [])).toBe('Fresh')
  })
})
