import type { CSSProperties, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { parseDesignSpec } from '../lib/designSpec'
import { Segmented } from '../ui'
import { useT } from '../i18n'
import { findFontIn, registerSpecimens, specimenStack } from '../lib/fonts'

/**
 * The two ways to read a recorded design: as the page it would make, first,
 * and as the specification it is — where it is also edited and saved.
 */
export function DesignViews({ markdown, title, spec }: { markdown: string; title: string; spec: ReactNode }) {
  const t = useT()
  const [view, setView] = useState<'web' | 'spec'>('web')
  return (
    <div>
      <div className="mb-4">
        <Segmented
          label={t('design.web.views')}
          value={view}
          // Never "no view": clicking the active tab keeps it.
          onChange={(v) => v && setView(v)}
          options={[
            { value: 'web', label: t('design.web.tabWeb') },
            { value: 'spec', label: t('design.web.tabSpec') },
          ]}
        />
      </div>
      {view === 'web' ? <DesignWebPreview markdown={markdown} title={title} /> : spec}
    </div>
  )
}

/**
 * A DESIGN.md, shown as the website it describes.
 *
 * The canvas card already drew a design as a thumbnail — a tiny dashboard in
 * the document's colours — and "View larger" opened a specification sheet: six
 * numbered sections of swatches and bullets. Correct, and not what the person
 * who asked for this wanted to judge. The question at that moment is "what does
 * a page in this design look like", so the window opens on one: a browser
 * frame, a header, a hero, cards, a form, a footer — every surface painted with
 * a role the document resolves, every piece of text set in the face it declares.
 *
 * What is drawn is LABELLED. Each part names the token it is painted with, and
 * the strip under the page lists them with their hex and whether the document
 * stated them or Mocky filled them in — a fallback slate passed off as "the
 * surface" of a cream editorial design would be a false claim (designSpec.ts).
 *
 * The words come from the document where it has them: the product's name, the
 * concept line as the headline, the first layout rules as the cards. A design
 * with none of that gets neutral placeholder copy, never invented claims.
 *
 * A declared face that Mocky serves (lib/fonts) is drawn in that face — the
 * one the screens are really set in. Any other renders when the machine has
 * it and falls back to a system face otherwise; the legend says which face was
 * ASKED for, which is what the document says.
 */
export default function DesignWebPreview({ markdown, title }: { markdown: string; title: string }) {
  const t = useT()
  const spec = useMemo(() => parseDesignSpec(markdown), [markdown])
  const r = spec.system.roles
  const radius = spec.system.radius
  const display = useServedStack(spec.typography.display)
  const body = useServedStack(spec.typography.body)
  const name = spec.productName || title
  const host = `${slug(name) || 'design'}.example`

  const headline = clip(spec.concept, 90) || t('design.web.headline', { name })
  const cards = spec.dos.slice(0, 3).map((d) => clip(d, 120))
  while (cards.length < 3) cards.push('')

  const button: CSSProperties = {
    background: r.accent,
    color: r.accentText,
    borderRadius: radius,
    fontFamily: body,
    fontWeight: 600,
    border: 'none',
    padding: '10px 18px',
    fontSize: 15,
  }
  const ghost: CSSProperties = {
    background: 'transparent',
    color: r.text,
    borderRadius: radius,
    border: `1px solid ${r.border}`,
    fontFamily: body,
    fontWeight: 600,
    padding: '10px 18px',
    fontSize: 15,
  }
  const card: CSSProperties = {
    background: r.surface,
    border: `1px solid ${r.border}`,
    borderRadius: radius,
  }

  return (
    <div className="space-y-4">
      {/* The browser around the page: it is what makes the page read as a
          website rather than as one more swatch card. */}
      <div className="overflow-hidden border border-line-soft shadow-sm" role="img" aria-label={t('design.web.aria', { name })}>
        <div className="flex items-center gap-2 border-b border-line-soft bg-raised px-3 py-2">
          <span className="flex gap-1.5" aria-hidden>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
              <span key={c} className="block h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            ))}
          </span>
          <span className="mx-auto w-full max-w-md truncate border border-line-soft bg-surface px-3 py-0.5 text-center font-mono text-caption text-ink-muted">
            {host}
          </span>
        </div>

        <div style={{ background: r.bg, color: r.text, fontFamily: body }}>
          {/* Header */}

          <header className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4" style={{ borderBottom: `1px solid ${r.border}` }}>
            <span className="flex items-center gap-2">
              <span className="block h-7 w-7 shrink-0" style={{ background: r.accent, borderRadius: radius }} />
              <span style={{ fontFamily: display, fontWeight: 700, fontSize: 19 }}>{name}</span>
            </span>
            <nav className="flex flex-wrap gap-5" style={{ color: r.muted, fontSize: 14 }}>
              <span>{t('design.web.nav1')}</span>
              <span>{t('design.web.nav2')}</span>
              <span>{t('design.web.nav3')}</span>
            </nav>
            <span className="ml-auto">
              <span
                style={{
                  ...button,
                  padding: '8px 14px',
                  fontSize: 14,
                  display: 'inline-block',
                }}
              >
                {t('design.web.cta')}
              </span>
            </span>
          </header>

          {/* Hero */}
          <div className="grid items-center gap-8 px-6 py-10 md:grid-cols-[1.2fr_1fr]">
            <div>
              <span
                className="inline-block"
                style={{
                  color: r.accent,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                {t('design.web.kicker')}
              </span>
              <h1
                style={{
                  fontFamily: display,
                  fontSize: 'clamp(28px, 3.4vw, 44px)',
                  lineHeight: 1.1,
                  fontWeight: 700,
                  margin: '12px 0 0',
                }}
              >
                {headline}
              </h1>
              <p className="mt-4 max-w-prose" style={{ color: r.muted, fontSize: 16, lineHeight: 1.6 }}>
                {clip(spec.typography.scale, 160) || t('design.web.lede')}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span style={{ ...button, display: 'inline-block' }}>{t('design.web.primary')}</span>
                <span style={{ ...ghost, display: 'inline-block' }}>{t('design.web.secondary')}</span>
              </div>
            </div>
            <div className="p-5" style={card}>
              <div className="flex items-center justify-between" style={{ fontSize: 13, color: r.muted }}>
                <span>{t('design.web.chart')}</span>
                <span style={{ color: r.accent, fontWeight: 700 }}>+24%</span>
              </div>
              <div className="mt-4 flex h-28 items-end gap-2" aria-hidden>
                {[38, 56, 44, 70, 62, 86, 74].map((h, i) => (
                  <span
                    key={i}
                    className="block flex-1"
                    style={{
                      height: `${h}%`,
                      background: r.accent,
                      opacity: i === 5 ? 1 : 0.35,
                      borderRadius: `${radius} ${radius} 0 0`,
                    }}
                  />
                ))}
              </div>
              <div className="mt-4 flex gap-2" style={{ fontSize: 12 }}>
                <span
                  className="px-2 py-0.5"
                  style={{
                    background: r.accent,
                    color: r.accentText,
                    borderRadius: 999,
                  }}
                >
                  {t('design.web.badge')}
                </span>
                <span
                  className="px-2 py-0.5"
                  style={{
                    border: `1px solid ${r.border}`,
                    color: r.muted,
                    borderRadius: 999,
                  }}
                >
                  {t('design.web.badge2')}
                </span>
              </div>
            </div>
          </div>

          {/* Cards: the document's own rules, when it states some. */}
          <div className="grid gap-4 px-6 pb-10 md:grid-cols-3">
            {cards.map((text, i) => (
              <div key={i} className="p-5" style={card}>
                <span
                  className="flex h-9 w-9 items-center justify-center"
                  style={{
                    background: r.accent,
                    color: r.accentText,
                    borderRadius: radius,
                    fontFamily: display,
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3
                  style={{
                    fontFamily: display,
                    fontWeight: 700,
                    fontSize: 17,
                    margin: '14px 0 6px',
                  }}
                >
                  {t(text ? 'design.web.rule' : 'design.web.feature', {
                    n: i + 1,
                  })}
                </h3>
                {text ? (
                  <p
                    style={{
                      color: r.muted,
                      fontSize: 14,
                      lineHeight: 1.55,
                      margin: 0,
                    }}
                  >
                    {text}
                  </p>
                ) : (
                  <div className="space-y-2 pt-1" aria-hidden>
                    <span
                      className="block h-2 w-full"
                      style={{
                        background: r.muted,
                        opacity: 0.25,
                        borderRadius: 4,
                      }}
                    />
                    <span
                      className="block h-2 w-4/5"
                      style={{
                        background: r.muted,
                        opacity: 0.25,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* A form: inputs are where a radius and a border are most visible. */}
          <div className="px-6 pb-10">
            <div className="flex flex-wrap items-end gap-3 p-5" style={card}>
              <label className="min-w-[12rem] flex-1" style={{ fontSize: 13, color: r.muted }}>
                {t('design.web.email')}
                <span
                  className="mt-1.5 block px-3 py-2.5"
                  style={{
                    background: r.bg,
                    border: `1px solid ${r.border}`,
                    borderRadius: radius,
                    color: r.muted,
                    fontSize: 15,
                  }}
                >
                  {t('design.web.emailSample')}
                </span>
              </label>
              <span style={{ ...button, display: 'inline-block' }}>{t('design.web.subscribe')}</span>
            </div>
          </div>

          {/* Footer */}
          <footer
            className="flex flex-wrap items-center justify-between gap-3 px-6 py-5"
            style={{
              borderTop: `1px solid ${r.border}`,
              color: r.muted,
              fontSize: 13,
            }}
          >
            <span style={{ fontFamily: display, fontWeight: 700, color: r.text }}>{name}</span>
            <span>© 2026 · {t('design.web.footer')}</span>
          </footer>
        </div>
      </div>

      {/* What the page above was painted with. */}
      <Legend spec={spec} />
    </div>
  )
}

function Legend({ spec }: { spec: ReturnType<typeof parseDesignSpec> }) {
  const t = useT()
  const roles = spec.system.roles
  const order = ['bg', 'surface', 'text', 'muted', 'accent', 'accentText', 'border'] as const
  return (
    <div className="grid gap-4 border-t border-line-soft pt-4 md:grid-cols-[2fr_1fr]">
      <div>
        <span className="kicker text-ink-muted">{t('design.web.colors')}</span>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
          {order.map((role) => (
            <li key={role} className="flex items-center gap-2 text-body-sm">
              <span className="block h-6 w-6 shrink-0 border border-line-soft" style={{ background: roles[role] }} />
              <span className="min-w-0">
                <span className="block text-ink">{t(`design.spec.role.${role}`)}</span>
                <span className="block font-mono text-caption text-ink-muted">
                  {roles[role]}
                  {!spec.stated[role] && ` · ${t('design.web.inferred')}`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2 text-body-sm">
        <span className="kicker text-ink-muted">{t('design.web.type')}</span>
        <p className="text-ink">
          <span className="text-ink-muted">{t('design.web.display')} · </span>
          {spec.typography.display || <em className="text-ink-faint">{t('design.web.unstated')}</em>}
        </p>
        <p className="text-ink">
          <span className="text-ink-muted">{t('design.web.body')} · </span>
          {spec.typography.body || <em className="text-ink-faint">{t('design.web.unstated')}</em>}
        </p>
        <p className="text-ink">
          <span className="text-ink-muted">{t('design.web.radius')} · </span>
          <span className="font-mono">{spec.system.radius}</span>
        </p>
      </div>
    </div>
  )
}

/**
 * A declared face, with a fallback of its own class. Only the family NAME is
 * kept — the same charset `theme.ts` allows — so a document cannot write CSS
 * into a style attribute through its typography line.
 */
/**
 * The stack a declared face is drawn in here: the catalogue's own copy when
 * there is one, registered in this document under its specimen alias so
 * Mocky's own interface — which asks for `Inter` by name — is left alone.
 */
function useServedStack(declared: string | undefined): string {
  const served = useMemo(() => findFontIn(declared), [declared])
  useMemo(() => served && registerSpecimens([served]), [served])
  return served ? specimenStack(served) : fontStack(declared)
}

export function fontStack(declared: string | undefined): string {
  const fallback = 'ui-sans-serif, system-ui, sans-serif'
  const family = (declared || '').split(/,|\(|\s[—–-]\s/)[0].trim()
  if (!family || !/^[\p{L}\p{N} -]{1,48}$/u.test(family)) return fallback
  const serif =
    /serif|garamond|playfair|lora|merriweather|georgia|times|didot|bodoni|fraunces|caslon/i.test(family) && !/sans/i.test(family)
  const mono = /mono|code|courier/i.test(family)
  return `"${family}", ${mono ? 'ui-monospace, monospace' : serif ? 'ui-serif, Georgia, serif' : fallback}`
}

function clip(s: string | null | undefined, max: number): string {
  const text = (s || '')
    .replace(/\s+/g, ' ')
    .replace(/[*_`#>]/g, '')
    .trim()
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}
