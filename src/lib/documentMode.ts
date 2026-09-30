import {
  PAGE_FORMATS,
  PAGE_GAP_PX,
  docFrameHeight,
  getPageFormat,
  isPageFormat,
  type PageFormat,
  type PageFormatId,
} from './pageFormats'
import { hintForDevice, type DeviceKind } from './presets'
import { themeDocumentPage } from './screenThemes'

/**
 * DOCUMENT screens — what changes, and only what changes, when a screen is a
 * stack of fixed pages (a flyer, and later other printed or presented pieces)
 * instead of a screen of an app. The contract with the page kit and the exports
 * is `pageFormats.ts`; this file is the pipeline's side of it.
 *
 * Every decision is a pure function here rather than an `if (screen.page)` in
 * the orchestrator, for the reason the orchestrator is 4,700 lines long: a rule
 * written inline at one call site is a rule the next call site forgets. The
 * edit, the Regenerate, the repair and the "add animations" pass all rebuilt
 * the form-factor hint from `hintForDevice(screen.device)` — which for a flyer
 * is the empty string, so the first edit of a flyer would have been an edit of
 * a web page. `hintForScreen` is that one answer, asked everywhere.
 *
 * With no page format every function returns exactly what the code did before
 * documents existed, byte for byte (M1's spirit): an ordinary screen must not
 * be able to tell this file exists.
 */

// ---- the composer ------------------------------------------------------------

/**
 * The page format the composer's chips show, or null when they show the app
 * presets (Mobile / Desktop / Tablet) instead.
 *
 * A document type switches the chips to page formats; `chosen` is the one the
 * person picked in this session, remembered like the preset, and the type's own
 * default stands until they pick one. Leaving the document type brings the app
 * presets back without touching the preset they had — the two choices live side
 * by side and neither overwrites the other.
 */
export function composerPageFormat(
  themeId: string | null | undefined,
  chosen: PageFormatId | null | undefined,
): PageFormatId | null {
  const byType = themeDocumentPage(themeId)
  if (!byType) return null
  return isPageFormat(chosen) ? chosen : byType
}

/** The chips, in the order they are offered, with their dictionary keys. */
export const PAGE_FORMAT_CHIPS: readonly { id: PageFormatId; short: string; full: string }[] = PAGE_FORMATS.map((f) => ({
  id: f.id,
  short: `composer.pageFormat.${f.id}`,
  full: `composer.pageFormat.${f.id}.full`,
}))

// ---- the prompt ---------------------------------------------------------------

/** What the format is called in the prompt: English, and the paper size in its own units. */
const FORMAT_NAMES: Record<PageFormatId, string> = {
  a4: 'A4 portrait (210 × 297 mm)',
  'a4-landscape': 'A4 landscape (297 × 210 mm)',
  letter: 'US Letter portrait (8.5 × 11 in)',
  'letter-landscape': 'US Letter landscape (11 × 8.5 in)',
  slides: '16:9 presentation slide (13.33 × 7.5 in)',
}

/**
 * The format in a few English words, for prompts that only need to name it —
 * the prompt enhancer's "Form factor:", where "Desktop" used to be.
 */
export function pageFormatName(id: PageFormatId): string {
  const f = getPageFormat(id)
  return `${FORMAT_NAMES[f.id]}, ${f.kind === 'slides' ? 'a presentation' : 'a printed document'} of fixed pages`
}

/**
 * The print-safe margin, in CSS px. 40 px is 10.6 mm on an A4 sheet: past the
 * 3–5 mm an office printer cannot reach and past the trim tolerance of a print
 * shop, so what is inside it survives either. Stated in the hint rather than in
 * the flyer's brief, because the brief is written for every format and the
 * number belongs to the page.
 */
export const SAFE_MARGIN_PX = 40

