import { useEffect, useRef, useState } from 'react'
import {
  type DesignConfig,
  STARTER_TEMPLATE,
  loadDesign,
  saveDesign,
} from '../lib/design'
import { STYLE_PRESETS, resolveStyle, ACCENT_VARIANTS, BG_VARIANTS, type ThemeMode, type StylePreset } from '../lib/styles'
import { Button, Icon, Segmented } from '../ui'
import { ScaledMockup } from './DesignMockup'
import { DesignLibrarySection, SaveDesignDialog } from './DesignLibrary'
import { useT } from '../i18n'

export default function DesignPanel({
  /**
   * True when this is shown over a project rather than as its own page.
   *
   * Reaching DESIGN.md used to mean leaving the project: the route change
   * unmounted ProjectView, which threw away the canvas position, the selection
   * and the composer's contents — and cancels any generation in flight. For a
   * document you consult while writing a prompt, that is the wrong shape. The
   * dialog supplies its own title, so the section front is dropped here and the
   * status moves into one compact row.
   */
  embedded = false,
}: {
  embedded?: boolean
} = {}) {
  const t = useT()
  const [design, setDesign] = useState<DesignConfig>(() => loadDesign())
  const [savedFlash, setSavedFlash] = useState(false)
  const [mode, setMode] = useState<ThemeMode>('auto')
  const [accentById, setAccentById] = useState<Record<string, string>>({})
  const [bgById, setBgById] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<{ preset: StylePreset; accentId: string; bgId: string } | null>(null)
  /** Bumped whenever the saved-systems store changes, to force a re-read. */
  const [libraryVersion, setLibraryVersion] = useState(0)
  const [saveOpen, setSaveOpen] = useState(false)

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
    <div className={embedded ? '' : 'pb-12'}>
      {/* The page opens the way a section front does: kicker, serif headline,
          double rule — then the state of the document, on the same line.
          Embedded, the dialog already carries the title, so only the state
          survives — on a thin rule instead of a double one. */}
      {embedded ? (
        <div className="rule-thin mb-5 flex items-center justify-end gap-3 pb-2 text-body-sm">
          <span
            className={`inline-flex items-center gap-1 text-ok transition-opacity ${
              savedFlash ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Icon name="check" size={14} />
            {t('design.saved')}
          </span>
          <span className={`kicker ${active ? 'text-ok' : 'text-ink-muted'}`}>
            {active ? `● ${t('design.active')}` : `○ ${t('design.inactive')}`}
          </span>
        </div>
      ) : (
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
            <span className={`kicker ${active ? 'text-ok' : 'text-ink-muted'}`}>
              {active ? `● ${t('design.active')}` : `○ ${t('design.inactive')}`}
            </span>
          </div>
        </div>
      )}

      {/*
        The current document, and what you can do with it, at the TOP.
        Turning a design off used to mean scrolling past every preset to a
        button at the bottom of the page — a long way to go to undo something
        you just did. "Stop applying" and "throw away" sit next to each other
        here because they are different intentions that were sharing one word.
      */}
      {chars > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 border border-line-soft bg-ink/5 px-3 py-2.5">
          <span className="kicker mr-1 text-ink-muted">{t('design.current')}</span>
          <Button variant="ghost" size="sm" onClick={() => setDesign((d) => ({ ...d, enabled: !d.enabled }))}>
            <Icon name={active ? 'close' : 'check'} size={14} />
            {active ? t('design.turnOff') : t('design.turnOn')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSaveOpen(true)}>
            <Icon name="plus" size={14} />
            {t('design.saveAs')}
          </Button>
          <Button
            variant="quiet"
            size="sm"
            className="text-danger"
            onClick={() => {
              if (confirm(t('design.clearConfirm'))) setDesign((d) => ({ ...d, markdown: '' }))
            }}
          >
            <Icon name="trash" size={14} />
            {t('design.clear')}
          </Button>
        </div>
      )}

      {/* Saved systems, before the built-in presets: what you kept comes first. */}
      <DesignLibrarySection
        version={libraryVersion}
        currentMarkdown={design.markdown}
        onChanged={() => setLibraryVersion((v) => v + 1)}
        onApplied={() => {
          setDesign(loadDesign())
          setLibraryVersion((v) => v + 1)
        }}
      />

      {!embedded && (
        <p className="measure mb-8 text-body text-ink-muted">
          {t('design.intro1')} <code>.md</code>
          {t('design.intro2')}
        </p>
      )}

      {saveOpen && (
        <SaveDesignDialog
          markdown={design.markdown}
          onClose={() => setSaveOpen(false)}
          onSaved={() => {
            setSaveOpen(false)
            setLibraryVersion((v) => v + 1)
          }}
        />
      )}

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
                {/* Only after "derive from this screen" replaced the document
                    wholesale. Hand edits never set it, so this button appears
                    exactly when there is something to take back. */}
                {design.previousMarkdown && (
                  <button
                    type="button"
                    className="btn-ghost justify-start"
                    onClick={() =>
                      setDesign((d) => ({
                        ...d,
                        markdown: d.previousMarkdown ?? '',
                        // Swap, so the button undoes itself rather than
                        // stranding the version it just replaced.
                        previousMarkdown: d.markdown,
                      }))
                    }
                  >
                    <Icon name="undo" size={16} />
                    {t('design.restorePrevious')}
                  </button>
                )}
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
