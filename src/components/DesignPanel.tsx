import { useEffect, useRef, useState } from 'react'
import {
  type DesignConfig,
  STARTER_TEMPLATE,
  loadDesign,
  saveDesign,
} from '../lib/design'
import { STYLE_PRESETS, resolveStyle, ACCENT_VARIANTS, BG_VARIANTS, type ThemeMode, type StylePreset } from '../lib/styles'
import { Icon, Segmented } from '../ui'
import { useT } from '../i18n'

export default function DesignPanel() {
  const t = useT()
  const [design, setDesign] = useState<DesignConfig>(() => loadDesign())
  const [savedFlash, setSavedFlash] = useState(false)
  const [mode, setMode] = useState<ThemeMode>('auto')
  const [accentById, setAccentById] = useState<Record<string, string>>({})
  const [bgById, setBgById] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<{ preset: StylePreset; accentId: string; bgId: string } | null>(null)

  function applyStyle(preset: StylePreset, accentId: string, bgId: string) {
    const r = resolveStyle(preset, mode, accentId, bgId)
    setDesign((d) => ({ ...d, markdown: r.markdown, enabled: true }))
  }
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    saveDesign(design)
    setSavedFlash(true)
    const t = setTimeout(() => setSavedFlash(false), 1200)
    return () => clearTimeout(t)
  }, [design])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setDesign((d) => ({ ...d, markdown: text }))
    if (fileRef.current) fileRef.current.value = ''
  }

  function download() {
    const blob = new Blob([design.markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'DESIGN.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  const chars = design.markdown.trim().length
  const active = design.enabled && chars > 0

  return (
    <div className="pb-12">
      {/* The page opens the way a section front does: kicker, serif headline,
          double rule — then the state of the document, on the same line. */}
      <div className="rule-double mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-3">
        <div>
          <div className="kicker text-accent-ink">{t('design.title')}</div>
          <h1 className="mt-1 text-h2 text-ink">DESIGN.md</h1>
        </div>
        <div className="flex items-center gap-3 pb-1 text-body-sm">
          <span
            className={`inline-flex items-center gap-1 text-ok transition-opacity ${
              savedFlash ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Icon name="check" size={14} />
            {t('design.saved')}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${
              active ? 'bg-ok/15 text-ok' : 'bg-ink/5 text-ink-muted'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {active ? t('design.active') : t('design.inactive')}
          </span>
        </div>
      </div>

      <p className="measure mb-8 text-body text-ink-muted">
        {t('design.intro1')} <code>.md</code>
        {t('design.intro2')}
      </p>

      {/* Built-in visual styles */}
      <section className="mb-10">
        <div className="section-head justify-between">
          <div className="kicker text-accent-ink">
            {t('design.styles')} <span className="text-ink-faint">({STYLE_PRESETS.length})</span>
          </div>
          <Segmented<ThemeMode>
            label={t('design.previewMode')}
            value={mode}
            onChange={(m) => {
              if (m) setMode(m)
            }}
            options={[
              { value: 'auto', label: t('design.modeAuto'), title: t('design.modeAutoHint') },
              { value: 'light', label: t('design.modeLight'), title: t('design.modeLightHint') },
              { value: 'dark', label: t('design.modeDark'), title: t('design.modeDarkHint') },
            ]}
          />
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {STYLE_PRESETS.map((s) => {
            const accentId = accentById[s.id] || ''
            const bgId = bgById[s.id] || ''
            const r = resolveStyle(s, mode, accentId, bgId)
            const isActive = design.markdown.trim() === r.markdown.trim()
            return (
              <div
                key={s.id}
                className={`overflow-hidden border transition ${
                  isActive
                    ? 'border-accent ring-1 ring-accent ring-offset-2 ring-offset-surface'
                    : 'border-line-soft hover:border-accent'
                }`}
              >
                <div className="group relative">
                  <div
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer"
                    title={t('design.applyNamed', { name: s.name })}
                    onClick={() => applyStyle(s, accentId, bgId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        applyStyle(s, accentId, bgId)
                      }
                    }}
                  >
                    <ScaledMockup p={r.preview} name={s.name} />
                  </div>
                  <button
                    type="button"
                    title={t('design.previewLarger')}
                    onClick={(e) => {
                      e.stopPropagation()
                      setPreview({ preset: s, accentId, bgId })
                    }}
                    className="absolute right-2 top-2 inline-flex items-center gap-1 bg-ink/80 px-2 py-1 text-caption text-surface opacity-0 backdrop-blur transition hover:bg-ink group-hover:opacity-100"
                  >
                    <Icon name="fit" size={12} />
                    {t('design.preview')}
                  </button>
                </div>

                <div className={`px-3 py-2.5 ${isActive ? 'bg-accent/10' : 'bg-surface'}`}>
                  <div className="flex items-center gap-1.5 text-body font-medium text-ink">
                    <span className="min-w-0 truncate">{s.name}</span>
                    {isActive && <Icon name="check" size={14} className="text-accent" />}
                  </div>
                  <div className="truncate text-caption text-ink-faint">{s.description}</div>

                  {/* Accent variants */}
                  <div className="mt-3">
                    <div className="kicker mb-1.5">{t('design.accent')}</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <AccentPill
                        color={s.preview.accent}
                        active={!accentId}
                        title={t('design.accentOriginal')}
                        onClick={() => {
                          setAccentById((m) => ({ ...m, [s.id]: '' }))
                          applyStyle(s, '', bgId)
                        }}
                      />
                      {ACCENT_VARIANTS.map((a) => (
                        <AccentPill
                          key={a.id}
                          color={a.accent}
                          active={accentId === a.id}
                          title={a.name}
                          onClick={() => {
                            setAccentById((m) => ({ ...m, [s.id]: a.id }))
                            applyStyle(s, a.id, bgId)
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Background variants */}
                  <div className="mt-2">
                    <div className="kicker mb-1.5">{t('design.background')}</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <AccentPill
                        color={s.preview.bg}
                        active={!bgId}
                        title={t('design.backgroundOriginal')}
                        onClick={() => {
                          setBgById((m) => ({ ...m, [s.id]: '' }))
                          applyStyle(s, accentId, '')
                        }}
                      />
                      {BG_VARIANTS.map((b) => (
                        <AccentPill
                          key={b.id}
                          color={b.bg}
                          active={bgId === b.id}
                          title={b.name}
                          onClick={() => {
                            setBgById((m) => ({ ...m, [s.id]: b.id }))
                            applyStyle(s, accentId, b.id)
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* The document itself, set in a column with its controls beside it —
          markdown stays at a workable measure instead of running the width of
          the screen. */}
      <section>
        <div className="section-head justify-between">
          <div className="kicker text-accent-ink">{t('design.source')}</div>
          <span className="font-mono text-body-sm text-ink-faint">
            <span className="text-accent-ink">{chars.toLocaleString()}</span> {t('design.charsUnit')}
          </span>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <textarea
            className="input min-h-[420px] resize-y font-mono text-body-sm leading-relaxed lg:col-span-2"
            placeholder={t('design.sourcePlaceholder')}
            spellCheck={false}
            value={design.markdown}
            onChange={(e) => setDesign((d) => ({ ...d, markdown: e.target.value }))}
          />

          <aside className="flex flex-col gap-5">
            <div>
              <div className="kicker mb-2">{t('design.file')}</div>
              <div className="flex flex-col items-stretch gap-2">
                <button
                  type="button"
                  className="btn-ghost justify-start"
                  onClick={() => fileRef.current?.click()}
                >
                  <Icon name="upload" size={16} />
                  {t('design.load')}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".md,.markdown,text/markdown,text/plain"
                  className="hidden"
                  onChange={onFile}
                />
                <button
                  type="button"
                  className="btn-ghost justify-start"
                  onClick={() => setDesign((d) => ({ ...d, markdown: STARTER_TEMPLATE }))}
                >
                  <Icon name="copy" size={16} />
                  {t('design.useTemplate')}
                </button>
                <button
                  type="button"
                  className="btn-ghost justify-start disabled:opacity-40"
                  onClick={download}
                  disabled={chars === 0}
                >
                  <Icon name="download" size={16} />
                  {t('design.download')}
                </button>
                {chars > 0 && (
                  <button
                    type="button"
                    className="btn-ghost justify-start text-danger"
                    onClick={() => {
                      if (confirm(t('design.clearConfirm'))) setDesign((d) => ({ ...d, markdown: '' }))
                    }}
                  >
                    <Icon name="trash" size={16} />
                    {t('design.clear')}
                  </button>
                )}
              </div>
            </div>

            <div className="rule-thin" />

            <div>
              <div className="kicker mb-2">{t('design.usage')}</div>
              <label className="flex cursor-pointer items-start gap-2 text-body text-ink-muted">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-accent"
                  checked={design.enabled}
                  onChange={(e) => setDesign((d) => ({ ...d, enabled: e.target.checked }))}
                />
                {t('design.include')}
              </label>
            </div>
          </aside>
        </div>
      </section>

      {/* Larger preview modal */}
      {preview &&
        (() => {
          const s = preview.preset
          const r = resolveStyle(s, mode, preview.accentId, preview.bgId)
          return (
            <div
              className="fixed inset-0 z-modal flex items-center justify-center bg-ink/60 p-4"
              onClick={() => setPreview(null)}
            >
              <div
                className="w-full max-w-3xl overflow-hidden rounded-2xl border border-line bg-raised shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <ScaledMockup p={r.preview} name={s.name} />
                <div className="flex items-center justify-between gap-3 border-t border-line-soft p-4">
                  <div className="min-w-0">
                    <div className="kicker">{t('design.stylePreset')}</div>
                    <div className="truncate font-serif text-h3 text-ink">{s.name}</div>
                    <div className="truncate text-body-sm text-ink-faint">{s.description}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" className="btn-ghost" onClick={() => setPreview(null)}>
                      {t('common.close')}
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        applyStyle(s, preview.accentId, preview.bgId)
                        setPreview(null)
                      }}
                    >
                      {t('design.applyStyle')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
    </div>
  )
}

type PreviewCfg = StylePreset['preview']

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
function ScaledMockup({ p, name }: { p: PreviewCfg; name: string }) {
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
function PresetMockup({ p, name }: { p: PreviewCfg; name: string }) {
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

/** A small round accent-color swatch used to pick a style's accent variant. */
function AccentPill({ color, active, onClick, title }: { color: string; active: boolean; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`h-4 w-4 rounded-full border transition ${
        active
          ? 'border-ink/40 ring-2 ring-ink ring-offset-1 ring-offset-surface'
          : 'border-ink/25 hover:scale-110'
      }`}
      style={{ background: color }}
    />
  )
}
