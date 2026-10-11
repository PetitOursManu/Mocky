import { useT } from '../i18n'
import type { ProjectStatus } from '../lib/review'

const LOOK: Record<ProjectStatus, string> = {
  draft: 'border-line-soft text-ink-muted',
  in_review: 'border-accent text-accent-ink',
  changes_requested: 'border-warn text-warn',
  approved: 'border-ok text-ok',
}

/**
 * A project's approval status, as a small outlined label. Outlined and in the
 * status tokens rather than filled: it sits on project cards and in headers,
 * where a filled block would outweigh the project's own name.
 */
export default function ReviewStatusPill({ status, unread = 0 }: { status: ProjectStatus; unread?: number }) {
  const t = useT()
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-caption font-medium ${LOOK[status]}`}
      title={unread ? t('review.unreadTitle', { count: unread }) : undefined}
    >
      {t(`review.status.${status}`)}
      {unread > 0 && <span className="rounded-full bg-accent px-1.5 text-on-accent">{unread}</span>}
    </span>
  )
}
