import { useEffect, useState } from 'react'
import { getStorageError, getSyncState, onSyncState, pushNow, type SyncState } from '../lib/sync'
import { useT } from '../i18n'
import { Icon } from '../ui'

/**
 * Shows whether the local work has reached the server.
 *
 * sync.ts always had a status channel — the comment describing it as "lets the
 * UI show a syncing… / sync failed indicator" was there from the start — but
 * nothing ever imported it. A sync that exhausted its retries was therefore
 * invisible: the user kept working, believing everything was saved.
 *
 * Deliberately silent while idle: an indicator that is always on stops being
 * read. It appears only when something is in flight or wrong.
 */
export default function SyncIndicator() {
  const t = useT()
  const [state, setState] = useState<SyncState>(() => getSyncState())
  const [retrying, setRetrying] = useState(false)

  useEffect(() => onSyncState(setState), [])

  if (state === 'idle') return null

  const storageError = getStorageError()

  if (state === 'syncing') {
    return (
      <span
        className="ml-1 flex h-8 items-center gap-1.5 px-2 text-caption font-semibold uppercase tracking-[0.14em] text-accent-ink"
        title={t('auth.sync.savingTitle')}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        {t('sync.saving')}
      </span>
    )
  }

  return (
    <button
      type="button"
      disabled={retrying}
      onClick={async () => {
        setRetrying(true)
        try {
          await pushNow()
        } catch {
          /* the state channel already says it failed */
        } finally {
          setRetrying(false)
        }
      }}
      className="ml-1 flex h-8 items-center gap-1.5 border border-danger bg-danger/15 px-2.5 text-caption font-semibold uppercase tracking-[0.14em] text-danger transition hover:bg-danger/25 disabled:opacity-60"
      // sync.ts hands back a key rather than a sentence: it has no React context,
      // and a message frozen at failure time would stay in the old language after
      // the user switched.
      title={storageError ? t(storageError.key, { detail: storageError.detail ?? '' }) : t('sync.failedHelp')}
    >
      <Icon name="warning" size={16} />
      {retrying ? t('sync.retrying') : t('sync.failed')}
    </button>
  )
}
