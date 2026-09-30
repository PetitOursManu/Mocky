import type { PageFormat } from '../pageFormats'
import { makeZipBytes, type ZipInput } from '../zip'
import { primaryFontFamily, toHex6 } from './lines'
import type { FieldBox, PageSnapshot, Rgba, RunStyle, TextAlign, TextBlock } from './types'

/**
 * A document as a .pptx — the way a DESIGNED page stays editable in Google.
 *
 * Google Docs reflows everything it imports: a flyer opened there as a .docx is
 * a column of paragraphs with its photographs somewhere below. Google Slides
 * does not reflow — a slide is a canvas of positioned boxes, like the page — and
 * it opens a .pptx from Drive with every text box still a text box. So a page
 * becomes one slide of the page's own size: the page, with its text taken out,
 * as a full-bleed picture (shapes, colours, photographs), and each block of text
 * as an editable box at the place it was measured, in its size, weight, colour
 * and face. PowerPoint and Keynote read the same file.
 *
 * Hand-written OOXML, stored in Mocky's own zip writer: the whole format needed
 * here is a dozen small parts, and a dependency would have been a megabyte for
 * the same XML.
 */

/** 1 CSS px = 1/96 in = 9525 EMU (914 400 EMU per inch). */
export const EMU_PER_PX = 9525
export const pxToEmu = (px: number) => Math.round(px * EMU_PER_PX)
/** px → hundredths of a point, the unit of `sz` and `spc`. */
export const pxToCentipoints = (px: number) => Math.round(px * 75)

const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const PML_NS = `xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"`

/**
 * Text as XML character data or an attribute value. Characters XML 1.0 forbids
 * outright (C0 controls other than tab and line feeds, lone surrogates, U+FFFE/F)
 * are removed rather than escaped: a numeric reference to them is ALSO illegal,
 * and PowerPoint's answer to one is "this file needs to be repaired".
 */
export function escapeXml(s: string): string {
  return (
    s
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  )
}

export interface PptxPageInput {
  snapshot: PageSnapshot
  /** The page with its text removed, as a JPEG. */
  background: Uint8Array
}

export interface PptxMeta {
  title: string
  /** BCP 47, written on every run so a spell checker checks the right language. */
  lang?: string
  /** For the core properties; a parameter so a test is deterministic. */
  created?: Date
}

const ALGN: Record<TextAlign, string> = { left: 'l', center: 'ctr', right: 'r', justify: 'l' }

export interface BoxGeometry {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Where a block's text box goes, in px.
 *
 * Two corrections to the measured rect. VERTICAL: a Range rect is the glyphs'
 * content area, and a line box is taller by the half-leading on each side; a
 * slide lays a line out from the top of its line box, so the box starts that
 * half-leading higher. HORIZONTAL: slack. The slide may be set in a substitute
 * face (Google Slides has no "Inter Tight"), and one a few percent wider would
 * wrap the last word of every line onto a line of its own. The slack is added
 * on the side the text grows towards — right of left-aligned text, both sides
 * of centred text — and never beyond the page's edge.
 */
export function blockBox(block: TextBlock, pageWidth: number): BoxGeometry {
  const first = block.lines[0]
  const maxFont = Math.max(...block.lines.map((l) => l.fontSize))
  const lead = Math.max(0, (block.pitch - first.rect.h) / 2)
  const y = Math.max(0, block.rect.y - lead)
  const h = Math.max(block.rect.h + 2 * lead, block.pitch * block.lines.length)
  const want = Math.max(4, block.rect.w * 0.08, maxFont * 0.5)
  const left = block.rect.x
  const right = pageWidth - (block.rect.x + block.rect.w)
  let x = block.rect.x
  let w = block.rect.w
  if (block.align === 'center') {
    const s = Math.max(0, Math.min(want / 2, left, right))
    x -= s
    w += 2 * s
  } else if (block.align === 'right') {
    const s = Math.max(0, Math.min(want, left))
    x -= s
    w += s
  } else {
    w += Math.max(0, Math.min(want, right))
  }
  return { x, y, w, h }
}

function fillXml(c: Rgba): string {
  const alpha = c.a < 0.999 ? `<a:alpha val="${Math.round(Math.max(0, c.a) * 100000)}"/>` : ''
  return `<a:solidFill><a:srgbClr val="${toHex6(c)}">${alpha}</a:srgbClr></a:solidFill>`
}

/** `<a:rPr>` for a run: size, weight, style, spacing, ink, face. */
export function runProps(s: RunStyle, lang: string, tag = 'a:rPr'): string {
  const face = escapeXml(primaryFontFamily(s.fontFamily))
  const sz = Math.min(400000, Math.max(100, pxToCentipoints(s.fontSize)))
  const attrs = [
    `lang="${escapeXml(lang)}"`,
    `sz="${sz}"`,
    `b="${s.fontWeight >= 600 ? 1 : 0}"`,
    `i="${s.italic ? 1 : 0}"`,
    s.underline ? 'u="sng"' : '',
    s.letterSpacing ? `spc="${Math.max(-400000, Math.min(400000, pxToCentipoints(s.letterSpacing)))}"` : '',
    'dirty="0"',
  ].filter(Boolean)
  return `<${tag} ${attrs.join(' ')}>${fillXml(s.color)}<a:latin typeface="${face}"/><a:ea typeface="${face}"/><a:cs typeface="${face}"/></${tag}>`
}

const visible = (s: RunStyle) => s.color.a >= 0.05

function spXml(id: number, name: string, box: BoxGeometry, body: string, anchor: 't' | 'ctr', insetLeft = 0): string {
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${pxToEmu(box.x)}" y="${pxToEmu(box.y)}"/><a:ext cx="${Math.max(1, pxToEmu(box.w))}" cy="${Math.max(1, pxToEmu(box.h))}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" lIns="${pxToEmu(insetLeft)}" tIns="0" rIns="0" bIns="0" rtlCol="0" anchor="${anchor}"><a:noAutofit/></a:bodyPr><a:lstStyle/>` +
    body +
    `</p:txBody></p:sp>`
  )
}

