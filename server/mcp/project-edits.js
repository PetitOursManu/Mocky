/**
 * What an assistant changes in a project WITHOUT a model: its name, its art
 * direction and rules, a screen's name, a copy of a screen, a screen removed —
 * and the two ends of editing a template (open it as a project, write the
 * project back into it).
 *
 * Pure functions over plain records, so the tests can ask exactly what each one
 * keeps. Written on the server rather than in the runner because none of them
 * needs a browser: a rename that waited for Chromium to start would take longer
 * than the conversation that asked for it. What reaches the account goes
 * through the same merge as every other writer (server/merge.js, `writeProject`
 * in server/index.js), so a tab that has the project open is told and reads it
 * back.
 *
 * Each one mirrors what the same click does in Mocky, and says where:
 *  - a removed screen leaves a tombstone in `removedScreens`, un-pins itself
 *    as the reference and stops being a link target (`removeScreen` in
 *    src/lib/project.ts) — without the tombstone, the merge's union hands the
 *    screen back from any copy that still has it;
 *  - a copy has no links and no notes (`duplicateScreen` in ProjectView: a
 *    copy that inherited them would drive the original's demo, or read as
 *    already reviewed), and lands to the right of everything, which cannot
 *    collide with anything;
 *  - `cleanRules` and `productNameOf` are hand-kept mirrors of lib/rules.ts and
 *    lib/design.ts's `extractProductName`, for the reason server/merge.js is
 *    one: the server cannot import a .ts file at the 22.12 floor.
 */
import crypto from 'node:crypto'

export const PROJECT_NAME_MAX = 120
export const SCREEN_NAME_MAX = 120
/** A project's own DESIGN.md — the same ceiling as a template's direction. */
export const PROJECT_DESIGN_MAX_BYTES = 128 * 1024
/** lib/rules.ts */
export const RULES_MAX = 1200
export const RULES_MAX_LINES = 20
/** Space between a copy and the rightmost screen — lib/project.ts's GAP_X. */
const GAP_X = 400

/** The screen fields a template keeps — server/templates.js and lib/templates.ts keep the same list. */
const TEMPLATE_SCREEN_KEYS = [
  'id', 'name', 'prompt', 'code', 'componentName', 'caps', 'design', 'imageHash', 'imageRole', 'videoHash', 'videoFrames',
  'attachedMedia', 'animations', 'ultra', 'theme', 'page', 'fold', 'x', 'y', 'w', 'h', 'device', 'links', 'route', 'fill',
]

/** A fresh id, in the shape lib/project.ts's `newId` makes. */
export const newId = () => crypto.randomBytes(8).toString('hex')

export const cleanName = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** Mirror of lib/rules.ts `cleanRules`. */
export function cleanRules(v) {
  if (typeof v !== 'string') return undefined
  const lines = v
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, RULES_MAX_LINES)
  const out = lines.join('\n').slice(0, RULES_MAX)
  return out || undefined
}

