/**
 * The generation prompt's Motion Ultra section: the storyboard, the pictures
 * that were actually made, and the rules that keep an expressive page usable.
 *
 * It rides where the planner's section rides (`planSection`), and replaces it:
 * the storyboard IS the plan, only with recipes instead of prose. The kit's
 * vocabulary is NOT repeated here — it is printed by `buildCapabilitiesPrompt`
 * because the pack is in scope, which is also how an edit of the screen later
 * learns it without this section.
 */
import { ULTRA_RECIPES } from './recipes'
import type { UltraImage } from './images'
import type { UltraStoryboard } from './storyboard'

export function buildUltraPreamble(
  board: UltraStoryboard,
  images: UltraImage[],
  /** The one section whose background will be a rendered film. */
  opts: { filmSection?: string | null } = {},
): string {
  const lines = [
    'MOTION ULTRA — this screen is built as a high-end, motion-led page: a living ground, display type, frosted surfaces, reveals tied to the scroll. It follows the storyboard below, section by section, using the ULTRA KIT and <Backdrop> described in the capabilities.',
    '',
    'STORYBOARD — build these sections, in this order, each with exactly this id on its outermost element:',
  ]
  if (board.sections[0]?.recipe === 'ambient-shell') {
    lines.push(
      `This is ONE application screen. "${board.sections[0].id}" is the frame — navigation plus a main area that fills the viewport — and every section after it is a PANEL inside that main area, laid out as a dashboard grid, not a page section below the frame. Each panel shows different data: never show the same list, figure or table twice. The navigation stays visible (sticky or full-height); nothing uses display type larger than the page title.`,
    )
  }
  board.sections.forEach((s, i) => {
    const r = ULTRA_RECIPES[s.recipe]
    lines.push(`${i + 1}. id="${s.id}" — recipe "${s.recipe}": ${r.card[0]}`)
    lines.push(`   Build: ${r.card[1]}`)
    lines.push(`   Avoid: ${r.card[2]}`)
    if (s.content) lines.push(`   Content: ${s.content}`)
    if (opts.filmSection && s.id === opts.filmSection) {
      lines.push(
        '   VIDEO BACKGROUND: a film will be rendered for this section after the page. Make its FIRST child `<Backdrop slot="film" preset="…" colors={[…]} veil={0.25} />` — a living CSS ground now, the film plays in it once ready. Exactly one `slot="film"` on the whole page, only here. Do NOT write <video> or <MotionFilm>, and put NO other full-bleed picture in this section — a picture planned for it goes in `<Backdrop image="…">`, where the film plays over it; an <img> laid after the backdrop would cover the film.',
        '   The film must be SEEN: this section is picture-led, at least 280px tall, and nothing is laid on the film but a heading, one line and at most one action — no table, chart, list, form or card grid over it. Keep that text readable with a gradient veil on its side rather than darkening the whole film.' +
          (board.mode === 'operate'
            ? ' On this application screen it is the wide banner at the TOP of the main area, full width, above every data panel.'
            : ''),
      )
    }
  })

  if (images.length) {
    lines.push(
      '',
      'GENERATED PICTURES — made for THIS screen and served by this app. Use EVERY one of them, each exactly once, in the section named, with an <img> whose src is the EXACT absolute URL below (this overrides the general rule against external images — only these URLs are allowed, and never add a crossorigin attribute). A "backdrop" picture may instead be passed to <Backdrop image="…">.',
    )
    for (const im of images) {
      lines.push(`- section "${im.section}", ${im.role}: ${im.url} — shows: ${im.subject}`)
    }
    lines.push('Write alt text describing what each picture shows, except a backdrop, which gets alt="".')
  }
  const planned = board.images.length
  if (images.length < planned) {
    lines.push(
      '',
      images.length
        ? `Only ${images.length} of the ${planned} planned pictures could be made. Where a recipe wanted one that is missing, build it on <Backdrop> instead — never an empty box, never an invented URL.`
        : 'No picture could be made for this run. Build every recipe on <Backdrop> and typography instead — never an empty box, never an invented URL.',
    )
  }

  lines.push(
    '',
    'RULES THAT KEEP IT USABLE:',
    '- Set --u-a, --u-b, --u-c on the page root from the palette you were given, so every u-* class speaks the project\'s colours.',
    '- Every line of text must stay readable on the frame it is on: over a picture or a Backdrop, put a veil or a solid surface under it. Expressive never excuses illegible.',
    '- Motion is for the opening and a few strong moments. Body paragraphs, forms, tables and navigation do not move.',
    '- At most two <Backdrop> on the screen, and never a <Backdrop> behind a table or a form.',
  )
  return lines.join('\n')
}
