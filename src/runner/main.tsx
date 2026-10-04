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
import { absoluteUrl, defaultMuseConfig, museAvailable } from '../lib/muse'
import { documentPictureSource, imageGenerationAvailable, type DocumentImageChoice } from '../lib/documentPictures'
import { stockImageStatus, stockUsable } from '../lib/stockImages'
import { imageUrl } from '../lib/imageLibrary'
import { extractProductName } from '../lib/design'
import { DEFAULT_PROJECT_NAME, newId, placeScreen, type Project, type Screen } from '../lib/project'
import { runNewScreen, type NewScreenPhase } from '../lib/pipeline/newScreen'
import { isScreenThemeId } from '../lib/screenThemes'
import { translate, type TranslationKey } from '../i18n'
import Preview from '../components/Preview'

/** What the server asks for. Validated there; read defensively here anyway. */
export interface RunnerJob {
  brief: string
  /** An existing project of the account, or absent for a new one. */
  projectId?: string
  projectName?: string
  device?: 'desktop' | 'mobile' | 'tablet'
  /** The composer's "Type d'écran" (SCREEN_THEME_IDS): it sets a document's page and a post's frame. */
  screenType?: string
  /** Library hashes the server has checked belong to this account, with what each is for. */
  pictures?: Array<{ hash: string; use: string }>
  /** Where Mocky finds a picture itself when none was supplied: the composer's "Images" choice. */
  pictureSource?: 'auto' | 'free' | 'generated' | 'none'
  muse?: boolean
  lang?: 'fr' | 'en'
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
}

declare global {
  interface Window {
    __mockyRunner?: {
      run: (job: RunnerJob) => Promise<RunnerResult>
      show: (spec: { code: string; w: number; h: number; caps: string[] }) => Promise<{ height: number }>
    }
    /** Exposed by the server (page.exposeFunction): where progress goes. */
    __mockyRunnerProgress?: (phase: string) => void
  }
}

const progress = (phase: string) => {
  try {
    window.__mockyRunnerProgress?.(phase)
  } catch {
    /* progress is a courtesy */
  }
}

async function run(job: RunnerJob): Promise<RunnerResult> {
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
  const choice: DocumentImageChoice = provided.length || wanted === 'none'
    ? 'none'
    : wanted === 'free' ? 'stock' : wanted === 'generated' ? 'ai' : stockOk ? 'stock' : generationOk ? 'ai' : 'none'
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
      globalMd: undefined,
      presetId,
      themeId: isScreenThemeId(job.screenType) ? job.screenType : null,
      pageFormatId: null,
      redesign: false,
      museConfig,
      museAvail: job.muse ? await museAvailable().catch(() => false) : false,
      museVision: null,
      pinnedImages: [],
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

window.__mockyRunner = { run, show }
document.documentElement.dataset.runner = 'ready'
