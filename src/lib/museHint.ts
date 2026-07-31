/**
 * Whether the Muse control still needs to announce itself.
 *
 * Muse is the most capable thing in the composer and the least visible: one
 * grey word in a footer of grey words, next to the DESIGN.md toggle and the
 * keyboard shortcut. People generated for days without ever switching it on,
 * not because they had decided against it — because they never saw it.
 *
 * So the control twinkles (see `.muse-hint` in index.css) until it has been
 * used once, and then never again. A hint that keeps hinting after the user has
 * answered it is just noise, and this one sits three centimetres from the field
 * they are typing in.
 */

const KEY = 'mocky.museTried.v1'

/** True once Muse has been switched on at least once on this device. */
export function museHintDone(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    // No storage (private mode, blocked cookies): we cannot remember the
    // answer, so we stay quiet rather than hint on every single visit.
    return true
  }
}

/** Remember that the offer has been taken up. Never throws. */
export function markMuseHintDone(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* Nothing to do: the hint simply keeps showing for this session. */
  }
}
