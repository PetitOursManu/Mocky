/**
 * Ship the vendored snippet-packs as real project files under
 * src/components/ui/. Each pack's hand-written source assumes some implicit
 * globals (React, hooks, cn); here we prepend exactly the imports it needs so
 * the files stand alone as ESM modules, and re-export the pack's declared
 * names. License headers are preserved where applicable.
 *
 * ── WHY .jsx AND A .d.ts BESIDE IT ───────────────────────────────────────────
 *
 * These sources are JavaScript. They were written for a browser with no module
 * system and no compiler: `var Icon = {}` then `Icon.Home = …`, a variadic `cn`
 * that reads `arguments`, `window.THREE`. Shipped as `.tsx` they were type-
 * checked, and the exported project's own `npm run build` — which is
 * `tsc && vite build` — failed on every one of them: fifty errors in files
 * nobody had asked TypeScript to read. A real export was installed and built to
 * find that out, which is the only way this kind of thing is ever found.
 *
 * So the pack ships as the JavaScript it is, and a hand-written `.d.ts` beside
 * it says what the screens may expect: every export is a component taking any
 * props, `Icon` is a namespace of them, `cn` takes anything and returns a
 * string. TypeScript then resolves the module through the declaration, checks
 * the SCREENS (which are the files worth checking) and leaves the vendored
 * JavaScript alone.
 */
import { IconsSource, ICONS_EXPORTS } from '../capabilities/snippets/Icons'
import { ChartsSource, CHARTS_EXPORTS } from '../capabilities/snippets/Charts'
import { MotionSource, MOTION_EXPORTS } from '../capabilities/snippets/Motion'
import { AnimateSource, ANIMATE_EXPORTS } from '../capabilities/snippets/Animate'
import { Scene3DSource, SCENE3D_EXPORTS } from '../capabilities/snippets/Scene3D'
import { ScrollVideoSource, SCROLLVIDEO_EXPORTS } from '../capabilities/snippets/ScrollVideo'
import { MotionFilmSource, MOTIONFILM_EXPORTS } from '../capabilities/snippets/MotionFilm'
import { cnSource } from '../capabilities/snippets/cn'

const MOCKY_HEADER = '/* Vendored by Mocky export — inline, dependency-free. */'
const MAGICUI_HEADER =
  '/* cn() — MIT-licensed, vendored from the MagicUI project (https://magicui.design). */'

/** src/lib/utils.js — the cn() class-name helper, as the JavaScript it is. */
export function utilsJs(): string {
  return `${MAGICUI_HEADER}\n${cnSource}\n\nexport { cn }\n`
}

/**
 * src/lib/utils.d.ts — what a screen may assume about `cn`.
 *
 * Variadic, because the source reads `arguments`: shipped without this, every
 * `className={cn('p-6', open && 'ring')}` in every screen was "Expected 0
 * arguments, but got 2".
 */
export function utilsDts(): string {
  return `${MOCKY_HEADER}\nexport declare function cn(...inputs: any[]): string\n`
}

/**
 * One pack, as a standalone module.
 *
 * Every snippet source is written against the implicit globals Mocky's preview
 * provides — `React` as a namespace, and `cn` for the packs that call it. A
 * pack that ships as a file therefore needs exactly those imports, and the list
 * has to be here rather than guessed per pack: four packs were missing
 * altogether (`animate`, `scene3d`, `scrollvideo`, `motionfilm`) while
 * `rewrite.ts` kept emitting `import { Animated } from '@/components/ui/animate'`
 * from the registry, so an exported project with a single animated block could
 * not resolve its own import. The test that closes the class is in
 * `project.test.ts`: every pack in the registry has a file, and every name it
 * exports is exported here.
 */
function packJsx(source: string, exports: readonly string[], head = ''): string {
  return `${MOCKY_HEADER}\nimport React from 'react'\n${head}\n${source}\n\nexport { ${exports.join(', ')} }\n`
}

/**
 * The declarations beside a pack: every export is a component that takes any
 * props, except the icon namespace, which is a record of them.
 *
 * Deliberately loose. These components are documented by the capability card a
 * model reads, not by a type — and a wrong-but-precise signature here would
 * turn a screen that renders into a build that fails.
 */
function packDts(exports: readonly string[]): string {
  const lines = exports.map((name) =>
    name === 'Icon'
      ? `export declare const Icon: Record<string, React.FC<any>>`
      : `export declare const ${name}: React.FC<any>`,
  )
  return `${MOCKY_HEADER}\nimport type React from 'react'\n\n${lines.join('\n')}\n`
}

/** src/components/ui/icons.jsx — the Icon namespace (inline SVG, no library). */
export function iconsJsx(): string {
  return packJsx(IconsSource, ICONS_EXPORTS)
}

