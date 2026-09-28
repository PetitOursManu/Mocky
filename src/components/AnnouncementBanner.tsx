import { useEffect, useState } from 'react'
import { dismiss, getAnnouncement, isDismissed, onAnnouncement } from '../lib/announcement'
import { Icon, IconButton } from '../ui'
import AnnouncementMessage from './AnnouncementMessage'
import { useT } from '../i18n'

/**
 * What the administrator wrote for everybody (Admin → Announcement).
 *
 * Under the masthead, beside the maintenance banner and in the same form: a
 * kicker, the sentence, and a close button — the one difference, because a
 * maintenance notice describes a state the user cannot dismiss, and an
 * announcement is a message they have read.
 */
export default function AnnouncementBanner() {
  const t = useT()
  const [a, setA] = useState(getAnnouncement)
  const [closed, setClosed] = useState<string | null>(null)

  useEffect(() => onAnnouncement(setA), [])

  if (!a || closed === a.id || isDismissed(a.id)) return null
  const warn = a.tone === 'warn'

  return (
    <div role="status" className={`border-b ${warn ? 'border-warn bg-warn/10' : 'border-accent bg-accent/10'}`}>
      <div className="page flex items-center gap-3 py-1.5 text-body-sm">
        <span className={`kicker shrink-0 ${warn ? 'text-warn' : 'text-accent-ink'}`}>{t('dashboard.announce.kicker')}</span>
        {/* Plain text by construction: React escapes it, and the server strips
            control characters before it is ever stored. Its dates are written
            in THIS reader's time zone. */}
        <span className="min-w-0 flex-1 text-ink">
          <AnnouncementMessage message={a.message} />
        </span>
        <IconButton
          label={t('dashboard.announce.dismiss')}
          onClick={() => {
            dismiss(a.id)
            setClosed(a.id)
          }}
        >
          <Icon name="close" size={16} />
        </IconButton>
      </div>
    </div>
  )
}
