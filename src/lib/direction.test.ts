import { describe, it, expect } from 'vitest'
import { resolveDirection } from './direction'

/**
 * The symptom these tests are about, in the user's words: "le design.md d'un
 * iframe à l'autre change alors qu'il devrait rester le même puisque je ne lui
 * ai pas dit d'en changer."
 */

describe('resolveDirection', () => {
  it('keeps the established direction and discards a fresh dossier', () => {
    // THE fix. Muse ran, wrote a dossier, and it does not become the authority:
    // the project already has one and nobody asked for a new one.
    const d = resolveDirection({ established: '# Projet', fresh: '# Nouveau dossier' })
    expect(d.markdown).toBe('# Projet')
    expect(d.establish).toBeUndefined()
  })

  it('establishes the first dossier a project produces', () => {
    // Nothing to protect yet, so this run's dossier becomes the direction — and
    // is kept, which is what stops screen 2 from re-rolling one.
    const d = resolveDirection({ fresh: '# Dossier' })
    expect(d.markdown).toBe('# Dossier')
    expect(d.establish).toBe('# Dossier')
  })

  it('replaces the direction when the user asks for a redesign', () => {
    const d = resolveDirection({ established: '# Ancien', fresh: '# Nouveau', redesign: true })
    expect(d.markdown).toBe('# Nouveau')
    expect(d.establish).toBe('# Nouveau')
  })

  it('falls back to the global DESIGN.md without freezing a copy of it', () => {
    // Establishing here would silently stop the user's later edits to their
    // global document from reaching this project.
    const d = resolveDirection({ global: '# Global' })
    expect(d.markdown).toBe('# Global')
    expect(d.establish).toBeUndefined()
  })

  it('prefers the established direction over the global document', () => {
    expect(resolveDirection({ established: '# Projet', global: '# Global' }).markdown).toBe('# Projet')
  })

  it('prefers a fresh dossier over the global document', () => {
    // Pre-existing Muse semantics: the dossier supersedes DESIGN.md, it does not
    // merge with it.
    const d = resolveDirection({ fresh: '# Dossier', global: '# Global' })
    expect(d.markdown).toBe('# Dossier')
  })

  it('leaves the prompt unconstrained on a redesign with no dossier', () => {
    // Muse off. There is no document to obey and none to keep: the prompt alone
    // dictates the look, and the caller reads the direction back off the code.
    const d = resolveDirection({ established: '# Ancien', redesign: true })
    expect(d.markdown).toBeUndefined()
    expect(d.establish).toBeUndefined()
  })

  it('treats blank as absent everywhere', () => {
    expect(resolveDirection({ established: '  \n ', global: '# Global' }).markdown).toBe('# Global')
    expect(resolveDirection({ fresh: '   ', global: '# Global' }).markdown).toBe('# Global')
    expect(resolveDirection({ global: '  ' }).markdown).toBeUndefined()
    expect(resolveDirection({}).markdown).toBeUndefined()
  })
})