/**
 * The form-factor hint for a document: the one string that travels wherever
 * `preset.hint` goes (the preamble, Muse's, the planner's, the storyboard's).
 *
 * The sizes are written out in pixels because pixels are what the model writes
 * class names in, and because "A4" alone came back as a 1440-wide web page with
 * the word A4 in its title.
 */
export function documentHint(format: PageFormat): string {
  const slides = format.kind === 'slides'
  const what = slides ? 'a PRESENTATION' : 'a PRINTED DOCUMENT'
  const page = slides ? 'slide' : 'page'
  return [
    `FORMAT: ${what}, not a web page — ${FORMAT_NAMES[format.id]}. Every ${page} is a FIXED box of exactly ${format.w}×${format.h}px (96 px per inch).`,
    `Write the root as <Doc format="${format.id}"> and put each ${page} in its own <Page className="…">, in order. The kit gives every <Page> its exact size, stacks them and lays them out for print and PDF: never set a ${page}'s width or height yourself, never make one scroll, and never let content run from one ${page} into the next — each ${page} is composed on its own, like a sheet in a layout program. If the content does not fit, cut copy or add a <Page>.`,
    `Keep every word, logo, field and important element at least ${SAFE_MARGIN_PX}px inside the ${page} edges; only backgrounds, colour blocks and decorative shapes may bleed off the edge.`,
    slides
      ? `Type is read on a screen or a projector from across a room: body text at least 20px, nothing under 16px.`
      : `Type is read on paper at arm's length: body text at least 14px, captions at least 11px.`,
    `No navigation bar, no menu, no hover or focus states, no web buttons, no scrolling layout, no min-h-screen, no fixed or sticky positioning, no animation and no 3D scene.`,
    // The frame is exactly the page wide, so Tailwind's breakpoints resolve
    // against 794 px on A4: `md:` applies, `lg:` never does — and a model
    // trained on web pages writes `text-6xl lg:text-9xl` for a headline and
    // ships the small one, with three highlights stacked in one column.
    `The ${page} has ONE fixed size: write no responsive prefixes (sm:, md:, lg:, xl:, 2xl:) — size every element directly for this ${page}.`,
  ].join(' ')
}

/**
 * The rules that must win over SYSTEM_PROMPT's, printed AFTER it.
 *
 * The system turn is `[preamble + hint] → SYSTEM_PROMPT → capabilities → plan`,
 * so the hint above sits BEFORE "Every interactive element MUST have visible
 * states" and "look like a screenshot from a real SaaS/mobile/desktop app" —
 * and a model reading them in that order builds a flyer with hover rings. The
 * capabilities section is the one place that comes after the base rules on all
 * five paths (generate, edit, repair, polish, audit fix), and it is printed only
 * for a screen that carries the `document` capability, which an ordinary screen
 * never does. So the override lives there: `buildCapabilitiesPrompt` prints this
 * block when the pack is in scope, and nowhere else.
 */
export const DOCUMENT_RULES = [
  'DOCUMENT MODE — THESE RULES OVERRIDE THE APP-ORIENTED RULES ABOVE:',
  'This is a document of fixed pages (see FORMAT) that will be printed, exported to PDF and opened in slide software. It is NOT an app screen, and where the rules above speak of an app, a SaaS screenshot or interactive states, they do not apply.',
  '- The component App returns exactly one <Doc format="…"> whose children are <Page> elements, one per page. Doc, Page and Field are predefined: never declare, import or redefine anything with those names, and never size a Page yourself.',
  '- Paper has one state: no hover, focus, active or disabled styles, no cursor classes, no onClick, no useState for interaction, no tabs, menus, modals or links styled as buttons. A call to action is printed words (a verb, a URL, a phone number) or a QR-code placeholder box.',
  '- It must look like a finished printed piece laid out by a graphic designer — a flyer, a poster, a brochure page, a slide — never like an interface.',
  '- A blank someone fills in (a name, a date, a box to tick, a choice) is a <Field>, never a hand-drawn line or a bare <input>: every Field becomes a real form field in the exported PDF. Give each a unique `name`.',
  '- No animation of any kind: no <Animated>, <Ticker> or <CountUp>, no animate-* classes, no transitions. Every element is at its final, fully visible state in a still capture.',
  '- Decorative shapes are CSS boxes (rounded-full, rotate-*, rings, clip-path polygons) or SHORT inline SVG primitives (<circle>, <ellipse>, <rect>, <polygon>, a <path> of a few curve commands), absolutely positioned inside their Page and marked aria-hidden="true". Never long path data.',
  '- Section ids still apply, INSIDE each page (id="hero", id="details", id="coupon"…).',
].join('\n')

