import { useRef, useState } from 'react'
import { Banner, Button, Icon, Input, Spinner, Textarea } from '../ui'
import { useLang, useT } from '../i18n'
import type { Screen } from '../lib/project'
import type { Campaign, CampaignFormatId } from '../lib/campaign'
import {
  ALT_MAX,
  NETWORK_RULES,
  PACK_NETWORKS,
  captionText,
  codeDigest,
  normalizeHashtags,
  packStaleFacts,
  type PackCaption,
  type PackNetwork,
  type PieceAlt,
} from '../lib/publicationPack'
import { buildPackZip } from '../lib/publicationPackExport'
import { downloadBlob } from '../lib/docExport/files'

type Piece = Screen & { campaign: NonNullable<Screen['campaign']> }

/**
 * The publication pack, in the campaign panel: the three captions and each
 * visual's text alternative, editable where they are shown, and the .zip.
 *
 * Writing them is one model call the VIEW makes (`onWrite`, which also puts the
 * text alternatives on the pieces); the captions come back here and go into the
 * panel's draft, saved like the brief — never written by the view behind the
 * draft's back, or the panel's next save would put the old ones back. Building
 * the .zip renders pictures and touches no screen.
 */
export default function CampaignPack({
  campaignName,
  campaign,
  pieces,
  locked,
  onWrite,
  onCaptions,
  onAlt,
}: {
  campaignName: string
  campaign: Campaign
  pieces: Piece[]
  /** Something else is running. */
  locked: boolean
  onWrite: () => Promise<void>
  onCaptions: (captions: Partial<Record<PackNetwork, PackCaption>>) => void
  onAlt: (screenId: string, alt: PieceAlt | undefined) => void
}) {
  const t = useT()
  const [lang] = useLang()
  const [writing, setWriting] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [report, setReport] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  /** Hashtags as typed, read into tags when the field is left. */
  const [tagDraft, setTagDraft] = useState<Partial<Record<PackNetwork, string>>>({})
  const abort = useRef<AbortController | null>(null)
  const pack = campaign.pack
  const captions = pack?.captions ?? {}
  const stale = pack ? packStaleFacts(pack, campaign.facts) : []
  const label = (f: CampaignFormatId) => t(`campaign.format.${f}`)
  const busy = locked || writing || !!exporting

  async function write() {
    setWriting(true)
    setReport(null)
    try {
      await onWrite()
    } catch (e) {
      setReport({ tone: 'warn', text: t('campaign.pack.failed', { error: e instanceof Error ? e.message : String(e) }) })
    } finally {
      setWriting(false)
    }
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500)
    } catch {
      /* no clipboard (an insecure origin): the text is still selectable */
    }
  }

  function setCaption(n: PackNetwork, next: PackCaption) {
    onCaptions({ ...captions, [n]: next })
  }

  async function download() {
    const ac = new AbortController()
    abort.current = ac
    setReport(null)
    try {
      const when: Record<string, { date: string; time?: string }> = {}
      const alts: Record<string, string> = {}
      for (const p of pieces) {
        if (p.campaign.publish) when[p.id] = p.campaign.publish
        if (p.campaign.alt) alts[p.id] = p.campaign.alt.text
      }
      const res = await buildPackZip(
        campaignName,
        pieces.map((p) => ({ screen: p, format: p.campaign.format, label: label(p.campaign.format) })),
        {
          captions,
          alts,
          when,
          networkLabel: (n) => t(`campaign.pack.network.${n}`),
          words: { file: t('campaign.pack.file'), alt: t('campaign.pack.altColumn'), caption: t('campaign.pack.captionColumn') },
        },
        {
          signal: ac.signal,
          lang: lang === 'en' ? 'en' : 'fr',
          onProgress: (n, total, name) => setExporting(name ? t('campaign.pack.rendering', { name, n: n + 1, total }) : null),
        },
      )
      downloadBlob(res.blob, res.filename)
      const parts = [t('campaign.pack.downloaded', { files: res.files })]
      if (res.failed.length) parts.push(t('campaign.pack.someFailed', { names: res.failed.join(', ') }))
      setReport({ tone: res.failed.length ? 'warn' : 'ok', text: parts.join(' ') })
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        setReport({ tone: 'warn', text: t('campaign.pack.downloadFailed', { error: e instanceof Error ? e.message : String(e) }) })
      }
    } finally {
      abort.current = null
      setExporting(null)
    }
  }

  return (
    <section className="space-y-2 border-t border-line-soft pt-3" aria-labelledby="campaign-pack-title">
      <span id="campaign-pack-title" className="kicker">
        {t('campaign.pack.title')}
      </span>
      <p className="text-caption text-ink-muted">{t('campaign.pack.help')}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={pack ? 'quiet' : 'primary'} disabled={busy || !pieces.length} title={t('campaign.pack.writeCost')} onClick={() => void write()}>
          {writing ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="sparkle" size={14} />}
          {writing ? t('campaign.pack.writing') : pack ? t('campaign.pack.rewrite') : t('campaign.pack.write')}
        </Button>
        {exporting ? (
          <Button size="sm" onClick={() => abort.current?.abort()}>
            <Spinner className="h-3.5 w-3.5" />
            {exporting}
          </Button>
        ) : (
          <Button size="sm" disabled={busy || !pieces.length} onClick={() => void download()}>
            <Icon name="download" size={14} />
            {t('campaign.pack.download')}
          </Button>
        )}
      </div>

      {stale.length > 0 && <Banner tone="warn">{t('campaign.pack.stale', { facts: stale.map((f) => f.label).join(', ') })}</Banner>}
      {report && <Banner tone={report.tone}>{report.text}</Banner>}

      {PACK_NETWORKS.map((n) => {
        const c = captions[n]
        if (!c) return null
        const max = NETWORK_RULES[n].maxChars
        const length = captionText(c).length
        return (
          <div key={n} className="space-y-1 rounded-lg border border-line-soft p-2">
            <div className="flex items-center gap-2">
              <span className="text-body-sm font-medium text-ink">{t(`campaign.pack.network.${n}`)}</span>
              <span className={`text-caption ${length > max ? 'text-danger' : 'text-ink-faint'}`}>{t('campaign.pack.chars', { n: length, max })}</span>
              <Button size="sm" variant="quiet" className="ml-auto" onClick={() => void copy(n, captionText(c))}>
                <Icon name={copied === n ? 'check' : 'copy'} size={14} />
                {copied === n ? t('campaign.pack.copied') : t('campaign.pack.copy')}
              </Button>
            </div>
            <Textarea
              rows={6}
              value={c.text}
              aria-label={t(`campaign.pack.network.${n}`)}
              onChange={(e) => setCaption(n, { ...c, text: e.target.value })}
            />
            <Input
              value={tagDraft[n] ?? c.hashtags.join(' ')}
              aria-label={`${t('campaign.pack.hashtags')} — ${t(`campaign.pack.network.${n}`)}`}
              placeholder={t('campaign.pack.hashtags')}
              onChange={(e) => setTagDraft((d) => ({ ...d, [n]: e.target.value }))}
              onBlur={() => {
                const typed = tagDraft[n]
                if (typed === undefined) return
                setCaption(n, { ...c, hashtags: normalizeHashtags(typed, 30) })
                setTagDraft((d) => ({ ...d, [n]: undefined }))
              }}
            />
          </div>
        )
      })}

      {pieces.some((p) => p.campaign.alt) && (
        <div className="space-y-1.5">
          <span className="text-caption font-medium text-ink">{t('campaign.pack.alts')}</span>
          {pieces.map((p) => {
            const alt = p.campaign.alt
            const behind = alt && alt.of !== codeDigest(p.code)
            return (
              <div key={p.id} className="space-y-1">
                <div className="flex items-center gap-2 text-caption text-ink-muted">
                  <span className="min-w-0 truncate">
                    {label(p.campaign.format)} · {p.name}
                  </span>
                  {alt && (
                    <Button size="sm" variant="quiet" className="ml-auto" onClick={() => void copy(`alt-${p.id}`, alt.text)}>
                      <Icon name={copied === `alt-${p.id}` ? 'check' : 'copy'} size={14} />
                      {copied === `alt-${p.id}` ? t('campaign.pack.copied') : t('campaign.pack.copy')}
                    </Button>
                  )}
                </div>
                {alt ? (
                  <Textarea
                    rows={2}
                    maxLength={ALT_MAX * 2}
                    value={alt.text}
                    aria-label={t('campaign.pack.altFor', { name: p.name })}
                    onChange={(e) => onAlt(p.id, { text: e.target.value, of: alt.of })}
                  />
                ) : (
                  <p className="text-caption text-ink-faint">{t('campaign.pack.altNone')}</p>
                )}
                {behind && <p className="text-caption text-warn">{t('campaign.pack.altStale')}</p>}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
