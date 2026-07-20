import { useEffect, useRef, useState } from 'react'
import {
  type DesignConfig,
  STARTER_TEMPLATE,
  loadDesign,
  saveDesign,
} from '../lib/design'
import { STYLE_PRESETS, presetVariant, type ThemeMode } from '../lib/styles'

export default function DesignPanel() {
  const [design, setDesign] = useState<DesignConfig>(() => loadDesign())
  const [savedFlash, setSavedFlash] = useState(false)
  const [mode, setMode] = useState<ThemeMode>('auto')
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STYLE_PRESETS.map((s) => {
              const variant = presetVariant(s, mode)
              const isActive = design.markdown.trim() === variant.markdown.trim()
              const p = variant.preview
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setDesign((d) => ({ ...d, markdown: variant.markdown, enabled: true }))}
                  className={`overflow-hidden rounded-xl border p-0 text-left transition ${
                    isActive
                      ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                  title={`Apply "${s.name}"`}
                >
                  {/* Large mockup preview */}
                  <div
                    className="flex h-40 flex-col gap-2 p-3"
                    style={{ background: p.bg }}
                  >
                    {/* Top bar / nav */}
                    <div className="flex items-center justify-between" style={{ height: 14 }}>
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.accent }} />
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.mutedText, opacity: 0.5 }} />
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.mutedText, opacity: 0.3 }} />
                      </div>
                      <span style={{ color: p.mutedText, fontSize: 6 }}>≡</span>
                    </div>

                    {/* Hero card */}
                    <div
                      className="flex flex-col gap-1 px-2.5 py-2"
                      style={{ background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: p.radius }}
                    >
                      <span style={{ color: p.text, fontSize: 11, fontWeight: 800, lineHeight: 1.1 }}>{s.name}</span>
                      <span style={{ color: p.mutedText, fontSize: 7 }}>Subtitle text here</span>
                    </div>

                    {/* Two small cards */}
                    <div className="flex gap-1.5">
                      <div
                        className="flex flex-1 flex-col gap-1 px-2 py-1.5"
                        style={{ background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: p.radius }}
                      >
                        <span style={{ color: p.text, fontSize: 7, fontWeight: 700 }}>Stat</span>
                        <span style={{ color: p.accent, fontSize: 10, fontWeight: 800 }}>42%</span>
                      </div>
                      <div
                        className="flex flex-1 flex-col gap-1 px-2 py-1.5"
                        style={{ background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: p.radius }}
                      >
                        <span style={{ color: p.text, fontSize: 7, fontWeight: 700 }}>Rate</span>
                        <span style={{ color: p.accent, fontSize: 10, fontWeight: 800 }}>9.8</span>
                      </div>
                    </div>

                    {/* Button + swatches */}
                    <div className="mt-auto flex items-center justify-between">
                      <span
                        className="rounded px-2 py-0.5"
                        style={{ background: p.accent, color: p.accentText, fontSize: 8, fontWeight: 700, borderRadius: p.radius === '0px' ? '0' : '8px' }}
                      >
                        Action
                      </span>
                      <div className="flex gap-1">
                        {s.swatches.map((c, i) => (
                          <span key={i} className="h-3 w-3 rounded-full" style={{ background: c, border: '1px solid rgba(0,0,0,0.15)' }} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Label */}
                  <div className={`flex items-center justify-between px-3 py-2 ${isActive ? 'bg-indigo-500/10' : 'bg-slate-800/60'}`}>
                    <div>
                      <div className="text-sm font-medium text-slate-100">{s.name}</div>
                      <div className="text-[11px] text-slate-500">{s.description}</div>
                    </div>
                    {isActive && <span className="text-xs text-indigo-400">✓</span>}
                  </div>
                </button>
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
