import { describe as suite, it, expect } from 'vitest'
import { BLOCKER_KEYS, COMPOSE_BLOCKER_KEYS, FILL_MODE_KEYS, describe } from './VideoExportDialog'
import { VideoExportError } from '../lib/video/client'
import { translate } from '../i18n'

/**
 * Rendering the panel needs a DOM this repository does not have, so what is
 * pinned here is everything the panel decides *before* it draws: which words a
 * refusal gets, and whether those words exist at all.
 *
 * The list is much shorter than it was, and the reason is the panel itself. Six
 * composition cards, a camera move, a transition, a band position and a title
 * animation were all enum-to-label maps whose keys no repo-wide scan could see;
 * none of those controls exists any more, because none of those decisions is a
 * person's. What is left of that blind spot is three maps, and they are checked
 * the same way.
 */

suite('describe', () => {
  /**
   * The four refusals, and the reason they are not one.
   *
   * Every one of them arrives as `{ error: "…" }` over HTTP, and every one sends
   * the person somewhere different: shorten the film, call the administrator,
   * re-pick the pictures, wait. Collapsed into "l’export a échoué" they are a
   * dead end with a red border.
   */
  it.each([
    ['quota', 'video.errQuota'],
    ['missing-images', 'video.errMissing'],
    ['pending-images', 'video.errPending'],
    ['no-provider', 'video.errNoProvider'],
    ['no-access', 'video.errNoAccess'],
    ['offline', 'video.errOffline'],
    ['invalid', 'video.errInvalid'],
  ])('gives %s its own heading', (code, key) => {
    expect(describe(new VideoExportError(code as never, 'server said so')).titleKey).toBe(key)
  })

  it('carries the ids of the images that went missing', () => {
    const f = describe(new VideoExportError('missing-images', 'gone', { missingImageIds: ['a'.repeat(64)] }))
    expect(f.missing).toHaveLength(1)
  })

  /**
   * Kept in its own field rather than folded into `missing`, because the two
   * mean opposite things to the person reading the banner: one picture has left
   * the library and has to be replaced, the other is still there and has to be
   * confirmed. The heading differs for the same reason.
   */
  it('keeps the unconfirmed ids apart from the vanished ones', () => {
    const f = describe(new VideoExportError('pending-images', 'awaiting', { pendingImageIds: ['b'.repeat(64)] }))
    expect(f.pending).toEqual(['b'.repeat(64)])
    expect(f.missing).toBeUndefined()
  })

  it('keeps the server’s own sentence rather than paraphrasing it', () => {
    // It is the only place the real reason exists — the actual volume, the
    // actual host — and it was written for a person to read.
    expect(describe(new VideoExportError('quota', 'data/ is at 4.0 GB of 4.0 GB')).detail).toBe(
      'data/ is at 4.0 GB of 4.0 GB',
    )
  })

  it('spells out a refused timeline field by field', () => {
    const f = describe(
      new VideoExportError('invalid', 'refused', {
        issues: [
          { path: 'scenes.0.durationMs', message: 'too big' },
          { path: 'scenes', message: 'too long' },
        ],
      }),
    )
    expect(f.detail).toBe('scenes.0.durationMs: too big · scenes: too long')
  })

  it('does not choke on something that is not a VideoExportError', () => {
    // The picker hands plain Errors up, and a panel that threw while rendering
    // an error banner would replace a bad export with a blank dialog.
    expect(describe(new Error('boom'))).toEqual({ titleKey: 'common.error', detail: 'boom' })
    expect(describe('boom').detail).toBe('boom')
  })

  it('returns keys, never sentences', () => {
    // Translating at the point of failure froze the banner in whichever language
    // was current when the render broke, and dragged `t` into the polling
    // effect's dependencies — where a language switch restarted the poll and
    // reset the give-up deadline with it.
    const f = describe(new VideoExportError('quota', 'x'))
    expect(f.titleKey.startsWith('video.')).toBe(true)
    expect(f).not.toHaveProperty('title')
  })
})

/**
 * The maps whose keys no repo-wide check can see, because the component calls
 * `t(BLOCKER_KEYS[blocker])` — the literal never appears next to a `t(`.
 *
 * Both halves matter and they fail differently. A missing entry gives an
 * `undefined` key and a blank line where the reason should be; a present entry
 * naming a key nobody wrote prints `video.blockedNoProposal` under the button,
 * which is at least a legible bug report but only for whoever reaches that
 * state.
 */
suite('the keys held in maps', () => {
  it('names a reason for every way the compose button can be off', () => {
    expect(Object.keys(COMPOSE_BLOCKER_KEYS)).toEqual(['no-brief'])
  })

  it('names a reason for every way the render button can be off', () => {
    // One, and it is the shape of the whole panel: there is no timeline until a
    // model has written one. The nine other blockers this map used to carry were
    // a form catching a document it had built badly, and there is no form.
    expect(Object.keys(BLOCKER_KEYS)).toEqual(['no-proposal'])
  })

  it('offers the two places a picture can come from, and only those', () => {
    // Not two kinds of film. The switch used to choose between two ways of
    // FILLING A TIMELINE, beside a grid of composition cards; what it separates
    // now is a picture that already exists from one being generated.
    expect(Object.keys(FILL_MODE_KEYS).sort()).toEqual(['generate', 'library'])
  })

  it.each(['fr', 'en'] as const)('resolves every one of them in %s', (lang) => {
    const keys = [
      ...Object.values(BLOCKER_KEYS),
      ...Object.values(COMPOSE_BLOCKER_KEYS),
      ...Object.values(FILL_MODE_KEYS),
    ]
    // `translate` hands back the key itself when it is missing, which is what
    // makes this checkable at all.
    expect(keys.filter((k) => translate(lang, k as never) === k)).toEqual([])
  })
})
