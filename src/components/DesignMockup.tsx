import { useEffect, useRef, useState } from 'react'
import type { StylePreset } from '../lib/styles'
import { useT } from '../i18n'

/**
 * The little dashboard that shows what a design system LOOKS like.
 *
 * It lived inside DesignPanel, where only the style picker could reach it. It
 * is the clearest answer Mocky has to "what does this DESIGN.md actually
 * produce?", so it now stands on its own and the canvas can show it beside a
 * screen without importing a 500-line settings page.
 */

export type PreviewCfg = StylePreset['preview']

/** #rrggbb(aa) → rgba(); passes through non-hex colors (rgba/gradient) unchanged. */
function withAlpha(color: string, a: number): string {
  const h = color.replace('#', '')
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(h)) return color
  const n = parseInt(h.slice(0, 6), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/**
 * Renders PresetMockup (a fixed 460×300 canvas) scaled to fit its container
 * width. Scaling the whole thing keeps text crisp and proportional at any
 * size — small in the grid, large in the preview modal.
 */
export function ScaledMockup({ p, name }: { p: PreviewCfg; name: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  const DW = 460
  const DH = 300
  const scale = w ? w / DW : 0.76
  return (
    <div ref={ref} style={{ width: '100%', height: DH * scale, overflow: 'hidden' }}>
      <div style={{ width: DW, height: DH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <PresetMockup p={p} name={name} />
      </div>
    </div>
  )
}

/** A realistic mini-dashboard mockup on a fixed 460×300 canvas (see ScaledMockup). */
export function PresetMockup({ p, name }: { p: PreviewCfg; name: string }) {
  const t = useT()
  const glass = !!p.glass
  const bg = glass
    ? `radial-gradient(circle at 16% 10%, ${withAlpha(p.accent, 0.55)}, transparent 55%), radial-gradient(circle at 88% 92%, rgba(139,92,246,0.4), transparent 55%), ${p.bg}`
    : p.bg
  const panel: React.CSSProperties = {
    background: p.cardBg,
    border: `1px solid ${p.cardBorder}`,
    borderRadius: p.radius,
    backdropFilter: glass ? 'blur(6px)' : undefined,
    WebkitBackdropFilter: glass ? 'blur(6px)' : undefined,
  }
  return (
    <div style={{ width: 460, height: 300, background: bg, display: 'flex', gap: 12, padding: 14, boxSizing: 'border-box' }}>
      {/* Sidebar */}
      <div style={{ ...panel, width: 76, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 9, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ width: 22, height: 22, borderRadius: 7, background: p.accent, flexShrink: 0 }} />
          <span style={{ height: 7, flex: 1, borderRadius: 4, background: p.text, opacity: 0.85 }} />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="transition-transform hover:translate-x-1"
            style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 3, background: i === 0 ? p.accent : p.mutedText, opacity: i === 0 ? 1 : 0.4, flexShrink: 0 }} />
            <span style={{ height: 6, flex: 1, borderRadius: 3, background: i === 0 ? withAlpha(p.accent, 0.8) : p.mutedText, opacity: i === 0 ? 1 : 0.3 }} />
          </div>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: p.text, fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap' }}>{name}</span>
          <span style={{ ...panel, flex: 1, height: 26, borderRadius: 999 }} />
          <span
            className="transition hover:brightness-125"
            style={{ width: 26, height: 26, borderRadius: 999, background: p.accent, cursor: 'pointer', flexShrink: 0 }}
          />
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {([[t('design.mockUsers'), '76k'], [t('design.mockSales'), '$3.6k'], [t('design.mockRate'), '9.8']] as const).map(([label, val], i) => (
            <div key={i} style={{ ...panel, padding: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ color: p.mutedText, fontSize: 9 }}>{label}</span>
              <span style={{ color: i === 1 ? p.accent : p.text, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{val}</span>
            </div>
          ))}
        </div>

        {/* Chart + right panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1, minHeight: 0 }}>
          <div style={{ ...panel, padding: 10, display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            {[45, 72, 33, 92, 58, 80].map((h, i) => (
              <span
                key={i}
                className="transition-all hover:opacity-100"
                style={{ flex: 1, height: `${h}%`, borderRadius: 4, background: i % 2 ? withAlpha(p.accent, 0.9) : p.mutedText, opacity: i % 2 ? 1 : 0.4 }}
              />
            ))}
          </div>
          <div style={{ ...panel, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ height: 6, borderRadius: 3, background: p.mutedText, opacity: 0.4, width: `${55 - i * 8}%` }} />
                  <span style={{ background: withAlpha(p.accent, 0.22), color: p.accent, fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 6 }}>
                    {[t('design.mockLive'), t('design.mockNew'), t('design.mockDraft')][i]}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="transition hover:-translate-y-px hover:brightness-110"
              style={{ background: p.accent, color: p.accentText, fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: p.radius, border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}
            >
              {t('design.mockCta')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