/**
 * The form-factor hint to rebuild for an EXISTING screen — an edit, a
 * Regenerate, the "add animations" rewrite, a targeted modification.
 *
 * A document's page lives on the screen (`Screen.page`), because the composer's
 * current chip is not this screen's format. Everything else keeps
 * `hintForDevice`, which is what every one of those sites called before.
 */
export function hintForScreen(screen: { page?: PageFormatId; device: DeviceKind }): string {
  return screen.page && isPageFormat(screen.page)
    ? documentHint(getPageFormat(screen.page))
    : hintForDevice(screen.device)
}

/**
 * Which earlier screen a new one inherits from, and how much of it
 * (`buildLayoutReference`: the whole chrome, or `buildIdentityReference`: the
 * name and the mark).
 *
 * The rule the project had — a pinned screen gives its layout, otherwise the
 * oldest rendered screen gives its identity — is kept for ordinary screens with
 * one amendment, and a document gets its own:
 *
 *  - A document never inherits a LAYOUT. "Reproduce the same top nav" placed
 *    before the page hint put a website's navigation bar on a printed flyer.
 *    It inherits the IDENTITY from any screen, pinned first: a flyer for the
 *    product should carry the product's name and mark.
 *  - An ordinary screen never inherits from a document. A pinned flyer told
 *    every later app screen to reproduce `<Doc>`/`<Page>` chrome, which an
 *    app screen has no kit for — "Doc is not defined", and the repair loop on
 *    a screen that never asked to be a document. A pinned document is
 *    therefore passed over as if nothing were pinned.
 *
 * `excludeId` keeps a regenerating screen from being handed its own source.
 */
export function pickReference<S extends { id: string; code: string; createdAt: number; page?: PageFormatId }>(
  screens: readonly S[],
  opts: { pinnedId?: string | null; excludeId?: string; document: boolean },
): { kind: 'layout' | 'identity'; screen: S } | undefined {
  const isDoc = (s: S) => !!s.page && isPageFormat(s.page)
  const pinning = !!opts.pinnedId && opts.pinnedId !== opts.excludeId
  const pinned = pinning ? screens.find((s) => s.id === opts.pinnedId) : undefined
  if (pinning && !opts.document && (!pinned || !isDoc(pinned))) {
    // Unchanged: a pinned screen that is gone or never rendered gives nothing,
    // not an identity.
    return pinned && pinned.code.trim() ? { kind: 'layout', screen: pinned } : undefined
  }
  if (pinned && opts.document && pinned.code.trim()) return { kind: 'identity', screen: pinned }
  const first = screens
    .filter((s) => s.id !== opts.excludeId && s.code.trim() && (opts.document || !isDoc(s)))
    .reduce<S | undefined>((best, s) => (!best || s.createdAt < best.createdAt ? s : best), undefined)
  return first ? { kind: 'identity', screen: first } : undefined
}

// ---- the pipeline --------------------------------------------------------------

/**
 * Capabilities that cannot live on paper.
 *
 * A 3D scene is a WebGL canvas (a PDF gets a blank rectangle or a poster of
 * one frame), a scroll sequence scrubs on scroll and a document does not
 * scroll, a film is a `<video>`, and the Ultra kit is motion by design. The
 * animation vocabulary goes too: `DOCUMENT_RULES` forbids it, and a prompt that
 * forbids `<Animated>` while documenting it hands the model a contradiction.
 *
 * They are removed from what the model is OFFERED. Code that uses one anyway
 * gets it back through `capabilitiesFor` — after the generation and after every
 * edit — because a screen that names a component its prelude does not define
 * crashes: offering is a choice, loading what the code uses is safety.
 */
