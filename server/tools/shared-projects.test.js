import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findSharedProjects } from './shared-projects.js'

let dir
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const write = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value))
const blob = (projects) => ({ projects: JSON.stringify(projects), design: null })

describe('findSharedProjects', () => {
  it('lists a project id found in two accounts, most recent copy first, and nothing else', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-shared-'))
    write('users.json', [
      { id: 'a', username: 'alice' },
      { id: 'b', username: 'bob' },
    ])
    write('data-a.json', blob([{ id: 'p1', name: 'Boulangerie', createdAt: 1, updatedAt: 50, screens: [{}, {}] }, { id: 'only-a', name: 'x' }]))
    write('data-b.json', blob([{ id: 'p1', name: 'Boulangerie', createdAt: 1, updatedAt: 10, screens: [{}], deletedAt: 20 }]))
    write('data-c.json', { projects: 'not json' })

    const shared = findSharedProjects(dir)
    expect(shared.map((s) => s.id)).toEqual(['p1'])
    expect(shared[0].copies.map((c) => [c.username, c.screens, c.deleted])).toEqual([
      ['alice', 2, false],
      ['bob', 1, true],
    ])
  })
})
