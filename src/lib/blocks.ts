/**
 * Reusable blocks: a header, a partner band, a card or a footer kept on its
 * own and put back into other screens, with a change carried to every copy.
 *
 * A block is SOURCE, never a picture and never a model's description: the
 * element's JSX as the screen wrote it, plus the top-level declarations it
 * reads (`const partners = [...]`, `function Logo()`). That is what lets a
 * copy be written with no model call, and what makes the copy the same block
 * rather than something resembling it.
 *
 * A copy is an element carrying `data-mocky-block="<id>:<rev>"`, like a lock
 * (lib/locks.ts) and for the same reason: the attribute travels with the code
 * through versions, templates, copies and Revert with no bookkeeping, and a
 * pass that drops it simply turns the copy back into ordinary code. The rev is
 * two hashes — the JSX's and the declarations' — so a copy can say both "the
 * library has a newer version" (rev differs) and "somebody changed this one by
 * hand" (its own JSX no longer hashes to the first half). The hash is taken on
 * collapsed whitespace and without lock or block attributes, so re-indenting a
 * copy or locking its logo does not count as a change.
 *
 * Everything is read with the parser (I1) and every write is re-parsed before
 * it is trusted, like a removal or a lock: a refusal costs a click, a broken
 * screen costs the screen.
 *
 * What is refused, by name: an element that reads the screen's STATE — a
 * hook's value, a prop, a loop's item. A block that needs `open` from a
 * `useState` three lines above it would be inserted into a screen where `open`
 * means nothing, and the first sign would be a blank preview.
 */

import type { PickedSource } from './screenElements'
import { loadTransform, parses } from './sourceText'
import { hashCode } from './codeHash'
import { detectComponentName } from './generate'
import { LOCK_ATTR } from './locks'

export const BLOCK_ATTR = 'data-mocky-block'

export const BLOCK_KINDS = ['header', 'band', 'card', 'footer', 'other'] as const
export type BlockKind = (typeof BLOCK_KINDS)[number]

/** What a block is made of: the element and what it reads. */
export interface BlockContent {
  jsx: string
  /** Top-level declarations, in the order the source had them. */
  decls: string[]
}

export interface Block extends BlockContent {
  id: string
  name: string
  kind: BlockKind
  rev: string
  /** Where it was saved from, by name, for the list. */
  from?: { project?: string; screen?: string }
  createdAt: number
  updatedAt: number
}

export type BlockDraft = Pick<Block, 'name' | 'kind' | 'jsx' | 'decls' | 'rev' | 'from'>

export type ExtractRefusal = 'unknown' | 'root' | 'loop' | 'local'

export type Extraction =
  | {
      kind: 'ok'
      content: BlockContent
      rev: string
      label: string
      tag: string
      guess: BlockKind
      /** Where the element's attribute goes, in the screen it was read from. */
      nameEnd: number
      /** The element already is a copy: of this block, with this attribute. */
      instance?: { blockId: string; attr: { start: number; end: number } }
    }
  | { kind: 'refused'; reason: ExtractRefusal; names?: string[] }

const BLOCK_ID_RE = /^b[a-f0-9]{24}$/
const ATTR_VALUE_RE = /^(b[a-f0-9]{24}):([0-9a-z]{1,16})\.([0-9a-z]{1,16})$/

// ---------------------------------------------------------------------------
// Hashes

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim()
const shortHash = (s: string) => hashCode(collapse(s)).replace('-', '').slice(0, 16)

/** The JSX half of a rev: what a copy still hashes to when nobody touched it. */
export const jsxHashOf = (jsx: string) => shortHash(jsx)

export function revOf(content: BlockContent): string {
  return `${shortHash(content.jsx)}.${shortHash(content.decls.join('\n'))}`
}

export const attrValue = (blockId: string, rev: string) => `${blockId}:${rev}`

