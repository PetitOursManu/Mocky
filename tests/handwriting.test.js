import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { textToSvg } from 'tegaki/core'
import { HandwritingSource, HANDWRITING_FALLBACK, HANDWRITING_FONTS } from '../src/lib/capabilities/snippets/Handwriting'
import { CAPABILITY_MAP } from '../src/lib/capabilities/registry'
import { capabilitiesUsedBy } from '../src/lib/capabilities/select'

/**
 * `<Handwriting>` from the very string the preview prepends, plus the fonts it
 * writes with, read from the same `tegaki` package the vendor files are built
 * from. What a browser adds — the strokes drawing themselves — was checked in a
 * real frame.
 */

const scope = new Function(
  'React',
  `${HandwritingSource}\nreturn { Handwriting: Handwriting, plain: mockyHwPlain, covers: mockyHwCovers, color: mockyHwColor }`,
)(React)
const html = (props) => renderToStaticMarkup(React.createElement(scope.Handwriting, props))

async function bundle(id) {
  return (await import(`tegaki/fonts/${id}`)).default
}

describe('the handwriting fonts', () => {
  it('are the fonts the vendor build ships, no more and no fewer', () => {
    const script = fs.readFileSync(path.resolve(import.meta.dirname, '../scripts/build-vendor-tegaki.mjs'), 'utf8')
    const listed = JSON.parse(/TEGAKI_FONTS = (\[[^\]]*\])/.exec(script)[1].replace(/'/g, '"'))
    expect([...listed].sort()).toEqual([...HANDWRITING_FONTS].sort())
    for (const id of HANDWRITING_FONTS) {
      expect(fs.existsSync(path.resolve(import.meta.dirname, `../public/vendor/tegaki-${id}.js`)), id).toBe(true)
    }
  })

  /**
   * The fallback exists for French. Three of the five carry ASCII only, so the
   * one a text falls back to must write every letter a French sentence uses —
   * after the typography a hand does not have has been plainened.
   */
  it('falls back to a font that writes French whole', async () => {
    const fallback = await bundle(HANDWRITING_FALLBACK)
    const french = scope.plain('À l’été, Noël où l’on fête « Œuvres » — déjà ! Ça ôte ïambe, ü ñ É Ç Ù')
    expect(scope.covers(fallback, french)).toBe(true)
    expect(scope.covers(await bundle('parisienne'), 'Été')).toBe(false)
    expect(scope.covers(await bundle('parisienne'), 'Merci beaucoup !')).toBe(true)
  })

  it('plainens the typography a pen does not have', () => {
    expect(scope.plain('l’œuf  « Bonjour »…  —  fin')).toBe(`l'oeuf "Bonjour"... - fin`)
  })
})

describe('<Handwriting>', () => {
  it('is text to a reader, and the drawing is hidden from it', () => {
    const out = html({ text: 'Merci !', font: 'caveat', className: 'text-6xl text-rose-700' })
    expect(out).toContain('Merci !')
    expect(out).toContain('aria-hidden="true"')
    expect(out).toContain('text-6xl text-rose-700')
  })

  it('holds its place unseen until the words are drawn', () => {
    // Server-side, no effect runs: this is the frame before the font arrives.
    expect(html({ text: 'Bonjour' })).toMatch(/visibility:hidden/)
  })

  it('takes only a hex as colour', () => {
    expect(scope.color('#e11d48')).toBe('#e11d48')
    expect(scope.color('red; background:url(x)')).toBe('currentColor')
    expect(scope.color(undefined)).toBe('currentColor')
  })

  /**
   * Inline SVG shares the page's names, and every one Tegaki writes starts with
   * `tk-`: keyframes, classes, mask ids and the `url(#…)` that reads them. Two
   * signatures on one page animated each other's strokes until each renamed its
   * own.
   */
  it('renames every name the SVG declares or references', async () => {
    const svg = textToSvg('Mocky', await bundle('parisienne'), { mode: 'once', color: 'currentColor', fontSize: 100, crop: false })
    const scoped = svg.replace(/\btk-/g, 'tk-h7-')
    expect(svg).toMatch(/tk-/)
    expect(scoped.match(/tk-(?!h7-)/g)).toBeNull()
  })
})

describe('the handwriting capability', () => {
  it('needs the renderer, and is detected by the component it offers', () => {
    expect(CAPABILITY_MAP.handwriting.requires).toEqual(['tegaki-lib'])
    expect(CAPABILITY_MAP['tegaki-lib'].cdn?.url).toBe('/vendor/tegaki.js')
    expect(capabilitiesUsedBy('export default function A() { return <Handwriting text="Hi" /> }')).toContain('handwriting')
  })
})
