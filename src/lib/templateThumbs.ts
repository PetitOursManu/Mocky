import { captureThumb, getThumb } from './thumbnails'
import { normalizeScreen, type Screen } from './project'
import { getTemplate, putTemplateThumbs, type ProjectTemplate, type TemplateScreen, type TemplateSummary } from './templates'

/**
 * The pictures of a template's screens, so Media and the composer show the
 * screens rather than a name (server/templates.js keeps them beside the file).
 *
 * Taken in the browser like every thumbnail (lib/thumbnails.ts): the cache
 * first, since the screens of a project just saved are usually already
 * photographed, then a capture in an inert frame, one at a time. The reference
 * screen first, then the others in order, at most four. Every failure is
 * swallowed — a missing picture is the card that showed a name, as before.
 */
export const TEMPLATE_THUMBS = 4

const asScreen = (s: TemplateScreen, i: number): Screen => normalizeScreen({ ...s }, i)

function chosenScreens(t: Pick<ProjectTemplate, 'screens' | 'referenceScreenId'>): TemplateScreen[] {
  const ref = t.screens.find((s) => s.id === t.referenceScreenId)
  return [...(ref ? [ref] : []), ...t.screens.filter((s) => s !== ref)].filter((s) => s.code?.trim()).slice(0, TEMPLATE_THUMBS)
}

/** The base64 JPEG of each chosen screen that could be photographed. */
export async function templateThumbs(t: Pick<ProjectTemplate, 'screens' | 'referenceScreenId'>): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const [i, s] of chosenScreens(t).entries()) {
    const url = getThumb(s.id, s.code) ?? (await captureThumb(asScreen(s, i)))
    if (url && url.startsWith('data:image/jpeg;base64,')) out[s.id] = url.slice(url.indexOf(',') + 1)
  }
  return out
}

/** Photograph a saved template's screens and keep the pictures. Null when nothing could be taken or kept. */
export async function saveTemplateThumbs(id: string, t?: ProjectTemplate): Promise<TemplateSummary | null> {
  try {
    const template = t ?? (await getTemplate(id))
    const thumbs = await templateThumbs(template)
    if (!Object.keys(thumbs).length) return null
    return await putTemplateThumbs(id, thumbs)
  } catch {
    return null
  }
}

/**
 * Templates saved before pictures were kept get theirs the first time they are
 * shown: one at a time, and each id tried once per page load, so a screen that
 * cannot be photographed is not retried on every render.
 */
const tried = new Set<string>()
let queue: Promise<unknown> = Promise.resolve()

export function backfillTemplateThumbs(list: TemplateSummary[], onDone: (next: TemplateSummary) => void): void {
  for (const s of list) {
    if (!s.thumbs || s.thumbs.length || !s.screenCount || tried.has(s.id)) continue
    tried.add(s.id)
    queue = queue.then(async () => {
      const next = await saveTemplateThumbs(s.id)
      if (next) onDone(next)
    })
  }
}
