/**
 * The headless runner: a generation, and a picture of it, with no tab open.
 *
 * A design asked for from Claude or ChatGPT has to run the pipeline the
 * composer runs, and that pipeline lives in the browser (C1 in
 * plans/mcp-serveur.md). So the server drives a Chromium of its own and opens
 * Mocky's `runner.html` in it: the page runs lib/pipeline/newScreen.ts, writes
 * the screen into the account's project through PUT /api/data (merged, see
 * server/merge.js), and mounts the preview; the server then screenshots that
 * preview with Chromium itself.
 *
 * ── Where the page lives ────────────────────────────────────────────────────
 *
 * At the PUBLIC origin (`MOCKY_ORIGIN`), not at 127.0.0.1. A generated screen
 * embeds absolute image URLs built from `window.location.origin` (M6), and the
 * preview's CSP names that origin: a page at 127.0.0.1 would bake addresses into
 * the screen that the person's browser cannot load. Every request to the public
 * origin is caught by the browser context and answered by THIS process over
 * loopback — so nothing leaves the machine, TLS does not matter, and the reverse
 * proxy is not involved. The job's token is added to those requests on the way
 * (runner-auth.js), never to any other host, and never shown to the page.
 *
 * ── The queue ───────────────────────────────────────────────────────────────
 *
 * In memory, with a JSON journal — the video queue's posture (no Redis, ever).
 * `concurrency` jobs at once instance-wide (a Chromium page and a model call
 * each), ONE per account: a model can loop where a person clicks once, so a
 * second request while one runs gets the running job back, not a second one.
 * A restart fails what was in flight and says so; it does not resume a paid
 * generation nobody asked for twice.
 *
 * ── Degradation ─────────────────────────────────────────────────────────────
 *
 * No Chromium (the image's best-effort install failed, `/app/.no-chromium`), no
 * built `runner.html` (dev without a build): the runner says it is unavailable,
 * with the reason, and nothing else in Mocky changes.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

/** A generation (Muse included) plus its picture. Past this the page is closed. */
export const JOB_TIMEOUT_MS = 10 * 60 * 1000
/** The browser is kept warm between jobs, then let go. */
export const BROWSER_IDLE_MS = 5 * 60 * 1000
export const MAX_JOURNAL_JOBS = 100
/** Shots kept on disk for `get_screenshot` (2c) — bounded by count and age. */
export const MAX_SHOTS = 200
export const SHOT_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** How much of a page the assistant's picture shows, from the top. */
export const PREVIEW_MAX_HEIGHT = 2000

/** The screen `check()` photographs: no capability, no picture, no network. */
export const CHECK_SCREEN = `export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-12 text-white">
      <div className="max-w-xl text-center">
        <p className="text-sm uppercase tracking-widest text-emerald-400">Mocky</p>
        <h1 className="mt-3 text-5xl font-bold">The runner works.</h1>
        <p className="mt-4 text-lg text-slate-300">Chromium started, this build's runner page loaded, and this screen was rendered and photographed on the server.</p>
      </div>
    </main>
  )
}`

export const RESTART_ERROR = 'The server restarted while this design was being made. Ask again.'

/**
 * Where a Chromium might be, in order: what the administrator said, what
 * playwright-core 1.49.1 expects (the Docker image installs exactly that one at
 * /ms-playwright), any other Playwright build on the machine, then an installed
 * Chrome or Edge. The first that exists wins.
 */
export function findChromium({ env = process.env, exists = fs.existsSync, readdir = fs.readdirSync, expected } = {}) {
  if (env.MOCKY_RUNNER_CHROMIUM) return exists(env.MOCKY_RUNNER_CHROMIUM) ? env.MOCKY_RUNNER_CHROMIUM : null
  if (expected && exists(expected)) return expected
  const roots = [
    env.PLAYWRIGHT_BROWSERS_PATH,
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'ms-playwright'),
    path.join(os.homedir(), '.cache', 'ms-playwright'),
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'),
  ].filter(Boolean)
  const inner = ['chrome-linux/chrome', 'chrome-win/chrome.exe', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']
  for (const root of roots) {
    let dirs = []
    try {
      dirs = readdir(root).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
    } catch {
      continue
    }
    for (const d of dirs) for (const rel of inner) if (exists(path.join(root, d, rel))) return path.join(root, d, rel)
  }
  const system = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  return system.find((p) => exists(p)) || null
}