export const DOCUMENT_EXCLUDED_CAPS: readonly string[] = [
  'scene3d',
  'three-lib',
  'scrollvideo',
  'motionfilm',
  'ultra',
  'animate',
  'motion-lib',
]

/** The page kit's capability id — force-added, like `ultra` on its screens. */
export const DOCUMENT_CAP = 'document'

export interface DocumentPipeline {
  /** A document, or an ordinary screen with every stage as it always was. */
  document: boolean
  format?: PageFormat
  /** The frame a NEW screen gets: one page, until the kit reports how many there are. */
  frame?: { w: number; h: number }
  /** Stages that may run. All true for an ordinary screen. */
  motionUltra: boolean
  scrollVideo: boolean
  planner: boolean
  modeGuidance: boolean
  /**
   * Find one picture from the composer's images source when Muse made none.
   * An ordinary screen with neither Muse nor Motion Ultra has no picture by the
   * person's own choice; a document has lost Motion Ultra's series by OURS, and
   * Muse is off by default (`lib/documentPictures.ts`).
   */
  ownPicture: boolean
  /**
   * `Screen.animations` for a new screen: false for a document, because an
   * entrance whose resting state is `opacity: 0` prints BLANK. Undefined — the
   * screen follows the default — for everything else.
   */
  animations?: false
  /** The capability list for this screen: pass-through for an ordinary screen. */
  caps: (ids: string[]) => string[]
}

/**
 * Every stage decision for a screen made at `page` (none: an ordinary screen).
 *
 * What stays: Muse (a flyer wants a palette, a type pairing and a picture as
 * much as a landing page does), the images source (generated or free photos —
 * a flyer without a picture is a poster of shapes), the direction, the screen
 * type. What goes: whatever moves or scrolls or draws in WebGL, and the planner
 * and its mode guidance, whose vocabulary ("persuade / operate", "sidebar +
 * main grid") is about screens a visitor uses — the page hint and the type's
 * brief already say what a page holds.
 */
export function documentPipeline(page: PageFormatId | null | undefined): DocumentPipeline {
  if (!page || !isPageFormat(page)) {
    return {
      document: false,
      motionUltra: true,
      scrollVideo: true,
      planner: true,
      modeGuidance: true,
      ownPicture: false,
      caps: (ids) => ids,
    }
  }
  const format = getPageFormat(page)
  return {
    document: true,
    format,
    frame: { w: format.w, h: docFrameHeight(format, 1) },
    motionUltra: false,
    scrollVideo: false,
    planner: false,
    modeGuidance: false,
    ownPicture: true,
    animations: false,
    caps: (ids) => {
      const out = ids.filter((id) => !DOCUMENT_EXCLUDED_CAPS.includes(id))
      return out.includes(DOCUMENT_CAP) ? out : [...out, DOCUMENT_CAP]
    },
  }
}

// ---- the canvas ------------------------------------------------------------------

/** How many pages a frame of this height holds — the inverse of `docFrameHeight`. */
export function pagesInFrame(format: PageFormat, h: number): number {
  return Math.max(1, Math.round((h + PAGE_GAP_PX) / (format.h + PAGE_GAP_PX)))
}

/**
 * What the canvas does with the kit's report (`DOC_PAGES_MESSAGE`).
 *
 * The frame is resized to hold exactly the pages the document has — never
 * through the "full height" format, which measures `scrollHeight` and would
 * add whatever a model left hanging below the last page. `size` is null when
 * nothing has to change, so a report repeated on every re-measure writes
 * nothing. `overflow` is the 1-based page numbers to name in a notice, or an
 * empty list; `overflowKey` lets the caller say it once per distinct answer
 * rather than on every measurement.
 */
