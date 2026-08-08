/**
 * The scroll sequences a generated screen actually uses, and swapping one.
 *
 * WHY THIS IS NOT A BRANCH OF screenImages.ts
 *
 * An image is named by one thing, a URL, so `findScreenImages` can describe it
 * with one span and `replaceScreenImage` can settle it with one splice. A scroll
 * sequence is named by TWO, written as two different kinds of JSX attribute:
 *
 *     <ScrollSequence base="…/api/videos/HASH" frames={60} height={300}>
 *
 * `base` says where the frames are and `frames` says how many there are, and the
 * note on `Screen.videoFrames` already says why neither travels alone: the
 * component walks 1…total and picks the nearest frame it managed to decode, so a
 * sequence addressed with a stale count either stops early and draws its last
 * frame for the rest of the scroll, or asks for frames that 404 and draws the
 * last one that did not. Neither failure throws, neither is visible in the code
 * view, and both look like the swap worked.
 *
 * So every function here takes and returns the PAIR. That is the one thing the
 * image API cannot express — and the count lives in a JSX expression container
 * rather than in a string, so even the splice is a different splice.
 *
 * WHY AN AST AND NOT A REGEX
 *
 * Invariant I1, for the same reason as its neighbour: a pattern for
 * `/api/videos/…` matches inside a comment, inside prose about a URL, and inside
 * code the model wrote and commented out — and a pattern for the ATTRIBUTE PAIR
 * would additionally have to decide what a JSX element is, which is exactly the
 * structural question a regular expression must never answer. Babel finds the
 * opening element and its attributes; only inside a range it has vouched for is
 * text searched for a URL.
 *
 * WHY IT SPLICES INSTEAD OF RE-PRINTING
 *
 * Same answer as screenImages.ts: re-printing the AST reflows the whole
 * component, and the user reads this source in the Code view. The offsets are
 * those of the URL itself and of the digits themselves, so quotes, braces and
 * every other byte of the file survive untouched.
 */

/** A 64-hex content address. A clip is addressed by the SHA-256 of its source (M8). */
const HASH_RE = '[a-f0-9]{64}'

/**
 * The address shape, searched only inside a range Babel identified as literal.
 *
 * The origin is optional for the reason it is optional for images: a project
 * created on `localhost:5173` and opened elsewhere carries a stale absolute
 * origin (AUDIT §7.2), and those sequences must still be found and replaceable.
 */
function urlPattern(): RegExp {
  return new RegExp(`(?:https?://[^\\s"'\`<>]*?)?/api/videos/(${HASH_RE})`, 'g')
}

/** Half of the pair: where it sits in the source, and how it was written. */
export interface SequencePart {
  start: number
  end: number
}

export interface ScreenSequence {
  /** The clip-library hash the `base` attribute points at. */
  hash: string
  /** The frame count as the source currently states it. */
  frames: number
  /**
   * The element carrying the pair — `ScrollSequence` in everything Muse writes.
   *
   * Recorded for the picker row, never matched on. A screen whose model wrapped
   * the component in one of its own — `<Hero base={…} frames={…}>` forwarding
   * the props — is still a sequence that has to be re-pointable, and keying the
   * search on the name would have quietly excluded it.
   */
  element: string | null
  /** Offsets of the URL inside the `base` literal, quotes excluded. */
  base: SequencePart & { absolute: boolean }
  /** Offsets of the digits of the count, braces and quotes excluded. */
  count: SequencePart
  /** 1-based line of the address, so the slot can be found in the Code view. */
  line: number
}

/**
 * Every scroll sequence referenced by this source, in first-appearance order.
 *
 * One entry per occurrence, deliberately unlike `findScreenImages`, which groups
 * a hash and lists its places. That grouping exists because Muse produces ONE
 * image per screen and the model spreads it over a hero, a card and an avatar —
 * genuinely one picture in several slots. A sequence is a hero: two of them on a
 * screen are two sections, each with its own count, and offering to "replace
 * everywhere" would put one clip's frame count on another clip's address.
 *
 * Never throws. A file Babel cannot parse yields an empty list — the compiler
 * downstream reports the syntax error far better than this could, and falling
 * back to a regex over the whole file is precisely what I1 forbids.
 */
