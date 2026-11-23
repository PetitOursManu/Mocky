import { useEffect, useState } from 'react'
import { Banner, Button, Field, Input } from '../ui'
import { useT } from '../i18n'
import { connectSprixy, disconnectSprixy, getSprixyCatalog, getSprixyLink, type SprixyLink as Link, type SprixyProject } from '../lib/sprixyClient'

/**
 * Settings → Sprixy: connect this account to the person's own Sprixy (game
 * assets), with a READ-ONLY catalog token; see what it shares; disconnect.
 *
 * What may be used is decided in Sprixy, project by project ("Share with
 * apps"), so this panel shows those projects rather than asking again here.
 * The token is typed once and never comes back (server/sprixy.js).
 */
export default function SprixyLink() {
  const t = useT()
  const [link, setLink] = useState<Link | null>(null)
  const [projects, setProjects] = useState<SprixyProject[] | null>(null)
  const [owner, setOwner] = useState('')
  const [base, setBase] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    getSprixyLink()
      .then((l) => live && setLink(l))
      // No server (dev without the API), or signed out: no Sprixy, nothing else lost.
      .catch(() => live && setLink({ connected: false }))
    return () => {
      live = false
    }
  }, [])

  // What is shared NOW: a project shared or unshared in Sprixy since shows here on the next visit.
  useEffect(() => {
    if (!link?.connected || projects) return
    getSprixyCatalog()
      .then((c) => {
        setProjects(c.projects)
        setOwner(c.owner)
      })
      .catch((e) => setWarning(t('sprixy.unreachable', { error: e instanceof Error ? e.message : String(e) })))
  }, [link, projects, t])

  if (!link) return null

  async function connect(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setWarning(null)
    try {
      const l = await connectSprixy(base, token)
      setToken('')
      setLink(l)
      setProjects(l.projects ?? [])
      setOwner(l.owner ?? '')
    } catch (err) {
      setError(t('sprixy.connectFailed', { error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      setLink(await disconnectSprixy())
      setProjects(null)
      setOwner('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="section-head">
        <span className="kicker">{t('sprixy.title')}</span>
      </div>
      <p className="measure mb-4 text-body text-ink-muted">{t('sprixy.blurb')}</p>
      {error && (
        <Banner tone="danger" className="mb-4">
          {error}
        </Banner>
      )}
      {link.connected ? (
        <div className="space-y-4">
          <p className="text-body">
            <strong>{t('sprixy.connected', { host: link.host ?? '' })}</strong>
            {owner && <span className="text-ink-muted"> · {t('sprixy.owner', { name: owner })}</span>}
          </p>
          {warning && <Banner tone="warn">{warning}</Banner>}
          {projects &&
            (projects.length ? (
              <div>
                <div className="mb-1 text-caption text-ink-faint">{t('sprixy.shared')}</div>
                <ul className="space-y-1 text-body">
                  {projects.map((p) => (
                    <li key={p.id} className="flex justify-between gap-4">
                      <span className="truncate">{p.name}</span>
                      <span className="shrink-0 text-ink-muted">{t('sprixy.assets', { n: String(p.assetCount) })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Banner tone="warn">{t('sprixy.nothingShared')}</Banner>
            ))}
          <p className="measure text-caption text-ink-muted">{t('sprixy.howToUse')}</p>
          <Button variant="ghost" onClick={disconnect} disabled={busy}>
            {t('sprixy.disconnect')}
          </Button>
        </div>
      ) : (
        <form onSubmit={connect} className="space-y-4">
          <Field label={t('sprixy.address')} hint={t('sprixy.addressHint')}>
            {(p) => <Input {...p} type="url" inputMode="url" autoComplete="url" placeholder="https://" value={base} onChange={(e) => setBase(e.currentTarget.value)} />}
          </Field>
          <Field label={t('sprixy.token')} hint={t('sprixy.tokenHint')}>
            {(p) => <Input {...p} type="password" autoComplete="off" spellCheck={false} placeholder="spx_…" value={token} onChange={(e) => setToken(e.currentTarget.value)} />}
          </Field>
          <Button type="submit" disabled={busy || !base.trim() || !token.trim()}>
            {busy ? t('sprixy.connecting') : t('sprixy.connect')}
          </Button>
        </form>
      )}
    </section>
  )
}
