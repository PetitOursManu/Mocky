#!/usr/bin/env node
/**
 * Builds public/vendor/three.js — three.js, as a browser global, for the preview.
 *
 * WHY THIS SCRIPT EXISTS
 *
 * Same reason as `build-vendor-motion.mjs`: the preview iframe has no module
 * resolution. It loads plain scripts and reads globals off `window`, and three
 * publishes ESM only, so the package is bundled into an IIFE once, here, at
 * development time. The result is committed and hash-pinned in
 * `public/vendor/VENDOR.md` like every other bundle the sandbox runs — that is
 * invariant I3, and `npm run check:vendor` is what enforces it.
 *
 * WHY A HAND-WRITTEN ENTRY POINT RATHER THAN `export * from 'three'`
 *
 * three's full surface is about a megabyte of loaders, controls, curves, audio
 * and post-processing, none of which a closed catalogue of scenes can reach:
 * the model never writes three code, it names a preset (see
 * `snippets/Scene3D.ts`). So the entry below lists exactly what those presets
 * draw with, esbuild drops the rest, and the file that ships is the one the
 * sandbox can actually use. Adding a preset that needs a new class means adding
 * the class here, rebuilding, and re-pinning — which is the point: every byte
 * the preview executes is a byte somebody chose.
 *
 * THE RENDERER IS THE WEIGHT, AND IT IS NOT OPTIONAL
 *
 * Most of what survives tree-shaking is `WebGLRenderer` and the shader chunks it
 * compiles from. There is no smaller door to WebGL through this library, and
 * writing raw WebGL by hand instead would be a second renderer for Mocky to
 * maintain — the thing this whole feature is arranged to avoid.
 *
 * Usage:  node scripts/build-vendor-three.mjs
 * Then:   update the SHA-256 in public/vendor/VENDOR.md (check-vendor prints it).
 */
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'public', 'vendor', 'three.js')

/**
 * What the scene catalogue draws with — and nothing else.
 *
 * Grouped the way the presets use them, so a reader can tell which line pays
 * for which look. `Scene3D` is written against exactly this list; anything it
 * cannot name, it cannot draw.
 */
const ENTRY = `export {
  // The stage: a renderer, a scene, a camera. No Clock: it is deprecated in
  // 0.185 and warned in the console of every preview; the component keeps its
  // own start stamp instead.
  WebGLRenderer, Scene, PerspectiveCamera, Group, Color, MathUtils,
  // Light, for the presets that have matter rather than only silhouette.
  AmbientLight, DirectionalLight,
  // The bodies. Procedural only: nothing here can load a model, and the
  // preview's CSP forbids the fetch a loader would need anyway.
  Mesh, SphereGeometry, BoxGeometry, TorusGeometry, TorusKnotGeometry,
  IcosahedronGeometry, PlaneGeometry,
  // The materials the palette can be measured through: flat colour, and a
  // physical one for the lit presets.
  MeshBasicMaterial, MeshStandardMaterial,
  // The field of points.
  Points, PointsMaterial, BufferGeometry, BufferAttribute, Float32BufferAttribute,
} from 'three'`

const version = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', 'three', 'package.json'), 'utf8')).version

await build({
  stdin: { contents: ENTRY, resolveDir: root, loader: 'js' },
  bundle: true,
  format: 'iife',
  globalName: 'THREE',
  minify: true,
  legalComments: 'none',
  target: ['es2019'],
  outfile: out,
})

const bytes = fs.readFileSync(out)
const sha = crypto.createHash('sha256').update(bytes).digest('hex')
const gzip = (await import('node:zlib')).gzipSync(bytes).length
console.log(`three ${version} → public/vendor/three.js`)
console.log(`  ${(bytes.length / 1024).toFixed(0)} KB raw, ${(gzip / 1024).toFixed(0)} KB gzipped`)
console.log(`  sha256 ${sha}`)
console.log('  put that hash in public/vendor/VENDOR.md')