export function readAttrValue(value: string): { blockId: string; rev: string; jsxHash: string } | null {
  const m = ATTR_VALUE_RE.exec(value)
  return m ? { blockId: m[1], rev: `${m[2]}.${m[3]}`, jsxHash: m[2] } : null
}

// ---------------------------------------------------------------------------
// Parsing

interface Parsed {
  program: any
  /** Every JSX element, in the order the preview's ranks count them. */
  els: any[]
}

/** The program with its scopes, and every element. Null when it does not parse. */
async function parse(source: string): Promise<Parsed | null> {
  const transform = await loadTransform().catch(() => null)
  if (!transform) return null
  let out: Parsed | null = null
  try {
    transform(source, {
      plugins: [
        () => ({
          visitor: {
            Program(program: any) {
              const els: any[] = []
              program.traverse({
                JSXOpeningElement(p: any) {
                  els.push(p.parentPath)
                },
              })
              out = { program, els }
            },
          },
        }),
      ],
      parserOpts: { plugins: ['jsx'] },
      code: false,
      filename: 'mocky-block.jsx',
    })
  } catch {
    return null
  }
  return out
}

function tagOf(name: any): string {
  if (!name) return ''
  if (name.type === 'JSXIdentifier') return name.name
  if (name.type === 'JSXMemberExpression') return `${tagOf(name.object)}.${name.property?.name ?? ''}`
  return ''
}

const isMapCallback = (fn: any) => {
  const call = fn?.parentPath
  if (!call?.isCallExpression?.() || fn.key !== 0) return false
  const callee = call.node.callee
  return callee?.type === 'MemberExpression' && ['map', 'flatMap'].includes(callee.property?.name)
}

const inLoop = (path: any) => !!path.findParent((p: any) => p.isFunction() && isMapCallback(p))

/** The capitalized component a path is written in, when it is declared by name. */
function componentOf(path: any): string | null {
  let fn = path.getFunctionParent()
  while (fn) {
    const name = fn.node.id?.name ?? (fn.parentPath?.isVariableDeclarator() ? fn.parentPath.node.id?.name : null)
    if (typeof name === 'string' && /^[A-Z]/.test(name)) return name
    fn = fn.getFunctionParent()
  }
  return null
}

/** The leading whitespace of the line `at` is on. */
function indentAt(source: string, at: number): string {
  const lineStart = source.lastIndexOf('\n', at - 1) + 1
  return /^[ \t]*/.exec(source.slice(lineStart))?.[0] ?? ''
}

/** Lines after the first lose the indentation of the line the text started on. */
function dedent(text: string, base: string): string {
  const lines = text.split('\n')
  if (lines.length === 1) return text
  const rest = lines.slice(1).filter((l) => l.trim())
  let cut = base.length
  for (const l of rest) cut = Math.min(cut, /^[ \t]*/.exec(l)![0].length)
  return [lines[0], ...lines.slice(1).map((l) => l.slice(Math.min(cut, /^[ \t]*/.exec(l)![0].length)))].join('\n')
}

/** Lines after the first gain `indent`. */
const reindent = (text: string, indent: string) =>
  text
    .split('\n')
    .map((l, i) => (i === 0 || !l.trim() ? l : indent + l))
    .join('\n')

interface Span {
  start: number
  end: number
  text: string
}

function splice(source: string, edits: Span[]): string {
  let out = source
  for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  return out
}

/** The lock and block attributes inside a node, leading whitespace included, as cuts. */
function markerCuts(source: string, path: any): Span[] {
  const cuts: Span[] = []
  const take = (a: any) => {
    const name = a.node.name?.name
    if (name !== LOCK_ATTR && name !== BLOCK_ATTR) return
    let start = a.node.start
    while (start > 0 && /[ \t\r\n]/.test(source[start - 1])) start--
    cuts.push({ start, end: a.node.end, text: '' })
  }
  path.traverse({ JSXAttribute: take })
  return cuts
}

