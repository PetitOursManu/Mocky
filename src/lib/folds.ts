import { getPageFormat, isPageFormat, type PageFormat, type PageFormatId } from './pageFormats'

/**
 * FOLDED LEAFLETS — a dépliant is one sheet, printed on both sides, then folded.
 *
 * A folded flyer is not "several pages": it is TWO faces of one sheet, each cut
 * into panels by the folds, and which panel ends up as the front cover is a
 * matter of geometry, not of reading order. On a roll fold the front cover is
 * the RIGHT-hand panel of the outside face and the narrow flap the LEFT-hand
 * one; on a gate fold the front cover is split across both ends of the outside
 * face, with its right half printed on the LEFT. A model asked for "a tri-fold"
 * lays the outside face out as a reading order — cover first, on the left — and
 * the sheet that comes back from the printer folds with its back cover in
 * front. So the panel order is computed here once, from the fold, and stated to
 * the model as a list of slots; the kit sizes the slots (`<Panel>` in
 * capabilities/snippets/Document.ts) so a fold line is where the paper creases
 * and not where the model guessed it.
 *
 * The sheet is the format's LANDSCAPE twin: a fold runs across the long side, so
 * "an A4 folded in three" is an A4 landscape sheet of three DL panels. What the
 * composer's chip names is the sheet the print shop is asked for.
 *
 * Every panel width is a fraction of the sheet, the panel that tucks in on a
 * roll fold being 3 mm narrower than its neighbours (97 + 100 + 100 on A4) —
 * the tolerance without which the inner flap buckles against the fold.
 */

export type FoldId = 'half' | 'roll' | 'z' | 'gate' | 'accordion4'

export const FOLD_IDS: readonly FoldId[] = ['half', 'roll', 'z', 'gate', 'accordion4']

/** One panel of one face: what goes on it, for the prompt (English, like every instruction). */
export interface FoldPanel {
  role: string
  /** Fraction of the sheet's width. The fractions of a face add up to 1. */
  share: number
}

export interface Fold {
  id: FoldId
  /** The fold in a few English words, for the prompt. */
  name: string
  /** Sheet sizes this fold is offered on — a four-panel accordion on A6 is four postage stamps. */
  sheets: readonly PageFormatId[]
  /** The outside face (printed first, `<Page>` 1) and the inside face (`<Page>` 2), panels left to right AS PRINTED. */
  faces: readonly [readonly FoldPanel[], readonly FoldPanel[]]
  /** One sentence on how it opens, for the prompt. */
  opens: string
}

const third = 1 / 3
// Roll fold on any sheet: the tucked panel is 97/297 of the width, its two neighbours 100/297.
const ROLL_SHORT = 97 / 297
const ROLL_LONG = 100 / 297

