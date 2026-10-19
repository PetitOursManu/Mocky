#!/usr/bin/env node
/**
 * The documentation's annotated screenshots, made by a machine.
 *
 *   npm run build && node scripts/capture-docs.mjs [--lang=fr|en] [--only=canvas,home]
 *
 * For each language it starts a real server on a throwaway data directory,
 * creates an account, seeds it with the projects of `capture-docs/fixtures.mjs`
 * (written by hand, so no picture depends on a model), drives this build in a
 * headless Chromium at 1440×900 and 2× — the 2880 px the docs were drawn at —
 * and writes `docs/assets/ui[/fr]/<name>.webp`.
 *
 * The points on a picture are MEASURED, not typed. Each capture names the
 * elements its `:::hotspots` block describes, in the block's order; the script
 * takes each one's centre relative to the picture and rewrites the `x,y` of the
 * matching lines in every page that shows that picture, in that language. A
 * block whose number of lines differs from the capture's list fails the run
 * rather than pointing at the wrong thing.
 *
 * Elements are found the way a person finds them — by their accessible name —
 * read from the app's own dictionaries (src/i18n), so the same script works in
 * both languages and breaks loudly when a label changes. The few things with no
 * name (a drawing, a frame on the canvas) carry a `data-doc` / `data-screen`
 * attribute in the app.
 *
 * Run by `.github/workflows/docs-captures.yml`, where Chromium starts: on some
 * Windows machines a scripted browser cannot.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { findChromium } from '../server/mcp/runner.js'
import { fixtures } from './capture-docs/fixtures.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const VIEW = { width: 1440, height: 900 }
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const LANGS = arg('lang') ? [arg('lang')] : ['en', 'fr']
const ONLY = arg('only') ? new Set(arg('only').split(',')) : null

// ---------------------------------------------------------------- dictionaries

/** The app's labels in one language, read from the TypeScript sources as text. */
function dictionary(lang) {
  const parts = path.join(ROOT, 'src/i18n/parts')
  const files = [path.join(ROOT, 'src/i18n', `${lang}.ts`)].concat(
    fs.readdirSync(parts).filter((f) => f.endsWith('.ts') && f !== 'index.ts').map((f) => path.join(parts, f)),
  )
  const out = {}
  for (const file of files) {
    let src = fs.readFileSync(file, 'utf8')
    if (file.startsWith(parts)) {
      // An area file holds both languages: `fr: { … }` then `en: { … }`.
      const at = src.indexOf('\n  en: {')
      src = lang === 'fr' ? src.slice(0, at) : src.slice(at)
    }
    for (const m of src.matchAll(/'([\w.-]+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g)) {
      out[m[1]] = (m[2] ?? m[3]).replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n')
    }
  }
  return (key) => {
    if (!(key in out)) throw new Error(`no ${lang} label for "${key}"`)
    return out[key]
  }
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** A name that STARTS with this label — a button whose text carries a shortcut or a count. */
const startsWith = (label) => new RegExp('^\\s*' + escapeRe(label))

// ---------------------------------------------------------------- the server

async function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-docs-'))
  fs.writeFileSync(path.join(dataDir, 'images-config.json'), JSON.stringify({ content: { provider: 'none' } }))
  const port = await freePort()
  const base = `http://127.0.0.1:${port}`
  const proc = spawn(process.execPath, [path.join(ROOT, 'server/index.js')], {
    env: { ...process.env, MOCKY_DATA_DIR: dataDir, MOCKY_PORT: String(port), MOCKY_ORIGIN: base, NODE_ENV: 'test' },
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  const deadline = Date.now() + 20_000
  for (;;) {
    try {
      await fetch(`${base}/api/config`)
      break
    } catch {
      if (Date.now() > deadline) throw new Error('the server did not start')
      await new Promise((r) => setTimeout(r, 150))
    }
  }
  return { base, dataDir, stop: () => proc.kill() }
}

async function seed(base, lang) {
  const reg = await fetch(`${base}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'demo', password: 'correct-horse-battery-staple' }),
  })
  if (!reg.ok) throw new Error(`register: ${reg.status}`)
  const cookie = (reg.headers.get('set-cookie') || '').split(';')[0]
  const data = fixtures(lang)
  const put = await fetch(`${base}/api/data`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ projects: JSON.stringify(data.projects), design: data.design, updatedAt: Date.now() }),
  })
  if (!put.ok) throw new Error(`seed: ${put.status}`)
  return { cookie, data }
}

// ---------------------------------------------------------------- capturing

const round = (n) => Math.round(n * 10) / 10

/** Every capture's measured points, by language and name. */
const measured = { en: {}, fr: {} }

async function toWebp(convert, png) {
  const b64 = await convert.evaluate(async (src) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + src
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext('2d').drawImage(img, 0, 0)
    return c.toDataURL('image/webp', 0.86).split(',')[1]
  }, png.toString('base64'))
  return Buffer.from(b64, 'base64')
}

/**
 * One picture: `clip` is a locator (its box, padded) or null (the viewport);
 * `spots` the elements of its hotspots block, in order.
 */
async function shoot(ctx, name, { clip = null, pad = 0, spots }) {
  if (ONLY && !ONLY.has(name)) return
  const { page, convert, lang } = ctx
  await page.waitForTimeout(600)
  let rect = { x: 0, y: 0, width: VIEW.width, height: VIEW.height }
  if (clip) {
    const b = await clip.first().boundingBox()
    if (!b) throw new Error(`${lang}/${name}: the clip is not on screen`)
    const x = Math.max(0, b.x - pad)
    const y = Math.max(0, b.y - pad)
    rect = {
      x,
      y,
      width: Math.min(VIEW.width - x, b.width + pad * 2),
      height: Math.min(VIEW.height - y, b.height + pad * 2),
    }
  }
  const coords = []
  for (const [label, loc] of spots) {
    const b = await loc.first().boundingBox({ timeout: 5000 }).catch(() => null)
    if (!b) throw new Error(`${lang}/${name}: "${label}" was not found`)
    coords.push([round(((b.x + b.width / 2 - rect.x) / rect.width) * 100), round(((b.y + b.height / 2 - rect.y) / rect.height) * 100)])
  }
  // Animations are left running and simply waited out (the pause at the top):
  // freezing them made Chromium hang on the menu captures, past 30 s.
  const png = await page.screenshot({ clip: rect, timeout: 60_000 })
  const dir = path.join(ROOT, 'docs/assets/ui', lang === 'fr' ? 'fr' : '')
  fs.writeFileSync(path.join(dir, `${name}.webp`), await toWebp(convert, png))
  measured[lang][name] = coords
  console.log(`  ${lang}/${name}.webp  ${Math.round(rect.width * 2)}×${Math.round(rect.height * 2)}  ${coords.length} points`)
}

/** Let the previews draw: fonts, the Tailwind runtime, the kits. */
async function settle(page, ms = 2500) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(ms)
}

async function run(lang) {
  const t = dictionary(lang)
  const server = await startServer()
  const { cookie, data } = await seed(server.base, lang)
  const names = Object.fromEntries(data.projects[0].screens.map((s) => [s.id, s.name]))
  const cafe = data.projects[0].name

  const browser = await chromium.launch({ executablePath: findChromium(), headless: true })
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, colorScheme: 'dark', locale: lang })
  const [cName, cValue] = cookie.split('=')
  await context.addCookies([{ name: cName, value: cValue, url: server.base }])
  await context.addInitScript((l) => {
    try {
      localStorage.setItem('mocky.lang', l)
      localStorage.setItem('mocky.theme', 'dark')
    } catch {
      /* a preview frame: opaque origin, no storage */
    }
  }, lang)
  const page = await context.newPage()
  const convert = await context.newPage()
  const ctx = { page, convert, lang }
  const base = server.base
  const btn = (scope, name, exact = false) => scope.getByRole('button', { name, exact })

  try {
    // ---- the project, nothing selected: the creation column -------------------
    await page.goto(`${base}/p/${data.ids.cafe}`)
    await settle(page, 4000)
    const column = page.locator('aside').filter({ hasText: t('workspace.atelier') })
    await shoot(ctx, 'composer', {
      clip: column,
      spots: [
        ['Format', column.getByText(t('project.format'), { exact: true })],
        ['Screen type', btn(column, t('composer.themeLabel'), true)],
        ['The prompt', column.locator('textarea')],
        ['New direction', btn(column, t('project.redesignChip'))],
        ['Muse', btn(column, t('muse.title'), true)],
        ['Motion Ultra', btn(column, t('project.ultraChip'))],
        ['Screenshots of a site', btn(column, t('project.siteAttach'))],
        ['Improve', btn(column, t('composer.enhance'))],
        ['Generate', btn(column, startsWith(t('composer.generate')))],
        ['Also make', column.getByText(t('workspace.alsoMake'), { exact: true })],
        ['Recent history', column.getByText(t('workspace.history'), { exact: true })],
      ],
    })

    // ---- the screen type menu -------------------------------------------------
    await btn(column, t('composer.themeLabel'), true).click()
    const types = page.getByRole('menu', { name: t('composer.themeMenu') })
    await types.waitFor()
    await shoot(ctx, 'types', {
      clip: types,
      spots: [
        ['What a type does', types.locator('p').first()],
        ['Documents', types.getByRole('group').nth(0).locator('p').first()],
        ['Social media', types.getByRole('group').nth(1).locator('p').first()],
        ['Screens', types.getByRole('group').nth(2).locator('p').first()],
      ],
    })
    await page.keyboard.press('Escape')
    await page.mouse.click(VIEW.width / 2, VIEW.height / 2)

    // ---- one screen selected, everything framed: the canvas --------------------
    await column.getByRole('button', { name: names['cafe-menu'] }).click()
    await btn(page, t('canvas.fit')).click()
    await settle(page, 2500)
    const zoomBar = btn(page, t('canvas.zoomIn')).locator('..')
    const bar = page.locator('#mocky-project-bar')
    await shoot(ctx, 'canvas', {
      spots: [
        ['Canvas tools', page.getByRole('toolbar', { name: t('workspace.tools') })],
        ['Share', btn(bar, t('workspace.share'))],
        ['Export', btn(bar, t('mode.export'))],
        ['The creation workshop', column.getByText(t('workspace.atelier'), { exact: true })],
        ['A generated screen', page.locator('[data-screen="cafe-home"]')],
        ['A document', page.locator('[data-screen="cafe-flyer"]')],
        ['Floating tools', page.getByRole('toolbar', { name: t('workspace.screenTools') })],
        ['The inspector', page.getByRole('complementary', { name: t('workspace.inspector') })],
        ['Zoom bar', zoomBar],
        ['Generate', btn(column, startsWith(t('composer.update').split('(')[0].trim()))],
      ],
    })
    await shoot(ctx, 'toolbar', {
      clip: bar,
      pad: 6,
      spots: [
        ['Select', btn(bar, t('workspace.select'))],
        ['Link', btn(bar, t('mode.link'))],
        ['Interact', btn(bar, t('mode.interact'))],
        ['Modify', btn(bar, t('mode.modify'))],
        ['Annotate', btn(bar, t('mode.annotate'))],
        ['Demo', btn(bar, t('mode.demo'))],
        ['Share', btn(bar, t('workspace.share'))],
        ['Export', btn(bar, t('mode.export'))],
        ['Inspector', btn(bar, t('workspace.inspectorClose'))],
      ],
    })
    await shoot(ctx, 'zoombar', {
      clip: zoomBar,
      pad: 4,
      spots: [
        ['Zoom out', btn(zoomBar, t('canvas.zoomOut'))],
        ['Zoom in', btn(zoomBar, t('canvas.zoomIn'))],
        ['Fit all', btn(zoomBar, t('canvas.fit'))],
        ['Latest screen', btn(zoomBar, t('canvas.zoomLatest'))],
        ['Arrange', btn(zoomBar, t('canvas.arrange'))],
        ['Cables', zoomBar.getByRole('button', { name: new RegExp(`${escapeRe(t('canvas.cablesHide'))}|${escapeRe(t('canvas.cablesShow'))}`) })],
      ],
    })

    // ---- a document's menu, and its download dialog ----------------------------
    const flyerLabel = page.locator('main').getByText(names['cafe-flyer'], { exact: true }).first()
    await flyerLabel.click({ button: 'right' })
    const menu = page.locator('.menu-in.fixed').last()
    await menu.waitFor()
    await shoot(ctx, 'docmenu', {
      clip: menu,
      pad: 2,
      spots: [
        ['Edit with a message', btn(menu, startsWith(t('project.menuEditMessage')))],
        ['Polish', btn(menu, t('project.polish'))],
        ['Regenerate a variant', btn(menu, t('project.regenerate'))],
        ['Fit to page', btn(menu, t('project.docFit'))],
        ['Export ›', btn(menu, t('project.menuExport'))],
        ['Share', btn(menu, t('share.menu'))],
        ['Notes', btn(menu, startsWith(t('notes.menu')))],
        ['Delete screen', btn(menu, t('canvas.delete'))],
      ],
    })
    await btn(menu, t('project.menuExport')).hover()
    await btn(page, t('project.docDownload')).click()
    const dialog = page.getByRole('dialog', { name: t('docExport.title') })
    await dialog.waitFor()
    await shoot(ctx, 'download', {
      clip: dialog,
      spots: [
        // The intro opens with the format's name in one language and ends with it
        // in the other: it is the dialog's first paragraph either way.
        ['The format', dialog.locator('p').first()],
        ['PDF', dialog.getByText(t('docExport.pdf.title'), { exact: true })],
        ['PowerPoint', dialog.getByText(t('docExport.pptx.title'), { exact: true })],
        ['PNG images', dialog.getByText(t('docExport.png.title'), { exact: true })],
        ['PSD', dialog.getByText(t('docExport.psd.title'), { exact: true })],
        ['SVG', dialog.getByText(t('docExport.svg.title'), { exact: true })],
      ],
    })
    await page.keyboard.press('Escape')

    // ---- demo mode: a screen in a device, a flyer in a hand, a post in a feed --
    await btn(bar, t('mode.demo')).click()
    const demo = page.locator('div.fixed.inset-0.z-top').last()
    await demo.waitFor()
    await settle(page, 2500)
    const frameToggle = btn(demo, t('canvas.demoFrame'))
    if ((await frameToggle.getAttribute('aria-pressed')) !== 'true') await frameToggle.click()
    const switcher = demo.getByRole('combobox', { name: t('canvas.demoPickScreen') })
    await shoot(ctx, 'demo-device', {
      spots: [
        ['Exit demo', btn(demo, t('canvas.demoExit'))],
        ['Back', btn(demo, t('canvas.demoBack'))],
        ['Restart', btn(demo, t('canvas.demoRestart'))],
        ['Device', frameToggle],
        ['Screen switcher', switcher],
        ['The screen', demo.locator('iframe').first()],
        ['Caption', demo.locator('p.font-mono').last()],
      ],
    })
    await switcher.selectOption('cafe-flyer')
    await settle(page, 2500)
    await shoot(ctx, 'demo-hand', {
      spots: [
        ['Device', frameToggle],
        ['The page', demo.locator('iframe').first()],
        ['The hand', demo.locator('[data-doc="hand-thumb"]')],
        ['Caption', demo.getByText(t('docExport.format.a5'), { exact: true })],
      ],
    })
    await switcher.selectOption('cafe-post')
    await settle(page, 2500)
    await shoot(ctx, 'demo-phone', {
      spots: [
        ['Author row', demo.locator('[data-doc="phone-author"]')],
        ['The post', demo.locator('[data-doc="phone-post"]')],
        ['Carousel counter', demo.locator('[data-doc="phone-counter"]')],
        ['Actions and caption', demo.locator('[data-doc="phone-actions"]')],
        ['Pages', demo.locator('[data-doc="phone-pages"]')],
      ],
    })
    await btn(demo, t('canvas.demoExit')).click()

    // ---- the header and the projects page ---------------------------------------
    const header = page.locator('header').first()
    await header.locator(`button[title="${t('nav.backHome')}"]`).click()
    await settle(page, 1500)
    await shoot(ctx, 'header', {
      clip: header,
      spots: [
        ['Mocky', header.locator(`button[title="${t('nav.backHome')}"]`)],
        ['The open project', btn(header, cafe, true)],
        ['Home', btn(header, t('nav.home'), true)],
        ['DESIGN.md', btn(header, t('nav.design'), true)],
        ['Media', btn(header, t('nav.media'), true)],
        ['Settings', btn(header, t('nav.settings'), true)],
        ['Admin', btn(header, t('nav.admin'), true)],
        ['Docs', header.getByRole('link', { name: t('nav.docs') })],
        ['Theme', btn(header, t('theme.toPaper'))],
        ['Account', btn(header, 'demo')],
      ],
    })
    await shoot(ctx, 'home', {
      spots: [
        ['Navigation', btn(header, t('nav.home'), true)],
        ['Theme', btn(header, t('theme.toPaper'))],
        ['Account', btn(header, 'demo')],
        ['New project', btn(page, t('projects.new')).first()],
        ['New folder', btn(page, t('projects.newFolder'))],
        ['The last project', page.getByRole('heading', { name: cafe })],
        ['A project card', page.locator('article').first()],
      ],
    })

    // ---- settings, the chime, the admin ------------------------------------------
    await btn(header, t('nav.settings'), true).click()
    await settle(page, 1500)
    await shoot(ctx, 'settings', {
      spots: [
        ['Provider', page.getByLabel(t('settings.provider'), { exact: true })],
        ['Base URL', page.getByLabel(t('settings.baseUrl'), { exact: true })],
        ['API key', page.getByLabel(t('settings.apiKey'), { exact: true })],
        ['Model', page.getByLabel(t('settings.model'), { exact: true })],
        ['Test connection', btn(page, t('settings.test'), true)],
      ],
    })
    const chime = page.locator('section').filter({ has: page.getByText(t('chime.heading'), { exact: true }) }).last()
    await chime.scrollIntoViewIfNeeded()
    await shoot(ctx, 'chime', {
      clip: chime,
      pad: 8,
      spots: [
        ['Sound when a generation finishes', chime.getByText(t('chime.toggle'), { exact: true })],
        ['Test', btn(chime, t('chime.test'))],
      ],
    })
    await page.evaluate(() => window.scrollTo(0, 0))
    await btn(header, t('nav.admin'), true).click()
    await settle(page, 1500)
    const adminNav = page.getByRole('navigation', { name: t('dashboard.nav.label') })
    await btn(adminNav, t('dashboard.nav.providers')).click()
    await settle(page, 1500)
    await shoot(ctx, 'admin', {
      spots: [
        ['The dashboard', adminNav],
        ['Screen generation', page.getByText(t('settings.textProfileGeneration'), { exact: true })],
        ['Muse — design dossier', page.getByText(t('settings.textProfileInspiration'), { exact: true })],
      ],
    })
  } finally {
    await browser.close()
    server.stop()
    fs.rmSync(server.dataDir, { recursive: true, force: true })
  }
}

// ---------------------------------------------------------------- the pages

function markdownFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? markdownFiles(p) : e.name.endsWith('.md') ? [p] : []
  })
}

/** Rewrite the `x,y` of every hotspots block showing a picture that was just made. */
function rewritePages() {
  const problems = []
  for (const file of markdownFiles(path.join(ROOT, 'docs'))) {
    const lang = file.includes(`${path.sep}fr${path.sep}`) ? 'fr' : 'en'
    const src = fs.readFileSync(file, 'utf8')
    const out = src.replace(/^(:::hotspots src=(\S+)\.webp[^\n]*\n)((?:- [^\n]*\n)+)(?=:::)/gm, (all, head, src, body) => {
      const name = path.basename(src)
      const inFr = /(^|\/)fr\//.test(src)
      if (inFr !== (lang === 'fr')) return all
      const coords = measured[lang][name]
      if (!coords) return all
      const lines = body.trimEnd().split('\n')
      if (lines.length !== coords.length) {
        problems.push(`${path.relative(ROOT, file)}: ${name} has ${lines.length} points, the capture measured ${coords.length}`)
        return all
      }
      return head + lines.map((l, i) => l.replace(/^- [-\d.]+,[-\d.]+ /, `- ${coords[i][0]},${coords[i][1]} `)).join('\n') + '\n'
    })
    if (out !== src) {
      fs.writeFileSync(file, out)
      console.log(`  updated ${path.relative(ROOT, file)}`)
    }
  }
  if (problems.length) throw new Error('hotspot blocks out of step:\n  ' + problems.join('\n  '))
}

if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
  console.error('No build to photograph: run `npm run build` first.')
  process.exit(1)
}
for (const lang of LANGS) {
  console.log(`capturing ${lang}`)
  await run(lang)
}
rewritePages()
console.log('done')
