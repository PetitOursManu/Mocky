/**
 * The media a brief IMPOSES — the addresses written in the person's own text.
 *
 * Before this, a URL in the prompt reached the model as plain words and met
 * the base rule "do not use <img> with external URLs. Use inline SVG, emoji, or
 * solid-color placeholder divs instead" (generate.ts) — so a brief that came
 * with four sprite sheets and their crop boxes came back as grey boxes, while
 * the preview would have shown the sheets (`img-src *`). Nothing in the engine
 * was missing; the permission was (plans/sites-interactifs.md, §2).
 *
 * Read with no model: an address is either in the text or it is not. Each one
 * is classified by what the preview can do with it, because the answer differs:
 *
 *  - an image is ALLOWED by its exact address, and only that address — the
 *    base rule is narrowed, not lifted, as Muse's slots narrow it (M6);
 *  - a video cannot play in the preview (`media-src` names Mocky's origin), so
 *    the person is told which one, by address, instead of meeting an empty box;
 *  - a script cannot load (`script-src` names Mocky's origin, and the import is
 *    stripped), so the model is told to build with the kit instead;
 *  - a font stylesheet is refused by `style-src`; the catalogue answers.
 *
 * A brief without addresses builds no section, so its prompt is the one it
 * always was.
 */

export type BriefMediaKind = 'image' | 'video' | 'script' | 'font' | 'other'

export interface BriefMedia {
  url: string
  kind: BriefMediaKind
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|svg)$/i
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)$/i
const SCRIPT_EXT = /\.(m?js)$/i
const SCRIPT_HOSTS = /(^|\.)(cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|esm\.sh|skypack\.dev)$/i
const FONT_HOSTS = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|fonts\.google\.com|use\.typekit\.net)$/i

/** At most this many: past it a brief is a dump, and the section would drown the page. */
export const BRIEF_MEDIA_MAX = 24

/** The path an address names, or the one a resizer proxies (`?url=…`). */
function pathsOf(u: URL): string[] {
  const out = [u.pathname]
  for (const key of ['url', 'src', 'image']) {
    const inner = u.searchParams.get(key)
    if (!inner) continue
    try {
      out.push(new URL(inner).pathname)
    } catch {
      /* not an address: ignored */
    }
  }
  return out
}

export function classifyMediaUrl(raw: string): BriefMediaKind {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return 'other'
  }
  if (FONT_HOSTS.test(u.hostname)) return 'font'
  const paths = pathsOf(u)
  if (paths.some((p) => VIDEO_EXT.test(p))) return 'video'
  if (paths.some((p) => IMAGE_EXT.test(p))) return 'image'
  // A resizer that names its output format serves an image whatever the path says.
  if (/^(webp|png|jpe?g|avif|gif)$/i.test(u.searchParams.get('output') ?? u.searchParams.get('format') ?? '')) return 'image'
  if (paths.some((p) => SCRIPT_EXT.test(p)) || SCRIPT_HOSTS.test(u.hostname)) return 'script'
  return 'other'
}

/**
 * Every http(s) address in the text, in order of first appearance, classified.
 * Markdown is the usual wrapping — backticks, table pipes, angle brackets,
 * parentheses — so those end an address, and trailing sentence punctuation is
 * not part of one.
 */
export function extractBriefMedia(text: string): BriefMedia[] {
  const seen = new Set<string>()
  const out: BriefMedia[] = []
  for (const m of text.matchAll(/https?:\/\/[^\s<>"'`|()[\]{}]+/g)) {
    const url = m[0].replace(/[.,;:!?…]+$/, '')
    if (seen.has(url)) continue
    seen.add(url)
    out.push({ url, kind: classifyMediaUrl(url) })
    if (out.length >= BRIEF_MEDIA_MAX) break
  }
  return out
}

/** The section the generation reads, or '' when the brief names no media. */
export function buildBriefMediaSection(media: BriefMedia[]): string {
  const images = media.filter((m) => m.kind === 'image')
  const videos = media.filter((m) => m.kind === 'video')
  const scripts = media.filter((m) => m.kind === 'script')
  const fonts = media.filter((m) => m.kind === 'font')
  if (!images.length && !videos.length && !scripts.length && !fonts.length) return ''
  const lines: string[] = ['MEDIA THE BRIEF IMPOSES — the person wrote these addresses themselves.']
  if (images.length) {
    lines.push(
      'Pictures. Use EACH of these by its EXACT address, wherever the brief says (as a sheet for <SheetCrop> when the brief gives crop boxes, otherwise as <img src>). They override the rule against external images, for these addresses only, and they come BEFORE any generated, stock or placeholder picture: never replace one of them, never re-host, slice or invent another address.',
      ...images.map((m, i) => `${i + 1}. ${m.url}`),
    )
  }
  if (videos.length) {
    lines.push(
      'Videos. The preview cannot play a video from another site: do not put these in a <video>. Where the brief plays one, show the moment it leads to (its first still, a coloured field, or skip straight to what follows) and keep the rest of the page working.',
      ...videos.map((m) => `- ${m.url}`),
    )
  }
  if (scripts.length) {
    lines.push(
      'Libraries. Nothing can be loaded from another site and there is no import: these will NOT be available. Build what they were for with React and the components listed in the capabilities section.',
      ...scripts.map((m) => `- ${m.url}`),
    )
  }
  if (fonts.length) {
    lines.push('Font stylesheets cannot be linked: use the families of the font list by name, the closest one when the brief names one that is not there.')
  }
  return lines.join('\n')
}
