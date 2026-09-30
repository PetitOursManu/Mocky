import { useId, useMemo, useState } from 'react'
import Preview from './Preview'
import WireframeDevice from './WireframeDevice'
import { Icon, IconButton } from '../ui'
import type { Screen } from '../lib/project'
import { docFrameHeight, getPageFormat, isPageFormat, PAGE_GAP_PX, type PageFormatId } from '../lib/pageFormats'
import { pagesInFrame } from '../lib/documentMode'
import { CAPTION_ROOM, deviceFrame, fitFrameScale } from '../lib/deviceFrames'
import { PHONE_SCREEN, platformOf, socialLayout, type ActionIcon, type Box, type TabIcon } from '../lib/socialFrame'
import { getScreenTheme } from '../lib/screenThemes'
import { useT } from '../i18n'

/**
 * A SOCIAL post in the demo player: on a phone, in its feed, or full screen for
 * a story — the counterpart of `DocumentInHand` for a picture made to be
 * posted rather than printed. The geometry is `lib/socialFrame.ts`; this draws.
 *
 * The app around the post is a line drawing in the phone's own ink, never a
 * copy of a real app: an author row, the actions, the caption as grey lines,
 * the next post starting. It says "this is where it will be seen" and leaves
 * the eye on the one thing that was designed — the page, rendered at its own
 * 1080 px and scaled as a picture, one page at a time, like a carousel.
 */

const INK = 'rgb(var(--ink))'
const MUTED = 'rgb(var(--ink-muted))'
const FAINT = 'rgb(var(--ink-faint))'
const PAPER = 'rgb(var(--surface))'
const hairline = { vectorEffect: 'non-scaling-stroke' } as const

/** Height of the pager row under the phone, when there is more than one page. */
const PAGER_ROOM = 36

function Bar({ b, fill = FAINT }: { b: Box; fill?: string }) {
  return <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.r} fill={fill} opacity={0.55} />
}

/** An outline glyph drawn in a 24-unit box centred on (cx, cy). */
function Glyph({ kind, cx, cy, size }: { kind: ActionIcon | TabIcon; cx: number; cy: number; size: number }) {
  const d: Record<ActionIcon | TabIcon, string> = {
    heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
    like: 'M7 11v8H4v-8h3zm0 0 4-7a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 19H7',
    comment: 'M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4A8 8 0 1 1 20 12z',
    share: 'M21 3 10 14M21 3l-7 18-4-7-7-4 18-7z',
    save: 'M6 3h12v18l-6-5-6 5V3z',
    home: 'M4 11 12 4l8 7v9h-5v-6H9v6H4v-9z',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm5-2 5 5',
    add: 'M5 5h14v14H5zM12 8v8M8 12h8',
    play: 'M5 4h14v16H5zM10 9v6l5-3-5-3z',
    profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0',
  }
  const s = size / 24
  return (
    <path
      d={d[kind]}
      transform={`translate(${cx - 12 * s} ${cy - 12 * s}) scale(${s})`}
      fill="none"
      stroke={INK}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...hairline}
    />
  )
}

