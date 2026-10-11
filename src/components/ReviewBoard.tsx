import { useEffect, useMemo, useState } from 'react'
import { Banner, Button, Icon, Input, Textarea } from '../ui'
import { useLang, useT } from '../i18n'
import ScreenFit from './ScreenFit'
import { resolveRoute } from '../lib/flows'
import {
  asScreen,
  openCountByScreen,
  pinsOf,
  threadsOf,
  type ReviewComment,
  type ReviewView,
} from '../lib/review'

/** Where a comment goes: one screen, or the whole project (`null`). */
type Target = string | null

/**
 * The screens of a review round with their comments: the screen list, the
 * screen with its numbered pins, and the threads beside it.
 *
 * One component for both sides of the conversation. The client sees it on
 * `/r/<token>` and the owner opens the very same board from the project — so
 * "pin 3 on the pricing screen" means the same pixel to both of them, which is
 * the whole point of pinning. Only three things differ by `mode`: who signs a
 * comment (a typed name, or the account), whether threads can be marked
 * resolved (the owner's call), and whether a closed round takes anything (the
 * owner may still answer on it).
 *
 * The screen is LIVE by default: its buttons, its links, its forms work, as in
 * the demo. Pinning is one gesture, not a mode: "Pin a remark" arms the NEXT
 * click on the screen, which drops the pin, and the screen is live again. It
 * was a "Navigate / Comment" switch first, and the person who tried it could
 * not tell what the two words were for — a mode is a state somebody has to
 * know they are in, and a click that pins is something they asked for just now.
 */
