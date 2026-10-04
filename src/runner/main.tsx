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
 * Two calls, both on `window.__mockyRunner`:
 *   run(job)    generate one new screen and write it into the account's project;
 *   show(spec)  mount that screen's preview, sized to its frame, and resolve when
 *               it has rendered — the server then screenshots the iframe with
 *               Chromium itself (real pixels, WebGL included), not html2canvas.
 */
import { createRoot } from 'react-dom/client'
// The app's own stylesheet: Preview sizes its frame with the app's classes, and
// without them the iframe fell back to a browser's 300×150 default — the first
// photograph was a postage stamp.
import '../index.css'
import { useState } from 'react'
import { api } from '../lib/api'
import { parseProjects } from '../lib/merge'
import { defaultSettings } from '../lib/settings'
import { absoluteUrl, checkVision, defaultMuseConfig, museAvailable } from '../lib/muse'
import { documentPictureSource, imageGenerationAvailable, type DocumentImageChoice } from '../lib/documentPictures'
import { stockImageStatus, stockUsable } from '../lib/stockImages'
import { imageUrl } from '../lib/imageLibrary'
import { defaultDesign, extractProductName, isDesignActive } from '../lib/design'
import { DEFAULT_PROJECT_NAME, designForProject, newId, placeScreen, type Project, type Screen } from '../lib/project'
import { runNewScreen, type NewScreenPhase, type ScreenWriter } from '../lib/pipeline/newScreen'
import { buildGenerationMessages, detectComponentName, finishGeneratedCode } from '../lib/generate'
import { isEnvironmentError, MAX_FIX_ATTEMPTS } from '../lib/previewErrors'
import { editScreen, fixScreenAudit, polishScreenCode } from '../lib/pipeline/screenPasses'
import { auditScreen, type AuditReport } from '../lib/audit'
import { isScreenThemeId } from '../lib/screenThemes'
import { isPageFormat } from '../lib/pageFormats'
import { translate, type TranslationKey } from '../i18n'
import Preview, { previewDocument } from '../components/Preview'

/**
 * What a job does. `new` (the default) makes a screen; the others work on one
 * that exists — each calls ONE of the correction passes, never a mix (CLAUDE.md,
 * "four independent correction passes"): an edit, the quality pass, the
 * SEO/accessibility report, or that report followed by its own correction.
 */
export type RunnerKind = 'new' | 'edit' | 'polish' | 'audit' | 'auditFix'

/** What the server asks for. Validated there; read defensively here anyway. */
export interface RunnerJob {
  kind?: RunnerKind
  /** The screen an edit, a polish or an audit works on (with `projectId`). */
  screenId?: string
  /** An edit's instruction — the person's words, as the composer passes them. */
  instruction?: string
  /** An audit's model-judged half (a model call), as the panel's "deep" switch. */
  deep?: boolean
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
  pictures?: Array<{ hash: string; use: string }>
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

async function run(job: RunnerJob): Promise<RunnerResult> {
  if (job.kind && job.kind !== 'new') return runOnScreen(job)
  const lang = job.lang === 'en' ? 'en' : 'fr'
  const t = (key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars)
  const brief = String(job.brief || '').trim()
  if (!brief) throw new Error('empty brief')

  progress('reading')
  const data = await api.getData()
  const all = parseProjects(data.projects)
  const now = Date.now()
  let project: Project | undefined = job.projectId ? all.find((p) => p.id === job.projectId && !p.deletedAt) : undefined
  // A project id that is not this account's reads as "no such project" (X4):
  // the server already refused it, and a new project is not what was asked.
  if (job.projectId && !project) throw new Error('project not found')
  if (!project) {
    project = { id: newId(), name: String(job.projectName || '').trim().slice(0, 120) || DEFAULT_PROJECT_NAME, createdAt: now, updatedAt: now, screens: [] }
  }

  // The working copy every hook writes into. Only THIS project goes back to the
  // server, which merges it (server/merge.js): the account's other projects are
  // never rewritten by a generation.
  let working: Project = { ...project, screens: [...project.screens] }
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
    .map((p) => ({ hash: p.hash, url: absoluteUrl(imageUrl(p.hash)), use: String(p.use || '') }))
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

  const outcome = await runNewScreen(
    {
      text: brief,
      settings,
      project: working,
      screens: working.screens,
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
    },
    {
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
        const w = typeof s.w === 'number' ? s.w : 1440
        const h = typeof s.h === 'number' ? s.h : 900
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
    },
  )

  // The name the assistant chose, rather than the first words of its brief —
  // which, written as an instruction, read "Créer directement dans Mocky le…".
  const name = typeof job.screenName === 'string' ? job.screenName.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
  if (name) working = { ...working, screens: working.screens.map((s) => (s.id === outcome.screenId ? { ...s, name } : s)) }

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

/** What leaves the page of an audit report: scores, rule ids and names — never a snippet of source. */
function auditSummary(r: AuditReport): RunnerAudit {
  return {
    seo: r.seo.score,
    a11y: r.a11y.score,
    parsed: r.parsed,
    judged: r.coverage.judged,
    findings: r.findings.map((f) => ({
      rule: f.rule,
      name: f.name,
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
  const designMd = designForProject(project, globalDesignFrom(data.design))
  const settings = defaultSettings()
  const signal = new AbortController().signal
  const codeAtStart = screen.code
  const notices: string[] = []
  let patch: Partial<Screen> | null = null
  const result: Partial<RunnerResult> = { kind }

  if (kind === 'edit') {
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
    result.audit = auditSummary(report)
    const correctable = report.findings.filter((f) => f.disposition !== 'advise')
    if (kind === 'auditFix' && correctable.length) {
      progress('fixing')
      const outcome = await fixScreenAudit({ settings, screen, designMd, findings: correctable, signal })
      // Deliberately no `quality`: that field is the /20 design audit, and an
      // accessibility number in it would make two measurements share one.
      if (outcome.code !== codeAtStart) {
        patch = { code: outcome.code, componentName: detectComponentName(outcome.code), previousCode: codeAtStart }
      }
      result.auditFix = { fixed: outcome.fixed.map((f) => f.name), residual: outcome.residual.map((f) => f.name), stopped: outcome.stopped }
    }
  }

  let saved = screen
  if (patch) {
    progress('saving')
    // Applied to the project as it is NOW, so a screen added or renamed meanwhile
    // is kept; and dropped when this very screen moved under the pass.
    const fresh = find((await api.getData()).projects)
    if (!fresh.project || !fresh.screen || fresh.screen.code !== codeAtStart) {
      throw new Error(
        lang === 'fr'
          ? 'Cet écran a été modifié pendant le travail : rien n’a été remplacé.'
          : 'This screen was changed while the work ran: nothing was replaced.',
      )
    }
    saved = { ...fresh.screen, ...patch }
    const working: Project = {
      ...fresh.project,
      screens: fresh.project.screens.map((s) => (s.id === saved.id ? saved : s)),
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
    changed: saved.code !== codeAtStart,
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

window.__mockyRunner = {
  run,
  show,
  // Built here, in a page at the public origin, so its addresses are the ones a
  // browser elsewhere can load — the reason the runner lives at that origin.
  document: (spec) => previewDocument(spec.code, spec.caps || [], { frameId: 'mcp-view', animations: true }),
}
document.documentElement.dataset.runner = 'ready'
