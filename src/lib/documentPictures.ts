/**
 * The one picture a DOCUMENT gets when nothing else made one.
 *
 * On an ordinary screen pictures come from Muse's hero, Motion Ultra's series
 * or a site's replacements, and a screen with none of them is a screen the
 * person chose to have without. A document skips Motion Ultra (paper does not
 * move), and Muse is OFF by default — so a flyer made with the default
 * settings had no way to get a picture at all. This is the hero it can be
 * given, cropped "boldly into a shape".
 *
 * One picture, not a series: a flyer has one hero, and each extra picture is a
 * vision call or the price of a generation. Same two doors as the site's
 * pictures — the stock finder, whose vision judge may
 * refuse every candidate, and `generateImage` — and never fatal: nothing found
 * means the brief's own fallback, "a composition of shapes takes its place".
 *
 * And ASKED FOR, never assumed. The first version ran on every document with
 * Muse off and read the composer's general "Images" choice, whose only answers
 * were "AI" and "Free" — so with the default settings every flyer POSTed one
 * paid generation nobody had asked for, from a control that was not even drawn
 * where the choice was made. The person decides how many pictures (U3), so a
 * document has a choice of its own (`DocumentImageChoice`) whose default is
 * "no picture", and which offers only the doors this account can open.
 */
import { generateImage, imageUrl } from './imageLibrary'
import { absoluteUrl } from './muse'
import { getPageFormat, isPageFormat, type PageFormat, type PageFormatId } from './pageFormats'
import type { ImageSource, StockFinder, StockOrientation } from './stockImages'

/*
 * Not imported from the site pictures' module, although the sizes are the
 * same: that module handles screenshots of someone else's site, and
 * tests/site-reference.test.js keeps the list of files that can reach it short
 * on purpose (M2). A document has no screenshot to leak.
 */
export type DocumentPictureShape = 'wide' | 'square'
const DOCUMENT_PICTURE_SIZE: Record<DocumentPictureShape, { width: number; height: number }> = {
  wide: { width: 1024, height: 640 },
  square: { width: 1024, height: 1024 },
}

export interface DocumentPictureWant {
  /** What the picture shows: the request, less the words that name the document. */
  subject: string
  /** A search for the free libraries, or undefined to let the finder derive one. */
  query?: string
  shape: DocumentPictureShape
  orientation: StockOrientation
}

/**
 * The words that name the PIECE rather than its subject, in the two languages
 * the composer speaks. "Flyer pour une soirée jazz" searched as it stands asks
 * the libraries for flyers — and asks an image model to paint one, lettering
 * and all, which is the one thing a hero picture must not contain.
 */
const PIECE_WORDS = new Set(
  (
    'flyer flyers affiche affiches poster posters tract tracts brochure brochures dépliant depliant leaflet ' +
    'document documents page pages recto verso imprimé imprime imprimée printed print pdf a4 a5 letter ' +
    'format paysage portrait landscape slide slides présentation presentation carte card invitation'
  ).split(/\s+/),
)

/** Function words, FR and EN: what stays of "pour une soirée" once the subject is taken out. */
const FUNCTION_WORDS = new Set(
  (
    'un une des le la les l du de d pour avec et ou au aux en sur dans par ce cet cette ces mon ma mes ' +
    'notre nos votre vos son sa ses leur leurs qui que quoi à a an the for of with and or to in on at by ' +
    'my our your their its this that these those about'
  ).split(/\s+/),
)