/** A node's text, without lock or block attributes, indented as if it began a line. */
function cleanText(source: string, path: any): string {
  const { start, end } = path.node
  const cuts = markerCuts(source, path).map((c) => ({ ...c, start: c.start - start, end: c.end - start }))
  return dedent(splice(source.slice(start, end), cuts), indentAt(source, start))
}

function labelOf(node: any, tag: string): string {
  const words: string[] = []
  const walk = (n: any) => {
    if (!n || words.join(' ').length > 60) return
    if (n.type === 'JSXText') words.push(n.value)
    else if (n.type === 'JSXElement') n.children?.forEach(walk)
    else if (n.type === 'JSXExpressionContainer' && n.expression?.type === 'StringLiteral') words.push(n.expression.value)
  }
  node.children?.forEach(walk)
  const text = words.join(' ').replace(/\s+/g, ' ').trim()
  if (text) return text.length > 40 ? `${text.slice(0, 39)}…` : text
  return tag ? `<${tag}>` : ''
}

function guessKind(tag: string, label: string): BlockKind {
  const t = tag.toLowerCase()
  if (t === 'header' || t === 'nav') return 'header'
  if (t === 'footer') return 'footer'
  if (/partenaire|partner|sponsor/i.test(label)) return 'band'
  return 'other'
}

// ---------------------------------------------------------------------------
// What an element reads

const HOOK_RE = /^use[A-Z]/

function callsHook(path: any): boolean {
  let found = false
  path.traverse({
    CallExpression(p: any) {
      const c = p.node.callee
      const name = c?.type === 'Identifier' ? c.name : c?.type === 'MemberExpression' ? c.property?.name : ''
      if (typeof name === 'string' && HOOK_RE.test(name)) {
        found = true
        p.stop()
      }
    },
  })
  return found
}

const within = (node: any, range: { start: number; end: number }) => node.start >= range.start && node.end <= range.end

interface Needed {
  start: number
  text: string
}

/**
 * The declarations an element (or a declaration) reads, gathered transitively.
 * A top-level one is copied as written; a local `const` of plain data, or a
 * local function that touches no hook, is lifted to the top. Anything else —
 * a hook's value, a parameter, a reassigned `let` — is a name refused.
 */
function gather(source: string, root: any, rootComponent: string): { needed: Needed[]; refused: string[] } {
  const needed = new Map<any, Needed>()
  const refused = new Set<string>()

  const visit = (path: any, range: { start: number; end: number }) => {
    path.traverse({
      ReferencedIdentifier(p: any) {
        const name: string = p.node.name
        const binding = p.scope.getBinding(name)
        if (!binding || binding.kind === 'module') return
        if (within(binding.identifier, range)) return
        if (needed.has(binding.path)) return
        const atTop = binding.scope.block.type === 'Program'
        const bp = binding.path
        if (name === rootComponent && atTop) {
          refused.add(name)
          return
        }
        let text: string | null = null
        if (bp.isVariableDeclarator() && bp.node.id.type === 'Identifier' && bp.node.init) {
          const kind = bp.parentPath.node.kind
          const reassigned = binding.constantViolations.length > 0
          if (atTop || (!reassigned && (kind === 'const' || kind === 'let') && !callsHook(bp))) {
            text = `${atTop ? kind : 'const'} ${cleanText(source, bp)};`
          }
        } else if ((bp.isFunctionDeclaration() || bp.isClassDeclaration()) && (atTop || !callsHook(bp))) {
          text = cleanText(source, bp)
        }
        if (text === null) {
          refused.add(name)
          return
        }
        needed.set(bp, { start: bp.node.start, text })
        visit(bp, { start: bp.node.start, end: bp.node.end })
      },
    })
  }
  visit(root, { start: root.node.start, end: root.node.end })
  return { needed: [...needed.values()].sort((a, b) => a.start - b.start), refused: [...refused] }
}

