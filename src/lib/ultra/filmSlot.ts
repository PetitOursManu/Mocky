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
 */

export const FILM_SLOT = 'film'

/**
 * The source with the film plugged in, or null when the page has no film slot
 * (the model did not write one, or the source does not parse). Never throws.
 */
export async function plugFilmIntoSlot(source: string, videoUrl: string): Promise<string | null> {
  if (!source || !source.includes('Backdrop')) return null
  let edit: { start: number; end: number; text: string } | null = null
  try {
    const Babel = await import('@babel/standalone')
    const transform = Babel.transform ?? (Babel as any).default?.transform
    if (typeof transform !== 'function') return null
    const value = JSON.stringify(videoUrl)
    const plugin = () => ({
      visitor: {
        JSXOpeningElement(path: any) {
          if (edit) return
          const node = path.node
          if (node?.name?.type !== 'JSXIdentifier' || node.name.name !== 'Backdrop') return
          const attrs: any[] = Array.isArray(node.attributes) ? node.attributes : []
          const slot = attrs.find((a) => a?.type === 'JSXAttribute' && a.name?.name === 'slot')
          if (slot?.value?.type !== 'StringLiteral' || slot.value.value !== FILM_SLOT) return
          const video = attrs.find((a) => a?.type === 'JSXAttribute' && a.name?.name === 'video')
          if (video && typeof video.start === 'number' && typeof video.end === 'number') {
            edit = { start: video.start, end: video.end, text: `video=${value}` }
          } else if (typeof node.name.end === 'number') {
            edit = { start: node.name.end, end: node.name.end, text: ` video=${value}` }
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
  if (!edit) return null
  const e = edit as { start: number; end: number; text: string }
  return source.slice(0, e.start) + e.text + source.slice(e.end)
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

export function filmSectionOf(sections: Array<{ id: string; recipe: string }>): string | null {
  const hit = sections.find((s) => (FILM_RECIPES as readonly string[]).includes(s.recipe))
  return hit ? hit.id : null
}