export const FOLDS: readonly Fold[] = [
  {
    id: 'half',
    name: 'two-panel leaflet folded in half (bi-fold)',
    sheets: ['a5', 'a4', 'a3', 'letter'],
    faces: [
      [
        { role: 'BACK COVER — contact details, address, logo, legal line', share: 0.5 },
        { role: 'FRONT COVER — the headline and the hook, what is seen first', share: 0.5 },
      ],
      [
        { role: 'INSIDE LEFT — read first when the leaflet is opened', share: 0.5 },
        { role: 'INSIDE RIGHT — the detail, the offer, the call to action', share: 0.5 },
      ],
    ],
    opens: 'It opens like a card: front cover, then the two inside panels side by side, then the back.',
  },
  {
    id: 'roll',
    name: 'three-panel roll fold (letter fold, tri-fold)',
    sheets: ['a4', 'a3', 'letter'],
    faces: [
      [
        { role: 'INSIDE FLAP — the narrower panel that tucks in, seen first when the cover is lifted: a teaser, a key fact or a short list', share: ROLL_SHORT },
        { role: 'BACK COVER — contact details, map or address, logo, legal line', share: ROLL_LONG },
        { role: 'FRONT COVER — the headline and the hook, what is seen first', share: ROLL_LONG },
      ],
      [
        { role: 'INSIDE LEFT — the first of the three inside panels', share: ROLL_LONG },
        { role: 'INSIDE CENTRE — the heart of the content', share: ROLL_LONG },
        { role: 'INSIDE RIGHT — the panel the flap covers: the offer, a form or the call to action', share: ROLL_SHORT },
      ],
    ],
    opens:
      'Closed, only the front cover shows; lifting it shows the inside flap; opening fully shows the three inside panels as one spread.',
  },
  {
    id: 'z',
    name: 'three-panel Z fold (accordion)',
    sheets: ['a4', 'a3', 'letter'],
    faces: [
      [
        { role: 'FRONT COVER — the headline and the hook, what is seen first', share: third },
        { role: 'PANEL 2 — the first idea', share: third },
        { role: 'PANEL 3 — the second idea', share: third },
      ],
      [
        { role: 'PANEL 4 — the detail', share: third },
        { role: 'PANEL 5 — the offer or the programme', share: third },
        { role: 'BACK COVER — contact details, address, logo, legal line', share: third },
      ],
    ],
    opens: 'It unfolds like an accordion: each face reads left to right as one continuous strip.',
  },
  {
    id: 'gate',
    name: 'gate fold (two flaps closing on a double centre panel)',
    sheets: ['a4', 'a3', 'letter'],
    faces: [
      [
        { role: 'FRONT COVER, RIGHT HALF — printed on the left, it ends up on the right when closed: continue the cover started on the right-hand flap', share: 0.25 },
        { role: 'BACK COVER — contact details, address, logo, legal line', share: 0.5 },
        { role: 'FRONT COVER, LEFT HALF — printed on the right, it ends up on the left when closed: the headline starts here and the two flaps meet in the middle', share: 0.25 },
      ],
      [
        { role: 'INSIDE LEFT FLAP — opened first', share: 0.25 },
        { role: 'CENTRE SPREAD — the big reveal, twice as wide as a flap', share: 0.5 },
        { role: 'INSIDE RIGHT FLAP — opened with the left one', share: 0.25 },
      ],
    ],
    opens:
      'The two flaps meet in the middle to make the front cover, and open like doors onto the wide centre panel. The cut between the two cover halves is a real edge of paper: no word may cross it.',
  },
  {
    id: 'accordion4',
    name: 'four-panel accordion fold',
    sheets: ['a4', 'a3'],
    faces: [
      [
        { role: 'FRONT COVER — the headline and the hook, what is seen first', share: 0.25 },
        { role: 'PANEL 2', share: 0.25 },
        { role: 'PANEL 3', share: 0.25 },
        { role: 'PANEL 4', share: 0.25 },
      ],
      [
        { role: 'PANEL 5', share: 0.25 },
        { role: 'PANEL 6', share: 0.25 },
        { role: 'PANEL 7', share: 0.25 },
        { role: 'BACK COVER — contact details, address, logo, legal line', share: 0.25 },
      ],
    ],
    opens: 'It unfolds like an accordion into a long strip: each face reads left to right, one idea per panel.',
  },
]

export function isFoldId(v: unknown): v is FoldId {
  return typeof v === 'string' && (FOLD_IDS as readonly string[]).includes(v)
}

export function getFold(id: FoldId): Fold {
  return FOLDS.find((f) => f.id === id) ?? FOLDS[0]
}

/** A stored value: a fold this build knows, or none — the rule `Screen.page` follows. */
export function normalizeFold(v: unknown): FoldId | undefined {
  return isFoldId(v) ? v : undefined
}

