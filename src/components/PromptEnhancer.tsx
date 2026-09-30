import { Button, Icon, IconButton } from '../ui'
import { useT } from '../i18n'
import type { PromptEnhancer } from '../lib/usePromptEnhancer'

/**
 * The composer's "Améliorer le prompt" control: the sparkle, the Stop it turns
 * into while the brief streams in, and the Undo that follows a rewrite.
 *
 * Three buttons that never coexist in a confusing way: Stop replaces the
 * sparkle for the length of the call (the same place, so the pointer that
 * started it can stop it), and Undo appears beside the sparkle only while the
 * field still holds the rewrite untouched — see `usePromptEnhancer`.
 *
 * `compact` is the floating bar, where the field needs every pixel of width:
 * icon-only, with the words in the accessible name and the tooltip. Welcome has
 * a row of labelled controls, so there it says what it does.
 */
export function PromptEnhanceButton({
  enhancer,
  onStart,
  disabled = false,
  disabledReason,
  compact = false,
  className = '',
}: {
  enhancer: PromptEnhancer
  /** Called on click; the caller builds the context (format, type, direction) at that moment. */
  onStart: () => void
  /** Nothing to improve, or something else is running. */
  disabled?: boolean
  /**
   * Why the button is off for a reason the person cannot see from the field —
   * site captures attached. Disables it on its own and replaces the tooltip, so
   * a greyed sparkle beside a full field is not a riddle.
   */
  disabledReason?: string
  compact?: boolean
  className?: string
}) {
  const t = useT()
  const running = enhancer.running
  const off = !running && (disabled || !!disabledReason)
  const title = running ? t('composer.enhanceStopTitle') : (disabledReason ?? t('composer.enhanceTitle'))
  const onClick = running ? enhancer.stop : onStart
  const icon = running ? 'close' : 'sparkle'
  const label = running ? t('composer.enhanceStop') : t('composer.enhance')

  // ONE button that changes what it says, not two that take turns. Swapping the
  // sparkle for a separate Stop unmounted the element that had the focus, so a
  // keyboard user who pressed Enter landed on <body> — with the field read-only
  // and the only way to stop the rewrite somewhere back in the tab order — and
  // again when the stream ended. Same component, same place in the tree: React
  // keeps the DOM node, and the focus stays on it.
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {compact ? (
        <IconButton label={label} title={title} variant="quiet" onClick={onClick} disabled={off}>
          <Icon name={icon} size={16} />
        </IconButton>
      ) : (
        <Button variant="quiet" size="sm" onClick={onClick} disabled={off} title={title}>
          <Icon name={icon} size={15} />
          {label}
        </Button>
      )}
      {!running && enhancer.canUndo && (
        <IconButton label={t('composer.enhanceUndo')} variant="quiet" onClick={enhancer.undo}>
          <Icon name="undo" size={16} />
        </IconButton>
      )}
    </span>
  )
}

/**
 * Why the field was left as it was. Neutral, dismissible, and in the composer
 * itself — the generation's red banner is for failures that stop a screen, and
 * this one stopped nothing: the text the person typed is still there.
 */
export function EnhanceNotice({ enhancer, className = '' }: { enhancer: PromptEnhancer; className?: string }) {
  const t = useT()
  // The live region is always mounted and only its CONTENT changes: most screen
  // readers announce a change inside a region that was already there, not a
  // region that arrives holding its text — so a failed rewrite used to put the
  // typed words back in silence. ChimeSetting's status line does the same.
  return (
    <div
      role="status"
      className={
        enhancer.notice
          ? `flex items-start justify-between gap-3 border border-line bg-raised px-3 py-2 text-body-sm text-ink-muted ${className}`
          : 'sr-only'
      }
    >
      {enhancer.notice && (
        <>
          <span className="flex min-w-0 items-start gap-2">
            <Icon name="sparkle" size={16} className="mt-0.5 shrink-0" />
            <span className="break-words">{enhancer.notice}</span>
          </span>
          <IconButton label={t('common.close')} variant="quiet" onClick={enhancer.dismissNotice}>
            <Icon name="close" size={14} />
          </IconButton>
        </>
      )}
    </div>
  )
}
