import { useEffect, useMemo, useState } from 'react'
import {
  parseDesignSpec,
  readSectionBody,
  replaceSectionBody,
  type DesignSpec,
  type EditableSection,
} from '../lib/designSpec'
import { replaceTokenHex, type DesignToken } from '../lib/designTokens'
import { Button, Icon } from '../ui'
import { useT } from '../i18n'

/**
 * A DESIGN.md, presented as a specification sheet — and edited as one.
 *
 * The documents Mocky writes were always richer than what it showed: a Muse
 * dossier carries a concept, a type scale, a layout grammar, a motion language
 * and a list of things never to do, and the canvas displayed swatches and a
 * generic dashboard thumbnail. This renders the rest, and lets you change it.
 *
 * ── Structure borrowed, skin refused ────────────────────────────────────────
 *
 * The six-section spine, the numbered labels and the DO/DON'T split come from a
 * reference the user supplied. Its surface does not: that sheet is a dark card
 * with rounded corners, drop shadows and a teal accent, and Mocky is a paper
 * product whose every `borderRadius` step is 0 and every `boxShadow` step is
 * `none` — rules replace shadows here, on purpose.
 *
 * ── Editing edits TEXT ──────────────────────────────────────────────────────
 *
 * Every section opens as a textarea over its raw Markdown body, not as a form
 * over parsed fields. A structured editor would have to round-trip each line
 * back into the exact grammar the server emits, and would silently drop any
 * field it did not model. Editing the text keeps the document the source of
 * truth. The one exception is colour, which gets a picker because a hex is the
 * one thing nobody should have to type — and it still writes through
 * `replaceTokenHex`, i.e. as a splice into that same text.
 *
 * ── Nothing is saved until you say so ───────────────────────────────────────
 *
 * Edits accumulate in a local draft and reach the caller only through Save.
 * That matters most where this is used: a screen's recorded design is what the
 * project would adopt, and half-finished edits leaking into it as you type
 * would change what "Reprendre ce design" means mid-sentence.
 */

export type SpecDensity = 'compact' | 'full'

export default function DesignSpecSheet({
  markdown,
  title,
  density = 'full',
  columns = 1,
  onSave,
  saveLabel,
  className = '',
}: {
  /** The document, and the only input. Never a screen's code. */
  markdown: string
  /** The wordmark for section 01. The caller resolves the fallback chain. */
  title?: string
  /** 'compact' drops prose and long lists — for the 294px side panel. */
  density?: SpecDensity
  columns?: 1 | 2 | 3
  /** Present ⇒ the sheet is editable and shows a Save button. */
  onSave?: (next: string) => void
  /** Overrides the Save button's wording where saving also does something else. */
  saveLabel?: string
  className?: string
}) {
  const t = useT()
  const compact = density === 'compact'
  const editable = !!onSave

  const [draft, setDraft] = useState(markdown)
  /** Which section is open as a textarea, if any. */
  const [openSection, setOpenSection] = useState<EditableSection | null>(null)
  const [editingColor, setEditingColor] = useState<DesignToken | null>(null)
  const [hexDraft, setHexDraft] = useState('')

  // A new document replaces the draft outright: this component is reused across
  // screens, and carrying one screen's unsaved edits onto the next would write
  // them into the wrong file.
  useEffect(() => {
    setDraft(markdown)
    setOpenSection(null)
    setEditingColor(null)
  }, [markdown])

  const spec = useMemo(() => parseDesignSpec(draft), [draft])
  const dirty = draft !== markdown

  function editSection(section: EditableSection, body: string) {
    setDraft((d) => replaceSectionBody(d, section, body))
  }

  function commitColor(hex: string) {
    if (!editingColor) return
    if (!/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(hex)) return
    setDraft((d) => replaceTokenHex(d, editingColor, hex))
    setEditingColor(null)
  }

  const sections = buildSections(spec, compact)
  if (!sections.length && !editable) return null

  const grid = columns === 3 ? 'md:grid-cols-2 xl:grid-cols-3' : columns === 2 ? 'md:grid-cols-2' : ''

  const ctx: Ctx = {
    compact,
    t,
    editable,
    draft,
    openSection,
    setOpenSection,
    editSection,
    editingColor,
    setEditingColor,
    hexDraft,
    setHexDraft,
    commitColor,
  }

  return (
    <div className={className}>
      <div className={`${compact ? 'mb-4' : 'rule-double mb-7 pb-3'} flex flex-wrap items-baseline justify-between gap-3`}>
        <h3 className={`masthead min-w-0 truncate ${compact ? 'text-h3' : 'text-h2'} text-ink`}>
          {title || spec.productName || (spec.kind === 'dossier' ? t('muse.dossier') : 'DESIGN.md')}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          <span className="kicker text-ink-faint">
            {spec.kind === 'dossier' ? t('muse.dossier') : 'DESIGN.md'}
          </span>
          {editable && (
            <>
              {dirty && (
                <Button variant="ghost" onClick={() => setDraft(markdown)}>
                  {t('design.spec.revert')}
                </Button>
              )}
              <Button variant="primary" disabled={!dirty} onClick={() => onSave!(draft)}>
                <Icon name="check" size={16} />
                {saveLabel || t('design.spec.save')}
              </Button>
            </>
          )}
        </div>
      </div>

      {editable && dirty && (
        <p className="mb-4 border-l-2 border-warn bg-warn/10 px-3 py-2 text-body-sm text-warn">
          {t('design.spec.unsaved')}
        </p>
      )}

      <div className={`grid gap-x-8 gap-y-7 ${grid}`}>
        {sections.map((id, i) => (
          <Section
            key={id}
            n={i + 1}
            label={t(`design.spec.${id}`)}
            /* Prose reads across, not down. The concept and the rules are the
               two sections made of sentences, and squeezed into a third of the
               width they became ribbons four words across with a scrollbar
               taller than the screen. They take the full row; the token
               sections, which are lists of short pairs, stay in columns. */
            wide={id === 'overview' || id === 'rules'}
            edit={sectionEditor(id, ctx)}
            ctx={ctx}
          >
            {renderSection(id, spec, ctx)}
          </Section>
        ))}
      </div>
    </div>
  )
}

