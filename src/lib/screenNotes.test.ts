import { describe, it, expect } from 'vitest'
import { normalizeScreen, type Screen } from './project'
import { addNote, editNote, normalizeNotes, NOTE_MAX_LEN, NOTES_MAX, removeNote } from './screenNotes'

const screen = (over: Partial<Screen> = {}): Partial<Screen> => ({
  id: 's1',
  name: 'Écran',
  prompt: '',
  code: '',
  componentName: 'App',
  createdAt: 1,
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  device: 'none',
  links: [],
  ...over,
})

describe('notes survive a reload', () => {
  it('are kept by normalizeScreen', () => {
    // `normalizeScreen` rebuilds screens from a whitelist; a field it forgets
    // survives the session that wrote it and is gone the next morning.
    const notes = [{ id: 'a', text: 'Garder le hero', createdAt: 5 }]
    expect(normalizeScreen(screen({ userNotes: notes }), 0).userNotes).toEqual(notes)
  })

  it('stay absent on a screen that never had any', () => {
    expect(normalizeScreen(screen(), 0).userNotes).toBeUndefined()
    expect(normalizeScreen(screen({ userNotes: [] }), 0).userNotes).toBeUndefined()
  })
})

describe('normalizeNotes', () => {
  it('drops blank and malformed entries', () => {
    expect(normalizeNotes([null, 3, { text: '   ' }, { text: 7 }, 'x'])).toBeUndefined()
    expect(normalizeNotes('nope')).toBeUndefined()
  })

  it('gives a duplicated id a fresh one, so edit and delete act on one note', () => {
    const out = normalizeNotes([
      { id: 'a', text: 'un', createdAt: 1 },
      { id: 'a', text: 'deux', createdAt: 2 },
    ])!
    expect(out).toHaveLength(2)
    expect(out[0].id).toBe('a')
    expect(out[1].id).not.toBe('a')
  })

  it('caps length and count', () => {
    const long = normalizeNotes([{ id: 'a', text: 'x'.repeat(NOTE_MAX_LEN + 50), createdAt: 1 }])!
    expect(long[0].text).toHaveLength(NOTE_MAX_LEN)
    const many = Array.from({ length: NOTES_MAX + 5 }, (_, i) => ({ id: `n${i}`, text: `${i}`, createdAt: i + 1 }))
    const kept = normalizeNotes(many)!
    expect(kept).toHaveLength(NOTES_MAX)
    // The oldest go: the newest note is the one just written.
    expect(kept[kept.length - 1].id).toBe(`n${NOTES_MAX + 4}`)
  })
})

describe('add, edit, remove', () => {
  it('adds a trimmed note and ignores blank text', () => {
    const one = addNote(undefined, '  trop dense  ', 10)!
    expect(one).toHaveLength(1)
    expect(one[0]).toMatchObject({ text: 'trop dense', createdAt: 10 })
    expect(addNote(one, '   ')).toBe(one)
  })

  it('marks an edit, and leaves an unchanged text alone', () => {
    const one = addNote(undefined, 'avant', 10)!
    const id = one[0].id
    expect(editNote(one, id, 'après', 20)![0]).toMatchObject({ text: 'après', updatedAt: 20 })
    expect(editNote(one, id, 'avant', 20)![0].updatedAt).toBeUndefined()
  })

  it('deletes a note emptied by an edit, and returns undefined when none are left', () => {
    const one = addNote(undefined, 'seule', 10)!
    expect(editNote(one, one[0].id, '  ')).toBeUndefined()
    expect(removeNote(one, one[0].id)).toBeUndefined()
  })
})
