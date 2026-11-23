/**
 * The headless runner's page — `runner.html`, opened by server/mcp/runner.js in
 * a Chromium the server drives, never by a person.
 *
 * It exists so that a design asked for from Claude or ChatGPT runs THE pipeline
 * — lib/pipeline/newScreen.ts, the code the composer runs — and not a second one
 * written for the server (plans/mcp-serveur.md, X-series). Everything the
 * composer would have held comes from the request, the account's stored data,
 * or the defaults a fresh browser has; everything the composer would have shown
 * is reported back as progress and notices.
 *
 * Authority: the page carries no session. The server routes every request this
 * page makes through a runner token bound to one account and one job, accepted
 * on the routes a generation needs and nowhere else (server/mcp/runner-auth.js).
 *
 * Three calls, all on `window.__mockyRunner`:
 *   run(job)    generate one new screen and write it into the account's project;
 *   show(spec)  mount that screen's preview, sized to its frame, and resolve when
 *               it has rendered — the server then screenshots the iframe with
 *               Chromium itself (real pixels, WebGL included), not html2canvas;
 *   exportScreen(spec)  one downloadable file of a screen — PNG, .pptx, the
 *               taken-apart .pptx for Canva, PDF — made by the Download dialog's
 *               own functions (lib/docExport), never a second exporter.
 */
import { createRoot } from 'react-dom/client'
import { interactLossNotice } from '../lib/briefCheck'
// The app's own stylesheet: Preview sizes its frame with the app's classes, and
// without them the iframe fell back to a browser's 300×150 default — the first
// photograph was a postage stamp.
import '../index.css'
import { useState } from 'react'
import { api } from '../lib/api'
import { setUsageProject } from '../lib/proxy'
import { parseProjects } from '../lib/merge'
import { defaultSettings } from '../lib/settings'
import { absoluteUrl, checkVision, defaultMuseConfig, museAvailable } from '../lib/muse'
import { documentPictureSource, imageGenerationAvailable, type DocumentImageChoice } from '../lib/documentPictures'
import { stockImageStatus, stockUsable } from '../lib/stockImages'
import { imageUrl } from '../lib/imageLibrary'
import { defaultDesign, extractProductName, isDesignActive } from '../lib/design'
import { DEFAULT_PROJECT_NAME, deriveName, designForProject, newId, normalizeScreen, placeBeside, placeScreen, type Project, type Screen } from '../lib/project'
import { projectFromTemplate, type ProjectTemplate } from '../lib/templates'
import { exportDocument, type ExportKind } from '../lib/docExport'
import { exportWebScreen } from '../lib/docExport/web'
import { runNewScreen, type NewScreenHooks, type NewScreenPhase, type NewScreenRequest, type ScreenWriter } from '../lib/pipeline/newScreen'
import { runFlowCompanions } from '../lib/pipeline/flowCompanions'
import { readCampaignFacts, runCampaign, writePublicationPack } from '../lib/pipeline/campaign'
import { addPublicationPage, planPublication, runPublication } from '../lib/pipeline/publication'
import { flowScreenName } from '../lib/flows'
import { isFoldId } from '../lib/folds'
import { projectRulesSection } from '../lib/rules'
import { brandByName, brandOfProject, brandSection, brandsOfDesign, defaultBrandId, type BrandIdentity } from '../lib/brand'
import { composerPageFormat } from '../lib/documentMode'
import { CAMPAIGN_FORMAT_IDS, factSnapshot, isCampaignFormatId, normalizeCampaign, sortFormats, type CampaignFormatId } from '../lib/campaign'
import { translateCode, TRANSLATE_LANGS, type TranslateLang } from '../lib/translate'
import { applyFill, type FillRefusal } from '../lib/fillFields'
import { SERIES_MAX } from '../lib/fillSeries'
import { runPreflight } from '../lib/docExport/preflight'
import type { PackCaption, PackNetwork } from '../lib/publicationPack'
import { isPublicationKind, latestPublication, upsertPublication, type Publication } from '../lib/publication'
import { buildGenerationMessages, detectComponentName, finishGeneratedCode } from '../lib/generate'
import { isEnvironmentError, MAX_FIX_ATTEMPTS } from '../lib/previewErrors'
import { editScreen, fixScreenAudit, polishScreenCode } from '../lib/pipeline/screenPasses'
import { auditScreen, type AuditReport } from '../lib/audit'
import { isScreenThemeId } from '../lib/screenThemes'
import { canvasScale, isPageFormat } from '../lib/pageFormats'
import { translate, type TranslationKey } from '../i18n'
import Preview, { previewDocument } from '../components/Preview'

/**
 * What a job does. `new` (the default) makes a screen; the others work on one
 * that exists — each calls ONE of the correction passes, never a mix (CLAUDE.md,
 * "four independent correction passes"): an edit, the quality pass, the
 * SEO/accessibility report, or that report followed by its own correction.
 * Three more rewrite WITHOUT laying out again ("Rewrites without a model"):
 * `translate` and `fill` make copies beside the screen (fill may write the
 * screen itself), and `pack` writes the words under a campaign's pieces.
 */
export type RunnerKind = 'new' | 'edit' | 'polish' | 'audit' | 'auditFix' | 'campaign' | 'publication' | 'translate' | 'fill' | 'pack'

/**
 * The kinds that MAKE screens rather than work on one: a screen (and the pages
 * of its flow), a campaign's pieces, a publication's sheets. All three run the
 * composer's own functions on the same request and hooks.
 */
const MAKING: readonly RunnerKind[] = ['new', 'campaign', 'publication']