/** The element a pick names, or, with `instance`, the nearest copy of a block on its way up. */
function pickedPath(parsed: Parsed, chain: PickedSource[] | undefined, instance: boolean): any | null {
  if (!chain?.length) return null
  if (!instance) return parsed.els[chain[0].rank] ?? null
  for (const entry of chain) {
    const p = parsed.els[entry.rank]
    if (p && attrOf(p, BLOCK_ATTR)) return p
  }
  return null
}

function attrOf(path: any, name: string): any | null {
  for (const a of path.node.openingElement?.attributes ?? []) {
    if (a.type === 'JSXAttribute' && a.name?.name === name && a.value?.type === 'StringLiteral') return a
  }
  return null
}

/** The function an element is the returned root of, if it is one. */
function rootOfFunction(path: any): any | null {
  let p = path
  while (p.parentPath?.isParenthesizedExpression?.()) p = p.parentPath
  const parent = p.parentPath
  if (parent?.isReturnStatement()) return parent.getFunctionParent()
  if (parent?.isArrowFunctionExpression() && parent.node.body === p.node) return parent
  return null
}

/**
 * Read the picked element as a block. With `instance`, the copy of a block
 * that holds the pick — what "save the changes to the block" reads.
 */
export async function extractBlock(code: string, chain: PickedSource[] | undefined, opts: { instance?: boolean } = {}): Promise<Extraction> {
  const parsed = await parse(code)
  if (!parsed) return { kind: 'refused', reason: 'unknown' }
  const path = pickedPath(parsed, chain, !!opts.instance)
  if (!path?.isJSXElement?.()) return { kind: 'refused', reason: 'unknown' }
  const rootComponent = detectComponentName(code)

  const fn = rootOfFunction(path)
  if (fn && fn.node === findRootFunction(parsed.program, rootComponent)?.node) {
    return { kind: 'refused', reason: 'root' }
  }
  if (inLoop(path)) return { kind: 'refused', reason: 'loop' }

  const { needed, refused } = gather(code, path, rootComponent)
  if (refused.length) return { kind: 'refused', reason: 'local', names: refused }

  const content: BlockContent = { jsx: cleanText(code, path), decls: needed.map((n) => n.text) }
  const tag = tagOf(path.node.openingElement.name)
  const label = labelOf(path.node, tag)
  const own = attrOf(path, BLOCK_ATTR)
  const read = own ? readAttrValue(own.value.value) : null
  let instance: Extract<Extraction, { kind: 'ok' }>['instance']
  if (own && read) {
    let start = own.start
    while (start > 0 && /\s/.test(code[start - 1])) start--
    instance = { blockId: read.blockId, attr: { start, end: own.end } }
  }
  return {
    kind: 'ok',
    content,
    rev: revOf(content),
    label,
    tag,
    guess: guessKind(tag, label),
    nameEnd: path.node.openingElement.name.end,
    instance,
  }
}

/**
 * Mark the element a block was just read from as a copy of it, so the next
 * change to the block reaches it too. Null when the code moved meanwhile.
 */
export async function markInstance(code: string, extraction: Extract<Extraction, { kind: 'ok' }>, blockId: string, rev: string): Promise<string | null> {
  const attr = ` ${BLOCK_ATTR}="${attrValue(blockId, rev)}"`
  const edit = extraction.instance
    ? { start: extraction.instance.attr.start, end: extraction.instance.attr.end, text: attr }
    : { start: extraction.nameEnd, end: extraction.nameEnd, text: attr }
  const out = splice(code, [edit])
  return (await parses(out)) ? out : null
}

// ---------------------------------------------------------------------------
// Copies in a screen

export interface BlockInstance {
  blockId: string
  rev: string
  start: number
  end: number
  /** Its JSX no longer hashes to what was inserted: somebody changed it here. */
  edited: boolean
  /** It holds a locked element, which an update would overwrite. */
  locked: boolean
}

