import { useEffect, useState, type ReactNode } from 'react'
import { VISUAL_FAMILIES, VISUAL_LOOKS, VISUAL_MOTIONS, VISUAL_THEME, VISUAL_VARIANTS, familyRefusal, type VisualFamily, type VisualLook, type VisualMotion, type VisualVariant } from '../lib/visuals/families'
import { themeDocumentFormats } from '../lib/screenThemes'
import type { PageFormatId } from '../lib/pageFormats'
import { changeScreenVisual, findScreenVisuals, type ScreenVisual, type VisualChange } from '../lib/visuals/read'
import { Banner, Button, Modal, Spinner } from '../ui'
import { useT } from '../i18n'

/**
 * A screen's visuals: switch a visual's family or its box style, without a
 * model call.
 *
 * The content of a visual does not depend on its family (lib/visuals/
 * families.ts), so every family that can draw it is one attribute away —
 * written at offsets the parser vouched for (`lib/visuals/read.ts`), the
 * caller owning `previousCode` so "Revert" undoes it. The families the
 * generation proposed come first; the ones that cannot draw this content are
 * shown greyed with the reason, never hidden: a person who expected a chart
 * learns that the text gave no figures.
 *
 * The thumbnails are glyphs of each family's shape, not renders of the
 * content: the canvas behind the dialog shows the real thing the moment a
 * family is picked.
 */

const G = 'stroke-current'

