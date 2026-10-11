import { useCallback, useEffect, useState } from 'react'
import { Banner, Button, Icon, Modal, Panel, Segmented, Spinner } from '../ui'
import { useLang, useT } from '../i18n'
import { qrToSvg } from '../lib/qrcode'
import ReviewBoard from './ReviewBoard'
import ReviewStatusPill from './ReviewStatusPill'
import type { Project } from '../lib/project'
import { projectSnapshot, saveVersion } from '../lib/versions'
import {
  closeReview,
  createReview,
  fetchReview,
  listReviews,
  markReviewSeen,
  projectStatusOf,
  replyAsOwner,
  resolveComment,
  revokeReview,
  type ReviewRound,
  type ReviewTtl,
  type ReviewView,
} from '../lib/review'

/**
 * Sending the project for approval, and reading what came back — in the
 * canvas' right-hand slot.
 *
 * "Send for approval" does two things, in this order: it saves the project as a
 * VERSION (kind `review`), then opens a round on that version. The client
 * therefore approves a frozen state — editing the project afterwards changes
 * nothing they see — and the version is in the Versions panel like any other,
 * so "what exactly did they approve?" has an answer a year later.
 */
export default function ReviewPanel({
  getProject,
  busy,
  onChanged,
  onClose,
}: {
  getProject: () => Project
  /** A generation is running: the state being sent would be half-written. */
  busy: boolean
  /** Something changed that the status badges should re-read. */
  onChanged: () => void
  onClose: () => void
}) {
  const t = useT()
  const [lang] = useLang()
  const project = getProject()
  const [rounds, setRounds] = useState<ReviewRound[] | null>(null)
  const [ttl, setTtl] = useState<ReviewTtl>('30d')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [qr, setQr] = useState(false)
  const [board, setBoard] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setRounds(await listReviews(project.id))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [project.id])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 60_000)
    return () => window.clearInterval(id)
  }, [refresh])

  async function act(fn: () => Promise<unknown>) {
    setWorking(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setWorking(false)
      await refresh()
      onChanged()
    }
  }

  function send() {
    void act(async () => {
      const p = getProject()
      const { version } = await saveVersion({ ...projectSnapshot(p), kind: 'review', label: '' })
      await createReview({ projectId: p.id, projectName: p.name, versionId: version.id, ttl })
    })
  }

  const current = rounds?.[0] ?? null
  const older = rounds?.slice(1) ?? []
  const status = projectStatusOf(rounds ?? [])
  const date = (at: number) => new Date(at).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })
  const hasScreens = project.screens.some((s) => s.code.trim())

  return (
    <Panel title={t('review.panelTitle')} onClose={onClose} className="absolute right-4 top-11 w-80 rounded-xl shadow-2xl">
      <div className="space-y-3 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="kicker text-accent-ink">{t('review.statusLabel')}</span>
          <ReviewStatusPill status={status} />
        </div>
        {error && <Banner tone="danger">{error}</Banner>}
        {rounds === null && (
          <div className="flex justify-center py-3">
            <Spinner className="h-5 w-5" />
          </div>
        )}

        {/* Send */}
        <section className="space-y-2 border-t border-line-soft pt-3">
          <p className="text-body-sm text-ink-muted">{t(current?.open ? 'review.sendAgainHelp' : 'review.sendHelp')}</p>
          <Segmented<ReviewTtl>
            label={t('review.ttlLabel')}
            value={ttl}
            onChange={(v) => v && setTtl(v)}
            options={[
              { value: '7d', label: t('review.ttl7d') },
              { value: '30d', label: t('review.ttl30d') },
              { value: '90d', label: t('review.ttl90d') },
            ]}
          />
          <Button variant="primary" className="w-full" disabled={working || busy || !hasScreens} onClick={send}>
            <Icon name="megaphone" size={15} />
            {t(current?.open ? 'review.sendAgain' : 'review.sendForReview')}
          </Button>
        </section>

        {/* The current round */}
        {current && (
          <section className="space-y-2 border-t border-line-soft pt-3">
            <div className="kicker text-accent-ink">{t('review.currentRound')}</div>
            <p className="text-caption text-ink-faint">
              {t('review.roundMeta', { sent: date(current.createdAt), until: date(current.expiresAt) })}
            </p>
            <div className="flex items-center gap-1.5">
              <input
                className="input min-w-0 flex-1 font-mono text-caption"
                readOnly
                value={current.url}
                aria-label={t('review.linkLabel')}
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(current.url)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  } catch {
                    /* the address is on screen and selectable */
                  }
                }}
              >
                <Icon name={copied ? 'check' : 'copy'} size={14} />
                {t(copied ? 'review.copied' : 'review.copy')}
              </Button>
            </div>
            <Button size="sm" variant="quiet" onClick={() => setQr((v) => !v)}>
              {t(qr ? 'review.hideQr' : 'review.showQr')}
            </Button>
            {qr && (
              <div
                className="mx-auto w-fit border border-line bg-white p-2"
                // Built from integers only (lib/qrcode.ts): the URL never becomes markup.
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: qrToSvg(current.url, { size: 180 }) }}
              />
            )}

            {current.decisions.length > 0 && (
              <ul className="space-y-1.5">
                {[...current.decisions].reverse().map((d) => (
                  <li key={d.at} className="rounded-md border border-line-soft px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <ReviewStatusPill status={d.verdict} />
                      <span className="text-caption text-ink-faint">{date(d.at)}</span>
                    </div>
                    <p className="mt-1 text-body-sm text-ink">
                      <span className="font-semibold">{d.author}</span>
                      {d.message ? ` — ${d.message}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <Button className="w-full" onClick={() => setBoard(current.token)}>
              <Icon name="comment" size={15} />
              {t('review.openComments', { count: current.comments.length })}
              {current.unread > 0 && (
                <span className="rounded-full bg-accent px-1.5 text-caption text-on-accent">{current.unread}</span>
              )}
            </Button>
            <div className="flex gap-1.5">
              {current.open && (
                <Button
                  size="sm"
                  variant="quiet"
                  disabled={working}
                  title={t('review.backToDraftTitle')}
                  onClick={() => {
                    if (confirm(t('review.backToDraftConfirm'))) void act(() => closeReview(current.token))
                  }}
                >
                  {t('review.backToDraft')}
                </Button>
              )}
              <Button
                size="sm"
                variant="quiet"
                disabled={working}
                onClick={() => {
                  if (confirm(t('review.revokeConfirm'))) void act(() => revokeReview(current.token))
                }}
              >
                {t('review.revoke')}
              </Button>
            </div>
          </section>
        )}

        {older.length > 0 && (
          <section className="space-y-1.5 border-t border-line-soft pt-3">
            <div className="kicker text-accent-ink">{t('review.earlierRounds')}</div>
            {older.map((r) => (
              <button
                key={r.token}
                type="button"
                onClick={() => setBoard(r.token)}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-line-soft px-2 py-1.5 text-left hover:border-line"
              >
                <span className="text-caption text-ink-muted">{date(r.createdAt)}</span>
                <ReviewStatusPill status={r.status === 'closed' ? 'draft' : r.status} unread={r.unread} />
              </button>
            ))}
          </section>
        )}
      </div>

      {board && (
        <OwnerBoard
          token={board}
          onClose={() => {
            setBoard(null)
            void refresh()
            onChanged()
          }}
        />
      )}
    </Panel>
  )
}

/** The client's board, opened by the owner: same screens, same pins, their replies. */
function OwnerBoard({ token, onClose }: { token: string; onClose: () => void }) {
  const t = useT()
  const [view, setView] = useState<ReviewView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setView(await fetchReview(token))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [token])

  useEffect(() => {
    void load()
    // Opening the comments is reading them.
    void markReviewSeen(token).catch(() => {})
  }, [load, token])

  return (
    <Modal title={view ? t('review.boardTitle', { name: view.projectName }) : t('review.panelTitle')} size="full" onClose={onClose}>
      {error && <Banner tone="danger">{error}</Banner>}
      {!view ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="flex h-[75vh] flex-col">
          <ReviewBoard
            view={view}
            mode="owner"
            canWrite
            onComment={async (input) => {
              await replyAsOwner(token, input)
              await load()
            }}
            onResolve={async (id, resolved) => {
              await resolveComment(token, id, resolved)
              await load()
            }}
          />
        </div>
      )}
    </Modal>
  )
}
