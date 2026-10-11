import type { Screen } from './project'

/**
 * Working prototypes — the parent's half of `capabilities/snippets/Flow.ts`.
 *
 * Three jobs, all pure so they can be tested without a frame:
 *
 *  1. READ a screen's code for what it says about the flow — the routes it
 *     opens (`MockyFlow.go("cart")`, `<FlowLink to="cart">`) and the shared
 *     data it keeps (`useFlowState("cart", [])` and the calls that write it).
 *     With Babel, never a regular expression (I1): a route inside a comment or
 *     a string that merely mentions `MockyFlow.go` is not a link.
 *  2. RESOLVE a route to a screen of the project, for the demo.
 *  3. Decide which routes nobody answers yet — the screens Mocky creates on
 *     its own after a generation (`pipeline/flowCompanions.ts`) — and describe
 *     each one to the model that will write it.
 *
 * Plus the demo's SCENARIOS: a named starting screen and starting data,
 * recorded from a demo in progress ("signed in, two items in the cart").
 */

/** How many screens one generation may create on its own, all depths together. */
export const MAX_COMPANIONS = 3

/** How long a route may be. */
export const ROUTE_MAX = 40

/** A route as the model writes it and the demo compares it: lowercase, kebab-case, no accents. */
export function slugRoute(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, ROUTE_MAX)
    .replace(/-+$/g, '')
}

/** A place in the code that opens a route, with the words the visitor clicks. */
export interface FlowLinkUse {
  route: string
  /** The visible text of the element that triggers it, when there is one. */
  label?: string
}

/** A piece of shared data the code keeps. */
export interface FlowKeyUse {
  key: string
  /** The initial value, as written. */
  initial?: string
  /** A few of the calls that write it, as written — how the data is SHAPED. */
  writes: string[]
}

export interface FlowReading {
  links: FlowLinkUse[]
  keys: FlowKeyUse[]
}

const EMPTY: FlowReading = { links: [], keys: [] }

/** A string literal, or a template with no expression in it; null otherwise. */
function literal(node: any): string | null {
  if (!node) return null
  if (node.type === 'StringLiteral') return String(node.value)
  if (node.type === 'TemplateLiteral' && node.expressions?.length === 0) {
    return node.quasis?.map((q: any) => q.value?.cooked ?? '').join('') ?? null
  }
  if (node.type === 'JSXExpressionContainer') return literal(node.expression)
  return null
}

/** The visible words of a JSX element, flattened and trimmed. */
function textOf(node: any, out: string[] = []): string[] {
  if (!node) return out
  if (node.type === 'JSXText') {
    const s = String(node.value).replace(/\s+/g, ' ').trim()
    if (s) out.push(s)
  } else if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
    for (const c of node.children ?? []) textOf(c, out)
  } else if (node.type === 'JSXExpressionContainer' && node.expression?.type === 'StringLiteral') {
    out.push(String(node.expression.value))
  }
  return out
}

/** Words with the holes an expression left — "Voir le panier ( )" — closed up. */
function tidyLabel(words: string): string {
  return words.replace(/[([{]\s*[)\]}]/g, '').replace(/\s+([),.!?:;])/g, '$1').replace(/\s+/g, ' ').trim()
}

