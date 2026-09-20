// The media ATTACHED to a screen — not the images inside its code.
//
// Named against its neighbour on purpose. `screenImages.ts` finds
// `/api/images/HASH` in `Screen.code` and rewrites it at offsets an AST vouched
// for: that is generated SOURCE being edited. Nothing here touches code. An
// attachment is a hash on the record, drawn on a card beside the frame, and the
// whole reason it is a separate module is that the two operations answer to
// different words — "replace" means something different in each, and a dialog
// that offered them in one list would be unreadable.

import type { AttachedMedia } from './project'
import { videoStreamUrl, type VideoExport } from './video/client'
import { videoPosterUrl, type LibraryVideo } from './videoLibrary'

/** Build an attachment for a film out of the Motion export store. */
export function filmMedia(hash: string): AttachedMedia {
  return { kind: 'film', hash }
}

/** Build an attachment for a scroll sequence. Frames travel with it — see AttachedMedia. */
export function sequenceMedia(hash: string, frames: number): AttachedMedia {
  return { kind: 'sequence', hash, frames }
}

/**
 * Are these the same attachment?
 *
 * Compared on kind AND hash, never on hash alone. The two stores are addressed
 * by the SHA-256 of different things — a rendered mp4, an uploaded clip — so a
 * collision is not the worry; what is, is a caller holding `{sequence, h}`
 * matching a card drawn for `{film, h}` and marking the wrong one as current.
 */
export function sameMedia(a: AttachedMedia | undefined | null, b: AttachedMedia | undefined | null): boolean {
  if (!a || !b) return false
  return a.kind === b.kind && a.hash === b.hash
}

/**
 * What a card knows about an attachment, given what the libraries currently hold.
 *
 * `present: false` is the case this function exists for. A media deleted from
 * the library leaves the hash on the screen — only an explicit detach clears it
 * (M8) — so every reader has to be able to draw something for an attachment
 * whose entry is gone. Returning the media back unchanged, with a flag, is what
 * keeps that from being an exception each caller invents for itself: the label
 * and the URL below never depend on the entry being found.
 */
export interface AttachedMediaView {
  media: AttachedMedia
  /** The export-store entry, when the store still has it. */
  film?: VideoExport
  /** The clip-library entry, when the library still has it. */
  sequence?: LibraryVideo
  present: boolean
}

export function viewAttached(
  media: AttachedMedia | undefined | null,
  films: VideoExport[],
  sequences: LibraryVideo[],
): AttachedMediaView | null {
  if (!media) return null
  if (media.kind === 'film') {
    const film = films.find((f) => f.hash === media.hash)
    return { media, film, present: Boolean(film) }
  }
  const sequence = sequences.find((v) => v.hash === media.hash)
  return { media, sequence, present: Boolean(sequence) }
}

/**
 * Where the card gets its picture.
 *
 * A sequence has a real poster — ffmpeg cut it at ingest — so it is an `<img>`.
 * A film has none and cannot get one here: cutting a still means ffmpeg, which
 * is the one dependency the export path deliberately does not have. So the card
 * points a `<video preload="metadata">` at the file and lets the browser draw
 * the first frame, which costs the server no bytes beyond the ones a play would
 * have fetched anyway.
 *
 * `version` is the sequence's `recutAt`, and `videoPosterUrl` says why it is
 * "not optional in spirit": poster bytes are served `immutable, max-age=1y`,
 * which is correct for a content-addressed URL and becomes a lie the moment a
 * clip is re-cut — the hash is taken from the SOURCE, so the poster keeps its
 * name while its content changes underneath. Omitted, this drew last year's
 * still. It went out omitted here while the picker grid three inches below in
 * the same dialog passed it, so one clip showed two different pictures at once.
 *
 * Optional because it is not always knowable: the canvas card holds an
 * attachment and no library entry, so it asks for the poster it can name. A
 * stale thumbnail there is a worse answer than a fresh one and a better answer
 * than fetching the whole clip library to draw a 320 px card.
 */
export function mediaPoster(media: AttachedMedia, version?: number): { img?: string; video?: string } {
  return media.kind === 'sequence'
    ? { img: videoPosterUrl(media.hash, version) }
    : { video: videoStreamUrl(media.hash) }
}

/**
 * `m:ss`, from milliseconds.
 *
 * Locale-free on purpose: a colon reads as a running time in both languages,
 * where "9 s" and "1 min 12 s" would need two rules and a plural. It lives here
 * rather than in each component that prints a film's length — the Media tab and
 * the attach picker both do — because two roundings of one measurement is how a
 * 90-second film reads as 1:30 in one list and 2:00 in the other.
 */
export function runningTime(ms: number): string {
  const total = Math.max(0, Math.round((Number(ms) || 0) / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