/**
 * One text block as a text box: one paragraph, its visual lines joined by line
 * breaks (`<a:br/>`) rather than left to re-wrap, and an EXACT line spacing
 * equal to the measured pitch — so the lines land where the page had them, and
 * editing a word still reflows only that paragraph.
 */
export function textBoxXml(block: TextBlock, id: number, pageWidth: number, lang: string): string | null {
  const lines = block.lines
    .map((l) => ({ ...l, runs: l.runs.filter((r) => visible(r.style) && r.text.length > 0) }))
    .filter((l) => l.runs.some((r) => r.text.trim()))
  if (lines.length === 0) return null
  const box = blockBox({ ...block, lines }, pageWidth)
  const parts: string[] = []
  lines.forEach((l, i) => {
    if (i > 0) parts.push(`<a:br>${runProps(l.runs[0].style, lang)}</a:br>`)
    l.runs.forEach((r, j) => {
      // A line's trailing space would push a centred line off its axis.
      const text = j === l.runs.length - 1 ? r.text.replace(/\s+$/, '') : r.text
      if (text) parts.push(`<a:r>${runProps(r.style, lang)}<a:t>${escapeXml(text)}</a:t></a:r>`)
    })
  })
  const last = lines[lines.length - 1].runs.slice(-1)[0].style
  const pPr =
    `<a:pPr marL="0" indent="0" algn="${ALGN[block.align]}">` +
    `<a:lnSpc><a:spcPts val="${Math.max(100, pxToCentipoints(block.pitch))}"/></a:lnSpc>` +
    `<a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft><a:buNone/></a:pPr>`
  const name = `Text: ${lines[0].text.trim().slice(0, 40)}`
  return spXml(id, name, box, `<a:p>${pPr}${parts.join('')}${runProps(last, lang, 'a:endParaRPr')}</a:p>`, 't')
}

/**
 * A fillable field as a text box holding what it said — its value, or its
 * placeholder in a lighter ink. A slide has no form fields; what a person wants
 * from one there is to type over "Votre nom" and have it sit in the design's box.
 */
export function fieldBoxXml(f: FieldBox, id: number, lang: string): string | null {
  if (f.type === 'checkbox') return null
  const isValue = !!f.value.trim()
  const text = isValue ? f.value : f.placeholder || (f.type === 'select' ? f.options[0] ?? '' : '')
  const ink = f.color.a < 0.3 ? { r: 0, g: 0, b: 0, a: 1 } : f.color
  const style: RunStyle = {
    fontSize: f.fontSize || 16,
    fontWeight: 400,
    italic: false,
    underline: false,
    color: isValue ? ink : { ...ink, a: ink.a * 0.6 },
    fontFamily: '',
    letterSpacing: 0,
  }
  const multiline = f.type === 'multiline'
  const paras = (text || '')
    .split(/\r?\n/)
    .map((t) => `<a:p><a:pPr algn="${ALGN[f.align]}"/>${t ? `<a:r>${runProps(style, lang)}<a:t>${escapeXml(t)}</a:t></a:r>` : ''}${runProps(style, lang, 'a:endParaRPr')}</a:p>`)
    .join('')
  const box = { x: f.rect.x, y: f.rect.y, w: f.rect.w, h: f.rect.h }
  const inset = Math.min(Math.max(0, f.paddingLeft), f.rect.w / 3)
  return spXml(id, `Field: ${f.name}`, box, paras, multiline ? 't' : 'ctr', inset)
}

