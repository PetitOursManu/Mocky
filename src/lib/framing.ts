// How the infinite canvas decides what to show.
//
// This lives apart from Canvas.tsx because it is arithmetic, and arithmetic
// that was wrong: "Fit all" computed an {x, y, scale} once and left it there,
// so it framed the project for whatever the container measured at the instant
// the button was pressed. Resize the window — or open a panel, or rotate a
// tablet — and the numbers still described a container that no longer existed.
// The button looked like it worked and then quietly stopped agreeing with the
// screen, with nothing to click to find out why.
//
// Splitting it out is what makes the fix checkable: a container size is a pair
// of numbers, so every framing question can be asked in a test instead of by
// resizing a browser and squinting.

import type { Box, Screen } from './project'

/** The canvas transform: world coordinates times `scale`, then offset. */
export interface ViewState {
  x: number
  y: number
  scale: number
}

/** The visible area a framing has to fit inside, in CSS pixels. */
export interface Viewport {
  width: number
  height: number
}

export const MIN_SCALE = 0.05
export const MAX_SCALE = 1.5

/** Breathing room left around a framed box, in screen px on each side. */
export const FRAME_PAD = 80

/**
 * Ceilings for the two automatic framings, both below MAX_SCALE and for
 * different reasons: "fit all" stops at life size because a board blown up past
 * 100% is not showing you an arrangement, and "zoom to one screen" stops just
 * short of it so the frame keeps a visible edge instead of bleeding off the
 * container. Neither is the ceiling the wheel and the +/− buttons obey.
 */
export const FIT_MAX_SCALE = 1
export const FOCUS_MAX_SCALE = 0.9

/**
 * The reference/design column beside a frame, in WORLD units.
 *
 * World rather than screen units because this column takes up room on the
 * board: anything sized against the zoom occupies a footprint that changes with
 * it, and a neighbour that moves when you zoom out is the one thing an infinite
 * canvas must not do.
 */
export const CARD_W = 320
/** Gap between a frame's right edge and its card, also in world units. */
export const CARD_GUTTER = 40

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * What the view is framed ON, kept as an intent rather than as its result.
 *
 * Remembering the intent is what lets the numbers be recomputed whenever the
 * container changes size. `null` means the framing is the user's own: any
 * manual pan or zoom clears it, because re-imposing ours on the next resize
 * would be the very same bug aimed at the person who had just fixed it by hand.
 */
export type Framing = { kind: 'all' } | { kind: 'screen'; id: string } | null

/**
 * The view that frames `box` inside `viewport`, or null if it cannot.
 *
 * One function for both framings. They were two copies of the same arithmetic
 * written differently — `(width - w * scale) / 2 - x * scale` in one and
 * `width / 2 - (x + w / 2) * scale` in the other — which are equal, so the
 * duplication bought nothing and cost the usual: a fix applied to one of them.
 */
export function frameBox(
  box: Box,
  viewport: Viewport,
  pad: number,
  maxScale: number,
): ViewState | null {
  if (box.w <= 0 || box.h <= 0) return null
  if (viewport.width <= 0 || viewport.height <= 0) return null
  const scale = clamp(
    Math.min((viewport.width - pad * 2) / box.w, (viewport.height - pad * 2) / box.h),
    MIN_SCALE,
    maxScale,
  )
  return {
    x: (viewport.width - box.w * scale) / 2 - box.x * scale,
    y: (viewport.height - box.h * scale) / 2 - box.y * scale,
    scale,
  }
}

/**
 * Everything the board draws, not just the frames.
 *
 * The image/design column hangs off the right of a frame, outside its box, so
 * bounding only on `x + w` framed the project with every card sliced down the
 * middle. Only screens that actually draw one are widened: adding the column's
 * width unconditionally would loosen the fit of a project that has no cards at
 * all, which is most of them.
 *
 * An attached media draws in that same column, so it widens the box the same
 * way. It is a second reason for the column to exist rather than a second
 * column — the test that matters is "does this screen draw one", and the answer
 * has to stay in step with what Canvas actually renders.
 */
export function contentBox(screens: Pick<Screen, 'x' | 'y' | 'w' | 'h' | 'imageHash' | 'attachedMedia'>[]): Box | null {
  if (screens.length === 0) return null
  const minX = Math.min(...screens.map((s) => s.x))
  const minY = Math.min(...screens.map((s) => s.y))
  const maxX = Math.max(
    ...screens.map((s) => s.x + s.w + (s.imageHash || s.attachedMedia ? CARD_GUTTER + CARD_W : 0)),
  )
  const maxY = Math.max(...screens.map((s) => s.y + s.h))
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/**
 * The screen a project produced most recently, or null on an empty board.
 *
 * Creation order, not the selection and not the array tail. The selection moves
 * every time the user clicks anywhere, and while `addScreen` only ever appends,
 * nothing promises the array stays in that order after an import or a merge
 * from another device. `createdAt` is the one of the three that still answers
 * "the last one generated" in all of those cases.
 */
export function latestScreenOf<T extends Pick<Screen, 'createdAt'>>(screens: T[]): T | null {
  return screens.reduce<T | null>((best, s) => (!best || s.createdAt > best.createdAt ? s : best), null)
}