/** What the server asks for. Validated there; read defensively here anyway. */
export interface RunnerJob {
  kind?: RunnerKind
  /** The screen an edit, a polish or an audit works on (with `projectId`). */
  screenId?: string
  /** An edit's instruction — the person's words, as the composer passes them. */
  instruction?: string
  /** An audit's model-judged half (a model call), as the panel's "deep" switch. */
  deep?: boolean
  /** The language a `translate` job writes the copy in (lib/translate.ts). */
  toLang?: string
  /**
   * A `fill` job: one row fills one copy (or, with `into: 'here'` and one row,
   * the screen itself). A row's values are keyed by a field's label or id, as
   * "Remplir…" names them; a picture's value is a library hash.
   */
  fill?: { into?: 'copy' | 'here'; rows: Array<{ label?: string; values: Record<string, string> }> }
  brief: string
  /** An existing project of the account, or absent for a new one. */
  projectId?: string
  projectName?: string
  device?: 'desktop' | 'mobile' | 'tablet'
  /** The composer's "Type d'écran" (SCREEN_THEME_IDS): it sets a document's page and a post's frame. */
  screenType?: string
  /** A document's page size (PageFormatId), when the request named one; else the type's own. */
  pageFormat?: string
  /** Library hashes the server has checked belong to this account, with what each is for. */
  pictures?: Array<{ hash: string; use: string; pixelArt?: boolean }>
  /** Where Mocky finds a picture itself when none was supplied: the composer's "Images" choice. */
  pictureSource?: 'auto' | 'free' | 'generated' | 'none'
  /** What Mocky's own picture should show, in the assistant's words (English works best). */
  pictureSubject?: string
  /** The screen's name on the canvas, when the assistant gave one. */
  screenName?: string
  muse?: boolean
  lang?: 'fr' | 'en'
  /**
   * Who writes the code: Mocky's model (absent, `mocky`) or the assistant's
   * (`client`, phase 4) — then the page waits for it (`__mockyRunnerAwaitCode`).
   */
  engine?: 'mocky' | 'client'
  /**
   * The composer's "Parcours": a web screen gets the flow kit and the pages it
   * leads to (lib/pipeline/flowCompanions.ts); a document gets its sequence of
   * pages (lib/docSequence.ts). Absent builds the request it always built.
   */
  flows?: boolean
  /** A folded leaflet's fold (lib/folds.ts), for a type that folds. */
  fold?: string
  /** A campaign's formats (lib/campaign.ts), for `kind: 'campaign'`. */
  formats?: string[]
  /** A NEW project made in the account's brand identity (`Project.useBrand`). */
  useBrand?: boolean
  /** Which of the account's brands, by its name; absent is the first. */
  brandName?: string
  /** A NEW project made in Créatif (`Project.creative`, lib/creative.ts). */
  creative?: boolean
  /**
   * A NEW project started from one of the account's project templates, as
   * "New project from this template" starts it (lib/templates.ts): its
   * direction, settings and screens, with fresh ids. The server read it from
   * the account's own store; the page only instantiates it.
   */
  template?: ProjectTemplate
  /** A document that copies the composition of one already in the project (`NewScreenRequest.followLayout`). */
  followLayout?: boolean
  /** Saved templates given as examples of the series (`NewScreenRequest.inspirations`), read by the server. */
  inspirations?: Array<{ name: string; design?: string; screens: { code: string; page?: string; theme?: string }[] }>
}

export interface RunnerResult {
  projectId: string
  screenId: string
  code: string
  w: number
  h: number
  caps: string[]
  notices: string[]
  picture: 'provided' | 'free' | 'generated' | 'none'
  error?: string
  kind?: RunnerKind
  /** Whether the pass rewrote the screen — a polish that found nothing does not. */
  changed?: boolean
  polish?: { score: number | null; stopped: string; fixed: string[]; residual: string[]; iterations: number }
  audit?: RunnerAudit
  /** What the accessibility correction resolved and left. */
  auditFix?: { fixed: string[]; residual: string[]; stopped: string }
  /** A translation: how many runs there were, were written, kept their words. */
  translate?: { lang: string; total: number; written: number; kept: number }
  /** A fill: the fields written (by label), and those refused with the reason, per row. */
  fill?: { into: 'copy' | 'here'; written: string[]; refused: string[]; unknown: string[] }
  /** The publication pack: the captions as written, and how many pieces got a text alternative. */
  pack?: { captions: Partial<Record<PackNetwork, PackCaption>>; alts: number; pieces: number }
  /**
   * Every screen the job made, in order, when it made more than one: a
   * campaign's pieces, a publication's sheets, a screen and the pages of its
   * flow. `screenId` is the first of them, the one photographed.
   */
  screens?: Array<{ screenId: string; name: string; role: string }>
  /** What made `screens`. */
  collection?: 'flow' | 'campaign' | 'publication' | 'series'
}

/** The SEO / accessibility report as it leaves the page: scores and named findings, no source. */
export interface RunnerAudit {
  seo: number
  a11y: number
  parsed: boolean
  judged: boolean
  findings: Array<{ rule: string; name: string; dimension?: string; priority?: string; fixable: boolean }>
  notices: string[]
}

declare global {
  interface Window {
    __mockyRunner?: {
      run: (job: RunnerJob) => Promise<RunnerResult>
      show: (spec: { code: string; w: number; h: number; caps: string[] }) => Promise<{ height: number }>
      /** The same screen as a live document, animations on, for the MCP live view (server/mcp/view.js). */
      document: (spec: { code: string; caps: string[] }) => string
      /** One downloadable file of a screen (PNG, .pptx, PDF), as base64. */
      exportScreen: (spec: { screen: Partial<Screen>; kind: string; lang?: string }) => Promise<{
        base64: string
        filename: string
        mime: string
        pages: number
        notices: string[]
      }>
      /** The pre-export check of a document, worded in `lang` (lib/docExport/preflight.ts). */
      checkDocument: (spec: { screen: Partial<Screen>; lang?: string }) => Promise<RunnerCheck>
    }
    /** Exposed by the server (page.exposeFunction): where progress goes. */
    __mockyRunnerProgress?: (phase: string) => void
    /**
     * Exposed by the server for a "client" job: publish what the assistant must
     * answer, and resolve with the code it sends through submit_screen.
     */
    __mockyRunnerAwaitCode?: (contract: { system: string; user: string; round: number; renderError?: string }) => Promise<string>
  }
}

const progress = (phase: string) => {
  try {
    window.__mockyRunnerProgress?.(phase)
  } catch {
    /* progress is a courtesy */
  }
}

/**
 * The account's own DESIGN.md, when it is switched on — the composer's
 * `loadDesign()`, read from the copy the account syncs instead of from a
 * browser's storage. A project without a direction of its own follows it there,
 * so it follows it here.
 */
function globalDesignFrom(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  try {
    const d = { ...defaultDesign(), ...(JSON.parse(raw) as object) }
    return isDesignActive(d) ? d.markdown : undefined
  } catch {
    return undefined
  }
}

/** The account's brands, from its synced design blob (lib/brand.ts). */
function brandsFrom(raw: string | null | undefined): BrandIdentity[] {
  if (!raw) return []
  try {
    return brandsOfDesign(JSON.parse(raw) as { brands?: unknown; brand?: unknown })
  } catch {
    return []
  }
}

/** The brand a project is in, read off the account's design blob, or none. */
function brandFrom(raw: string | null | undefined, project: { useBrand?: boolean; brandId?: string }): BrandIdentity | undefined {
  return brandOfProject(project, brandsFrom(raw))
}

/**
 * The brand an assistant NAMED for a new project, as the project's
 * `brandId`. A name the account does not have is refused with the names it
 * does have: a visual made in the wrong client's identity is worse than none.
 */
