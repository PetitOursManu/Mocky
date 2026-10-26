/**
 * A short tap felt in the hand when an option is switched, on a phone.
 *
 * The Vibration API asks for no permission — Android Chrome honours it after
 * any user gesture, which every caller here is — and is simply absent where it
 * does not exist (iOS Safari, desktops), so this is a no-op there rather than a
 * feature to detect at every call site. Only on a coarse pointer: a laptop with
 * a vibration motor buzzing on a mouse click is not what was asked for.
 *
 * Ten milliseconds: long enough to be felt, short enough to read as a click and
 * not as a notification.
 */
export function haptic(ms = 10): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(pointer: coarse)').matches) return
    navigator.vibrate(ms)
  } catch {
    // A browser that throws on vibrate (some embedded views do) loses a tap, nothing else.
  }
}

/**
 * Whether a field may take the focus on its own when it appears.
 *
 * On a phone a focused field opens the keyboard, which covers half the screen
 * the person had just opened to LOOK at — the first composer, the library's
 * pictures. A mouse-and-keyboard device keeps the convenience.
 */
export function autoFocusOk(): boolean {
  try {
    return !(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
  } catch {
    return true
  }
}
