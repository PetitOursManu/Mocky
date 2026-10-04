/**
 * The project merge, on the server — a hand-kept MIRROR of src/lib/merge.ts.
 *
 * `PUT /api/data` used to overwrite the account's blob with whatever the
 * browser sent. That was safe while the browser was the only writer and
 * reconciled at sign-in. It stops being safe the day something else writes a
 * project — the MCP runner (plans/mcp-serveur.md), or simply a second device
 * whose tab is open: the next debounced push from any tab replaced the blob
 * with that tab's copy, and a project only the server knew about was gone.
 *
 * So the server merges what it is sent into what it holds, by the rule the
 * browser already applies at sign-in and between tabs: a project known to one
 * side is kept, a project known to both is resolved by `updatedAt` as a whole,
 * deletions travel as tombstones. The SENDER wins ties, which is the browser's
 * "local wins ties" read from the server's side — a tab that is up to date
 * changes nothing by pushing.
 *
 * A mirror because `node server/index.js` cannot import a `.ts` file at the
 * 22.12 floor — the same deliberate duplication as server/video/timeline.js.
 * `server/merge.test.js` runs one corpus through both and requires identical
 * answers: edit one side alone and the suite fails.
 */

/** How long a deleted project keeps its tombstone before being forgotten. */
export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Parse a persisted projects blob, tolerating null/garbage/legacy shapes. */
export function parseProjects(raw) {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** `updatedAt`, falling back to `createdAt` for records written before it existed. */
function stamp(p) {
  return typeof p.updatedAt === 'number' ? p.updatedAt : typeof p.createdAt === 'number' ? p.createdAt : 0
}

/**
 * The newer copy of a project, plus the screens only the older copy has — and
 * that neither copy lists as deleted (`removedScreens`). See `unite` in
 * src/lib/merge.ts for why: two writers on one project used to lose the screen
 * the older copy had added.
 */
function unite(winner, loser, now) {
  if (winner.deletedAt || loser.deletedAt) return winner
  const winnerScreens = Array.isArray(winner.screens) ? winner.screens : []
  const loserScreens = Array.isArray(loser.screens) ? loser.screens : []
  const has = new Set(winnerScreens.map((s) => s?.id))
  const gone = { ...(loser.removedScreens || {}), ...(winner.removedScreens || {}) }
  const extra = loserScreens.filter((s) => s && typeof s.id === 'string' && !has.has(s.id) && !(s.id in gone))
  if (!extra.length) return winner
  const removedScreens = {}
  for (const [id, at] of Object.entries(gone)) {
    if (typeof at === 'number' && now - at <= TOMBSTONE_TTL_MS) removedScreens[id] = at
  }
  return { ...winner, screens: [...winnerScreens, ...extra], removedScreens }
}

/**
 * Merge two sets of projects. Neither argument is mutated.
 *
 * `local` wins ties — on the server, `local` is what the request carries.
 */
export function mergeProjects(local, server) {
  const byId = new Map()
  const now = Date.now()

  for (const p of server) {
    if (p && typeof p.id === 'string') byId.set(p.id, p)
  }
  for (const p of local) {
    if (!p || typeof p.id !== 'string') continue
    const other = byId.get(p.id)
    if (!other) {
      byId.set(p.id, p)
      continue
    }
    // >= : ties go to local.
    byId.set(p.id, stamp(p) >= stamp(other) ? unite(p, other, now) : unite(other, p, now))
  }

  return [...byId.values()]
    .filter((p) => !(p.deletedAt && now - p.deletedAt > TOMBSTONE_TTL_MS))
    .sort((a, b) => stamp(b) - stamp(a))
}

/**
 * The projects string to store, given what the request sent and what is on
 * disk, and whether the sender is missing something it should read back
 * (`merged: true` in the answer).
 *
 * "Missing something" is asked of the RECORDS, not of the string: the merge
 * sorts by date and a tab keeps its own order, so comparing the two strings
 * said "differs" after every edit and sent every tab to read back what it had
 * just written. A record the sender did not send — a project only the server
 * knew, or a copy of one that was newer here — is the only thing worth a read.
 * A tombstone the merge forgot is not: the sender forgets it on its own.
 *
 * A request that sent no projects at all keeps what is stored: an empty or
 * null field has never been a way to delete projects (that is a tombstone),
 * and treating it as one is how a fresh origin used to wipe an account.
 */
export function mergeStoredProjects(incomingRaw, storedRaw) {
  if (incomingRaw == null && storedRaw == null) return { projects: null, merged: false }
  const incoming = parseProjects(incomingRaw)
  const result = mergeProjects(incoming, parseProjects(storedRaw))
  const sent = new Set(incoming)
  return { projects: JSON.stringify(result), merged: result.some((p) => !sent.has(p)) }
}