/** Mirror of lib/design.ts `extractProductName`. */
export function productNameOf(markdown) {
  if (!markdown) return null
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex((l) => /^##[ \t]*Product[ \t]*$/i.test(l))
  if (start === -1) return null
  let line = null
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##[ \t]/.test(lines[i])) break
    const cleaned = lines[i].replace(/^[\s>*+-]+/, '').replace(/[*_`]/g, '').trim()
    if (cleaned) {
      line = cleaned
      break
    }
  }
  if (!line) return null
  const name = line.split(/\s+[—–-]\s+|\.\s|:\s/)[0].trim()
  if (!name || name.length > 40) return null
  if (/^not established/i.test(name)) return null
  return name
}

/** The account's own DESIGN.md when it is switched on (the runner's `globalDesignFrom`). */
export function globalDesignOf(raw) {
  if (!raw) return undefined
  try {
    const d = JSON.parse(raw)
    return d && d.enabled === true && typeof d.markdown === 'string' && d.markdown.trim() ? d.markdown : undefined
  } catch {
    return undefined
  }
}

const screensOf = (p) => (Array.isArray(p?.screens) ? p.screens : [])
const touched = (p, now) => ({ ...p, updatedAt: now })

export function renameProject(project, name, now = Date.now()) {
  const clean = cleanName(name, PROJECT_NAME_MAX)
  if (!clean) return null
  return { ...touched(project, now), name: clean }
}

/**
 * The project's own direction and rules. `design: null` (or '') goes back to
 * following the account's DESIGN.md, as "Use the global one" does; `rules: null`
 * (or '') removes them. A field left undefined is not touched.
 */
export function setProjectDirection(project, { design, rules } = {}, now = Date.now()) {
  const next = touched(project, now)
  if (design !== undefined) {
    const md = typeof design === 'string' && design.trim() ? design : undefined
    if (md && Buffer.byteLength(md, 'utf8') > PROJECT_DESIGN_MAX_BYTES) return null
    if (md) {
      next.design = md
      const product = productNameOf(md)
      if (product) next.productName = product
      else delete next.productName
    } else {
      delete next.design
      delete next.productName
      // What the direction was last brought up to date from no longer applies.
      delete next.designSync
    }
  }
  if (rules !== undefined) {
    const clean = cleanRules(rules ?? '')
    if (clean) next.rules = clean
    else delete next.rules
  }
  return next
}

export function renameScreen(project, screenId, name, now = Date.now()) {
  const clean = cleanName(name, SCREEN_NAME_MAX)
  if (!clean || !screensOf(project).some((s) => s?.id === screenId)) return null
  return { ...touched(project, now), screens: screensOf(project).map((s) => (s?.id === screenId ? { ...s, name: clean } : s)) }
}

/** A copy beside the screen: no links, no notes, nothing of its review. Answers the project and the copy. */
export function duplicateScreen(project, screenId, { id = newId(), name, now = Date.now() } = {}) {
  const screens = screensOf(project)
  const source = screens.find((s) => s?.id === screenId)
  if (!source) return null
  // eslint-disable-next-line no-unused-vars
  const { id: _id, x: _x, y: _y, links: _links, userNotes: _notes, ...rest } = source
  const right = screens.reduce((m, s) => Math.max(m, (Number(s?.x) || 0) + (Number(s?.w) || 1440)), 0)
  const copy = {
    ...rest,
    id,
    name: cleanName(name, SCREEN_NAME_MAX) || cleanName(`${source.name || 'Screen'} (copy)`, SCREEN_NAME_MAX),
    createdAt: now,
    links: [],
    x: right + GAP_X,
    y: Number(source.y) || 0,
  }
  return { project: { ...touched(project, now), screens: [...screens, copy] }, screen: copy }
}

/** The screen gone, as the canvas's Delete does it — with the tombstone the merge needs. */
export function deleteScreen(project, screenId, now = Date.now()) {
  const screens = screensOf(project)
  if (!screens.some((s) => s?.id === screenId)) return null
  const next = {
    ...touched(project, now),
    screens: screens
      .filter((s) => s?.id !== screenId)
      .map((s) => (Array.isArray(s?.links) && s.links.some((l) => l?.target === screenId) ? { ...s, links: s.links.filter((l) => l?.target !== screenId) } : s)),
    removedScreens: { ...(project.removedScreens || {}), [screenId]: now },
  }
  if (next.referenceScreenId === screenId) delete next.referenceScreenId
  return next
}

/**
 * A template opened to be EDITED: a project like "New project from this
 * template" makes (lib/templates.ts `projectFromTemplate`), with fresh ids and
 * the links moved along — plus `templateId`, which is what makes "Update the
 * template" write back to it.
 */
export function projectEditingTemplate(template, { idOf = newId, now = Date.now(), folderId } = {}) {
  const ids = new Map()
  const tplScreens = Array.isArray(template?.screens) ? template.screens : []
  for (const s of tplScreens) ids.set(s.id, idOf())
  const screens = tplScreens.map((s) => ({
    ...s,
    id: ids.get(s.id),
    createdAt: now,
    links: (Array.isArray(s.links) ? s.links : []).filter((l) => ids.has(l?.target)).map((l) => ({ ...l, id: idOf(), target: ids.get(l.target) })),
  }))
  const design = typeof template.design === 'string' && template.design.trim() ? template.design : undefined
  const product = design ? productNameOf(design) : null
  const st = template.settings || {}
  const rules = cleanRules(st.rules)
  const reference = template.referenceScreenId ? ids.get(template.referenceScreenId) : undefined
  return {
    id: idOf(),
    name: cleanName(template.name, PROJECT_NAME_MAX) || 'Template',
    createdAt: now,
    updatedAt: now,
    screens,
    templateId: template.id,
    ...(reference ? { referenceScreenId: reference } : {}),
    ...(folderId ? { folderId } : {}),
    ...(design ? { design } : {}),
    ...(product ? { productName: product } : {}),
    ...(st.useBrand ? { useBrand: true } : {}),
    ...(st.useBrand && st.brandId ? { brandId: st.brandId } : {}),
    ...(st.creative ? { creative: true } : {}),
    ...(st.creations ? { creations: true } : {}),
    ...(rules ? { rules } : {}),
    ...(st.ultra ? { ultra: { count: st.ultra.count === 6 ? 6 : 3, ...(st.ultra.video ? { video: true } : {}) } } : {}),
  }
}

/** A project as a template's content — mirror of lib/templates.ts `templateFromProject`, name aside. */
export function templateContentFromProject(project, globalDesign) {
  const screens = screensOf(project).map((s) => {
    const out = {}
    for (const k of TEMPLATE_SCREEN_KEYS) if (s?.[k] !== undefined) out[k] = s[k]
    return out
  })
  const settings = {}
  if (project.useBrand) settings.useBrand = true
  if (project.useBrand && project.brandId) settings.brandId = project.brandId
  if (project.creative) settings.creative = true
  if (project.creations) settings.creations = true
  if (project.rules) settings.rules = project.rules
  if (project.ultra) settings.ultra = { count: project.ultra.count, ...(project.ultra.video ? { video: true } : {}) }
  const own = typeof project.design === 'string' && project.design.trim() ? project.design : undefined
  const design = own ?? (globalDesign && globalDesign.trim() ? globalDesign : undefined)
  const reference = project.referenceScreenId && screens.some((s) => s.id === project.referenceScreenId) ? project.referenceScreenId : undefined
  return { ...(design ? { design } : {}), settings, ...(reference ? { referenceScreenId: reference } : {}), screens }
}
