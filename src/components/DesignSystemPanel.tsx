import { useState } from 'react'
import { parseDesignSystem, type DesignToken } from '../lib/designTokens'

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * Live "Design system" frame (Lot D.2). Renders the active DESIGN.md's color
 * tokens as a style guide (palette + sample components) and lets the user click
 * any color to recolor it — which rewrites that one token in the DESIGN.md so
 * every future generation follows the change.
 */
export default function DesignSystemPanel({
  markdown,
  onRecolor,
  onClose,
  onEdit,
}: {
  markdown: string
  onRecolor: (token: DesignToken, newHex: string) => void
  onClose: () => void
  onEdit: () => void
}) {
  const ds = parseDesignSystem(markdown)
  const r = ds.roles
  const [editing, setEditing] = useState<DesignToken | null>(null)
  const [hex, setHex] = useState('')

  function selectToken(t: DesignToken) {
    setEditing(t)
    setHex(t.hex)
  }
  function apply() {
    if (editing && HEX_RE.test(hex.trim())) {
      onRecolor(editing, hex.trim())
      setEditing(null)
    }
  }

  const hasColors = ds.colors.length > 0

  return (
    <div className="absolute right-4 top-11 flex max-h-[80vh] w-80 flex-col rounded-xl border border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <span className="text-indigo-400">🎨</span> Design system
        </span>
        <div className="flex items-center gap-2">
          <button type="button" className="text-xs text-slate-400 hover:text-slate-200" onClick={onEdit} title="Open the full DESIGN.md editor">
            Edit
          </button>
          <button type="button" className="text-xs text-slate-400 hover:text-slate-200" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {!hasColors ? (
          <p className="px-1 py-6 text-center text-xs text-slate-500">
            No design system yet. Pick a style on a new project, or{' '}
            <button type="button" className="text-indigo-300 underline underline-offset-2" onClick={onEdit}>
              edit DESIGN.md
            </button>
            .
          </p>
        ) : (
          <>
            {/* Palette — click a swatch to recolor that token */}
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Palette · click to recolor</div>
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {ds.colors.map((c) => (
                <button
                  key={c.index}
                  type="button"
                  onClick={() => selectToken(c)}
                  title={`${c.label} · ${c.hex} — click to change`}
                  className={`flex items-center gap-2 rounded-lg border px-1.5 py-1 text-left transition hover:border-indigo-500 ${
                    editing?.index === c.index ? 'border-indigo-500 bg-slate-800' : 'border-slate-700 bg-slate-800/40'
                  }`}
                >
                  <span className="h-6 w-6 shrink-0 rounded-md border border-white/15" style={{ background: c.hex }} />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-medium text-slate-200">{c.label}</span>
                    <span className="block truncate font-mono text-[10px] text-slate-500">{c.hex}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* Inline recolor editor for the selected token */}
            {editing && (
              <div className="mb-3 rounded-lg border border-indigo-700/50 bg-slate-800/70 p-2">
                <div className="mb-1.5 text-[11px] text-slate-300">
                  Recolor <span className="font-medium text-indigo-200">{editing.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-7 w-7 shrink-0 rounded-md border border-white/15" style={{ background: HEX_RE.test(hex.trim()) ? hex.trim() : 'transparent' }} />
                  <input
                    autoFocus
                    className="input h-7 flex-1 px-2 font-mono text-xs"
                    placeholder="#rrggbb"
                    value={hex}
                    onChange={(e) => setHex(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); apply() }
                      if (e.key === 'Escape') setEditing(null)
                    }}
                  />
                  <button type="button" className="btn-primary px-2.5 py-1 text-xs disabled:opacity-40" disabled={!HEX_RE.test(hex.trim())} onClick={apply}>
                    Apply
                  </button>
                </div>
              </div>
            )}

            {/* Live sample rendered from the resolved roles */}
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Preview</div>
            <div className="overflow-hidden rounded-xl border border-slate-700" style={{ background: r.bg, borderRadius: ds.radius }}>
              <div className="flex flex-col gap-3 p-3">
                <div>
                  <div style={{ color: r.text, fontWeight: 800, fontSize: 18, lineHeight: 1.15 }}>The quick brown fox</div>
                  <div style={{ color: r.muted, fontSize: 12, marginTop: 2 }}>Muted supporting copy sits beneath the heading.</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" style={{ background: r.accent, color: r.accentText, borderRadius: ds.radius, padding: '6px 12px', fontSize: 12, fontWeight: 700, border: 'none' }}>
                    Primary
                  </button>
                  <button type="button" style={{ background: 'transparent', color: r.text, border: `1px solid ${r.border}`, borderRadius: ds.radius, padding: '6px 12px', fontSize: 12, fontWeight: 600 }}>
                    Secondary
                  </button>
                </div>
                <div style={{ background: r.surface, border: `1px solid ${r.border}`, borderRadius: ds.radius, padding: 10 }}>
                  <div style={{ color: r.text, fontSize: 12, fontWeight: 700 }}>Card title</div>
                  <div style={{ color: r.muted, fontSize: 11, marginTop: 2 }}>A surface panel with a border.</div>
                  <div style={{ marginTop: 8, height: 30, background: r.bg, border: `1px solid ${r.border}`, borderRadius: ds.radius, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                    <span style={{ color: r.muted, fontSize: 11 }}>Input field…</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
