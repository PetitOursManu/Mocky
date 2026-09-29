/**
 * When does a finished piece of work deserve a sound, and which one?
 *
 * The sound itself is `chime.ts`; the React wiring is `useWorkChime.ts`. This
 * file is only the decision, with every browser dependency passed in, because
 * each rule below is the fix for a way the naive version is wrong — and a rule
 * about timing is exactly the kind nobody checks by ear twice.
 *
 * - **One sound per BURST, not per step.** A generation is followed, a moment
 *   later, by its automatic repair when the preview reports an error (the
 *   repair is refused while `busy` is on, so it can only start after). Played on
 *   every falling edge, a hidden tab would chime "done", then chime again two
 *   seconds later for the repair nobody asked about. So the end of the work is
 *   only a CANDIDATE end, confirmed after `CHIME_SETTLE_MS` of calm; anything
 *   that starts in between is the same burst.
 * - **Only when nobody was watching.** The tab must be hidden when the work
 *   ends AND still hidden when the burst is confirmed. A user who came back
 *   during the wait has already seen the result; a chime then is noise. This is
 *   also why a cancelled run plays nothing without being told about the
 *   cancel: "Stop" is a click, and a click means the tab was visible.
 * - **"failed" means an error the user must read.** An error that APPEARED
 *   during the burst, not one already on screen when it began: an automatic
 *   repair does not clear the banner, and a stale message from an earlier run
 *   would turn every later success into a failure sound.
 * - **Not every failure reaches the banner.** An automatic repair that gives
 *   up leaves a broken preview, or silently reverts the change with a notice;
 *   a film render fails inside its own panel. Neither sets the error string, so
 *   a burst ending that way chimed "done" over a red overlay. Those paths bump
 *   a counter instead (`failures`), and a change of it during the burst is a
 *   failure exactly like a new banner message — including during the settle
 *   wait, which is where a repair's give-up lands.
 */

export type ChimeKind = 'done' | 'failed'

/**
 * How long the work must stay idle before the burst counts as finished.
 *
 * It has to outlast the gap between a generation's last write and the repair it
 * triggers: the preview must mount, load its runtime and compile before it can
 * report anything. Two and a half seconds covers that on an ordinary machine,
 * and costs nothing where it matters — the person it is for is in another tab.
 */
export const CHIME_SETTLE_MS = 2500

export interface WorkWatcherDeps {
  isHidden: () => boolean
  /** Called once per confirmed burst, and only when the tab stayed hidden. */
  onFinish: (kind: ChimeKind) => void
  /**
   * Called when a burst begins. The sound is primed here as a fallback: the
   * work's first state change happens inside the click that started it.
   */
  onStart?: () => void
  /** A burst ended and nothing will play — the moment to let the audio device go. */
  onIdle?: () => void
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (handle: unknown) => void
  settleMs?: number
}

export interface WorkWatcher {
  /**
   * Feed the current state, on every change. Repeated values are harmless.
   * `failures` is a counter bumped by failures that never reach the banner;
   * only its CHANGES mean anything, so its starting value does not matter.
   */
  observe(active: boolean, error: string | null, failures?: number): void
  /** The user looked at the tab: whatever was pending has been seen. */
  noteVisible(): void
  /** Stop any pending decision (unmount). The watcher stays usable. */
  dispose(): void
  /** Work is running, or has ended and its outcome is not decided yet. */
  busy(): boolean
}

export function createWorkWatcher(deps: WorkWatcherDeps): WorkWatcher {
  const settleMs = deps.settleMs ?? CHIME_SETTLE_MS
  let inBurst = false
  let failed = false
  let wasActive = false
  let lastError: string | null = null
  let lastFailures: number | null = null
  let hiddenAtEnd = false
  let timer: unknown = null

  function stopTimer() {
    if (timer !== null) deps.clearTimer(timer)
    timer = null
  }

  function confirm() {
    timer = null
    inBurst = false
    const kind: ChimeKind = failed ? 'failed' : 'done'
    failed = false
    if (hiddenAtEnd && deps.isHidden()) deps.onFinish(kind)
    else deps.onIdle?.()
  }

  return {
    observe(active, error, failures = 0) {
      // Compared with the previous value, not with null: see "failed" above.
      const appeared =
        (error !== null && error !== lastError) || (lastFailures !== null && failures !== lastFailures)
      lastError = error
      lastFailures = failures
      if (active) {
        stopTimer()
        if (!inBurst) {
          inBurst = true
          failed = false
          deps.onStart?.()
        }
      }
      if (inBurst && appeared) failed = true
      if (!active && wasActive && inBurst) {
        hiddenAtEnd = deps.isHidden()
        stopTimer()
        timer = deps.setTimer(confirm, settleMs)
      }
      wasActive = active
    },
    noteVisible() {
      hiddenAtEnd = false
    },
    dispose() {
      stopTimer()
      inBurst = false
      failed = false
      wasActive = false
    },
    busy() {
      return inBurst
    },
  }
}

/**
 * The tab's title while it waits to be looked at.
 *
 * A chime says SOMETHING finished; with several tabs open, the mark says which.
 * Both functions strip before they add, so a second burst never stacks marks,
 * and removal touches only our own prefix: nothing in Mocky sets the title
 * today, but whatever does later keeps its words.
 */
export const TITLE_MARKS: Record<ChimeKind, string> = { done: '✓ ', failed: '⚠ ' }

export function unmarkTitle(title: string): string {
  for (const mark of Object.values(TITLE_MARKS)) {
    if (title.startsWith(mark)) return title.slice(mark.length)
  }
  return title
}

export function markTitle(title: string, kind: ChimeKind): string {
  return TITLE_MARKS[kind] + unmarkTitle(title)
}
