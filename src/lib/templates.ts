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
] as const satisfies readonly (keyof Screen)[]

export type TemplateScreen = Partial<Pick<Screen, (typeof TEMPLATE_SCREEN_KEYS)[number]>> & { id: string; code: string }

export interface TemplateSettings {
  useBrand?: boolean
  creative?: boolean
  creations?: boolean
  ultra?: ProjectUltra
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
  if (project.creative) settings.creative = true
  if (project.creations) settings.creations = true
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
export function settingsAsProjectFields(settings: TemplateSettings): Pick<Project, 'useBrand' | 'creative' | 'creations' | 'ultra'> {
  return {
    ...(settings.useBrand ? { useBrand: true } : {}),
    ...(settings.creative ? { creative: true } : {}),
    ...(settings.creations ? { creations: true } : {}),
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
