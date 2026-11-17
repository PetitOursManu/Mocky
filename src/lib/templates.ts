/**
 * Project templates: a project kept as the starting point of others.
 *
 * Two kinds of "model" exist and they are not the same thing. A DIRECTION is a
 * DESIGN.md kept in the design library (lib/design.ts) — a look, with no
 * screen. A TEMPLATE is a whole project: its direction, the settings that decide
 * how its next screens are made, and its screens with their code. Both are
 * offered in Media → Design and in the first composer of an empty project.
 *
 * Templates live on the server, per account (server/templates.js), never in the
 * projects blob: they copy every screen's code, and the blob's localStorage
 * budget is already spent by the working copy (V3's reasoning, for versions).
 *
 * What a template carries, and why the rest stays behind:
 *  - the EFFECTIVE direction — the project's own, or the global DESIGN.md it was
 *    following — so a template means the same thing on a browser whose global
 *    document says something else;
 *  - the settings that describe what the project IS: brand use, Créatif,
 *    Creations, Motion Ultra. Not its folder (where the new one goes is decided
 *    when it is made), its branch, campaign, publications or demo scenarios
 *    (each is about that project's own history or content);
 *  - each screen's code and the fields that say what KIND of screen it is and
 *    where it sits (type, page format, fold, device, position, links, route),
 *    plus the pictures it names. Not its notes (private, `lib/screenNotes.ts`),
 *    its quality verdict, its previous code, or its campaign/publication place.
 *
 * Pictures are NOT copied: a screen names `/api/images/<hash>`, the library is
 * content-addressed and that route is public, so the new project shows the same
 * files. A picture deleted from Media later is gone from both, as it already is
 * from every project that uses it.
 */
import { extractProductName, loadDesign } from './design'
import { cleanRules } from './rules'
import { designForProject, newId, normalizeScreen, type Project, type ProjectUltra, type Screen } from './project'

/** The screen fields a template keeps. server/templates.js keeps the same list. */
export const TEMPLATE_SCREEN_KEYS = [
  'id',
  'name',
  'prompt',
  'code',
  'componentName',
  'caps',
  'design',
  'imageHash',
  'imageRole',
  'videoHash',
  'videoFrames',
  'attachedMedia',
  'animations',
  'ultra',
  'theme',
  'page',
  'fold',
  'x',
  'y',
  'w',
  'h',
  'device',
  'links',
  'route',
  'fill',
] as const satisfies readonly (keyof Screen)[]

export type TemplateScreen = Partial<Pick<Screen, (typeof TEMPLATE_SCREEN_KEYS)[number]>> & { id: string; code: string }

export interface TemplateSettings {
  useBrand?: boolean
  brandId?: string
  creative?: boolean
  creations?: boolean
  ultra?: ProjectUltra
  /** The project's rules (lib/rules.ts): what it IS as much as Créatif is. */
  rules?: string
}

export interface ProjectTemplate {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  design?: string
  settings: TemplateSettings
  referenceScreenId?: string
  screens: TemplateScreen[]
  /** The section it is kept under (Media → Design); absent, it stands alone. */
  section?: string
}

/** What the list returns: no code. */
export interface TemplateSummary {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  design?: string
  settings: TemplateSettings
  screenCount: number
  screenNames: string[]
  section?: string
  /** Screens with a picture kept (`templateThumbUrl`), the reference first. Absent on an older server. */
  thumbs?: string[]
}

export type TemplateDraft = Omit<ProjectTemplate, 'id' | 'createdAt' | 'updatedAt'>

/** The global DESIGN.md when it is switched on — what a project without its own direction follows. */
export function activeGlobalDesign(): string | undefined {
  const d = loadDesign()
  return d.enabled && d.markdown.trim() ? d.markdown : undefined
}

