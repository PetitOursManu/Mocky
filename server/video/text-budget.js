// How much a film may SAY, counted — for a film that is one element of a page.
//
// ── Why this is a count and not a sentence in the prompt ─────────────────────
//
// The prompt said "one idea per scene" and "never take a block because it is in
// the list", and films still came back with a strong opening — a 3D world, a
// set piece — followed by two scenes presenting the products, the plans and the
// prices the page's own brief described. The brief a page film is composed from
// IS the page's brief, so it is full of exactly that material, and a model asked
// to make a film "about" it retells it. Two things are wrong with that film, and
// the second is the one a person cannot fix: it spends the viewer's attention on
// text the page already sets beside it, and it BURNS INTO AN MP4 facts that the
// page will change next month — a film nobody re-renders when an offer does.
//
// So the kind carries a word budget (`MOTION_KIND_SPECS[kind].words`), the card
// prints it, and this file counts every line of every block against it. Over
// budget, the model is shown the count and asked again — the one correction the
// composer already gives a refused document, and never a repair made here: which
// line is the strongest one is the model's call, not a truncation's.
//
// Counted by walking the SCHEMA, not the document: a field is text when zod says
// it is a free string, so an enum value (`display`, `center`) is never a word and
// a twenty-eighth block's text is counted the day it is added. Picture ids are
// strings too, and are named out.
import { BlockSchema } from './timeline.js'
import { MOTION_KIND_SPECS } from './kinds.js'

const OPTIONS = Object.fromEntries(BlockSchema.options.map((opt) => [opt.shape.kind._def.value, opt]))
const NOT_TEXT = new Set(['kind', 'imageId', 'imageIds'])

function unwrap(schema) {
  let node = schema
  for (;;) {
    const kind = node?._def?.typeName
    if (kind === 'ZodDefault' || kind === 'ZodOptional' || kind === 'ZodNullable') node = node._def.innerType
    else return node
  }
}

/** Every free string under a value, read through the schema that validated it. */
function stringsOf(value, schema) {
  const node = unwrap(schema)
  switch (node?._def?.typeName) {
    case 'ZodString':
      return typeof value === 'string' ? [value] : []
    case 'ZodArray':
      return Array.isArray(value) ? value.flatMap((item) => stringsOf(item, node._def.type)) : []
    case 'ZodObject': {
      if (!value || typeof value !== 'object') return []
      const shape = node.shape
      return Object.keys(shape)
        .filter((key) => !NOT_TEXT.has(key))
        .flatMap((key) => stringsOf(value[key], shape[key]))
    }
    default:
      return []
  }
}

/** Words, as a reader counts them: runs holding a letter or a digit. */
export function wordCount(text) {
  return String(text ?? '')
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length
}

/** The lines of text one block carries. */
export function layerText(layer) {
  const option = OPTIONS[layer?.kind]
  return option ? stringsOf(layer, option) : []
}

/** Every word of a film, and where they are. */
export function filmWords(timeline) {
  const scenes = Array.isArray(timeline?.scenes) ? timeline.scenes : []
  const byScene = scenes.map((scene) =>
    (Array.isArray(scene?.layers) ? scene.layers : []).reduce(
      (sum, layer) => sum + layerText(layer).reduce((n, line) => n + wordCount(line), 0),
      0,
    ),
  )
  return { total: byScene.reduce((a, b) => a + b, 0), byScene }
}

/** A price, in any of the currencies a brief is likely to write one in. */
const PRICE = /[€$£¥₹]|\b\d+(?:[.,]\d+)?\s?(?:eur|euros?|usd|dollars?)\b|\/\s?(?:mois|month|mo|an|year|yr)\b/i

/**
 * What is wrong with a page film's TEXT, as the validator's own kind of issue.
 *
 * Empty when the film has no kind — a film composed freely from the export panel
 * answers a brief somebody wrote for that film, and that brief is allowed to ask
 * for words. The price check has the same scope and one more reason: a price is
 * the plainest case of a fact the page will change after the film is rendered.
 *
 * @returns {Array<{path: string, message: string}>}
 */
export function textBudgetIssues(timeline, kind) {
  const spec = MOTION_KIND_SPECS[kind]
  if (!spec || typeof spec.words !== 'number') return []
  const issues = []
  const scenes = Array.isArray(timeline?.scenes) ? timeline.scenes : []
  scenes.forEach((scene, i) => {
    ;(Array.isArray(scene?.layers) ? scene.layers : []).forEach((layer, j) => {
      if (layerText(layer).some((line) => PRICE.test(line))) {
        issues.push({
          path: `scenes.${i}.layers.${j}`,
          message:
            'this block states a price. A film is rendered once and nobody re-renders it when an offer changes; ' +
            'the page states prices, plans and offers in text it can edit. Remove it.',
        })
      }
    })
  })
  const { total, byScene } = filmWords(timeline)
  if (total > spec.words) {
    const worst = byScene.indexOf(Math.max(...byScene))
    issues.push({
      path: 'scenes',
      message:
        spec.words === 0
          ? `this film carries ${total} words, and a "${kind}" film carries none: the page sets its own words ` +
            'on top of it. Keep the motion and remove every block that sets text.'
          : `this film carries ${total} words of text and a "${kind}" film carries at most ${spec.words} — the ` +
            `page around it already says the rest, and scene ${worst + 1} alone has ${byScene[worst]}. Keep the ` +
            'strongest line and cut the others; a scene that only explained something goes, and the scene before ' +
            'it holds longer on its motion instead. No product, plan, price, feature or date from the brief.',
    })
  }
  return issues
}

/**
 * What is wrong with a film's LOOP.
 *
 * One rule, and it is the whole cost of `mirror`: a film that plays backwards
 * has no words. A headline that types itself and then un-types reads as broken
 * software, not as a loop — and unlike the word budget this is not a matter of
 * degree, so it is checked on every film rather than only on a film with a kind.
 *
 * Asked at the same two doors as everything else here: `/compose`, where the
 * model gets one correction, and `/render`, because a document need never have
 * passed through `/compose`.
 *
 * @returns {Array<{path: string, message: string}>}
 */
export function loopIssues(timeline) {
  if (timeline?.loop !== 'mirror') return []
  const { total } = filmWords(timeline)
  if (total === 0) return []
  return [
    {
      path: 'loop',
      message:
        `this film loops by playing backwards, and it carries ${total} words. Text that un-types reads as a ` +
        'broken player rather than as a loop. Either keep the loop and drop the words — a band or a backdrop ' +
        'is usually better without them — or set the loop to "blend", which dissolves the end into the ' +
        'beginning and works with words.',
    },
  ]
}
