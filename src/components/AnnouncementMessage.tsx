import { useMemo } from 'react'
import { formatMoment, splitMoments, zoneOf } from '../lib/announcementText'
import { useLang, useT } from '../i18n'

/**
 * An announcement's text, with its moments written in the reader's own time
 * zone (see lib/announcementText.ts). Used by the banner and by the admin's
 * preview, so the preview is the banner and not a description of it.
 *
 * Each moment is a `<time>` carrying the instant, with the zone in its title:
 * "03h22" alone does not say it is the reader's clock, and the sentence around
 * it should not have to.
 */
export default function AnnouncementMessage({ message }: { message: string }) {
  const t = useT()
  const [lang] = useLang()
  const pieces = useMemo(() => splitMoments(message), [message])
  const locale = typeof navigator !== 'undefined' ? navigator.language : undefined
  return (
    <>
      {pieces.map((p, i) => {
        if (typeof p === 'string') return <span key={i}>{p}</span>
        const f = { lang, locale }
        const zone = zoneOf(p.at, f)
        return (
          <time
            key={i}
            dateTime={new Date(p.at).toISOString()}
            title={zone ? t('dashboard.announce.localTime', { zone }) : undefined}
            className="font-medium"
          >
            {formatMoment(p, f)}
          </time>
        )
      })}
    </>
  )
}