function cap(text: string, n: number): string {
  const s = text.replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

/**
 * What a screen's code says about the flow. Never throws: code that does not
 * parse (a half-streamed answer) reads as saying nothing.
 */
export async function readFlow(code: string): Promise<FlowReading> {
  if (!code || !(code.includes('MockyFlow') || code.includes('FlowLink') || code.includes('useFlowState'))) return EMPTY
  const links: FlowLinkUse[] = []
  const keys = new Map<string, FlowKeyUse>()
  const setters = new Map<string, string>()
  /** Every call to a plain identifier, kept until the setters are all known. */
  const calls: { name: string; text: string }[] = []
  try {
    const Babel = await import('@babel/standalone')
    const transform = (Babel as any).transform ?? (Babel as any).default?.transform
    if (typeof transform !== 'function') return EMPTY

    const labelAround = (path: any): string | undefined => {
      const el = path.findParent?.((p: any) => p.isJSXElement?.())
      const words = el ? tidyLabel(textOf(el.node).join(' ')) : ''
      return words ? cap(words, 60) : undefined
    }

    const plugin = () => ({
      visitor: {
        CallExpression(path: any) {
          const { callee, arguments: args } = path.node
          // MockyFlow.go("route")
          if (
            callee?.type === 'MemberExpression' &&
            callee.object?.type === 'Identifier' &&
            callee.object.name === 'MockyFlow' &&
            (callee.property?.name === 'go' || callee.property?.value === 'go')
          ) {
            const route = literal(args?.[0])
            if (route && slugRoute(route)) links.push({ route: slugRoute(route), label: labelAround(path) })
            return
          }
          // A setter may be called above its own declaration in source order
          // (inside a handler defined earlier), so every call is kept and
          // sorted out once all the declarations have been seen.
          if (callee?.type === 'Identifier' && callee.name !== 'useFlowState' && typeof path.node.start === 'number' && calls.length < 500) {
            calls.push({ name: callee.name, text: code.slice(path.node.start, path.node.end) })
          }
          // useFlowState("key", initial)
          if (callee?.type === 'Identifier' && callee.name === 'useFlowState') {
            const key = literal(args?.[0])
            if (!key) return
            const init = args?.[1]
            const rec = keys.get(key) ?? { key, writes: [] }
            if (init && rec.initial === undefined && typeof init.start === 'number') {
              rec.initial = cap(code.slice(init.start, init.end), 200)
            }
            keys.set(key, rec)
            // const [cart, setCart] = useFlowState("cart", [])
            const decl = path.parent
            if (decl?.type === 'VariableDeclarator' && decl.id?.type === 'ArrayPattern') {
              const setter = decl.id.elements?.[1]
              if (setter?.type === 'Identifier') setters.set(setter.name, key)
            }
          }
        },
        JSXOpeningElement(path: any) {
          const name = path.node?.name
          if (name?.type !== 'JSXIdentifier' || name.name !== 'FlowLink') return
          for (const attr of path.node.attributes ?? []) {
            if (attr?.type !== 'JSXAttribute' || attr.name?.name !== 'to') continue
            const route = literal(attr.value)
            if (route && slugRoute(route)) {
              const words = tidyLabel(textOf(path.parent).join(' '))
              links.push({ route: slugRoute(route), ...(words ? { label: cap(words, 60) } : {}) })
            }
          }
        },
      },
    })
    transform(code, { plugins: [plugin], parserOpts: { plugins: ['jsx'] }, code: false, filename: 'mocky-flow.jsx' })
    for (const c of calls) {
      const rec = setters.has(c.name) ? keys.get(setters.get(c.name) as string) : undefined
      if (rec && rec.writes.length < 3) rec.writes.push(cap(c.text, 240))
    }
  } catch {
    return EMPTY
  }
  // One entry per route, first label kept.
  const seen = new Map<string, FlowLinkUse>()
  for (const l of links) {
    const prev = seen.get(l.route)
    if (!prev) seen.set(l.route, l)
    else if (!prev.label && l.label) prev.label = l.label
  }
  return { links: [...seen.values()], keys: [...keys.values()] }
}

/**
 * The screen a route opens, or null. In order: a screen that declares the
 * route; a screen whose NAME is the route once slugged ("Panier" for "panier");
 * a screen whose name starts with it. Documents are never a page of a flow.
 */
export function resolveRoute(screens: Pick<Screen, 'id' | 'name' | 'route' | 'page'>[], route: string): string | null {
  const r = slugRoute(route)
  if (!r) return null
  // A screen still being written answers too: it is the page, it is coming.
  const live = screens.filter((s) => !s.page)
  const byRoute = live.find((s) => s.route && slugRoute(s.route) === r)
  if (byRoute) return byRoute.id
  const byName = live.find((s) => slugRoute(s.name) === r)
  if (byName) return byName.id
  const byPrefix = live.find((s) => slugRoute(s.name).startsWith(r + '-'))
  return byPrefix ? byPrefix.id : null
}

/** Every route the project's screens already answer to, for the model's list. */
export function knownRoutes(screens: Pick<Screen, 'route' | 'page'>[]): string[] {
  return [...new Set(screens.filter((s) => !s.page && s.route).map((s) => slugRoute(s.route as string)).filter(Boolean))]
}

/** The routes a reading opens that no screen answers, in the order they appear. */
export function missingRoutes(
  screens: Pick<Screen, 'id' | 'name' | 'route' | 'page'>[],
  reading: FlowReading,
): FlowLinkUse[] {
  return reading.links.filter((l) => !resolveRoute(screens, l.route))
}

/**
 * The route a screen answers to when it opens a flow and has none: "home" for
 * the first one to need it, then its name. The companions it creates link back
 * to it with this name.
 */
export function routeFor(screen: Pick<Screen, 'id' | 'name' | 'route'>, screens: Pick<Screen, 'id' | 'route'>[]): string {
  if (screen.route && slugRoute(screen.route)) return slugRoute(screen.route)
  const taken = new Set(screens.filter((s) => s.id !== screen.id && s.route).map((s) => slugRoute(s.route as string)))
  if (!taken.has('home')) return 'home'
  const base = slugRoute(screen.name).split('-').slice(0, 3).join('-') || 'page'
  let r = base
  for (let i = 2; taken.has(r); i++) r = `${base}-${i}`
  return r
}

/**
 * What the model writing a companion screen is told about its place in the
 * flow — in English, like every other instruction section, and as DATA: the
 * labels and the snippets are the origin screen's own words and code.
 */
export function companionSection(input: {
  route: string
  originName: string
  originRoute: string
  label?: string
  reading: FlowReading
  routes: string[]
}): string {
  const lines = [
    'PROTOTYPE FLOW — THE PLACE OF THIS SCREEN:',
    `This screen is the page with route "${input.route}" of a clickable prototype. Other screens open it with MockyFlow.go("${input.route}").`,
    `It is reached from the screen "${input.originName}" (route "${input.originRoute}")${input.label ? `, by the element labelled "${input.label}"` : ''}. Link back to it with MockyFlow.go("${input.originRoute}") where a visitor would expect to go back.`,
  ]
  if (input.reading.keys.length) {
    lines.push('That screen keeps this SHARED data. Read what this page needs with useFlowState, with EXACTLY these keys and shapes, and handle the empty case:')
    for (const k of input.reading.keys) {
      lines.push(`- "${k.key}"${k.initial ? `, initially ${k.initial}` : ''}${k.writes.length ? `; written as: ${k.writes.join(' | ')}` : ''}`)
    }
  }
  const others = input.routes.filter((r) => r !== input.route)
  if (others.length) lines.push(`Routes that already exist in this prototype: ${others.map((r) => `"${r}"`).join(', ')}. Prefer them; a new route makes Mocky create another screen.`)
  lines.push('Keep the product name, the header and the navigation of the reference screen: it is the same site.')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Scenarios

/** A way to start the demo: a screen, and the shared data as it should be. */
export interface DemoScenario {
  id: string
  name: string
  startScreenId: string
  state: Record<string, unknown>
  createdAt: number
}

export const SCENARIO_NAME_MAX = 60
export const SCENARIOS_MAX = 20
/** The data a scenario starts with, serialised. A cart, a user — never a database. */
export const SCENARIO_STATE_MAX_BYTES = 64 * 1024

/**
 * What a demo hands from one screen to the next. Larger than a scenario's — it
 * is never stored — but bounded: it is written into every srcDoc the demo
 * builds, and a frame that filled it in a loop must not make each page heavier.
 */
export const FLOW_STATE_MAX_BYTES = 512 * 1024

/** A state that survives JSON and fits `maxBytes` (a scenario's, by default), or null. */
export function cleanFlowState(raw: unknown, maxBytes = SCENARIO_STATE_MAX_BYTES): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  try {
    const text = JSON.stringify(raw)
    if (new TextEncoder().encode(text).length > maxBytes) return null
    const back = JSON.parse(text)
    return back && typeof back === 'object' && !Array.isArray(back) ? back : null
  } catch {
    return null
  }
}

/** Stored scenarios, validated, or undefined when none survive. */
export function normalizeScenarios(raw: unknown): DemoScenario[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: DemoScenario[] = []
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue
    const r = s as Partial<DemoScenario>
    const name = typeof r.name === 'string' ? r.name.replace(/\s+/g, ' ').trim().slice(0, SCENARIO_NAME_MAX) : ''
    const state = cleanFlowState(r.state ?? {})
    if (!name || typeof r.id !== 'string' || typeof r.startScreenId !== 'string' || !state) continue
    out.push({ id: r.id, name, startScreenId: r.startScreenId, state, createdAt: typeof r.createdAt === 'number' ? r.createdAt : 0 })
    if (out.length >= SCENARIOS_MAX) break
  }
  return out.length ? out : undefined
}

