import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Screenshots of an existing site (lib/siteReference.ts), held where a unit
 * test cannot reach: ProjectView's `generate`, a closure over React state, and
 * the pipeline it hands a new screen to (lib/pipeline/newScreen.ts), which
 * needs a dozen network stages to run. Read from the source, like
 * tests/ultra-off.test.js.
 *
 * Two promises. With no screenshot attached, the generation path is the one it
 * was — every new branch is behind `siteNew`, `reproducing` or `siteSection`,
 * all false or empty then. And the screenshots never go anywhere but the model
 * request: somebody else's site is the third-party picture M2 keeps out of
 * storage, so only the composer may hold them.
 */
const root = fileURLToPath(new URL('..', import.meta.url))
const view = readFileSync(join(root, 'src/components/ProjectView.tsx'), 'utf8').replace(/\r\n/g, '\n')
const pipeline = readFileSync(join(root, 'src/lib/pipeline/newScreen.ts'), 'utf8').replace(/\r\n/g, '\n')

function files(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...files(p))
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) out.push(p)
  }
  return out
}

describe('site screenshots in the generation path', () => {
  it('derive every branch from the attached shots, so none runs without them', () => {
    // The composer hands the shots over only for a new screen…
    expect(view).toContain('const siteNew = !!site && targets.length === 0')
    expect(view).toContain("const reproducing = siteNew && site.mode === 'reproduce'")
    // …and the pipeline, which only ever makes new screens, reads them from there.
    expect(pipeline).toContain('const siteNew = !!site')
    expect(pipeline).toContain("const reproducing = siteNew && site.mode === 'reproduce'")
    expect(pipeline).toContain('let siteSection = siteNew ? buildSiteReferenceSection(')
    expect(pipeline).toContain('if (siteSection) planSection = [planSection, siteSection, sitePicturesSection]')
  })

  it('keep the annotations first, so their visible numbers stay the model’s', () => {
    expect(view).toContain('const images = [...annotations.map((a) => a.dataUrl), ...(site ? site.parts : [])]')
    expect(view).toContain('annotationCount: annotations.length')
    expect(pipeline).toContain('buildSiteReferenceSection(site.mode, site.groups, req.annotationCount + 1)')
  })

  it('skip Muse, Motion Ultra and the planner where the screenshot is the authority', () => {
    expect(pipeline).toContain('if (museConfig.enabled && museAvail !== false && !reproducing && !museBlind) {')
  })

  it('read the site before Muse on a redesign, and keep Muse out when the reading failed', () => {
    // Written from "Refonte graphique de ce site" alone, the dossier invented a
    // product and its preamble made the invention authoritative.
    const reading = pipeline.indexOf('siteContent = await readSiteContent(settings, site.parts, signal)')
    const dossier = pipeline.indexOf('const res = await runMuseDossier(museBrief, {')
    expect(reading).toBeGreaterThan(0)
    expect(dossier).toBeGreaterThan(reading)
    expect(pipeline).toContain('const museBlind = siteNew && !reproducing && !siteContent')
    expect(pipeline).toContain('if (runUltra && project.ultra && !siteNew) {')
    expect(pipeline).toContain('if (settings.usePlanner && pipe.planner && !musePreamble && !ultraRecord && !siteNew) {')
  })

  it('replace the site pictures only where no dossier already made them', () => {
    // A redesign Muse ran for has its pictures; a second set would compete.
    expect(pipeline).toContain('const sitePictures = siteNew && (reproducing || !museRan) && picturesAllowed ? parseSitePictures(siteContent) : []')
    // `picturesAllowed` only ever says no for a DOCUMENT whose own Images choice
    // is "Sans image": for every other screen it is true, and the rule above is
    // the one it always was.
    expect(pipeline).toContain('const picturesAllowed = !pipe.document || runDocPicture !== null')
    expect(pipeline).toContain('if (siteSection) planSection = [planSection, siteSection, sitePicturesSection]')
  })

  it('refuse to regenerate a screen whose screenshots are gone, instead of inventing one', () => {
    expect(view).toContain('if (screen.siteRef && !siteRun) {')
  })
})

describe('site screenshots stay in the browser', () => {
  it('are named only by the two composers, the Screen type and their own module', () => {
    const allowed = new Set([
      'src/components/ProjectView.tsx',
      // The composer's generation path, moved out of ProjectView: it passes the
      // shots to the model and records the intent, and nothing else.
      'src/lib/pipeline/newScreen.ts',
      'src/components/SiteReferencePicker.tsx',
      'src/lib/sitePictures.ts',
      'src/components/Welcome.tsx',
      'src/lib/project.ts',
      'src/lib/siteReference.ts',
      'src/lib/siteReference.test.ts',
    ])
    const offenders = [...files(join(root, 'src')), ...files(join(root, 'server'))]
      .filter((p) => /siteReference|SiteShot|siteShots/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(root, p).replace(/\\/g, '/'))
      .filter((p) => !allowed.has(p))
    expect(offenders).toEqual([])
  })

  it('persist only the intent on a screen, never a picture', () => {
    const project = readFileSync(join(root, 'src/lib/project.ts'), 'utf8')
    expect(project).toContain('siteRef?: { mode: SiteRefMode; shots: number }')
    expect(pipeline).toContain('siteRef: siteNew ? { mode: site.mode, shots: site.groups.length } : undefined')
  })

  it('are never fetched, posted or uploaded by their module', () => {
    const mod = readFileSync(join(root, 'src/lib/siteReference.ts'), 'utf8')
    expect(mod).not.toMatch(/\bfetch\(|XMLHttpRequest|localStorage|indexedDB/)
  })
})
