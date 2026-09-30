import { describe, expect, it } from 'vitest'
import { getPageFormat } from '../pageFormats'
import {
  EMU_PER_PX,
  blockBox,
  buildPptx,
  contentTypesXml,
  escapeXml,
  fieldBoxXml,
  pptxEntries,
  presentationXml,
  pxToCentipoints,
  pxToEmu,
  slideXml,
  textBoxXml,
} from './pptx'
import { TINY_JPEG, field, flyerPage, line, style } from './fixtures'
import type { TextBlock } from './types'

/**
 * There is no XML parser in the test environment, and a .pptx with one
 * unbalanced tag is "PowerPoint found a problem with content" — so every part is
 * walked tag by tag: each opened element closed in order, no raw `&` or `<` in
 * character data.
 */
function wellFormed(xml: string): string | null {
  const body = xml.replace(/^<\?xml[^?]*\?>\s*/, '')
  const stack: string[] = []
  const re = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>|([^<]+)|(<)/g
  let m: RegExpExecArray | null
  let consumed = 0
  while ((m = re.exec(body))) {
    if (m.index !== consumed) return `garbage at ${consumed}`
    consumed = re.lastIndex
    if (m[6]) return `stray < at ${m.index}`
    if (m[5] !== undefined) {
      if (/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(m[5])) return `raw & in "${m[5].slice(0, 30)}"`
      continue
    }
    if (/&(?!(amp|lt|gt|quot|apos);)/.test(m[3])) return `raw & in attribute of <${m[2]}>`
    if (m[4]) continue
    if (m[1]) {
      const open = stack.pop()
      if (open !== m[2]) return `</${m[2]}> closes <${open}>`
    } else stack.push(m[2])
  }
  if (consumed !== body.length) return `unparsed tail at ${consumed}`
  return stack.length ? `unclosed <${stack.join('> <')}>` : null
}

describe('the well-formedness check itself', () => {
  it('catches what it is there to catch', () => {
    expect(wellFormed('<a><b></a>')).not.toBeNull()
    expect(wellFormed('<a>x & y</a>')).not.toBeNull()
    expect(wellFormed('<a b="1">x &amp; y<c/></a>')).toBeNull()
  })
})

const a4 = getPageFormat('a4')
const created = new Date('2026-09-30T10:00:00Z')

describe('units', () => {
  it('converts px to EMU at 96 dpi and to hundredths of a point', () => {
    expect(EMU_PER_PX).toBe(9525)
    expect(pxToEmu(96)).toBe(914400) // one inch
    expect(pxToCentipoints(16)).toBe(1200) // 16 px = 12 pt
  })

  it('sizes the presentation to the page', () => {
    expect(presentationXml(a4, 1)).toContain('<p:sldSz cx="7562850" cy="10696575"/>')
    expect(presentationXml(getPageFormat('slides'), 3)).toContain('<p:sldSz cx="12192000" cy="6858000"/>')
    expect(presentationXml(a4, 2)).toContain('<p:sldId id="257" r:id="rId3"/>')
  })
})

describe('escapeXml', () => {
  it('escapes markup and removes what XML forbids even as a reference', () => {
    expect(escapeXml(`<b>"Tom" & 'Jerry'</b>`)).toBe('&lt;b&gt;&quot;Tom&quot; &amp; &apos;Jerry&apos;&lt;/b&gt;')
    expect(escapeXml('a\u0000b\u0008c\u000Bd\tf\ng')).toBe('abcd\tf\ng')
    expect(escapeXml('x\uD800y')).toBe('xy')
    expect(escapeXml('🎉')).toBe('🎉')
  })
})

describe('the package', () => {
  const entries = pptxEntries(
    [
      { snapshot: flyerPage(0), background: TINY_JPEG },
      { snapshot: flyerPage(1), background: TINY_JPEG },
    ],
    a4,
    { title: 'Flyer & co', lang: 'fr-FR', created },
  )

  it('lists every part, content types first', () => {
    expect(entries.map((e) => e.name)).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'docProps/core.xml',
      'docProps/app.xml',
      'ppt/presentation.xml',
      'ppt/_rels/presentation.xml.rels',
      'ppt/presProps.xml',
      'ppt/viewProps.xml',
      'ppt/tableStyles.xml',
      'ppt/theme/theme1.xml',
      'ppt/slideMasters/slideMaster1.xml',
      'ppt/slideMasters/_rels/slideMaster1.xml.rels',
      'ppt/slideLayouts/slideLayout1.xml',
      'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
      'ppt/slides/slide1.xml',
      'ppt/slides/_rels/slide1.xml.rels',
      'ppt/media/page1.jpeg',
      'ppt/slides/slide2.xml',
      'ppt/slides/_rels/slide2.xml.rels',
      'ppt/media/page2.jpeg',
    ])
  })

  it('declares a content type for every XML part and the pictures', () => {
    const types = contentTypesXml(2)
    for (const e of entries) {
      if (!e.name.endsWith('.xml') || e.name.startsWith('[')) continue
      // Generic xml parts are covered by the Default; the typed ones by an Override.
      if (/^ppt\/(presentation|slides\/slide\d|slideMasters|slideLayouts|theme|presProps|viewProps|tableStyles)|^docProps/.test(e.name)) {
        expect(types, e.name).toContain(`PartName="/${e.name}"`)
      }
    }
    expect(types).toContain('Extension="jpeg" ContentType="image/jpeg"')
  })

  it('writes only well-formed XML', () => {
    for (const e of entries) {
      if (typeof e.content !== 'string') continue
      expect(wellFormed(e.content), e.name).toBeNull()
    }
  })

  it('carries the background bytes untouched and points each slide at its own', () => {
    const media = entries.find((e) => e.name === 'ppt/media/page2.jpeg')!
    expect(media.content).toBe(TINY_JPEG)
    const rels = entries.find((e) => e.name === 'ppt/slides/_rels/slide2.xml.rels')!.content as string
    expect(rels).toContain('Target="../media/page2.jpeg"')
  })

  it('escapes the title in the core properties', () => {
    const core = entries.find((e) => e.name === 'docProps/core.xml')!.content as string
    expect(core).toContain('<dc:title>Flyer &amp; co</dc:title>')
    expect(core).toContain('2026-09-30T10:00:00Z')
  })

  it('builds a zip', () => {
    const bytes = buildPptx([{ snapshot: flyerPage(0), background: TINY_JPEG }], a4, { title: 'x', created })
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
  })
})

