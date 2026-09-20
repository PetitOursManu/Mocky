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