function brandIdFor(raw: string | null | undefined, name: string | undefined): string | undefined {
  const wanted = typeof name === 'string' ? name.trim() : ''
  const brands = brandsFrom(raw)
  // No name: the brand the composer would choose, written down like the composer does.
  if (!wanted) return defaultBrandId({}, brands)
  const found = brandByName(brands, wanted)
  if (!found) throw new Error(`unknown brand "${wanted.slice(0, 80)}" — this account's brands: ${brands.map((b) => b.name || b.id).join(', ') || 'none'}`)
  return found.id
}

async function run(job: RunnerJob): Promise<RunnerResult> {
  if (job.kind === 'pack') return runPack(job)
  if (job.kind && !MAKING.includes(job.kind)) return runOnScreen(job)
  const lang = job.lang === 'en' ? 'en' : 'fr'
  const t = (key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars)
  const brief = String(job.brief || '').trim()
  if (!brief) throw new Error('empty brief')

  progress('reading')
  const data = await api.getData()
  const all = parseProjects(data.projects)
  const now = Date.now()
  const brandId = job.useBrand ? brandIdFor(data.design, job.brandName) : undefined
  let project: Project | undefined = job.projectId ? all.find((p) => p.id === job.projectId && !p.deletedAt) : undefined
  // A project id that is not this account's reads as "no such project" (X4):
  // the server already refused it, and a new project is not what was asked.
  if (job.projectId && !project) throw new Error('project not found')
  if (!project && job.template && Array.isArray(job.template.screens)) {
    // The template's screens come along on purpose: with `followLayout` they are
    // the model the new document copies (`pickLayoutModel`) — the point of
    // starting from a template rather than from its DESIGN.md alone.
    project = projectFromTemplate(job.template, { name: String(job.projectName || '').trim().slice(0, 120) || job.template.name, now })
    if (job.useBrand) project.useBrand = true
    if (brandId) project.brandId = brandId
    if (job.creative) project.creative = true
  }
  // From examples: a new project in the FIRST example's direction (its DESIGN.md: palette, typefaces), none of
  // their screens — the examples are references for the model, not screens of this project.
  const exampleDesign = !project && !job.template ? job.inspirations?.find((x) => typeof x?.design === 'string' && x.design.trim())?.design : undefined
  if (!project) {
    project = {
      id: newId(),
      ...(exampleDesign ? { design: exampleDesign, ...(extractProductName(exampleDesign) ? { productName: extractProductName(exampleDesign) as string } : {}) } : {}),
      name: String(job.projectName || '').trim().slice(0, 120) || DEFAULT_PROJECT_NAME,
      createdAt: now,
      updatedAt: now,
      screens: [],
      // The assistant asked for the person's brand: the new project keeps it on,
      // as the composer's "Marque" button would.
      ...(job.useBrand ? { useBrand: true } : {}),
      ...(brandId ? { brandId } : {}),
      ...(job.creative ? { creative: true } : {}),
    }
  }

  // The working copy every hook writes into. Only THIS project goes back to the
  // server, which merges it (server/merge.js): the account's other projects are
  // never rewritten by a generation.
  let working: Project = { ...project, screens: [...project.screens] }
  // The job's model calls are this project's, in the administrator's spending.
  setUsageProject(project.id)
  const notices: string[] = []
  const say = (line: string) => line && notices.push(line)

  const settings = defaultSettings()
  const museConfig = { ...defaultMuseConfig(), enabled: job.muse === true }
  const presetId = job.device === 'mobile' || job.device === 'tablet' ? job.device : 'desktop'
  const controller = new AbortController()

  /*
   * Where pictures come from when the assistant brought none — the composer's
   * "Images" choice, which the runner used to hard-wire to "none": a post or a
   * flyer asked for from ChatGPT came back with no picture, even when asked
   * for one. Pictures the assistant supplied always win; then `auto` takes free
   * photos when this account has them, a generated picture otherwise, and says
   * nothing could be had when neither door is open.
   */
  const provided = (job.pictures || [])
    .filter((p) => /^[a-f0-9]{64}$/.test(String(p?.hash)))
    .map((p) => ({ hash: p.hash, url: absoluteUrl(imageUrl(p.hash)), use: String(p.use || ''), ...(p.pixelArt === true ? { pixelArt: true } : {}) }))
  const stockOk = stockUsable(await stockImageStatus().catch(() => null))
  const generationOk = await imageGenerationAvailable().catch(() => false)
  const wanted = job.pictureSource || 'auto'
  /*
   * `auto` takes a free photo only when Mocky's model can LOOK at the
   * candidates. Without eyes the finder takes the first result, and the first
   * result for a badly worded search is anything at all — a real post about a
   * food festival came back with a war grave. A generated picture of the right
   * subject beats a lottery; the lottery stays only as the last resort.
   */
  const vision = wanted === 'auto' && stockOk && !provided.length ? (await checkVision().catch(() => ({ vision: null }))).vision : null
  const choice: DocumentImageChoice = provided.length || wanted === 'none'
    ? 'none'
    : wanted === 'free'
      ? 'stock'
      : wanted === 'generated'
        ? 'ai'
        : stockOk && vision === true
          ? 'stock'
          : generationOk
            ? 'ai'
            : stockOk
              ? 'stock'
              : 'none'
  const docPictureSource = documentPictureSource(choice, { generation: generationOk, stock: stockOk })

  const request: NewScreenRequest = {
    text: brief,
    settings,
    project: working,
    screens: working.screens,
    ...(job.followLayout === true ? { followLayout: true } : {}),
    ...(Array.isArray(job.inspirations) && job.inspirations.length ? { inspirations: job.inspirations } : {}),
    images: [],
    annotationCount: 0,
    site: null,
    globalMd: globalDesignFrom(data.design),
    presetId,
    themeId: isScreenThemeId(job.screenType) ? job.screenType : null,
    pageFormatId: isPageFormat(job.pageFormat) ? job.pageFormat : null,
    redesign: false,
    museConfig,
    museAvail: job.muse ? await museAvailable().catch(() => false) : false,
    museVision: vision,
    /*
     * With Muse on, the assistant's pictures are PINS: Muse looks at the
     * first one before writing its dossier and fills its slots with them
     * instead of painting its own. Passed only as a page section, they met a
     * dossier written blind and a hero Muse had generated anyway — a cosy
     * pumpkin photo under a palette and a picture chosen for another mood.
     */
    pinnedImages: job.muse ? provided.map((p) => ({ hash: p.hash, url: p.url, label: p.use })) : [],
    pinnedVideo: null,
    videoAvail: null,
    motionAvail: null,
    ultraActive: false,
    ultraCount: 3,
    effectiveImageSource: docPictureSource ?? (stockOk ? 'stock' : 'ai'),
    docPictureSource,
    docImageChoice: choice,
    imageGenOk: generationOk,
    stockImagesUsable: stockOk,
    providedPictures: provided,
    pictureSubject: typeof job.pictureSubject === 'string' ? job.pictureSubject.slice(0, 300) : undefined,
    ...(job.engine === 'client' ? { writer: assistantWriter(say) } : {}),
    ...(job.flows ? { flows: true } : {}),
    ...(isFoldId(job.fold) ? { foldId: job.fold } : {}),
    // The account's brand, when this project uses it — read from the same
    // design blob the composer reads it from (lib/brand.ts).
    ...(brandFrom(data.design, working) ? { brand: brandFrom(data.design, working) } : {}),
    // Créatif, when the project is in it — set in the composer or by `creative`
    // above. With the "client" engine only the PROMPT section reaches the
    // assistant's model: an MCP server cannot set another model's temperature.
    ...(working.creative ? { creative: true } : {}),
  }
  const hooks: NewScreenHooks = {
    signal: controller.signal,
    t,
    setPhase: (p: NewScreenPhase | null) => p && progress(p),
    setMuseStage: (label) => label && progress(`muse: ${label}`),
    setUltraStage: () => {},
    replaceNotice: (line) => {
      notices.length = 0
      say(line)
    },
    notice: say,
    setMuseResult: () => {},
    setMuseImages: () => {},
    setMuseImageError: (m) => m && say(m),
    setImageGenOk: () => {},
    addScreen: (s) => {
      const k = canvasScale(s.page)
      const w = (typeof s.w === 'number' ? s.w : 1440) * k
      const h = (typeof s.h === 'number' ? s.h : 900) * k
      working = { ...working, screens: [...working.screens, { ...s, ...placeScreen(working.screens, w, h) } as Screen], updatedAt: Date.now() }
    },
    updateScreen: (id, patch) => {
      working = { ...working, screens: working.screens.map((s) => (s.id === id ? { ...s, ...patch } : s)), updatedAt: Date.now() }
    },
    removeScreen: (id) => {
      working = {
        ...working,
        screens: working.screens.filter((s) => s.id !== id),
        removedScreens: { ...(working.removedScreens || {}), [id]: Date.now() },
        updatedAt: Date.now(),
      }
    },
    currentScreens: () => working.screens,
    renameProject: (name) => {
      working = { ...working, name: name.trim() || working.name, updatedAt: Date.now() }
    },
    setDesign: (markdown) => {
      const clean = markdown && markdown.trim() ? markdown : undefined
      const productName = clean ? extractProductName(clean) : null
      working = { ...working, design: clean, ...(productName ? { productName } : {}), updatedAt: Date.now() }
    },
    rememberSiteRef: () => {},
    screenStarted: () => progress('generating'),
    screenWritten: () => progress('checking'),
    motionStage: () => {},
    motionStageDone: () => {},
  }

  const made = await makeScreens(job, request, hooks, {
    settings,
    brief,
    lang,
    t,
    say,
    project: () => working,
    patchProject: (patch) => {
      working = { ...working, ...patch, updatedAt: Date.now() }
    },
  })
  const outcome = made.outcome

  // The name the assistant chose, rather than the first words of its brief —
  // which, written as an instruction, read "Créer directement dans Mocky le…".
  const name = typeof job.screenName === 'string' ? job.screenName.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
  if (name && !made.screens) working = { ...working, screens: working.screens.map((s) => (s.id === outcome.screenId ? { ...s, name } : s)) }

  progress('saving')
  working = { ...working, updatedAt: Date.now() }
  // No `design` field: this writer has never seen the account's DESIGN.md and
  // must not clear it (PUT /api/data keeps it when the field is absent).
  const res = await fetch('/api/data', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projects: JSON.stringify([working]) }),
  })
  if (!res.ok) throw new Error(`could not save the project (HTTP ${res.status})`)

  const screen = working.screens.find((s) => s.id === outcome.screenId)
  if (!screen) throw new Error('the screen was not kept')
  return {
    projectId: working.id,
    screenId: screen.id,
    code: screen.code,
    w: screen.w,
    h: screen.h,
    caps: screen.caps || [],
    notices,
    // Which picture the screen ended up with — said back to the assistant, so a
    // post without one is a fact it can repeat rather than a surprise.
    picture: provided.length ? 'provided' : screen.imageHash ? (docPictureSource === 'stock' ? 'free' : 'generated') : 'none',
    ...(outcome.error ? { error: outcome.error } : {}),
    ...(made.screens
      ? {
          collection: made.collection,
          screens: made.screens.map((m) => ({ ...m, name: working.screens.find((s) => s.id === m.screenId)?.name || m.name })),
        }
      : {}),
  }
}

