/**
 * The pictures a project's screens already use, offered to its next screen.
 *
 * A picture is made FOR a screen, but it is the project's: the same speaker,
 * the same workshop, the same light. A second screen used to know none of it —
 * the model was never told the pictures existed, so it drew placeholder boxes
 * next to a series of photographs of the very product it was describing, or a
 * new picture of it was paid for. This started with Motion Ultra's series and
 * covers every picture a screen shows now: Muse's, a free photo, a site's
 * replaced pictures, a document's own, one pinned from the library.
 *
 * Read off what the screens SHOW — the library URLs in their code — rather than
 * off what a run remembered, because that is the only record every path keeps:
 * Muse's `imageHash` names an art-direction plate in "inspiration" mode, which
 * no page embeds, and a site's pictures are recorded nowhere else. Motion
 * Ultra's series is added whole, placed or not: it was shot as one set.
 *
 * Preferred, not imposed: the section asks the model to reuse them wherever a
 * picture fits, unless the request says otherwise. No picture is generated
 * here — this costs a library listing and some prompt, nothing else.
 */
import type { Screen } from './project'

/** How many are offered: enough to choose from, few enough not to crowd the prompt. */
export const REUSE_MAX = 8

/**
 * A picture of the account's library, as a page embeds it: `…/api/images/<hash>`,
 * absolute or not. The hash charset is the server's own (`HASH_RE` in
 * server/images/routes.js), and the lookahead keeps `…/<hash>abc` from passing
 * for a shorter one.
 */
const LIBRARY_PICTURE = /\/api\/images\/([a-f0-9]{16,64})(?![a-f0-9])/g

/** Library hashes of the pictures the project's screens use, most recent screen first. */
export function projectPictures(screens: Array<Pick<Screen, 'ultra' | 'createdAt'> & { code?: string }>): string[] {
  const out: string[] = []
  const add = (hash: string) => {
    if (!out.includes(hash)) out.push(hash)
  }
  for (const s of [...screens].sort((a, b) => b.createdAt - a.createdAt)) {
    for (const hash of s.ultra?.images ?? []) add(hash)
    for (const m of (s.code || '').matchAll(LIBRARY_PICTURE)) add(m[1])
  }
  return out.slice(0, REUSE_MAX)
}

/** The generation section listing them, or '' when there are none. */
export function buildReuseSection(pictures: Array<{ url: string; about: string }>): string {
  if (!pictures.length) return ''
  return [
    'PROJECT PICTURES — already used by the other screens of this project. REUSE them: wherever THIS screen shows a picture, prefer one of these to a placeholder, an empty box or a new picture, so the project\'s screens share one set of pictures. Pictures made for this screen, if any are listed above, come first. Do not reuse them only when the request explicitly asks for other pictures or for none. Embed one with an <img> whose src is the EXACT absolute URL below (this overrides the rule against external images for these URLs only; never add a crossorigin attribute). Never invent another URL.',
    ...pictures.map((p) => `- ${p.url} — shows: ${p.about}`),
  ].join('\n')
}
