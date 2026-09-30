import { describe, expect, it } from 'vitest'
import { PDFCheckBox, PDFDocument, PDFDropdown, PDFHexString, PDFName, PDFTextField, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import { getPageFormat } from '../pageFormats'
import { asciiHex, baselineY, buildPdf, fieldFontSize, horizontalScale, toPdfRect, uniqueFieldNames } from './pdf'
import { TINY_JPEG, field, flyerPage, line } from './fixtures'

const a4 = getPageFormat('a4')

/** Every content stream of a page, decoded, as text — where the operators live. */
function contentOf(doc: PDFDocument, pageIndex: number): string {
  const page = doc.getPage(pageIndex)
  const contents = page.node.Contents()
  const refs = contents && 'asArray' in contents ? (contents as any).asArray() : [page.node.get(PDFName.of('Contents'))]
  let out = ''
  for (const ref of refs) {
    const stream = doc.context.lookup(ref)
    if (stream instanceof PDFRawStream) out += new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode())
    else if (stream && 'getContentsString' in (stream as any)) out += (stream as any).getContentsString()
  }
  return out
}

describe('asciiHex', () => {
  it('writes each byte as two hex digits', () => {
    expect(asciiHex('a(b)')).toBe('61286229')
    expect(asciiHex('')).toBe('')
  })
})

describe('geometry', () => {
  it('flips y and lands the page edge on the paper edge', () => {
    const r = toPdfRect({ x: 0, y: 0, w: a4.w, h: a4.h }, a4)
    expect(r.x).toBe(0)
    expect(r.y).toBeCloseTo(0, 6)
    expect(r.width).toBeCloseTo(a4.widthPt, 6)
    expect(r.height).toBeCloseTo(a4.heightPt, 6)
    // A box at the top of the page sits at the top of the PDF page.
    const top = toPdfRect({ x: 10, y: 0, w: 100, h: 20 }, a4)
    expect(top.y + top.height).toBeCloseTo(a4.heightPt, 6)
  })

  it('puts the baseline inside the line box, towards its foot', () => {
    const b = baselineY(line('x', 0, 100, 10, 20))
    expect(b).toBeGreaterThan(110)
    expect(b).toBeLessThan(120)
  })

  it('bounds the horizontal scale', () => {
    expect(horizontalScale(100, 50)).toBe(50)
    expect(horizontalScale(1, 1000)).toBe(500)
    expect(horizontalScale(0, 10)).toBe(100)
  })
})

describe('uniqueFieldNames', () => {
  it('dedupes across the whole document, case-insensitively, and drops dots', () => {
    expect(uniqueFieldNames(['email', 'Email', 'email', 'a.b', '', 'é'])).toEqual([
      'email',
      'Email_2',
      'email_3',
      'a_b',
      'field',
      'é',
    ])
  })
})

describe('fieldFontSize', () => {
  it('keeps the page size when it fits, and shrinks it to fit the box', () => {
    expect(fieldFontSize({ type: 'text', fontSize: 16 }, 30, 0.75)).toBe(12)
    expect(fieldFontSize({ type: 'text', fontSize: 40 }, 20, 0.75)).toBe(14)
  })

  it('sets a paragraph at a form body size, whatever the placeholder was set in', () => {
    expect(fieldFontSize({ type: 'multiline', fontSize: 40 }, 200, 0.75)).toBe(14)
    expect(fieldFontSize({ type: 'multiline', fontSize: 2 }, 200, 0.75)).toBe(6)
  })
})

