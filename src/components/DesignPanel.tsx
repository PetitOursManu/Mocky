import { useEffect, useRef, useState } from 'react'
import {
  type DesignConfig,
  STARTER_TEMPLATE,
  loadDesign,
  saveDesign,
} from '../lib/design'
import { STYLE_PRESETS, resolveStyle, ACCENT_VARIANTS, type ThemeMode, type StylePreset } from '../lib/styles'

export default function DesignPanel() {
  const [design, setDesign] = useState<DesignConfig>(() => loadDesign())
  const [savedFlash, setSavedFlash] = useState(false)
  const [mode, setMode] = useState<ThemeMode>('auto')
  const [accentById, setAccentById] = useState<Record<string, string>>({})

  function applyStyle(preset: StylePreset, accentId: string) {
    const r = resolveStyle(preset, mode, accentId)
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
    <div className="mx-auto max-w-3xl">
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {STYLE_PRESETS.map((s) => {
              const accentId = accentById[s.id] || ''
              const r = resolveStyle(s, mode, accentId)
              const isActive = design.markdown.trim() === r.markdown.trim()
              return (
                <div
                  key={s.id}
                  className={`overflow-hidden rounded-xl border transition ${
                    isActive ? 'border-indigo-500 ring-2 ring-indigo-500/50' : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer"
                    title={`Apply "${s.name}"`}
                    onClick={() => applyStyle(s, accentId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        applyStyle(s, accentId)
                      }
                    }}
                  >
                    <PresetMockup p={r.preview} name={s.name} />
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
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="mr-0.5 text-[10px] uppercase tracking-wide text-slate-500">Accent</span>
                      <AccentPill
                        color={s.preview.accent}
                        active={!accentId}
                        title="Original accent"
                        onClick={() => {
                          setAccentById((m) => ({ ...m, [s.id]: '' }))
                          applyStyle(s, '')
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
                            applyStyle(s, a.id)
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

/** A realistic mini-dashboard mockup rendered in a preset's colors. */
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
    <div className="flex h-52 gap-2 p-2.5" style={{ background: bg }}>
      {/* Sidebar */}
      <div className="flex w-11 shrink-0 flex-col items-center gap-2 p-2" style={panel}>
        <span className="h-3.5 w-3.5 rounded-md" style={{ background: p.accent }} />
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-2 w-full rounded"
            style={{ background: i === 0 ? withAlpha(p.accent, 0.9) : p.mutedText, opacity: i === 0 ? 1 : 0.35 }}
          />
        ))}
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Top bar */}
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-[10px] font-bold" style={{ color: p.text }}>{name}</span>
          <span className="h-4 flex-1" style={{ ...panel, borderRadius: 999 }} />
          <span className="h-4 w-4 rounded-full" style={{ background: p.accent }} />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-1.5">
          {([['Users', '76k'], ['Sales', '$3.6k'], ['Rate', '9.8']] as const).map(([label, val], i) => (
            <div key={i} className="flex flex-col gap-0.5 p-1.5" style={panel}>
              <span style={{ color: p.mutedText, fontSize: 6 }}>{label}</span>
              <span style={{ color: i === 1 ? p.accent : p.text, fontSize: 11, fontWeight: 800 }}>{val}</span>
            </div>
          ))}
        </div>

        {/* Chart + table */}
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5">
          <div className="flex flex-col justify-end p-2" style={panel}>
            <div className="flex flex-1 items-end gap-1">
              {[40, 70, 30, 90, 55, 78].map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{ height: `${h}%`, background: i % 2 ? withAlpha(p.accent, 0.85) : p.mutedText, opacity: i % 2 ? 1 : 0.4 }}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-center gap-1.5 p-2" style={panel}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-1">
                <span className="h-1.5 rounded" style={{ background: p.mutedText, opacity: 0.4, width: `${52 - i * 8}%` }} />
                <span
                  className="rounded px-1"
                  style={{ background: withAlpha(p.accent, 0.25), color: p.accent, fontSize: 6, fontWeight: 700 }}
                >
                  {['Live', 'New', 'Draft'][i]}
                </span>
              </div>
            ))}
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