/** A project as a template: pure, so the tests can ask what is kept. */
export function templateFromProject(project: Project, name: string, globalDesign?: string): TemplateDraft {
  const screens: TemplateScreen[] = project.screens.map((s) => {
    const out: Record<string, unknown> = {}
    for (const k of TEMPLATE_SCREEN_KEYS) if (s[k] !== undefined) out[k] = s[k]
    return out as TemplateScreen
  })
  const settings: TemplateSettings = {}
  if (project.useBrand) settings.useBrand = true
  if (project.useBrand && project.brandId) settings.brandId = project.brandId
  if (project.creative) settings.creative = true
  if (project.creations) settings.creations = true
  if (project.rules) settings.rules = project.rules
  if (project.ultra) settings.ultra = { count: project.ultra.count, ...(project.ultra.video ? { video: true } : {}) }
  const design = designForProject(project, globalDesign)
  const reference =
    project.referenceScreenId && project.screens.some((s) => s.id === project.referenceScreenId)
      ? project.referenceScreenId
      : undefined
  return {
    name: name.trim() || project.name,
    ...(design ? { design } : {}),
    settings,
    ...(reference ? { referenceScreenId: reference } : {}),
    screens,
  }
}

/**
 * A template's screens with FRESH ids, and every reference between them moved
 * along: a link's target, and the shared-layout reference. A link to a screen
 * the template does not hold is dropped rather than left pointing at another
 * project's screen.
 */
export function instantiateScreens(
  template: Pick<ProjectTemplate, 'screens' | 'referenceScreenId'>,
  idOf: () => string = newId,
  now: number = Date.now(),
): { screens: Screen[]; referenceScreenId?: string } {
  const ids = new Map<string, string>()
  for (const s of template.screens) ids.set(s.id, idOf())
  const screens = template.screens.map((s, i) => {
    const base = normalizeScreen({ ...s, id: ids.get(s.id), createdAt: now }, i)
    return {
      ...base,
      links: base.links
        .filter((l) => ids.has(l.target))
        .map((l) => ({ ...l, id: idOf(), target: ids.get(l.target) as string })),
    }
  })
  const referenceScreenId = template.referenceScreenId ? ids.get(template.referenceScreenId) : undefined
  return { screens, ...(referenceScreenId ? { referenceScreenId } : {}) }
}

/** The settings of a template as Project fields. */
export function settingsAsProjectFields(settings: TemplateSettings): Pick<Project, 'useBrand' | 'brandId' | 'creative' | 'creations' | 'ultra' | 'rules'> {
  return {
    ...(settings.useBrand ? { useBrand: true } : {}),
    ...(settings.useBrand && settings.brandId ? { brandId: settings.brandId } : {}),
    ...(settings.creative ? { creative: true } : {}),
    ...(settings.creations ? { creations: true } : {}),
    ...(cleanRules(settings.rules) ? { rules: cleanRules(settings.rules) } : {}),
    ...(settings.ultra ? { ultra: { count: settings.ultra.count === 6 ? 6 : 3, ...(settings.ultra.video ? { video: true } : {}) } } : {}),
  }
}

/** A new project made from a template. Fresh ids throughout; nothing of the source project's history. */
export function projectFromTemplate(
  template: ProjectTemplate,
  opts: { name?: string; folderId?: string | null; folderLabel?: string; now?: number; idOf?: () => string } = {},
): Project {
  const now = opts.now ?? Date.now()
  const idOf = opts.idOf ?? newId
  const { screens, referenceScreenId } = instantiateScreens(template, idOf, now)
  const design = template.design && template.design.trim() ? template.design : undefined
  const productName = design ? extractProductName(design) : null
  return {
    id: idOf(),
    name: (opts.name ?? template.name).trim() || template.name,
    createdAt: now,
    updatedAt: now,
    screens,
    ...(referenceScreenId ? { referenceScreenId } : {}),
    ...(opts.folderId ? { folderId: opts.folderId, ...(opts.folderLabel ? { folder: opts.folderLabel } : {}) } : {}),
    ...(design ? { design } : {}),
    ...(productName ? { productName } : {}),
    ...settingsAsProjectFields(template.settings || {}),
  }
}

// ---------------------------------------------------------------------------
// Calls. Plain fetch, like lib/versions.ts: the server's `error` is the sentence
// the person should read.

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

export async function listTemplates(): Promise<TemplateSummary[]> {
  const out = await call<{ templates: TemplateSummary[] }>('/api/templates')
  return Array.isArray(out.templates) ? out.templates : []
}

export async function getTemplate(id: string): Promise<ProjectTemplate> {
  return (await call<{ template: ProjectTemplate }>(`/api/templates/${encodeURIComponent(id)}`)).template
}

