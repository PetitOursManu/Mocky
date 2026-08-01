#!/usr/bin/env node
/**
 * Builds public/vendor/motion.js — Motion, as a browser global, for the preview.
 *
 * WHY THIS SCRIPT EXISTS
 *
 * Every other vendored bundle is copied straight out of node_modules because it
 * already ships a browser build. Motion does not: 12.x publishes ESM and CJS
 * only. The preview iframe has no module resolution — it loads plain scripts and
 * reads globals off `window` — so the package has to be bundled into an IIFE
 * first, once, at development time.
 *
 * REACT IS NOT BUNDLED IN
 *
 * The iframe already loads React and ReactDOM from /vendor. Bundling a second
 * copy inside Motion would give the page two Reacts, two dispatchers, and hooks
 * that throw "invalid hook call" the moment a motion component renders. The two
 * imports are therefore redirected to the globals the shell has already set.
 *
 * Usage:  node scripts/build-vendor-motion.mjs
 * Then:   update the SHA-256 in public/vendor/VENDOR.md (check-vendor prints it).
 */
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'public', 'vendor', 'motion.js')

/** Redirects `react` / `react-dom` to the globals the preview shell provides. */
const useGlobalReact = {
  name: 'use-global-react',
  setup(b) {
    b.onResolve({ filter: /^(react|react-dom)$/ }, (args) => ({ path: args.path, namespace: 'global-react' }))
    b.onLoad({ filter: /.*/, namespace: 'global-react' }, (args) => ({
      contents:
        args.path === 'react'
          ? 'module.exports = window.React'
          : 'module.exports = window.ReactDOM',
      loader: 'js',
    }))
  },
}

const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies.motion

await build({
  // Only what <Animated> needs. Motion's full surface is deliberately not
  // exposed — see the closed preset registry — so there is no reason to ship
  // the parts of it nothing calls.
  stdin: {
    contents: `export { motion, AnimatePresence, useReducedMotion } from 'motion/react'`,
    resolveDir: root,
    loader: 'js',
  },
  bundle: true,
  format: 'iife',
  globalName: 'Motion',
  platform: 'browser',
  target: ['es2019'],
  minify: true,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [useGlobalReact],
  outfile: out,
})

const bytes = fs.readFileSync(out)
const sha = crypto.createHash('sha256').update(bytes).digest('hex')
console.log(`public/vendor/motion.js  ${(bytes.length / 1024).toFixed(1)} kB  motion@${version}`)
console.log(`sha256 ${sha}`)