/**
 * @param {object} d
 * @param {string} d.dataDir
 * @param {string} d.distDir               the built frontend (runner.html lives there)
 * @param {string|null} d.publicOrigin     MOCKY_ORIGIN — where the page pretends to be
 * @param {() => string} d.localBase       how this process is reached over loopback
 * @param {{ issue: Function, revokeJob: Function }} d.auth
 * @param {() => { concurrency: number }} d.config
 * @param {(url: string) => Promise<unknown>} d.guard   throws for an address the server must not reach
 * @param {() => Promise<any>} [d.loadPlaywright]   injectable for tests
 * @param {string} [d.appDir]              where `.no-chromium` would be
 */
export function createRunner(d) {
  const journalFile = path.join(d.dataDir, 'mcp-jobs.json')
  const shotsDir = path.join(d.dataDir, 'mcp-shots')
  const loadPlaywright = d.loadPlaywright || (() => import('playwright-core'))
  /** @type {Map<string, any>} */
  const jobs = new Map()
  const queue = []
  let running = 0
  let browser = null
  let launching = null
  let idleTimer = null

  // ---- journal ---------------------------------------------------------------
  try {
    const saved = JSON.parse(fs.readFileSync(journalFile, 'utf8'))
    for (const j of Array.isArray(saved) ? saved : []) {
      if (j.status === 'queued' || j.status === 'running') Object.assign(j, { status: 'failed', error: RESTART_ERROR, endedAt: Date.now() })
      jobs.set(j.id, j)
    }
  } catch {
    /* no journal yet */
  }

  function persist() {
    const list = [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_JOURNAL_JOBS)
    for (const j of jobs.values()) if (!list.includes(j)) jobs.delete(j.id)
    try {
      fs.mkdirSync(d.dataDir, { recursive: true })
      const tmp = `${journalFile}.${crypto.randomBytes(6).toString('hex')}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(list), { mode: 0o600 })
      fs.renameSync(tmp, journalFile)
    } catch (err) {
      console.error(`mocky: could not write the runner journal — ${err?.message || err}`)
    }
  }

  // ---- availability ------------------------------------------------------------
  function availability() {
    if (!d.publicOrigin) return { available: false, reason: 'no-origin' }
    if (d.appDir && fs.existsSync(path.join(d.appDir, '.no-chromium')) && !process.env.MOCKY_RUNNER_CHROMIUM) {
      return { available: false, reason: 'no-chromium' }
    }
    if (!fs.existsSync(path.join(d.distDir, 'runner.html'))) return { available: false, reason: 'no-build' }
    return { available: true }
  }

  async function ensureBrowser() {
    if (browser?.isConnected()) return browser
    if (launching) return launching
    launching = (async () => {
      const { chromium } = await loadPlaywright()
      let expected = null
      try {
        expected = chromium.executablePath()
      } catch {
        /* not installed where playwright expects it */
      }
      const executablePath = findChromium({ expected })
      if (!executablePath) throw Object.assign(new Error('No Chromium found for the runner.'), { code: 'no-chromium' })
      browser = await chromium.launch({
        executablePath,
        headless: true,
        args: [
          '--disable-dev-shm-usage',
          // Replaced by the stricter rule in openPage(), which sees every request.
          '--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults',
        ],
      })
      browser.on('disconnected', () => {
        browser = null
      })
      return browser
    })()
    try {
      return await launching
    } finally {
      launching = null
    }
  }

  function armIdle() {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      if (running === 0 && browser) void browser.close().catch(() => {})
    }, BROWSER_IDLE_MS)
    idleTimer.unref?.()
  }

  // ---- shots -------------------------------------------------------------------
  /** Both pictures under one name: `<hash>.png` (whole page) and `<hash>.jpg` (the assistant's). */
  function saveShot(png, jpeg) {
    const hash = crypto.createHash('sha256').update(png).digest('hex')
    fs.mkdirSync(shotsDir, { recursive: true })
    const file = path.join(shotsDir, `${hash}.png`)
    if (!fs.existsSync(file)) fs.writeFileSync(file, png, { mode: 0o600 })
    if (jpeg && !fs.existsSync(path.join(shotsDir, `${hash}.jpg`))) fs.writeFileSync(path.join(shotsDir, `${hash}.jpg`), jpeg, { mode: 0o600 })
    pruneShots()
    return hash
  }

  function pruneShots() {
    try {
      const files = fs
        .readdirSync(shotsDir)
        .filter((f) => /^[a-f0-9]{64}\.png$/.test(f))
        .map((f) => ({ f, t: fs.statSync(path.join(shotsDir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t)
      const now = Date.now()
      files.forEach((x, i) => {
        if (i >= MAX_SHOTS || now - x.t > SHOT_TTL_MS) {
          fs.rmSync(path.join(shotsDir, x.f), { force: true })
          fs.rmSync(path.join(shotsDir, x.f.replace(/\.png$/, '.jpg')), { force: true })
        }
      })
    } catch {
      /* nothing to prune */
    }
  }

  /**
   * A shot by its hash — the whole page (`png`) or the assistant's JPEG
   * (`jpg`) — or null. The hash is the only key; ownership is the caller's check.
   */
  function readShot(hash, kind = 'png') {
    if (!/^[a-f0-9]{64}$/.test(String(hash)) || (kind !== 'png' && kind !== 'jpg')) return null
    try {
      return fs.readFileSync(path.join(shotsDir, `${hash}.${kind}`))
    } catch {
      return null
    }
  }

  /** What existing screens were last photographed as, so asking twice costs nothing. */
  const codeShots = new Map()
  /** One photograph of an existing screen at a time: they share the warm browser. */
  let photoQueue = Promise.resolve()

  // ---- a page at the public origin --------------------------------------------------
  /**
   * A fresh context (empty storage, nothing shared with another job) whose
   * requests to the public origin are answered by this process over loopback,
   * carrying `token` when there is one. Nothing else ever gets the token.
   */
  async function openPage(token, locale = 'fr-FR') {
    const origin = d.publicOrigin
    const local = d.localBase()
    const b = await ensureBrowser()
    const context = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale })
    /*
     * The network policy of a browser that runs MODEL-WRITTEN code on the server.
     *
     * Every request is decided here, in one place:
     *  - to the public origin: answered by this process over loopback, with the
     *    job's token — the only requests that ever carry it;
     *  - anywhere else: only if the SSRF guard lets it through, DNS resolution
     *    included (the same `assertSafeTargetResolved` the provider proxy uses).
     *    A generated page may show a font or an image from the Internet; it may
     *    not make this server fetch 169.254.169.254 or a neighbour on the LAN;
     *  - WebSockets: none (`routeWebSocket` below).
     *
     * This is also why Chromium's own Local Network Access checks are switched
     * off at launch: they refused the preview's /vendor scripts whenever the
     * origin was a loopback address (an opaque-origin frame asking for
     * "loopback"), and they are strictly weaker than this rule, which applies to
     * every frame and every address.
     */
    await context.route('**/*', async (route) => {
      const req = route.request()
      const raw = req.url()
      if (raw.startsWith(`${origin}/`) || raw === origin) {
        const url = new URL(raw)
        try {
          const response = await route.fetch({
            url: `${local}${url.pathname}${url.search}`,
            headers: token ? { ...req.headers(), 'x-mocky-runner': token } : req.headers(),
          })
          await route.fulfill({ response })
        } catch {
          await route.abort().catch(() => {})
        }
        return
      }
      if (!/^https?:/i.test(raw)) return route.continue()
      try {
        await d.guard(raw)
        await route.continue()
      } catch {
        await route.abort('blockedbyclient').catch(() => {})
      }
    })
    if (typeof context.routeWebSocket === 'function') {
      await context.routeWebSocket(/.*/, (ws) => ws.close())
    }
    return { context, page: await context.newPage() }
  }

  async function ready(page) {
    await page.goto(`${d.publicOrigin}/runner.html`, { waitUntil: 'load' })
    await page.waitForFunction(() => document.documentElement.dataset.runner === 'ready', null, { timeout: 30_000 })
  }

  /** Mount a screen's preview and photograph it with Chromium. Returns { png, height }. */
  async function photograph(page, spec) {
    await page.setViewportSize({ width: spec.w, height: Math.max(600, spec.h) })
    const shown = await page.evaluate((x) => window.__mockyRunner.show(x), spec)
    await page.setViewportSize({ width: spec.w, height: Math.max(600, shown.height) })
    const frame = page.locator('#shot iframe')
    const png = await frame.screenshot({ type: 'png', animations: 'disabled', timeout: 30_000 })
    // The picture an ASSISTANT gets: a JPEG of the top of the page. A full
    // 1440×6000 PNG is megabytes of base64 in a conversation, and a vision model
    // shrinks it to a strip anyway; the top 2,000 px is what it can read, and the
    // link has the rest.
    const box = await frame.boundingBox()
    const jpeg = await page.screenshot({
      type: 'jpeg',
      quality: 72,
      animations: 'disabled',
      timeout: 30_000,
      clip: { x: box?.x ?? 0, y: box?.y ?? 0, width: spec.w, height: Math.min(shown.height, PREVIEW_MAX_HEIGHT) },
    })
    return { png, jpeg, height: shown.height }
  }

  // ---- one job -------------------------------------------------------------------
  async function execute(job) {
    const token = d.auth.issue(job.userId, job.id)
    let context = null
    const timeout = setTimeout(() => {
      job.error = 'This design took too long and was stopped.'
      void context?.close().catch(() => {})
    }, JOB_TIMEOUT_MS)
    timeout.unref?.()
    try {
      const opened = await openPage(token, job.request.lang === 'en' ? 'en-US' : 'fr-FR')
      context = opened.context
      const page = opened.page
      await page.exposeFunction('__mockyRunnerProgress', (phase) => {
        job.progress = String(phase || '').slice(0, 80)
      })
      await ready(page)
      job.status = 'running'
      job.progress = 'starting'

      const result = await page.evaluate((req) => window.__mockyRunner.run(req), job.request)
      job.result = {
        projectId: result.projectId,
        screenId: result.screenId,
        w: result.w,
        h: result.h,
        notices: result.notices || [],
        ...(result.error ? { warning: result.error } : {}),
      }

      job.progress = 'picture'
      try {
        const shot = await photograph(page, { code: result.code, w: result.w, h: result.h, caps: result.caps })
        job.result.shot = saveShot(shot.png, shot.jpeg)
        job.result.shotHeight = shot.height
      } catch (err) {
        // The screen exists and is saved; only its picture failed. Said, not fatal (X7-to-be).
        job.result.notices.push(`No picture of the result: ${String(err?.message || err).slice(0, 160)}`)
      }
      job.status = 'done'
    } catch (err) {
      job.status = 'failed'
      job.error = job.error || String(err?.message || err).slice(0, 300)
    } finally {
      clearTimeout(timeout)
      d.auth.revokeJob(job.id)
      job.endedAt = Date.now()
      await context?.close().catch(() => {})
    }
  }

  async function pump() {
    while (running < Math.max(1, d.config().concurrency || 1) && queue.length) {
      const job = queue.shift()
      running++
      job.startedAt = Date.now()
      persist()
      execute(job)
        .catch(() => {})
        .finally(() => {
          running--
          persist()
          armIdle()
          void pump()
        })
    }
  }

  // ---- the public face ------------------------------------------------------------
  return {
    availability,

    /**
     * Queue a generation for `userId`. Returns the job — the one already running
     * for this account when there is one, which is the "one at a time" rule.
     */
    enqueue(userId, request) {
      const mine = [...jobs.values()].find((j) => j.userId === userId && (j.status === 'queued' || j.status === 'running'))
      if (mine) return { job: view(mine), existing: true }
      const job = {
        id: crypto.randomBytes(12).toString('hex'),
        userId,
        request,
        status: 'queued',
        progress: 'queued',
        createdAt: Date.now(),
      }
      jobs.set(job.id, job)
      queue.push(job)
      persist()
      void pump()
      return { job: view(job), existing: false }
    },

    /** A job of `userId`'s, or null — someone else's answers like a missing one. */
    get(id, userId) {
      const j = jobs.get(id)
      return j && j.userId === userId ? view(j) : null
    },

    /** Resolve when the job ends or `ms` passes, whichever first. */
    async wait(id, userId, ms) {
      const deadline = Date.now() + ms
      for (;;) {
        const j = jobs.get(id)
        if (!j || j.userId !== userId) return null
        if (j.status === 'done' || j.status === 'failed' || Date.now() >= deadline) return view(j)
        await new Promise((r) => setTimeout(r, 400))
      }
    },

    /** Jobs that ended today for `userId` — for the optional daily quota. */
    countToday(userId) {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      return [...jobs.values()].filter((j) => j.userId === userId && j.createdAt >= start.getTime()).length
    },

    readShot,

    /**
     * The free check an administrator can run: Chromium starts, this build's
     * runner page loads, a fixed screen renders and is photographed. No model,
     * no account, no token — it costs nothing and proves every part that is not
     * a model call. Returns the PNG.
     */
    async check() {
      const why = availability()
      if (!why.available) throw Object.assign(new Error(why.reason), { code: why.reason })
      let context = null
      try {
        const opened = await openPage(null)
        context = opened.context
        await ready(opened.page)
        return (await photograph(opened.page, { code: CHECK_SCREEN, w: 960, h: 540, caps: [] })).png
      } finally {
        await context?.close().catch(() => {})
        armIdle()
      }
    },

    /**
     * Photograph a screen that already exists (`get_screenshot`). The caller
     * has read the code from the account's own data; nothing here needs a
     * token — the preview loads /vendor and the image library's public bytes,
     * and the network rule still applies to everything else. Returns the shot's
     * hash; a screen photographed before, unchanged, costs nothing.
     */
    async photographCode(spec) {
      const why = availability()
      if (!why.available) throw Object.assign(new Error(why.reason), { code: why.reason })
      const key = crypto
        .createHash('sha256')
        .update(JSON.stringify([spec.code, spec.w, spec.h, spec.caps || []]))
        .digest('hex')
      const known = codeShots.get(key)
      if (known && readShot(known, 'jpg')) return known
      const run = photoQueue.then(async () => {
        let context = null
        try {
          const opened = await openPage(null)
          context = opened.context
          await ready(opened.page)
          const shot = await photograph(opened.page, { code: spec.code, w: spec.w, h: spec.h, caps: spec.caps || [] })
          const hash = saveShot(shot.png, shot.jpeg)
          codeShots.set(key, hash)
          if (codeShots.size > MAX_SHOTS) codeShots.delete(codeShots.keys().next().value)
          return hash
        } finally {
          await context?.close().catch(() => {})
          armIdle()
        }
      })
      photoQueue = run.catch(() => {})
      return run
    },

    /** Whether this account has a design being made right now — the admin's "MCP" chip. */
    isBusy(userId) {
      for (const j of jobs.values()) if (j.userId === userId && (j.status === 'queued' || j.status === 'running')) return true
      return false
    },

    status: () => ({ ...availability(), running, queued: queue.length, browser: Boolean(browser?.isConnected()) }),
    async shutdown() {
      if (idleTimer) clearTimeout(idleTimer)
      await browser?.close().catch(() => {})
    },
  }
}

/** What leaves the runner: never the request's internals beyond what the caller sent. */
function view(j) {
  return {
    id: j.id,
    status: j.status,
    progress: j.progress,
    // The language the request was written in, so a later get_design answers in it.
    lang: j.request?.lang === 'en' ? 'en' : 'fr',
    screenType: j.request?.screenType || null,
    createdAt: j.createdAt,
    startedAt: j.startedAt,
    endedAt: j.endedAt,
    ...(j.result ? { result: j.result } : {}),
    ...(j.error ? { error: j.error } : {}),
  }
}
