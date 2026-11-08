/**
 * What a model-made creation is allowed to be, decided without a model.
 *
 * Everything in Mocky's kit is a closed catalogue, and that is what lets it be
 * tested once. A creation is the exception: when the catalogue has no answer, a
 * model may write one. Three of the four kinds stay DATA — a path, or a list of
 * CSS declarations — and the code around them is written by hand in
 * `templates.ts`. Only an `element` is code from a model.
 *
 * WHAT THESE CHECKS ARE, AND WHAT THEY ARE NOT
 *
 * The security boundary is the preview's sandbox: an opaque origin and
 * `connect-src 'none'` (I2). This file is the net in front of it, and it is
 * deny-by-default so a new browser API stays refused without anyone updating a
 * list. It can still be beaten by a determined author (a string assembled at
 * runtime and used as a computed key, say). That is why a creation is never
 * trusted for having passed here, and why it is also reviewed and rendered.
 *
 * AST and not regex (I1): a pattern for `fetch` matches inside a word and misses
 * `window["fe"+"tch"]`.
 */

export const CREATION_KINDS = ['frame', 'animation', 'transition', 'element'] as const
export type CreationKind = (typeof CREATION_KINDS)[number]

export const MAX_ELEMENT_BYTES = 16 * 1024
const MAX_PATH_LEN = 4000

/** Reserved prefix: it can never collide with a snippet's global or a screen's own component (I6). */
export const isCreationName = (name: unknown): name is string =>
  typeof name === 'string' && /^Custom[A-Z][A-Za-z0-9]{1,38}$/.test(name)

// ---- data kinds ------------------------------------------------------------

export function isFramePath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0 || path.length > MAX_PATH_LEN) return false
  if (!/^[Mm][MmLlHhVvCcSsQqTtAaZz0-9 ,.\-]+$/.test(path)) return false
  // Coordinates inside the 0–100 box, with room for a curve's control points.
  return (path.match(/-?\d*\.?\d+/g) ?? []).every((n) => Math.abs(Number(n)) <= 400)
}

const CSS_PROPERTIES = new Set([
  'opacity',
  'transform',
  'filter',
  'clip-path',
  'background-position',
  'letter-spacing',
  'box-shadow',
])
const CSS_FUNCTIONS = new Set([
  'translate', 'translatex', 'translatey', 'translatez', 'translate3d',
  'scale', 'scalex', 'scaley', 'scale3d',
  'rotate', 'rotatex', 'rotatey', 'rotatez', 'rotate3d',
  'skew', 'skewx', 'skewy', 'perspective',
  'blur', 'brightness', 'contrast', 'saturate', 'hue-rotate', 'grayscale', 'sepia',
  'inset', 'circle', 'ellipse', 'polygon',
  'rgb', 'rgba', 'hsl', 'hsla', 'calc',
])

