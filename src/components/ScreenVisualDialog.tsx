import { useEffect, useState, type ReactNode } from 'react'
import { VISUAL_FAMILIES, VISUAL_VARIANTS, familyRefusal, type VisualFamily, type VisualVariant } from '../lib/visuals/families'
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
  onChange,
  onClose,
}: {
  screenName: string
  /** The screen's current source; the lists follow it. */
  code: string
  /** Hands the rewritten source back; the caller owns previousCode and Revert. */
  onChange: (nextCode: string) => void
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
          </section>
        )
      })}
    </Modal>
  )
}
