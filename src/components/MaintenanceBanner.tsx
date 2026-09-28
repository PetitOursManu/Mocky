import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { getMaintenance, onMaintenance, setMaintenance } from '../lib/maintenance'
import { setAnnouncement } from '../lib/announcement'
import { useT } from '../i18n'

/** Often enough that a lifted maintenance resumes sync within a minute; rare enough to cost nothing. */
const POLL_MS = 60_000

/**
 * The one place a user learns the instance is read-only.
 *
 * Shown to everyone, admins included, but it says a different thing to each:
 * an admin can still write (server/maintenance.js explains why), and needs to
 * be reminded that on the OLD server of a migration, what they write after the
 * final pass stays behind.
 *
 * It also owns the poll of /api/config, because it is the component whose
 * answer changes when the poll does — and sync.ts listens to the same store to
 * resume the moment maintenance ends. The administrator's announcement rides the
 * same answer (AnnouncementBanner reads it): a second poll of the same URL
 * would double the requests for no new information.
 */
export default function MaintenanceBanner({ isAdmin }: { isAdmin: boolean }) {
  const t = useT()
  const [state, setState] = useState(getMaintenance)

  useEffect(() => onMaintenance(setState), [])

  useEffect(() => {
    let stopped = false
    const poll = () =>
      api
        .config()
        .then((cfg) => {
          if (stopped) return
          setMaintenance(cfg.maintenance)
          setAnnouncement(cfg.announcement)
        })
        .catch(() => {
          /* offline: the next poll, or the next refused write, will tell */
        })
    poll()
    const id = window.setInterval(poll, POLL_MS)
    return () => {
      stopped = true
      window.clearInterval(id)
    }
  }, [])

  if (!state.on) return null

  return (
    <div role="status" className="border-b border-warn bg-warn/10">
      <div className="page flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-body-sm">
        <span className="kicker text-warn">{t('migration.maintenance.kicker')}</span>
        <span className="text-ink">{isAdmin ? t('migration.maintenance.bannerAdmin') : t('migration.maintenance.banner')}</span>
        {state.message && <span className="text-ink-muted">— {state.message}</span>}
      </div>
    </div>
  )
}
