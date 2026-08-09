import { describe as suite, it, expect } from 'vitest'
import {
  ANIMATION_KEYS,
  BAND_KEYS,
  BLOCKER_KEYS,
  COMPOSE_BLOCKER_KEYS,
  FILL_MODE_KEYS,
  MOTION_KEYS,
  OVERLAY_KEYS,
  TEMPLATE_CHOICES,
  TEMPLATE_NAME_KEYS,
  TEMPLATE_NEEDS_KEYS,
  TEMPLATE_WHAT_KEYS,
  TRANSITION_KEYS,
  composeBlocker,
  describe,
} from './VideoExportDialog'
import { VideoExportError } from '../lib/video/client'
import { addTextScene, emptyDraft, setTemplate, updateScene } from '../lib/video/draft'
import {
  BAND_POSITIONS,
  KEN_BURNS,
  OVERLAY_POSITIONS,
  TITLE_ANIMATIONS,
  TRANSITIONS,
  VIDEO_TEMPLATES,
} from '../lib/video/timeline'
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

suite('composeBlocker', () => {
  it('asks for the pictures before it asks for the sentence', () => {
    // Both are missing when the panel opens. Naming the brief first sends
    // somebody off to write one and then refuses them anyway, because a montage
    // is proposed from a selection and there is nothing to propose it on.
    expect(composeBlocker(0, '', 'slideshow')).toBe('no-images')
    expect(composeBlocker(0, 'a calm slideshow', 'slideshow')).toBe('no-images')
  })

  it('treats a box full of spaces as an empty one', () => {
    // It reaches the server as an empty brief and comes back a 400, having spent
    // a request to say what the disabled button could have said for free.
    expect(composeBlocker(2, '   \n ', 'slideshow')).toBe('no-brief')
  })

  it('clears once there is something to work from', () => {
    expect(composeBlocker(1, 'a calm slideshow', 'slideshow')).toBeNull()
  })

  /**
   * The picture gate follows the composition, which is what the third argument
   * bought. It used to be unconditional, and the cost was the one composition
   * written for a brief of words: `titles` puts no picture on the screen, so
   * demanding a selection first made it unreachable through the panel that
   * composes.
   */
  it('lets a text-only composition be proposed with nothing selected', () => {
    expect(composeBlocker(0, 'an opening card', 'titles')).toBeNull()
  })

  it('lets automatic be proposed with nothing selected, because the server offers titles', () => {
    // `compose.js` builds the catalogue from the selection: with none, it holds
    // `titles` alone. Closing the button here would refuse a request the server
    // is able to answer.
    expect(composeBlocker(0, 'an opening card', 'auto')).toBeNull()
  })

  it('still asks for pictures for every composition that puts one on screen', () => {
    for (const template of VIDEO_TEMPLATES) {
      if (template === 'titles') continue
      expect(composeBlocker(0, 'a film', template)).toBe('no-images')
    }
  })

  /**
   * It counts pictures, and the panel hands it pictures.
   *
   * The gate used to be given `draft.scenes.length`, which is not the same
   * number: a `titles` row carries no `imageId`, and switching the selector
   * keeps every row. Three title cards moved to `product` were three scenes and
   * zero pictures — the button stayed live and spent a round trip on a request
   * `proposeTimeline` refuses before it reaches a model, because the list it
   * sends is the one filtered on truthiness.
   */
  it('counts the pictures a draft holds, not the rows it draws', () => {
    let cards = setTemplate(emptyDraft(), 'titles')
    for (let i = 0; i < 3; i++) cards = addTextScene(cards)
    for (const scene of cards.scenes) cards = updateScene(cards, scene.key, { headline: 'Une accroche' })
    const asProduct = setTemplate(cards, 'product')
    expect(asProduct.scenes).toHaveLength(3)
    const pictures = asProduct.scenes.filter((s) => s.imageId).length
    expect(pictures).toBe(0)
    expect(composeBlocker(pictures, 'a launch film', 'product')).toBe('no-images')
    expect(composeBlocker(asProduct.scenes.length, 'a launch film', 'product')).toBeNull()
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
    ['band positions', BAND_POSITIONS, BAND_KEYS],
    ['title animations', TITLE_ANIMATIONS, ANIMATION_KEYS],
    // Three maps over the same set, because a card carries three sentences and
    // a composition missing one of them is a card with a blank line where the
    // reason to pick it should be.
    ['composition names', TEMPLATE_CHOICES, TEMPLATE_NAME_KEYS],
    ['composition descriptions', TEMPLATE_CHOICES, TEMPLATE_WHAT_KEYS],
    ['composition requirements', TEMPLATE_CHOICES, TEMPLATE_NEEDS_KEYS],
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
      // The two positions of the switch. Same blind spot as the others — the
      // component calls `t(FILL_MODE_KEYS.compose)`, so no repo-wide scan for
      // `t('…')` literals would ever see these — and an unresolved one here is
      // a segmented control with two blank buttons on it.
      ...Object.values(FILL_MODE_KEYS),
      ...Object.values(BAND_KEYS),
      ...Object.values(ANIMATION_KEYS),
      ...Object.values(TEMPLATE_NAME_KEYS),
      ...Object.values(TEMPLATE_WHAT_KEYS),
      ...Object.values(TEMPLATE_NEEDS_KEYS),
    ]
    // `translate` hands back the key itself when it is missing, which is what
    // makes this checkable at all.
    expect(keys.filter((k) => translate(lang, k) === k)).toEqual([])
  })
})

/**
 * The catalogue on the panel, against the catalogue in the schema.
 *
 * A composition that exists in `VIDEO_TEMPLATES` and not on this list is one a
 * proposal can come back as and nobody can choose — and, worse, one whose card
 * the user never sees while the form is quietly editing it.
 */
suite('the composition list', () => {
  it('offers every composition the schema has, and automatic first', () => {
    expect(TEMPLATE_CHOICES[0]).toBe('auto')
    expect([...TEMPLATE_CHOICES].slice(1)).toEqual([...VIDEO_TEMPLATES])
  })

  it('says what each one requires, in a sentence of its own', () => {
    // The requirement is the fact that decides the choice — "animated titling"
    // does not say it uses no picture — so a card sharing another card's
    // sentence would be the one nobody can pick correctly.
    const needs = Object.values(TEMPLATE_NEEDS_KEYS)
    expect(new Set(needs).size).toBe(needs.length)
  })
})
