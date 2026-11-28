/**
 * WHOSE copy this browser holds.
 *
 * The projects, the DESIGN.md and the folders live in localStorage under keys
 * that name no account, and sign-in MERGES that copy into the account it signs
 * in to (sync.ts, `reconcileOnLogin`) — which is right for one person and two
 * devices, and was a leak for two people and one browser: sign-out left the
 * copy where it was ("your projects stay on this device"), the next person to
 * sign in on that computer had it merged into THEIR account, and pushed to the
 * server, where it stayed. On a shared machine every account ended up with
 * every other account's projects.
 *
 * So the copy carries its owner (`OWNER_KEY`, an account id, never a name), a
 * copy is only ever merged into the account that owns it, and signing out
 * forgets it. The server keeps the account's projects; nothing is lost by
 * forgetting the browser's copy once it has been pushed.
 */
export const OWNER_KEY = 'mocky.owner.v1'

/**
 * What belongs to the account rather than to the browser. Theme, language and
 * the like stay: they describe the machine, not anybody's work.
 */
export const ACCOUNT_KEYS = [
  'mocky.projects.v1',
  'mocky.design.v1',
  'mocky.folders.v1',
  // Pictures of the screens, by screen id.
  'mocky.thumbs.v1',
  'mocky.history.v1',
  'mocky.home.tree',
] as const

/** The person's own provider and KEY (lib/settings.ts) — a credential. */
export const SETTINGS_KEY = 'mocky.settings.v1'

/** The account this browser's copy belongs to, or null when it was never claimed. */
export function localOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY)
  } catch {
    return null
  }
}

export function setLocalOwner(accountId: string): void {
  try {
    localStorage.setItem(OWNER_KEY, accountId)
  } catch {
    /* quota: the next sign-in asks again, and a copy with no owner is never merged whole */
  }
}

/** Whether any of the account's data is in this browser. */
export function hasAccountData(): boolean {
  try {
    return ACCOUNT_KEYS.some((k) => localStorage.getItem(k) !== null)
  } catch {
    return false
  }
}

/**
 * Forget the account's copy. `keepSettings` keeps the personal key: only for a
 * copy nobody claimed, where nothing says whose it is (see sync.ts).
 */
export function forgetAccountData({ keepSettings = false }: { keepSettings?: boolean } = {}): void {
  try {
    for (const k of ACCOUNT_KEYS) localStorage.removeItem(k)
    if (!keepSettings) localStorage.removeItem(SETTINGS_KEY)
    localStorage.removeItem(OWNER_KEY)
  } catch {
    /* nothing to forget */
  }
}