/** The campaign an assistant gets when it names no format: the four a launch needs. */
const DEFAULT_CAMPAIGN_FORMATS: CampaignFormatId[] = ['poster', 'flyer', 'instagram', 'story']

/**
 * What a making job produces: one screen and, when asked, the pages of its
 * flow; or a campaign's pieces; or a publication's sheets. Each is the
 * composer's own function on the composer's own request — `runFlowCompanions`,
 * `runCampaign`, `runPublication` — so a campaign asked for from Claude is the
 * campaign the panel would have made (X5).
 */
async function makeScreens(
  job: RunnerJob,
  request: NewScreenRequest,
  hooks: NewScreenHooks,
  ctx: {
    settings: NewScreenRequest['settings']
    brief: string
    lang: 'fr' | 'en'
    t: (key: TranslationKey, vars?: Record<string, string | number>) => string
    say: (line: string) => void
    project: () => Project
    patchProject: (patch: Partial<Project>) => void
  },
): Promise<{
  outcome: { screenId: string; error?: string }
  screens?: Array<{ screenId: string; name: string; role: string }>
  collection?: 'flow' | 'campaign' | 'publication'
}> {
  const { t } = ctx
  if (job.kind === 'campaign') {
    const formats = sortFormats((job.formats || []).filter(isCampaignFormatId))
    const chosen = formats.length ? formats : DEFAULT_CAMPAIGN_FORMATS
    progress('campaign-facts')
    // The facts are a help, not a condition: a campaign without them is the
    // brief written once per format, which is still the campaign (Q1).
    const facts = await readCampaignFacts(ctx.settings, ctx.brief, hooks.signal).catch((err) => {
      if (err instanceof Error && err.name === 'AbortError') throw err
      return []
    })
    const campaign = normalizeCampaign({ brief: ctx.brief, facts, formats: chosen })
    if (campaign) ctx.patchProject({ campaign })
    const pieces = await runCampaign(request, hooks, { brief: ctx.brief, facts }, chosen, {
      getProject: ctx.project,
      nameFor: (f) => t(`campaign.format.${f}` as TranslationKey),
      all: chosen,
      onPiece: (f, n, total) => progress(`piece ${n}/${total}: ${f}`),
    })
    if (!pieces.length) throw new Error('the campaign made no piece')
    return {
      outcome: { screenId: pieces[0].screenId },
      collection: 'campaign',
      screens: pieces.map((p) => ({ screenId: p.screenId, name: t(`campaign.format.${p.format}` as TranslationKey), role: p.format })),
    }
  }
  if (job.kind === 'publication') {
    const kind = isPublicationKind(job.screenType) ? job.screenType : 'magazine'
    const page = composerPageFormat(kind, isPageFormat(job.pageFormat) ? job.pageFormat : null)
    if (!page) throw new Error('no page format for this publication')
    progress('planning')
    let pub: Publication = await planPublication(ctx.settings, kind, ctx.brief, page, {
      lang: ctx.lang,
      fallbackTitle: t(`composer.themes.${kind}` as TranslationKey),
      signal: hooks.signal,
    })
    const keep = () => ctx.patchProject({ publications: upsertPublication(ctx.project().publications, pub) })
    keep()
    const sheets = await runPublication({ ...request, themeId: kind, pageFormatId: page }, hooks, pub, {
      getProject: ctx.project,
      onDirection: (direction) => {
        pub = { ...pub, direction }
        keep()
      },
      onSheet: (title, n, total) => progress(`sheet ${n}/${total}: ${title.slice(0, 40)}`),
    })
    if (!sheets.length) throw new Error('the publication made no sheet')
    return {
      outcome: { screenId: sheets[0].screenId },
      collection: 'publication',
      screens: sheets.map((p) => {
        const sheet = pub.sheets.find((s) => s.id === p.sheet)
        return { screenId: p.screenId, name: sheet?.title || p.sheet, role: sheet?.role || 'sheet' }
      }),
    }
  }
  /*
   * A magazine or a book asked for in a project that already has one GROWS it
   * by one inside page, as the composer does: `add_screen` is how an assistant
   * adds pages after `create_publication`.
   */
  const growing = isPublicationKind(job.screenType) ? latestPublication(ctx.project().publications, job.screenType) : undefined
  if (growing) {
    const page = await addPublicationPage(request, hooks, growing, ctx.brief, {
      getProject: ctx.project,
      onPublication: (pub) => ctx.patchProject({ publications: upsertPublication(ctx.project().publications, pub) }),
      title: job.screenName?.trim() || deriveName(ctx.brief),
    })
    if (!page) throw new Error('the page was not made')
    return { outcome: { screenId: page.screenId } }
  }
  const outcome = await runNewScreen(request, hooks)
  const made = ctx.project().screens.find((s) => s.id === outcome.screenId)
  // The pages a web screen leads to, as the composer makes them with Parcours
  // on — never for a document, never after a broken screen.
  if (!job.flows || outcome.error || !made || made.page) return { outcome }
  try {
    const companions = await runFlowCompanions(request, hooks, outcome.screenId, outcome.code ?? '', {
      getProject: ctx.project,
      nameFor: (route) => flowScreenName(route, (k) => t(k as TranslationKey)),
    })
    if (!companions.length) return { outcome }
    return {
      outcome,
      collection: 'flow',
      screens: [
        { screenId: outcome.screenId, name: made.name, role: made.route || 'home' },
        ...companions.map((c) => ({ screenId: c.screenId, name: flowScreenName(c.route, (k) => t(k as TranslationKey)), role: c.route })),
      ],
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err
    ctx.say(t('flows.failed', { error: err instanceof Error ? err.message : String(err) }))
    return { outcome }
  }
}


/** How long a written screen may take to show itself before it is taken as rendering. */
const RENDER_CHECK_MS = 15_000
/** After the first size report, how long an error still counts as this render's. */
const RENDER_QUIET_MS = 1500

/**
 * Render `code` off screen and say whether it failed — the same signal the
 * composer's repair loop listens to. An error about the ENVIRONMENT (a runtime
 * that did not load) is not the code's, and is never sent back as one.
 */
function renderError(code: string, frame: { w: number; h: number }, caps: string[]): Promise<string | null> {
  const host = document.createElement('div')
  host.style.cssText = `position:absolute;left:-20000px;top:0;width:${frame.w}px;height:${frame.h}px`
  document.body.appendChild(host)
  const root = createRoot(host)
  return new Promise((resolve) => {
    let settled = false
    let quiet: number | null = null
    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      if (quiet) window.clearTimeout(quiet)
      window.setTimeout(() => {
        root.unmount()
        host.remove()
      }, 0)
      resolve(value)
    }
    // Silence is not an error: a screen that never reports is photographed
    // later anyway, and its picture is the evidence.
    const timer = window.setTimeout(() => finish(null), RENDER_CHECK_MS)
    root.render(
      <div style={{ width: frame.w, height: frame.h }}>
        <Preview
          code={code}
          caps={caps}
          hideScrollbars
          animations={false}
          onContentHeight={() => {
            if (!quiet) quiet = window.setTimeout(() => finish(null), RENDER_QUIET_MS)
          }}
          onError={(e) => finish(isEnvironmentError(e) ? null : e)}
        />
      </div>,
    )
  })
}

