/**
 * Who is on an administrator's list.
 *
 * The same three lines were written out five times — video clips, free photos,
 * Motion export, its 3D blocks, the Ultra series sizes — each trimming the id,
 * checking the array and calling `includes`. Five copies of an access check is
 * how one of them ends up accepting an id with a trailing space, or a list that
 * is not an array, while the other four refuse it. One copy here; each caller
 * keeps its own reading of the MODE, because those readings differ on purpose
 * (see `scopeAllows`).
 *
 * The rule every caller shares: an administrator is never allowed on their role
 * alone. The list is what names who used what, so an admin who wants a feature
 * adds themselves to it, like anyone else.
 */

/** Whether `user` is named in `userIds`. A missing id or a non-array list is never a yes. */
export function onList(userIds, user) {
  const id = typeof user?.id === 'string' ? user.id.trim() : ''
  return Boolean(id) && Array.isArray(userIds) && userIds.includes(id)
}

/**
 * A `{ mode, userIds }` scope, read so that it FAILS CLOSED: only `'all'` opens
 * it to everyone, and any other value — `'allowlist'`, a typo, nothing — means
 * the list decides.
 *
 * The older scopes read the mode the other way round (`mode !== 'allowlist'`
 * is open), and they keep doing so: changing how an existing file is read would
 * close a feature on an instance whose config says something unexpected, and
 * nobody would know why. A NEW scope guarding something an outsider could use —
 * the MCP server lets a model act as an account — starts closed instead.
 */
export function scopeAllows(scope, user) {
  if (scope?.mode === 'all') return true
  return onList(scope?.userIds, user)
}