function instancesIn(code: string, parsed: Parsed): (BlockInstance & { path: any })[] {
  const out: (BlockInstance & { path: any })[] = []
  for (const path of parsed.els) {
    const a = attrOf(path, BLOCK_ATTR)
    const read = a ? readAttrValue(a.value.value) : null
    if (!read) continue
    // A copy inside a copy is the outer block's business.
    if (out.some((o) => within(path.node, o))) continue
    let locked = false
    path.traverse({
      JSXAttribute(p: any) {
        if (p.node.name?.name === LOCK_ATTR) locked = true
      },
    })
    if (attrOf(path, LOCK_ATTR)) locked = true
    out.push({
      blockId: read.blockId,
      rev: read.rev,
      start: path.node.start,
      end: path.node.end,
      edited: jsxHashOf(cleanText(code, path)) !== read.jsxHash,
      locked,
      path,
    })
  }
  return out
}

/** Every copy of a block in a screen, outermost only. Null when it does not parse. */
export async function blockInstances(code: string): Promise<BlockInstance[] | null> {
  const parsed = await parse(code)
  if (!parsed) return null
  return instancesIn(code, parsed).map(({ path: _path, ...rest }) => rest)
}

/** The copy of a block that holds the picked element, if any. */
export async function instanceAt(code: string, chain: PickedSource[] | undefined): Promise<BlockInstance | null> {
  const parsed = await parse(code)
  const path = parsed && pickedPath(parsed, chain, true)
  if (!parsed || !path) return null
  const { path: _path, ...found } = instancesIn(code, parsed).find((i) => i.start === path.node.start) ?? { path: null }
  return 'blockId' in found ? (found as BlockInstance) : null
}

/** The copies of `block` in a screen that the library has moved past. */
export const behind = (instances: BlockInstance[], block: Pick<Block, 'id' | 'rev'>) =>
  instances.filter((i) => i.blockId === block.id && i.rev !== block.rev)

// ---------------------------------------------------------------------------
// Placing a block

function findRootFunction(program: any, name: string): any | null {
  const binding = program.scope.getBinding(name)
  const bp = binding?.path
  if (!bp) return null
  if (bp.isFunctionDeclaration()) return bp
  if (bp.isVariableDeclarator()) {
    const init = bp.get('init')
    if (init.isFunction()) return init
  }
  return null
}

/** The statement a component is declared in, so declarations go just above it. */
function statementOf(program: any, name: string): any | null {
  const fn = findRootFunction(program, name)
  return fn ? fn.findParent((p: any) => p.parentPath?.isProgram()) ?? (fn.parentPath?.isProgram() ? fn : null) : null
}

/** The JSX a component returns, unwrapped. */
function returnedElement(fn: any): any | null {
  if (!fn) return null
  const unwrap = (p: any) => {
    while (p?.isParenthesizedExpression?.()) p = p.get('expression')
    return p?.isJSXElement?.() || p?.isJSXFragment?.() ? p : null
  }
  if (fn.isArrowFunctionExpression() && !fn.get('body').isBlockStatement()) return unwrap(fn.get('body'))
  let found: any = null
  fn.traverse({
    ReturnStatement(p: any) {
      if (p.getFunctionParent() !== fn) return
      const el = unwrap(p.get('argument'))
      if (el) found = el
    },
  })
  return found
}

const elementChildren = (path: any) =>
  (path.get('children') as any[]).filter((c) => c.isJSXElement() || c.isJSXFragment() || c.isJSXExpressionContainer())

/** A declaration as `placeBlock` compares it: what it declares and how it reads. */
function topLevelDecls(source: string, program: any): Map<string, string> {
  const out = new Map<string, string>()
  for (const [name, binding] of Object.entries<any>(program.scope.bindings)) {
    const bp = binding.path
    if (bp.isVariableDeclarator() && bp.node.init) out.set(name, collapse(`${bp.parentPath.node.kind} ${cleanText(source, bp)};`))
    else if (bp.isFunctionDeclaration() || bp.isClassDeclaration()) out.set(name, collapse(cleanText(source, bp)))
  }
  return out
}

