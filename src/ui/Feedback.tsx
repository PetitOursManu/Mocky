import type { ReactNode } from 'react'

/** Inline message. `tone` maps to the status tokens — never to a raw colour. */
export function Banner({
  tone = 'info',
  title,
  children,
  action,
  className = '',
}: {
  tone?: 'info' | 'warn' | 'danger' | 'ok'
  title?: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const edge = {
    info: 'border-accent',
    warn: 'border-warn',
    danger: 'border-danger',
    ok: 'border-ok',
  }[tone]
  const ink = { info: 'text-ink', warn: 'text-warn', danger: 'text-danger', ok: 'text-ok' }[tone]

  return (
    <div
      // Errors have to be announced, not just drawn — the app reported failures
      // by painting a red box that a screen reader never mentioned.
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`border-l-2 ${edge} bg-surface px-3 py-2 ${className}`}
    >
      {title && <p className={`text-body-sm font-medium ${ink}`}>{title}</p>}
      {children && <div className="text-body-sm text-ink-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Spinner({ label = 'Chargement…', className = '' }: { label?: string; className?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border border-current border-t-transparent ${className}`}
    />
  )
}

/**
 * A shimmering placeholder shaped like the content that is coming.
 *
 * The canvas used to show an empty white rectangle while a screen generated,
 * which is indistinguishable from a screen that generated badly.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-ink/10 ${className}`} aria-hidden />
}

export function ScreenSkeleton() {
  return (
    <div className="flex h-full w-full flex-col gap-4 bg-surface p-6" aria-hidden>
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="mt-4 h-40 w-full" />
    </div>
  )
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <h2 className="text-h2 text-ink">{title}</h2>
      {children && <p className="mt-2 max-w-md text-body text-ink-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
