// The Lottie player `animatedIcon` is handed through `IconPlayer` — see
// `blocks/iconPlayer.js` for why it is handed rather than imported.
//
// lottie-web drives the animation, never plays it: autoplay off, and the frame
// shown is set on every render from the SCENE's frame (`iconFrame`), so the same
// frame of a film is the same frame of every icon in every render tab. The first
// build of an animation is held with `delayRender` until lottie reports its DOM
// ready, so no frame is captured with an empty box where the icon should be.
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import lottie from 'lottie-web'
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion'
import { iconFrame, recolourLottie } from './blocks/media.js'
import { LOTTIE_ICONS } from './lottieIcons.js'

export const LottieIcon = ({ icon, ink, knockout, size }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const host = useRef(null)
  const player = useRef(null)
  const entry = LOTTIE_ICONS[icon]
  // Repainted once per colour pair: a new object, so the library's shared data is
  // never written to, and a stable one, so lottie is not rebuilt on every frame.
  const data = useMemo(() => (entry ? recolourLottie(entry.data, ink, knockout) : null), [entry, ink, knockout])
  const [handle] = useState(() => delayRender(`Loading the "${icon}" icon`))

  useLayoutEffect(() => {
    if (!host.current || !data) {
      continueRender(handle)
      return undefined
    }
    const animation = lottie.loadAnimation({
      container: host.current,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      animationData: data,
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
    })
    player.current = animation
    let released = false
    const release = () => {
      if (released) return
      released = true
      continueRender(handle)
    }
    // Inline data can be ready before a listener is attached; both are covered.
    if (animation.isLoaded) release()
    else animation.addEventListener('DOMLoaded', release)
    return () => {
      animation.removeEventListener('DOMLoaded', release)
      animation.destroy()
      player.current = null
      release()
    }
  }, [data, handle])

  useLayoutEffect(() => {
    const animation = player.current
    if (!animation || !entry) return
    animation.goToAndStop(
      iconFrame(frame, fps, {
        fr: entry.data.fr,
        frames: Math.max(1, (entry.data.op ?? 1) - (entry.data.ip ?? 0)),
        mode: entry.mode,
        rest: entry.rest,
        to: entry.to,
      }),
      true,
    )
  })

  return <div ref={host} style={{ width: size, height: size }} />
}