/** A small drawing of what each family looks like, in currentColor. */
export function FamilyGlyph({ family, className }: { family: VisualFamily; className?: string }) {
  const box = (x: number, y: number, w: number, h: number, k: number | string, r = 2) => (
    <rect key={k} x={x} y={y} width={w} height={h} rx={r} className={`${G} fill-current`} fillOpacity={0.18} strokeWidth={1.5} />
  )
  const dot = (x: number, y: number, r: number, k: number | string) => <circle key={k} cx={x} cy={y} r={r} className="fill-current" />
  const line = (d: string, k: number | string) => <path key={k} d={d} className={G} fill="none" strokeWidth={1.5} strokeLinecap="round" />
  const shapes: Record<VisualFamily, ReactNode[]> = {
    steps: [0, 1, 2].flatMap((i) => [dot(8 + i * 16, 9, 3.5, `d${i}`), box(2 + i * 16, 16, 12, 14, `b${i}`)]).concat([line('M13 9h6', 'a'), line('M29 9h6', 'b')]),
    cycle: [box(17, 2, 14, 8, 0), box(34, 18, 12, 8, 1), box(17, 30, 14, 8, 2), box(2, 18, 12, 8, 3), line('M33 8c5 2 7 5 7 9', 'a'), line('M40 27c-2 4-5 6-8 7', 'b'), line('M16 34c-5-1-8-4-9-7', 'c'), line('M7 17c1-4 4-7 9-9', 'd')],
    timeline: [line('M2 20h44', 'a'), ...[0, 1, 2, 3].flatMap((i) => [dot(7 + i * 11.3, 20, 2.5, `d${i}`), box(2 + i * 11.3, i % 2 ? 25 : 4, 10, 11, `b${i}`)])],
    funnel: [box(2, 3, 44, 9, 0), box(8, 15, 32, 9, 1), box(14, 27, 20, 9, 2)],
    pyramid: [box(16, 3, 16, 9, 0), box(9, 15, 30, 9, 1), box(2, 27, 44, 9, 2)],
    comparison: [box(2, 2, 20, 8, 0, 1), box(26, 2, 20, 8, 1, 1), box(2, 13, 20, 6, 2, 1), box(26, 13, 20, 6, 3, 1), box(2, 22, 20, 6, 4, 1), box(26, 22, 20, 6, 5, 1), box(2, 31, 20, 6, 6, 1), box(26, 31, 20, 6, 7, 1)],
    'pros-cons': [box(2, 2, 20, 8, 0, 1), box(26, 2, 20, 8, 1, 1), line('M5 17h4M7 15v4M5 26h4M7 24v4', 'p'), line('M29 17h4M29 26h4', 'm'), line('M12 17h8M12 26h8M36 17h8M36 26h8', 'l')],
    matrix: [box(8, 2, 18, 16, 0), box(28, 2, 18, 16, 1), box(8, 20, 18, 16, 2), box(28, 20, 18, 16, 3), line('M4 36V3', 'y')],
    hub: [dot(24, 20, 7, 'c'), box(17, 1, 14, 7, 0), box(36, 16, 11, 8, 1), box(17, 32, 14, 7, 2), box(1, 16, 11, 8, 3), line('M24 13V9M31 20h5M24 27v5M17 20h-5', 'l')],
    mindmap: [box(17, 16, 14, 8, 'c', 4), box(2, 3, 10, 9, 0), box(2, 28, 10, 9, 1), box(36, 3, 10, 9, 2), box(36, 28, 10, 9, 3), line('M17 20C12 20 15 7 12 7M17 20C12 20 15 32 12 32M31 20C36 20 33 7 36 7M31 20C36 20 33 32 36 32', 'l')],
    flow: [box(2, 15, 11, 10, 0, 5), box(19, 4, 11, 10, 1), box(19, 26, 11, 10, 2), box(35, 15, 11, 10, 3, 5), line('M13 18l6-7M13 22l6 7M30 9l5 8M30 31l5-8', 'l')],
    stats: [box(2, 6, 13, 28, 0), box(18, 6, 13, 28, 1), box(34, 6, 12, 28, 2), line('M5 16h7M21 16h7M37 16h6', 'v')],
    bars: [line('M2 4v32', 'a'), box(4, 6, 38, 6, 0, 3), box(4, 17, 26, 6, 1, 3), box(4, 28, 16, 6, 2, 3)],
    checklist: [0, 1, 2].flatMap((i) => [dot(6, 8 + i * 12, 3.5, `d${i}`), line(`M14 ${8 + i * 12}h30`, `l${i}`)]),
    venn: [<circle key="a" cx={18} cy={20} r={12} className={`${G} fill-current`} fillOpacity={0.15} strokeWidth={1.5} />, <circle key="b" cx={30} cy={20} r={12} className={`${G} fill-current`} fillOpacity={0.15} strokeWidth={1.5} />],
    swot: [box(2, 2, 21, 17, 0), box(25, 2, 21, 17, 1), box(2, 21, 21, 17, 2), box(25, 21, 21, 17, 3), line('M6 8h8M29 8h8M6 27h8M29 27h8', 'k')],
    'before-after': [box(2, 6, 17, 28, 0), box(29, 6, 17, 28, 1), line('M21 20h6', 'a'), line('M25 17l3 3-3 3', 'h')],
    tree: [box(17, 2, 14, 8, 'r', 4), line('M24 10v5M8 15h32M8 15v4M24 15v4M40 15v4', 'l'), box(2, 19, 12, 7, 0), box(18, 19, 12, 7, 1), box(34, 19, 12, 7, 2), box(4, 29, 10, 6, 3), box(20, 29, 10, 6, 4)],
    onion: [<circle key="o" cx={16} cy={20} r={14} className={`${G} fill-current`} fillOpacity={0.12} strokeWidth={1.5} />, <circle key="m" cx={16} cy={20} r={9} className={`${G} fill-current`} fillOpacity={0.2} strokeWidth={1.5} />, <circle key="i" cx={16} cy={20} r={4} className="fill-current" />, line('M34 10h12M34 20h12M34 30h12', 'l')],
    snake: [box(2, 3, 12, 9, 0), box(18, 3, 12, 9, 1), box(34, 3, 12, 9, 2), box(34, 22, 12, 9, 3), box(18, 22, 12, 9, 4), box(2, 22, 12, 9, 5), line('M14 7h4M30 7h4M40 12v10M34 26h-4M18 26h-4', 'l')],
    staircase: [box(2, 26, 10, 12, 0), box(13, 19, 10, 19, 1), box(24, 12, 10, 26, 2), box(35, 4, 11, 34, 3)],
    converging: [box(2, 3, 14, 8, 0), box(2, 16, 14, 8, 1), box(2, 29, 14, 8, 2), box(32, 13, 14, 14, 'r'), line('M16 7c8 0 8 13 16 13M16 20h16M16 33c8 0 8-13 16-13', 'l')],
    diverging: [box(2, 13, 14, 14, 'r'), box(32, 3, 14, 8, 0), box(32, 16, 14, 8, 1), box(32, 29, 14, 8, 2), line('M16 20c8 0 8-13 16-13M16 20h16M16 20c8 0 8 13 16 13', 'l')],
    equation: [box(2, 13, 10, 14, 0), box(19, 13, 10, 14, 1), box(36, 13, 10, 14, 2), line('M13.5 20h4M15.5 18v4M30.5 18.5h4M30.5 21.5h4', 'o')],
    'decision-tree': [box(17, 2, 14, 8, 'q'), box(4, 16, 14, 8, 0), box(30, 16, 14, 8, 1), box(2, 30, 10, 7, 2, 3.5), box(14, 30, 10, 7, 3, 3.5), box(32, 30, 12, 7, 4, 3.5), line('M24 10v3H11v3M24 13h13v3M11 24v3H7v3M11 27h8v3M37 24v6', 'l')],
    'user-journey': [box(2, 2, 13, 12, 0), box(17.5, 2, 13, 12, 1), box(33, 2, 13, 12, 2), line('M8 30L24 22L40 34', 'c'), dot(8, 30, 2.5, 'a'), dot(24, 22, 2.5, 'b'), dot(40, 34, 2.5, 'd')],
    fishbone: [line('M2 20h32M8 6l6 14M20 6l6 14M8 34l6-14M20 34l6-14', 'l'), box(34, 14, 12, 12, 'h')],
    treemap: [box(2, 2, 24, 36, 0, 1), box(28, 2, 18, 20, 1, 1), box(28, 24, 9, 14, 2, 1), box(39, 24, 7, 14, 3, 1)],
    layers: [box(2, 3, 44, 9, 0), box(2, 15.5, 44, 9, 1), box(2, 28, 44, 9, 2)],
    'concept-map': [box(17, 2, 14, 8, 0), box(2, 26, 14, 8, 1), box(32, 26, 14, 8, 2), line('M20 10L11 26M28 10L37 26M16 30h16', 'l')],
    'force-field': [line('M24 2v36', 's'), box(2, 6, 14, 7, 0), box(2, 26, 14, 7, 1), box(32, 6, 14, 7, 2), box(32, 26, 14, 7, 3), line('M16 9.5h6M16 29.5h6M32 9.5h-6M32 29.5h-6', 'a')],
    'quadrant-chart': [line('M4 36V3M4 36h42M25 3v33M4 19.5h42', 'l'), dot(12, 10, 2.5, 'a'), dot(34, 12, 2.5, 'b'), dot(16, 28, 2.5, 'c'), dot(38, 30, 2.5, 'd')],
    'comparison-table': [box(2, 2, 44, 8, 0, 1), box(2, 12, 44, 7, 1, 1), box(2, 21, 44, 7, 2, 1), box(2, 30, 44, 7, 3, 1), line('M16 2v35M31 2v35', 'l')],
    radar: [<path key="g" d="M24 3L40 15L34 35H14L8 15Z" className={G} fill="none" strokeWidth={1.2} strokeOpacity={0.5} />, <path key="v" d="M24 9L35 16L30 30H17L13 17Z" className={`${G} fill-current`} fillOpacity={0.25} strokeWidth={1.5} />],
    columns: [line('M2 36h44', 'b'), box(5, 20, 7, 16, 0, 1), box(16, 10, 7, 26, 1, 1), box(27, 16, 7, 20, 2, 1), box(38, 6, 7, 30, 3, 1)],
    line: [line('M2 36h44M4 30L14 22L24 26L34 12L44 8', 'l'), dot(14, 22, 2, 'a'), dot(24, 26, 2, 'b'), dot(34, 12, 2, 'c')],
    progress: [<circle key="t" cx={12} cy={20} r={9} className={G} fill="none" strokeWidth={4} strokeOpacity={0.25} />, <path key="a" d="M12 11a9 9 0 1 1-8.5 12" className={G} fill="none" strokeWidth={4} />, <circle key="t2" cx={36} cy={20} r={9} className={G} fill="none" strokeWidth={4} strokeOpacity={0.25} />, <path key="a2" d="M36 11a9 9 0 0 1 9 9" className={G} fill="none" strokeWidth={4} />],
    pictogram: [0, 1, 2, 3, 4].flatMap((i) => [dot(6 + i * 9, 14, 3, `u${i}`), <circle key={`v${i}`} cx={6 + i * 9} cy={28} r={3} className={G} fill="none" strokeWidth={1.2} />]),
    'card-grid': [box(2, 3, 13, 15, 0), box(17.5, 3, 13, 15, 1), box(33, 3, 13, 15, 2), box(2, 22, 13, 15, 3), box(17.5, 22, 13, 15, 4), box(33, 22, 13, 15, 5)],
    gantt: [line('M12 2v36M24 2v36M36 2v36', 'g'), box(4, 6, 18, 6, 0, 3), box(16, 17, 20, 6, 1, 3), box(30, 28, 16, 6, 2, 3)],
    roadmap: [line('M2 24c8-10 14 10 22 0s14-10 22 0', 'r'), dot(8, 19, 2.5, 'a'), dot(24, 24, 2.5, 'b'), dot(40, 19, 2.5, 'c'), box(2, 4, 12, 7, 0), box(30, 4, 14, 7, 1), box(17, 30, 14, 7, 2)],
    kanban: [box(2, 2, 13, 6, 0, 1), box(17.5, 2, 13, 6, 1, 1), box(33, 2, 13, 6, 2, 1), box(2, 11, 13, 8, 3), box(2, 22, 13, 8, 4), box(17.5, 11, 13, 8, 5), box(33, 11, 13, 8, 6), box(33, 22, 13, 8, 7)],
    zigzag: [line('M24 2v36', 'a'), dot(24, 8, 2.5, 'd1'), dot(24, 20, 2.5, 'd2'), dot(24, 32, 2.5, 'd3'), box(2, 4, 18, 8, 0), box(28, 16, 18, 8, 1), box(2, 28, 18, 8, 2)],
    switchback: [line('M2 6H8C13 6 13 6 13 11V29C13 34 13 34 18 34H22C27 34 27 34 27 29V11C27 6 27 6 32 6H36C41 6 41 6 41 11V34H46', 'r'), dot(6, 3, 2.4, 'a'), dot(20, 31, 2.4, 'b'), dot(34, 3, 2.4, 'c')],
    'winding-road': [line('M2 22C10 22 10 8 17 8S24 32 31 32S38 14 46 14', 'r'), dot(17, 5, 2.6, 'a'), dot(31, 28, 2.6, 'b'), dot(43, 11, 2.6, 'c')],
    donut: [<circle key="r" cx={14} cy={20} r={10} className={G} fill="none" strokeWidth={6} strokeOpacity={0.35} />, <path key="s" d="M14 10a10 10 0 0 1 9.5 13" className={G} fill="none" strokeWidth={6} />, line('M31 13h14M31 20h12M31 27h10', 'l')],
  }
  return (
    <svg viewBox="0 0 48 40" className={className} aria-hidden="true">
      {shapes[family]}
    </svg>
  )
}