/** src/components/ui/charts.jsx — inline-SVG charts (no chart library). */
export function chartsJsx(): string {
  return packJsx(ChartsSource, CHARTS_EXPORTS)
}

/** src/components/ui/motion.jsx — CSS-only animation components (retired pack, still shipped for old screens). */
export function motionJsx(): string {
  return `${MOCKY_HEADER}\nimport React, { useState, useEffect, useRef } from 'react'\nimport { cn } from '@/lib/utils'\n\n${MotionSource}\n\nexport { ${MOTION_EXPORTS.join(', ')} }\n`
}

/** src/components/ui/animate.jsx — `<Animated preset>`, `Ticker`, `CountUp`. */
export function animateJsx(): string {
  /*
   * No Motion dependency, and that is the component's own design: it uses
   * `window.Motion` when the preview has loaded it and falls back to CSS
   * keyframes when nothing is there. An exported project has nothing there, so
   * every preset runs on the CSS path — the same path a screenshot and a
   * reduced-motion visitor already get.
   */
  return packJsx(AnimateSource, ANIMATE_EXPORTS)
}

/**
 * src/components/ui/scene3d.jsx — `<Scene3D preset>`.
 *
 * `withThree` follows the SCREENS: three.js is 600 KB, and a project whose
 * screens never name a scene should not carry it. The component reads
 * `window.THREE` (inside Mocky the library arrives as one vendored script, with
 * no module system), so the export puts the library where it looks rather than
 * rewriting a component nobody asked to change. Without it the effect returns
 * on its first line and the element draws its own gradient — the documented
 * fallback for a browser with no WebGL, not a hole.
 */
export function scene3dJsx(withThree: boolean): string {
  const head = withThree
    ? `import * as THREE from 'three'\n\n/* The component reads window.THREE — one vendored script is how it arrives in Mocky's preview. */\nif (typeof window !== 'undefined') window.THREE = THREE\n`
    : `\n/* No screen in this project asked for a 3D scene, so three.js is not a\n   dependency and <Scene3D> draws its calm gradient. To turn it on:\n   npm i three, then import the namespace here and assign window.THREE. */\n`
  return packJsx(Scene3DSource, SCENE3D_EXPORTS, head)
}

/** src/components/ui/scrollvideo.jsx — `<ScrollSequence>`, a scroll-driven image sequence. */
export function scrollVideoJsx(): string {
  return packJsx(ScrollVideoSource, SCROLLVIDEO_EXPORTS)
}

/**
 * src/components/ui/motionfilm.jsx — `<MotionFilm src>`.
 *
 * The src is a Mocky route (`/api/video/<hash>`), so an exported site served
 * from anywhere else shows the poster and no film — the same limitation every
 * generated `<img src="/api/images/…">` has. It is stated in the export's
 * README and it is not this file's to fix.
 */
export function motionFilmJsx(): string {
  return packJsx(MotionFilmSource, MOTIONFILM_EXPORTS)
}

export interface UiFile {
  /** path relative to project root */
  path: string
  content: string
}

/**
 * The set of src/components/ui/* and src/lib/utils.* files. `cn` (utils) is
 * always included; the packs are always shipped so `@/components/ui/*` imports
 * always resolve regardless of which screens use them.
 *
 * ALWAYS, and the word is load-bearing: `rewrite.ts` builds its import map from
 * the registry, so a pack with no file here is an import of a module that does
 * not exist. `project.test.ts` derives the expected list from `CAPABILITIES`
 * instead of trusting this one.
 */
export function uiFiles(opts: { three?: boolean } = {}): UiFile[] {
  const pack = (id: string, content: string, exports: readonly string[]): UiFile[] => [
    { path: `src/components/ui/${id}.jsx`, content },
    { path: `src/components/ui/${id}.d.ts`, content: packDts(exports) },
  ]
  return [
    { path: 'src/lib/utils.js', content: utilsJs() },
    { path: 'src/lib/utils.d.ts', content: utilsDts() },
    ...pack('icons', iconsJsx(), ICONS_EXPORTS),
    ...pack('charts', chartsJsx(), CHARTS_EXPORTS),
    ...pack('motion', motionJsx(), MOTION_EXPORTS),
    ...pack('animate', animateJsx(), ANIMATE_EXPORTS),
    ...pack('scene3d', scene3dJsx(opts.three === true), SCENE3D_EXPORTS),
    ...pack('scrollvideo', scrollVideoJsx(), SCROLLVIDEO_EXPORTS),
    ...pack('motionfilm', motionFilmJsx(), MOTIONFILM_EXPORTS),
  ]
}
