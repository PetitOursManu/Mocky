/**
 * Plug a rendered film into the background the page kept for it.
 *
 * Motion Ultra's video background is designed BEFORE the film exists: the
 * storyboard picks one section, the page is written with `<Backdrop
 * slot="film" preset="…">` there — a living CSS ground from the first second —
 * and once the local Motion worker has rendered the film, this sets that
 * backdrop's `video` attribute. The CSS layers stay underneath, so the section
 * looks designed while the film loads, and exactly as designed if it never does.
 *
 * Why not the existing film placement: that one is a model call that rewrites
 * the page around a film nobody planned for, with a refusal path for when it
 * puts the film in the wrong place. Here the place was planned, so the write is
 * one attribute at an offset the parser vouched for (I1) — no call, nothing
 * else in the file moves.
 *
 * With one exception, found on a real run: a cinematic hero kept its own
 * full-bleed photograph AFTER the backdrop, so the photograph painted over the
 * film and the film — rendered, plugged, playing — was never seen. A full-bleed
 * `<img>` beside the film slot is therefore folded INTO the backdrop (its `src`
 * becomes `image`, which the backdrop draws under the film) and removed from the
 * section. Same picture, now underneath; still no model call.
 */

export const FILM_SLOT = 'film'

type Edit = { start: number; end: number; text: string }

/** A className string that makes an element cover its whole positioned parent. */
function coversParent(cls: string): boolean {
  const tokens = cls.split(/\s+/)
  return tokens.includes('absolute') && (tokens.includes('inset-0') || (tokens.includes('h-full') && tokens.includes('w-full')))
}

/**
 * The source with the film plugged in, or null when the page has no film slot
 * (the model did not write one, or the source does not parse). Never throws.
 */
export async function plugFilmIntoSlot(source: string, videoUrl: string): Promise<string | null> {
  if (!source || !source.includes('Backdrop')) return null
  const edits: Edit[] = []
  try {
    const Babel = await import('@babel/standalone')
    const transform = Babel.transform ?? (Babel as any).default?.transform
    if (typeof transform !== 'function') return null
    const value = JSON.stringify(videoUrl)
    let done = false
    const attr = (node: any, name: string) =>
      (Array.isArray(node?.attributes) ? node.attributes : []).find((a: any) => a?.type === 'JSXAttribute' && a.name?.name === name)
    const plugin = () => ({
      visitor: {
        JSXElement(path: any) {
          if (done) return
          const opening = path.node?.openingElement
          if (opening?.name?.type !== 'JSXIdentifier' || opening.name.name !== 'Backdrop') return
          const slot = attr(opening, 'slot')
          if (slot?.value?.type !== 'StringLiteral' || slot.value.value !== FILM_SLOT) return
          done = true

          // The film itself.
          const video = attr(opening, 'video')
          if (video && typeof video.start === 'number' && typeof video.end === 'number') {
            edits.push({ start: video.start, end: video.end, text: `video=${value}` })
          } else if (typeof opening.name.end === 'number') {
            edits.push({ start: opening.name.end, end: opening.name.end, text: ` video=${value}` })
          }

          // A full-bleed picture among the backdrop's siblings would paint over
          // the film: fold it into the backdrop instead (see the header).
          const siblings: any[] = Array.isArray(path.parent?.children) ? path.parent.children : []
          for (const sib of siblings) {
            if (sib === path.node || sib?.type !== 'JSXElement') continue
            const o = sib.openingElement
            if (o?.name?.type !== 'JSXIdentifier' || o.name.name !== 'img') continue
            const cls = attr(o, 'className')
            const src = attr(o, 'src')
            if (cls?.value?.type !== 'StringLiteral' || !coversParent(cls.value.value)) continue
            if (src?.value?.type !== 'StringLiteral') continue
            if (typeof sib.start !== 'number' || typeof sib.end !== 'number') continue
            if (!attr(opening, 'image') && typeof opening.name.end === 'number') {
              edits.push({ start: opening.name.end, end: opening.name.end, text: ` image=${JSON.stringify(src.value.value)}` })
            }
            edits.push({ start: sib.start, end: sib.end, text: '' })
            break
          }
        },
      },
    })
    transform(source, {
      plugins: [plugin],
      parserOpts: { plugins: ['jsx'] },
      code: false,
      filename: 'mocky-component.jsx',
    })
  } catch {
    return null
  }
  if (!edits.length) return null
  // Applied from the end, so every earlier offset still points where it did.
  // Two inserts at the same offset keep their written order.
  let out = source
  const ordered = edits.map((e, i) => ({ ...e, i })).sort((a, b) => b.start - a.start || b.i - a.i)
  for (const e of ordered) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  return out
}

/**
 * Which section gets the film, or null when none suits one.
 *
 * Only a section whose recipe is BUILT on a full-bleed ground — a film behind a
 * card grid or a table is a moving picture under text somebody must read — and
 * the first of them in page order, because the opening is where a moving ground
 * earns its minutes of rendering. An application screen gets its one expressive
 * panel, never its shell: a film behind the navigation of a tool someone works
 * in all day is a cost paid on every glance.
 */
export const FILM_RECIPES = [
  'aurora-hero',
  'cinematic-hero',
  'cinematic-cta',
  'parallax-band',
  'spotlight-feature',
  'banner-panel',
] as const

export function filmSectionOf(
  sections: Array<{ id: string; recipe: string }>,
  mode?: string,
): string | null {
  /*
   * On an application screen, only the banner. A real run put the film in a
   * `spotlight-feature` panel halfway down a finance dashboard, under a chart and
   * two figures: a dark film under a dark veil under data, rendered and plugged
   * correctly, and invisible. The one panel an app screen gives to expression is
   * where a moving picture can be seen at all.
   */
  const allowed: readonly string[] = mode === 'operate' ? ['banner-panel'] : FILM_RECIPES
  const hit = sections.find((s) => allowed.includes(s.recipe))
  return hit ? hit.id : null
}