/**
 * The "client" engine's writer (phase 4): the assistant's model writes the code.
 *
 * It is handed the two turns Mocky's own model would have been sent
 * (`buildGenerationMessages`), and what it sends back goes through the one
 * finish every generated screen goes through (`finishGeneratedCode`: I4, I1,
 * I6). Then it is rendered, and a render error — that error alone (I5) — goes
 * back to the assistant to fix, as many times as the composer's own repair
 * loop tries. After that the screen is kept as it is and the error is said.
 */
function assistantWriter(say: (line: string) => void): ScreenWriter {
  return async (input) => {
    const awaitCode = window.__mockyRunnerAwaitCode
    if (!awaitCode) throw new Error('no assistant is waiting to write this code')
    const { system, user } = buildGenerationMessages(input.text, input.extraSystem, undefined, input.caps, input.planSection)
    let problem: string | undefined
    for (let round = 0; ; round++) {
      progress('awaiting_code')
      const raw = await awaitCode({ system, user, round, ...(problem ? { renderError: problem } : {}) })
      progress('checking')
      const done = await finishGeneratedCode(String(raw || ''))
      const error = done.code.trim()
        ? await renderError(done.code, input.frame, input.capIds)
        : 'No component was found in what was sent: send one complete `export default function App()`.'
      if (!error) return { ...done, truncated: false }
      if (round >= MAX_FIX_ATTEMPTS) {
        say(`The screen does not render: ${error.slice(0, 300)}`)
        return { ...done, truncated: false }
      }
      problem = error
    }
  }
}

/**
 * What leaves the page of an audit report: scores, rule ids and names — never a snippet of source.
 * A finding's `name` is an i18n KEY (`audit.rule.lowContrast`), which the panel
 * passes through `t()`; the assistant has no `t()`, so it gets the sentence.
 */