/** The section a header's pencil opens, when that section is editable at all. */
function sectionEditor(id: SectionId, ctx: Ctx): EditableSection | null {
  if (!ctx.editable) return null
  // 'rules' is absent on purpose: it holds TWO documents sections, grammar and
  // forbidden, and renders a pencil beside each of its columns instead.
  const map: Partial<Record<SectionId, EditableSection>> = {
    overview: 'concept',
    typography: 'typography',
  }
  const section = map[id]
  if (!section) return null
  // Only offer the pencil when the document actually has that section: a
  // derived DESIGN.md has no `## Concept`, and replaceSectionBody would return
  // the document unchanged, so the control would do nothing.
  return readSectionBody(ctx.draft, section) === null ? null : section
}

/**
 * The control that opens a section for editing.
 *
 * It carries its word. A bare pencil glyph in `text-ink-faint` was there from
 * the start and went unseen — reasonably: at 14px, in the palest ink on the
 * scale, beside a rule that draws the eye along the row, nothing says it can be
 * clicked. A bordered chip with the verb on it does, and it costs one word.
 */
function EditToggle({ open, onClick, ctx }: { open: boolean; onClick: () => void; ctx: Ctx }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={ctx.t(open ? 'design.spec.done' : 'design.spec.edit')}
      className={`flex shrink-0 items-center gap-1 border px-1.5 py-0.5 text-caption font-medium transition ${
        open
          ? 'border-accent bg-accent/10 text-accent-ink'
          : 'border-line text-ink-muted hover:border-accent hover:text-accent-ink'
      }`}
    >
      <Icon name={open ? 'check' : 'pencil'} size={12} />
      {ctx.t(open ? 'design.spec.doneShort' : 'design.spec.editShort')}
    </button>
  )
}

/** Which sections this document can honestly fill, in order. */
function buildSections(spec: DesignSpec, compact: boolean): SectionId[] {
  const out: SectionId[] = []
  if (spec.concept || spec.references.length) out.push('overview')
  if (spec.colors.length) out.push('colors')
  if (spec.typography.display || spec.typography.body || spec.typography.scale) out.push('typography')
  // Only when the document actually said what its surfaces are. Three slate
  // defaults printed as a system would be fiction under the user's own name.
  if (spec.stated.bg || spec.stated.surface || spec.stated.border) out.push('surfaces')
  if (spec.colors.length && !compact) out.push('components')
  if (spec.dos.length || spec.donts.length) out.push('rules')
  return out
}