/**
 * What the flow state should be embedded as, inside a `<script>` of the
 * srcDoc. The values were written by generated code, so they are escaped like
 * any untrusted text going into a script: a `</script>` in a product name must
 * stay a string.
 */
export function flowStateScript(state: Record<string, unknown> | undefined): string {
  const clean = cleanFlowState(state ?? {}, FLOW_STATE_MAX_BYTES) ?? {}
  return JSON.stringify(clean)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

// ---------------------------------------------------------------------------
// The composer's switch, and the names of the pages it creates

const FLOWS_KEY = 'mocky.flows'

/**
 * Whether new screens are pages of a working prototype. ON unless switched
 * off: decided with the user — the pages a flow needs are made automatically.
 * Browser-wide, like the Muse switch.
 */
export function loadFlowsOn(): boolean {
  try {
    return localStorage.getItem(FLOWS_KEY) !== '0'
  } catch {
    return true
  }
}

export function saveFlowsOn(on: boolean): void {
  try {
    localStorage.setItem(FLOWS_KEY, on ? '1' : '0')
  } catch {
    /* private mode: the switch lasts as long as the page */
  }
}

/**
 * The name a page created for a route is given: the person's word for the
 * usual pages ("Panier" for `cart`), the route itself, capitalised, otherwise.
 * The model writes routes in English; the canvas speaks the person's language.
 */
export function flowScreenName(route: string, t: (key: string) => string): string {
  const r = slugRoute(route)
  const key = `flows.route.${r}`
  const known = t(key)
  if (known && known !== key) return known
  const words = r.replace(/-/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : route
}
