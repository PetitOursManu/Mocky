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

/** Covering its whole container, which is what makes a layer a background rather than an element. */
const FULL_BLEED = /(^|\s)inset-0(\s|$)/

/**
 * Tailwind's animation utilities — how a page animates a background with no 3D
 * at all: `animate-pulse` on a full-bleed gradient, `animate-[aurora_12s_…]`, a
 * drifting blur. A film composed as a SECOND animated background is the same
 * mistake whether the first one is WebGL or CSS.
 */
const ANIMATED = /(^|\s)animate-[[a-z]/

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
export interface Page3D {
  /** The `<Scene3D>` elements, in source order, at most three. */
  scenes: PageScene[]
  /**
   * The page already animates its own background — a `<Scene3D>` laid out as a
   * surface, or a full-bleed layer carrying a CSS animation.
   *
   * It was read by the automatic film decision (removed in 2026-09, with the
   * composer's animation switch): a film composed as a BACKGROUND for a page
   * that has one is the second animated background on that screen, and a
   * visitor has no way to tell which of the two is the site. Kept because it is
   * cheap and true, and the next thing that places a film will want it. The user's own words for it:
   * "si le LLM a déjà fait un fond animé, pas besoin de dire à Motion d'en
   * refaire un".
   */
  animatedBackdrop: boolean
}

/**
 * Everything the film needs to know about the page's own moving parts.
 *
 * One parse for both answers — the scenes for the composer, the backdrop for
 * the decision that comes before it.
 */
export async function readPage3D(code: string): Promise<Page3D> {
  if (!code || !(code.includes('Scene3D') || code.includes('animate-'))) {
    return { scenes: [], animatedBackdrop: false }
  }
  const out: PageScene[] = []
  let animatedBackdrop = false
  try {
    const Babel = await import('@babel/standalone')
    const transform = (Babel as any).transform ?? (Babel as any).default?.transform
    if (typeof transform !== 'function') return { scenes: [], animatedBackdrop: false }

    const plugin = () => ({
      visitor: {
        JSXOpeningElement(path: any) {
          const name = path.node?.name
          const tag = name?.type === 'JSXIdentifier' ? String(name.name) : ''
          let preset = ''
          let className = ''
          for (const attr of path.node.attributes ?? []) {
            if (attr?.type !== 'JSXAttribute') continue
            const key = attr.name?.name
            if (key === 'preset') preset = literalOf(attr) ?? ''
            if (key === 'className') className = literalOf(attr) ?? ''
          }
          const surface = BACKDROP.test(className)
          if (tag === 'Scene3D') {
            if (surface) animatedBackdrop = true
            if (out.length < MAX_SCENES) {
              out.push({ preset: resolvePreset(preset.trim()), backdrop: surface })
            }
            return
          }
          // A background the page animates in CSS counts for exactly as much:
          // it is already the moving thing behind the words.
          if (surface && FULL_BLEED.test(className) && ANIMATED.test(className)) animatedBackdrop = true
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
    return { scenes: [], animatedBackdrop: false }
  }
  return { scenes: out.slice(0, MAX_SCENES), animatedBackdrop }
}

/** Just the scenes, for a caller that does not care what else the page animates. */
export async function pageScenesIn(code: string): Promise<PageScene[]> {
  return (await readPage3D(code)).scenes
}
