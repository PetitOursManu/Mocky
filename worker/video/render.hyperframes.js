// The HyperFrames half of the worker: the same `renderTimeline` contract as
// `render.js`, with HyperFrames (Apache-2.0) drawing the frames instead of
// Remotion.
//
// The compositions are not translated. They are the files under `remotion/`,
// compiled with esbuild and with ONE substitution: `remotion/clock.js` and
// `remotion/clockCanvas.js`, the only two doors through which a composition
// reaches an engine, are swapped for `remotion/hyperframes/`. A bundle that still
// reached a Remotion package after that would be a bundle quietly carrying the
// licence this engine exists to do without, so the build refuses one by name.
//
// Same reason as `render.js` for living apart from `server.js`: this file imports
// esbuild and the producer at the top, and `server.js` is imported by a test that
// runs where neither is installed.
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { createRenderJob, executeRenderJob } from '@hyperframes/producer'
import { codecFor, encodingOptionsFor } from './encoding.js'
import { compositionIdFor, filmMetadata } from './remotion/composition.js'
import { stageImages, unstage } from './staging.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REMOTION_DIR = path.join(HERE, 'remotion')
const ENTRY_POINT = path.join(REMOTION_DIR, 'hyperframes', 'entry.jsx')

/** The engine doors, and what this engine puts behind them. */
export const ENGINE_ALIASES = {
  [path.join(REMOTION_DIR, 'clock.js')]: path.join(REMOTION_DIR, 'hyperframes', 'clock.jsx'),
  [path.join(REMOTION_DIR, 'clockCanvas.js')]: path.join(REMOTION_DIR, 'hyperframes', 'clockCanvas.jsx'),
}

const engineDoors = {
  name: 'mocky-engine-doors',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /clock(Canvas)?\.js$/ }, (args) => {
      const target = ENGINE_ALIASES[path.resolve(args.resolveDir, args.path)]
      return target ? { path: target } : undefined
    })
    pluginBuild.onResolve({ filter: /^(remotion|@remotion\/.*)$/ }, (args) => ({
      errors: [{ text: `${args.path} reached the HyperFrames bundle from ${args.importer}: import it through remotion/clock.js` }],
    }))
  },
}

/** Where the compiled page lives; built once per process, like Remotion's bundle. */
let bundlePromise = null

function servedBundle() {
  if (!bundlePromise) {
    bundlePromise = (async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mocky-hyperframes-'))
      await build({
        entryPoints: [ENTRY_POINT],
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: 'chrome120',
        outdir: dir,
        entryNames: 'film',
        assetNames: 'assets/[name]-[hash]',
        // Relative, so the typefaces resolve against the page wherever the
        // producer's file server mounts the project.
        publicPath: '.',
        jsx: 'automatic',
        loader: { '.js': 'jsx', '.woff2': 'file' },
        define: { 'process.env.NODE_ENV': '"production"' },
        minify: true,
        logLevel: 'error',
        plugins: [engineDoors],
      })
      return dir
    })().catch((err) => {
      // Not memoised, for `render.js`'s reason: a full /tmp clears on its own.
      bundlePromise = null
      throw err
    })
  }
  return bundlePromise
}

/**
 * `encoding.js`'s settings, in the producer's words.
 *
 * Not decoration: `worstCaseBytes` is the bound the disk budget is sized
 * against, and it holds only if the encoder is capped at the rate it assumes.
 * Left to HyperFrames' own `quality: 'high'`, a photo slideshow came out 80%
 * larger than Remotion's — inside the bound that time, by luck. The CRF and the
 * cap are Remotion's, so the two engines spend the same bits.
 */
export function encoderSettingsFor(format, durationMs) {
  const options = encodingOptionsFor(codecFor(format), durationMs)
  if (format === 'webm') {
    // HyperFrames encodes WebM with VP9 and REFUSES a rate cap there
    // ("maxBitrate apply to mp4 renders, not webm" — the first WebM of the
    // corpus failed on it). So a WebM gets the average and no ceiling: the
    // bound holds on average rather than by construction, which is weaker than
    // Remotion's VP8 and is written down in docs/video-export.md.
    return { videoBitrate: options.videoBitrate }
  }
  return { crf: options.crf, maxBitrate: options.encodingMaxRate, bufferSize: options.encodingBufferSize }
}

/** JSON that cannot close the `<script>` it sits in. */
const inlineJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c')

/**
 * The page for one film: a root the producer can read the geometry and length
 * off before it opens a browser, and the props the compositions receive.
 */
export function filmPage(timeline, imageSrc) {
  const meta = filmMetadata(timeline)
  const seconds = meta.durationInFrames / meta.fps
  // Relative paths: staged pictures sit beside the page in the same directory.
  const relative = Object.fromEntries(Object.entries(imageSrc || {}).map(([id, src]) => [id, src.replace(/^\//, '')]))
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${meta.width}, height=${meta.height}">
<style>
/* Remotion's own page rule (default-css.ts), which every composition was laid
   out under: without it a padded fill measures its padding OUTSIDE its width,
   and the titles' rule ran past the safe margin to the frame's edge. */
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #000; }
#root { position: relative; width: ${meta.width}px; height: ${meta.height}px; overflow: hidden; }
#mocky-stage { position: absolute; inset: 0; }
</style>
</head>
<body>
<div id="root" data-composition-id="mocky-film" data-start="0" data-duration="${seconds}" data-width="${meta.width}" data-height="${meta.height}" data-fps="${meta.fps}">
<div id="mocky-stage"></div>
</div>
<script type="application/json" id="mocky-film">${inlineJson({ timeline, imageSrc: relative })}</script>
<script src="film.js"></script>
</body>
</html>
`
}

export async function warmUp(log = console) {
  try {
    await servedBundle()
    return { warm: true }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    log.warn?.(`mocky-video-worker: HyperFrames warm-up failed, the first render will pay for it — ${detail}`)
    return { warm: false, detail }
  }
}

/**
 * Render one VideoTimeline and return its bytes — `render.js`'s contract.
 *
 * `licenseKey` is accepted and ignored: HyperFrames has no licence to apply,
 * which is the point of it.
 */
export async function renderTimeline({ timeline, images = [], signal } = {}) {
  // Throws on a template with no composition, before a browser opens — the same
  // refusal `render.js` gets from `selectComposition`.
  compositionIdFor(timeline.template)
  const dir = await servedBundle()
  const staged = await stageImages(dir, images)
  const page = `film-${staged.token}.html`
  const format = timeline.outputFormat === 'webm' ? 'webm' : 'mp4'
  const output = path.join(os.tmpdir(), `mocky-film-${crypto.randomBytes(8).toString('hex')}.${format}`)
  const meta = filmMetadata(timeline)
  try {
    await fs.writeFile(path.join(dir, page), filmPage(timeline, staged.imageSrc))
    const job = createRenderJob({
      fps: meta.fps,
      quality: 'high',
      format,
      entryFile: page,
      ...encoderSettingsFor(format, (meta.durationInFrames / meta.fps) * 1000),
    })
    await executeRenderJob(job, dir, output, undefined, signal)
    const buffer = await fs.readFile(output)
    return { buffer, contentType: format === 'webm' ? 'video/webm' : 'video/mp4' }
  } finally {
    await fs.rm(path.join(dir, page), { force: true }).catch(() => {})
    await fs.rm(output, { force: true }).catch(() => {})
    await unstage(staged)
  }
}