function declaredAnywhere(program: any): Set<string> {
  const names = new Set<string>(Object.keys(program.scope.bindings))
  program.traverse({
    Scopable(p: any) {
      for (const n of Object.keys(p.scope.bindings)) names.add(n)
    },
  })
  return names
}

function freshName(base: string, taken: Set<string>): string {
  for (let n = 2; ; n++) {
    const name = `${base}${n}`
    if (!taken.has(name)) return name
  }
}

interface Prepared {
  jsx: string
  decls: string[]
}

/**
 * The block made ready for one screen: its declarations renamed where the
 * screen already uses a name for something else, the ones the screen already
 * has word for word dropped, and the copy's attribute on its root.
 */
async function prepare(block: Pick<Block, 'id' | 'rev' | 'jsx' | 'decls'>, target: string, targetProgram: any): Promise<Prepared | null> {
  const PREFIX = '\n\nconst __mockyBlock = (\n'
  const pieces = [...block.decls]
  const offsets: number[] = []
  let module = ''
  for (const d of pieces) {
    if (module) module += '\n\n'
    offsets.push(module.length)
    module += d
  }
  module += PREFIX
  const jsxAt = module.length
  module += block.jsx + '\n)\n'
  const parsed = await parse(module)
  if (!parsed) return null

  const existing = topLevelDecls(target, targetProgram)
  const inTarget = declaredAnywhere(targetProgram)
  const taken = new Set([...inTarget, ...Object.keys(parsed.program.scope.bindings)])

  const edits: Span[] = []
  const drop = new Set<number>()
  for (const [name, binding] of Object.entries<any>(parsed.program.scope.bindings)) {
    if (name === '__mockyBlock') continue
    const bp = binding.path
    const statement = bp.isVariableDeclarator() ? bp.parentPath : bp
    const index = offsets.findIndex((o, i) => statement.node.start >= o && (i + 1 === offsets.length || statement.node.start < offsets[i + 1]))
    const own = bp.isVariableDeclarator()
      ? collapse(`${bp.parentPath.node.kind} ${module.slice(bp.node.start, bp.node.end)};`)
      : collapse(module.slice(bp.node.start, bp.node.end))
    if (existing.get(name) === own) {
      if (index >= 0) drop.add(index)
      continue
    }
    if (!inTarget.has(name)) continue
    const to = freshName(name, taken)
    taken.add(to)
    const seen = new Set<number>()
    const rename = (node: any, parent?: any) => {
      if (seen.has(node.start)) return
      seen.add(node.start)
      if (parent?.type === 'ObjectProperty' && parent.shorthand && parent.value === node) {
        edits.push({ start: node.start, end: node.end, text: `${name}: ${to}` })
      } else edits.push({ start: node.start, end: node.end, text: to })
    }
    rename(binding.identifier)
    for (const ref of binding.referencePaths) {
      rename(ref.node, ref.parent)
      if (ref.isJSXIdentifier() && ref.parentPath.isJSXOpeningElement()) {
        const closing = ref.parentPath.parentPath.node.closingElement
        if (closing?.name?.type === 'JSXIdentifier') rename(closing.name)
      }
    }
  }

  // The copy's attribute, after the root element's name.
  const root = parsed.program.scope.getBinding('__mockyBlock')?.path.get('init')
  let el = root
  while (el?.isParenthesizedExpression?.()) el = el.get('expression')
  if (!el?.isJSXElement?.()) return null
  const nameEnd = el.node.openingElement.name.end
  edits.push({ start: nameEnd, end: nameEnd, text: ` ${BLOCK_ATTR}="${attrValue(block.id, block.rev)}"` })

  const renamed = splice(module, edits)
  // Splitting back: every edit before a piece's start shifted it.
  const shift = (at: number) => edits.filter((e) => e.start < at).reduce((s, e) => s + e.text.length - (e.end - e.start), 0)
  const decls: string[] = []
  pieces.forEach((d, i) => {
    if (drop.has(i)) return
    const start = offsets[i] + shift(offsets[i])
    const end = offsets[i] + d.length + shift(offsets[i] + d.length)
    decls.push(renamed.slice(start, end))
  })
  const jsxStart = jsxAt + shift(jsxAt)
  const jsxEnd = jsxAt + block.jsx.length + shift(jsxAt + block.jsx.length)
  return { jsx: renamed.slice(jsxStart, jsxEnd), decls }
}

