/**
 * The pictures a project already paid for, offered to a screen made without
 * Motion Ultra.
 *
 * A Motion Ultra series is generated FOR a screen, but it is the project's: the
 * same speaker, the same workshop, the same light. A second screen generated
 * with Motion Ultra paused or off used to know none of it — the model was never
 * told the pictures existed, so it drew placeholder boxes next to a series of
 * six photographs of the very product it was describing.
 *
 * Offered, never imposed: the model MAY use one where a picture helps, and a
 * settings page is right to use none. No picture is generated here — this costs
 * a library listing and some prompt, nothing else.
 */
import type { Screen } from '../project'

/** How many are offered: enough to choose from, few enough not to crowd the prompt. */
export const REUSE_MAX = 8

/** Library hashes of every Motion Ultra picture in the project, most recent screen first. */
export function projectUltraPictures(screens: Array<Pick<Screen, 'ultra' | 'createdAt'>>): string[] {
  const out: string[] = []
  for (const s of [...screens].sort((a, b) => b.createdAt - a.createdAt)) {
    for (const hash of s.ultra?.images ?? []) if (!out.includes(hash)) out.push(hash)
  }
  return out.slice(0, REUSE_MAX)
}

/** The generation section listing them, or '' when there are none. */
export function buildReuseSection(pictures: Array<{ url: string; about: string }>): string {
  if (!pictures.length) return ''
  return [
    'PROJECT PICTURES — already generated for this project, in its style. You MAY reuse any of them where a picture genuinely helps THIS screen, with an <img> whose src is the EXACT absolute URL below (this overrides the rule against external images for these URLs only; never add a crossorigin attribute). Use none if the screen does not need a picture. Never invent another URL.',
    ...pictures.map((p) => `- ${p.url} — shows: ${p.about}`),
  ].join('\n')
}
