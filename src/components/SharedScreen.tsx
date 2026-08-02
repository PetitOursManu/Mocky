import { useEffect, useState } from 'react'
import Preview from './Preview'
import DeviceChrome, { SCREEN_RADIUS } from './DeviceChrome'
import { fetchShare, expiresInMinutes, type ShareSnapshot } from '../lib/share'
import { Banner, Spinner } from '../ui'
import { useT } from '../i18n'

/**
 * What someone sees after scanning the code: one screen, and nothing else.
 *
 * This mounts BEFORE the account gate, which is the entire point — signing in
 * on a borrowed phone to look at a mockup is absurd, and making the instance
 * publicly readable to avoid that is worse. The token in the URL is the whole
 * authority, and it unlocks exactly this one stored snapshot.
 *
 * There is deliberately no chrome from the app here: no header, no navigation,
 * no way to reach a project. Not because those would leak anything — the API
 * would refuse them without a session — but because offering doors that answer
 * 401 is a worse experience than not showing them.
 */
export default function SharedScreen({ token }: { token: string }) {
  const t = useT()
  const [snap, setSnap] = useState<ShareSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchShare(token)
      .then((s) => {
        if (alive) setSnap(s)
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      alive = false
    }
  }, [token])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sunken p-6">
        <div className="max-w-md text-center">
          <div className="masthead text-h2">Mocky</div>
          <div className="rule-thin my-4" />
          <Banner tone="warn">{error}</Banner>
          <p className="mt-4 text-body-sm text-ink-muted">{t('share.expiredHelp')}</p>
        </div>
      </div>
    )
  }

  if (!snap) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sunken">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  const minutes = expiresInMinutes(snap.expiresAt)
  const phone = snap.device === 'iphone'

  return (
    <div className="flex min-h-screen flex-col bg-sunken">
      {/* A thin masthead, so the page says where it came from without pretending
          to be the application. */}
      <header className="rule-thin flex items-baseline justify-between gap-3 px-4 py-2.5">
        <span className="flex items-baseline gap-2">
          <span className="masthead text-lead leading-none">Mocky</span>
          <span className="kicker text-ink-faint">{snap.name}</span>
        </span>
        <span className="kicker text-ink-faint">
          {minutes > 60
            ? t('share.expiresHours', { n: String(Math.round(minutes / 60)) })
            : t('share.expiresMinutes', { n: String(minutes) })}
        </span>
      </header>

      {/*
        The screen fills what is left, and is touchable: nothing disables
        pointer events here, which is the whole reason to open a mockup on a
        phone. It stays sandboxed exactly as on the canvas — the token grants
        the viewer no privilege inside the frame.
      */}
      <main className="flex flex-1 items-center justify-center overflow-auto p-3">
        <div
          className="w-full"
          style={{ maxWidth: phone ? 420 : snap.w, aspectRatio: `${snap.w} / ${snap.h}` }}
        >
          {phone ? (
            <DeviceChrome>
              <Preview
                code={snap.code}
                caps={snap.caps}
                hideScrollbars
                radius={SCREEN_RADIUS}
                animations={snap.animations}
              />
            </DeviceChrome>
          ) : (
            <div className="h-full w-full border border-line">
              <Preview code={snap.code} caps={snap.caps} animations={snap.animations} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
