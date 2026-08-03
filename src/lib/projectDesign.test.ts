import { describe, it, expect } from 'vitest'
import { designForProject } from './project'
import { mergeProjects } from './merge'
import type { Project } from './project'

function project(id: string, over: Partial<Project> = {}): Project {
  return { id, name: id, createdAt: 0, updatedAt: 1, screens: [], ...over }
}

/**
 * One design direction per PROJECT.
 *
 * DESIGN.md is global — one per browser, shared by every project — which is why
 * Muse minted a fresh dossier on every generation: it had nowhere to put a
 * direction belonging to one project. The result was a project with as many
 * visual languages as it had screens.
 */

describe('designForProject', () => {
  it('prefers the project’s own direction', () => {
    expect(designForProject(project('a', { design: '# Projet' }), '# Global')).toBe('# Projet')
  })

  it('falls back to the global DESIGN.md', () => {
    // Every project that existed before this field does exactly this, and keeps
    // doing it — nothing is rewritten behind anyone's back.
    expect(designForProject(project('a'), '# Global')).toBe('# Global')
  })

  it('treats a blank direction as absent, not as a direction', () => {
    // Otherwise an empty string would silently strip the fallback and generate
    // with no design at all.
    expect(designForProject(project('a', { design: '   \n ' }), '# Global')).toBe('# Global')
  })

  it('returns nothing when neither exists', () => {
    expect(designForProject(project('a'), undefined)).toBeUndefined()
    expect(designForProject(project('a'), '  ')).toBeUndefined()
    expect(designForProject(null, undefined)).toBeUndefined()
  })
})

describe('the direction survives a merge', () => {
  it('rides along on a project the other side does not know about', () => {
    // Same property `folder` relies on: the server keeps the projects blob as an
    // opaque string and mergeProjects moves whole Project objects, so a client
    // that has never heard of this field must not strip it.
    const local = [project('a', { design: '# Projet', updatedAt: 2 })]
    const remote = [project('a', { updatedAt: 1 })]
    expect(mergeProjects(local, remote).find((p) => p.id === 'a')?.design).toBe('# Projet')
  })

  it('lets the newer side win', () => {
    const local = [project('a', { design: '# Ancien', updatedAt: 1 })]
    const remote = [project('a', { design: '# Nouveau', updatedAt: 9 })]
    expect(mergeProjects(local, remote).find((p) => p.id === 'a')?.design).toBe('# Nouveau')
  })

  it('propagates a direction being cleared', () => {
    // Clearing deletes the key rather than writing an empty string, so the newer
    // record simply has none. If merge preferred "a defined value" over recency,
    // going back to the global DESIGN.md would never reach the other device.
    const local = [project('a', { updatedAt: 9 })]
    const remote = [project('a', { design: '# Projet', updatedAt: 1 })]
    expect(mergeProjects(local, remote).find((p) => p.id === 'a')?.design).toBeUndefined()
  })
})
