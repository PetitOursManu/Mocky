/**
 * The runner's authority: one token per job, one account, a few routes.
 *
 * The headless page (src/runner/main.tsx) has no session — nobody signed in to
 * that Chromium. It calls the same routes the composer calls, and the server's
 * request router hands each of them this job's token in `x-mocky-runner`
 * (runner.js). `sessionUser` accepts the token as that account ONLY on the
 * routes a generation needs; anywhere else it is no one.
 *
 * Why not a session cookie for the account: a session can do everything the
 * person can — change their password, delete their projects, read every admin
 * page if they are an admin. The pipeline needs to call a model, ask Muse and
 * the image routes, and read and write the account's projects. And the page it
 * runs in mounts MODEL-WRITTEN code (the legibility probe's capture frame is
 * same-origin — see the long note in src/lib/capture.ts), so whatever this
 * token opens, a hostile component could open too. Least privilege is the
 * only honest answer.
 *
 * Tokens live in memory, hashed, and die with their job (or after a ceiling):
 * a restart revokes every one, which matches the queue — a restart fails every
 * running job.
 */
import crypto from 'node:crypto'

/** Longer than any job is allowed to run (runner.js `JOB_TIMEOUT_MS`), shorter than a forgotten token deserves. */
export const RUNNER_TOKEN_TTL_MS = 20 * 60 * 1000

/**
 * The routes a generation calls, as prefixes. Everything else — accounts,
 * sessions, settings, admin, shares, exports, MCP itself — is closed to it.
 */
export const RUNNER_ROUTES = [
  '/__provider',
  '/api/data',
  '/api/muse/',
  '/api/images/',
  '/api/text/vision',
  '/api/videos/',
  '/api/config',
  // Not the MCP server: the status of Muse's own scraper servers, the call
  // `museAvailable()` answers with. Closed, every `muse: true` an assistant
  // sent ran without Muse and said nothing about it.
  '/api/mcp/status',
]

/** Paths the token must never open, even under an allowed prefix. */
const NEVER = [/^\/api\/data\/events/]

/**
 * Whether the token may open `path` — the FULL path (`req.originalUrl`), since
 * under `app.use('/__provider')` Express hands handlers a path with the mount
 * stripped. A prefix ending in "/" covers what is under it; any other is the
 * route itself or its sub-paths.
 */
export function runnerRouteAllowed(path) {
  const p = String(path || '').split('?')[0]
  if (NEVER.some((re) => re.test(p))) return false
  return RUNNER_ROUTES.some((r) => (r.endsWith('/') ? p.startsWith(r) : p === r || p.startsWith(`${r}/`)))
}

export function createRunnerAuth({ now = () => Date.now() } = {}) {
  const tokens = new Map() // hash → { userId, jobId, expiresAt }
  const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex')

  function prune() {
    const t = now()
    for (const [h, rec] of tokens) if (rec.expiresAt <= t) tokens.delete(h)
  }

  return {
    /** A token for one job. Returns the token itself; only its hash is kept. */
    issue(userId, jobId) {
      prune()
      const token = crypto.randomBytes(32).toString('base64url')
      tokens.set(hash(token), { userId, jobId, expiresAt: now() + RUNNER_TOKEN_TTL_MS })
      return token
    },

    /** The account behind a token on THIS path, or null. */
    resolve(token, path) {
      if (!token || !runnerRouteAllowed(path)) return null
      const rec = tokens.get(hash(token))
      if (!rec || rec.expiresAt <= now()) return null
      return { userId: rec.userId, jobId: rec.jobId }
    },

    /** The job is over: its token stops working at once. */
    revokeJob(jobId) {
      for (const [h, rec] of tokens) if (rec.jobId === jobId) tokens.delete(h)
    },

    size: () => (prune(), tokens.size),
  }
}
