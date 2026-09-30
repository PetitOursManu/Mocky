import { useEffect, useRef } from 'react'
import { playChime, primeChime, releaseChime } from './chime'
import { createWorkWatcher, markTitle, unmarkTitle, type WorkWatcher } from './workChime'

/**
 * Chime, and mark the tab's title, when user-started work finishes while
 * Mocky is not the tab being looked at.
 *
 * Fed with state the project view already has — "is anything working" and
 * "the error banner" — so no generation path had to learn about sound. The
 * rules (one chime per burst, only when hidden, which sound) are in
 * `workChime.ts`; this is the wiring to the document.
 *
 * Priming happens in two places, both inside the click that starts the work.
 * A capture listener on clicks and Enter reaches every entry point — composer,
 * context menu, dialogs, the phone layout — without an edit in each of them.
 * The burst's own start is the fallback: every flow sets `busy` before its
 * first await, and React flushes the effects of a click synchronously, so that
 * is still the same gesture.
 *
 * The title mark does not depend on the sound preference: it makes no noise,
 * and it is what tells someone with six tabs open which one finished.
 *
 * `failures` is a counter the caller bumps for a failure that never reaches
 * `error` (a repair that gave up, a film render that failed) — see workChime.ts.
 */
export function useWorkChime(active: boolean, error: string | null, failures = 0): void {
  const watcherRef = useRef<WorkWatcher | null>(null)
  if (!watcherRef.current) {
    watcherRef.current = createWorkWatcher({
      isHidden: () => document.visibilityState === 'hidden',
      onStart: primeChime,
      onIdle: () => releaseChime(),
      onFinish: (kind) => {
        document.title = markTitle(document.title, kind)
        void playChime(kind)
      },
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (h) => window.clearTimeout(h as number),
    })
  }

  useEffect(() => {
    watcherRef.current?.observe(active, error, failures)
  }, [active, error, failures])

  useEffect(() => {
    const watcher = watcherRef.current
    if (!watcher) return
    return attachChimeListeners(document, watcher, primeChime, releaseChime)
  }, [])
}

/** What `attachChimeListeners` needs of a document — a fake one in the tests. */
export interface ChimeDocument {
  visibilityState: string
  title: string
  addEventListener(type: string, fn: (e: Event) => void, capture?: boolean): void
  removeEventListener(type: string, fn: (e: Event) => void, capture?: boolean): void
}

/**
 * The document side of the chime: priming on gestures, clearing the title mark
 * on return. Returns the cleanup.
 *
 * Out of the hook so it can be driven with a fake document: a capture flag
 * that differs between add and remove leaks a listener per project opened, and
 * a restore that never runs leaves "✓ " on the tab for good — neither is
 * something anyone hears.
 */
export function attachChimeListeners(
  doc: ChimeDocument,
  watcher: Pick<WorkWatcher, 'noteVisible' | 'dispose'> & Partial<Pick<WorkWatcher, 'busy'>>,
  prime: () => void,
  release?: () => void,
): () => void {
  const onVisibility = () => {
    if (doc.visibilityState !== 'visible') return
    watcher.noteVisible()
    doc.title = unmarkTitle(doc.title)
    // Back on an idle tab: the next work starts with a click, which primes.
    // Not while work runs — the person may leave again before it ends.
    if (release && !watcher.busy?.()) release()
  }
  // Read by `type` and `key`, not `instanceof KeyboardEvent`: the tests run
  // in Node, which has Event but no KeyboardEvent.
  const onGesture = (e: Event) => {
    if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Enter') return
    prime()
  }
  doc.addEventListener('visibilitychange', onVisibility)
  doc.addEventListener('click', onGesture, true)
  doc.addEventListener('keydown', onGesture, true)
  return () => {
    doc.removeEventListener('visibilitychange', onVisibility)
    doc.removeEventListener('click', onGesture, true)
    doc.removeEventListener('keydown', onGesture, true)
    watcher.dispose()
    // Leaving the project is looking at the app: nothing is waiting any more.
    doc.title = unmarkTitle(doc.title)
  }
}