type SectionId = 'overview' | 'colors' | 'typography' | 'surfaces' | 'components' | 'rules'

interface Ctx {
  compact: boolean
  t: (k: string, v?: Record<string, string | number>) => string
  editable: boolean
  draft: string
  openSection: EditableSection | null
  setOpenSection: (s: EditableSection | null) => void
  editSection: (s: EditableSection, body: string) => void
  editingColor: DesignToken | null
  setEditingColor: (t: DesignToken | null) => void
  hexDraft: string
  setHexDraft: (v: string) => void
  commitColor: (hex: string) => void
}

/**
 * One numbered section.
 *
 * The number is monospace and tabular — Mocky reserves the mono face for
 * figures — and zero-padded so `02` sits under `12`. The word beside it is a
 * `.kicker`, the sans idiom the rest of the app uses for section labels.
 */
function Section({
  n,
  label,
  wide,
  edit,
  ctx,
  children,
}: {
  n: number
  label: string
  wide?: boolean
  edit: EditableSection | null
  ctx: Ctx
  children: React.ReactNode
}) {
  const open = !!edit && ctx.openSection === edit
  return (
    <section className={`min-w-0 ${wide ? 'md:col-span-2 xl:col-span-3' : ''}`}>
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-mono text-caption tabular-nums text-ink-faint">
          {String(n).padStart(2, '0')}
        </span>
        <span className="kicker text-accent-ink">{label}</span>
        <span className="h-px flex-1 bg-accent/40" />
        {edit && <EditToggle open={open} onClick={() => ctx.setOpenSection(open ? null : edit)} ctx={ctx} />}
      </div>
      {children}
    </section>
  )
}

/** The raw-body textarea a pencil opens. */
function SectionTextarea({ section, ctx }: { section: EditableSection; ctx: Ctx }) {
  const body = readSectionBody(ctx.draft, section) ?? ''
  return (
    <div className="mb-3">
      <textarea
        value={body}
        onChange={(e) => ctx.editSection(section, e.target.value)}
        spellCheck={false}
        rows={Math.min(16, Math.max(4, body.split('\n').length + 1))}
        className="input w-full resize-y font-mono text-body-sm leading-5"
      />
      <p className="mt-1 text-caption text-ink-faint">{ctx.t('design.spec.editHint')}</p>
    </div>
  )
}

function renderSection(id: SectionId, spec: DesignSpec, ctx: Ctx): React.ReactNode {
  const section = sectionEditor(id, ctx)
  if (section && ctx.openSection === section) return <SectionTextarea section={section} ctx={ctx} />
  switch (id) {
    case 'overview':
      return <Overview spec={spec} ctx={ctx} />
    case 'colors':
      return <Colors spec={spec} ctx={ctx} />
    case 'typography':
      return <Typography spec={spec} ctx={ctx} />
    case 'surfaces':
      return <Surfaces spec={spec} ctx={ctx} />
    case 'components':
      return <Components spec={spec} ctx={ctx} />
    case 'rules':
      return <Rules spec={spec} ctx={ctx} />
  }
}

