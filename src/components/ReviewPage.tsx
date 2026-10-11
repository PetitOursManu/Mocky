import { useCallback, useEffect, useState } from 'react'
import { Banner, Button, Icon, Input, Modal, Spinner, Textarea } from '../ui'
import { useLang, useT } from '../i18n'
import ReviewBoard from './ReviewBoard'
import ReviewStatusPill from './ReviewStatusPill'
import {
  fetchReview,
  loadReviewAuthor,
  postReviewComment,
  postReviewDecision,
  saveReviewAuthor,
  type ReviewView,
  type Verdict,
} from '../lib/review'

/**
 * What a client sees on `/r/<token>`: the project as it was sent, a place to
 * pin remarks, and the two answers they can give.
 *
 * Mounted BEFORE the account gate, like the share viewer: the client has no
 * account and needs none — the token is the whole authority (server/reviews.js).
 * Nothing of the application's chrome is drawn, for the share viewer's reason:
 * doors that answer 401 are worse than no doors.
 */
export default function ReviewPage({ token }: { token: string }) {
  const t = useT()
  const [lang] = useLang()
  const [view, setView] = useState<ReviewView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [author, setAuthor] = useState(loadReviewAuthor)
  const [deciding, setDeciding] = useState<Verdict | null>(null)

  const refresh = useCallback(async () => {
    try {
      setView(await fetchReview(token))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [token])

  useEffect(() => {
    void refresh()
    // The owner may answer while the client is reading. Once a minute is
    // enough for a conversation that runs over days, and costs nothing.
    const id = window.setInterval(() => void refresh(), 60_000)
    return () => window.clearInterval(id)
  }, [refresh])

  function changeAuthor(name: string) {
    setAuthor(name)
    saveReviewAuthor(name)
  }

  if (error && !view) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sunken p-6">
        <div className="max-w-md text-center">
          <div className="masthead text-h2">Mocky</div>
          <div className="rule-thin my-4" />
          <Banner tone="warn">{error}</Banner>
          <p className="mt-4 text-body-sm text-ink-muted">{t('review.expiredHelp')}</p>
        </div>
      </div>
    )
  }

  if (!view) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sunken">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  const last = view.decisions[view.decisions.length - 1]
  const date = (at: number) => new Date(at).toLocaleDateString(lang, { dateStyle: 'long' })

  return (
    <div className="flex min-h-screen flex-col bg-surface lg:h-screen">
      <header className="rule-thin flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="masthead text-lead leading-none">Mocky</span>
          <span className="min-w-0 truncate text-body text-ink">{view.projectName}</span>
          <ReviewStatusPill status={view.status === 'closed' ? 'draft' : view.status} />
        </span>
        <span className="flex items-center gap-2">
          <span className="hidden text-caption text-ink-faint sm:inline">
            {t('review.validUntil', { date: date(view.expiresAt) })}
          </span>
          {view.open && (
            <>
              <Button size="sm" onClick={() => setDeciding('changes_requested')}>
                <Icon name="pencil" size={15} />
                {t('review.requestChanges')}
              </Button>
              {/* Approving an approved round again changed nothing and looked
                  like it was still to be done. Greyed, it says the decision is
                  made; asking for changes stays open, because a client may
                  change their mind while the round is. */}
              <Button
                size="sm"
                variant="primary"
                disabled={view.status === 'approved'}
                title={view.status === 'approved' ? t('review.alreadyApproved') : undefined}
                onClick={() => setDeciding('approved')}
              >
                <Icon name="check" size={15} />
                {t(view.status === 'approved' ? 'review.approvedButton' : 'review.approve')}
              </Button>
            </>
          )}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        {!view.open ? (
          <Banner tone="info">{t('review.closedBanner')}</Banner>
        ) : (
          <p className="measure text-body-sm text-ink-muted">{t('review.intro')}</p>
        )}
        {last && (
          <Banner tone={last.verdict === 'approved' ? 'ok' : 'warn'}>
            {t(last.verdict === 'approved' ? 'review.lastApproved' : 'review.lastChanges', {
              author: last.author,
              date: date(last.at),
            })}
            {last.message ? ` — « ${last.message} »` : ''}
          </Banner>
        )}
        <ReviewBoard
          view={view}
          mode="reviewer"
          author={author}
          onAuthorChange={changeAuthor}
          canWrite={view.open}
          onComment={async (input) => {
            await postReviewComment(token, { ...input, author })
            await refresh()
          }}
        />
      </div>

      {deciding && (
        <DecisionDialog
          verdict={deciding}
          author={author}
          onAuthorChange={changeAuthor}
          onClose={() => setDeciding(null)}
          onSubmit={async (message) => {
            await postReviewDecision(token, { author, verdict: deciding, message })
            setDeciding(null)
            await refresh()
          }}
        />
      )}
    </div>
  )
}

function DecisionDialog({
  verdict,
  author,
  onAuthorChange,
  onClose,
  onSubmit,
}: {
  verdict: Verdict
  author: string
  onAuthorChange: (name: string) => void
  onClose: () => void
  onSubmit: (message: string) => Promise<void>
}) {
  const t = useT()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changes = verdict === 'changes_requested'
  const ready = author.trim() && (!changes || message.trim())

  return (
    <Modal title={t(changes ? 'review.requestChanges' : 'review.approve')} size="sm" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!ready) return
          setBusy(true)
          setError(null)
          try {
            await onSubmit(message.trim())
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <p className="text-body-sm text-ink-muted">{t(changes ? 'review.changesHelp' : 'review.approveHelp')}</p>
        {error && <Banner tone="danger">{error}</Banner>}
        <Input
          value={author}
          maxLength={60}
          placeholder={t('review.namePlaceholder')}
          aria-label={t('review.nameLabel')}
          onChange={(e) => onAuthorChange(e.target.value)}
        />
        <Textarea
          rows={4}
          maxLength={2000}
          value={message}
          placeholder={t(changes ? 'review.changesPlaceholder' : 'review.approvePlaceholder')}
          aria-label={t('review.messageLabel')}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="quiet" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" type="submit" disabled={busy || !ready}>
            {t(changes ? 'review.sendChanges' : 'review.sendApproval')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
