// The project's art direction, as the handful of sentences a FILM can work from.
//
// ── Why a second reader of the same document ─────────────────────────────────
//
// `theme.ts` reads a DESIGN.md or a Muse dossier into four colours, two font
// families and a radius. That makes a film carry the project's colours, and it
// is the whole of what a theme can do — which turned out to be half the answer.
// Strip the colours out of two films and what is left is the same document: a
// direction that says "editorial, generous silence, one idea per screen" and one
// that says "dense, saturated, everything at once" composed identical scenes.
//
// So this reads the same markdown for the other half: the WORDS. They travel to
// `POST /api/video/compose`, land in the user turn under a header that says they
// are data, and change what the model composes — how many scenes, how crowded, a
// hairline ground or a gradient. They never become a value in the document.
//
// ── The two rules that keep it from becoming a theme ─────────────────────────
//
// **No colour crosses.** A line carrying a hex is dropped WHOLE — not the
// triplet snipped out of it — because "un noir profond #0a0a0c" minus its value
// is a sentence that still asks for a colour, and the point is that no request
// for one reaches the model at all. That is not tidiness.
// The colours already travel, exactly, as `theme` — attached by the server after
// the model's answer has been validated, which is the one path that cannot be
// argued with. Repeating them here adds nothing a composition can use and does
// the one thing this feature spends a whole prompt forbidding: it invites a model
// to write a colour, and a document carrying one is refused WHOLE, after the call
// is paid for.
//
// **It is prose, never a table.** A row of tokens read as prose is a list of
// values, and a model handed a list of values fills fields with them. What is
// wanted is the sentence beside the table, not the table.
//
// Failing to extract anything is not a failure: it returns '', the compose route
// leaves the block out, and the film is composed exactly as it was before this
// module existed (Q1).

/**
 * How much of the direction reaches the model.
 *
 * Mirrors `MAX_DIRECTION_CHARS` in `server/video/compose.js` in intent, not by
 * import — the server bounds it again because a bound enforced only where the
 * string was built is a bound the second caller does not have. Nine hundred
 * characters is a dozen lines: enough for a concept, a rhythm and a warning,
 * and short enough that it cannot push the catalogue out of the window.
 */
export const DIRECTION_BRIEF_MAX = 2400

/** A hex colour, in the three spellings a direction document uses. */
const HEX = /#[0-9a-fA-F]{3,8}\b/

/**
 * Lines a film has no use for.
 *
 * `Forbidden` is the interesting one and it is deliberately NOT dropped: a
 * direction that forbids drop shadows and gradients is telling the composer
 * which ground not to reach for, which is exactly the kind of thing this module
 * exists to carry.
 */
const NOISE = /^(?:\s*[-*]\s*)?(?:https?:\/\/|!\[|\|)/

export function directionBriefFrom(markdown: string | null | undefined): string {
  const md = typeof markdown === 'string' ? markdown : ''
  if (!md.trim()) return ''

  const lines: string[] = []
  let inFence = false
  /*
   * A heading is held back until something survives under it.
   *
   * These documents are mostly tokens, and a "## Tokens" whose every line was a
   * hex value would otherwise arrive as the word "Tokens" on its own — a header
   * pointing at nothing, in a block whose whole claim is that it is the part a
   * film can act on.
   */
  let pendingHeading: string | null = null
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim()
    // A fenced block in one of these documents is a token dump or a snippet of
    // CSS. Both are values, and values travel as the theme.
    if (line.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence || !line) continue
    if (HEX.test(line)) continue
    if (NOISE.test(line)) continue

    // Markdown syntax removed rather than kept: this lands in a plain-text block
    // beside a brief somebody typed, and a run of hashes there reads as emphasis
    // nobody wrote.
    const text = line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^[-*+]\s+/, '— ')
      .replace(/[*_`]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (text.length < 3) continue

    if (/^#{1,6}\s/.test(line)) {
      pendingHeading = text
      continue
    }
    if (pendingHeading) {
      lines.push(pendingHeading)
      pendingHeading = null
    }
    lines.push(text)
  }

  // Deduplicated, because these documents restate their own headings — and a
  // sentence a model reads twice is a sentence it weights twice.
  const seen = new Set<string>()
  const kept: string[] = []
  let length = 0
  for (const line of lines) {
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    // Whole lines only. A direction cut mid-sentence is a direction that says
    // something else, and the last one it says is the one nearest the model's
    // answer.
    // SKIP the line that does not fit, rather than stopping.
    //
    // Stopping kept the HEAD of a dossier and threw away its tail — and a Muse
    // dossier puts its concept first and its VOICE, its real copy and its
    // Forbidden list last. So the half that decides what a film SAYS was the
    // half being cut, silently, on every dossier longer than the budget. One
    // long paragraph in the middle used to cost everything after it.
    if (length + line.length + 1 > DIRECTION_BRIEF_MAX) continue
    kept.push(line)
    length += line.length + 1
  }
  return kept.join('\n')
}
