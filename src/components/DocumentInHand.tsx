import { useMemo, useState } from 'react'
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
 * Three layers: the hand's back and cuff UNDER the page (the palm is behind the
 * sheet), the page, then the thumb OVER it with the sheet's own edge — drawn
 * before the thumb so the thumb covers the edge where it grips it. The layers
 * above the page take no pointer events, so a field of the design stays
 * clickable everywhere except under the thumb.
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
          <path d={hand.back} fill={PAPER} stroke={INK} strokeWidth={1.25} strokeLinejoin="round" {...hairline} />
          {hand.knuckles.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={FAINT} strokeWidth={1} strokeLinecap="round" {...hairline} />
          ))}
          <path d={hand.cuff} fill={PAPER} stroke={INK} strokeWidth={1.25} strokeLinejoin="round" {...hairline} />
          <path d={hand.cuffLine} fill="none" stroke={FAINT} strokeWidth={1} {...hairline} />
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
          <rect x={0} y={0} width={format.w} height={format.h} fill="none" stroke={INK} strokeWidth={1} {...hairline} />
          <path d={hand.thumbFill} fill={PAPER} stroke="none" />
          <path d={hand.thumbStroke} fill="none" stroke={INK} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" {...hairline} />
          <path d={hand.nail} fill="none" stroke={MUTED} strokeWidth={1} {...hairline} />
          <path d={hand.crease} fill="none" stroke={FAINT} strokeWidth={1} strokeLinecap="round" {...hairline} />
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
