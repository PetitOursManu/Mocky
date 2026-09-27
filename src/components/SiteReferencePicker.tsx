import { useRef } from 'react'
import { useT } from '../i18n'
import { Icon } from '../ui'
import { SITE_IMAGE_TYPES, SITE_REF_MODES, type SiteRefMode, type SiteShot } from '../lib/siteReference'

/**
 * The two pieces of the site-screenshot control, shared by both composers.
 *
 * There are two places a prompt is typed — the welcome card of an empty project
 * and the floating bar once it has screens — and the feature first shipped in
 * the second only. The first screen of a project is exactly where "reproduce
 * this site" is asked, so the control was missing from the one place it was
 * needed. State and the reader stay in ProjectView (lib/siteReference.ts for
 * the rules); these only draw it.
 */

/** Hidden file input + the image button that opens it. */
export function SiteAttachButton({
  onFiles,
  disabled,
  size = 18,
  className = '',
}: {
  onFiles: (files: File[]) => void
  disabled?: boolean
  size?: number
  className?: string
}) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={SITE_IMAGE_TYPES.join(',')}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          // Cleared so choosing the same file again still fires a change.
          e.target.value = ''
          onFiles(files)
        }}
      />
      <button
        type="button"
        className={className}
        onClick={() => input.current?.click()}
        disabled={disabled}
        aria-label={t('project.siteAttach')}
        title={t('project.siteAttachTitle')}
      >
        <Icon name="image" size={size} />
      </button>
    </>
  )
}

/** The attached screenshots, and on a new screen the choice of what they are for. */
export function SiteShotsRow({
  shots,
  reading,
  mode,
  onMode,
  onRemove,
  editing = false,
  className = '',
}: {
  shots: SiteShot[]
  reading: number
  mode: SiteRefMode
  onMode: (mode: SiteRefMode) => void
  onRemove: (id: string) => void
  /** Screens are selected: the shots are plain references and there is no intent to pick. */
  editing?: boolean
  className?: string
}) {
  const t = useT()
  if (!shots.length && reading <= 0) return null
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {shots.map((shot, i) => (
        <div
          key={shot.id}
          className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-accent/60 bg-surface"
          title={shot.name || t('project.siteShotN', { n: i + 1 })}
        >
          {/* object-top: the head of a page is what identifies it. */}
          <img src={shot.parts[0]} alt={t('project.siteShotN', { n: i + 1 })} className="h-full w-full object-cover object-top" />
          {shot.parts.length > 1 && (
            <span
              className="absolute bottom-0 left-0 rounded-tr bg-accent px-1 font-mono text-caption font-bold text-on-accent"
              title={t('project.siteShotParts', { count: shot.parts.length })}
            >
              ×{shot.parts.length}
            </span>
          )}
          {/* Visible by default, like the annotation's: hover-only is unreachable on touch. */}
          <button
            type="button"
            onClick={() => onRemove(shot.id)}
            className="absolute right-0 top-0 rounded-bl bg-ink/60 p-0.5 text-surface opacity-60 transition group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={t('project.siteRemoveN', { n: i + 1 })}
            title={t('project.siteRemove')}
          >
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}
      {reading > 0 && (
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-accent/60"
          role="status"
          aria-label={t('project.siteReading')}
        >
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/40 border-t-accent" />
        </div>
      )}
      {/* On an edit they are references for the words; the intent is a new
          screen's, because it decides which stages run. */}
      {editing ? (
        <span className="min-w-0 flex-1 text-body-sm text-ink-muted">{t('project.siteEditHint')}</span>
      ) : (
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span role="group" aria-label={t('project.siteModeLabel')} className="inline-flex w-fit overflow-hidden rounded border border-line">
            {SITE_REF_MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onMode(m)}
                aria-pressed={mode === m}
                className={`px-2 py-1 text-body-sm transition ${
                  mode === m ? 'bg-accent text-on-accent' : 'text-ink-muted hover:bg-ink/5'
                }`}
              >
                {t(m === 'reproduce' ? 'project.siteReproduce' : 'project.siteRedesign')}
              </button>
            ))}
          </span>
          <span className="text-body-sm text-ink-muted">
            {t(mode === 'reproduce' ? 'project.siteReproduceHint' : 'project.siteRedesignHint')}
          </span>
        </span>
      )}
    </div>
  )
}

/**
 * Drop handlers for a composer surface: the whole card takes a dropped
 * screenshot, not only the field — a drop aimed at "the composer" lands
 * wherever the pointer happens to be.
 */
export function siteDropHandlers(onFiles: (files: File[]) => void, setOver: (over: boolean) => void) {
  return {
    onDragOver: (e: React.DragEvent) => {
      if (!Array.from(e.dataTransfer.types).includes('Files')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setOver(true)
    },
    onDragLeave: (e: React.DragEvent) => {
      // Leaving for a child is not leaving the composer.
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
    },
    onDrop: (e: React.DragEvent) => {
      if (!e.dataTransfer.files.length) return
      e.preventDefault()
      setOver(false)
      onFiles(Array.from(e.dataTransfer.files))
    },
  }
}
