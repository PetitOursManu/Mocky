/**
 * A long text cut into the pieces "Illustrate a text" draws one visual each
 * for — a paragraph, a list, a section under its heading.
 *
 * No model: a paragraph break is the author's own statement of where one idea
 * ends. Three adjustments, each for a text that came back badly cut:
 *  - a heading is never a block of its own: it is the TITLE of what follows,
 *    and a visual of "## Our method" alone has nothing to draw;
 *  - a list stays with the sentence that introduces it ("Three steps:"), or the
 *    visual of the list has no subject and the sentence has no content;
 *  - a block too short to hold a structure (one line of a few words) joins the
 *    next one rather than costing a generation.
 *
 * A block is known by a DIGEST of its words, not its position: the screen made
 * from it carries the digest (`Screen.illustrates`), so inserting a paragraph
 * above does not hand every later visual to the wrong paragraph.
 */

export interface TextBlock {
  /** The words the visual is made from, heading first when there is one. */
  text: string
  /** The heading the block sits under, without its marks. */
  heading?: string
  /** Stable id of the words (whitespace-insensitive). */
  digest: string
}

/** Fewer words than this is a fragment, not a block. */
export const BLOCK_MIN_WORDS = 12
/** Past this, a block is cut where a paragraph ends: one visual cannot say more. */
export const BLOCK_MAX_WORDS = 260
/** How much text the panel takes at all. */
export const ILLUSTRATE_MAX_CHARS = 40_000

const words = (s: string) => s.split(/\s+/).filter(Boolean).length
const isHeading = (line: string) => /^#{1,6}\s+\S/.test(line)
const isListLine = (line: string) => /^\s*(?:[-*•–]|\d+[.)])\s+\S/.test(line)

/** FNV-1a over the words, so re-wrapping a paragraph keeps its id. */
export function blockDigest(text: string): string {
  const norm = text.replace(/\s+/g, ' ').trim().toLowerCase()
  let h = 0x811c9dc5
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

export function splitBlocks(input: string): TextBlock[] {
  const text = input.replace(/\r\n?/g, '\n').slice(0, ILLUSTRATE_MAX_CHARS)
  // Paragraphs: runs of non-empty lines.
  const paras: string[] = []
  let cur: string[] = []
  for (const line of text.split('\n')) {
    if (line.trim()) cur.push(line.trimEnd())
    else if (cur.length) {
      paras.push(cur.join('\n'))
      cur = []
    }
  }
  if (cur.length) paras.push(cur.join('\n'))

  const out: { body: string[]; heading?: string }[] = []
  let heading: string | undefined
  let pending: string[] = []
  const flush = () => {
    if (pending.length) out.push({ body: pending, heading })
    pending = []
  }
  for (const p of paras) {
    const lines = p.split('\n')
    // A paragraph that opens with a heading: the heading starts a section.
    if (isHeading(lines[0])) {
      flush()
      heading = lines[0].replace(/^#{1,6}\s+/, '').trim()
      const rest = lines.slice(1).join('\n').trim()
      if (rest) pending.push(rest)
      continue
    }
    const isList = lines.every((l) => isListLine(l) || /^\s{2,}\S/.test(l))
    const prev = pending[pending.length - 1]
    // A list goes with the sentence that introduces it.
    if (isList && prev && /[:：]\s*$/.test(prev)) {
      pending.push(p)
      continue
    }
    // The block so far is a whole idea: close it before starting another.
    if (pending.length && words(pending.join(' ')) >= BLOCK_MIN_WORDS) flush()
    // A block that would grow past what one visual can say is closed first.
    if (pending.length && words([...pending, p].join(' ')) > BLOCK_MAX_WORDS) flush()
    pending.push(p)
  }
  flush()

  // A last fragment joins the block before it rather than standing alone.
  const merged: { body: string[]; heading?: string }[] = []
  for (const b of out) {
    const last = merged[merged.length - 1]
    if (last && words(b.body.join(' ')) < BLOCK_MIN_WORDS && last.heading === b.heading) last.body.push(...b.body)
    else merged.push({ ...b, body: [...b.body] })
  }
  return merged.map((b) => {
    const body = b.body.join('\n\n')
    const full = b.heading ? `${b.heading}\n\n${body}` : body
    return { text: full, ...(b.heading ? { heading: b.heading } : {}), digest: blockDigest(full) }
  })
}

/** A short name for the screen made from a block: its heading, else its first words. */
export function blockName(block: TextBlock, max = 48): string {
  const source = block.heading || block.text.replace(/^[-*•–\d.)\s]+/, '')
  const flat = source.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,;:.–-]+$/, '')}…`
}

/**
 * The words of a .docx: the paragraphs of `word/document.xml`, headings marked
 * as Markdown so `splitBlocks` treats them as headings. Read in the browser
 * with the zip reader the site import already uses — no library, and nothing
 * leaves the browser.
 */
export function docxXmlToText(xml: string): string {
  const out: string[] = []
  for (const para of xml.split(/<\/w:p>/)) {
    const style = /<w:pStyle\s+w:val="([^"]+)"/.exec(para)?.[1] ?? ''
    const level = /^(?:Heading|Titre|Title)\s*?(\d)?$/i.exec(style.replace(/\s+/g, ''))
    const list = /<w:numPr>/.test(para)
    const runs = [...para.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)].map((m) => (m[1] !== undefined ? m[1] : ' '))
    const text = decodeXml(runs.join('')).trim()
    if (!text) {
      out.push('')
      continue
    }
    if (level) out.push('', `${'#'.repeat(Math.min(6, Number(level[1] ?? 1)))} ${text}`, '')
    else if (list) out.push(`- ${text}`)
    else out.push(text, '')
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
}

export class TextFileError extends Error {}

/** The text of a .txt, .md or .docx the person picked. Throws `TextFileError` with a reason. */
export async function readTextFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (file.size > 20 * 1024 * 1024) throw new TextFileError('tooBig')
  if (name.endsWith('.docx')) {
    const { openZip } = await import('../zipRead')
    const zip = openZip(new Uint8Array(await file.arrayBuffer()))
    const xml = await zip.read('word/document.xml')
    if (!xml) throw new TextFileError('notDocx')
    return docxXmlToText(new TextDecoder().decode(xml)).slice(0, ILLUSTRATE_MAX_CHARS)
  }
  if (/\.(txt|md|markdown)$/.test(name) || file.type.startsWith('text/')) return (await file.text()).slice(0, ILLUSTRATE_MAX_CHARS)
  throw new TextFileError('format')
}