export async function findScreenSequences(source: string): Promise<ScreenSequence[]> {
  if (!source || !source.includes('/api/videos/')) return []

  const found: ScreenSequence[] = []

  try {
    const Babel = await import('@babel/standalone')
    const transform = Babel.transform ?? Babel.default?.transform
    if (typeof transform !== 'function') return []

    /** The ranges of an attribute value that are literal TEXT, per Babel. */
    const literalRanges = (node: any): Array<[number, number]> => {
      if (!node) return []
      // `base={"…"}` and `base={`${origin}/api/videos/…`}` are both shapes models
      // produce; unwrapping the container is what keeps the interpolation around
      // a quasi out of every span, and therefore never rewritten.
      if (node.type === 'JSXExpressionContainer') return literalRanges(node.expression)
      if (node.type === 'StringLiteral') {
        return typeof node.start === 'number' && typeof node.end === 'number' ? [[node.start, node.end]] : []
      }
      if (node.type === 'TemplateLiteral') {
        return (node.quasis || [])
          .filter((q: any) => typeof q.start === 'number' && typeof q.end === 'number')
          .map((q: any) => [q.start, q.end] as [number, number])
      }
      return []
    }

    const addressOf = (node: any): ScreenSequence['base'] & { hash: string } | null => {
      let hit: (ScreenSequence['base'] & { hash: string }) | null = null
      for (const [from, to] of literalRanges(node)) {
        const re = urlPattern()
        const raw = source.slice(from, to)
        let m: RegExpExecArray | null
        while ((m = re.exec(raw))) {
          // Two addresses in one `base` is not a case a splice can settle:
          // which one the component ends up using depends on code this module
          // does not run. Say nothing rather than rewrite the wrong half.
          if (hit) return null
          const at = from + m.index
          hit = { hash: m[1], start: at, end: at + m[0].length, absolute: m[0].startsWith('http') }
        }
      }
      return hit
    }

    const countOf = (node: any): (SequencePart & { frames: number }) | null => {
      const inner = node?.type === 'JSXExpressionContainer' ? node.expression : node
      if (!inner || typeof inner.start !== 'number' || typeof inner.end !== 'number') return null
      // `frames={60}` — what the generation prompt asks for. The span is the
      // literal, not the braces, so the container survives the splice.
      if (inner.type === 'NumericLiteral') {
        const n = Number(inner.value)
        return Number.isInteger(n) && n > 0 ? { frames: n, start: inner.start, end: inner.end } : null
      }
      // `frames="60"` — legal JSX, and the component parseInt()s its props, so a
      // screen written that way works and has to stay replaceable. The digits sit
      // between the quotes; the test is a validation of text Babel already
      // identified as one literal, not a discovery of structure (I1).
      if (inner.type === 'StringLiteral') {
        const raw = source.slice(inner.start + 1, inner.end - 1)
        return /^[0-9]+$/.test(raw) && Number(raw) > 0
          ? { frames: Number(raw), start: inner.start + 1, end: inner.end - 1 }
          : null
      }
      return null
    }

    const nameOf = (node: any): string | null => {
      if (node?.type === 'JSXIdentifier') return String(node.name)
      if (node?.type === 'JSXMemberExpression') {
        const object = nameOf(node.object)
        const property = node.property?.name
        return object && property ? `${object}.${property}` : null
      }
      return null
    }

    const plugin = () => ({
      visitor: {
        JSXOpeningElement(path: any) {
          const attrs = path.node?.attributes
          if (!Array.isArray(attrs)) return
          let baseValue: any = null
          let framesValue: any = null
          for (const a of attrs) {
            if (a?.type !== 'JSXAttribute' || a.name?.type !== 'JSXIdentifier') continue
            if (a.name.name === 'base') baseValue = a.value
            else if (a.name.name === 'frames') framesValue = a.value
          }
          if (!baseValue || !framesValue) return

          const address = addressOf(baseValue)
          if (!address) return
          const count = countOf(framesValue)
          // The pair or nothing. `frames={total}` cannot be rewritten without
          // guessing what `total` evaluates to, and rewriting `base` alone is the
          // exact defect this module is built around — so such an element is not
          // reported at all rather than reported as replaceable.
          if (!count) return

          found.push({
            hash: address.hash,
            frames: count.frames,
            element: nameOf(path.node.name),
            base: { start: address.start, end: address.end, absolute: address.absolute },
            count: { start: count.start, end: count.end },
            // Counting newlines before the offset: Babel's own loc is on the
            // attribute, not on the URL inside it.
            line: source.slice(0, address.start).split('\n').length,
          })
        },
      },
    })

    transform(source, {
      plugins: [plugin],
      parserOpts: { plugins: ['jsx'] },
      // Nothing is printed: this pass only reads.
      code: false,
      filename: 'mocky-component.jsx',
    })
  } catch {
    // Unparseable: say nothing rather than guess. See the header.
    return []
  }

  return found
}

/**
 * Point one occurrence at another clip — address AND count, in one call.
 *
 * There is deliberately no way to ask for half of it. A caller able to rewrite
 * the address and skip the count would produce a hero that draws its last frame
 * for the rest of the scroll, and that failure is silent: no error, no console
 * warning, and source that still parses.
 *
 * A URL that was absolute is rewritten with `origin`, which is the only honest
 * thing to write — the URL is being authored now, and carrying a stale origin
 * over from the old literal produces a link that has never worked on this host.
 * A URL that was relative stays relative: giving it an origin would change what
 * it resolves to inside an iframe whose own origin is opaque (I2).
 *
 * Pure and synchronous: the parse already happened in `findScreenSequences`.
 */
export function replaceScreenSequence(
  source: string,
  sequence: ScreenSequence,
  next: { hash: string; frames: number },
  origin: string,
): string {
  if (!sequence?.base || !sequence.count) return source
  // The hash goes straight into a URL the iframe will fetch, and the count into
  // the source; anything that is not a content address or a positive whole
  // number has come from somewhere it should not have.
  if (!new RegExp(`^${HASH_RE}$`).test(next?.hash ?? '')) return source
  if (!Number.isInteger(next.frames) || next.frames < 1) return source

  const base = origin.replace(/\/+$/, '')
  const edits = [
    {
      start: sequence.base.start,
      end: sequence.base.end,
      text: `${sequence.base.absolute ? base : ''}/api/videos/${next.hash}`,
    },
    { start: sequence.count.start, end: sequence.count.end, text: String(next.frames) },
  ]
    // Right to left, so the first splice never shifts the second one's offsets.
    // `frames` usually follows `base`, but attribute order is the model's choice
    // and sorting costs nothing.
    .sort((a, b) => b.start - a.start)

  let out = source
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  return out
}
