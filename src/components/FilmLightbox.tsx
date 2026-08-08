import { useEffect, useState } from 'react'
import { videoDownloadUrl, videoStreamUrl } from '../lib/video/client'
import { Banner, Icon, IconButton } from '../ui'
import { useT } from '../i18n'

/**
 * Play one exported film, full size.
 *
 * Deliberately NOT `VideoPlayer`. That component scrubs `/f/1.jpg … /f/N.jpg`
 * out of a scroll sequence; a film has no numbered stills, so handing it one
 * produces a player asking the server for frames that were never cut, one 404
 * per position of the scrubber. A film is an mp4, and an mp4 is played by a
 * `<video>` pointed at `/api/video/:hash`.
 *
 * Its own component rather than the block it used to be inside Bibliothèque,
 * because the canvas now opens a film too — the attached-media card does for a
 * film what the image card does for an image. Two copies of a `<video>` tag is
 * exactly the kind of duplication that ends with one of them keeping
 * `?download=1` in its `src` and quietly saving the file instead of playing it.
 *
 * A FILM THAT WILL NOT LOAD SAYS SO. The Media tab only ever opens films the
 * listing just named, so this was written as if the file were always there — but
 * the canvas card opens whatever hash the screen carries, and that hash outlives
 * the file: a deleted export answers 403, because `GET /api/video/:hash` checks
 * ownership before existence deliberately, and an entry with no owners left is
 * nobody's. Unhandled, the answer to a click was a black rectangle with a
 * transport bar and not one word, which is also what a film opening on black
 * looks like.
 */
export default function FilmLightbox({ hash, onClose }: { hash: string; onClose: () => void }) {
  const t = useT()
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // The player is keyed on the hash rather than remounted, so the failure of one
  // film would otherwise still be on screen over the next one.
  useEffect(() => setGone(false), [hash])

  return (
    <div className="fixed inset-0 z-top flex items-center justify-center bg-ink/80 p-4" onClick={onClose}>
      <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-end gap-2">
          {/* No download link once the stream has failed: the two URLs differ by
              a query string and hit the same route, so the button could only
              offer to save a file the server has just refused. */}
          {!gone && (
            <a href={videoDownloadUrl(hash)} className="btn-ghost px-3 py-1 text-body-sm">
              {t('library.download')}
            </a>
          )}
          <IconButton label={t('common.close')} variant="quiet" onClick={onClose}>
            <Icon name="close" />
          </IconButton>
        </div>
        {gone ? (
          <Banner tone="warn" title={t('library.filmGone')}>
            {t('library.filmGoneHint')}
          </Banner>
        ) : (
          /* `controls` and nothing else: no autoplay, because a film opened by
             mistake should not start making noise, and no custom transport — the
             browser's own is better than anything worth writing here. */
          <video
            key={hash}
            src={videoStreamUrl(hash)}
            controls
            onError={() => setGone(true)}
            className="max-h-[80vh] w-full bg-ink"
          />
        )}
      </div>
    </div>
  )
}
