import { useState } from 'react'
import Preview from './Preview'
import type { Screen } from '../lib/project'
import { getPageFormat, isPageFormat, type PageFormatId } from '../lib/pageFormats'
import { demoDocLayout, pageInView, pagesInFrame } from '../lib/documentMode'
import { useT } from '../i18n'

/**
 * A DOCUMENT in the demo player: its pages at their real proportions, fitted
 * to the width and scrolled, with the page in view named in a corner.
 *
 * Not the device path. A frame is chosen from a screen's size, and a flyer is
 * 794 px wide — it would be put in a tablet. And not the bare path either:
 * that one hands the preview the box it will be SHOWN at, so a page 600 px
 * wide on screen would lay itself out in a 600 px viewport — and a document's
 * pages are fixed at 794, so the right fifth of every page would be cut. The
 * frame renders at the page's own width and is scaled as a picture.
 *
 * The phone's project view uses it for the same reason: a flyer shrunk into a
 * 390 px box by its viewport is a flyer with its right half cut off.
 */
const PAD = 28

export default function DocumentPages({
  screen,
  page,
  width,
  height,
  generating,
  onError,
}: {
  screen: Screen
  page: PageFormatId
  width: number
  height: number
  generating?: boolean
  onError?: (message: string) => void
}) {
  const t = useT()
  // The format the kit laid out wins, as on the canvas (`docFrameUpdate`): the
  // phone view has no canvas to have corrected `Screen.page` first.
  const [laid, setLaid] = useState<PageFormatId | null>(null)
  const format = getPageFormat(laid ?? page)
  // The frame's height already says how many pages the canvas saw; the kit's
  // own report, once it arrives here, is the one that holds.
  const [pages, setPages] = useState(() => pagesInFrame(format, screen.h))
  const [scrollTop, setScrollTop] = useState(0)
  const layout = demoDocLayout(format, pages, width, PAD)
  const current = pageInView(scrollTop, height, PAD, format, layout.scale, pages)

  return (
    <div className="absolute inset-0">
      <div
        className="h-full w-full overflow-y-auto overflow-x-hidden"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        // Reachable by keyboard: the pages are the only thing to scroll here,
        // and the arrows are taken by the screen switcher.
        tabIndex={0}
        // A region, because a name on a generic div is one ARIA forbids and a
        // screen reader drops: tabbing in said nothing about what was here.
        role="region"
        aria-label={pages > 1 ? `${screen.name} — ${t('canvas.docPage', { n: current, total: pages })}` : screen.name}
      >
        <div className="mx-auto" style={{ width: layout.boxW, height: layout.boxH, marginTop: PAD, marginBottom: PAD }}>
          <div style={{ width: layout.w, height: layout.h, transform: `scale(${layout.scale})`, transformOrigin: 'top left' }}>
            <Preview
              code={screen.code}
              caps={screen.caps}
              animations={false}
              hideScrollbars
              generating={generating}
              onError={onError}
              onDocPages={(count, _overflow, reported) => {
                if (typeof count === 'number' && Number.isFinite(count) && count >= 1) setPages(Math.min(50, Math.floor(count)))
                if (isPageFormat(reported)) setLaid(reported)
              }}
            />
          </div>
        </div>
      </div>
      {pages > 1 && (
        <span className="pointer-events-none absolute bottom-3 right-4 border border-line bg-raised px-2 py-1 text-caption tabular-nums text-ink-muted">
          {t('canvas.docPage', { n: current, total: pages })}
        </span>
      )}
    </div>
  )
}
