// HyperFrames' answer to `../clockCanvas.js`: the GL canvas a 3D block is drawn
// in, with Remotion's `ThreeCanvas` contract.
//
// That contract is three promises, and react-three-fiber's `<Canvas>` keeps none
// of them under a seeking engine:
//   1. nothing draws on its own — `frameloop: 'never'`, or the scene would move
//      on the browser's clock between two captures;
//   2. the draw for frame N happens AFTER the scene graph for frame N is
//      committed, and before the capture — `Advance` below, last child, in a
//      layout effect, so every block's own layout effect (a camera rig, a light)
//      has already run;
//   3. the capture waits for that draw. A react-three-fiber root is a second
//      React renderer, so the DOM commit a seek forces does not commit it in the
//      same turn: each render of this component opens a hold that only the draw
//      of that render releases. Each RENDER, not each frame: a texture that
//      decodes on frame 0 re-renders frame 0, and a draw keyed on the frame
//      number skipped it — the first frame of a photo stage came out black.
//
// And a fourth, which is why this is `createRoot` on a canvas of our own rather
// than `<Canvas>`: `<Canvas>` creates its renderer only once a ResizeObserver
// has MEASURED its box, and an observer reports during a rendered frame. A
// canvas mounted mid-film — the second scene of a `world` ground — waited for a
// frame the capture was holding back for that very canvas, and the render died
// on its own deadline. The size here is the one the block was given, so there
// is nothing to measure.
//
// The frame and the film's configuration are re-provided inside the canvas by
// hand: a root made with `createRoot` bridges no context at all, and a block
// that read frame 0 inside a canvas would be a still picture in a moving film.
import { createRoot, extend, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useContext, useLayoutEffect, useRef, useState } from 'react'
import { ClockContexts, continueRender, delayRender } from './clock.jsx'

const { FrameContext, ConfigContext } = ClockContexts

// What `<Canvas>` does on its first render: every three.js class becomes a JSX
// intrinsic (`<mesh>`, `<fogExp2>`…), which the blocks are written in.
extend(THREE)

function Advance({ generation, onDrawn }) {
  const advance = useThree((state) => state.advance)
  // No dependency list: every commit of this tree is drawn, whatever changed.
  useLayoutEffect(() => {
    advance(performance.now())
    onDrawn(generation)
  })
  return null
}

export function ThreeCanvas({ width, height, style, children, ...props }) {
  const frame = useContext(FrameContext)
  const config = useContext(ConfigContext)
  const canvasRef = useRef(null)
  const rootRef = useRef(null)
  // Until the renderer exists there is no frame to draw at all.
  const [created] = useState(() => delayRender('opening a GL canvas'))
  const generation = useRef(0)
  const pending = useRef(new Map())

  const onDrawn = useRef((drawn) => {
    for (const [g, hold] of pending.current) {
      if (g <= drawn) {
        continueRender(hold)
        pending.current.delete(g)
      }
    }
  }).current

  // The root, once, and everything it holds released with it — or a canvas
  // whose scene ended mid-wait would hold the next frame forever.
  useLayoutEffect(() => {
    rootRef.current = createRoot(canvasRef.current)
    return () => {
      rootRef.current?.unmount()
      rootRef.current = null
      continueRender(created)
      for (const hold of pending.current.values()) continueRender(hold)
      pending.current.clear()
    }
  }, [created])

  // Every render, as `<Canvas>` itself does: the configuration is idempotent
  // (the camera and the renderer are made once) and the tree is the new frame's.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const g = ++generation.current
    pending.current.set(g, delayRender(`drawing GL frame ${frame}`))
    root.configure({
      ...props,
      size: { width, height, top: 0, left: 0 },
      dpr: 1,
      frameloop: 'never',
      // The capture reads the canvas back after the draw; a buffer cleared on
      // composite would hand it a black square.
      gl: { preserveDrawingBuffer: true, ...(props.gl || {}) },
      onCreated: (state) => {
        props.onCreated?.(state)
        continueRender(created)
      },
    })
    root.render(
      <ConfigContext.Provider value={config}>
        <FrameContext.Provider value={frame}>
          {children}
          <Advance generation={g} onDrawn={onDrawn} />
        </FrameContext.Provider>
      </ConfigContext.Provider>,
    )
  })

  return <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block', width, height, ...style }} />
}
