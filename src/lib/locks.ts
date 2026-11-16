/**
 * Locked elements: a logo, a photo, a block a model must not touch.
 *
 * A lock is an attribute ON the element, `data-mocky-lock="<id>"`, and nothing
 * else — no record on the screen. That is what makes it survive everything a
 * screen goes through without a line of bookkeeping: a direct write (a field
 * filled, a text changed, a picture swapped) splices inside the element and
 * keeps it; a version, a template, a copy and a Revert carry the code and so
 * the lock. An offset or a stored copy of the element would have gone stale at
 * the first of those.
 *
 * What it promises is enforced after a model pass, never trusted to the model.
 * The prompt says it (`lockRule`), and `enforceLocks` then compares each
 * locked element before and after: changed, it is written back as it was;
 * gone, the pass is refused — a lock the model could delete is no lock, and
 * putting an element back somewhere nobody chose is a layout decision. What is
 * kept is the element's SOURCE, which is its content and its own classes; its
 * place on the page also depends on its parent, which a pass may change.
 *
 * Read with the parser (I1). The attribute is harmless in a page — a `data-`
 * attribute renders nothing — so the preview and the exports carry it as is.
 */

import { elementsOf, type PickedSource } from './screenElements'
import { loadTransform, parses } from './sourceText'
import { getLang, translate } from '../i18n'

export const LOCK_ATTR = 'data-mocky-lock'

export interface LockedElement {
  id: string
  /** Offsets of the whole JSX element. */
  start: number
  end: number
  source: string
  tag: string
  /** What a person recognises it by: its words, its alt, or its tag. */
  label: string
}

interface ElementInfo {
  start: number
  end: number
  source: string
  tag: string
  lockId: string | null
  /** The lock attribute's own offsets, leading whitespace included. */
  attr: { start: number; end: number } | null
  /** Where an attribute goes: right after the element's name. */
  nameEnd: number
  label: string
}

function tagOf(name: any): string {
  if (!name) return ''
  if (name.type === 'JSXIdentifier') return name.name
  if (name.type === 'JSXMemberExpression') return `${tagOf(name.object)}.${name.property?.name ?? ''}`
  if (name.type === 'JSXNamespacedName') return `${name.namespace?.name}:${name.name?.name}`
  return ''
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
  for (const a of node.openingElement?.attributes ?? []) {
    const n = a.name?.name
    if ((n === 'alt' || n === 'aria-label' || n === 'title') && a.value?.type === 'StringLiteral' && a.value.value.trim()) {
      return a.value.value.trim().slice(0, 40)
    }
  }
  return `<${tag}>`
}

function infoOf(code: string, path: any): ElementInfo | null {
  const node = path.node
  if (typeof node?.start !== 'number') return null
  const opening = node.openingElement
  const tag = tagOf(opening?.name)
  let lockId: string | null = null
  let attr: ElementInfo['attr'] = null
  for (const a of opening?.attributes ?? []) {
    if (a.type === 'JSXAttribute' && a.name?.name === LOCK_ATTR && a.value?.type === 'StringLiteral') {
      lockId = a.value.value
      let start = a.start
      while (start > 0 && /\s/.test(code[start - 1])) start--
      attr = { start, end: a.end }
    }
  }
  return {
    start: node.start,
    end: node.end,
    source: code.slice(node.start, node.end),
    tag,
    lockId,
    attr,
    nameEnd: opening?.name?.end ?? node.start,
    label: labelOf(node, tag),
  }
}

async function allElements(code: string): Promise<ElementInfo[] | null> {
  const paths = await elementsOf(code)
  if (!paths) return null
  return paths.map((p) => infoOf(code, p)).filter((e): e is ElementInfo => !!e && e.tag !== 'Fragment')
}

/** Every locked element of a source, in source order. Null when it does not parse. */
export async function lockedElements(code: string): Promise<LockedElement[] | null> {
  const all = await allElements(code)
  if (!all) return null
  return all
    .filter((e) => e.lockId)
    .map((e) => ({ id: e.lockId as string, start: e.start, end: e.end, source: e.source, tag: e.tag, label: e.label }))
}

/** The element a pick names: the one clicked, at the head of its chain. */
async function picked(code: string, chain: PickedSource[] | undefined): Promise<ElementInfo | null> {
  if (!chain?.length) return null
  const paths = await elementsOf(code)
  const path = paths?.[chain[0].rank]
  return path ? infoOf(code, path) : null
}

/** Whether the picked element carries a lock. */
export async function isLocked(code: string, chain: PickedSource[] | undefined): Promise<boolean> {
  return !!(await picked(code, chain))?.lockId
}

const newLockId = () => Math.random().toString(36).slice(2, 10)

