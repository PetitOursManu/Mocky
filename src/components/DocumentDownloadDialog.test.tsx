import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import DocumentDownloadDialog from './DocumentDownloadDialog'
import { documentHasFields } from '../lib/docExport/files'
import { FIELD_ATTR, PAGE_FORMAT_IDS } from '../lib/pageFormats'
import { partsEn, partsFr } from '../i18n/parts'
import type { Screen } from '../lib/project'

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
  it('offers the three downloads as buttons, each explained', () => {
    const html = renderToStaticMarkup(<DocumentDownloadDialog screen={screen} onClose={() => {}} />)
    expect(html).toContain('role="dialog"')
    expect(html).toContain(partsFr['docExport.pdf.title'])
    expect(html).toContain(partsFr['docExport.pptx.title'])
    expect(html).toContain(partsFr['docExport.png.title'])
    expect(html.match(/aria-describedby="doc-export-/g)).toHaveLength(3)
    // The format the document was made in is named, in words.
    expect(html).toContain(partsFr['docExport.format.a4-landscape'])
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

  it('names every page format in both languages — the dialog reads them by id', () => {
    for (const id of PAGE_FORMAT_IDS) {
      expect(partsFr[`docExport.format.${id}`], id).toBeTruthy()
      expect(partsEn[`docExport.format.${id}`], id).toBeTruthy()
    }
  })
})
