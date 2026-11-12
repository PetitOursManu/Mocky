import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import DocumentDownloadDialog from './DocumentDownloadDialog'
import { documentHasFields } from '../lib/docExport/files'
import { FIELD_ATTR, PAGE_FORMAT_IDS } from '../lib/pageFormats'
import { partsEn, partsFr } from '../i18n/parts'
import type { Screen } from '../lib/project'

/** As React writes text into markup. */
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')

const screen = {
  id: 's1',
  name: 'Flyer',
  prompt: 'Un flyer',
  code: 'export default function Flyer(){ return null }',
  componentName: 'Flyer',
  createdAt: 0,
  x: 0,
  y: 0,
  w: 794,
  h: 1123,
  page: 'a4-landscape',
} as unknown as Screen

describe('DocumentDownloadDialog', () => {
  it('offers the six downloads as buttons, each explained', () => {
    const html = renderToStaticMarkup(<DocumentDownloadDialog screen={screen} onClose={() => {}} />)
    expect(html).toContain('role="dialog"')
    for (const [kind, key] of [
      ['pdf', 'pdf'],
      ['pptx', 'pptx'],
      ['pptx-edit', 'pptxEdit'],
      ['png', 'png'],
      ['psd', 'psd'],
      ['svg', 'svg'],
    ]) {
      expect(html).toContain(escapeHtml(partsFr[`docExport.${key}.title`]))
      expect(html).toContain(`aria-describedby="doc-export-${kind}-help"`)
    }
    expect(html.match(/aria-describedby="doc-export-/g)).toHaveLength(6)
    // The format the document was made in is named, in words.
    expect(html).toContain(partsFr['docExport.format.a4-landscape'])
  })

  it('says the PowerPoint is the one for Canva, and offers no empty template any more', () => {
    const post = { ...screen, code: 'export default () => <Doc><Page><ShapeFrame shape="arch" src="/x" /></Page></Doc>' }
    const html = renderToStaticMarkup(<DocumentDownloadDialog screen={post} onClose={() => {}} />)
    // Canva is named once, on the heading the two .pptx share.
    expect(partsFr['docExport.group.pptx']).toContain('Canva')
    expect(partsEn['docExport.group.pptx']).toContain('Canva')
    expect(html).toContain(escapeHtml(partsFr['docExport.group.pptx']))
    // A frame you can refill left the empty one nothing to offer.
    expect(html).not.toContain('doc-export-frames')
    expect(html.match(/aria-describedby="doc-export-/g)).toHaveLength(6)
  })

  it('offers the file taken apart for Canva right after the faithful one, and says what it costs', () => {
    const html = renderToStaticMarkup(<DocumentDownloadDialog screen={screen} onClose={() => {}} />)
    expect(html.indexOf('doc-export-pptx-help')).toBeLessThan(html.indexOf('doc-export-pptx-edit-help'))
    expect(html.indexOf('doc-export-pptx-edit-help')).toBeLessThan(html.indexOf('doc-export-png-help'))
    // Side by side under one heading: the same <ul>, nothing between the two buttons.
    const between = html.slice(html.indexOf('doc-export-pptx-help'), html.indexOf('doc-export-pptx-edit-help'))
    expect(between).not.toContain('</ul>')
    expect(html.indexOf(escapeHtml(partsFr['docExport.group.pptx']))).toBeLessThan(html.indexOf('doc-export-pptx-help'))
    for (const parts of [partsFr, partsEn]) {
      expect(parts['docExport.pptxEdit.help']).toBeTruthy()
      expect(parts['docExport.notice.frames']).toContain('{pages}')
      expect(parts['docExport.notice.whole']).toContain('{pages}')
      expect(parts['docExport.notice.raster.pptxEdit']).toContain('{pages}')
    }
  })

  it('promises fillable fields only when the document has some', () => {
    const plain = renderToStaticMarkup(<DocumentDownloadDialog screen={screen} onClose={() => {}} />)
    expect(plain).not.toContain(partsFr['docExport.pdf.titleFields'])
    const form = { ...screen, code: 'export default () => <Page><Field name="nom" /></Page>' }
    const html = renderToStaticMarkup(<DocumentDownloadDialog screen={form} onClose={() => {}} />)
    expect(html).toContain(partsFr['docExport.pdf.titleFields'])
    expect(documentHasFields(`<input ${FIELD_ATTR}="x" />`)).toBe(true)
    expect(documentHasFields('<Fieldset />')).toBe(false)
  })

  it('refuses to export an empty document, and says why', () => {
    const html = renderToStaticMarkup(<DocumentDownloadDialog screen={{ ...screen, code: '  ' }} onClose={() => {}} />)
    expect(html).toContain(partsFr['docExport.empty'])
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('keeps every help to one short line — the dialog was asked to be light', () => {
    for (const parts of [partsFr, partsEn]) {
      for (const key of ['pdf', 'pdf.helpFields', 'pptx', 'pptxEdit', 'png', 'psd', 'svg']) {
        const k = key.includes('.') ? `docExport.${key}` : `docExport.${key}.help`
        expect(parts[k].length, k).toBeLessThanOrEqual(60)
      }
    }
  })

  it('names every page format in both languages — the dialog reads them by id', () => {
    for (const id of PAGE_FORMAT_IDS) {
      expect(partsFr[`docExport.format.${id}`], id).toBeTruthy()
      expect(partsEn[`docExport.format.${id}`], id).toBeTruthy()
    }
  })
})