function auditSummary(r: AuditReport, t: (key: TranslationKey) => string): RunnerAudit {
  return {
    seo: r.seo.score,
    a11y: r.a11y.score,
    parsed: r.parsed,
    judged: r.coverage.judged,
    findings: r.findings.map((f) => ({
      rule: f.rule,
      name: t(f.name as TranslationKey),
      ...(f.dimension ? { dimension: f.dimension } : {}),
      ...(f.priority ? { priority: f.priority } : {}),
      // Only enforceable findings may be spent a correction pass on (Q2).
      fixable: f.disposition !== 'advise',
    })),
    notices: r.notices,
  }
}

/**
 * An edit, a polish or an audit of a screen that exists — through
 * lib/pipeline/screenPasses.ts, the functions the composer's own buttons call.
 *
 * The write-back keeps the composer's conventions: `previousCode` so "Revert"
 * in Mocky undoes what the assistant did, and a `codeAtStart` check against the
 * account's data as it stands when the pass ENDS — a person may have changed
 * that screen in a tab meanwhile, and their change wins, as it does against a
 * polish they started themselves.
 */
async function runOnScreen(job: RunnerJob): Promise<RunnerResult> {
  const kind = job.kind as Exclude<RunnerKind, 'new'>
  const lang = job.lang === 'en' ? 'en' : 'fr'
  const t = (key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars)

  progress('reading')
  const data = await api.getData()
  const find = (raw: string | null) => {
    const project = parseProjects(raw).find((p) => p.id === job.projectId && !p.deletedAt)
    return { project, screen: project?.screens.find((s) => s.id === job.screenId) }
  }
  const { project, screen } = find(data.projects)
  // Not this account's reads as missing (X4); the server already checked.
  if (!project || !screen || !screen.code.trim()) throw new Error('screen not found')
  setUsageProject(project.id)
  // A project in the account's brand keeps it through an edit, as in the composer.
  const projectDirection = designForProject(project, globalDesignFrom(data.design))
  const brand = brandFrom(data.design, project)
  const brandText = brand ? brandSection(brand, (h) => absoluteUrl(imageUrl(h))) : undefined
  const rulesText = projectRulesSection(project.rules)
  const designMd = [projectDirection, brandText, rulesText].filter(Boolean).join('\n\n') || undefined
  const settings = defaultSettings()
  const signal = new AbortController().signal
  const codeAtStart = screen.code
  const notices: string[] = []
  let patch: Partial<Screen> | null = null
  /** New screens a pass makes BESIDE the one it read (a translation, filled copies), in order. */
  const copies: Screen[] = []
  const result: Partial<RunnerResult> = { kind }

  if (kind === 'translate') {
    const to = TRANSLATE_LANGS.find((l) => l === job.toLang) as TranslateLang | undefined
    if (!to) throw new Error(`unknown language: ${String(job.toLang).slice(0, 10)}`)
    progress('translating')
    const res = await translateCode(settings, codeAtStart, to, signal)
    result.translate = { lang: to, total: res.total, written: res.written, kept: res.kept }
    if (res.written) copies.push(copyOf(screen, { code: res.code, name: t('translate.copyName', { name: screen.name, code: to.toUpperCase() }) }))
  } else if (kind === 'fill') {
    const fields = screen.fill
    if (!fields?.length) {
      throw new Error(
        lang === 'fr'
          ? 'Cet écran n’a pas de champs à remplir : dans Mocky, clic droit sur l’écran → « Remplir… » pour les choisir.'
          : 'This screen has no fields to fill: in Mocky, right-click the screen → "Fill…" to choose them.',
      )
    }
    const rows = (job.fill?.rows || []).slice(0, SERIES_MAX)
    if (!rows.length) throw new Error('no values')
    const into = job.fill?.into === 'here' && rows.length === 1 ? 'here' : 'copy'
    // A key is the person's own name for a field (its label, any case) or its id.
    const fieldOf = (key: string) => {
      const k = key.trim().toLowerCase()
      return fields.find((f) => f.id === key) ?? fields.find((f) => f.label.trim().toLowerCase() === k)
    }
    const reasons: Record<FillRefusal, string> = {
      missing: t('fill.reason.missing'),
      empty: t('fill.reason.empty'),
      unsafe: t('fill.reason.unsafe'),
      notImage: t('fill.reason.notImage'),
    }
    const unknown = new Set<string>()
    const written = new Set<string>()
    const refused: string[] = []
    progress('filling')
    for (const [i, row] of rows.entries()) {
      const values: Record<string, string> = {}
      for (const [key, value] of Object.entries(row.values || {})) {
        const f = fieldOf(key)
        if (f) values[f.id] = String(value)
        else unknown.add(key.slice(0, 60))
      }
      // From the ORIGINAL every time, as fillSeries does: an empty cell keeps the screen's value, not the previous row's.
      const res = await applyFill(codeAtStart, fields, values, window.location.origin)
      const labelOf = (id: string) => fields.find((f) => f.id === id)?.label ?? id
      for (const id of res.written) written.add(labelOf(id))
      const rowName = row.label?.trim() || String(i + 1)
      for (const r of res.refused) refused.push(`${rows.length > 1 ? `${rowName} : ` : ''}${labelOf(r.id)} (${reasons[r.reason]})`)
      if (!res.written.length) continue
      if (into === 'here') {
        patch = { code: res.code, componentName: detectComponentName(res.code), previousCode: codeAtStart, fill: res.fields }
        continue
      }
      const first = res.fields.find((f) => f.kind === 'text' && res.written.includes(f.id))
      const value = (row.label?.trim() || first?.value || t('fill.picture')).slice(0, 32)
      copies.push(copyOf(screen, { code: res.code, name: t('fill.copyName', { name: screen.name, value }), fill: res.fields }))
    }
    result.fill = { into, written: [...written], refused: refused.slice(0, 20), unknown: [...unknown].slice(0, 20) }
    if (copies.length > 1) {
      result.collection = 'series'
      result.screens = copies.map((c) => ({ screenId: c.id, name: c.name, role: 'copy' }))
    }
  } else if (kind === 'edit') {
    const instruction = String(job.instruction || '').trim()
    if (!instruction) throw new Error('empty instruction')
    progress('editing')
    const res = await editScreen({ settings, instruction, screen, designMd, signal })
    patch = { code: res.code, componentName: res.componentName, previousCode: codeAtStart, caps: res.caps }
    // A Motion Ultra screen can lose its pictures or its kit to an edit about
    // one line (U5). Said, not undone: Revert is one click away in Mocky.
    if (res.loss) {
      const what = [
        res.loss.images.length ? t('project.ultraLossImages', { count: res.loss.images.length }) : '',
        res.loss.kit ? t('project.ultraLossKit') : '',
      ].filter(Boolean).join(t('project.ultraLossAnd'))
      notices.push(t('project.ultraEditLoss', { what, name: screen.name }))
    }
    if (res.interactLost) notices.push(interactLossNotice(t, screen.name, res.interactLost))
  } else if (kind === 'polish') {
    progress('polishing')
    const { outcome, record, caps } = await polishScreenCode({
      settings,
      screen,
      designMd,
      signal,
      onPass: (i, n) => progress(`polishing ${i} (${n} open)`),
    })
    if (outcome.code !== codeAtStart) {
      patch = {
        code: outcome.code,
        componentName: detectComponentName(outcome.code),
        previousCode: codeAtStart,
        caps,
        ...(record ? { quality: record } : {}),
      }
    } else if (record) {
      patch = { quality: record }
    }
    result.polish = {
      score: record ? record.score : null,
      stopped: outcome.stopped,
      fixed: outcome.fixed.map((f) => f.name),
      residual: outcome.residual.map((f) => f.name),
      iterations: outcome.iterations,
    }
  } else {
    progress('auditing')
    const report = await auditScreen(codeAtStart, { deep: job.deep === true, settings, signal })
    result.audit = auditSummary(report, t)
    const correctable = report.findings.filter((f) => f.disposition !== 'advise')
    if (kind === 'auditFix' && correctable.length) {
      progress('fixing')
      const outcome = await fixScreenAudit({ settings, screen, designMd, findings: correctable, signal })
      // Deliberately no `quality`: that field is the /20 design audit, and an
      // accessibility number in it would make two measurements share one.
      if (outcome.code !== codeAtStart) {
        patch = { code: outcome.code, componentName: detectComponentName(outcome.code), previousCode: codeAtStart }
      }
      result.auditFix = {
        fixed: outcome.fixed.map((f) => t(f.name as TranslationKey)),
        residual: outcome.residual.map((f) => t(f.name as TranslationKey)),
        stopped: outcome.stopped,
      }
    }
  }

  let saved = screen
  if (patch || copies.length) {
    progress('saving')
    // Applied to the project as it is NOW, so a screen added or renamed meanwhile
    // is kept; and dropped when this very screen moved under the pass. A copy
    // never writes the original, so it only needs the original to still exist.
    const fresh = find((await api.getData()).projects)
    if (!fresh.project || !fresh.screen || (patch && fresh.screen.code !== codeAtStart)) {
      throw new Error(
        lang === 'fr'
          ? 'Cet écran a été modifié pendant le travail : rien n’a été remplacé.'
          : 'This screen was changed while the work ran: nothing was replaced.',
      )
    }
    saved = patch ? { ...fresh.screen, ...patch } : fresh.screen
    let screens = fresh.project.screens.map((s) => (s.id === saved.id ? saved : s))
    // Each copy right of the one before, so a series reads as a row (fillSeries).
    let anchor: Screen = saved
    for (const c of copies) {
      const placed = { ...c, ...placeBeside(screens, anchor, c.w, c.h) }
      screens = [...screens, placed]
      anchor = placed
    }
    if (copies.length) saved = screens.find((s) => s.id === copies[0].id) as Screen
    const working: Project = {
      ...fresh.project,
      screens,
      updatedAt: Date.now(),
    }
    const res = await fetch('/api/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projects: JSON.stringify([working]) }),
    })
    if (!res.ok) throw new Error(`could not save the project (HTTP ${res.status})`)
  }

  return {
    ...result,
    projectId: project.id,
    screenId: saved.id,
    code: saved.code,
    w: saved.w,
    h: saved.h,
    caps: saved.caps || [],
    notices,
    picture: 'none',
    changed: copies.length > 0 || saved.code !== codeAtStart,
  }
}