export default function ReviewBoard({
  view,
  mode,
  author,
  onAuthorChange,
  onComment,
  onResolve,
  canWrite,
}: {
  view: ReviewView
  mode: 'reviewer' | 'owner'
  /** The reviewer's typed name (unused for the owner, who signs as their account). */
  author?: string
  onAuthorChange?: (name: string) => void
  onComment: (input: { text: string; screenId?: string; parentId?: string; x?: number; y?: number }) => Promise<void>
  onResolve?: (commentId: string, resolved: boolean) => Promise<void>
  canWrite: boolean
}) {
  const t = useT()
  const [lang] = useLang()
  const [target, setTarget] = useState<Target>(view.screens[0]?.id ?? null)
  /** "Pin a remark" was pressed: the next click on the screen drops the pin. */
  const [placing, setPlacing] = useState(false)
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null)
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  /*
   * A working prototype's shared data, as in the demo (DemoPlayer): the client
   * signs in on one screen and is signed in on the next. Kept for the visit,
   * never sent anywhere — it is the client trying the prototype, not data.
   */
  const [flowState, setFlowState] = useState<Record<string, unknown>>({})
  const [flowNonce, setFlowNonce] = useState(0)

  const screen = view.screens.find((s) => s.id === target) ?? null
  const threads = useMemo(() => threadsOf(view.comments, target), [view.comments, target])
  const pins = useMemo(() => (target ? pinsOf(view.comments, target) : []), [view.comments, target])
  const pinNumber = useMemo(() => new Map(pins.map((p) => [p.comment.id, p.n])), [pins])
  const openCounts = useMemo(() => openCountByScreen(view.comments), [view.comments])
  const generalCount = view.comments.filter((c) => !c.screenId && !c.parentId).length
  const when = (at: number) => new Date(at).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })
  const needsName = mode === 'reviewer' && !(author ?? '').trim()

  // A pin dropped on one screen means nothing on another.
  useEffect(() => {
    setPin(null)
    setReplyTo(null)
    setPlacing(false)
  }, [target])

  // Escape puts the screen back to work without a pin.
  useEffect(() => {
    if (!placing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlacing(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [placing])

  async function send(input: Parameters<typeof onComment>[0], after: () => void) {
    setSending(true)
    setError(null)
    try {
      await onComment(input)
      after()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  function submitNew() {
    const text = draft.trim()
    if (!text || needsName) return
    void send(
      { text, ...(target ? { screenId: target } : {}), ...(pin ? { x: pin.x, y: pin.y } : {}) },
      () => {
        setDraft('')
        setPin(null)
      },
    )
  }

  function submitReply(root: ReviewComment) {
    const text = replyDraft.trim()
    if (!text || needsName) return
    void send({ text, parentId: root.id, ...(root.screenId ? { screenId: root.screenId } : {}) }, () => {
      setReplyDraft('')
      setReplyTo(null)
    })
  }

  const flow = {
    state: flowState,
    onSet: (key: string, value: unknown) =>
      setFlowState((prev) => {
        const next = { ...prev }
        if (value === null || value === undefined) delete next[key]
        else next[key] = value
        return next
      }),
    onGo: (route: string) => {
      const id = resolveRoute(view.screens.map(asScreen), route)
      if (id) setTarget(id)
    },
    onReset: () => {
      setFlowState({})
      setFlowNonce((n) => n + 1)
    },
  }

  const demoLinks = (screen?.links ?? [])
    .filter((h) => h.selector)
    .map((h) => ({ selector: h.selector as string, target: h.target }))

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
      {/* Screens */}
      <nav aria-label={t('review.screens')} className="flex shrink-0 gap-1 overflow-x-auto lg:w-52 lg:flex-col lg:overflow-y-auto">
        {view.screens.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-current={s.id === target}
            onClick={() => setTarget(s.id)}
            className={`flex shrink-0 items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-body-sm transition ${
              s.id === target ? 'border-accent bg-ink text-surface' : 'border-line-soft text-ink hover:border-line'
            }`}
          >
            <span className="truncate">{s.name}</span>
            {openCounts[s.id] ? (
              <span className={`shrink-0 text-caption ${s.id === target ? 'opacity-80' : 'text-accent-ink'}`}>
                {openCounts[s.id]}
              </span>
            ) : null}
          </button>
        ))}
        <button
          type="button"
          aria-current={target === null}
          onClick={() => setTarget(null)}
          className={`flex shrink-0 items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-body-sm transition ${
            target === null ? 'border-accent bg-ink text-surface' : 'border-line-soft text-ink-muted hover:border-line'
          }`}
        >
          <span className="truncate">{t('review.general')}</span>
          {generalCount ? <span className="shrink-0 text-caption">{generalCount}</span> : null}
        </button>
      </nav>

      {/* The screen */}
      <section className="flex min-h-[50vh] min-w-0 flex-1 flex-col gap-2 lg:min-h-0">
        {screen && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {canWrite && !screen.page && (
              <Button
                size="sm"
                variant={placing ? 'ghost' : 'primary'}
                aria-pressed={placing}
                title={t('review.pinButtonTitle')}
                onClick={() => setPlacing((v) => !v)}
              >
                <Icon name={placing ? 'close' : 'pin'} size={15} />
                {t(placing ? 'review.pinCancel' : 'review.pinButton')}
              </Button>
            )}
            <span className="min-w-0 flex-1 text-caption text-ink-muted">
              {t(placing ? 'review.placingHint' : canWrite && !screen.page ? 'review.howTo' : 'review.howToReadOnly')}
            </span>
          </div>
        )}
        {/* A fixed height below lg: the column has only a minimum there, and a
            box whose height is a percentage of a minimum measures zero. */}
        <div
          className={`relative h-[60vh] min-h-0 bg-sunken p-2 lg:h-auto lg:flex-1 ${placing ? 'outline outline-2 -outline-offset-2 outline-accent' : ''}`}
        >
          {screen ? (
            <ScreenFit
              key={flowNonce}
              screen={asScreen(screen)}
              flow={flow}
              animations={screen.animations}
              demoLinks={demoLinks}
              onNavigate={(id) => setTarget(id)}
              onOverlayClick={
                placing && canWrite && !screen.page
                  ? (at) => {
                      setPin(at)
                      setPlacing(false)
                      // The field the pin's comment is written in. `Textarea` passes no ref.
                      document.getElementById('review-draft')?.focus()
                    }
                  : undefined
              }
              overlay={
                <>
                  {pins.map(({ comment, n }) => (
                    <button
                      key={comment.id}
                      type="button"
                      title={comment.text}
                      aria-label={t('review.pinLabel', { n, author: comment.author })}
                      onClick={() => {
                        setFocusId(comment.id)
                        document.getElementById(`review-c-${comment.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
                      }}
                      className={`pointer-events-auto absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-surface text-caption font-semibold shadow-lg ${
                        comment.resolvedAt ? 'bg-ink-faint text-surface' : 'bg-accent text-on-accent'
                      } ${focusId === comment.id ? 'ring-2 ring-accent ring-offset-2' : ''}`}
                      style={{ left: `${(comment.x ?? 0) * 100}%`, top: `${(comment.y ?? 0) * 100}%` }}
                    >
                      {n}
                    </button>
                  ))}
                  {pin && (
                    <span
                      aria-hidden
                      className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-pulse items-center justify-center rounded-full border-2 border-dashed border-accent bg-surface text-caption font-semibold text-accent-ink"
                      style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                    >
                      {pins.length + 1}
                    </span>
                  )}
                </>
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-body-sm text-ink-muted">
              {t('review.generalHelp')}
            </div>
          )}
        </div>
      </section>

      {/* Threads */}
      <aside aria-label={t('review.comments')} className="flex min-h-0 shrink-0 flex-col gap-2 lg:w-80">
        {error && <Banner tone="danger">{error}</Banner>}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {threads.length === 0 ? (
            <p className="text-body-sm text-ink-faint">{t('review.noComments')}</p>
          ) : (
            threads.map(({ root, replies }) => (
              <article
                key={root.id}
                id={`review-c-${root.id}`}
                onMouseEnter={() => setFocusId(root.id)}
                className={`rounded-lg border px-3 py-2 ${focusId === root.id ? 'border-accent' : 'border-line-soft'} ${
                  root.resolvedAt ? 'opacity-70' : ''
                }`}
              >
                <CommentBody comment={root} n={pinNumber.get(root.id)} when={when} />
                {replies.map((r) => (
                  <div key={r.id} className="mt-2 border-l-2 border-line-soft pl-2">
                    <CommentBody comment={r} when={when} />
                  </div>
                ))}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {canWrite && (
                    <Button size="sm" variant="quiet" onClick={() => setReplyTo(replyTo === root.id ? null : root.id)}>
                      {t('review.reply')}
                    </Button>
                  )}
                  {mode === 'owner' && onResolve && (
                    <Button size="sm" variant="quiet" onClick={() => void onResolve(root.id, !root.resolvedAt)}>
                      <Icon name={root.resolvedAt ? 'undo' : 'check'} size={14} />
                      {t(root.resolvedAt ? 'review.reopen' : 'review.resolve')}
                    </Button>
                  )}
                  {root.resolvedAt && <span className="ml-auto text-caption text-ok">{t('review.resolved')}</span>}
                </div>
                {replyTo === root.id && (
                  <form
                    className="mt-2 flex flex-col gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      submitReply(root)
                    }}
                  >
                    <Textarea
                      autoFocus
                      rows={2}
                      value={replyDraft}
                      aria-label={t('review.replyLabel')}
                      onChange={(e) => setReplyDraft(e.target.value)}
                    />
                    <Button size="sm" variant="primary" type="submit" disabled={sending || !replyDraft.trim() || needsName}>
                      {t('review.send')}
                    </Button>
                  </form>
                )}
              </article>
            ))
          )}
        </div>

        {canWrite ? (
          <form
            className="shrink-0 space-y-2 border-t border-line-soft pt-2"
            onSubmit={(e) => {
              e.preventDefault()
              submitNew()
            }}
          >
            {mode === 'reviewer' && (
              <Input
                value={author ?? ''}
                maxLength={60}
                placeholder={t('review.namePlaceholder')}
                aria-label={t('review.nameLabel')}
                onChange={(e) => onAuthorChange?.(e.target.value)}
              />
            )}
            {pin && (
              <div className="flex items-center justify-between text-caption text-accent-ink">
                <span>{t('review.pinnedAt', { n: pins.length + 1 })}</span>
                <button type="button" className="underline" onClick={() => setPin(null)}>
                  {t('review.unpin')}
                </button>
              </div>
            )}
            <Textarea
              id="review-draft"
              rows={3}
              maxLength={2000}
              value={draft}
              placeholder={target ? t('review.commentPlaceholder') : t('review.generalPlaceholder')}
              aria-label={t('review.commentLabel')}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitNew()
              }}
            />
            <Button variant="primary" type="submit" className="w-full" disabled={sending || !draft.trim() || needsName}>
              <Icon name="comment" size={15} />
              {t('review.send')}
            </Button>
            {needsName && <p className="text-caption text-ink-faint">{t('review.nameNeeded')}</p>}
          </form>
        ) : (
          <p className="shrink-0 text-caption text-ink-faint">{t('review.closedNoWrite')}</p>
        )}
      </aside>
    </div>
  )
}

function CommentBody({ comment, n, when }: { comment: ReviewComment; n?: number; when: (at: number) => string }) {
  const t = useT()
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        {n !== undefined && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-caption font-semibold text-on-accent">
            {n}
          </span>
        )}
        <span className="min-w-0 truncate text-body-sm font-semibold text-ink">{comment.author}</span>
        {comment.from === 'owner' && <span className="text-caption text-accent-ink">{t('review.ownerBadge')}</span>}
        <span className="ml-auto shrink-0 text-caption text-ink-faint">{when(comment.at)}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words text-body-sm text-ink">{comment.text}</p>
    </div>
  )
}
