/**
 * The named sections a generated screen contains, so a later pass can be told
 * WHERE to put something instead of having to guess.
 *
 * ── The defect ────────────────────────────────────────────────────────────
 *
 * A Motion film of kind `showcase` — a product tile — was placed in the top
 * section of the page, over the hero. The instruction said "give it the size
 * its role deserves, it is NOT the hero"; the model still had to FIND the
 * product section by reading anonymous `<section>` and `<div>` elements, and it
 * picked the first one. An instruction cannot name a place a document does not
 * name either.
 *
 * So generation now puts a stable `id` on every top-level section (see
 * `SECTION_IDS` in `generate.ts`), and this reads them back. The placement pass
 * then quotes the ids that really exist in THIS screen and says which one to
 * use — a handle, not a description.
 *
 * ── Invariant I1 ──────────────────────────────────────────────────────────
 *
 * Never regex-parse generated source to decide what it contains. Babel is
 * already a dependency and already parses this exact source downstream; asking
 * it where the ids are costs one parse and cannot be fooled by an `id` written
 * inside a string, a comment or a class name. `screenImages.ts` makes the same
 * argument at greater length.
 *
 * Never throws: a screen Babel cannot parse yields an empty list, and the
 * caller falls back to the instruction it had before. Guessing with a regex
 * after a failed parse is exactly what the invariant forbids.
 */

export interface ScreenSection {
  /** The `id` attribute, verbatim — this is the handle a later pass quotes. */
  id: string
  /** The element it sits on: `section`, `header`, `div`… Context, not a key. */
  tag: string
  /** Source order, so "the first one" and "the last one" are answerable. */
  index: number
}

/**
 * Every element carrying a literal `id`, in source order.
 *
 * A LITERAL id only: `id={slug}` is a value this pass cannot know, and a handle
 * that might not be the one in the rendered DOM is worse than no handle — the
 * placement pass would quote a name the screen does not have.
 */
export async function findScreenSections(source: string): Promise<ScreenSection[]> {
  const code = typeof source === 'string' ? source : ''
  if (!code.trim()) return []

  const found: ScreenSection[] = []
  const seen = new Set<string>()

  try {
    const Babel = await import('@babel/standalone')
    const transform = (Babel as any).transform ?? (Babel as any).default?.transform
    if (typeof transform !== 'function') return []

    const plugin = () => ({
      visitor: {
        JSXOpeningElement(path: any) {
          const node = path.node
          // `<section>` and `<Card>` alike: a capitalised component can carry an
          // id too, and refusing it would hide half the sections of a screen
          // built out of local components.
          const name = node?.name
          const tag =
            name?.type === 'JSXIdentifier'
              ? String(name.name)
              : name?.type === 'JSXMemberExpression'
                ? 'component'
                : ''
          if (!tag) return

          for (const a of node.attributes || []) {
            if (a?.type !== 'JSXAttribute' || a.name?.name !== 'id') continue
            if (a.value?.type !== 'StringLiteral') continue
            const id = String(a.value.value).trim()
            // Duplicates are not an error worth refusing over — a screen with
            // two `id="cta"` is invalid HTML and still renders — but quoting
            // one twice would make a list read as two different places.
            if (!id || seen.has(id)) continue
            seen.add(id)
            found.push({ id, tag, index: found.length })
          }
        },
      },
    })

    transform(code, {
      plugins: [plugin],
      parserOpts: { plugins: ['jsx'] },
      // Nothing is printed: this pass only reads.
      code: false,
      filename: 'mocky-component.jsx',
    })
  } catch {
    return []
  }

  return found
}

/**
 * Which section a rendered film ended up inside.
 *
 * The placement pass is an EDIT: the model is given the page, the film's src
 * and the id it should land in, and it rewrites the page. One came back with
 * the film in a band of its own at the top — so the site began below the fold,
 * and the first screen was a video with nothing on it. The instruction says not
 * to; this is what can tell whether it did.
 *
 * Returns the id of the nearest enclosing element that HAS one, or null when
 * the film sits outside every section — which is the answer that matters, and
 * is why this walks up rather than counting ids: a film wrapped in a brand new
 * `<section id="film">` would pass a count and fail a reader.
 */
export async function filmSectionIn(source: string): Promise<string | null> {
  const code = typeof source === 'string' ? source : ''
  if (!code.includes('MotionFilm')) return null

  let home: string | null = null
  try {
    const Babel = await import('@babel/standalone')
    const transform = (Babel as any).transform ?? (Babel as any).default?.transform
    if (typeof transform !== 'function') return null

    const idOf = (node: any): string | null => {
      for (const a of node?.attributes || []) {
        if (a?.type !== 'JSXAttribute' || a.name?.name !== 'id') continue
        if (a.value?.type !== 'StringLiteral') continue
        const id = String(a.value.value).trim()
        if (id) return id
      }
      return null
    }

    const plugin = () => ({
      visitor: {
        JSXOpeningElement(path: any) {
          if (home) return
          const name = path.node?.name
          if (name?.type !== 'JSXIdentifier' || name.name !== 'MotionFilm') return
          let parent = path.parentPath?.parentPath
          while (parent) {
            if (parent.node?.type === 'JSXElement') {
              const id = idOf(parent.node.openingElement)
              if (id) {
                home = id
                return
              }
            }
            parent = parent.parentPath
          }
        },
      },
    })

    transform(code, {
      plugins: [plugin],
      parserOpts: { plugins: ['jsx'] },
      code: false,
      filename: 'mocky-component.jsx',
    })
  } catch {
    return null
  }

  return home
}

