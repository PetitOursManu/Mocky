import { useMemo } from 'react'
import { frameShape } from '../lib/frameShapes'

/**
 * A frame of the catalogue drawn in the shell — the dialog's picture of what
 * `<ShapeFrame>` draws in a screen (snippets/ShapeFrame.ts). Same paths, same
 * layers, same mask: two drawings of one shape that could disagree would make
 * the picker a promise the screen does not keep.
 */

/** The shape alone, at its own proportions inside a square, for the picker's tiles. */
export function ShapeIcon({ shape, className = '' }: { shape: string; className?: string }) {
  const s = frameShape(shape)
  const w = 100 * s.ratio
  const layer = (d: string, props: React.SVGProps<SVGPathElement>) => (
    <path d={d} transform={`scale(${s.ratio} 1)`} fillRule="evenodd" {...props} />
  )
  return (
    <svg viewBox={`0 0 ${w} 100`} preserveAspectRatio="xMidYMid meet" className={className} aria-hidden>
      {s.paper &&
        layer(s.paper, { fill: 'none', stroke: 'currentColor', strokeOpacity: 0.45, strokeWidth: 3, vectorEffect: 'non-scaling-stroke' })}
      {layer(s.clip, { fill: 'currentColor' })}
      {s.over && layer(s.over, { fill: 'currentColor', fillOpacity: 0.35 })}
    </svg>
  )
}

/** The shape with its picture in it, `className` giving it a width. */
export function FrameArt({ shape, src, className = '' }: { shape: string; src?: string | null; className?: string }) {
  const s = frameShape(shape)
  const mask = useMemo(
    () =>
      `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${s.clip}"/></svg>`,
      )}")`,
    [s.clip],
  )
  const svgLayer = (d: string, fill: string, opacity = 1) => (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      <path d={d} fill={fill} fillOpacity={opacity} fillRule="evenodd" />
    </svg>
  )
  return (
    <span className={`relative block ${className}`} style={{ aspectRatio: String(s.ratio) }}>
      {s.paper && svgLayer(s.paper, s.paperColor ?? '#ffffff')}
      <span
        className={`absolute inset-0 overflow-hidden ${src ? '' : 'bg-ink/15'}`}
        style={{
          maskImage: mask,
          WebkitMaskImage: mask,
          maskSize: '100% 100%',
          WebkitMaskSize: '100% 100%',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
        }}
      >
        {src && <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />}
      </span>
      {s.over && svgLayer(s.over, s.overColor ?? '#efe6cf', s.overOpacity ?? 1)}
    </span>
  )
}