export function docFrameUpdate(
  screen: { page?: PageFormatId; w: number; h: number },
  count: unknown,
  overflow: unknown,
  reported?: unknown,
): { page: PageFormatId | null; size: { w: number; h: number } | null; overflow: number[]; overflowKey: string } | null {
  if (!screen.page || !isPageFormat(screen.page)) return null
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 1) return null
  // A frame is a message from generated code: bound it rather than trust it.
  const pages = Math.min(50, Math.floor(count))
  /*
   * The format the kit LAID OUT, which is the code's `<Doc format>` — the one
   * thing every renderer of this screen agrees on (the canvas, a capture, the
   * exports reading `DOC_ATTR`). `Screen.page` follows it. The other way round,
   * "mets-le en paysage" came back as 1123-px pages in a 794-px frame, cut at
   * two thirds, with a height computed from pages the code no longer drew and
   * an export told A4 portrait. A value the kit never sends — or one that is not
   * a format — changes nothing.
   */
  const page = isPageFormat(reported) && reported !== screen.page ? reported : null
  const format = getPageFormat(page ?? screen.page)
  const w = format.w
  const h = docFrameHeight(format, pages)
  const pagesOver = Array.isArray(overflow)
    ? [...new Set(overflow.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < pages))].sort((a, b) => a - b).map((n) => n + 1)
    : []
  return {
    page,
    size: screen.w === w && screen.h === h ? null : { w, h },
    overflow: pagesOver,
    overflowKey: pagesOver.join(','),
  }
}

// ---- the demo ------------------------------------------------------------------

/**
 * How a document sits in the demo player: fitted to the WIDTH and scrolled,
 * never shrunk to the height — three A4 pages fitted to a laptop's height are
 * three postage stamps. Never enlarged past its real size either: a page shown
 * wider than it prints is a page whose type looks bigger than it is.
 */
export function demoDocLayout(format: PageFormat, pages: number, areaW: number, pad: number) {
  const scale = Math.max(0.05, Math.min(1, (areaW - pad * 2) / format.w))
  const h = docFrameHeight(format, pages)
  return { scale, w: format.w, h, boxW: format.w * scale, boxH: h * scale }
}

/** The 1-based page mostly in view: the one under the middle of the viewport. */
export function pageInView(scrollTop: number, viewportH: number, pad: number, format: PageFormat, scale: number, pages: number): number {
  const pitch = (format.h + PAGE_GAP_PX) * scale
  if (pitch <= 0) return 1
  const n = Math.floor((scrollTop + viewportH / 2 - pad) / pitch) + 1
  return Math.max(1, Math.min(Math.max(1, pages), n))
}

// ---- the thumbnail ---------------------------------------------------------------

/**
 * The viewport and region a thumbnail is taken from.
 *
 * An ordinary screen: its own size, the top band. A document: the FIRST PAGE
 * alone, rendered at the page's size — the frame's full height would render
 * every page to keep a fraction of the first, and the top 55% of a stack of
 * three A4 pages is one and a half of them. A portrait page keeps the top band
 * (headline and hero, what makes a flyer recognisable); a landscape page or a
 * slide is shown whole, since its band would be a sliver.
 */
export function thumbFrame(
  screen: { page?: PageFormatId; w: number; h: number },
  topBand: { x: number; y: number; w: number; h: number },
): { w: number; h: number; region: { x: number; y: number; w: number; h: number } } {
  if (screen.page && isPageFormat(screen.page)) {
    const f = getPageFormat(screen.page)
    return { w: f.w, h: f.h, region: f.h > f.w ? topBand : { x: 0, y: 0, w: 1, h: 1 } }
  }
  return { w: screen.w > 0 ? screen.w : 1024, h: screen.h > 0 ? screen.h : 720, region: topBand }
}