/**
 * Lock or unlock the picked elements. Returns the new code, or null when none
 * could be found or the write would not parse. Locking an element already
 * locked, or unlocking one that is not, changes nothing.
 */
export async function setLocks(code: string, chains: (PickedSource[] | undefined)[], on: boolean): Promise<string | null> {
  const paths = await elementsOf(code)
  if (!paths) return null
  const edits: { start: number; end: number; text: string }[] = []
  const seen = new Set<number>()
  for (const chain of chains) {
    const path = chain?.length ? paths[chain[0].rank] : null
    const el = path ? infoOf(code, path) : null
    if (!el || seen.has(el.start)) continue
    seen.add(el.start)
    if (on && !el.lockId) edits.push({ start: el.nameEnd, end: el.nameEnd, text: ` ${LOCK_ATTR}="${newLockId()}"` })
    if (!on && el.attr) edits.push({ start: el.attr.start, end: el.attr.end, text: '' })
  }
  if (!edits.length) return seen.size ? code : null
  let out = code
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  return (await parses(out, await loadTransform().catch(() => null))) ? out : null
}

/** The words and names of a source, for telling one element from another once its lock attribute is gone. */
function tokens(source: string): Set<string> {
  return new Set(source.split(/[^\p{L}\p{N}#/._-]+/u).filter((t) => t.length > 1))
}

function similarity(a: string, b: string): number {
  const ta = tokens(a)
  const tb = tokens(b)
  if (!ta.size || !tb.size) return 0
  let common = 0
  for (const t of ta) if (tb.has(t)) common++
  return common / (ta.size + tb.size - common)
}

/** How alike an element must be to be taken for a locked one whose attribute the model dropped. */
const SAME_ELEMENT = 0.5

export interface LockOutcome {
  code: string
  /** Labels of locked elements the pass had changed, written back as they were. */
  restored: string[]
  /** Labels of locked elements the pass removed: the caller refuses the pass. */
  lost: string[]
}

/**
 * Keep every element `before` locks exactly as it was in `after`. Never throws.
 * When `after` cannot be read, it is returned untouched: the caller's own
 * checks are what deal with code that does not parse.
 */
export async function enforceLocks(before: string, after: string): Promise<LockOutcome> {
  const none = { code: after, restored: [], lost: [] }
  if (before === after) return none
  const prev = await lockedElements(before)
  if (!prev?.length) return none
  // A lock inside another is kept by keeping the outer one.
  const outer = prev.filter((l) => !prev.some((o) => o !== l && o.start <= l.start && o.end >= l.end))
  const all = await allElements(after)
  if (!all) return none

  const edits: { start: number; end: number; text: string }[] = []
  const restored: string[] = []
  const lost: string[] = []
  const taken = (s: number, e: number) => edits.some((x) => s < x.end && e > x.start)
  for (const l of outer) {
    let match = all.find((e) => e.lockId === l.id && !taken(e.start, e.end))
    if (!match) {
      // The model may have dropped the attribute while keeping the element:
      // the most similar element of the same kind is taken for it, if it is
      // similar enough to be the same thing.
      let best: ElementInfo | null = null
      let score = SAME_ELEMENT
      for (const e of all) {
        if (e.tag !== l.tag || e.lockId || taken(e.start, e.end)) continue
        const s = similarity(e.source, l.source)
        if (s >= score) {
          best = e
          score = s
        }
      }
      match = best ?? undefined
    }
    if (!match) {
      lost.push(l.label)
      continue
    }
    if (match.source !== l.source) {
      edits.push({ start: match.start, end: match.end, text: l.source })
      restored.push(l.label)
    }
  }
  if (!edits.length) return { code: after, restored, lost }
  let out = after
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  if (!(await parses(out, await loadTransform().catch(() => null)))) return { code: after, restored: [], lost: outer.map((l) => l.label) }
  return { code: out, restored, lost }
}

/** The sentence a model pass is given when the screen has locked elements. Empty when it has none. */
export async function lockRule(code: string): Promise<string> {
  const locks = await lockedElements(code)
  if (!locks?.length) return ''
  return [
    `LOCKED ELEMENTS: every element carrying a ${LOCK_ATTR} attribute is locked by the person. Copy each one character for character — the attribute, its classes, its text and its children included — and keep it in the screen. Change what is around it if you must, never the element itself.`,
    ...locks.map((l) => `- <${l.tag}> “${l.label}”`),
  ].join('\n')
}

export class LockedElementError extends Error {
  constructor(public labels: string[]) {
    super(translate(getLang(), 'lock.lost', { names: labels.join(', ') }))
    this.name = 'LockedElementError'
  }
}
