import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ShapeFrameSource, SHAPEFRAME_EXPORTS } from './ShapeFrame'
import { FRAME_SHAPES, frameShape } from '../../frameShapes'
import { CAPABILITY_MAP } from '../registry'
import { capabilitiesUsedBy } from '../select'
import { documentPipeline, FRAMES_CAP } from '../../documentMode'

/**
 * `<ShapeFrame>` rendered by the real React, from the very string the preview
 * prepends — what a browser adds (the mask actually cutting the picture) is
 * what the contact sheet in the PR was for.
 */

const ShapeFrame = new Function('React', `${ShapeFrameSource}\nreturn ShapeFrame`)(React) as React.FC<Record<string, unknown>>
const html = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(ShapeFrame, props))
const maskOf = (markup: string) =>
  decodeURIComponent((markup.match(/mask-image:url\(&quot;data:image\/svg\+xml,([^&]+)&quot;\)/) ?? [])[1] ?? '')

describe('ShapeFrame', () => {
  it('cuts the picture with the catalogue’s own path, and names the shape for the exporter', () => {
    const out = html({ shape: 'heart', src: '/api/images/abc', alt: 'Un gâteau', className: 'w-[420px]' })
    expect(out).toContain('data-mocky-frame="heart"')
    expect(out).toContain('data-mocky-frame-photo=""')
    expect(maskOf(out)).toContain(`d="${frameShape('heart').clip}"`)
    expect(out).toContain('src="/api/images/abc"')
    expect(out).toContain('alt="Un gâteau"')
    expect(out).toContain('object-fit:cover')
  })

  it('falls back to the soft rectangle for a name it does not know, rather than to nothing', () => {
    expect(html({ shape: 'hexagram', src: '/x' })).toContain('data-mocky-frame="rounded"')
    expect(html({ src: '/x' })).toContain('data-mocky-frame="rounded"')
  })

  it('keeps the proportions the shape was drawn for, unless the page sized the box', () => {
    expect(html({ shape: 'arch', className: 'w-80' })).toContain(`aspect-ratio:${frameShape('arch').ratio}`)
    expect(html({ shape: 'arch', className: 'w-80 h-96' })).not.toContain('aspect-ratio')
    expect(html({ shape: 'arch', className: 'w-full aspect-square' })).not.toContain('aspect-ratio')
  })

  it('keeps a position the page gave it, and takes one only when it has none', () => {
    expect(html({ shape: 'arch', className: 'w-80' })).toContain('position:relative')
    // A collage places its frames with classes; an inline `relative` would beat them.
    expect(html({ shape: 'arch', className: 'absolute right-[70px] top-[120px] w-[420px]' })).not.toContain('position:relative')
    expect(html({ shape: 'arch', className: 'w-80 md:absolute' })).not.toContain('position:relative')
    expect(html({ shape: 'arch', className: 'w-80 absolutely-not' })).toContain('position:relative')
  })

  it('draws a grey placeholder in the shape when it has no picture', () => {
    const out = html({ shape: 'blob-2' })
    expect(out).not.toContain('<img')
    expect(out).toContain('background:#e4e4e7')
  })

  it('draws a photo frame’s paper under the picture and its tape over it', () => {
    const polaroid = html({ shape: 'polaroid', src: '/x' })
    expect(polaroid.indexOf(frameShape('polaroid').paper!)).toBeLessThan(polaroid.indexOf('data-mocky-frame-photo'))
    expect(polaroid).toContain('fill="#ffffff"')
    expect(html({ shape: 'polaroid', src: '/x', paper: '#fde68a' })).toContain('fill="#fde68a"')
    const tape = html({ shape: 'tape', src: '/x' })
    expect(tape.indexOf(frameShape('tape').over!)).toBeGreaterThan(tape.indexOf('data-mocky-frame-photo'))
  })

  it('takes only a colour where a colour goes, and bounds every number', () => {
    expect(html({ shape: 'circle', stroke: '#ff0000', strokeWidth: 6 })).toContain('stroke="#ff0000"')
    expect(html({ shape: 'circle', stroke: 'white' })).toContain('stroke-width="3"')
    expect(html({ shape: 'circle', stroke: 'url(https://evil.test/x)' })).not.toContain('stroke=')
    expect(html({ shape: 'polaroid', paper: 'var(--x)' })).toContain('fill="#ffffff"')
    expect(html({ shape: 'circle', rotate: 400 })).toContain('rotate(30deg)')
    expect(html({ shape: 'circle', src: '/x', zoom: 9 })).toContain('scale(2)')
    expect(html({ shape: 'circle', src: '/x', focus: 'top' })).toContain('object-position:50% 0%')
    expect(html({ shape: 'circle', src: '/x', focus: 'javascript:' })).toContain('object-position:50% 50%')
  })

  it('renders every shape in the catalogue', () => {
    for (const s of FRAME_SHAPES) expect(html({ shape: s.id, src: '/x' }), s.id).toContain(`data-mocky-frame="${s.id}"`)
  })
})

describe('the frames capability', () => {
  it('is loaded by a screen that names the component, and not by one that writes its own Frame', () => {
    expect(capabilitiesUsedBy('<ShapeFrame shape="circle" src="/x" />')).toContain('frames')
    expect(capabilitiesUsedBy('const Frame = () => <div />; export default () => <Frame />')).not.toContain('frames')
    expect([...SHAPEFRAME_EXPORTS]).toEqual(['ShapeFrame'])
  })

  it('tells the model every shape by name', () => {
    const card = CAPABILITY_MAP.frames.components![0].description
    for (const s of FRAME_SHAPES) expect(card).toContain(`"${s.id}"`)
  })

  it('is offered to a social post, and not to a sheet of paper', () => {
    expect(documentPipeline('social-square').caps(['icons'])).toContain(FRAMES_CAP)
    expect(documentPipeline('social-story').caps(['icons', FRAMES_CAP])).toEqual(['icons', FRAMES_CAP, 'document'])
    expect(documentPipeline('a4').caps(['icons'])).not.toContain(FRAMES_CAP)
    expect(documentPipeline(undefined).caps(['icons'])).toEqual(['icons'])
  })
})
