/**
 * Text a PDF's standard Helvetica can carry.
 *
 * The invisible text layer and the fields' appearances are set in Helvetica —
 * one of the fourteen fonts every PDF reader has, so nothing is embedded and a
 * flyer does not gain a megabyte of font. Its encoding is WinAnsi (Windows-1252),
 * and pdf-lib THROWS on a character outside it. A French flyer is almost entirely
 * inside it; a heart emoji, a narrow no-break space or a Polish ł are not, and
 * one of them must never cost the whole export. So each is mapped to its nearest
 * WinAnsi spelling, and what has none is dropped: the text layer exists to be
 * searched and copied, and a missing emoji does not stop either.
 */

/** Windows-1252's 0x80–0x9F block, where it departs from Latin-1. */
const CP1252_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')

const NEAREST: Record<string, string> = {
  ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
  '‐': '-', '‑': '-', '‒': '-', '−': '-', '⁃': '-',
  '′': "'", '″': '"', '‵': "'",
  '←': '<-', '→': '->', '↔': '<->', '⇒': '=>',
  '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~',
  '✓': 'v', '✔': 'v', '✕': 'x', '✖': 'x', '✗': 'x',
  '●': '•', '◦': '•', '‣': '•', '▪': '•', '▸': '>',
  'Ł': 'L', 'ł': 'l', 'Đ': 'D', 'đ': 'd', 'ı': 'i', 'ß': 'ß',
  '№': 'No', '™': '™',
}

export function isWinAnsi(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || CP1252_EXTRA.has(ch)
}

/**
 * `text` with every character Helvetica cannot encode replaced or removed.
 * Line breaks become spaces unless `keepNewlines` (a multiline field's value).
 */
export function toWinAnsi(text: string, keepNewlines = false): string {
  let out = ''
  for (const ch of text.replace(/\r\n?/g, '\n')) {
    if (ch === '\n') {
      out += keepNewlines ? '\n' : ' '
      continue
    }
    if (ch === '\t') {
      out += ' '
      continue
    }
    if (isWinAnsi(ch)) {
      out += ch
      continue
    }
    const near = NEAREST[ch]
    if (near !== undefined) {
      out += near
      continue
    }
    // A letter with an accent WinAnsi lacks (ő, ș, ę…) keeps its base letter.
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (base && base !== ch && [...base].every(isWinAnsi)) out += base
    // Everything else — emoji, CJK, symbols — is dropped.
  }
  return out
}