/**
 * What may not be laid ON a film, because each one is a PICTURE of its own.
 *
 * `<MotionFilm>` takes children and puts them in a layer above the video —
 * written for a hero, where a headline and a button stand on a moving ground.
 * A placement read that as "a container", and wrapped the whole hero in it: an
 * interactive map of Nîmes, its photograph, its pins and its controls, all
 * inside an `aspect-video` box with `overflow: hidden`, over a film that had
 * already burnt its own title into the frames. Two pictures in one box, the one
 * that cost a render underneath.
 *
 * The list is what a picture IS, not what a page contains: type, buttons,
 * figures and cards are exactly what the overlay exists for and none of them
 * hides the film. `svg` is deliberately absent — an icon inside a button on the
 * overlay is the common case, and an inline illustration is rare enough that
 * refusing every icon to catch it is the worse trade.
 *
 * Capitalised names are components in `CAPABILITIES`, and the test holds them
 * to it: a renamed component must not silently leave this list matching
 * nothing.
 */
export const FILM_COVERS = [
  'img',
  'picture',
  'video',
  'canvas',
  'iframe',
  // A second film, a scroll sequence (which is a film cut into stills) and a 3D
  // scene are all moving pictures. One of them over another is the defect this
  // repair was written for, one capability further along.
  'MotionFilm',
  'ScrollSequence',
  'Scene3D',
] as const

/** Keys a deep walk never has to follow — position, not content. */
const AST_NOISE = new Set([
  'loc',
  'start',
  'end',
  'range',
  'extra',
  'comments',
  'leadingComments',
  'trailingComments',
  'innerComments',
])

const jsxNameOf = (name: any): string =>
  name?.type === 'JSXIdentifier'
    ? String(name.name)
    : name?.type === 'JSXMemberExpression'
      ? `${jsxNameOf(name.object)}.${jsxNameOf(name.property)}`
      : ''

/**
 * A picture this element IS — by its tag, or by a background it paints.
 *
 * The painted case is the same defect with the photograph in a class instead of
 * a tag: `bg-[url(…)]` and `style={{ backgroundImage: … }}` put an image on the
 * film exactly as an `<img>` does, and a check that reads only tags would send
 * the placement through.
 */
function pictureOf(opening: any): string | null {
  const tag = jsxNameOf(opening?.name)
  if (tag && (FILM_COVERS as readonly string[]).includes(tag)) return tag

  for (const a of opening?.attributes || []) {
    if (a?.type !== 'JSXAttribute') continue
    const name = String(a.name?.name || '')
    if (name === 'className' && a.value?.type === 'StringLiteral' && a.value.value.includes('bg-[url(')) {
      return 'background-image'
    }
    if (name === 'style' && a.value?.type === 'JSXExpressionContainer') {
      const props = a.value.expression?.type === 'ObjectExpression' ? a.value.expression.properties : []
      for (const p of props) {
        const key = p?.key?.name ?? p?.key?.value
        if (String(key || '') === 'backgroundImage') return 'background-image'
      }
    }
  }
  return null
}

/** The first picture anywhere below this node, whatever wraps it. */
function pictureIn(node: any, depth = 0): string | null {
  if (!node || typeof node !== 'object' || depth > 400) return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = pictureIn(item, depth + 1)
      if (found) return found
    }
    return null
  }
  if (node.type === 'JSXElement') {
    const found = pictureOf(node.openingElement)
    if (found) return found
  }
  // Every key rather than a chosen few: the offending `<img>` in the reported
  // screen sat beside a `places.map(…)` callback, and a walk that followed only
  // `children` would have found the map's pins and missed the photograph.
  for (const key of Object.keys(node)) {
    if (AST_NOISE.has(key)) continue
    const found = pictureIn(node[key], depth + 1)
    if (found) return found
  }
  return null
}

/**
 * What the placement laid ON the film, when it laid a picture on it.
 *
 * The companion of `filmSectionIn`, and the same argument: the instruction says
 * the overlay is a thin layer of type and buttons, and an instruction is not a
 * guarantee. Returns the name of the first picture among the film's OWN
 * children — `img`, another moving surface, or a painted background — or null
 * when the overlay is what it was asked to be.
 *
 * Never throws, and answers null on a source Babel cannot parse: a placement
 * refused because the result would not parse is a placement refused for the
 * wrong reason, and the render already happened.
 */
export async function filmCovers(source: string): Promise<string | null> {
  const code = typeof source === 'string' ? source : ''
  if (!code.includes('MotionFilm')) return null

  let covered: string | null = null
  try {
    const Babel = await import('@babel/standalone')
    const transform = (Babel as any).transform ?? (Babel as any).default?.transform
    if (typeof transform !== 'function') return null

    const plugin = () => ({
      visitor: {
        JSXElement(path: any) {
          if (covered) return
          const name = path.node?.openingElement?.name
          if (name?.type !== 'JSXIdentifier' || name.name !== 'MotionFilm') return
          // The children only: the film itself is a MotionFilm and a walk that
          // started at the element would report the film as its own intruder.
          covered = pictureIn(path.node.children || [])
        },
      },
    })

    transform(code, {
      plugins: [plugin],
      parserOpts: { plugins: ['jsx'] },
      code: false,
      filename: 'mocky-component.jsx',
    })
  } catch {
    return null
  }

  return covered
}