type Anchor = { start: number; end: number; indent: string; mode: 'replace' | 'after' }

/** Write a block at each anchor, its declarations above the screen's component. */
async function place(
  code: string,
  block: Pick<Block, 'id' | 'rev' | 'jsx' | 'decls'>,
  anchorsOf: (parsed: Parsed, rootComponent: string) => Anchor[] | null,
): Promise<string | null> {
  const parsed = await parse(code)
  if (!parsed) return null
  const rootComponent = detectComponentName(code)
  const anchors = anchorsOf(parsed, rootComponent)
  if (!anchors?.length) return null
  const ready = await prepare(block, code, parsed.program)
  if (!ready) return null

  const edits: Span[] = anchors.map((a) => {
    const jsx = reindent(ready.jsx, a.indent)
    if (a.mode === 'replace') return { start: a.start, end: a.end, text: jsx }
    return { start: a.start, end: a.start, text: `\n${a.indent}${jsx}` }
  })
  if (ready.decls.length) {
    const statement = statementOf(parsed.program, rootComponent)
    const first = parsed.program.node.body.find((s: any) => s.type !== 'ImportDeclaration')
    const node = statement?.node ?? first
    const at = node ? (node.leadingComments?.[0]?.start ?? node.start) : code.length
    edits.push({ start: at, end: at, text: ready.decls.join('\n\n') + '\n\n' })
  }
  const out = splice(code, edits)
  return (await parses(out)) ? out : null
}

export type InsertRefusal = 'unknown' | 'empty'

/**
 * Put a block into a screen: after the picked element (or the nearest element
 * above it that a sibling can follow — not inside a loop, not inside a helper
 * component the screen draws several times), or, with no pick, at the end of
 * the screen's root, inside its last page on a document.
 */
export async function insertBlock(
  code: string,
  block: Pick<Block, 'id' | 'rev' | 'jsx' | 'decls'>,
  chain?: PickedSource[],
): Promise<{ code: string } | { refused: InsertRefusal }> {
  if (!block.jsx.trim()) return { refused: 'empty' }
  const out = await place(code, block, (parsed, rootComponent) => {
    for (const entry of chain ?? []) {
      const p = parsed.els[entry.rank]
      if (!p?.isJSXElement?.()) continue
      const parent = p.parentPath
      if (!(parent?.isJSXElement() || parent?.isJSXFragment())) continue
      if (inLoop(p) || componentOf(p) !== rootComponent) continue
      return [{ start: p.node.end, end: p.node.end, indent: indentAt(code, p.node.start), mode: 'after' }]
    }
    let root = returnedElement(findRootFunction(parsed.program, rootComponent))
    if (!root) return null
    // A document's root is its <Doc>: a block goes on the last page, not after it.
    for (;;) {
      const kids = elementChildren(root)
      const last = kids[kids.length - 1]
      if (last?.isJSXElement() && /^(Page|Panel)$/.test(tagOf(last.node.openingElement.name))) root = last
      else break
    }
    const kids = elementChildren(root)
    const last = kids[kids.length - 1]
    if (last) return [{ start: last.node.end, end: last.node.end, indent: indentAt(code, last.node.start), mode: 'after' }]
    if (root.isJSXElement() && root.node.openingElement.selfClosing) return null
    const opening = root.isJSXElement() ? root.node.openingElement : root.node.openingFragment
    return [{ start: opening.end, end: opening.end, indent: indentAt(code, root.node.start) + '  ', mode: 'after' }]
  })
  return out ? { code: out } : { refused: 'unknown' }
}

