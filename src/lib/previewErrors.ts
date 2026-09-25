/**
 * Is this preview error about the ENVIRONMENT rather than the screen's code?
 *
 * The preview frame reports two kinds of failure through the same channel: the
 * component threw, or the frame never got a runtime to run it in — React, Babel
 * or a capability's bundle did not load. The second kind was sent to the model
 * for "repair" like the first, and it cannot be repaired from the code: the
 * model is asked to fix a file that has nothing wrong with it, paid twice per
 * screen, and its answer is written back over a sound screen. Found when a
 * browser that refuses subresources to sandboxed frames opened an old project
 * and the repair loop started rewriting it.
 *
 * The messages are matched on the sentences Preview.tsx itself writes, so the
 * two cannot drift without the test beside this file noticing.
 */
export function isEnvironmentError(message: string): boolean {
  return /^(React|ReactDOM|Babel) failed to load from \/vendor\//.test(message) ||
    /^Capability "[^"]+" failed to load: window\.\w+ is undefined/.test(message)
}
