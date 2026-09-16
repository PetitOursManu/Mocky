import { useState } from 'react'
import { continueRender, delayRender } from 'remotion'
import { UNICODE_RANGES } from './catalogue.js'
import { FONT_FILES } from './files.js'
import { facesForTheme } from './index.js'

/**
 * One promise per face file, for the life of the bundle. Remotion renders a film
 * in several tabs and remounts compositions; a face registered twice is harmless,
 * a face DOWNLOADED twice per frame range is minutes.
 */
const pending = new Map()

function register(face) {
  const files = FONT_FILES[face.key]
  if (!files) return Promise.resolve()
  const jobs = [
    [files.latin, UNICODE_RANGES.latin],
    [files.latinExt, UNICODE_RANGES.latinExt],
  ]
    .filter(([url]) => Boolean(url))
    .map(([url, unicodeRange]) => {
      const id = `${face.family}|${face.weight}|${url}`
      if (!pending.has(id)) {
        const font = new FontFace(face.family, `url(${url}) format('woff2')`, {
          weight: face.weight,
          style: 'normal',
          unicodeRange,
          // See `sizeAdjustOf`: a wider family is scaled back onto the width the
          // layout estimated with, and never enlarged.
          sizeAdjust: `${Math.round(face.sizeAdjust * 1000) / 10}%`,
          display: 'block',
        })
        pending.set(
          id,
          font.load().then((loaded) => {
            document.fonts.add(loaded)
          }),
        )
      }
      return pending.get(id)
    })
  return Promise.all(jobs)
}

/**
 * A composition, with the direction's typefaces loaded before its first frame.
 *
 * `delayRender` holds the frame until every face is in, because a frame captured
 * a few milliseconds early is burnt in the fallback face and nothing afterwards
 * can correct an mp4. A face that fails to load releases the frame anyway and
 * says so in the log: the class fallback is still there, and a film in Liberation
 * is better than no film (Q1).
 */
export function withInstalledFonts(Component) {
  function WithInstalledFonts(props) {
    useState(() => {
      const faces = facesForTheme(props?.timeline?.theme)
      if (!faces.length) return null
      const handle = delayRender('Loading the typefaces the direction names')
      Promise.all(faces.map(register))
        .then(() => continueRender(handle))
        .catch((err) => {
          console.warn(`mocky-video-worker: a typeface failed to load, the class fallback is used — ${err?.message ?? err}`)
          continueRender(handle)
        })
      return handle
    })
    return <Component {...props} />
  }
  WithInstalledFonts.displayName = `WithInstalledFonts(${Component.displayName || Component.name || 'Composition'})`
  return WithInstalledFonts
}