describe('buildPdf', () => {
  it('builds one page per document page, at the format’s exact size', async () => {
    const bytes = await buildPdf(
      [
        { snapshot: flyerPage(0), jpeg: TINY_JPEG },
        { snapshot: { ...flyerPage(1), fields: [], links: [] }, jpeg: TINY_JPEG },
      ],
      a4,
      { title: 'Flyer — Fête d’été 🎉', lang: 'fr' },
    )
    // updateMetadata: false, or loading it would stamp pdf-lib's own producer over ours.
    const doc = await PDFDocument.load(bytes, { updateMetadata: false })
    expect(doc.getPageCount()).toBe(2)
    for (const p of doc.getPages()) {
      expect(p.getWidth()).toBeCloseTo(a4.widthPt, 2)
      expect(p.getHeight()).toBeCloseTo(a4.heightPt, 2)
    }
    expect(doc.getTitle()).toBe('Flyer — Fête d’été 🎉')
    expect(doc.getProducer()).toBe('Mocky')
  })

  it('makes real fillable fields of the right kinds, with the design showing through', async () => {
    const bytes = await buildPdf([{ snapshot: flyerPage(0), jpeg: TINY_JPEG }], a4, { title: 'x' })
    const form = (await PDFDocument.load(bytes)).getForm()
    const fields = form.getFields()
    expect(fields.map((f) => f.getName())).toEqual(['nom', 'newsletter', 'créneau'])
    expect(fields[0]).toBeInstanceOf(PDFTextField)
    expect(fields[1]).toBeInstanceOf(PDFCheckBox)
    expect((fields[1] as PDFCheckBox).isChecked()).toBe(true)
    expect(fields[2]).toBeInstanceOf(PDFDropdown)
    expect((fields[2] as PDFDropdown).getOptions()).toEqual(['Matin', 'Soir'])
    expect((fields[2] as PDFDropdown).getSelected()).toEqual(['Soir'])
    // No white fill and no black rule painted over the design.
    const mk = (fields[0] as PDFTextField).acroField.getWidgets()[0].getAppearanceCharacteristics()
    expect(mk?.getBackgroundColor()).toBeUndefined()
    // An appearance stream exists, so a viewer that ignores NeedAppearances still draws it.
    expect((fields[0] as PDFTextField).acroField.getWidgets()[0].getNormalAppearance()).toBeDefined()
    // The placeholder travels as the tooltip.
    expect(String((fields[0] as PDFTextField).acroField.dict.get(PDFName.of('TU')))).toContain('<')
  })

  it('names a multiline field multiline and keeps its line breaks', async () => {
    const page = { ...flyerPage(0), fields: [field({ name: 'message', type: 'multiline', value: 'Ligne 1\nLigne 2' })] }
    const form = (await PDFDocument.load(await buildPdf([{ snapshot: page, jpeg: TINY_JPEG }], a4, { title: 'x' }))).getForm()
    const tf = form.getTextField('message')
    expect(tf.isMultiline()).toBe(true)
    expect(tf.getText()).toBe('Ligne 1\nLigne 2')
  })

  it('dedupes a name reused on page two', async () => {
    const bytes = await buildPdf(
      [
        { snapshot: { ...flyerPage(0), fields: [field()] }, jpeg: TINY_JPEG },
        { snapshot: { ...flyerPage(1), fields: [field()] }, jpeg: TINY_JPEG },
      ],
      a4,
      { title: 'x' },
    )
    expect((await PDFDocument.load(bytes)).getForm().getFields().map((f) => f.getName())).toEqual(['nom', 'nom_2'])
  })

  it('writes an invisible, stretched text layer', async () => {
    const doc = await PDFDocument.load(await buildPdf([{ snapshot: flyerPage(0), jpeg: TINY_JPEG }], a4, { title: 'x' }))
    const ops = contentOf(doc, 0)
    expect(ops).toMatch(/\b3 Tr\b/)
    expect(ops).toMatch(/\bTz\b/)
    expect(ops).toMatch(/\bTj\b/)
  })

  it('never throws on text Helvetica cannot encode', async () => {
    const page = {
      ...flyerPage(0),
      lines: [line('Émoji 🎉 → ok ł 中文', 10, 10, 200, 20)],
      fields: [field({ value: 'Zoë 🎈' })],
    }
    await expect(buildPdf([{ snapshot: page, jpeg: TINY_JPEG }], a4, { title: 'x' })).resolves.toBeInstanceOf(Uint8Array)
  })

  it('adds web links and refuses the others', async () => {
    const page = {
      ...flyerPage(0),
      links: [
        { href: 'https://example.org/a', rect: { x: 0, y: 0, w: 10, h: 10 } },
        { href: 'javascript:alert(1)', rect: { x: 0, y: 20, w: 10, h: 10 } },
        { href: 'mailto:bonjour@example.org', rect: { x: 0, y: 40, w: 10, h: 10 } },
        // A parenthesis closed an unescaped `(…)` string early and corrupted the annotation.
        { href: 'https://fr.wikipedia.org/wiki/Nantes_(France)', rect: { x: 0, y: 60, w: 10, h: 10 } },
      ],
      fields: [],
    }
    const doc = await PDFDocument.load(await buildPdf([{ snapshot: page, jpeg: TINY_JPEG }], a4, { title: 'x' }))
    const annots = doc.getPage(0).node.Annots()
    const uris = (annots?.asArray() ?? [])
      .map((ref) => doc.context.lookup(ref) as any)
      .filter((a) => String(a.get(PDFName.of('Subtype'))) === '/Link')
      .map((a) => a.get(PDFName.of('A')).get(PDFName.of('URI')))
    // Hex strings: no delimiter a URL can collide with.
    expect(uris.every((u) => u instanceof PDFHexString)).toBe(true)
    expect(uris.map((u) => u.decodeText())).toEqual([
      'https://example.org/a',
      'mailto:bonjour@example.org',
      'https://fr.wikipedia.org/wiki/Nantes_(France)',
    ])
  })
})