export default function ScreenVisualDialog({
  screenName,
  code,
  page,
  onChange,
  onDecline,
  onClose,
}: {
  screenName: string
  /** The screen's current source; the lists follow it. */
  code: string
  /** The screen's page, when it is a document: the sizes it can be declined in are the others. */
  page?: PageFormatId
  /** Hands the rewritten source back; the caller owns previousCode and Revert. */
  onChange: (nextCode: string) => void
  /** A copy of the screen at another size, beside it — no model. */
  onDecline?: (page: PageFormatId) => void
  onClose: () => void
}) {
  const t = useT()
  const [visuals, setVisuals] = useState<ScreenVisual[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    findScreenVisuals(code)
      .then((found) => live && setVisuals(found))
      .catch(() => live && setVisuals([]))
    return () => {
      live = false
    }
  }, [code])

  async function apply(index: number, change: VisualChange) {
    setError(null)
    const next = await changeScreenVisual(code, index, change)
    if (next == null) {
      setError(t('visuals.cannotWrite'))
      return
    }
    onChange(next)
  }

  return (
    <Modal
      title={t('visuals.title', { name: screenName })}
      onClose={onClose}
      size="lg"
      footer={
        <Button variant="primary" onClick={onClose}>
          {t('visuals.close')}
        </Button>
      }
    >
      <p className="measure text-body-sm text-ink-muted">{t('visuals.intro')}</p>
      {error && (
        <Banner tone="danger" className="mt-3">
          {error}
        </Banner>
      )}
      {visuals === null ? (
        <p className="mt-4 flex items-center gap-2 text-body-sm text-ink-faint">
          <Spinner /> {t('visuals.loading')}
        </p>
      ) : !visuals.length ? (
        <p className="mt-4 text-body-sm text-ink-faint">{t('visuals.empty')}</p>
      ) : null}

      {page && onDecline && visuals && visuals.length > 0 && (
        <section className="mt-5 border-t border-line-soft pt-4">
          <p className="kicker">{t('visuals.decline')}</p>
          <p className="mt-1 text-caption text-ink-faint">{t('visuals.declineHint')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(themeDocumentFormats(VISUAL_THEME) ?? [])
              .filter((f) => f !== page)
              .map((f) => (
                <Button key={f} size="sm" variant="ghost" onClick={() => onDecline(f)}>
                  {t(`composer.pageFormat.${f}`)}
                </Button>
              ))}
          </div>
        </section>
      )}

      {visuals?.map((v) => {
        const current = v.family
        const suggested = v.alternatives.filter((f) => f !== current)
        const order = [...(current && VISUAL_FAMILIES.includes(current as VisualFamily) ? [current as VisualFamily] : []), ...suggested]
        const others = VISUAL_FAMILIES.filter((f) => !order.includes(f))
        const tile = (f: VisualFamily) => {
          const refusal = v.doc ? familyRefusal(f, v.doc) : null
          const isCurrent = f === current
          return (
            <button
              key={f}
              type="button"
              aria-pressed={isCurrent}
              disabled={!!refusal && !isCurrent}
              title={refusal ? t(`visuals.refusal.${refusal.reason}`, { n: refusal.n }) : t(`visuals.family.${f}.desc`)}
              onClick={() => !isCurrent && void apply(v.index, { family: f })}
              className={`flex flex-col items-start gap-1 border p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                isCurrent ? 'border-accent bg-accent/10 text-accent-ink' : 'border-line-soft text-ink-muted hover:border-line hover:text-ink'
              }`}
            >
              <FamilyGlyph family={f} className="h-10 w-12" />
              <span className="text-body-sm text-ink">{t(`visuals.family.${f}`)}</span>
              <span className="text-caption text-ink-faint">
                {isCurrent ? t('visuals.current') : refusal ? t(`visuals.refusal.${refusal.reason}`, { n: refusal.n }) : t(`visuals.family.${f}.desc`)}
              </span>
            </button>
          )
        }
        return (
          <section key={v.index} className="mt-5 border-t border-line-soft pt-4 first-of-type:border-t-0">
            {visuals.length > 1 && <p className="kicker">{t('visuals.which', { n: v.index + 1 })}</p>}
            {!v.doc && <p className="mt-1 text-caption text-ink-faint">{t('visuals.unreadable')}</p>}
            {order.length > 0 && (
              <>
                <p className="kicker mt-2">{t('visuals.suggested')}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{order.map(tile)}</div>
              </>
            )}
            <p className="kicker mt-4">{t('visuals.others')}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{others.map(tile)}</div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-body-sm text-ink-muted">{t('visuals.look')}</span>
              {VISUAL_LOOKS.map((look: VisualLook) => {
                const on = (v.look ?? 'flat') === look
                return (
                  <Button key={look} variant="ghost" active={on} size="sm" aria-pressed={on} onClick={() => !on && void apply(v.index, { look })}>
                    {t(`visuals.look.${look}`)}
                  </Button>
                )
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-body-sm text-ink-muted">{t('visuals.variant')}</span>
              {VISUAL_VARIANTS.map((variant: VisualVariant) => {
                const on = (v.variant ?? 'soft') === variant
                return (
                  <Button key={variant} variant="ghost" active={on} size="sm" aria-pressed={on} onClick={() => !on && void apply(v.index, { variant })}>
                    {t(`visuals.variant.${variant}`)}
                  </Button>
                )
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-body-sm text-ink-muted">{t('visuals.motion')}</span>
              {VISUAL_MOTIONS.map((motion: VisualMotion) => {
                const on = (v.motion ?? 'none') === motion
                return (
                  <Button key={motion} variant="ghost" active={on} size="sm" aria-pressed={on} onClick={() => !on && void apply(v.index, { motion })}>
                    {t(`visuals.motion.${motion}`)}
                  </Button>
                )
              })}
            </div>
            <p className="mt-1 text-caption text-ink-faint">{t('visuals.motion.help')}</p>
          </section>
        )
      })}
    </Modal>
  )
}
