import { useEffect, useRef, useState } from 'react'
import { api, type RunnerJobView, type RunnerStatus } from '../../lib/api'
import { Banner, Button, Field, Textarea } from '../../ui'
import { useT } from '../../i18n'

/**
 * Admin → Assistants (MCP) → the runner: can this machine generate with no tab
 * open (server/mcp/runner.js)?
 *
 * Two buttons, priced differently on purpose. "Check" costs nothing — Chromium,
 * this build's runner page, one fixed screen photographed — and answers the
 * question most installs have ("is Chromium there?"). "Full try" runs a real
 * generation in the administrator's OWN account, through the model the
 * instance is configured with: the whole path an assistant will take, and it
 * is paid like any generation, which is why it asks for a brief rather than
 * running on a click.
 */
export default function RunnerPanel({ status, onChanged }: { status: RunnerStatus; onChanged: () => void }) {
  const t = useT()
  const [checking, setChecking] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [brief, setBrief] = useState('')
  const [job, setJob] = useState<RunnerJobView | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const poll = useRef<number | null>(null)

  useEffect(() => () => {
    if (poll.current) window.clearTimeout(poll.current)
  }, [])

  const reason = (code?: string) => (code ? t(`mcp.runner.reason.${code}`) === `mcp.runner.reason.${code}` ? code : t(`mcp.runner.reason.${code}`) : '')

  async function check() {
    setChecking(true)
    setError(null)
    setImage(null)
    try {
      const out = await api.admin.mcp.runnerCheck()
      if (out.image) setImage(out.image)
      else setError(reason(out.error) || t('common.error'))
    } catch (e) {
      setError(reason(e instanceof Error ? e.message : String(e)))
    } finally {
      setChecking(false)
      onChanged()
    }
  }

  async function follow(id: string) {
    try {
      const out = await api.admin.mcp.runnerJob(id)
      setJob(out.job)
      setLink(out.link)
      if (out.job.status === 'queued' || out.job.status === 'running') poll.current = window.setTimeout(() => void follow(id), 1500)
      else onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function tryIt() {
    setError(null)
    setJob(null)
    setLink(null)
    try {
      const out = await api.admin.mcp.runnerTry(brief.trim())
      setJob(out.job)
      void follow(out.job.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg === 'no-provider' ? t('mcp.runner.noProvider') : reason(msg))
    }
  }

  const busy = job && (job.status === 'queued' || job.status === 'running')

  return (
    <div className="space-y-4">
      <div className="section-head">
        <span className="kicker text-accent-ink">{t('mcp.runner.title')}</span>
        <span className={`ml-auto font-mono text-caption ${status.available ? 'text-ok' : 'text-danger'}`}>
          {status.available ? t('mcp.runner.available') : t('mcp.runner.unavailable')}
        </span>
      </div>
      <p className="measure text-body-sm text-ink-muted">{t('mcp.runner.blurb')}</p>
      {!status.available && <Banner tone="warn">{reason(status.reason)}</Banner>}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void check()} disabled={checking || !status.available}>
          {checking ? t('mcp.runner.checking') : t('mcp.runner.check')}
        </Button>
        <span className="text-caption text-ink-muted">{t('mcp.runner.checkHelp')}</span>
      </div>
      {image && <img src={image} alt={t('mcp.runner.checkAlt')} className="max-w-full border border-line-soft" />}

      <Field label={t('mcp.runner.tryLabel')} hint={t('mcp.runner.tryHelp')}>
        {(p) => <Textarea {...p} rows={2} value={brief} onChange={(e) => setBrief(e.currentTarget.value)} placeholder={t('mcp.runner.tryPlaceholder')} />}
      </Field>
      <Button variant="primary" onClick={() => void tryIt()} disabled={!brief.trim() || Boolean(busy) || !status.available}>
        {busy ? t('mcp.runner.trying', { step: job?.progress || '…' }) : t('mcp.runner.try')}
      </Button>

      {error && <Banner tone="danger">{error}</Banner>}
      {job?.status === 'failed' && <Banner tone="danger" title={t('mcp.runner.failed')}>{job.error}</Banner>}
      {job?.status === 'done' && job.result && (
        <div className="space-y-2">
          {job.result.shot && (
            <img src={api.admin.mcp.shotUrl(job.result.shot)} alt={t('mcp.runner.resultAlt')} className="max-w-full border border-line-soft" />
          )}
          {[...(job.result.warning ? [job.result.warning] : []), ...job.result.notices].map((n, i) => (
            <p key={i} className="text-caption text-ink-muted">{n}</p>
          ))}
          {link && (
            <a className="text-body-sm text-accent-ink hover:underline" href={link}>
              {t('mcp.runner.open')}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