/**
 * A copy of a screen, as "Traduire…" and "Remplir…" make one in the composer:
 * what the screen IS travels, what was said ABOUT it stays — its links and
 * route drive the original's demo, its notes and quality report describe other
 * words, a campaign or publication place is the original's. Placed by the save.
 */
function copyOf(screen: Screen, over: { code: string; name: string; fill?: Screen['fill'] }): Screen {
  const {
    links: _links,
    userNotes: _notes,
    route: _route,
    quality: _quality,
    campaign: _campaign,
    publication: _publication,
    previousCode: _prev,
    ...rest
  } = screen
  return {
    ...rest,
    id: newId(),
    name: over.name,
    code: over.code,
    componentName: detectComponentName(over.code),
    createdAt: Date.now(),
    links: [],
    ...(over.fill ? { fill: over.fill } : {}),
  }
}

/**
 * The publication pack of a project's campaign (lib/publicationPack.ts): the
 * captions and a text alternative per piece, in the one call the panel makes
 * (`writePublicationPack`). The captions land on `Campaign.pack` with the facts
 * they were written with, each alternative on its piece with the digest of the
 * code it describes — so "out of date" stays read, never stored.
 */
async function runPack(job: RunnerJob): Promise<RunnerResult> {
  const lang = job.lang === 'en' ? 'en' : 'fr'
  const t = (key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars)
  progress('reading')
  const data = await api.getData()
  const project = parseProjects(data.projects).find((p) => p.id === job.projectId && !p.deletedAt)
  if (!project) throw new Error('project not found')
  const campaign = normalizeCampaign(project.campaign)
  const pieces = project.screens
    .filter((s): s is Screen & { campaign: NonNullable<Screen['campaign']> } => !!s.campaign && !!s.code.trim())
    .sort((a, b) => CAMPAIGN_FORMAT_IDS.indexOf(a.campaign.format) - CAMPAIGN_FORMAT_IDS.indexOf(b.campaign.format) || a.createdAt - b.createdAt)
  if (!campaign || !pieces.length) {
    throw new Error(
      lang === 'fr'
        ? 'Ce projet n’est pas une campagne (ou n’a encore aucune création) : le pack de publication s’écrit pour les créations d’une campagne.'
        : 'This project is not a campaign (or has no pieces yet): the publication pack is written for a campaign’s pieces.',
    )
  }
  setUsageProject(project.id)
  progress('writing')
  const res = await writePublicationPack(
    defaultSettings(),
    campaign,
    pieces.map((p) => ({ id: p.id, code: p.code, format: p.campaign.format, formatLabel: t(`campaign.format.${p.campaign.format}` as TranslationKey) })),
    project.name,
  )
  if (!Object.keys(res.captions).length) throw new Error(t('campaign.pack.empty'))

  progress('saving')
  const fresh = parseProjects((await api.getData()).projects).find((p) => p.id === project.id && !p.deletedAt)
  if (!fresh) throw new Error('project not found')
  const freshCampaign = normalizeCampaign(fresh.campaign) ?? campaign
  const working: Project = {
    ...fresh,
    campaign: { ...freshCampaign, pack: { captions: res.captions, facts: factSnapshot(freshCampaign.facts) } },
    screens: fresh.screens.map((s) => (s.campaign && res.alts[s.id] ? { ...s, campaign: { ...s.campaign, alt: { text: res.alts[s.id], of: res.digests[s.id] } } } : s)),
    updatedAt: Date.now(),
  }
  const saved = await fetch('/api/data', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projects: JSON.stringify([working]) }),
  })
  if (!saved.ok) throw new Error(`could not save the project (HTTP ${saved.status})`)
  const first = pieces[0]
  return {
    kind: 'pack',
    projectId: project.id,
    screenId: first.id,
    code: first.code,
    w: first.w,
    h: first.h,
    caps: first.caps || [],
    notices: [],
    picture: 'none',
    changed: false,
    pack: { captions: res.captions, alts: Object.keys(res.alts).length, pieces: pieces.length },
  }
}

