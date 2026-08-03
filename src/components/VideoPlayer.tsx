import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { videoFrameUrl, videoPosterUrl, type LibraryVideo } from '../lib/videoLibrary'
import {
  FIRST_FRAME,
  durationMs,
  elapsedForFrame,
  fetchOrder,
  frameAt,
  readyToPlay,
  timecode,
} from '../lib/videoPlayback'
import { Button, Icon, IconButton, Modal, Spinner } from '../ui'
import { useT } from '../i18n'

/**
 * Plays one of Mocky's clips.
 *
 * There is no `<video>` here and there cannot be. A clip is stored as numbered
 * JPEGs (`server/videos/frames.js`), and `PUBLIC_VIDEO_PATH` exposes only
 * `poster.jpg` and `f/N.jpg` — the `.mp4` is deliberately unreachable over HTTP,
 * with a test holding it that way, because these URLs are unauthenticated so
 * that an opaque-origin preview iframe can still show a sequence. Playing means
 * fetching frames and drawing them.
 *
 * Drawn into a `<canvas>` rather than swapping an `<img>`'s src. Assigning a new
 * src makes the browser decode on the way to the screen, so a frame that is not
 * yet decoded paints late — the picture flickers to blank between frames, worst
 * on the largest clips, which are exactly the ones worth watching. Every frame
 * is decoded up front and the canvas only ever blits something already in
 * memory.
 */
