import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * A rendered film has to be findable, and the chain that makes it findable runs
 * through four files that no unit test can see at once.
 *
 * This is the defect the feature actually shipped with, reported after real use:
 * "the video is exported and it is still nowhere — not in the project, not in
 * Media." The bytes were on the volume the whole time. The export store is
 * content-addressed, so the hash says what a file contains and nothing about who
 * wanted it, and the only link back was the job id the panel happened to be
 * holding — which the journal forgets after fifty more renders and the browser
 * forgets on reload.
 *
 * The repair is one string, `projectId`, travelling four hops:
 *
 *   ProjectView `<VideoExportDialog projectId>`
 *     → the dialog's `startVideoRender(…, { project })`
 *       → `POST /api/video/render` → `queue.enqueue({ projectId })`
 *         → the render callback in server/index.js → `store.put({ project })`
 *
 * Every hop but the last two is JSX or a composition root, which is exactly why
 * this test reads text rather than calling anything: there is no DOM in this
 * repository and `server/index.js` starts a server on import. The unit suites
 * already cover both ends — `client.test.ts` pins the body the browser sends,
 * `queue.test.js` pins the job carrying it, `store.test.js` pins the attachment,
 * `routes.test.js` pins the listing. What none of them can see is a hop that
 * simply is not wired, and that is the shape the defect had: the dialog took a
 * `projectId` prop and never passed it on, so the whole chain below it was
 * correct and dead.
 *
 * Reading files as text is the established fallback here — see
 * `tests/preview-sandbox.test.js` and `tests/video-worker-separation.test.js`.
 * A rename will fail this test; the fix is to update the expectation, having
 * checked the hop still happens.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

describe('the project id reaches the stored film', () => {
  it('is handed to the panel by the project that opened it', () => {
    const source = read('src/components/ProjectView.tsx')
    // The opening tag and its props, up to the first `>` that is not inside one.
    const tag = source.match(/<VideoExportDialog[\s\S]*?\/?>/)
    expect(tag, 'ProjectView must still mount VideoExportDialog').not.toBeNull()
    expect(tag[0], 'the panel cannot attach a film to a project it was never told about').toMatch(
      /projectId=\{/,
    )
  })

  it('is sent with the render request, beside the timeline and never inside it', () => {
    const source = read('src/components/VideoExportDialog.tsx')
    expect(source, 'startVideoRender must carry the project, or the film is filed under none').toMatch(
      /startVideoRender\([\s\S]{0,200}?project:\s*projectId/,
    )
    // Beside, not inside. The schema is `.strict()`, so a field the worker does
    // not render has no business in the document — and two projects composing
    // byte-identical timelines land on ONE file with both projects on it, which
    // a field inside the hashed document could not express. Checked on the
    // schemas themselves, both of them, because that is where "inside" is
    // decided rather than at this call site.
    expect(read('src/lib/video/timeline.ts')).not.toMatch(/project/i)
    expect(read('server/video/timeline.js')).not.toMatch(/project/i)
  })

  it('is written onto the film by the render callback', () => {
    const source = read('server/index.js')
    const put = source.match(/videoExports\.put\([\s\S]*?\n\s*\}\)/)
    expect(put, 'the render callback must still store the film').not.toBeNull()
    // `job.projectId`, because the callback is the only thing left that knows
    // it: by the time the bytes exist, the hash is all there is.
    expect(put[0], 'a film with no project is a file no listing can ask for').toMatch(/project:\s*job\.projectId/)
  })

  it('is what the Media library asks the listing for', () => {
    const source = read('src/components/Bibliotheque.tsx')
    expect(source, 'the Motion tab is the interface half of the repair').toMatch(/listVideoExports\(/)
    // A film is an mp4 with no numbered stills. VideoPlayer scrubs
    // `/f/1.jpg … /f/N.jpg`, so routing one through it asks the server for
    // frames nobody ever cut — one 404 per position of the scrubber.
    //
    // The player moved out to FilmLightbox when the canvas gained a card that
    // opens a film; the rule did not move with it, so both halves are checked.
    const filmPlayer = source.match(/const filmPlayer =[\s\S]*?\n\s*\) : null/)
    expect(filmPlayer, 'films must have their own player').not.toBeNull()
    expect(filmPlayer[0], 'a film has no frames to scrub').not.toMatch(/VideoPlayer/)
    expect(filmPlayer[0], 'the Media tab must hand a film to the film player').toMatch(/FilmLightbox/)
  })

  it('is played from the streaming URL, never from the download one', () => {
    const player = read('src/components/FilmLightbox.tsx')
    // The import, not the word: the file's own comment explains at length why
    // it is not VideoPlayer, and a bare substring test fails on the
    // explanation.
    expect(player, 'a film has no frames to scrub').not.toMatch(/from '\.\/VideoPlayer'/)
    // `?download=1` sets Content-Disposition: attachment. In a `<video src>`
    // that tells the browser to save the file instead of playing it, which is
    // the one thing a play button must not do — and the two URLs differ by
    // exactly that query string, so the mistake is invisible on review.
    expect(player).toMatch(/<video[\s\S]*?src=\{videoStreamUrl\(/)
  })
})

describe('a film that will not play says so', () => {
  /**
   * The hash outlives the file. Only an explicit deletion removes an export
   * (M8), and `GET /api/video/:hash` checks ownership BEFORE existence on
   * purpose — so a screen still pointing at a deleted film gets a 403, not a
   * 404, and neither one is visible in a `<video>` tag. Unhandled, both the
   * canvas card and the player draw a black rectangle, which is also exactly
   * what a film opening on a black frame draws. "The file is gone" and "the cut
   * starts on black" were the same picture under the same caption.
   *
   * The failure is only observable through the element's own `error` event, and
   * there is no DOM in this repository to fire one — the same reason the hops
   * above are read as text. What can be checked is that the handler is wired at
   * all, which is the half that was missing.
   */
  it('is caught on the canvas card, where the hash is all there is', () => {
    const source = read('src/components/Canvas.tsx')
    const card = source.match(/function ScreenMediaCard\([\s\S]*?\n\}/)
    expect(card, 'the attached-media card must still exist').not.toBeNull()
    expect(card[0], 'a media that 403s must not draw as a media that starts on black').toMatch(/onError=/)
    expect(card[0], 'and the caption has to change, or nothing on screen said anything').toMatch(
      /canvas\.mediaGone/,
    )
  })

  it('is caught in the player the card opens', () => {
    const player = read('src/components/FilmLightbox.tsx')
    expect(player, 'a click on a dead card must not open a silent black player').toMatch(/onError=/)
    expect(player).toMatch(/library\.filmGone/)
  })
})

describe('a finished film stays out of the scroll-sequence library', () => {
  /**
   * `server/videos/` cuts scroll sequences: `ingest` runs ffmpeg to produce up
   * to 150 stills, and everything downstream of its `list()` expects them. A
   * film has none, so filing it there would pay for the cutting and then lie to
   * the Media tab, `VideoPlayer.tsx` and `usage.js` alike.
   */
  it('is stored by the export store, never ingested as a clip', () => {
    const source = read('server/index.js')
    const callback = source.match(/const videoQueue = new VideoQueue\(\{[\s\S]*?\n\}\)/)
    expect(callback, 'the render callback must still exist').not.toBeNull()
    expect(callback[0]).toMatch(/videoExports\.put\(/)
    expect(callback[0], 'a film has no frames, so there is nothing to ingest').not.toMatch(
      /videos\.(library|ingest)|\.ingest\(/,
    )
  })
})
