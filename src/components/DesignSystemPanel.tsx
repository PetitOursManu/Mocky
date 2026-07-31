import { useState } from 'react'
import { parseDesignSystem, type DesignToken } from '../lib/designTokens'
import { Button, Icon, IconButton } from '../ui'
import { useT } from '../i18n'

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
  const t = useT()
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
    <div className="absolute right-4 top-11 flex max-h-[80vh] w-80 flex-col rounded-xl border border-line bg-raised shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-line-soft px-3 py-1.5">
        <span className="flex min-w-0 items-center gap-2">
          <Icon name="image" size={16} className="text-accent" />
          <span className="kicker truncate">{t('design.title')}</span>
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="quiet" size="sm" onClick={onEdit} title={t('design.editHint')}>
            {t('design.edit')}
          </Button>
          <IconButton label={t('common.close')} variant="quiet" onClick={onClose}>
            <Icon name="close" size={16} />
          </IconButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {!hasColors ? (
          <p className="px-1 py-6 text-center text-body-sm text-ink-faint">
            {t('design.empty')}{' '}
            <button type="button" className="text-accent-ink underline underline-offset-2" onClick={onEdit}>
              {t('design.editDesignMd')}
            </button>
            .
          </p>
        ) : (
          <>
            {/* Palette — click a swatch to recolor that token */}
            <div className="kicker mb-1.5 text-accent-ink">{t('design.palette')}</div>
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {ds.colors.map((c) => (
                <button
                  key={c.index}
                  type="button"
                  onClick={() => selectToken(c)}
                  title={t('design.swatchTitle', { label: c.label, hex: c.hex })}
                  className={`flex items-center gap-2 rounded-lg border px-1.5 py-1 text-left transition hover:border-accent ${
                    editing?.index === c.index ? 'border-accent bg-accent/10' : 'border-line-soft'
                  }`}
                >
                  <span className="h-6 w-6 shrink-0 rounded-md border border-ink/20" style={{ background: c.hex }} />
                  <span className="min-w-0">
                    <span className="block truncate text-caption font-medium text-ink">{c.label}</span>
                    <span className="block truncate font-mono text-caption text-ink-faint">{c.hex}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* Inline recolor editor for the selected token */}
            {editing && (
              <div className="mb-3 rounded-lg border border-line bg-ink/5 p-2">
                <div className="mb-1.5 text-caption text-ink-muted">
                  {t('design.recolor')} <span className="font-medium text-ink">{editing.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-7 w-7 shrink-0 rounded-md border border-ink/20" style={{ background: HEX_RE.test(hex.trim()) ? hex.trim() : 'transparent' }} />
                  <input
                    autoFocus
                    className="input h-7 flex-1 px-2 font-mono text-body-sm"
                    placeholder="#rrggbb"
                    value={hex}
                    onChange={(e) => setHex(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); apply() }
                      if (e.key === 'Escape') setEditing(null)
                    }}
                  />
                  <button type="button" className="btn-primary px-2.5 py-1 disabled:opacity-40" disabled={!HEX_RE.test(hex.trim())} onClick={apply}>
                    {t('design.apply')}
                  </button>
                </div>
              </div>
            )}

            {/* Live sample rendered from the resolved roles */}
            <div className="rule-thin mb-3" />
            <div className="kicker mb-1.5 text-accent-ink">{t('design.preview')}</div>
            <div className="overflow-hidden border border-line-soft" style={{ background: r.bg, borderRadius: ds.radius }}>
              <div className="flex flex-col gap-3 p-3">
                <div>
                  <div style={{ color: r.text, fontWeight: 800, fontSize: 18, lineHeight: 1.15 }}>{t('design.sampleHeading')}</div>
                  <div style={{ color: r.muted, fontSize: 12, marginTop: 2 }}>{t('design.sampleMuted')}</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" style={{ background: r.accent, color: r.accentText, borderRadius: ds.radius, padding: '6px 12px', fontSize: 12, fontWeight: 700, border: 'none' }}>
                    {t('design.samplePrimary')}
                  </button>
                  <button type="button" style={{ background: 'transparent', color: r.text, border: `1px solid ${r.border}`, borderRadius: ds.radius, padding: '6px 12px', fontSize: 12, fontWeight: 600 }}>
                    {t('design.sampleSecondary')}
                  </button>
                </div>
                <div style={{ background: r.surface, border: `1px solid ${r.border}`, borderRadius: ds.radius, padding: 10 }}>
                  <div style={{ color: r.text, fontSize: 12, fontWeight: 700 }}>{t('design.sampleCardTitle')}</div>
                  <div style={{ color: r.muted, fontSize: 11, marginTop: 2 }}>{t('design.sampleCardBody')}</div>
                  <div style={{ marginTop: 8, height: 30, background: r.bg, border: `1px solid ${r.border}`, borderRadius: ds.radius, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                    <span style={{ color: r.muted, fontSize: 11 }}>{t('design.sampleInput')}</span>
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
