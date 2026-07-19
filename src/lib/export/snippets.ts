/**
 * Ship the vendored snippet-packs as real project files under
 * src/components/ui/. Each pack's hand-written source assumes some implicit
 * globals (React, hooks, cn); here we prepend exactly the imports it needs so
 * the files stand alone as ESM modules, and re-export the pack's declared
 * names. License headers are preserved where applicable.
 */
import { IconsSource, ICONS_EXPORTS } from '../capabilities/snippets/Icons'
import { ChartsSource, CHARTS_EXPORTS } from '../capabilities/snippets/Charts'
import { MotionSource, MOTION_EXPORTS } from '../capabilities/snippets/Motion'
import { cnSource } from '../capabilities/snippets/cn'

const MOCKY_HEADER = '/* Vendored by Mocky export — inline, dependency-free. */'
const MAGICUI_HEADER =
  '/* cn() — MIT-licensed, vendored from the MagicUI project (https://magicui.design). */'

/** src/lib/utils.ts — the cn() class-name helper. */
export function utilsTs(): string {
  return `${MAGICUI_HEADER}\n${cnSource}\n\nexport { cn }\n`
}

/** src/components/ui/icons.tsx — the Icon namespace (inline SVG, no library). */
export function iconsTsx(): string {
  return `${MOCKY_HEADER}\nimport React from 'react'\n\n${IconsSource}\n\nexport { ${ICONS_EXPORTS.join(', ')} }\n`
}

/** src/components/ui/charts.tsx — inline-SVG charts (no chart library). */
export function chartsTsx(): string {
  return `${MOCKY_HEADER}\nimport React from 'react'\n\n${ChartsSource}\n\nexport { ${CHARTS_EXPORTS.join(', ')} }\n`
}

/** src/components/ui/motion.tsx — CSS-only animation components. */
export function motionTsx(): string {
  return `${MOCKY_HEADER}\nimport React, { useState, useEffect, useRef } from 'react'\nimport { cn } from '@/lib/utils'\n\n${MotionSource}\n\nexport { ${MOTION_EXPORTS.join(', ')} }\n`
}

export interface UiFile {
  /** path relative to project root */
  path: string
  content: string
}

/**
 * The set of src/components/ui/* and src/lib/utils.ts files. `cn` (utils) is
 * always included; the packs are always shipped so `@/components/ui/*` imports
 * always resolve regardless of which screens use them.
 */
export function uiFiles(): UiFile[] {
  return [
    { path: 'src/lib/utils.ts', content: utilsTs() },
    { path: 'src/components/ui/icons.tsx', content: iconsTsx() },
    { path: 'src/components/ui/charts.tsx', content: chartsTsx() },
    { path: 'src/components/ui/motion.tsx', content: motionTsx() },
  ]
}