export default function DocumentInPhone({
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
  const veilId = 'story-veil-' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  // The format the kit laid out wins, as in DocumentPages.
  const [laid, setLaid] = useState<PageFormatId | null>(null)
  const format = getPageFormat(laid ?? page)
  const [pages, setPages] = useState(() => pagesInFrame(format, screen.h))
  const [index, setIndex] = useState(0)
  const shown = Math.min(index, pages - 1)

  const frame = useMemo(() => deviceFrame('phone', PHONE_SCREEN.w, PHONE_SCREEN.h), [])
  const layout = useMemo(() => socialLayout(format, pages, platformOf(screen.theme)), [format, pages, screen.theme])
  const footer = CAPTION_ROOM + (pages > 1 ? PAGER_ROOM : 0)
  const scale = fitFrameScale(width, height, frame, { footer })
  if (scale <= 0) return null

  const { post } = layout
  const pictureScale = post.w / format.w
  const offset = shown * (format.h + PAGE_GAP_PX)
  const type = getScreenTheme(screen.theme)
  const caption = [t(`docExport.format.${format.id}`), type ? t(`composer.themes.${type.id}`) : ''].filter(Boolean).join(' · ')

  return (
    <div className="relative" style={{ width: frame.width * scale, height: frame.height * scale + footer }}>
      <WireframeDevice frame={frame} scale={scale} caption={caption} systemUi>
        {() => (
          <div className="absolute inset-0" style={{ background: PAPER }}>
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0" viewBox={`0 0 ${PHONE_SCREEN.w} ${PHONE_SCREEN.h}`}>
              {layout.appBar && (
                <>
                  <Bar b={layout.appBar.wordmark} fill={MUTED} />
                  {layout.appBar.icons.map((c, i) => (
                    <Glyph key={i} kind={i === 0 ? 'heart' : 'comment'} cx={c.cx} cy={c.cy} size={c.r * 2.2} />
                  ))}
                </>
              )}
              {layout.mode === 'feed' && (
                <>
                  <circle cx={layout.avatar.cx} cy={layout.avatar.cy} r={layout.avatar.r} fill="none" stroke={INK} strokeWidth={1.25} {...hairline} />
                  {layout.author.map((b, i) => (
                    <Bar key={i} b={b} fill={i === 0 ? MUTED : FAINT} />
                  ))}
                </>
              )}
              {layout.caption.map((b, i) => (
                <Bar key={i} b={b} />
              ))}
              {layout.actions.map((a, i) => (
                <g key={i}>
                  <Glyph kind={a.icon} cx={a.c.cx} cy={a.c.cy} size={a.c.r * 2.2} />
                  {a.label && <Bar b={a.label} />}
                </g>
              ))}
              {layout.dots.map((d, i) => (
                <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={i === shown ? INK : FAINT} />
              ))}
              {layout.reply && (
                <rect
                  x={layout.reply.x}
                  y={layout.reply.y}
                  width={layout.reply.w}
                  height={layout.reply.h}
                  rx={layout.reply.r}
                  fill="none"
                  stroke={MUTED}
                  strokeWidth={1}
                  {...hairline}
                />
              )}
              {layout.next && (
                <>
                  <circle cx={layout.next.avatar.cx} cy={layout.next.avatar.cy} r={layout.next.avatar.r} fill="none" stroke={FAINT} strokeWidth={1.25} {...hairline} />
                  {layout.next.author.map((b, i) => (
                    <Bar key={i} b={b} />
                  ))}
                  <rect x={layout.next.picture.x} y={layout.next.picture.y} width={layout.next.picture.w} height={layout.next.picture.h} fill={FAINT} opacity={0.18} />
                </>
              )}
              {layout.tabBar && (
                <>
                  <line x1={0} y1={layout.tabBar.y} x2={PHONE_SCREEN.w} y2={layout.tabBar.y} stroke={FAINT} strokeWidth={1} {...hairline} />
                  {layout.tabBar.icons.map((tab, i) => (
                    <Glyph key={i} kind={tab.icon} cx={tab.c.cx} cy={tab.c.cy} size={tab.c.r * 2.2} />
                  ))}
                </>
              )}
            </svg>

            {/* The page, at its own size, scaled into the picture's place and
                moved so the page shown is the one in the window. */}
            <div
              className="absolute overflow-hidden"
              style={{ left: post.x, top: post.y, width: post.w, height: post.h, borderRadius: post.r }}
            >
              <div
                className="absolute left-0 top-0"
                style={{
                  width: format.w,
                  height: docFrameHeight(format, pages),
                  transform: `scale(${pictureScale}) translateY(${-offset}px)`,
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

            {/* What the app draws OVER the picture: a carousel's counter, and a
                story's progress and author. White on a dark veil, as the app
                does, because they sit on a photograph of any colour. */}
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0" viewBox={`0 0 ${PHONE_SCREEN.w} ${PHONE_SCREEN.h}`}>
              {layout.counter && (
                <g>
                  <rect x={layout.counter.x} y={layout.counter.y} width={layout.counter.w} height={layout.counter.h} rx={layout.counter.r} fill="#000" opacity={0.55} />
                  <text
                    x={layout.counter.x + layout.counter.w / 2}
                    y={layout.counter.y + layout.counter.h / 2 + 4}
                    textAnchor="middle"
                    fontSize={12}
                    fontFamily="ui-monospace, monospace"
                    fill="#fff"
                  >
                    {shown + 1}/{pages}
                  </text>
                </g>
              )}
              {layout.mode === 'story' && (
                <>
                  <rect x={post.x} y={post.y} width={post.w} height={90} fill={`url(#${veilId})`} />
                  <defs>
                    <linearGradient id={veilId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#000" stopOpacity={0.35} />
                      <stop offset="1" stopColor="#000" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {layout.progress.map((s, i) => (
                    <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} fill="#fff" opacity={i <= shown ? 0.95 : 0.4} />
                  ))}
                  <circle cx={layout.avatar.cx} cy={layout.avatar.cy} r={layout.avatar.r} fill="none" stroke="#fff" strokeWidth={1.5} {...hairline} />
                  {layout.author.map((b, i) => (
                    <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={b.r} fill="#fff" opacity={i === 0 ? 0.9 : 0.6} />
                  ))}
                </>
              )}
            </svg>
          </div>
        )}
      </WireframeDevice>

      {pages > 1 && (
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1" style={{ top: frame.height * scale + CAPTION_ROOM }}>
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
    </div>
  )
}
