import { useId, useMemo, useState } from 'react'
import Preview from './Preview'
import { Icon, IconButton } from '../ui'
import type { Screen } from '../lib/project'
import { docFrameHeight, getPageFormat, isPageFormat, PAGE_GAP_PX, type PageFormatId } from '../lib/pageFormats'
import { pagesInFrame } from '../lib/documentMode'
import { handFrame } from '../lib/handFrame'
import { CAPTION_ROOM, fitFrameScale } from '../lib/deviceFrames'
import { useT } from '../i18n'

/**
 * A printed document in the demo player, held in a hand drawn as a line
 * drawing — the paper counterpart of `WireframeDevice`, in the same ink.
 *
 * One page at a time, because a hand holds a sheet, not a stack: a recto-verso
 * gets a small pager under the caption. The page is the real preview, laid out
 * at the page's own width and scaled as a picture (the reason is in
 * DocumentPages), and cropped to the page shown by moving the whole stack
 * behind a window the size of one sheet.
 *
 * Two layers: the page, then the hand OVER it. Only the thumb lies on the
 * sheet — the palm and the fingers are behind it and simply not drawn — so the
 * whole visible hand can be one shape above the page, with the sheet's edge
 * drawn first so the thumb covers it where it grips it. The arm is clipped at
 * the frame's box, so it leaves the picture as in the reference photograph.
 * The hand takes no pointer events, so a field of the design stays clickable
 * everywhere except under the thumb.
 */

const INK = 'rgb(var(--ink))'
const MUTED = 'rgb(var(--ink-muted))'
const FAINT = 'rgb(var(--ink-faint))'
const PAPER = 'rgb(var(--surface))'
const hairline = { vectorEffect: 'non-scaling-stroke' } as const

/** Height of the pager row, when there is more than one page. */
const PAGER_ROOM = 36

export default function DocumentInHand({
  screen,
  page,
  width,
  height,
}: {
  screen: Screen
  page: PageFormatId
  width: number
  height: number
}) {
  const t = useT()
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const clipId = 'hand-clip-' + uid
  const shadowId = 'hand-shadow-' + uid
  // The format the kit laid out wins, as in DocumentPages.
  const [laid, setLaid] = useState<PageFormatId | null>(null)
  const format = getPageFormat(laid ?? page)
  const [pages, setPages] = useState(() => pagesInFrame(format, screen.h))
  const [index, setIndex] = useState(0)
  const shown = Math.min(index, pages - 1)

  const hand = useMemo(() => handFrame(format.w, format.h), [format.w, format.h])
  const footer = CAPTION_ROOM + (pages > 1 ? PAGER_ROOM : 0)
  const scale = fitFrameScale(width, height, hand, { footer })
  if (scale <= 0) return null

  const W = hand.width * scale
  const H = hand.height * scale
  const offset = shown * (format.h + PAGE_GAP_PX)
  const g = 5 / scale
  const l = 7 / scale
  const ticks = [
    `M${-g - l},${-g}H${-g}V${-g - l}`,
    `M${hand.width + g + l},${-g}H${hand.width + g}V${-g - l}`,
    `M${-g - l},${hand.height + g}H${-g}V${hand.height + g + l}`,
    `M${hand.width + g + l},${hand.height + g}H${hand.width + g}V${hand.height + g + l}`,
  ].join('')

  return (
    <div className="relative" style={{ width: W, height: H + footer }}>
      <div className="relative" style={{ width: W, height: H }}>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-visible"
          viewBox={`0 0 ${hand.width} ${hand.height}`}
          preserveAspectRatio="none"
        >
          <path d={ticks} fill="none" stroke={FAINT} strokeWidth={1} {...hairline} />
        </svg>

        <div className="absolute left-0 top-0 overflow-hidden" style={{ width: format.w * scale, height: format.h * scale }}>
          <div
            className="absolute left-0 top-0"
            style={{
              width: format.w,
              height: docFrameHeight(format, pages),
              transform: `scale(${scale}) translateY(${-offset}px)`,
              transformOrigin: '0 0',
            }}
          >
            <Preview
              code={screen.code}
              caps={screen.caps}
              animations={false}
              hideScrollbars
              onDocPages={(count, _overflow, reported) => {
                if (typeof count === 'number' && Number.isFinite(count) && count >= 1) setPages(Math.min(50, Math.floor(count)))
                if (isPageFormat(reported)) setLaid(reported)
              }}
            />
          </div>
        </div>

        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-visible"
          viewBox={`0 0 ${hand.width} ${hand.height}`}
          preserveAspectRatio="none"
        >
          <defs>
            {/* The arm leaves the picture at the bottom right: drawn past the
                box, cut at it. */}
            <clipPath id={clipId}>
              <rect x={0} y={0} width={hand.width} height={hand.height} />
            </clipPath>
            {/* The one shading the reference has that a line drawing needs:
                the thumb's shadow on the sheet, which is what says the thumb
                is ON the paper rather than cut into it. Black at low opacity
                in both themes — an ink-coloured "shadow" is a glow in the dark
                one. */}
            <filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={5 * hand.scale} />
            </filter>
          </defs>
          <rect x={0} y={0} width={format.w} height={format.h} fill="none" stroke={INK} strokeWidth={1} {...hairline} />
          <path
            d={hand.thumbShadow}
            fill="#000"
            fillOpacity={0.14}
            filter={`url(#${shadowId})`}
            transform={`translate(${-7 * hand.scale} ${5 * hand.scale})`}
          />
          <g clipPath={`url(#${clipId})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={hand.fill} fill={PAPER} stroke="none" />
            <path d={hand.outer} stroke={INK} strokeWidth={1.5} {...hairline} />
            <path d={hand.inner} stroke={INK} strokeWidth={1.5} {...hairline} />
            <path d={hand.thumb} stroke={INK} strokeWidth={1.5} {...hairline} />
            <path d={hand.thenar} stroke={INK} strokeWidth={1.5} {...hairline} />
            <path d={hand.thumbSide} stroke={INK} strokeWidth={1.25} {...hairline} />
            <path d={hand.fingerTip} stroke={INK} strokeWidth={1.25} {...hairline} />
            <path d={hand.nail} stroke={MUTED} strokeWidth={1} {...hairline} />
            {hand.creases.map((d, i) => (
              <path key={i} d={d} stroke={FAINT} strokeWidth={1} {...hairline} />
            ))}
          </g>
        </svg>
      </div>

      {pages > 1 && (
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1" style={{ top: H + 4 }}>
          <IconButton label={t('canvas.docPrevPage')} variant="quiet" disabled={shown === 0} onClick={() => setIndex(Math.max(0, shown - 1))}>
            <Icon name="chevronLeft" size={16} />
          </IconButton>
          <span className="text-caption tabular-nums text-ink-muted" aria-live="polite">
            {t('canvas.docPage', { n: shown + 1, total: pages })}
          </span>
          <IconButton
            label={t('canvas.docNextPage')}
            variant="quiet"
            disabled={shown >= pages - 1}
            onClick={() => setIndex(Math.min(pages - 1, shown + 1))}
          >
            <Icon name="chevronRight" size={16} />
          </IconButton>
        </div>
      )}
      <p
        className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-caption tabular-nums text-ink-faint"
        style={{ lineHeight: `${CAPTION_ROOM}px` }}
      >
        {t(`docExport.format.${format.id}`)}
      </p>
    </div>
  )
}
