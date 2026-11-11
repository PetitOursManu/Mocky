import { describe, expect, it } from 'vitest'
import type { Project } from './project'
import { DEFAULT_SORT, isDefaultSort, parseSorts, sortProjects } from './projectSort'

const p = (id: string, name: string, createdAt: number, updatedAt: number, screens = 0) =>
  ({ id, name, createdAt, updatedAt, screens: Array.from({ length: screens }, () => ({})) }) as unknown as Project

const list = [p('a', 'Zèbre', 3, 10, 1), p('b', 'alpha', 1, 30, 4), p('c', 'Projet 10', 2, 20, 2), p('d', 'Projet 9', 4, 5)]
const ids = (xs: Project[]) => xs.map((x) => x.id).join('')

describe('sortProjects', () => {
  it('defaults to the last change, newest first — the order the page always had', () => {
    expect(isDefaultSort(DEFAULT_SORT)).toBe(true)
    expect(ids(sortProjects(list, DEFAULT_SORT))).toBe('bcad')
  })
  it('sorts by creation, by screen count, and both ways', () => {
    expect(ids(sortProjects(list, { key: 'created', dir: 'desc' }))).toBe('dacb')
    expect(ids(sortProjects(list, { key: 'created', dir: 'asc' }))).toBe('bcad')
    expect(ids(sortProjects(list, { key: 'screens', dir: 'desc' }))).toBe('bcad')
  })
  it('sorts names the way a person reads them: case and accents aside, numbers as numbers', () => {
    expect(ids(sortProjects(list, { key: 'name', dir: 'asc' }))).toBe('bdca')
  })
  it('breaks ties on the last change, then the id, so equal projects never swap', () => {
    const twins = [p('y', 'Same', 1, 1), p('x', 'Same', 1, 1), p('z', 'Same', 1, 2)]
    expect(ids(sortProjects(twins, { key: 'name', dir: 'asc' }))).toBe('zxy')
  })
  it('does not reorder its input', () => {
    const copy = [...list]
    sortProjects(list, { key: 'name', dir: 'asc' })
    expect(list).toEqual(copy)
  })
})

describe('parseSorts', () => {
  it('keeps valid choices and drops anything else', () => {
    expect(
      parseSorts({ root: { key: 'name', dir: 'asc' }, f1: { key: 'size', dir: 'asc' }, f2: { key: 'created', dir: 'up' }, f3: 4 }),
    ).toEqual({ root: { key: 'name', dir: 'asc' } })
    expect(parseSorts(null)).toEqual({})
    expect(parseSorts([1])).toEqual({})
  })
})
