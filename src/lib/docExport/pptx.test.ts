import { describe, expect, it } from 'vitest'
import { getPageFormat } from '../pageFormats'
import {
  EMU_PER_PX,
  blockBox,
  buildPptx,
  contentTypesXml,
  escapeXml,
  fieldBoxXml,
  frameXfrm,
  custGeomXml,
  ownBox,
  pptxEntries,
  presentationXml,
  pxToCentipoints,
  pxToEmu,
  slideXml,
  textBoxXml,
} from './pptx'
import { TINY_JPEG, field, flyerPage, line, style } from './fixtures'
import type { TextBlock } from './types'
import type { PptxFrame } from './pptx'
import { frameShape } from '../frameShapes'
import { toCubics } from '../frameGeometry'

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

  it('puts the page in the slide’s background, not on it, and gives every shape its own id', () => {
    const xml = slideXml(flyerPage(0), 'fr-FR')
    // A full-slide picture is an element: Canva replaced it with a photo dropped a little off its frame.
    expect(xml).toContain('<p:cSld><p:bg><p:bgPr><a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="rId2"/>')
    expect(xml).not.toContain('<p:pic>')
    const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => Number(m[1]))
    expect(ids).toEqual([1, 2, 3, 4, 5])
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

describe('a frame on a slide', () => {
  const PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47)
  const frame = (over: Partial<PptxFrame> = {}): PptxFrame => ({
    box: { shape: 'blob-3', cx: 300, cy: 400, w: 420, h: 430, angle: 0 },
    name: 'Cadre 1 — Blob 3',
    picture: { bytes: TINY_JPEG, type: 'jpeg' },
    overlays: [],
    shadow: false,
    ...over,
  })

  it('is a SHAPE filled with its picture — what Canva imports as a frame of that shape', () => {
    const xml = slideXml(flyerPage(0), 'fr-FR', [frame()])
    const sp = xml.match(/<p:sp><p:nvSpPr><p:cNvPr id="2" name="Cadre 1 — Blob 3"\/>.*?<\/p:sp>/)?.[0] ?? ''
    expect(sp).toContain('<a:custGeom>')
    expect(sp).toContain('<a:path w="10000" h="10000"><a:moveTo>')
    expect(sp).toContain('<a:cubicBezTo>')
    expect(sp).toContain('<a:blipFill rotWithShape="1"><a:blip r:embed="rId3"/><a:stretch><a:fillRect/></a:stretch></a:blipFill>')
    // Not a picture cropped to a shape: Canva kept those square.
    expect(xml).not.toContain('<p:pic>')
    expect(wellFormed(xml)).toBeNull()
  })

  it('sits over the page and under the words, and the ids stay unique', () => {
    const xml = slideXml(flyerPage(0), 'fr-FR', [frame(), frame({ name: 'Cadre 2' })])
    expect(xml.indexOf('<p:bg>')).toBeLessThan(xml.indexOf('name="Cadre 1'))
    expect(xml.indexOf('name="Cadre 2"')).toBeLessThan(xml.indexOf('name="Text: '))
    expect(xml).toContain('r:embed="rId4"')
    const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => Number(m[1]))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('is placed by its centre and turned clockwise about it', () => {
    const xml = frameXfrm({ shape: 'circle', cx: 300, cy: 400, w: 200, h: 100, angle: -6 })
    expect(xml).toContain(`<a:off x="${pxToEmu(200)}" y="${pxToEmu(350)}"/>`)
    expect(xml).toContain(`<a:ext cx="${pxToEmu(200)}" cy="${pxToEmu(100)}"/>`)
    expect(xml).toContain(`rot="${354 * 60000}"`)
    expect(frameXfrm({ shape: 'circle', cx: 0, cy: 0, w: 1, h: 1, angle: 0 })).not.toContain('rot=')
  })

  it('redraws its outline and its tape above it, and its shadow when the page lost it', () => {
    const tape = frameShape('tape')
    const xml = slideXml(flyerPage(0), 'fr-FR', [
      frame({
        box: { shape: 'tape', cx: 300, cy: 400, w: 300, h: 300, angle: 4 },
        shadow: true,
        overlays: [
          { role: 'stroke', d: tape.clip, fill: null, stroke: { r: 17, g: 24, b: 39, a: 1 }, strokeWidth: 6, opacity: 1 },
          { role: 'over', d: tape.over!, fill: { r: 239, g: 230, b: 207, a: 1 }, stroke: null, strokeWidth: 0, opacity: 0.85 },
        ],
        overlayNames: { stroke: 'Cadre 1 · contour', over: 'Cadre 1 · ruban' },
      }),
    ])
    expect(xml).toContain('<a:outerShdw')
    // The outline UNDER the frame, twice as wide: nothing lies over it where a photo is dropped.
    const outline = xml.slice(xml.indexOf('name="Cadre 1 · contour"'))
    expect(outline).toMatch(new RegExp(`^[^]*?<a:noFill/><a:ln w="${pxToEmu(12)}"><a:solidFill><a:srgbClr val="111827">`))
    const picture = xml.indexOf('<a:blip r:embed="rId3"/>')
    expect(xml.indexOf('contour')).toBeLessThan(picture)
    // The tape over it, one shape per strip.
    expect(xml).not.toContain('name="Cadre 1 · ruban"')
    for (const strip of ['Cadre 1 · ruban 1', 'Cadre 1 · ruban 2']) {
      const at = xml.indexOf(`name="${strip}"`)
      expect(at, strip).toBeGreaterThan(picture)
      const one = xml.slice(at, xml.indexOf('</p:sp>', at))
      expect(one).toMatch(/<a:srgbClr val="EFE6CF"><a:alpha val="85000"\/>/)
      expect(one.match(/<a:moveTo>/g)).toHaveLength(1)
      // In a box of its own, a corner of the frame's: as an element, a strip covers only itself.
      const [, cx, cy] = one.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/)!.map(Number)
      expect(cx).toBeLessThan(pxToEmu(300) / 2)
      expect(cy).toBeLessThan(pxToEmu(300) / 2)
    }
    const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => Number(m[1]))
    expect(new Set(ids).size).toBe(ids.length)
    expect(wellFormed(xml)).toBeNull()
  })

  it('travels in the package with its own picture, PNG declared', () => {
    const entries = pptxEntries(
      [{ snapshot: flyerPage(0), background: TINY_JPEG, frames: [frame(), frame({ picture: { bytes: PNG, type: 'png' } })] }],
      a4,
      { title: 'x', created },
    )
    const names = entries.map((e) => e.name)
    expect(names).toContain('ppt/media/page1-frame1.jpeg')
    expect(names).toContain('ppt/media/page1-frame2.png')
    expect(entries.find((e) => e.name === 'ppt/media/page1-frame2.png')!.content).toBe(PNG)
    const rels = entries.find((e) => e.name === 'ppt/slides/_rels/slide1.xml.rels')!.content as string
    expect(rels).toContain('Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/page1-frame1.jpeg"')
    expect(rels).toContain('Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/page1-frame2.png"')
    expect(contentTypesXml(1)).toContain('Extension="png" ContentType="image/png"')
  })
})

