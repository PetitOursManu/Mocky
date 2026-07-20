import { useEffect, useRef, useState } from 'react'
import {
  type DesignConfig,
  STARTER_TEMPLATE,
  loadDesign,
  saveDesign,
} from '../lib/design'
import { STYLE_PRESETS, resolveStyle, ACCENT_VARIANTS, BG_VARIANTS, type ThemeMode, type StylePreset } from '../lib/styles'

export default function DesignPanel() {
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
    <div className="mx-auto max-w-4xl">
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">DESIGN.md</h2>
          <span
            className={`text-xs text-emerald-400 transition-opacity ${savedFlash ? 'opacity-100' : 'opacity-0'}`}
          >
            Saved ✓
          </span>
        </div>
        <p className="mb-4 text-sm text-slate-400">
          A portable design system. When enabled, its full content is prepended to every generation
          prompt so screens stay on-brand. Plain Markdown — paste it, load a <code>.md</code> file,
          start from the template, or pick a ready-made style below.
        </p>

        {/* Built-in visual styles */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Style presets ({STYLE_PRESETS.length})</div>
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900/60 p-0.5 text-xs" title="Preview & apply styles in light or dark mode">
              {([
                ['auto', 'Auto'],
                ['light', '☀ Light'],
                ['dark', '☾ Dark'],
              ] as [ThemeMode, string][]).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-md px-2.5 py-1 font-medium transition ${
                    mode === m ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-slate-700/60'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5">
            {STYLE_PRESETS.map((s) => {
              const accentId = accentById[s.id] || ''
              const bgId = bgById[s.id] || ''
              const r = resolveStyle(s, mode, accentId, bgId)
              const isActive = design.markdown.trim() === r.markdown.trim()
              return (
                <div
                  key={s.id}
                  className={`overflow-hidden rounded-xl border transition ${
                    isActive ? 'border-indigo-500 ring-2 ring-indigo-500/50' : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="group relative">
                    <div
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer"
                      title={`Apply "${s.name}"`}
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
                      title="Preview larger"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPreview({ preset: s, accentId, bgId })
                      }}
                      className="absolute right-2 top-2 rounded-md bg-black/45 px-2 py-1 text-xs text-white/90 opacity-0 backdrop-blur transition hover:bg-black/70 group-hover:opacity-100"
                    >
                      ⤢ Preview
                    </button>
                  </div>

                  <div className={`px-3 py-2.5 ${isActive ? 'bg-indigo-500/10' : 'bg-slate-800/60'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-100">
                          <span className="truncate">{s.name}</span>
                          {isActive && <span className="shrink-0 text-indigo-400">✓</span>}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">{s.description}</div>
                      </div>
                    </div>
                    {/* Accent variants */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="mr-0.5 w-14 shrink-0 text-[10px] uppercase tracking-wide text-slate-500">Accent</span>
                      <AccentPill
                        color={s.preview.accent}
                        active={!accentId}
                        title="Original accent"
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
                    {/* Background variants */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="mr-0.5 w-14 shrink-0 text-[10px] uppercase tracking-wide text-slate-500">Background</span>
                      <AccentPill
                        color={s.preview.bg}
                        active={!bgId}
                        title="Original background"
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
              )
            })}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost text-sm" onClick={() => fileRef.current?.click()}>
            Load .md file
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
            className="btn-ghost text-sm"
            onClick={() => setDesign((d) => ({ ...d, markdown: STARTER_TEMPLATE }))}
          >
            Use starter template
          </button>
          <button
            type="button"
            className="btn-ghost text-sm disabled:opacity-40"
            onClick={download}
            disabled={chars === 0}
          >
            Download
          </button>
          {chars > 0 && (
            <button
              type="button"
              className="btn-ghost text-sm text-rose-300"
              onClick={() => {
                if (confirm('Clear the DESIGN.md content?')) setDesign((d) => ({ ...d, markdown: '' }))
              }}
            >
              Clear
            </button>
          )}
        </div>

        <textarea
          className="input min-h-[360px] resize-y font-mono text-xs leading-relaxed"
          placeholder="# Design System&#10;&#10;## Color tokens&#10;- Primary: #4f46e5&#10;..."
          spellCheck={false}
          value={design.markdown}
          onChange={(e) => setDesign((d) => ({ ...d, markdown: e.target.value }))}
        />

        <div className="mt-3 flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-indigo-500"
              checked={design.enabled}
              onChange={(e) => setDesign((d) => ({ ...d, enabled: e.target.checked }))}
            />
            Include in generations
          </label>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{chars.toLocaleString()} chars</span>
            <span
              className={`rounded-full px-2 py-0.5 ${
                active
                  ? 'bg-emerald-900/40 text-emerald-300'
                  : 'bg-slate-700/60 text-slate-400'
              }`}
            >
              {active ? '● Active' : '○ Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Larger preview modal */}
      {preview &&
        (() => {
          const s = preview.preset
          const r = resolveStyle(s, mode, preview.accentId, preview.bgId)
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              onClick={() => setPreview(null)}
            >
              <div
                className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <ScaledMockup p={r.preview} name={s.name} />
                <div className="flex items-center justify-between gap-3 border-t border-slate-700 p-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-100">{s.name}</div>
                    <div className="truncate text-xs text-slate-500">{s.description}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" className="btn-ghost text-sm" onClick={() => setPreview(null)}>
                      Close
                    </button>
                    <button
                      type="button"
                      className="btn-primary text-sm"
                      onClick={() => {
                        applyStyle(s, preview.accentId, preview.bgId)
                        setPreview(null)
                      }}
                    >
                      Apply this style
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
          {([['Users', '76k'], ['Sales', '$3.6k'], ['Rate', '9.8']] as const).map(([label, val], i) => (
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
                    {['Live', 'New', 'Draft'][i]}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="transition hover:-translate-y-px hover:brightness-110"
              style={{ background: p.accent, color: p.accentText, fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: p.radius, border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}
            >
              Get started →
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
      className={`h-4 w-4 rounded-full border transition ${
        active
          ? 'border-white/50 ring-2 ring-white/70 ring-offset-1 ring-offset-slate-800'
          : 'border-black/25 hover:scale-110'
      }`}
      style={{ background: color }}
    />
  )
}