/**
 * Bring a screen's copies of `block` up to the library's version. A copy that
 * holds a locked element is left as it is: an update would overwrite the lock,
 * and a lock is the person saying "not this one". Top-level declarations only
 * the old copies used go with them, so an update that renamed or dropped one
 * leaves no dead constant behind.
 */
export async function refreshInstances(
  code: string,
  block: Pick<Block, 'id' | 'rev' | 'jsx' | 'decls'>,
): Promise<{ code: string; updated: number; locked: number } | null> {
  const parsed = await parse(code)
  if (!parsed) return null
  const all = instancesIn(code, parsed).filter((i) => i.blockId === block.id && i.rev !== block.rev)
  const todo = all.filter((i) => !i.locked)
  const locked = all.length - todo.length
  if (!todo.length) return { code, updated: 0, locked }

  const referencedBefore = new Set(
    Object.entries<any>(parsed.program.scope.bindings)
      .filter(([, b]) => b.referencePaths.length > 0)
      .map(([n]) => n),
  )
  const indents = todo.map((i) => indentAt(code, i.start))
  let work = splice(
    code,
    todo.map((i, n) => ({ start: i.start, end: i.end, text: `<mockyblockslot${n} />` })),
  )

  // What only the old copies read goes with them.
  const rootComponent = detectComponentName(code)
  for (let pass = 0; pass < 6; pass++) {
    const p = await parse(work)
    if (!p) return null
    const cuts: Span[] = []
    for (const [name, b] of Object.entries<any>(p.program.scope.bindings)) {
      if (name === rootComponent || !referencedBefore.has(name) || b.referencePaths.length > 0) continue
      const bp = b.path
      const statement = bp.isVariableDeclarator() ? (bp.parentPath.node.declarations.length === 1 ? bp.parentPath : null) : bp
      if (!statement?.parentPath?.isProgram()) continue
      const node = statement.node
      let end = node.end
      while (end < work.length && /[ \t\r\n]/.test(work[end])) end++
      cuts.push({ start: node.start, end, text: '' })
    }
    if (!cuts.length) break
    work = splice(work, cuts)
  }

  const out = await place(work, block, (p) => {
    const anchors: Anchor[] = []
    for (const el of p.els) {
      const m = /^mockyblockslot(\d+)$/.exec(tagOf(el.node.openingElement.name))
      if (m) anchors.push({ start: el.node.start, end: el.node.end, indent: indents[Number(m[1])] ?? '', mode: 'replace' })
    }
    return anchors.length === todo.length ? anchors : null
  })
  return out ? { code: out, updated: todo.length, locked } : null
}

// ---------------------------------------------------------------------------
// The library, on the server (server/blocks.js)

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', ...init })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
  return body as T
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export function isBlock(raw: unknown): raw is Block {
  const b = raw as Block | null
  return (
    !!b &&
    typeof b === 'object' &&
    BLOCK_ID_RE.test(String(b.id)) &&
    typeof b.name === 'string' &&
    typeof b.jsx === 'string' &&
    Array.isArray(b.decls) &&
    typeof b.rev === 'string'
  )
}

export async function listBlocks(): Promise<Block[]> {
  const out = await call<{ blocks: unknown[] }>('/api/blocks')
  return Array.isArray(out.blocks) ? out.blocks.filter(isBlock) : []
}

export async function createBlock(draft: BlockDraft): Promise<Block> {
  return (await call<{ block: Block }>('/api/blocks', json('POST', draft))).block
}

export async function updateBlock(id: string, patch: Partial<BlockDraft>): Promise<Block> {
  return (await call<{ block: Block }>(`/api/blocks/${encodeURIComponent(id)}`, json('PATCH', patch))).block
}

export async function deleteBlock(id: string): Promise<void> {
  await call(`/api/blocks/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