describe('a part of a frame in a box of its own', () => {
  const tri = toCubics('M60 10L90 10L90 30Z')

  it('takes the part’s bounds in the frame and moves its path to that corner', () => {
    const own = ownBox(tri, { shape: 'tape', cx: 100, cy: 100, w: 200, h: 100, angle: 0 })!
    expect(own.w).toBe(30)
    expect(own.h).toBe(20)
    expect(own.subs[0].start).toEqual([0, 0])
    // 60–90 % of 200 px from x = 0, 10–30 % of 100 px from y = 50.
    expect(own.box).toMatchObject({ cx: 150, cy: 70, w: 60, h: 20, angle: 0 })
  })

  it('goes where the frame’s turn takes it, and turns with it', () => {
    const own = ownBox(tri, { shape: 'tape', cx: 100, cy: 100, w: 200, h: 100, angle: 90 })!
    // Unturned, the centre is 50 px right of the frame's and 30 px above; a quarter turn clockwise puts it 50 px below and 30 px right.
    expect(own.box.cx).toBeCloseTo(130, 6)
    expect(own.box.cy).toBeCloseTo(150, 6)
    expect(own.box.angle).toBe(90)
  })

  it('writes the path in that box’s own units', () => {
    expect(custGeomXml(ownBox(tri, { shape: 'tape', cx: 0, cy: 0, w: 100, h: 100, angle: 0 })!.subs, 30, 20)).toContain(
      '<a:path w="3000" h="2000"><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:lnTo><a:pt x="3000" y="0"/></a:lnTo>',
    )
  })
})