function Overview({ spec, ctx }: { spec: DesignSpec; ctx: Ctx }) {
  return (
    <div>
      {spec.concept && (
        <p className={`measure ${ctx.compact ? 'text-body-sm' : 'text-lead'} text-ink-muted`}>
          {spec.concept}
        </p>
      )}
      {!ctx.compact && spec.references.length > 0 && (
        <ul className="mt-4 space-y-1">
          {spec.references.map((r) => (
            <li key={r} className="truncate font-mono text-caption text-ink-faint" title={r}>
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Colors({ spec, ctx }: { spec: DesignSpec; ctx: Ctx }) {
  const { t, editable, editingColor, setEditingColor, hexDraft, setHexDraft, commitColor } = ctx
  return (
    <ul className={`grid gap-x-4 gap-y-2 ${ctx.compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
      {spec.colors.map((c) => {
        // Identity is the SOURCE OFFSET, not the array position: two tokens can
        // share a hex, and the offset is what replaceTokenHex splices at.
        const isEditing = editingColor?.index === c.index
        const chip = (
          <>
            <span className="block h-6 w-6 shrink-0 border border-ink/20" style={{ background: c.hex }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body-sm text-ink">{c.label}</span>
              <span className="block font-mono text-caption uppercase text-ink-faint">
                {c.hex}
                {c.role !== 'other' && ` · ${t(`design.spec.role.${c.role}`)}`}
              </span>
            </span>
          </>
        )
        return (
          <li key={c.index}>
            {editable ? (
              <button
                type="button"
                onClick={() => {
                  if (isEditing) return setEditingColor(null)
                  setEditingColor(c)
                  setHexDraft(c.hex)
                }}
                title={t('design.spec.recolour')}
                className={`flex w-full items-center gap-2 border p-1 text-left transition ${
                  isEditing ? 'border-accent bg-accent/10' : 'border-transparent hover:border-line'
                }`}
              >
                {chip}
              </button>
            ) : (
              <span className="flex items-center gap-2 p-1">{chip}</span>
            )}

            {isEditing && (
              <div className="mt-1 flex items-center gap-2 border border-accent/40 bg-raised p-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(hexDraft) ? hexDraft : c.hex}
                  onChange={(e) => setHexDraft(e.target.value)}
                  className="h-7 w-9 shrink-0 cursor-pointer border border-line bg-transparent p-0"
                  aria-label={t('design.spec.recolour')}
                />
                <input
                  value={hexDraft}
                  onChange={(e) => setHexDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitColor(hexDraft)
                    if (e.key === 'Escape') setEditingColor(null)
                  }}
                  spellCheck={false}
                  className="input min-w-0 flex-1 font-mono text-caption uppercase"
                />
                <button
                  type="button"
                  className="btn-primary shrink-0 px-2 py-1 text-caption"
                  onClick={() => commitColor(hexDraft)}
                >
                  {t('design.spec.apply')}
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The specimen says DECLARED, not rendered.
 *
 * Nothing in Mocky loads a webfont, so drawing "Aa" in the document's display
 * face is not possible — the browser would substitute, and a specimen that
 * silently shows the wrong typeface is worse than none.
 */
function Typography({ spec, ctx }: { spec: DesignSpec; ctx: Ctx }) {
  const { display, body, scale } = spec.typography
  return (
    <div className="flex items-start gap-4">
      <span className={`font-serif leading-none text-ink ${ctx.compact ? 'text-h2' : 'text-display'}`} aria-hidden>
        Aa
      </span>
      <div className="min-w-0 flex-1">
        {display && (
          <p className="truncate text-body text-ink" title={display}>
            {display}
          </p>
        )}
        {body && (
          <p className="truncate text-body-sm text-ink-muted" title={body}>
            {body}
          </p>
        )}
        <p className="mt-1 font-mono text-caption text-ink-faint">{ctx.t('design.spec.declared')}</p>
        {!ctx.compact && scale && <p className="measure mt-2 text-body-sm text-ink-muted">{scale}</p>}
      </div>
    </div>
  )
}

/**
 * What separates a page from a card from a rule.
 *
 * This replaces the reference's ELEVATION section, which has no source: neither
 * a dossier nor a derived DESIGN.md records shadows, and the only way to get
 * one would be to grep the generated component for `shadow-*`, which invariant
 * I1 forbids. Any role the document did NOT state is marked, so an invented
 * default cannot pass for a decision.
 */
function Surfaces({ spec, ctx }: { spec: DesignSpec; ctx: Ctx }) {
  const r = spec.system.roles
  const rows: Array<[string, string, boolean]> = [
    ['bg', r.bg, spec.stated.bg],
    ['surface', r.surface, spec.stated.surface],
    ['border', r.border, spec.stated.border],
  ]
  return (
    <div>
      <div className="border border-line-soft" style={{ background: r.bg }}>
        <div
          className="m-3 border p-3"
          style={{ background: r.surface, borderColor: r.border, borderRadius: spec.system.radius }}
        >
          <span className="block h-1.5 w-16" style={{ background: r.text, opacity: 0.75 }} />
          <span className="mt-2 block h-1.5 w-24" style={{ background: r.muted, opacity: 0.6 }} />
        </div>
      </div>
      <ul className="mt-3 space-y-1">
        {rows.map(([key, hex, stated]) => (
          <li key={key} className="flex items-baseline justify-between gap-3">
            <span className="text-body-sm text-ink-muted">{ctx.t(`design.spec.role.${key}`)}</span>
            <span className={`font-mono text-caption uppercase ${stated ? 'text-ink-faint' : 'text-ink-faint/60'}`}>
              {hex}
              {!stated && ` · ${ctx.t('design.spec.defaulted')}`}
            </span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3">
          <span className="text-body-sm text-ink-muted">{ctx.t('design.spec.radius')}</span>
          <span className="font-mono text-caption text-ink-faint">{spec.system.radius}</span>
        </li>
      </ul>
    </div>
  )
}

/** The tokens, made into the things they build. */
function Components({ spec, ctx }: { spec: DesignSpec; ctx: Ctx }) {
  const r = spec.system.roles
  const radius = spec.system.radius
  return (
    <div className="flex flex-wrap items-center gap-2 border border-line-soft p-4" style={{ background: r.bg }}>
      <span
        className="px-3 py-1.5 text-body-sm font-medium"
        style={{ background: r.accent, color: r.accentText, borderRadius: radius }}
      >
        {ctx.t('design.spec.sampleAction')}
      </span>
      <span
        className="border px-3 py-1.5 text-body-sm"
        style={{ borderColor: r.border, color: r.text, borderRadius: radius }}
      >
        {ctx.t('design.spec.sampleSecondary')}
      </span>
      <span
        className="px-3 py-1 text-caption"
        style={{ background: r.accent, color: r.accentText, borderRadius: 9999 }}
      >
        {ctx.t('design.spec.samplePill')}
      </span>
      <span
        className="border px-3 py-2 text-body-sm"
        style={{ background: r.surface, borderColor: r.border, color: r.muted, borderRadius: radius }}
      >
        {ctx.t('design.spec.sampleCard')}
      </span>
    </div>
  )
}

/**
 * Two columns, and never a synthesised one.
 *
 * A derived DESIGN.md has no forbidden list — the extraction prompt does not
 * ask for one — so it renders a single column labelled for what it actually is.
 * Negating the DOs to manufacture DON'Ts produces confident nonsense.
 */
function Rules({ spec, ctx }: { spec: DesignSpec; ctx: Ctx }) {
  const limit = ctx.compact ? 4 : Infinity
  const dos = spec.dos.slice(0, limit)
  const donts = spec.donts.slice(0, limit)
  const doLabel = spec.dosSource === 'layout-grammar' ? ctx.t('design.spec.grammar') : ctx.t('design.spec.patterns')

  return (
    <div className={`grid gap-x-8 gap-y-4 ${dos.length && donts.length && !ctx.compact ? 'md:grid-cols-2' : ''}`}>
      {dos.length > 0 && (
        <div className="border-l-2 border-ok pl-3">
          <div className="mb-1.5 flex items-baseline gap-2">
            <p className="kicker text-ok">{doLabel}</p>
            {ctx.editable && readSectionBody(ctx.draft, 'grammar') !== null && (
              <EditToggle
                open={ctx.openSection === 'grammar'}
                onClick={() => ctx.setOpenSection(ctx.openSection === 'grammar' ? null : 'grammar')}
                ctx={ctx}
              />
            )}
          </div>
          {ctx.openSection === 'grammar' ? (
            <SectionTextarea section="grammar" ctx={ctx} />
          ) : (
            <ul className="measure space-y-1">
              {dos.map((d) => (
                <li key={d} className="text-body-sm text-ink-muted">
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {donts.length > 0 && (
        <div className="border-l-2 border-danger pl-3">
          <div className="mb-1.5 flex items-baseline gap-2">
            <p className="kicker text-danger">{ctx.t('design.spec.forbidden')}</p>
            {ctx.editable && readSectionBody(ctx.draft, 'forbidden') !== null && (
              <EditToggle
                open={ctx.openSection === 'forbidden'}
                onClick={() => ctx.setOpenSection(ctx.openSection === 'forbidden' ? null : 'forbidden')}
                ctx={ctx}
              />
            )}
          </div>
          {ctx.openSection === 'forbidden' ? (
            <SectionTextarea section="forbidden" ctx={ctx} />
          ) : (
            <ul className="measure space-y-1">
              {donts.map((d) => (
                <li key={d} className="text-body-sm text-ink-muted">
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
