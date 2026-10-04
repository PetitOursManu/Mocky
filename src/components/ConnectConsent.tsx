import { useEffect, useState } from 'react'
import { api, type ConnectRequest } from '../lib/api'
import { Banner, Button, Modal } from '../ui'
import { useT } from '../i18n'

/**
 * `/connect/<id>`: an assistant asks to act in Mocky on this person's behalf.
 *
 * The OAuth server's /authorize sends the browser here (server/mcp/provider.js)
 * and this page is behind the Mocky session like every other one: signed out,
 * the sign-in modal comes first. Nothing is granted without the click — no
 * "remember this client", no silent approval — and refusing hands the assistant
 * an `access_denied` rather than leaving it waiting.
 *
 * What is shown is what the person needs to decide: who is asking (the name the
 * client registered, which a client chooses — hence the host it will send them
 * back to, which it does not), which account it would act as, and that it can
 * be undone.
 */

/** The id in `/connect/<id>`, or null. */
export function connectIdFromLocation(pathname = window.location.pathname): string | null {
  const m = /^\/connect\/([a-f0-9]{32})\/?$/.exec(pathname)
  return m ? m[1] : null
}

/**
 * Kept in this tab while the person signs in: SSO comes back on `/`, not here.
 * Same reasoning as lib/projectLink.ts.
 */
const PENDING_KEY = 'mocky.pendingConnect'

export function rememberConnect(id: string) {
  try {
    sessionStorage.setItem(PENDING_KEY, id)
  } catch {
    /* private mode: works as long as no redirect comes between */
  }
}

/** The waiting request, left in place: a sign-in can reload the page before it is answered. */
export function peekConnect(): string | null {
  try {
    const id = sessionStorage.getItem(PENDING_KEY)
    return id && /^[a-f0-9]{32}$/.test(id) ? id : null
  } catch {
    return null
  }
}

/** Forget the waiting request, once it has been answered or dismissed. */
export function takeConnect(): string | null {
  try {
    const id = sessionStorage.getItem(PENDING_KEY)
    sessionStorage.removeItem(PENDING_KEY)
    return id && /^[a-f0-9]{32}$/.test(id) ? id : null
  } catch {
    return null
  }
}

export default function ConnectConsent({ id, onDone }: { id: string; onDone: () => void }) {
  const t = useT()
  const [req, setReq] = useState<ConnectRequest | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'expired' | 'sending' | 'leaving' | 'refused'>('loading')
  const [back, setBack] = useState<string | null>(null)

  useEffect(() => {
    api.connect
      .get(id)
      .then((r) => {
        setReq(r)
        setState('ready')
      })
      .catch(() => setState('expired'))
  }, [id])

  async function answer(approve: boolean) {
    setState('sending')
    try {
      const out = await api.connect.decide(id, approve)
      // Answered: a later visit to Mocky in this tab must not ask again.
      takeConnect()
      if (out.notAllowed) {
        // Say why before handing the assistant its refusal.
        setBack(out.redirect)
        setState('refused')
        return
      }
      setState('leaving')
      window.location.assign(out.redirect)
    } catch {
      setState('expired')
    }
  }

  return (
    // The question goes in the body, where it can wrap: a client names itself,
    // and a long name cut by the header's single line hid who was asking.
    <Modal title={t('mcp.connect.kicker')} onClose={onDone} size="md" dismissible={state !== 'sending' && state !== 'leaving'}>
      {state === 'loading' && <p className="text-body text-ink-muted">{t('mcp.connect.loading')}</p>}

      {state === 'expired' && (
        <Banner tone="warn">{t('mcp.connect.expired')}</Banner>
      )}

      {(state === 'refused' || (req && !req.allowed && state === 'ready')) && (
        <Banner
          tone="danger"
          title={t('mcp.connect.notAllowedTitle')}
          action={
            state === 'refused' && back ? (
              <Button size="sm" onClick={() => window.location.assign(back)}>
                {t('mcp.connect.back')}
              </Button>
            ) : (
              <Button size="sm" onClick={() => void answer(false)}>
                {t('mcp.connect.back')}
              </Button>
            )
          }
        >
          {t('mcp.connect.notAllowedBody')}
        </Banner>
      )}

      {req && req.allowed && (state === 'ready' || state === 'sending' || state === 'leaving') && (
        <div className="space-y-4">
          <h3 className="text-h3 text-ink">{t('mcp.connect.title', { client: req.clientName })}</h3>
          <p className="text-body text-ink">{t('mcp.connect.as', { user: req.username })}</p>
          <p className="measure text-body text-ink-muted">{t('mcp.connect.scope')}</p>
          {req.redirectHost && (
            <p className="text-body-sm text-ink-muted">
              {t('mcp.connect.redirect', { host: req.redirectHost })}
            </p>
          )}
          <p className="text-caption text-ink-faint">{t('mcp.connect.revokeHint')}</p>
          {state === 'leaving' ? (
            <p className="text-body-sm text-ink-muted" role="status">
              {t('mcp.connect.redirecting')}
            </p>
          ) : (
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button onClick={() => void answer(false)} disabled={state !== 'ready'}>
                {t('mcp.connect.deny')}
              </Button>
              <Button variant="primary" onClick={() => void answer(true)} disabled={state !== 'ready'}>
                {t('mcp.connect.approve')}
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