/** The pre-export check as it leaves the page: worded, no source and no measured element. */
export interface RunnerCheck {
  pages: number
  checks: Array<{ id: string; label: string; status: 'ok' | 'info' | 'warn' | 'na'; notes: string[] }>
}

/**
 * The pre-export check (lib/docExport/preflight.ts) of a document that exists,
 * as the Download dialog runs it: rendered, measured, judged — no model, no
 * file, no write. Worded here, with the dialog's own sentences.
 */
async function checkDocument(spec: { screen: Partial<Screen>; lang?: string }): Promise<RunnerCheck> {
  const screen = normalizeScreen(spec.screen || {}, 0)
  if (!screen.code.trim()) throw new Error('empty screen')
  if (!screen.page) throw new Error('not a document')
  const lang = spec.lang === 'en' ? 'en' : 'fr'
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key as TranslationKey, vars)
  const report = await runPreflight(screen, { unnamed: (n) => t('docExport.check.picture', { n }) })
  return {
    pages: report.pages,
    checks: report.checks.map((c) => ({
      id: c.id,
      label: t(`docExport.check.${c.id}`),
      status: c.status,
      notes:
        c.status === 'ok'
          ? [t(`docExport.check.ok.${c.id}`)]
          : c.status === 'na'
            ? []
            : c.notes.map((n) => t(`docExport.check.note.${n.code}`, { pages: n.pages.join(', '), items: n.items.join(' ; '), n: n.n ?? 0 })),
    })),
  }
}

/** The preview, sized to the screen's frame and grown to its content. */
function Shot({ spec, onDone }: { spec: { code: string; w: number; h: number; caps: string[] }; onDone: (r: { height?: number; error?: string }) => void }) {
  const [height, setHeight] = useState(spec.h)
  return (
    <div id="shot" style={{ width: spec.w, height }}>
      <Preview
        code={spec.code}
        caps={spec.caps}
        hideScrollbars
        // A still frame: every entrance at its end state, as "Sans animation"
        // shows it — the first frame of a fade-in is a blank page.
        animations={false}
        onContentHeight={(h) => {
          const next = Math.max(spec.h, Math.min(Math.ceil(h), MAX_SHOT_HEIGHT))
          setHeight(next)
          onDone({ height: next })
        }}
        onError={(e) => onDone({ error: e })}
      />
    </div>
  )
}

/** A screen taller than this is cut: a picture in a chat is read top first. */
const MAX_SHOT_HEIGHT = 6000
/** How long a preview may take to report itself before the shot is taken anyway. */
const SHOW_TIMEOUT_MS = 20_000

function show(spec: { code: string; w: number; h: number; caps: string[] }): Promise<{ height: number }> {
  const host = document.getElementById('runner-root') as HTMLElement
  return new Promise((resolve, reject) => {
    let settled = false
    let quiet: number | null = null
    let last = spec.h
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
    }
    const timer = window.setTimeout(() => finish(() => resolve({ height: last })), SHOW_TIMEOUT_MS)
    createRoot(host).render(
      <Shot
        spec={spec}
        onDone={(r) => {
          if (r.error) {
            window.clearTimeout(timer)
            finish(() => reject(new Error(r.error)))
            return
          }
          last = r.height ?? last
          // The height settles as images and fonts arrive: wait for a quiet
          // second rather than for the first report.
          if (quiet) window.clearTimeout(quiet)
          quiet = window.setTimeout(() => {
            window.clearTimeout(timer)
            finish(() => resolve({ height: last }))
          }, 1200)
        }}
      />,
    )
  })
}

/** The formats an assistant may ask for. A web screen (no page) has only the first two. */
const EXPORT_KINDS: readonly ExportKind[] = ['png', 'pptx', 'pptx-edit', 'pdf']

/**
 * One file of a screen, exactly as the Download dialog makes it — a document
 * through exportDocument, a web screen through exportWebScreen — returned as
 * base64 for the server to keep behind a signed link. The server read the
 * screen from the account's data; the page holds no session and needs none:
 * the capture loads /vendor and the library's public bytes, like `show`.
 */
async function exportScreen(spec: { screen: Partial<Screen>; kind: string; lang?: string }) {
  const kind = EXPORT_KINDS.includes(spec.kind as ExportKind) ? (spec.kind as ExportKind) : null
  if (!kind) throw new Error(`unknown export: ${String(spec.kind).slice(0, 20)}`)
  const screen = normalizeScreen(spec.screen || {}, 0)
  if (!screen.code.trim()) throw new Error('empty screen')
  const lang = spec.lang === 'en' ? 'en' : 'fr'
  let result
  if (screen.page) result = await exportDocument(screen, kind, { lang })
  else if (kind === 'png' || kind === 'pptx' || kind === 'pptx-edit') {
    // A web screen has one .pptx (slides cut from the page): the taken-apart
    // one exists for documents only, and asking for it gets the one there is.
    result = await exportWebScreen(screen, kind === 'png' ? 'png' : 'pptx', { lang })
  } else throw new Error('a web screen has no PDF export')
  const bytes = new Uint8Array(await result.blob.arrayBuffer())
  let binary = ''
  // In slices: String.fromCharCode(...bytes) on megabytes overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return {
    base64: btoa(binary),
    filename: result.filename,
    mime: result.blob.type || 'application/octet-stream',
    pages: result.pages,
    notices: result.notices.map((n) => n.code),
  }
}

window.__mockyRunner = {
  run,
  show,
  exportScreen,
  checkDocument,
  // Built here, in a page at the public origin, so its addresses are the ones a
  // browser elsewhere can load — the reason the runner lives at that origin.
  document: (spec) => previewDocument(spec.code, spec.caps || [], { frameId: 'mcp-view', animations: true }),
}
document.documentElement.dataset.runner = 'ready'