/** The first clause of the request, its piece words dropped from the FRONT only. */
function subjectOf(text: string): string {
  const flat = String(text || '').replace(/\s+/g, ' ').trim()
  // Only the leading run: "un flyer pour une soirée" → "soirée …", while a
  // "carte" or a "page" further in is part of what the event IS.
  const words = flat.split(' ')
  let i = 0
  while (i < words.length) {
    const w = words[i].toLowerCase().replace(/['’]/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').trim()
    const last = w.split(' ').pop() || ''
    if (w && (PIECE_WORDS.has(w) || FUNCTION_WORDS.has(w) || (w.includes(' ') && (PIECE_WORDS.has(last) || FUNCTION_WORDS.has(last))))) i++
    else break
  }
  return words.slice(i).join(' ').slice(0, 200).trim() || flat.slice(0, 200)
}

/** Up to five content words of the first clause — the libraries search on nouns. */
function queryOf(subject: string): string | undefined {
  const first = subject.split(/[,.;:\n(]/)[0] || ''
  const words = first
    .toLowerCase()
    .replace(/['’]/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !/^\d+$/.test(w) && !PIECE_WORDS.has(w) && !FUNCTION_WORDS.has(w))
  return words.length ? words.slice(0, 5).join(' ') : undefined
}

/**
 * What to look for. A portrait page asks for a SQUARE picture — a flyer crops
 * its hero into a band, a circle or a half page, and a square survives all
 * three — and a landscape page or a slide for a wide one.
 */
export function documentPictureWant(text: string, format: PageFormat): DocumentPictureWant {
  const subject = subjectOf(text)
  const shape: DocumentPictureShape = format.h > format.w ? 'square' : 'wide'
  return { subject, query: queryOf(subject), shape, orientation: shape === 'wide' ? 'landscape' : 'square' }
}

const NEGATIVE = 'no text, no letters, no words, no numbers, no logo, no watermark, no frame, no border, no mockup'

/** The prompt a generated hero is painted from: the subject, never the piece. */
export function documentPicturePrompt(want: DocumentPictureWant): string {
  return `A striking photograph of: ${want.subject.replace(/[.\s]+$/, '')}. The picture itself, one clear subject and a bold composition — never a flyer, a poster or a page layout. ${NEGATIVE}.`
}

/**
 * The section that hands the picture to the page's author. Named as the HERO,
 * because the flyer's brief already says what a hero picture becomes; the
 * wording otherwise follows the site pictures' section, whose "exactly these
 * URLs" is what stops a model from inventing an Unsplash link the sandbox
 * would never load.
 */
export function buildDocumentPictureSection(picture: { url: string; subject: string; shape: DocumentPictureShape }): string {
  return [
    `PICTURE — one picture was made for this document (${picture.shape}): ${picture.subject} → ${picture.url}`,
    'Use it as the hero picture, cropped boldly into a shape, a colour block or a frame. Embed it as <img src="URL" alt="…" className="… object-cover"> with exactly this URL and an alt text describing what it shows. Use it once, and invent no other picture URL.',
  ].join('\n')
}

/**
 * Find or make the picture, following the composer's "Images" choice. Null when
 * none could be had — said through `onError`, never thrown; only a cancel
 * throws.
 */
export async function findDocumentPicture(
  want: DocumentPictureWant,
  opts: {
    source: ImageSource
    project: string
    /** For 'stock'. Absent, a 'stock' run finds nothing. */
    finder?: StockFinder
    signal?: AbortSignal
    onError?: (message: string) => void
  },
): Promise<{ hash: string; url: string } | null> {
  try {
    if (opts.source === 'stock') {
      if (!opts.finder) return null
      const got = await opts.finder.find({
        subject: want.subject,
        query: want.query,
        orientation: want.orientation,
        role: 'the hero picture of a printed flyer, cropped into a shape',
        tags: ['document'],
      })
      if (!got) opts.onError?.(opts.finder.lastMiss)
      return got ? { hash: got.hash, url: got.url } : null
    }
    const made = await generateImage(documentPicturePrompt(want), {
      project: opts.project,
      signal: opts.signal,
      tags: ['document', want.shape],
      ...DOCUMENT_PICTURE_SIZE[want.shape],
    })
    // A provider that answered with nothing is not an error, and not a picture.
    return made ? { hash: made.hash, url: absoluteUrl(`/api/images/${made.hash}`) } : null
  } catch (err) {
    if (opts.signal?.aborted) throw err
    opts.onError?.(err instanceof Error ? err.message : String(err))
    return null
  }
}

// ---- the choice ------------------------------------------------------------------

/**
 * Where a document's picture comes from, as the composer offers it. 'none' is
 * an answer and the default, not the absence of one: a flyer of shapes is a
 * flyer, and its brief already says how to compose one.
 */
export type DocumentImageChoice = 'none' | ImageSource

/** Which doors this account can open right now. */
export interface DocumentImageDoors {
  /** An image model other than the placeholder is configured. Null: not known yet. */
  generation: boolean | null
  /** At least one free library answers for this account (`stockUsable`). */
  stock: boolean
}

/**
 * The choices to draw, in order. A closed door is ABSENT rather than offered
 * and then refused with a notice: an option that can only fail is a trap, and
 * "not known yet" counts as closed until the server has answered.
 */
export function documentImageChoices(doors: DocumentImageDoors): DocumentImageChoice[] {
  const out: DocumentImageChoice[] = ['none']
  if (doors.generation) out.push('ai')
  if (doors.stock) out.push('stock')
  return out
}

/**
 * The choice the control SHOWS: the remembered one while its door is open,
 * "no picture" otherwise. The preference itself is left alone — an account
 * that loses the libraries for a day gets its "free photo" back afterwards.
 */
export function shownDocumentImageChoice(choice: DocumentImageChoice, doors: DocumentImageDoors): DocumentImageChoice {
  return documentImageChoices(doors).includes(choice) ? choice : 'none'
}

/**
 * The source a document run looks for its picture with, or null for none.
 *
 * Never a fallback from one door to the other: a remembered "free photo" on an
 * account that lost the libraries is NOT quietly turned into a generation, as
 * the general control turns it into "AI" — that substitution is exactly the one
 * that billed a picture nobody chose.
 */
export function documentPictureSource(choice: DocumentImageChoice, doors: DocumentImageDoors): ImageSource | null {
  const shown = shownDocumentImageChoice(choice, doors)
  return shown === 'none' ? null : shown
}

const CHOICE_KEY = 'mocky.docImageSource.v1'

/**
 * Remembered per browser, like the general images source, under a key of its
 * own: "free photos" for a landing page is not a decision about flyers, and
 * inheriting the general key would turn its historical "AI" default back into
 * a paid picture on every document.
 */
export function loadDocumentImageChoice(): DocumentImageChoice {
  try {
    const v = localStorage.getItem(CHOICE_KEY)
    return v === 'ai' || v === 'stock' ? v : 'none'
  } catch {
    return 'none'
  }
}

export function saveDocumentImageChoice(choice: DocumentImageChoice): void {
  try {
    localStorage.setItem(CHOICE_KEY, choice)
  } catch {
    /* private mode — the choice lasts the session */
  }
}

/**
 * Whether this instance can GENERATE a picture: its content profile names a
 * provider other than `none`, the placeholder that answers with nothing. An
 * unreachable answer reads as no, so the composer offers only what it knows
 * works.
 */
export async function imageGenerationAvailable(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch('/api/images/providers?profile=content', { signal })
    if (!res.ok) return false
    const j = await res.json()
    const list: unknown = j?.providers
    return Array.isArray(list) && list.some((p) => !!p && typeof p.id === 'string' && p.id !== 'none')
  } catch {
    return false
  }
}

// ---- Regenerate -------------------------------------------------------------------

/**
 * The picture section a REGENERATE hands the model, built from the picture the
 * document already has.
 *
 * Regenerate is "the same request, another layout". It passed no picture at
 * all, so the variant was written from a brief that promises a hero and no URL
 * to put in it — the picture the person had chosen, and maybe paid for, fell
 * out of the page. Finding a new one instead would pay again for a picture
 * that is already there. The stored hash IS the picture; its subject and shape
 * are re-derived from the same prompt and format they were derived from the
 * first time.
 *
 * Only a picture PLACED in the page ('content'): an inspiration reference was
 * never meant to be embedded. Empty for anything that is not a document.
 */
export function documentPictureSectionFor(screen: {
  prompt: string
  page?: PageFormatId
  imageHash?: string
  imageRole?: 'content' | 'inspiration' | 'both'
}): string {
  if (!screen.page || !isPageFormat(screen.page)) return ''
  if (!screen.imageHash || screen.imageRole !== 'content') return ''
  const want = documentPictureWant(screen.prompt, getPageFormat(screen.page))
  return buildDocumentPictureSection({ ...want, url: absoluteUrl(imageUrl(screen.imageHash)) })
}
