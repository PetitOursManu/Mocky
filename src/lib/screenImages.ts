/**
 * The images a generated screen actually uses, and swapping one for another.
 *
 * WHY THIS EXISTS
 *
 * An image reaches a screen exactly once, at generation time: it is pinned in
 * the Media library, its URL is written into the generation prompt, and the
 * model copies that URL into the JSX by hand. After that the URL is an ordinary
 * string literal in `Screen.code` and nothing in the app knows it is there — so
 * changing your mind about a picture meant regenerating the screen and losing
 * everything else about it. This module is what makes the URL addressable
 * again.
 *
 * WHY AN AST AND NOT A REGEX
 *
 * Invariant I1: never regex-parse generated source to decide what it contains.
 * A pattern for `/api/images/…` matches inside a comment, inside a string that
 * merely talks about a URL, and inside code the model wrote and then commented
 * out — and rewriting one of those silently corrupts a screen the user then has
 * to debug. Babel is already a dependency and already parses this exact source
 * downstream; asking it where the literals are costs one parse and cannot be
 * fooled.
 *
 * Note the division of labour. Babel decides what is a string literal and where
 * it starts and ends. Only INSIDE a range it has vouched for is the text
 * searched for a URL. The invariant is about deciding structure with a pattern,
 * which is precisely what does not happen here.
 *
 * WHY IT SPLICES INSTEAD OF RE-PRINTING
 *
 * The obvious implementation edits the AST and prints it back. That reformats
 * the whole component: quotes, line breaks, JSX attribute wrapping. The user
 * reads this source in the Code view and may have hand-edited it, and a
 * whole-file reflow to change 64 characters is not a change they asked for.
 *
 * Re-quoting just the one literal is no better, and worse in JSX: a JSX
 * attribute string is raw text, not a JS string, so a backslash written back by
 * `JSON.stringify` would mean something different from what was parsed. So the
 * spans are the offsets of the URL ITSELF, and the edit replaces exactly those
 * characters. Every other byte of the file, quoting included, is untouched.
 */

/** A 64-hex content address, the only form the image library hands out. */
const HASH_RE = '[a-f0-9]{64}'

/**
 * The URL shape, searched only inside a range Babel has identified as a literal.
 *
 * The origin is optional on purpose. A project created on `localhost:5173` and
 * opened on another host carries a stale absolute origin (AUDIT §7.2), and
 * those images must still be found and still be replaceable.
 */
function urlPattern(hash = HASH_RE): RegExp {
  return new RegExp(`(?:https?://[^\\s"'\`<>]*?)?/api/images/(${hash})`, 'g')
}

/**
 * Where one URL sits in the source, with enough about its surroundings to tell
 * two occurrences of the same picture apart.
 *
 * Muse produces ONE image per screen, so a page needing a hero, a card and an
 * avatar gets the same file in all three. Replacing them as a group is right
 * when they really are one picture shown twice, and wrong when the user wants a
 * different image in each slot — and the only way to offer the choice is to
 * describe each slot well enough to be recognised.
 */
export interface ImageSpan {
  start: number
  end: number
  /** True when the matched text began with http(s)://— i.e. it was absolute. */
  absolute: boolean
  /** The `alt` of the element this occurrence sits in, when it is a plain string. */
  alt: string | null
  /**
   * A short excerpt of the element's classes, as a fallback handle.
   *
   * `alt=""` is correct and common on decorative images, so a great many slots
   * have no alt to be named by. `h-64 w-full object-cover` is not a caption,
   * but it is enough to tell a hero from a thumbnail in a list.
   */
  context: string | null
  /** 1-based line in the source, so a slot can be found in the Code view. */
  line: number
}

export interface ScreenImage {
  /** The library hash this URL points at. */
  hash: string
  /** Every place in the source that names it. */
  spans: ImageSpan[]
  /**
   * The `alt` of the first `<img>` that used it, when it is a plain string.
   *
   * A label for the picker and nothing more. An empty alt is the common case —
   * the generation prompt asks for `alt=""` on decorative pictures — so it must
   * never be read as "this image is missing something".
   */
  alt: string | null
}

/**
 * Every library image referenced by this source, in first-appearance order.
 *
 * Never throws. A file Babel cannot parse yields an empty list, which the UI
 * shows as "no images found here": the compiler downstream reports the syntax
 * error far better than this could, and falling back to a regex over the whole
 * file after a failed parse is exactly what the invariant forbids.
 */
