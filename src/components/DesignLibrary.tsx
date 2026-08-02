import { useMemo, useState } from 'react'
import {
  listDesigns,
  applyDesignEntry,
  deleteDesignEntry,
  renameDesignEntry,
  saveDesignToLibrary,
  findDesignByMarkdown,
  type DesignEntry,
} from '../lib/design'
import { parseDesignSystem } from '../lib/designTokens'
import { ScaledMockup, type PreviewCfg } from './DesignMockup'
import { Banner, Button, Field, Icon, IconButton, Input, Modal } from '../ui'
import { useT } from '../i18n'

/**
 * Turn a design document into the preview config the mockup renderer wants.
 *
 * Shared by every place that shows a saved system, so a card in the library and
 * a card on the canvas cannot drift apart. Returns null on a document the token
 * parser cannot make sense of — the caller shows the name alone rather than a
 * misleading picture.
 */
export function previewFromMarkdown(markdown: string): PreviewCfg | null {
  if (!markdown.trim()) return null
  try {
    const ds = parseDesignSystem(markdown)
    const r = ds.roles
    return {
      bg: r.bg,
      cardBg: r.surface,
      cardBorder: r.border,
      text: r.text,
      mutedText: r.muted,
      accent: r.accent,
      accentText: r.accentText,
      radius: ds.radius,
    }
  } catch {
    return null
  }
}

/**
 * Name a design system before keeping it.
 *
 * Asked for rather than generated, because the name is the whole point of the
 * library: "Design (3)" tells you nothing six weeks later, and a system you
 * cannot identify is one you will never reuse.
 */
export function SaveDesignDialog({
  markdown,
  suggestedName = '',
  origin = 'manual',
  onClose,
  onSaved,
}: {
  markdown: string
  suggestedName?: string
  origin?: DesignEntry['origin']
  onClose: () => void
  onSaved: (entry: DesignEntry) => void
}) {
  const t = useT()
  const [name, setName] = useState(suggestedName)
  const [error, setError] = useState<string | null>(null)
  const preview = useMemo(() => previewFromMarkdown(markdown), [markdown])
  const already = useMemo(() => findDesignByMarkdown(markdown), [markdown])

  function save() {
    try {
      onSaved(saveDesignToLibrary(name, markdown, origin))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Modal title={t('design.saveAs')} onClose={onClose} size="sm">
      {error && (
        <div className="mb-3">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}
      {already && (
        <div className="mb-3">
          <Banner tone="warn">{t('design.alreadySaved', { name: already.name })}</Banner>
        </div>
      )}
      {preview && (
        <div className="mb-4 overflow-hidden border border-line-soft">
          <ScaledMockup p={preview} name={name || t('design.untitled')} />
        </div>
      )}
      <Field label={t('design.name')}>
        {(p) => (
          <Input
            {...p}
            autoFocus
            value={name}
            placeholder={t('design.namePlaceholder')}
            onChange={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
            }}
          />
        )}
      </Field>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" onClick={save}>
          {t('common.save')}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
      </div>
    </Modal>
  )
}

/** The saved systems, as cards you can apply, rename or delete. */
export function DesignLibrarySection({
  version,
  currentMarkdown,
  onChanged,
  onApplied,
}: {
  /** Bumped by the parent to force a re-read after it changed the store. */
  version: number
  currentMarkdown: string
  onChanged: () => void
  onApplied: () => void
}) {
  const t = useT()
  const entries = useMemo(() => listDesigns(), [version])
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  if (entries.length === 0) return null

  return (
    <section className="mb-10">
      <div className="section-head">
        <div className="kicker text-accent-ink">
          {t('design.library')} <span className="text-ink-faint">({entries.length})</span>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {entries.map((e) => {
          const preview = previewFromMarkdown(e.markdown)
          const isCurrent = e.markdown.trim() === currentMarkdown.trim()
          return (
            <div
              key={e.id}
              className={`overflow-hidden border transition ${
                isCurrent ? 'border-accent ring-1 ring-accent ring-offset-2 ring-offset-surface' : 'border-line-soft'
              }`}
            >
              {preview ? (
                <ScaledMockup p={preview} name={e.name} />
              ) : (
                <div className="flex h-24 items-center justify-center text-body-sm text-ink-faint">
                  {t('design.noPreview')}
                </div>
              )}
              <div className="px-3 py-2.5">
                {renaming === e.id ? (
                  <input
                    className="input"
                    autoFocus
                    value={draft}
                    onChange={(ev) => setDraft(ev.currentTarget.value)}
                    onBlur={() => {
                      renameDesignEntry(e.id, draft)
                      setRenaming(null)
                      onChanged()
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') ev.currentTarget.blur()
                      if (ev.key === 'Escape') setRenaming(null)
                    }}
                  />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">{e.name}</span>
                    {isCurrent && <Icon name="check" size={14} className="text-accent" />}
                  </div>
                )}
                <div className="mt-0.5 text-caption text-ink-faint">
                  {e.origin === 'screen'
                    ? t('design.originScreen')
                    : e.origin === 'muse'
                      ? t('design.originMuse')
                      : t('design.originManual')}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isCurrent}
                    onClick={() => {
                      applyDesignEntry(e.id)
                      onApplied()
                    }}
                  >
                    {t('design.use')}
                  </Button>
                  <IconButton
                    label={t('design.rename')}
                    variant="quiet"
                    onClick={() => {
                      setDraft(e.name)
                      setRenaming(e.id)
                    }}
                  >
                    <Icon name="pencil" size={14} />
                  </IconButton>
                  <IconButton
                    label={t('design.deleteEntry')}
                    variant="quiet"
                    onClick={() => {
                      if (confirm(t('design.deleteEntryConfirm', { name: e.name }))) {
                        deleteDesignEntry(e.id)
                        onChanged()
                      }
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </IconButton>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