export function slideXml(page: PageSnapshot, lang: string): string {
  // Shape ids are unique per slide; 1 is the tree, 2 the background picture.
  let next = 3
  const shapes: string[] = []
  const add = (xml: string | null) => {
    if (!xml) return
    shapes.push(xml)
    next++
  }
  for (const b of page.blocks) add(textBoxXml(b, next, page.width, lang))
  for (const f of page.fields) add(fieldBoxXml(f, next, lang))
  const pic =
    `<p:pic><p:nvPicPr><p:cNvPr id="2" name="Background"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${pxToEmu(page.width)}" cy="${pxToEmu(page.height)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
  return (
    XML_DECL +
    `<p:sld ${PML_NS}><p:cSld><p:spTree>${GROUP_HEADER}${pic}${shapes.join('')}</p:spTree></p:cSld>` +
    `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
  )
}

const GROUP_HEADER =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'

function rels(items: { id: string; type: string; target: string }[]): string {
  return (
    XML_DECL +
    `<Relationships xmlns="${NS_REL}">` +
    items.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`).join('') +
    '</Relationships>'
  )
}

export function contentTypesXml(slides: number): string {
  const ov = (part: string, type: string) => `<Override PartName="${part}" ContentType="application/vnd.openxmlformats-${type}"/>`
  return (
    XML_DECL +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
    ov('/ppt/presentation.xml', 'officedocument.presentationml.presentation.main+xml') +
    ov('/ppt/slideMasters/slideMaster1.xml', 'officedocument.presentationml.slideMaster+xml') +
    ov('/ppt/slideLayouts/slideLayout1.xml', 'officedocument.presentationml.slideLayout+xml') +
    Array.from({ length: slides }, (_, i) => ov(`/ppt/slides/slide${i + 1}.xml`, 'officedocument.presentationml.slide+xml')).join('') +
    ov('/ppt/theme/theme1.xml', 'officedocument.theme+xml') +
    ov('/ppt/presProps.xml', 'officedocument.presentationml.presProps+xml') +
    ov('/ppt/viewProps.xml', 'officedocument.presentationml.viewProps+xml') +
    ov('/ppt/tableStyles.xml', 'officedocument.presentationml.tableStyles+xml') +
    ov('/docProps/core.xml', 'package.core-properties+xml') +
    ov('/docProps/app.xml', 'officedocument.extended-properties+xml') +
    '</Types>'
  )
}

export function presentationXml(format: Pick<PageFormat, 'w' | 'h'>, slides: number): string {
  // PowerPoint refuses a slide size outside 1–56 in; every format here is well inside.
  const cx = Math.min(51206400, Math.max(914400, pxToEmu(format.w)))
  const cy = Math.min(51206400, Math.max(914400, pxToEmu(format.h)))
  return (
    XML_DECL +
    `<p:presentation ${PML_NS} saveSubsetFonts="1">` +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    `<p:sldIdLst>${Array.from({ length: slides }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')}</p:sldIdLst>` +
    `<p:sldSz cx="${cx}" cy="${cy}"/><p:notesSz cx="6858000" cy="9144000"/>` +
    '</p:presentation>'
  )
}

const MASTER_XML =
  XML_DECL +
  `<p:sldMaster ${PML_NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${GROUP_HEADER}</p:spTree></p:cSld>` +
  '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
  '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
  '<p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles>' +
  '</p:sldMaster>'

const LAYOUT_XML =
  XML_DECL +
  `<p:sldLayout ${PML_NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${GROUP_HEADER}</p:spTree></p:cSld>` +
  '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'

const THEME_XML = (() => {
  const solid = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
  const accents = ['2563EB', 'DB2777', 'F59E0B', '10B981', '7C3AED', '0EA5E9']
    .map((c, i) => `<a:accent${i + 1}><a:srgbClr val="${c}"/></a:accent${i + 1}>`)
    .join('')
  const face = '<a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/>'
  return (
    XML_DECL +
    `<a:theme xmlns:a="${NS_A}" name="Mocky"><a:themeElements>` +
    '<a:clrScheme name="Mocky"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
    '<a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F3F4F6"/></a:lt2>' +
    accents +
    '<a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme>' +
    `<a:fontScheme name="Mocky"><a:majorFont>${face}</a:majorFont><a:minorFont>${face}</a:minorFont></a:fontScheme>` +
    '<a:fmtScheme name="Mocky">' +
    `<a:fillStyleLst>${solid}${solid}${solid}</a:fillStyleLst>` +
    `<a:lnStyleLst>${[0, 1, 2].map(() => `<a:ln w="6350">${solid}</a:ln>`).join('')}</a:lnStyleLst>` +
    `<a:effectStyleLst>${[0, 1, 2].map(() => '<a:effectStyle><a:effectLst/></a:effectStyle>').join('')}</a:effectStyleLst>` +
    `<a:bgFillStyleLst>${solid}${solid}${solid}</a:bgFillStyleLst>` +
    '</a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>'
  )
})()

function coreXml(meta: PptxMeta): string {
  const when = (meta.created ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z')
  return (
    XML_DECL +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${escapeXml(meta.title)}</dc:title><dc:creator>Mocky</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${when}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${when}</dcterms:modified>` +
    '</cp:coreProperties>'
  )
}

function appXml(slides: number): string {
  return (
    XML_DECL +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    `<Application>Mocky</Application><Slides>${slides}</Slides></Properties>`
  )
}

/** Every part of the package, in the order they are written ([Content_Types].xml first). */
export function pptxEntries(pages: readonly PptxPageInput[], format: Pick<PageFormat, 'w' | 'h'>, meta: PptxMeta): ZipInput[] {
  const lang = meta.lang || 'fr-FR'
  const n = pages.length
  const entries: ZipInput[] = [
    { name: '[Content_Types].xml', content: contentTypesXml(n) },
    {
      name: '_rels/.rels',
      content: rels([
        { id: 'rId1', type: `${REL}/officeDocument`, target: 'ppt/presentation.xml' },
        { id: 'rId2', type: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', target: 'docProps/core.xml' },
        { id: 'rId3', type: `${REL}/extended-properties`, target: 'docProps/app.xml' },
      ]),
    },
    { name: 'docProps/core.xml', content: coreXml(meta) },
    { name: 'docProps/app.xml', content: appXml(n) },
    { name: 'ppt/presentation.xml', content: presentationXml(format, n) },
    {
      name: 'ppt/_rels/presentation.xml.rels',
      content: rels([
        { id: 'rId1', type: `${REL}/slideMaster`, target: 'slideMasters/slideMaster1.xml' },
        ...pages.map((_, i) => ({ id: `rId${i + 2}`, type: `${REL}/slide`, target: `slides/slide${i + 1}.xml` })),
        { id: `rId${n + 2}`, type: `${REL}/presProps`, target: 'presProps.xml' },
        { id: `rId${n + 3}`, type: `${REL}/viewProps`, target: 'viewProps.xml' },
        { id: `rId${n + 4}`, type: `${REL}/theme`, target: 'theme/theme1.xml' },
        { id: `rId${n + 5}`, type: `${REL}/tableStyles`, target: 'tableStyles.xml' },
      ]),
    },
    { name: 'ppt/presProps.xml', content: XML_DECL + `<p:presentationPr ${PML_NS}/>` },
    { name: 'ppt/viewProps.xml', content: XML_DECL + `<p:viewPr ${PML_NS}/>` },
    { name: 'ppt/tableStyles.xml', content: XML_DECL + `<a:tblStyleLst xmlns:a="${NS_A}" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>` },
    { name: 'ppt/theme/theme1.xml', content: THEME_XML },
    { name: 'ppt/slideMasters/slideMaster1.xml', content: MASTER_XML },
    {
      name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
      content: rels([
        { id: 'rId1', type: `${REL}/slideLayout`, target: '../slideLayouts/slideLayout1.xml' },
        { id: 'rId2', type: `${REL}/theme`, target: '../theme/theme1.xml' },
      ]),
    },
    { name: 'ppt/slideLayouts/slideLayout1.xml', content: LAYOUT_XML },
    {
      name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
      content: rels([{ id: 'rId1', type: `${REL}/slideMaster`, target: '../slideMasters/slideMaster1.xml' }]),
    },
  ]
  pages.forEach((p, i) => {
    entries.push(
      { name: `ppt/slides/slide${i + 1}.xml`, content: slideXml(p.snapshot, lang) },
      {
        name: `ppt/slides/_rels/slide${i + 1}.xml.rels`,
        content: rels([
          { id: 'rId1', type: `${REL}/slideLayout`, target: '../slideLayouts/slideLayout1.xml' },
          { id: 'rId2', type: `${REL}/image`, target: `../media/page${i + 1}.jpeg` },
        ]),
      },
      { name: `ppt/media/page${i + 1}.jpeg`, content: p.background },
    )
  })
  return entries
}

export function buildPptx(pages: readonly PptxPageInput[], format: Pick<PageFormat, 'w' | 'h'>, meta: PptxMeta): Uint8Array {
  return makeZipBytes(pptxEntries(pages, format, meta))
}