describe('a slide', () => {
  const headline: TextBlock = {
    rect: { x: 100, y: 200, w: 400, h: 50 },
    lines: [line('Fête & musique', 100, 200, 400, 50, { fontSize: 40, fontWeight: 800, color: { r: 255, g: 0, b: 102, a: 1 }, fontFamily: '"Playfair Display", serif' })],
    align: 'left',
    pitch: 50,
  }

  it('turns a block into one editable text box with its run properties', () => {
    const xml = textBoxXml(headline, 3, 794, 'fr-FR')!
    expect(xml).toContain('<p:cNvSpPr txBox="1"/>')
    expect(xml).toContain('<a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0" anchor="t"><a:noAutofit/></a:bodyPr>')
    expect(xml).toContain('<a:rPr lang="fr-FR" sz="3000" b="1" i="0" dirty="0"><a:solidFill><a:srgbClr val="FF0066"></a:srgbClr></a:solidFill><a:latin typeface="Playfair Display"/>')
    expect(xml).toContain('<a:t>Fête &amp; musique</a:t>')
    expect(xml).toContain('algn="l"')
    expect(xml).toContain(`<a:off x="${pxToEmu(100)}" y="${pxToEmu(200)}"/>`)
    expect(wellFormed(xml)).toBeNull()
  })

  it('keeps visual lines as line breaks with the measured pitch', () => {
    const two: TextBlock = {
      rect: { x: 50, y: 100, w: 300, h: 44 },
      lines: [line('Première ligne', 50, 100, 300, 20), line('seconde', 50, 124, 120, 20)],
      align: 'center',
      pitch: 24,
    }
    const xml = textBoxXml(two, 4, 794, 'fr-FR')!
    expect(xml.match(/<a:br>/g)).toHaveLength(1)
    expect(xml).toContain('<a:lnSpc><a:spcPts val="1800"/></a:lnSpc>')
    expect(xml).toContain('algn="ctr"')
  })

  it('maps a generic family to a face office suites have', () => {
    const b = { ...headline, lines: [line('x', 0, 0, 10, 10, { fontFamily: 'ui-sans-serif, system-ui' })] }
    expect(textBoxXml(b, 3, 794, 'en-US')).toContain('<a:latin typeface="Arial"/>')
  })

  it('drops text that was painted transparent', () => {
    const b = { ...headline, lines: [line('ghost', 0, 0, 10, 10, { color: { r: 0, g: 0, b: 0, a: 0 } })] }
    expect(textBoxXml(b, 3, 794, 'fr-FR')).toBeNull()
  })

  it('writes a field as a text box holding its placeholder, lighter', () => {
    const xml = fieldBoxXml(field(), 9, 'fr-FR')!
    expect(xml).toContain('name="Field: nom"')
    expect(xml).toContain('<a:t>Votre nom</a:t>')
    expect(xml).toContain('<a:alpha val="60000"/>')
    expect(xml).toContain('anchor="ctr"')
    expect(fieldBoxXml(field({ type: 'checkbox' }), 9, 'fr-FR')).toBeNull()
  })

  it('gives every shape on a slide its own id, the picture first', () => {
    const xml = slideXml(flyerPage(0), 'fr-FR')
    const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => Number(m[1]))
    expect(ids).toEqual([1, 2, 3, 4, 5, 6])
    expect(xml.indexOf('<p:pic>')).toBeLessThan(xml.indexOf('<p:sp>'))
    expect(wellFormed(xml)).toBeNull()
  })
})

describe('blockBox', () => {
  const block = (align: TextBlock['align'], x = 100): TextBlock => ({
    rect: { x, y: 100, w: 200, h: 20 },
    lines: [line('x', x, 100, 200, 20, style({ fontSize: 16 }))],
    align,
    pitch: 30,
  })

  it('starts at the line box, a half-leading above the glyphs', () => {
    const b = blockBox(block('left'), 800)
    expect(b.y).toBe(95)
    expect(b.h).toBe(30)
  })

  it('adds slack on the side the text grows towards, inside the page', () => {
    expect(blockBox(block('left'), 800)).toMatchObject({ x: 100, w: 216 })
    expect(blockBox(block('right'), 800)).toMatchObject({ x: 84, w: 216 })
    expect(blockBox(block('center'), 800)).toMatchObject({ x: 92, w: 216 })
    // At the page's right edge there is no room to grow.
    expect(blockBox(block('left', 600), 800).w).toBe(200)
  })
})
