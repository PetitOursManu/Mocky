import { describe, it, expect } from 'vitest'
import { normalizeScreen, type Screen } from './project'
import { filmMedia, mediaPoster, sameMedia, sequenceMedia, viewAttached } from './screenMedia'
import type { VideoExport } from './video/client'
import type { LibraryVideo } from './videoLibrary'

/**
 * A media ATTACHED to a screen — the film on the canvas card — as opposed to an
 * image inside the screen's code.
 *
 * The three defects these tests exist to keep out are all quiet ones: a field
 * that vanishes at the next reload, a detach that does not detach, and a card
 * that throws because the library lost the file it points at.
 */

const HASH = 'a'.repeat(64)
const OTHER = 'b'.repeat(64)

const screen = (over: Partial<Screen> = {}): Partial<Screen> => ({
  id: 's1',
  name: 'Écran',
  prompt: '',
  code: '',
  componentName: 'App',
  createdAt: 1,
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  device: 'none',
  links: [],
  ...over,
})

describe('the attachment survives a reload', () => {
  it('is kept by normalizeScreen', () => {
    /*
     * THE DEFECT THIS PINS. `normalizeScreen` rebuilds every screen from a fixed
     * WHITELIST — it is what `loadProjects` runs on everything it reads back —
     * so a field missing from that list is dropped in silence. It survives every
     * save of the session that added it and is gone the next morning, which is
     * a week later than anybody is still looking at the diff that caused it.
     */
    const out = normalizeScreen(screen({ attachedMedia: filmMedia(HASH) }), 0)
    expect(out.attachedMedia).toEqual({ kind: 'film', hash: HASH })
  })

  it('keeps a sequence with its frame count', () => {
    // Both or neither, for the reason Screen.videoFrames exists: a sequence
    // addressed with the wrong count draws its last frame for the whole scroll.
    const out = normalizeScreen(screen({ attachedMedia: sequenceMedia(HASH, 60) }), 0)
    expect(out.attachedMedia).toEqual({ kind: 'sequence', hash: HASH, frames: 60 })
  })

  it('drops a half-written record rather than storing it', () => {
    const dropped = [
      { kind: 'sequence', hash: HASH }, // a sequence with no frames is not a sequence
      { kind: 'sequence', hash: HASH, frames: 0 },
      { kind: 'film', hash: '' },
      { kind: 'film', hash: '   ' },
      { kind: 'clip', hash: HASH }, // a store nothing knows how to address
      { hash: HASH },
      null,
      'film',
    ]
    for (const attachedMedia of dropped) {
      expect(normalizeScreen(screen({ attachedMedia: attachedMedia as never }), 0).attachedMedia).toBeUndefined()
    }
  })

  it('keeps a hash the media library no longer holds', () => {
    // Only an explicit deletion removes a media (M8), and only an explicit
    // detach clears the field. Dropping an unknown hash here would make a
    // deleted file look like an attachment nobody ever made, and the interface
    // could never offer to detach it.
    expect(normalizeScreen(screen({ attachedMedia: filmMedia(OTHER) }), 0).attachedMedia?.hash).toBe(OTHER)
  })
})

describe('attaching and detaching', () => {
  it('replaces one attachment with another rather than keeping both', () => {
    // A screen carries at most one — the card column has one slot for it.
    const first = normalizeScreen(screen({ attachedMedia: filmMedia(HASH) }), 0)
    const second = normalizeScreen({ ...first, attachedMedia: sequenceMedia(OTHER, 40) }, 0)
    expect(second.attachedMedia).toEqual({ kind: 'sequence', hash: OTHER, frames: 40 })
  })

  it('detaches by clearing the field, and that survives a reload too', () => {
    const attached = normalizeScreen(screen({ attachedMedia: filmMedia(HASH) }), 0)
    const detached = normalizeScreen({ ...attached, attachedMedia: undefined }, 0)
    expect(detached.attachedMedia).toBeUndefined()
  })

  it('tells the two stores apart on the same hash', () => {
    // Compared on kind AND hash: the export store and the clip library are
    // addressed by the SHA-256 of different things, and a caller holding one
    // must never mark the other as the current pick.
    expect(sameMedia(filmMedia(HASH), filmMedia(HASH))).toBe(true)
    expect(sameMedia(filmMedia(HASH), sequenceMedia(HASH, 60))).toBe(false)
    expect(sameMedia(filmMedia(HASH), undefined)).toBe(false)
  })
})

describe('a media the library has lost', () => {
  const film = { hash: HASH, bytes: 1, container: 'mp4', mime: 'video/mp4', scenes: 2, durationMs: 4000, aspectRatio: '16:9', projects: [], createdAt: 1 } as VideoExport
  const sequence = { hash: HASH, frames: 60, width: 720, fps: 30, bytes: 1, prompt: '', provider: '', model: '', project: '', slot: '', createdAt: 1 } as LibraryVideo

  it('finds the entry when it is still there', () => {
    expect(viewAttached(filmMedia(HASH), [film], [])?.present).toBe(true)
    expect(viewAttached(sequenceMedia(HASH, 60), [], [sequence])?.present).toBe(true)
  })

  it('still describes an attachment whose entry is gone, instead of failing', () => {
    /*
     * Q1, on the display side. The media library is a separate store and can
     * lose a file at any time; a screen pointing at one that went away must
     * still draw — the card says the media is missing and offers to detach it,
     * which is the only thing that clears the field.
     */
    const view = viewAttached(filmMedia(OTHER), [film], [sequence])
    expect(view?.present).toBe(false)
    expect(view?.film).toBeUndefined()
    expect(view?.media.hash).toBe(OTHER)
  })

  it('never looks a film up in the sequence library, or the other way round', () => {
    // Same hash, wrong store: reading it as present would send the card at
    // `/api/videos/:hash/poster.jpg` for a file that only exists as an mp4.
    expect(viewAttached(filmMedia(HASH), [], [sequence])?.present).toBe(false)
    expect(viewAttached(sequenceMedia(HASH, 60), [film], [])?.present).toBe(false)
  })

  it('builds a poster URL from the attachment alone, never from the entry', () => {
    // What keeps the card drawable when the entry is gone: nothing about the
    // picture depends on having found one.
    expect(mediaPoster(filmMedia(OTHER))).toEqual({ video: `/api/video/${OTHER}` })
    expect(mediaPoster(sequenceMedia(OTHER, 60))).toEqual({ img: `/api/videos/${OTHER}/poster.jpg` })
  })

  it('carries the re-cut stamp into a sequence poster when the caller knows it', () => {
    /*
     * THE DEFECT THIS PINS. Poster bytes are served `immutable, max-age=1y`,
     * which is right for a content-addressed URL and wrong the moment a clip is
     * re-cut: the hash comes from the SOURCE, so the poster keeps its name while
     * its content changes underneath. The picker grid in the media dialog passed
     * `recutAt`; the "currently attached" thumbnail beside it did not, so one
     * clip drew two different pictures in one dialog and the re-cut button
     * looked like it had done nothing.
     */
    expect(mediaPoster(sequenceMedia(HASH, 60), 1234)).toEqual({
      img: `/api/videos/${HASH}/poster.jpg?v=1234`,
    })
    // A film has no poster to bust — its still is drawn by the browser out of
    // the mp4 — so the stamp must not end up on the stream URL, where the route
    // reads params only and a query string would just defeat its own cache.
    expect(mediaPoster(filmMedia(HASH), 1234)).toEqual({ video: `/api/video/${HASH}` })
  })

  it('has nothing to describe when nothing is attached', () => {
    expect(viewAttached(undefined, [film], [sequence])).toBeNull()
  })
})
