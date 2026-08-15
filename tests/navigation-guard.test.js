import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const app = read('src/App.tsx')
const projectView = read('src/components/ProjectView.tsx')

/**
 * Locks the one property that keeps work from being thrown away in silence.
 *
 * A Motion film is minutes of work started inside ProjectView and abandonable
 * from anywhere else: the masthead logo, five header tabs, the folded mobile
 * menu, the project's own Back button. Guarding one of them left the other
 * eight discarding it with no dialog — the report was "je ne vois pas de popup"
 * twice, for two different exits.
 *
 * Read from the source rather than exercised, for the same reason
 * `preview-sandbox.test.js` reads its files: the thing being asserted is that
 * NO call site was missed, and a test that renders one component can only ever
 * prove something about the site it clicked.
 */
describe('every exit asks before discarding work', () => {
  /**
   * The two `setRoute` calls that may stay bare, named rather than counted.
   *
   * Both ENTER a project: `openProject` and the masthead's own title button.
   * Entering cannot lose a film — nothing is in flight before you arrive — and
   * a dialog that fires when nothing is at stake is how people learn to click
   * through dialogs. A third bare one is a navigation somebody forgot.
   */
  const ENTERING = ["setRoute('project')"]

  it('routes every LEAVING navigation through the guard', () => {
    const bare = app
      .split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => line.includes('setRoute('))
      // The guard's own implementation is the one place setRoute is called for
      // real; everything else must go through it.
      .filter(({ line }) => !line.includes('setRoute(next)'))
      .filter(({ line }) => !ENTERING.some((ok) => line.includes(ok)))

    expect(bare.map((b) => `${b.n}: ${b.line}`)).toEqual([])
  })

  it('asks with the reason the work itself supplied', () => {
    // Not a hard-coded sentence: the key comes from whoever took the hold, so
    // one guard can cover a second kind of long job without being edited.
    expect(app).toMatch(/const held = navigationHold\(\)/)
    expect(app).toMatch(/window\.confirm\(t\(held as TranslationKey\)\)/)
  })

  it('does not ask when the destination is the page already open', () => {
    // Clicking the tab you are on loses nothing, and asking there would train
    // the reader to dismiss the dialog that matters.
    expect(app).toMatch(/if \(next !== route\) \{/)
  })
})

describe('the hold is always released', () => {
  it('is dropped when the project view goes away', () => {
    // A hold left behind asks the user to confirm leaving a page where nothing
    // is happening, for as long as the tab stays open — which is worse than the
    // loss it was meant to prevent, because it teaches them to ignore it.
    expect(projectView).toMatch(/releaseNavigation\(\)\s*\n\s*\}\s*\n\s*\}, \[\]\)/)
  })

  it('is dropped on success, failure and abort alike', () => {
    // `motionStageDone` is the single exit of the Motion path and runs from
    // three finallys. If the release moves out of it, this fails.
    expect(projectView).toMatch(/function motionStageDone\(\)[\s\S]{0,400}?releaseNavigation\(\)/)
    expect((projectView.match(/motionStageDone\(\)/g) || []).length).toBeGreaterThanOrEqual(3)
  })

  it('is taken only where the work actually starts', () => {
    // One claimant. Two would race, and the loser would release a hold the
    // winner still needed.
    expect((projectView.match(/holdNavigation\(/g) || []).length).toBe(1)
  })
})
