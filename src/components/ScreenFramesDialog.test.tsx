import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ScreenFramesDialog from './ScreenFramesDialog'
import { FrameArt, ShapeIcon } from './FrameArt'
import { FRAME_FAMILIES, FRAME_SHAPES, frameShape } from '../lib/frameShapes'
import { FRAME_FOCI } from '../lib/screenFrames'
import { partsEn, partsFr } from '../i18n/parts'

describe('the frames dialog', () => {
  it('opens on its own sentence, reading the screen', () => {
    const html = renderToStaticMarkup(
      <ScreenFramesDialog screenName="Post" code="<ShapeFrame shape='heart' />" onChange={() => {}} onClose={() => {}} />,
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain(partsFr['frames.intro'].slice(0, 40))
    expect(html).toContain(partsFr['frames.loading'].replace('…', ''))
  })

  it('names every shape, family and framing in both languages', () => {
    for (const dict of [partsFr, partsEn]) {
      for (const s of FRAME_SHAPES) expect(dict[`frames.shape.${s.id}`], s.id).toBeTruthy()
      for (const f of FRAME_FAMILIES) expect(dict[`frames.family.${f}`], f).toBeTruthy()
      for (const f of FRAME_FOCI) expect(dict[`frames.focus.${f}`], f).toBeTruthy()
    }
  })

  it('draws every shape from the catalogue’s own paths, the picture cut by the same mask the screen uses', () => {
    for (const s of FRAME_SHAPES) {
      const icon = renderToStaticMarkup(<ShapeIcon shape={s.id} />)
      expect(icon, s.id).toContain(`d="${s.clip}"`)
    }
    const art = renderToStaticMarkup(<FrameArt shape="polaroid" src="/api/images/abc" />)
    expect(art).toContain(`d="${frameShape('polaroid').paper}"`)
    const mask = (art.match(/mask-image:url\(&quot;data:image\/svg\+xml,([^&]+)&quot;\)/) ?? [])[1] ?? ''
    expect(decodeURIComponent(mask)).toContain(`d="${frameShape('polaroid').clip}"`)
    expect(art).toContain('src="/api/images/abc"')
  })
})