export function isCssValue(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 200) return false
  // Nothing that could close a rule, open a string or name an address.
  if (!/^[a-zA-Z0-9 .,%()#\-+*/]+$/.test(value)) return false
  for (const m of value.matchAll(/([a-zA-Z-]+)\(/g)) {
    if (!CSS_FUNCTIONS.has(m[1].toLowerCase())) return false
  }
  return true
}

export function isDeclarations(style: unknown): style is Record<string, string> {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return false
  const entries = Object.entries(style as Record<string, unknown>)
  if (entries.length === 0 || entries.length > 8) return false
  return entries.every(([k, v]) => CSS_PROPERTIES.has(k) && isCssValue(v))
}

export function isEasing(e: unknown): e is string {
  if (typeof e !== 'string') return false
  return (
    ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'].includes(e) ||
    /^cubic-bezier\(\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*\)$/.test(e)
  )
}

export const isDuration = (ms: unknown): ms is number => typeof ms === 'number' && ms >= 50 && ms <= 20000

export interface Keyframe {
  at: number
  style: Record<string, string>
}

export function keyframesProblem(steps: unknown, iterations: unknown): string | null {
  if (!Array.isArray(steps) || steps.length < 2 || steps.length > 12) return 'steps'
  let last = -1
  for (const s of steps as Keyframe[]) {
    if (!s || typeof s.at !== 'number' || s.at < 0 || s.at > 100 || s.at <= last) return 'steps'
    if (!isDeclarations(s.style)) return 'declarations'
    last = s.at
  }
  if ((steps as Keyframe[])[0].at !== 0 || last !== 100) return 'steps'
  // An entrance ending invisible is a blank screen once it has played.
  if (iterations !== 'infinite' && Number((steps as Keyframe[])[steps.length - 1].style.opacity ?? 1) === 0) return 'rests-invisible'
  return null
}

// ---- code ------------------------------------------------------------------

/** The only globals a creation may read. Anything else is refused. */
const ALLOWED_GLOBALS = new Set([
  'React', 'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useReducer', 'useLayoutEffect', 'useId', 'Fragment',
  'Math', 'Date', 'Number', 'String', 'Boolean', 'Array', 'Object', 'JSON', 'Map', 'Set',
  'undefined', 'NaN', 'Infinity', 'isNaN', 'isFinite', 'parseInt', 'parseFloat',
  'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'IntersectionObserver', 'ResizeObserver', 'matchMedia', 'performance', 'window', 'document',
])

const ALLOWED_MEMBERS: Record<string, Set<string>> = {
  window: new Set([
    'addEventListener', 'removeEventListener', 'innerWidth', 'innerHeight', 'scrollX', 'scrollY', 'devicePixelRatio',
    'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'matchMedia', 'getComputedStyle', '__mockyAnimations', '__mockyStill',
  ]),
  document: new Set(['addEventListener', 'removeEventListener', 'documentElement', 'body', 'hidden', 'visibilityState']),
  Object: new Set(['keys', 'values', 'entries', 'assign', 'freeze']),
}

/** Never readable, on anything: these are how one object reaches the ones it should not. */
const FORBIDDEN_PROPERTIES = new Set([
  'constructor', '__proto__', 'prototype', 'ownerDocument', 'defaultView', 'contentWindow', 'contentDocument',
  'cookie', 'domain', 'referrer', 'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'serviceWorker',
  'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'srcdoc', 'srcDoc', 'postMessage', 'sendBeacon', 'location',
  'parent', 'top', 'opener', 'frames', 'createElement', 'execCommand', 'write', 'writeln', 'open', 'clipboard',
])

const FORBIDDEN_TAGS = new Set(['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'style', 'frame', 'frameset', 'applet'])
const FORBIDDEN_ATTRIBUTES = new Set(['dangerouslySetInnerHTML', 'srcDoc', 'srcdoc', 'action', 'formAction', 'ping'])
const FORBIDDEN_TEXT = /javascript:|data:text\/html|<script|constructor|__proto__|document\.cookie/i

/** Components a creation may use without declaring them: always loaded (`icons` is baseline). */
const KNOWN_COMPONENTS = new Set(['Icon', 'Fragment'])

/** `list[i + 1]` is an index. `a["con" + "structor"]` and a constant holding text are not. */
function isIndexKey(node: any, scope: any): boolean {
  switch (node?.type) {
    case 'NumericLiteral':
      return true
    case 'Identifier': {
      const binding = scope.getBinding(node.name)
      if (!binding) return false
      const init = binding.path.node.init
      return !(init && ['StringLiteral', 'TemplateLiteral', 'BinaryExpression'].includes(init.type))
    }
    case 'BinaryExpression':
      return isIndexKey(node.left, scope) && isIndexKey(node.right, scope)
    case 'UpdateExpression':
    case 'UnaryExpression':
      return isIndexKey(node.argument, scope)
    case 'MemberExpression':
      return !node.computed && node.property?.name === 'length'
    case 'CallExpression':
      return node.callee?.type === 'MemberExpression' && node.callee.object?.name === 'Math'
    default:
      return false
  }
}

export interface CodeCheck {
  ok: boolean
  /** Short, in English: it goes to a log and to a notice, never to a model. */
  problems: string[]
  /** The source as parsed and reprinted, comments gone. What is reviewed and stored. */
  source?: string
}

async function babel(): Promise<any> {
  const Babel = await import('@babel/standalone')
  return (Babel as any).transform ? Babel : (Babel as any).default
}

/** Refuses code that is not one self-contained component using only what is allowed. */
export async function checkElementSource(source: unknown, name: string): Promise<CodeCheck> {
  if (typeof source !== 'string' || !source.trim()) return { ok: false, problems: ['empty'] }
  if (new Blob([source]).size > MAX_ELEMENT_BYTES) return { ok: false, problems: ['too large'] }
  const problems: string[] = []
  const say = (p: string) => {
    if (!problems.includes(p) && problems.length < 20) problems.push(p)
  }
  let normalized: string | undefined
  try {
    const { transform } = await babel()
    const plugin = () => ({
      visitor: {
        Program(path: any) {
          const body = path.node.body
          const only = body.length === 1 ? body[0] : null
          // A declaration and nothing else: it is hoisted, which is what lets
          // `inlineCreations` write it after the screen that uses it.
          const declared = only?.type === 'FunctionDeclaration' && only.id?.name
          if (declared !== name) say(`must declare exactly one component named ${name}`)
        },
        ImportDeclaration: () => say('import'),
        ExportNamedDeclaration: () => say('export'),
        ExportDefaultDeclaration: () => say('export'),
        Import: () => say('dynamic import'),
        ImportExpression: () => say('dynamic import'),
        MetaProperty: () => say('import.meta'),
        ThisExpression: () => say('this'),
        ReferencedIdentifier(path: any) {
          const id = path.node.name
          if (path.scope.hasBinding(id, true)) return
          if (path.isJSXIdentifier?.()) return
          if (!ALLOWED_GLOBALS.has(id)) say(`global: ${id}`)
        },
        MemberExpression(path: any) {
          const { object, property, computed } = path.node
          if (computed) {
            if (property.type === 'StringLiteral') {
              if (FORBIDDEN_PROPERTIES.has(property.value)) say(`property: ${property.value}`)
            } else if (!isIndexKey(property, path.scope)) {
              say('computed access')
            }
            // A root object is never indexed: \`window[x]\` is how the lists below are walked around.
            if (object.type === 'Identifier' && ALLOWED_MEMBERS[object.name]) say(`computed access on ${object.name}`)
            return
          }
          const prop = property.name
          if (FORBIDDEN_PROPERTIES.has(prop)) say(`property: ${prop}`)
          if (object.type === 'Identifier' && ALLOWED_MEMBERS[object.name] && !path.scope.hasBinding(object.name, true) && !ALLOWED_MEMBERS[object.name].has(prop)) {
            say(`${object.name}.${prop}`)
          }
        },
        CallExpression(path: any) {
          const { callee, arguments: args } = path.node
          // A timer given a string is eval under another name.
          if (callee.type === 'Identifier' && ['setTimeout', 'setInterval'].includes(callee.name) && args[0] && args[0].type !== 'ArrowFunctionExpression' && args[0].type !== 'FunctionExpression' && args[0].type !== 'Identifier') {
            say('timer with a string')
          }
        },
        StringLiteral(path: any) {
          if (FORBIDDEN_TEXT.test(path.node.value)) say('suspicious string')
        },
        TemplateElement(path: any) {
          if (FORBIDDEN_TEXT.test(path.node.value.raw)) say('suspicious string')
        },
        JSXOpeningElement(path: any) {
          const n = path.node.name
          if (n.type !== 'JSXIdentifier') {
            say('member tag')
            return
          }
          if (/^[a-z]/.test(n.name)) {
            if (FORBIDDEN_TAGS.has(n.name)) say(`tag: ${n.name}`)
          } else if (!KNOWN_COMPONENTS.has(n.name) && !path.scope.hasBinding(n.name, true)) {
            say(`component: ${n.name}`)
          }
        },
        JSXAttribute(path: any) {
          if (FORBIDDEN_ATTRIBUTES.has(path.node.name?.name)) say(`attribute: ${path.node.name.name}`)
        },
      },
    })
    normalized = transform(source, {
      plugins: [plugin],
      parserOpts: { plugins: ['jsx'] },
      comments: false,
      filename: 'creation.jsx',
    }).code
  } catch {
    return { ok: false, problems: ['does not parse'] }
  }
  return problems.length ? { ok: false, problems } : { ok: true, problems: [], source: normalized }
}

/**
 * A usage example: one element of this creation, with nothing but written
 * values. It is rendered for the test, so it may not carry an address or code.
 */
export async function checkUsage(usage: unknown, name: string): Promise<boolean> {
  if (typeof usage !== 'string' || usage.length === 0 || usage.length > 800) return false
  try {
    const { transform } = await babel()
    let root: string | null = null
    let clean = true
    const plugin = () => ({
      visitor: {
        Program(path: any) {
          const only = path.node.body.length === 1 ? path.node.body[0] : null
          if (only?.type !== 'ExpressionStatement' || only.expression.type !== 'JSXElement') {
            clean = false
            return
          }
          root = only.expression.openingElement.name?.name ?? null
        },
        JSXExpressionContainer: () => {
          clean = false
        },
        JSXSpreadAttribute: () => {
          clean = false
        },
        JSXAttribute(path: any) {
          const attr = path.node.name?.name
          if ((attr === 'src' || attr === 'href') && !String(path.node.value?.value ?? '').startsWith('data:image/')) clean = false
          if (FORBIDDEN_ATTRIBUTES.has(attr)) clean = false
        },
      },
    })
    transform(usage, { plugins: [plugin], parserOpts: { plugins: ['jsx'] }, code: false, filename: 'usage.jsx' })
    return clean && root === name
  } catch {
    return false
  }
}
