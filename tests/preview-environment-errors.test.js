import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isEnvironmentError } from '../src/lib/previewErrors'

/**
 * The repair loop must never be spent on a frame that could not load its own
 * runtime — see src/lib/previewErrors.ts. Read against Preview.tsx's own
 * sentences so a reworded message cannot slip back into the loop unnoticed.
 */
describe('isEnvironmentError', () => {
  it('recognises every runtime-load failure the preview frame reports', () => {
    const preview = readFileSync(new URL('../src/components/Preview.tsx', import.meta.url), 'utf8')
    const written = [...preview.matchAll(/fail\('((?:React|ReactDOM|Babel) failed to load from [^']+)'\)/g)].map((m) => m[1])
    expect(written).toHaveLength(3)
    for (const m of written) expect(isEnvironmentError(m), m).toBe(true)
    expect(isEnvironmentError('Capability "three-lib" failed to load: window.THREE is undefined (CDN script may have failed).')).toBe(true)
  })

  it('leaves real code errors to the repair loop', () => {
    expect(isEnvironmentError('Unexpected token (12:4)')).toBe(false)
    expect(isEnvironmentError('Element type is invalid (React #130): …')).toBe(false)
    expect(isEnvironmentError('ReferenceError: Backdrop is not defined')).toBe(false)
  })
})
