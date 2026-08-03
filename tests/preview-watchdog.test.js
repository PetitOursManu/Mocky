import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * The render watchdog must not be armed by a code change.
 *
 * It is armed when the message-listener effect subscribes, and disarmed only by
 * an "ok" from a freshly loaded document — which happens when `srcDoc` changes,
 * never when `code` does. The rebuild in between is debounced, skipped for blank
 * code, and bails out when the rebuilt string is byte-identical to the mounted
 * one. So a code change that yields the same document used to start a
 * twenty-second clock for an "ok" that had nowhere to come from, and the screen
 * — correct, and already on screen — accused itself of a render timeout.
 *
 * A text assertion rather than a render test because this repo has no DOM
 * harness: no jsdom, no testing-library. It lives in tests/ and not beside the
 * component because src/ is typed for the browser — reading a file there needs
 * node types tsc does not give it. tests/preview-sandbox.test.js scans source
 * the same way, for the same reason.
 */
const SRC = fs.readFileSync(path.join(process.cwd(), 'src/components/Preview.tsx'), 'utf8')

describe('the render watchdog', () => {
  it('subscribes on the document, not on the code', () => {
    // The effect that arms the 20 s timer, identified by the timer itself.
    const armed = SRC.indexOf('}, 20000)')
    expect(armed).toBeGreaterThan(0)
    const deps = SRC.slice(armed).match(/\n\s*\}, \[([^\]]*)\]\)/)
    expect(deps).not.toBeNull()
    const list = (deps)[1].split(',').map((s) => s.trim()).filter(Boolean)
    expect(list).toContain('srcDoc')
    // The regression: `code` back in this list re-arms the watchdog on every
    // code change, including the ones that rebuild an identical document.
    expect(list).not.toContain('code')
  })

  it('still compares against the current code when judging a stale error', () => {
    // Dropping `code` from the deps is only safe because the handler reads it
    // through a ref. Without this the stale-error guard would compare against
    // whatever the code was when the listener subscribed.
    expect(SRC).toContain('codeRef.current = code')
    expect(SRC).toContain('srcCodeRef.current === codeRef.current')
  })

  it('keeps `generating` out of the same list, for the same reason', () => {
    // The original half of this defect, already fixed — guarded so it cannot
    // come back the next time someone tidies the dependency arrays.
    const armed = SRC.indexOf('}, 20000)')
    const deps = SRC.slice(armed).match(/\n\s*\}, \[([^\]]*)\]\)/)
    expect(deps[1]).not.toContain('generating')
  })
})