/** The landscape twin of a portrait sheet: a fold runs across the long side. */
const LANDSCAPE: Partial<Record<PageFormatId, PageFormatId>> = {
  a5: 'a5-landscape',
  a4: 'a4-landscape',
  a3: 'a3-landscape',
  letter: 'letter-landscape',
}
const PORTRAIT: Partial<Record<PageFormatId, PageFormatId>> = Object.fromEntries(
  Object.entries(LANDSCAPE).map(([p, l]) => [l, p]),
)

/** The sheet a format names, in its portrait reading — what the chip says. */
export function portraitOf(id: PageFormatId): PageFormatId {
  return PORTRAIT[id] ?? id
}

/**
 * The flat sheet a folded leaflet is printed on: `chosen` in landscape. Null
 * when this fold is not offered on that size — the caller then makes an
 * unfolded flyer rather than a guess.
 */
export function foldSheet(fold: FoldId, chosen: PageFormatId): PageFormatId | null {
  const portrait = portraitOf(chosen)
  if (!getFold(fold).sheets.includes(portrait)) return null
  return LANDSCAPE[portrait] ?? null
}

/** Whether a fold can be drawn on this (flat) sheet — the check an edit's `<Doc fold>` is held to. */
export function foldFits(fold: FoldId, sheet: PageFormatId): boolean {
  return isPageFormat(sheet) && foldSheet(fold, sheet) === sheet
}

/**
 * Panel widths in CSS px for each face, rounded to whole pixels with the last
 * panel taking the remainder, so the panels always tile the face exactly.
 */
export function panelWidths(fold: FoldId, sheet: PageFormat): [number[], number[]] {
  const widths = (panels: readonly FoldPanel[]) => {
    const out = panels.map((p) => Math.round(p.share * sheet.w))
    out[out.length - 1] = sheet.w - out.slice(0, -1).reduce((a, b) => a + b, 0)
    return out
  }
  const f = getFold(fold)
  return [widths(f.faces[0]), widths(f.faces[1])]
}

/** Folds offered beside a sheet: those whose size list contains it. */
export function foldsFor(chosen: PageFormatId): FoldId[] {
  const portrait = portraitOf(chosen)
  return FOLDS.filter((f) => f.sheets.includes(portrait)).map((f) => f.id)
}

/** Keep words this far from a fold line: a crease cracks the ink and swallows a letter. */
export const FOLD_GUTTER_PX = 24

/**
 * The prompt's half of the contract: which `<Page>` is which face and which
 * `<Panel>` is which slot, with its width, so the model composes each panel on
 * its own instead of laying a web page across the folds.
 */
export function foldHint(fold: FoldId, sheetId: PageFormatId): string {
  const f = getFold(fold)
  const sheet = getPageFormat(sheetId)
  const [outW, inW] = panelWidths(fold, sheet)
  const face = (label: string, panels: readonly FoldPanel[], widths: number[]) =>
    `${label}:\n` + panels.map((p, i) => `  <Panel> ${i + 1} (${widths[i]}px wide) — ${p.role}`).join('\n')
  return [
    `FOLDED LEAFLET — a ${f.name}. The sheet is printed on both sides and folded; write <Doc format="${sheetId}" fold="${fold}"> with EXACTLY 2 <Page>s, and fill each <Page> with exactly ${f.faces[0].length} <Panel> elements as its direct children, in this order, left to right as printed:`,
    face('<Page> 1 — the OUTSIDE face', f.faces[0], outW),
    face('<Page> 2 — the INSIDE face', f.faces[1], inW),
    f.opens,
    `The kit sizes every <Panel> to its exact width and full height: never set a Panel's width yourself, and never wrap the Panels in another element. Each panel is composed on its own like a small page, with its own ${FOLD_GUTTER_PX}px margin from every fold: no word, field or logo crosses a fold line. A background colour, a picture or a decorative shape may run across neighbouring panels of the INSIDE face, which is seen open; on the OUTSIDE face the panels are seen one at a time, so nothing but a plain background colour runs from one to the next.`,
  ].join('\n')
}
