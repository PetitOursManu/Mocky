import { useEffect, useState } from 'react'
import { getStorageError, getSyncState, onSyncState, pushNow, type SyncState } from '../lib/sync'
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
  const [state, setState] = useState<SyncState>(() => getSyncState())
  const [retrying, setRetrying] = useState(false)

  useEffect(() => onSyncState(setState), [])

  if (state === 'idle') return null

  const storageError = getStorageError()

  if (state === 'syncing') {
    return (
      <span
        className="ml-1 flex h-8 items-center gap-1.5 px-2 text-caption font-semibold uppercase tracking-[0.14em] text-accent-ink"
        title="Enregistrement sur le serveur…"
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Enregistrement…
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
      title={
        storageError ||
        'Vos modifications n’ont pas pu être enregistrées sur le serveur. Elles sont toujours dans ce navigateur. Cliquez pour réessayer.'
      }
    >
      <Icon name="warning" size={16} />
      {retrying ? 'Nouvel essai…' : 'Non enregistré'}
    </button>
  )
}
