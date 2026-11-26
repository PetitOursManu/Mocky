// HyperFrames' answer to the nine names in `../clock.js`.
//
// Remotion renders a composition by asking it for frame N and screenshotting
// the answer; HyperFrames does the same thing from the other side — it SEEKS the
// page to a time, waits for the page to say it is settled, and captures. So a
// clock is all the compositions need from it: the frame number in a React
// context, the two wrappers that shift it (`Sequence`, `Freeze`), and a way for a
// loader to hold the capture back (`delayRender`). Nothing here knows about a
// template, a block or a theme, which is the point — the compositions are the
// Remotion ones, unchanged, and this file is swapped in for `../clock.js` by the
// bundler in `render.hyperframes.js`.
//
// The behaviours copied are Remotion's own, because the compositions were
// written against them and measured under them:
//   - `Sequence` mounts its children only inside [from, from + duration), gives
//     them a frame counted from its own start, and lays them in an absolute fill
//     unless `layout="none"`;
//   - `Freeze` hands its subtree one fixed frame;
//   - `Img` holds the frame until its picture has DECODED, and fails the render
//     when it cannot load one — a blank box burnt into a film is the outcome this
//     exists to refuse (see the note in `ImageSequenceVideo.jsx`).
import { createContext, forwardRef, useContext, useLayoutEffect, useState } from 'react'

const FrameContext = createContext(0)
const ConfigContext = createContext(null)

/** Both contexts, for `clockCanvas.jsx`, which has to carry them across a renderer. */
export const ClockContexts = { FrameContext, ConfigContext }

// ---- Holding the capture back ----------------------------------------------

/*
 * Every open hold, by handle. A seek is settled when this is empty — the same
 * rule Remotion applies before it screenshots, which is why the loaders that
 * call `delayRender` (typefaces, Lottie, textures, pictures) needed no change.
 */
const holds = new Map()
let nextHandle = 1
let failure = null
const waiters = new Set()

function wake() {
  if (holds.size > 0 && !failure) return
  for (const waiter of waiters) waiter()
  waiters.clear()
}

export function delayRender(label = '') {
  const handle = nextHandle++
  holds.set(handle, label)
  return handle
}

export function continueRender(handle) {
  if (!holds.delete(handle)) return
  wake()
}

/**
 * Fail the render, as Remotion's `cancelRender` does: the next seek's barrier
 * rejects and HyperFrames stops with this message instead of capturing.
 */
export function failRender(error) {
  if (!failure) failure = error instanceof Error ? error : new Error(String(error))
  wake()
}

/** How long one seek may wait on its holds before the render is failed by name. */
export const HOLD_TIMEOUT_MS = 28_000

/**
 * Resolved once every hold is released, after the effects of the current
 * commit have had a turn to open theirs.
 *
 * The macrotask is not decoration. A loader opens its hold in a passive effect
 * or a promise callback, so "empty right now" is true for an instant after a
 * commit and false a microtask later; resolving on that instant would let the
 * capture through before the picture it was waiting for.
 */
export function whenSettled() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(check)
      const open = [...holds.values()].filter(Boolean).join(', ') || 'an unnamed hold'
      reject(new Error(`mocky-video-worker: a frame was still waiting after ${HOLD_TIMEOUT_MS} ms — ${open}`))
    }, HOLD_TIMEOUT_MS)
    const check = () => {
      if (failure) {
        clearTimeout(timer)
        reject(failure)
      } else if (holds.size === 0) {
        clearTimeout(timer)
        resolve()
      } else {
        waiters.add(check)
      }
    }
    setTimeout(check, 0)
  })
}

// ---- The clock ---------------------------------------------------------------

export const useCurrentFrame = () => useContext(FrameContext)

export function useVideoConfig() {
  const config = useContext(ConfigContext)
  if (!config) throw new Error('useVideoConfig() was called outside the HyperFrames clock')
  return config
}

/** The root of the tree: the absolute frame and the film's configuration. */
export function ClockProvider({ frame, config, children }) {
  return (
    <ConfigContext.Provider value={config}>
      <FrameContext.Provider value={frame}>{children}</FrameContext.Provider>
    </ConfigContext.Provider>
  )
}

// ---- Layout ------------------------------------------------------------------

/** Remotion's own `AbsoluteFill` style, property for property. */
const FILL = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
}

export const AbsoluteFill = forwardRef(function AbsoluteFill({ style, ...rest }, ref) {
  return <div ref={ref} style={style ? { ...FILL, ...style } : FILL} {...rest} />
})

export function Sequence({ from = 0, durationInFrames = Infinity, layout = 'absolute-fill', style, children }) {
  const local = useCurrentFrame() - from
  if (local < 0 || local >= durationInFrames) return null
  return (
    <FrameContext.Provider value={local}>
      {layout === 'none' ? children : <AbsoluteFill style={style}>{children}</AbsoluteFill>}
    </FrameContext.Provider>
  )
}

export function Freeze({ frame, active = true, children }) {
  const current = useCurrentFrame()
  return <FrameContext.Provider value={active ? frame : current}>{children}</FrameContext.Provider>
}

// ---- Pictures ----------------------------------------------------------------

export const Img = forwardRef(function Img({ src, onLoad, onError, ...rest }, ref) {
  // Opened during render, so the seek that mounted this picture is the one that
  // waits for it — a hold opened in an effect would be a commit too late.
  const [hold] = useState(() => delayRender(`decoding ${src}`))
  useLayoutEffect(() => {
    let done = false
    const probe = new Image()
    probe.src = src
    probe
      .decode()
      .then(() => {
        done = true
        continueRender(hold)
      })
      .catch(() => {
        done = true
        failRender(new Error(`mocky-video-worker: could not load the picture ${src}`))
      })
    return () => {
      if (!done) continueRender(hold)
    }
  }, [src, hold])
  return <img ref={ref} src={src} onLoad={onLoad} onError={onError} {...rest} />
})
