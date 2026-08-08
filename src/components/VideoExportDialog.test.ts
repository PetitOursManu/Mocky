import { describe as suite, it, expect } from 'vitest'
import {
  BLOCKER_KEYS,
  COMPOSE_BLOCKER_KEYS,
  MOTION_KEYS,
  OVERLAY_KEYS,
  TRANSITION_KEYS,
  composeBlocker,
  describe,
} from './VideoExportDialog'
import { VideoExportError } from '../lib/video/client'
import { KEN_BURNS, OVERLAY_POSITIONS, TRANSITIONS } from '../lib/video/timeline'
import { translate } from '../i18n'

/**
 * Rendering the panel needs a DOM this repository does not have, so what is
 * pinned here is everything the panel decides *before* it draws: which words a
 * refusal gets, and whether those words exist at all.
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

suite('composeBlocker', () => {
  it('asks for the pictures before it asks for the sentence', () => {
    // Both are missing when the panel opens. Naming the brief first sends
    // somebody off to write one and then refuses them anyway, because a montage
    // is proposed from a selection and there is nothing to propose it on.
    expect(composeBlocker(0, '')).toBe('no-images')
    expect(composeBlocker(0, 'a calm slideshow')).toBe('no-images')
  })

  it('treats a box full of spaces as an empty one', () => {
    // It reaches the server as an empty brief and comes back a 400, having spent
    // a request to say what the disabled button could have said for free.
    expect(composeBlocker(2, '   \n ')).toBe('no-brief')
  })

  it('clears once there is something to work from', () => {
    expect(composeBlocker(1, 'a calm slideshow')).toBeNull()
  })
})

/**
 * The four enum-to-label maps: complete, and every label a real string.
 *
 * These are the keys no repo-wide check can see, because the component calls
 * `t(MOTION_KEYS[scene.kenBurns])` — the literal never appears next to a `t(`.
 * Both halves matter and they fail differently. A missing entry gives an
 * `undefined` key and a blank `<option>`; a present entry naming a key nobody
 * wrote gives an option reading `video.motionPanLeft`, which is at least a
 * legible bug report but only for whoever opens that particular select.
 *
 * The lists come from the schema, so adding a transition there and forgetting
 * the label here fails at once rather than at the bottom of a dropdown.
 */
suite('the enum labels', () => {
  const cases: [string, readonly string[], Record<string, string>][] = [
    ['kenBurns', KEN_BURNS, MOTION_KEYS],
    ['transitions', TRANSITIONS, TRANSITION_KEYS],
    ['overlay positions', OVERLAY_POSITIONS, OVERLAY_KEYS],
  ]

  it.each(cases)('covers every %s value the schema allows', (_name, values, map) => {
    expect(Object.keys(map).sort()).toEqual([...values].sort())
  })

  it.each(['fr', 'en'] as const)('resolves every label in %s', (lang) => {
    const keys = [
      ...Object.values(MOTION_KEYS),
      ...Object.values(TRANSITION_KEYS),
      ...Object.values(OVERLAY_KEYS),
      ...Object.values(BLOCKER_KEYS),
      ...Object.values(COMPOSE_BLOCKER_KEYS),
    ]
    // `translate` hands back the key itself when it is missing, which is what
    // makes this checkable at all.
    expect(keys.filter((k) => translate(lang, k) === k)).toEqual([])
  })
})
