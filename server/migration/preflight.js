// "Does the new server have everything the old one relied on?" — answered as a
// list of named checks, compared rather than guessed.
//
// Pure on purpose: the facts are gathered elsewhere (local disk, local
// binaries, the source's manifest), and this only compares them. That is what
// lets a test sweep every combination without a second server.
//
// Each check is `{ id, status, params }`. The words are the client's
// (`migration.check.<id>.<status>` in both dictionaries), for the reason
// `sync.ts` hands back keys: a sentence frozen on the server stays in the
// language it was written in.
//
// Only four checks BLOCK the transfer, and each is one where going ahead is
// certain to break something: an older Mocky reading newer data, a Node below
// the floor, a disk that will fill, a directory that cannot be written. Every
// other gap is a warning, because the admin may be about to fix it — setting
// an environment variable does not need the transfer to wait.

/** Mirrors `.nvmrc` and `engines` in package.json. */
export const NODE_FLOOR = [22, 12, 0]

/** Head-room on top of the bytes to transfer: staging, journals, the library growing meanwhile. */
export const DISK_MARGIN = 1.1

/** Past this, the signed requests themselves start failing (crypto.js MAX_SKEW_MS is 5 min). */
const CLOCK_WARN_MS = 60_000
const CLOCK_FAIL_MS = 4 * 60_000

export function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v || ''))
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

export function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  return 0
}

/**
 * @param {object} source   what the old server said about itself (manifest.facts)
 * @param {object} local    what this server found about itself
 * @returns {{ checks: Array<{id:string,status:'ok'|'warn'|'fail',params?:object}>, blocking: boolean }}
 */
export function comparePreflight(source, local) {
  const checks = []
  const add = (id, status, params) => checks.push(params ? { id, status, params } : { id, status })

  // --- blocking ---------------------------------------------------------
  const node = parseVersion(local.node)
  add('node', node && compareVersions(node, NODE_FLOOR) >= 0 ? 'ok' : 'fail', {
    local: local.node,
    floor: NODE_FLOOR.join('.'),
  })

  const lv = parseVersion(local.mocky)
  const sv = parseVersion(source.mocky)
  if (!lv || !sv) add('version', 'warn', { local: local.mocky, source: source.mocky })
  else {
    const c = compareVersions(lv, sv)
    // Newer reading older is how every Mocky upgrade already works (each store
    // reads its old shapes). Older reading newer is not: a field it does not
    // know is a field it drops the first time it writes.
    add('version', c === 0 ? 'ok' : c > 0 ? 'warn' : 'fail', { local: local.mocky, source: source.mocky })
  }

  const needed = Math.ceil((source.summary?.bytes || 0) * DISK_MARGIN)
  if (local.disk?.free == null) add('disk', 'warn', { needed })
  else add('disk', local.disk.free >= needed ? 'ok' : 'fail', { needed, free: local.disk.free })

  add('writable', local.writable ? 'ok' : 'fail')

  // --- warnings ---------------------------------------------------------
  // Replacing an instance that already has users is allowed, never silent.
  add('empty', local.empty ? 'ok' : 'warn', { users: local.users || 0 })

  if (source.needs?.ffmpeg) add('ffmpeg', local.ffmpeg ? 'ok' : 'warn')

  if (source.needs?.videoWorker) {
    add('worker', local.worker?.available ? 'ok' : 'warn', {
      url: source.needs.videoWorker,
      detail: local.worker?.detail || '',
    })
  }

  // SSO: the secret itself never travels; only a tag under the pairing key does.
  // Missing locally means every Dashy-only account is locked out on arrival.
  if (source.sso?.enabled) {
    if (!local.sso?.enabled) add('sso', 'warn', { reason: 'missing' })
    else if (source.sso.secretTag !== local.sso.secretTag) add('sso', 'warn', { reason: 'secret' })
    else if (source.sso.dashyUrl !== local.sso.dashyUrl) add('sso', 'warn', { reason: 'dashy' })
    else add('sso', 'ok')
  }

  // A different origin is expected when the domain changes; it only matters to
  // SSO (the token audience) and to cookies' Secure flag, so it is information.
  if (source.origin && source.origin !== local.origin) {
    add('origin', 'warn', { source: source.origin, local: local.origin || '' })
  }

  if (source.trustProxy && !local.trustProxy) add('proxy', 'warn')

  if (typeof source.now === 'number' && typeof local.now === 'number') {
    const skew = Math.abs(source.now - local.now)
    add('clock', skew > CLOCK_FAIL_MS ? 'fail' : skew > CLOCK_WARN_MS ? 'warn' : 'ok', {
      seconds: Math.round(skew / 1000),
    })
  }

  // Not a property of the new server, but the admin is reading this list to
  // decide what to do next, and both say "not yet".
  if (!source.maintenance) add('maintenance', 'warn')
  if (source.queue?.active) add('queue', 'warn', { active: source.queue.active })

  return { checks, blocking: checks.some((c) => c.status === 'fail') }
}
