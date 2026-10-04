/**
 * "Your projects changed somewhere else" — one Server-Sent Events stream per
 * open tab, and a ping to the account's OTHER tabs whenever its blob is written.
 *
 * Before this a tab learned about another writer only at sign-in, which was
 * enough while every writer was a tab of the same person on the same machine
 * (the `storage` event covers those). A second device, and soon the MCP runner
 * writing a screen the person asked for from Claude, write to the server and
 * nowhere else: the open tab would show the project without the new screen
 * until it was reloaded — and push its stale copy in the meantime, which the
 * server merge (server/merge.js) now refuses to let erase anything, but which
 * still leaves the person looking at the wrong project.
 *
 * What travels is a NAME, never data: `data-changed`, and the tab reads
 * `GET /api/data` itself, through the session it already has. A stream that
 * carried projects would be a second copy of the account's content sitting in
 * a proxy's buffers; a stream that carries a word is not.
 *
 * In memory, like presence: a restart drops the streams, every EventSource
 * reconnects on its own, and a tab that reconnects reads once (see sync.ts).
 */

/** A comment line every 25 s, so a proxy does not close an idle stream. */
export const KEEPALIVE_MS = 25_000

/**
 * Streams one account may hold. A tab per stream, so this is tabs — and a
 * leaking client reconnecting in a loop must not hold a socket per attempt.
 * The oldest goes first: it is the one most likely to be a tab already gone.
 */
export const MAX_STREAMS_PER_USER = 12

/** A tab id is ours to read back, so it is held to a shape before it is kept. */
const TAB_ID = /^[A-Za-z0-9_-]{8,64}$/

export function createDataEvents({ setInterval: every = setInterval, clearInterval: stop = clearInterval } = {}) {
  /** userId → Set<{ tab, res, close }>, in the order they opened. */
  const streams = new Map()

  /**
   * Open a stream for `userId`. `stillValid()` is asked at every keepalive: a
   * session revoked while the tab is open stops receiving, the same rule the
   * admin dashboard's live stream follows.
   */
  function subscribe(userId, tab, res, { stillValid = () => true } = {}) {
    let set = streams.get(userId)
    if (!set) streams.set(userId, (set = new Set()))
    while (set.size >= MAX_STREAMS_PER_USER) {
      const oldest = set.values().next().value
      oldest.close()
      oldest.res.end()
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // nginx buffers responses by default, which turns a stream into a reply
      // that arrives when it closes — that is, never.
      'x-accel-buffering': 'no',
    })
    res.write('retry: 5000\n\n')
    const entry = { tab: TAB_ID.test(String(tab || '')) ? String(tab) : null, res, close: null }
    const timer = every(() => {
      if (!stillValid()) {
        entry.close()
        res.end()
        return
      }
      res.write(': keepalive\n\n')
    }, KEEPALIVE_MS)
    let closed = false
    entry.close = () => {
      if (closed) return
      closed = true
      stop(timer)
      set.delete(entry)
      if (!set.size && streams.get(userId) === set) streams.delete(userId)
    }
    set.add(entry)
    res.on('close', entry.close)
    return entry.close
  }

  /**
   * Tell every stream of `userId` except the tab that did the writing. A write
   * with no tab id (the MCP runner, a script) reaches every tab.
   */
  function notify(userId, fromTab) {
    const set = streams.get(userId)
    if (!set) return 0
    let sent = 0
    for (const { tab, res } of set) {
      if (fromTab && tab === fromTab) continue
      res.write('event: data-changed\ndata: {}\n\n')
      sent++
    }
    return sent
  }

  /** How many streams are open — for tests and the dashboard, never their content. */
  function count(userId) {
    return userId ? streams.get(userId)?.size || 0 : [...streams.values()].reduce((n, s) => n + s.size, 0)
  }

  /** On shutdown: an open stream is a request that never ends, and would hold `server.close()`. */
  function closeAll() {
    for (const set of streams.values()) for (const entry of [...set]) (entry.close(), entry.res.end())
  }

  return { subscribe, notify, count, closeAll }
}
