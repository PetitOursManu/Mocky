import { SCENE3D_PRESETS } from '../capabilities/snippets/Scene3D'

/**
 * What a generated page already draws in three dimensions.
 *
 * WHY THE FILM NEEDS THIS
 *
 * A page can carry its own WebGL scene now (`<Scene3D preset>`), and the film
 * composed FOR that page knew nothing about it. A real screen came back with a
 * tunnel of points behind its content and a film whose ground was the
 * continuous 3D world with an orbiting particle field over it: two unrelated
 * three-dimensional things on one screen, neither aware of the other. The
 * composer cannot see the page — it only ever reads the page's own prompt — so
 * the page's scenes are read HERE and travel as data (see `compose.js`, which
 * prints them and narrows `world` away when one is full-bleed).
 *
 * WHAT TRAVELS, AND WHAT DELIBERATELY DOES NOT
 *
 * The preset NAME and one boolean. No colours: the film already carries the
 * project's theme, attached server-side after validation, and the direction
 * extract drops every hex for the same reason — a colour repeated into a prompt
 * buys nothing and invites the refusal that costs a whole paid call.
 *
 * WHY AN AST AND NOT A REGEX
 *
 * Invariant I1, and the same argument `stripMotion.ts` makes one file over: a
 * regex for `<Scene3D` matches inside a string, inside a comment and inside the
 * code fence of a screen that happens to DOCUMENT the component. Babel already
 * compiles this source; asking it what the source *is* costs one parse.
 */
export interface PageScene {
  /** A name from the closed preset list — an unknown one resolves the way the component does. */
  preset: string
  /** Positioned out of the flow: a SURFACE the page's words stand on, rather than an object beside them. */
  backdrop: boolean
}

/** At most this many travel: a page with more is a page whose film cannot fix it. */
const MAX_SCENES = 3

/** The same fallback `<Scene3D>` applies to a preset it cannot draw — a page shows an orb, so the film is told an orb. */
function resolvePreset(value: string): string {
  return (SCENE3D_PRESETS as readonly string[]).includes(value) ? value : 'orb'
}

/** The backdrop test `<Scene3D>` itself uses — absolute or fixed, never relative or sticky. */
const BACKDROP = /(^|\s)(absolute|fixed)(\s|$)/

function literalOf(node: any): string | null {
  const value = node?.value
  if (!value) return null
  if (value.type === 'StringLiteral') return String(value.value)
  // `className={"…"}` and `className={`…`}` — a template with no expression in it.
  if (value.type === 'JSXExpressionContainer') {
    const inner = value.expression
    if (inner?.type === 'StringLiteral') return String(inner.value)
    if (inner?.type === 'TemplateLiteral' && inner.expressions?.length === 0) {
      return inner.quasis?.map((q: any) => q.value?.cooked ?? '').join('') || null
    }
  }
  return null
}

/**
 * The `<Scene3D>` elements in a generated screen, as names.
 *
 * Never throws and never guesses: a file Babel cannot parse, or a build with no
 * Babel, yields an empty list, and a film composed without this knowledge is the
 * film that was composed before this existed (Q1).
 */
export async function pageScenesIn(code: string): Promise<PageScene[]> {
  if (!code || !code.includes('Scene3D')) return []
  const out: PageScene[] = []
  try {
    const Babel = await import('@babel/standalone')
    const transform = (Babel as any).transform ?? (Babel as any).default?.transform
    if (typeof transform !== 'function') return []

    const plugin = () => ({
      visitor: {
        JSXOpeningElement(path: any) {
          if (out.length >= MAX_SCENES) return
          const name = path.node?.name
          if (name?.type !== 'JSXIdentifier' || name.name !== 'Scene3D') return
          let preset = ''
          let className = ''
          for (const attr of path.node.attributes ?? []) {
            if (attr?.type !== 'JSXAttribute') continue
            const key = attr.name?.name
            if (key === 'preset') preset = literalOf(attr) ?? ''
            if (key === 'className') className = literalOf(attr) ?? ''
          }
          out.push({ preset: resolvePreset(preset.trim()), backdrop: BACKDROP.test(className) })
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
    return []
  }
  return out.slice(0, MAX_SCENES)
}
