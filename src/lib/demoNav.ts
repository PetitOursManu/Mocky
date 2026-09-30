import { autoFlow, type Screen } from './project'

/**
 * Moving through the prototype without its links.
 *
 * Demo mode used to follow hotspots and nothing else, so a screen nobody had
 * linked yet — or a flow the author had only half wired — could not be shown
 * at all: the only way to reach it was to leave the demo, select it on the
 * canvas and start again from there.
 *
 * The order is `autoFlow`'s, the array order, for the reason written there: it
 * is the order every other list in the app shows, and the one the Arrange
 * button lays the canvas out from. Screens with no code are skipped, like a
 * walkthrough skips them.
 */
export function demoOrder(screens: Screen[]): string[] {
  return autoFlow(screens)
}

/**
 * The screen `delta` steps away from `currentId`, wrapping at both ends.
 *
 * Wrapping, not stopping: in a presentation the last screen's "next" going back
 * to the first is what a loop of slides does, and a disabled arrow on a demo
 * someone is showing reads as a dead end. A current screen missing from the
 * order (no code, or deleted meanwhile) steps from the start of the list.
 * Null when there is nothing to step to.
 */
export function stepScreen(order: string[], currentId: string, delta: number): string | null {
  if (order.length === 0) return null
  const at = order.indexOf(currentId)
  if (at < 0) return order[delta < 0 ? order.length - 1 : 0]
  if (order.length === 1) return null
  const next = (((at + delta) % order.length) + order.length) % order.length
  return order[next]
}