export async function saveTemplate(draft: TemplateDraft): Promise<TemplateSummary> {
  return (await call<{ template: TemplateSummary }>('/api/templates', json('POST', draft))).template
}

export async function renameTemplate(id: string, name: string): Promise<TemplateSummary> {
  return (await call<{ template: TemplateSummary }>(`/api/templates/${encodeURIComponent(id)}`, json('PATCH', { name }))).template
}

export async function deleteTemplate(id: string): Promise<void> {
  await call(`/api/templates/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function setTemplateSection(id: string, section: string): Promise<TemplateSummary> {
  return (await call<{ template: TemplateSummary }>(`/api/templates/${encodeURIComponent(id)}`, json('PATCH', { section }))).template
}

/** Renames a section on every template that carries it; `to: ''` dissolves it. */
export async function renameTemplateSection(from: string, to: string): Promise<number> {
  return (await call<{ moved: number }>('/api/templates/sections/rename', json('POST', { from, to }))).moved
}

/** Keeps the pictures of a template's screens (base64 JPEG, without the `data:` prefix). */
export async function putTemplateThumbs(id: string, thumbs: Record<string, string>): Promise<TemplateSummary> {
  return (await call<{ template: TemplateSummary }>(`/api/templates/${encodeURIComponent(id)}/thumbs`, json('PUT', { thumbs }))).template
}

/** Where a template screen's picture is read; `v` changes the address when the template does. */
export function templateThumbUrl(id: string, screenId: string, v?: number): string {
  return `/api/templates/${encodeURIComponent(id)}/thumbs/${encodeURIComponent(screenId)}${v ? `?v=${v}` : ''}`
}

export interface TemplateSection {
  name: string
  templates: TemplateSummary[]
}

/**
 * The templates by section, sections in alphabetical order and each one's
 * templates newest first (the list's own order); the ones in no section come
 * last, under `loose`.
 */
export function templateSections(list: TemplateSummary[]): { sections: TemplateSection[]; loose: TemplateSummary[] } {
  const by = new Map<string, TemplateSummary[]>()
  const loose: TemplateSummary[] = []
  for (const t of list) {
    const name = t.section?.trim()
    if (!name) loose.push(t)
    else by.set(name, [...(by.get(name) ?? []), t])
  }
  const sections = [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map(([name, templates]) => ({ name, templates }))
  return { sections, loose }
}

/** Space left between two templates' screens when a section is laid out on one canvas. */
export const SECTION_GAP = 240

/**
 * A whole section as ONE template, to fill a project with all of it.
 *
 * Each template's screens keep their places relative to one another and the
 * templates are laid side by side, left to right in the section's order, so
 * nothing lands on top of anything. The direction, the settings and the
 * reference screen are the FIRST template's: a project has one of each, and the
 * first is the one the person sees first in the section. Screen ids are made
 * unique per template, because two templates saved from copies of one project
 * share them, and a link stays inside its own template.
 */
export function mergeTemplates(templates: ProjectTemplate[], name: string): ProjectTemplate {
  const first = templates[0]
  const screens: TemplateScreen[] = []
  let left = 0
  templates.forEach((tpl, k) => {
    const prefix = `k${k}-`
    const xs = tpl.screens.map((s) => s.x ?? 0)
    const minX = xs.length ? Math.min(...xs) : 0
    const maxX = tpl.screens.length ? Math.max(...tpl.screens.map((s) => (s.x ?? 0) + (s.w ?? 1440))) : 0
    for (const s of tpl.screens) {
      screens.push({
        ...s,
        id: prefix + s.id,
        x: (s.x ?? 0) - minX + left,
        ...(s.links ? { links: s.links.map((l) => ({ ...l, target: prefix + l.target })) } : {}),
      })
    }
    left += maxX - minX + SECTION_GAP
  })
  const now = Date.now()
  return {
    id: first?.id ?? 'section',
    name,
    createdAt: now,
    updatedAt: now,
    ...(first?.design ? { design: first.design } : {}),
    settings: first?.settings ?? {},
    ...(first?.referenceScreenId ? { referenceScreenId: `k0-${first.referenceScreenId}` } : {}),
    screens,
  }
}
