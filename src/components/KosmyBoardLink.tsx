import { useEffect, useState } from 'react'
import { api, type AuthUser } from '../lib/api'
import { kosmyReasonKey, takeLinkNotice, type KosmyReturn } from '../lib/kosmyBoard'
import { Banner, Button, Field, Input } from '../ui'
import { useT } from '../i18n'

/**
 * Settings → Kosmy Board: link this account to a Kosmy Board account, or undo it.
 *
 * Linking is done from here, signed in with the Mocky password, because the
 * Board's e-mail is never trusted to find an account (it is not verified): the
 * `sub` the Board returns is stored on THIS account (server/kosmy-board.js).
 * Undoing it asks for the password again; an account with no password of its
 * own cannot undo it, since the link is then its only way in.
 *
 * Shown when the administrator configured Kosmy Board, or when the account is
 * still linked from a time it was (so the link can be removed).
 */
export default function KosmyBoardLink({
  account,
  onChanged,
}: {
  account: AuthUser | null
  onChanged: (u: AuthUser) => void
}) {
  const t = useT()
  const [enabled, setEnabled] = useState(false)
  const [notice] = useState<KosmyReturn | null>(() => takeLinkNotice())
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unlinked, setUnlinked] = useState(false)

  useEffect(() => {
    api
      .config()
      .then((c) => setEnabled(Boolean(c.kosmyBoard?.enabled)))
      .catch(() => setEnabled(false))
  }, [])

  if (!account || (!enabled && !account.kosmyBoard)) return null

  async function link() {
    setBusy(true)
    setError(null)
    try {
      const { url } = await api.kosmyBoard.link()
      window.location.assign(url)
    } catch (e) {
      const code = (e as { code?: string }).code
      setError(code ? t(kosmyReasonKey(code)) : e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  async function unlink(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user = await api.kosmyBoard.unlink(password)
      setPassword('')
      setUnlinked(true)
      onChanged(user)
    } catch (err) {
      const code = (err as { code?: string }).code
      setError(
        code === 'password'
          ? t('auth.kosmy.wrongPassword')
          : code === 'locked'
            ? t('auth.kosmy.locked')
            : err instanceof Error
              ? err.message
              : String(err),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="section-head">
        <span className="kicker">{t('auth.kosmy.sectionTitle')}</span>
      </div>

      {notice?.kind === 'linked' && account.kosmyBoard && (
        <Banner tone="ok" className="mb-4">
          {t('auth.kosmy.linkedNotice')}
        </Banner>
      )}
      {notice?.kind === 'link-error' && (
        <Banner tone="danger" title={t('auth.kosmy.linkFailed')} className="mb-4">
          {t(kosmyReasonKey(notice.reason))}
        </Banner>
      )}
      {unlinked && !account.kosmyBoard && (
        <Banner tone="ok" className="mb-4">
          {t('auth.kosmy.unlinkedNotice')}
        </Banner>
      )}

      {account.kosmyBoard ? (
        <>
          <p className="measure mb-4 text-body text-ink-muted">{t('auth.kosmy.linkedBlurb')}</p>
          {account.hasPassword ? (
            <form onSubmit={unlink} className="space-y-4">
              <Field label={t('auth.kosmy.unlinkPassword')} hint={t('auth.kosmy.unlinkHint')}>
                {(p) => (
                  <Input
                    {...p}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                  />
                )}
              </Field>
              <Button type="submit" variant="danger" disabled={busy || !password}>
                {t('auth.kosmy.unlink')}
              </Button>
            </form>
          ) : (
            <p className="measure text-body-sm text-ink-muted">{t('auth.kosmy.noPasswordNoUnlink')}</p>
          )}
        </>
      ) : (
        <>
          <p className="measure mb-4 text-body text-ink-muted">{t('auth.kosmy.linkBlurb')}</p>
          <Button variant="primary" onClick={link} disabled={busy || !enabled}>
            {busy ? t('auth.pleaseWait') : t('auth.kosmy.link')}
          </Button>
        </>
      )}

      {error && (
        <Banner tone="danger" className="mt-4">
          {error}
        </Banner>
      )}
    </section>
  )
}