export default function VideoPlayer({ video, onClose }: { video: LibraryVideo; onClose: () => void }) {
  const t = useT()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  /** Decoded frames by 1-based index. A plain object: the keys are dense. */
  const framesRef = useRef<Record<number, HTMLImageElement>>({})
  const [loaded, setLoaded] = useState(0)
  const [failed, setFailed] = useState(false)

  const [playing, setPlaying] = useState(true)
  const [frame, setFrame] = useState(FIRST_FRAME)
  /** Wall-clock origin of the current run, minus wherever we resumed from. */
  const originRef = useRef(0)
  const rafRef = useRef(0)

  const total = video.frames
  const fps = video.fps > 0 ? video.fps : 12
  const length = useMemo(() => durationMs(total, fps), [total, fps])
  const canPlay = readyToPlay(loaded, total, fps)

  // ---- fetch every frame, in the order they will be needed ----
  useEffect(() => {
    let alive = true
    framesRef.current = {}
    setLoaded(0)
    setFailed(false)

    const order = fetchOrder(total, FIRST_FRAME)
    let cursor = 0
    let inFlight = 0
    // Six at a time: roughly what a browser opens per host anyway, and enough
    // that the queue stays ahead of playback without the network deciding the
    // order for us.
    const LANES = 6

    const pump = () => {
      while (alive && inFlight < LANES && cursor < order.length) {
        const index = order[cursor++]
        inFlight++
        const img = new Image()
        img.decoding = 'async'
        img.onload = () => {
          if (!alive) return
          framesRef.current[index] = img
          setLoaded((n) => n + 1)
          inFlight--
          pump()
        }
        img.onerror = () => {
          if (!alive) return
          // One missing frame is a hole, not a failure — the sequence still
          // plays. Every frame missing is a failure, and `loaded` staying at 0
          // is what surfaces it.
          inFlight--
          setFailed((was) => was || Object.keys(framesRef.current).length === 0)
          pump()
        }
        img.src = videoFrameUrl(video.hash, index)
      }
    }
    pump()

    return () => {
      alive = false
    }
  }, [video.hash, total])

  // ---- paint ----
  const paint = useCallback(
    (index: number) => {
      const canvas = canvasRef.current
      const img = framesRef.current[index]
      if (!canvas || !img) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
      }
      ctx.drawImage(img, 0, 0)
    },
    [],
  )

  useEffect(() => {
    paint(frame)
  }, [frame, paint, loaded])

  // ---- the clock ----
  //
  // rAF and not setInterval: an interval fires on a best-effort schedule and its
  // error accumulates, so a clip played in a busy tab finishes visibly late. The
  // frame is computed from elapsed time (see frameAt), so a dropped tick costs a
  // repeated paint rather than a permanent lag.
  useEffect(() => {
    if (!playing || !canPlay) return
    originRef.current = performance.now() - elapsedForFrame(frame, fps)
    const tick = () => {
      const next = frameAt(performance.now() - originRef.current, fps, total, true)
      setFrame((prev) => (prev === next ? prev : next))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // `frame` is deliberately absent: it is the output of this loop, and reading
    // it here would restart the clock on every single frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, canPlay, fps, total])

  // A hidden tab does not fire rAF, so playback would silently stall and then
  // jump forward. Stopping is honest, and it stops the fetch queue mattering.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') setPlaying(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const scrub = (to: number) => {
    setPlaying(false)
    setFrame(Math.min(total, Math.max(FIRST_FRAME, to)))
  }

  const progress = total > 0 ? ((frame - FIRST_FRAME) / Math.max(1, total - 1)) * 100 : 0

  return (
    <Modal title={t('library.playTitle')} onClose={onClose} size="lg">
      <div className="relative flex items-center justify-center overflow-hidden border border-line bg-sunken">
        {/* The poster holds the frame's shape while the sequence downloads, so
            the dialog does not resize under the user when playback starts. */}
        <img
          src={videoPosterUrl(video.hash)}
          alt=""
          aria-hidden
          className={`w-full ${loaded > 0 ? 'invisible absolute' : 'block'}`}
        />
        <canvas
          ref={canvasRef}
          className={`w-full ${loaded > 0 ? 'block' : 'hidden'}`}
          aria-label={t('library.playOf', { prompt: video.prompt || t('library.untitledClip') })}
        />
        {!canPlay && !failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-sunken/70">
            <Spinner />
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-sunken/90 px-6 text-center">
            <p className="text-body-sm text-ink-muted">{t('library.playFailed')}</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <IconButton
          label={playing ? t('library.pause') : t('library.play')}
          variant="quiet"
          disabled={!canPlay}
          onClick={() => setPlaying((p) => !p)}
        >
          <Icon name={playing ? 'pause' : 'play'} size={18} />
        </IconButton>

        <input
          type="range"
          min={FIRST_FRAME}
          max={Math.max(FIRST_FRAME, total)}
          value={frame}
          onChange={(e) => scrub(Number(e.target.value))}
          aria-label={t('library.scrub')}
          className="h-1 flex-1 cursor-pointer appearance-none bg-line accent-accent"
          style={{
            background: `linear-gradient(to right, rgb(var(--accent)) ${progress}%, rgb(var(--line)) ${progress}%)`,
          }}
        />

        {/* Both, because neither alone is enough: a timecode is what a person
            reads, a frame number is what they are actually scrubbing through. */}
        <span className="shrink-0 font-mono text-caption tabular-nums text-ink-faint">
          {timecode(elapsedForFrame(frame, fps))} / {timecode(length)}
          {' · '}
          {frame}/{total}
        </span>
      </div>

      {loaded < total && !failed && (
        <p className="mt-2 font-mono text-caption text-ink-faint">
          {t('library.buffering', { loaded, total })}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-soft pt-3 font-mono text-caption text-ink-faint">
        <span>
          {video.width}px · {fps} fps · {t('library.frames', { count: total })}
        </span>
        <span>{video.provider || 'upload'}</span>
        <a
          href={videoPosterUrl(video.hash)}
          download={`${video.hash.slice(0, 12)}-poster.jpg`}
          className="ml-auto transition hover:text-accent-ink"
        >
          {t('library.downloadPoster')}
        </a>
      </div>

      {video.prompt && <p className="measure mt-3 text-body-sm text-ink-muted">{video.prompt}</p>}

      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </Modal>
  )
}
