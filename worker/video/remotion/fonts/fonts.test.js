import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FONT_CATALOGUE, catalogueFamily, facesForTheme, sizeAdjustOf } from './index.js'
import { INSTALLED_FONT_STACK, INSTALLED_MONO_STACK, INSTALLED_SERIF_STACK, fontStack } from '../composition.js'

const here = path.dirname(fileURLToPath(import.meta.url))

describe('which installed face a declared family is', () => {
  it('finds a family by its exact name, whatever the case', () => {
    expect(catalogueFamily('Fraunces')?.family).toBe('Fraunces')
    expect(catalogueFamily('space grotesk')?.family).toBe('Space Grotesk')
  })

  /** What a real dossier wrote, and what a lookup by exact name found nothing for. */
  it('reads through the weight words a direction writes after the name', () => {
    expect(catalogueFamily('Space Grotesk ExtraBold')?.family).toBe('Space Grotesk')
    expect(catalogueFamily('Inter Display')?.family).toBe('Inter')
    expect(catalogueFamily('Playfair Display')?.family).toBe('Playfair Display')
  })

  it('finds the installed family inside a sentence, longest name first', () => {
    expect(catalogueFamily('SF Pro Display ou Inter Display')?.family).toBe('Inter')
    expect(catalogueFamily('Inter Tight')?.family).toBe('Inter Tight')
  })

  it('reaches for the open cousin of a commercial face, and only a well-known one', () => {
    expect(catalogueFamily('SF Pro')?.family).toBe('Inter')
    expect(catalogueFamily('Gotham')?.family).toBe('Montserrat')
    // Liberation Sans is metric-compatible with both, and already the fallback.
    expect(catalogueFamily('Helvetica Neue')).toBeNull()
    expect(catalogueFamily('Arial')).toBeNull()
  })

  it('answers null for nothing, rather than a guess', () => {
    expect(catalogueFamily('')).toBeNull()
    expect(catalogueFamily(undefined)).toBeNull()
    expect(catalogueFamily('Comic Neue Wobble')).toBeNull()
  })
})

describe('how an installed face is sized', () => {
  /**
   * Never above 1. The layout estimated every line on Liberation Sans; a wider
   * face is scaled back onto that estimate, and a narrower one is left alone —
   * enlarging it would push its glyphs out of the line box the heading masks.
   */
  it('shrinks a wide family onto the estimate and never enlarges a narrow one', () => {
    for (const entry of FONT_CATALOGUE) {
      const adjust = sizeAdjustOf(entry)
      expect(adjust, entry.family).toBeLessThanOrEqual(1)
      expect(adjust * Math.max(1, entry.advance), entry.family).toBeCloseTo(1, 2)
    }
    expect(sizeAdjustOf(catalogueFamily('Syne'))).toBeLessThan(0.7)
    expect(sizeAdjustOf(catalogueFamily('Bebas Neue'))).toBe(1)
  })

  it('loads each family a theme names once, heading and body together', () => {
    const faces = facesForTheme({ fonts: { heading: 'Fraunces', body: 'Fraunces Variable' } })
    expect(new Set(faces.map((f) => f.family))).toEqual(new Set(['Fraunces']))
    expect(facesForTheme({ fonts: { heading: 'Helvetica Neue', body: 'Arial' } })).toEqual([])
    expect(facesForTheme(undefined)).toEqual([])
    // A value the schema refuses loads nothing, even when it contains a real name.
    expect(facesForTheme({ fonts: { heading: 'Inter"; color: red' } })).toEqual([])
  })
})

describe('the stack a composition sets type in', () => {
  it('names the installed face first, then the Liberation of its own class', () => {
    expect(fontStack('Fraunces')).toBe(`"Fraunces", ${INSTALLED_SERIF_STACK}`)
    expect(fontStack('Space Grotesk ExtraBold')).toBe(`"Space Grotesk", ${INSTALLED_FONT_STACK}`)
    expect(fontStack('JetBrains Mono')).toBe(`"JetBrains Mono", ${INSTALLED_MONO_STACK}`)
    // Unknown families keep the behaviour they always had.
    expect(fontStack('Helvetica Neue')).toBe(`"Helvetica Neue", ${INSTALLED_FONT_STACK}`)
  })
})

describe('the catalogue and what the image installs agree', () => {
  const files = fs.readFileSync(path.join(here, 'files.js'), 'utf8')
  const manifest = JSON.parse(fs.readFileSync(path.join(here, '../../package.json'), 'utf8'))

  /**
   * Read as text, because importing `files.js` means resolving seventy .woff2
   * files this checkout does not have. A face in the catalogue with no file is a
   * render that waits on nothing and sets the fallback; a file with no package is
   * a bundle that fails to build.
   */
  it('has a file for every face, from a package the worker installs', () => {
    for (const entry of FONT_CATALOGUE) {
      for (const face of entry.faces) expect(files, face.key).toContain(`'${face.key}': { latin: `)
    }
    const packages = [...files.matchAll(/from '(@fontsource(?:-variable)?\/[a-z0-9-]+)\//g)].map((m) => m[1])
    for (const pkg of new Set(packages)) expect(manifest.dependencies, pkg).toHaveProperty(pkg)
  })

  it('pins every font package to an exact version, like the renderer', () => {
    for (const [name, version] of Object.entries(manifest.dependencies)) {
      if (name.startsWith('@fontsource')) expect(version, name).toMatch(/^\d+\.\d+\.\d+$/)
    }
  })

  it('carries no family name that could not be quoted into CSS', () => {
    for (const entry of FONT_CATALOGUE) expect(entry.family).toMatch(/^[\p{L}\p{N}][\p{L}\p{N} -]{0,47}$/u)
  })
})
