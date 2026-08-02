import { useEffect, useState } from 'react'
import { Banner, Button, Icon, Modal, Segmented, Spinner } from '../ui'
import { qrToSvg } from '../lib/qrcode'
import {
  createShare,
  listShares,
  revokeShare,
  expiresInMinutes,
  type ShareLink,
  type ShareSummary,
  type ShareTtl,
} from '../lib/share'
import { useT } from '../i18n'
import type { Screen } from '../lib/project'

/**
 * Hand a screen to a phone.
 *
 * The whole dialog is one decision — how long the link should live — and then a
 * code to point a camera at. Everything else is consequence: the URL to copy
 * for a chat message, and a list of what is currently out so a link can be
 * taken back.
 */
export default function ShareDialog({ screen, onClose }: { screen: Screen; onClose: () => void }) {
  const t = useT()
  const [ttl, setTtl] = useState<ShareTtl>('24h')
  const [link, setLink] = useState<ShareLink | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [existing, setExisting] = useState<ShareSummary[]>([])

  const refresh = () => listShares().then(setExisting).catch(() => {})
  useEffect(() => {
    void refresh()
  }, [])

  async function create() {
    setBusy(true)
    setError(null)
    try {
      const l = await createShare(
        {
          screenId: screen.id,
          name: screen.name,
          code: screen.code,
          componentName: screen.componentName,
          caps: screen.caps ?? [],
          w: screen.w,
          h: screen.h,
          device: screen.device,
          animations: screen.animations,
        },
        ttl,
      )
      setLink(l)
      void refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused (insecure origin, permissions). The URL
      // is on screen and selectable either way, so this is not worth an error.
    }
  }

  return (
    <Modal title={t('share.title')} onClose={onClose} size="md">
      <p className="measure text-body text-ink-muted">{t('share.blurb')}</p>

      {error && (
        <div className="mt-3">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}

      {!link ? (
        <div className="mt-5 space-y-4">
          <Segmented<ShareTtl>
            label={t('share.duration')}
            value={ttl}
            onChange={(v) => v && setTtl(v)}
            options={[
              { value: '1h', label: t('share.ttl1h') },
              { value: '24h', label: t('share.ttl24h') },
              { value: '7d', label: t('share.ttl7d') },
            ]}
          />
          <Button variant="primary" onClick={create} disabled={busy || !screen.code.trim()}>
            {busy ? t('share.creating') : t('share.create')}
          </Button>
        </div>
      ) : (
        <div className="mt-5">
          <div className="flex flex-col items-center gap-3">
            {/*
              The SVG is built from integers only — qrToSvg never writes the
              input text into the markup — so this cannot become markup.
            */}
            <div
              className="border border-line bg-white p-3"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: qrToSvg(link.url, { size: 232 }) }}
            />
            <p className="text-body-sm text-ink-muted">{t('share.scanHint')}</p>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input className="input font-mono text-body-sm" readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
            <Button variant="ghost" onClick={copy}>
              <Icon name={copied ? 'check' : 'copy'} size={16} />
              {copied ? t('share.copied') : t('share.copy')}
            </Button>
          </div>

          <p className="measure mt-3 text-caption text-ink-faint">{t('share.snapshotNote')}</p>
        </div>
      )}

      <div className="rule-thin mt-6" />
      <div className="mt-3">
        <div className="kicker mb-2">{t('share.existing')}</div>
        {existing.length === 0 ? (
          <p className="text-body-sm text-ink-faint">{t('share.none')}</p>
        ) : (
          <ul className="space-y-1">
            {existing.map((s) => {
              const mins = expiresInMinutes(s.expiresAt)
              return (
                <li key={s.token} className="flex items-center justify-between gap-3 border-b border-line-soft py-1.5">
                  <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{s.name || s.screenId}</span>
                  <span className="shrink-0 text-caption text-ink-faint">
                    {mins > 60
                      ? t('share.expiresHours', { n: String(Math.round(mins / 60)) })
                      : t('share.expiresMinutes', { n: String(mins) })}
                  </span>
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={async () => {
                      await revokeShare(s.token)
                      if (link?.token === s.token) setLink(null)
                      void refresh()
                    }}
                  >
                    {t('share.revoke')}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {busy && !link && (
        <div className="mt-3 flex items-center gap-2 text-body-sm text-ink-muted">
          <Spinner className="h-4 w-4" />
        </div>
      )}
    </Modal>
  )
}