export async function findScreenImages(source: string): Promise<ScreenImage[]> {
  if (!source || !source.includes('/api/images/')) return []

  const byHash = new Map<string, ScreenImage>()
  const record = (hash: string, span: ImageSpan) => {
    const found = byHash.get(hash)
    if (!found) {
      byHash.set(hash, { hash, spans: [span], alt: span.alt })
      return
    }
    found.spans.push(span)
    // First alt wins for the summary row: the hero is written before its
    // thumbnail. Each span keeps its own regardless.
    if (found.alt === null && span.alt !== null) found.alt = span.alt
  }

  try {
    const Babel = await import('@babel/standalone')
    const transform = Babel.transform ?? Babel.default?.transform
    if (typeof transform !== 'function') return []

    /** A plain-string attribute of the JSX element this node sits in. */
    const attrOf = (path: any, name: string): string | null => {
      const opening = path.findParent?.((p: any) => p.node?.type === 'JSXOpeningElement')
      const attrs = opening?.node?.attributes
      if (!Array.isArray(attrs)) return null
      for (const a of attrs) {
        if (a?.type !== 'JSXAttribute' || a.name?.name !== name) continue
        // `alt={expr}` is not knowable here, and guessing at it would put a
        // wrong caption on a picker row.
        return a.value?.type === 'StringLiteral' ? String(a.value.value) : null
      }
      return null
    }

    /** Search a range Babel vouched for, and record absolute source offsets. */
    const scan = (path: any, start: number, end: number) => {
      const raw = source.slice(start, end)
      const re = urlPattern()
      let m: RegExpExecArray | null
      // Read once per literal rather than per match: the attributes belong to
      // the element, not to each URL inside it.
      let described: { alt: string | null; context: string | null } | undefined
      while ((m = re.exec(raw))) {
        if (described === undefined) {
          const cls = attrOf(path, 'className')
          described = {
            alt: attrOf(path, 'alt'),
            // Trimmed hard: this is a handle, not a caption, and the whole
            // class list of a generated element is a paragraph.
            context: cls ? cls.split(/\s+/).filter(Boolean).slice(0, 5).join(' ') || null : null,
          }
        }
        const at = start + m.index
        record(m[1], {
          start: at,
          end: at + m[0].length,
          absolute: m[0].startsWith('http'),
          alt: described.alt,
          context: described.context,
          // Counting newlines before the offset — the source is already in hand,
          // and Babel's own loc is on the literal, not on the URL inside it.
          line: source.slice(0, at).split('\n').length,
        })
      }
    }

    const plugin = () => ({
      visitor: {
        StringLiteral(path: any) {
          const { start, end } = path.node || {}
          if (typeof start === 'number' && typeof end === 'number') scan(path, start, end)
        },
        /**
         * The static chunks of a template literal.
         *
         * `` `${base}/api/images/abc…` `` is a shape models produce, and its
         * hash lives in a quasi rather than in a StringLiteral. Scanning the
         * chunk on its own means the interpolation around it is never inside a
         * span and so is never touched.
         */
        TemplateElement(path: any) {
          const { start, end } = path.node || {}
          if (typeof start === 'number' && typeof end === 'number') scan(path, start, end)
        },
      },
    })

    transform(source, {
      plugins: [plugin],
      parserOpts: { plugins: ['jsx'] },
      // Nothing is printed: this pass only reads. Skipping codegen is the
      // difference between one parse and a full reprint of every screen.
      code: false,
      filename: 'mocky-component.jsx',
    })
  } catch {
    // Unparseable: say nothing rather than guess. See the header.
    return []
  }

  return [...byHash.values()]
}

/**
 * Point the given occurrences at `nextHash` instead.
 *
 * Spans rather than a whole image, because both answers are right depending on
 * what the user meant. Muse produces ONE image per screen, so a page that needs
 * a hero, a card and an avatar gets the same file in all three — sometimes that
 * is one picture shown three times and should move as a unit, and sometimes the
 * three are meant to be different pictures and Muse simply could not supply
 * them. The caller passes `image.spans` for the first and a single span for the
 * second; neither is expressible if this function decides for itself.
 *
 * A URL that was absolute is rewritten with `origin`, which is the only honest
 * thing to write: the URL is being authored now, and carrying a stale origin
 * over from the old literal produces a link that has never worked on this host.
 * A URL that was relative stays relative — giving it an origin would change
 * what it means inside an iframe whose own origin is opaque (I2).
 *
 * Pure and synchronous: the parse already happened in `findScreenImages`.
 */
export function replaceScreenImage(
  source: string,
  spans: ImageSpan[],
  nextHash: string,
  origin: string,
): string {
  if (!spans.length || !new RegExp(`^${HASH_RE}$`).test(nextHash)) return source
  const base = origin.replace(/\/+$/, '')

  // Right to left, so an earlier splice never shifts a later span's offsets.
  const ordered = [...spans].sort((a, b) => b.start - a.start)
  let out = source
  for (const span of ordered) {
    const next = `${span.absolute ? base : ''}/api/images/${nextHash}`
    out = out.slice(0, span.start) + next + out.slice(span.end)
  }
  return out
}
