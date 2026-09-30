import { useEffect, useRef, useState } from 'react'
import Preview from './Preview'
import DeviceChrome, { SCREEN_RADIUS } from './DeviceChrome'
import DocumentPages from './DocumentPages'
import { fetchShare, expiresInMinutes, type ShareSnapshot } from '../lib/share'
import { isPageFormat, type PageFormatId } from '../lib/pageFormats'
import type { Screen } from '../lib/project'
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
  const page = isPageFormat(snap.page) ? snap.page : null

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
      {page ? (
        <SharedDocument snap={snap} page={page} />
      ) : (
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
      )}
    </div>
  )
}

/**
 * A shared DOCUMENT: its pages at their own width, fitted to the phone's and
 * scrolled — the same component the phone's project view uses, for the same
 * reason. Handed to the box above, a flyer lays itself out in a 390-px
 * viewport while its pages stay 794 px wide, and the right half of every page
 * is cut off.
 */
function SharedDocument({ snap, page }: { snap: ShareSnapshot; page: PageFormatId }) {
  const areaRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])
  // DocumentPages reads a Screen; a share is the part of one that travelled.
  // Nothing here is written back anywhere, so the fields it does not read are
  // placeholders rather than a claim about the original.
  const screen: Screen = {
    id: 'shared',
    name: snap.name,
    prompt: '',
    code: snap.code,
    componentName: snap.componentName,
    createdAt: 0,
    x: 0,
    y: 0,
    caps: snap.caps,
    w: snap.w,
    h: snap.h,
    device: 'none',
    links: [],
    page,
    animations: false,
  }
  return (
    <main ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden">
      {size.w > 0 && <DocumentPages screen={screen} page={page} width={size.w} height={size.h} />}
    </main>
  )
}
