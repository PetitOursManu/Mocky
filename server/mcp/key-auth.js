/**
 * `/mcp` with an assistant key (X8) — the second door, beside OAuth, and
 * chosen on the key's prefix alone.
 *
 * routes.js sends a request here only when its bearer value starts with
 * `mocky_ak_`; every other value goes to the SDK's `requireBearerAuth` and
 * provider.js exactly as before. Nothing on the OAuth path changes.
 *
 * What a key must clear, on every call:
 *  1. its address and its lookup are not frozen (10 failures, 15 minutes —
 *     `auth-lockout.js`, counted per address AND per key, so neither many keys
 *     from one machine nor one key from many machines can be guessed at);
 *  2. the administrator's "assistant keys" switch is on (off, keys are
 *     suspended, not deleted);
 *  3. it is a real, unexpired, unrevoked key — compared in constant time;
 *  4. its account exists and is still on the access list (`scopeAllows`, which
 *     fails closed) — otherwise its keys go, as an OAuth connection would (X2);
 *  5. its account is not locked by failed sign-ins.
 *
 * A failure of 2 or 3 answers exactly what an invalid OAuth token answers —
 * built by the SDK's own middleware, so it is the same to the byte — whatever
 * the reason: unknown, wrong secret, expired, revoked, switched off. A guess
 * learns nothing, and is counted (3) and logged as `mocky auth failure
 * user="assistant-key"`, which the fail2ban filter already matches. The key is
 * never in a log line, an error, `req.auth` or an audit entry.
 *
 * Then `req.auth` is what the SDK's middleware would have set, plus
 * `extra.via = 'key'` and the key's level, and the same handler runs: the
 * switch (X1), the quotas, "one job at a time" and maintenance are inherited
 * rather than rewritten.
 *
 * Nothing thrown in here leaves it. Express 4 does not catch a rejected
 * middleware, so a disk that refused `revokeUser`'s write once took the whole
 * server down with it: anything unexpected is the SDK's own neutral 500, the
 * request goes no further, and the log names the failure's code — never the
 * key, and never an error message that might quote it.
 */
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js'
import { InvalidTokenError, ServerError, TooManyRequestsError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import { scopeAllows } from '../access.js'
import { createLockout } from '../auth-lockout.js'
import { isKeyToken, parseKey } from './keys.js'
import { levelOf } from './levels.js'

/** The name every key event is logged under — never anything that comes from the key. */
export const KEY_LOG_NAME = 'assistant-key'
/** `req.auth.expiresAt` for a key with no expiry: an hour from now, re-read on the next call. */
const AUTH_HORIZON_S = 60 * 60

export const INVALID_KEY_MESSAGE = 'Invalid or expired token.'
export const NOT_ALLOWED_MESSAGE = 'This account may no longer connect an assistant.'

/** The bearer value, split exactly as the SDK splits it. Null when there is none. */
export function bearerOf(req) {
  const h = req?.headers?.authorization
  if (typeof h !== 'string') return null
  const [type, token] = h.split(' ')
  return type && type.toLowerCase() === 'bearer' && token ? token : null
}

/**
 * @param {object} o
 * @param {ReturnType<import('./keys.js').createKeyStore>} o.keys
 * @param {() => object} o.config                         the MCP config (config.js)
 * @param {(id: string) => object|undefined} o.findUser
 * @param {(username: string) => number} o.accountLocked  seconds left on the account's freeze, or 0
 * @param {(event: string, req, username: string) => void} o.logAuth
 * @param {(req) => string|null} o.clientIp
 * @param {() => string} o.resource                       the /mcp URL
 * @param {string} o.resourceMetadataUrl
 */
export function createKeyAuth({
  keys,
  config,
  findUser,
  accountLocked = () => 0,
  logAuth = () => {},
  clientIp = (req) => req?.ip || null,
  resource,
  resourceMetadataUrl,
  lockouts = { addr: createLockout(), key: createLockout() },
  now = () => Date.now(),
}) {
  /** The SDK's own 401, for one message: the same status, body and WWW-Authenticate as an OAuth refusal. */
  const refuser = (message) =>
    requireBearerAuth({
      verifier: {
        async verifyAccessToken() {
          throw new InvalidTokenError(message)
        },
      },
      resourceMetadataUrl,
    })
  const invalid = refuser(INVALID_KEY_MESSAGE)
  const notAllowed = refuser(NOT_ALLOWED_MESSAGE)
  const unreachable = () => {}
  /** Answer with one of the refusals above; the request goes no further. */
  async function refuse(refusal, req, res) {
    await refusal(req, res, unreachable)
    return false
  }

  function frozen(res, seconds) {
    res.setHeader('Retry-After', String(Math.max(1, seconds)))
    res.status(429).json(new TooManyRequestsError('Too many failed attempts. Try again later.').toResponseObject())
  }

  /** Whether this request is for this module: a bearer value with the key prefix. */
  const handles = (req) => isKeyToken(bearerOf(req))

  /** What an unexpected failure answers: the SDK's own 500, as its middleware words it. */
  function failed(res, err) {
    console.error(`mocky: assistant key check failed — ${typeof err?.code === 'string' ? err.code : 'error'}`)
    if (!res.headersSent) res.status(500).json(new ServerError('Internal Server Error').toResponseObject())
  }

  async function middleware(req, res, next) {
    let pass = false
    try {
      pass = await check(req, res)
    } catch (err) {
      return failed(res, err)
    }
    // Outside the try: what the handler does is not this module's failure.
    if (pass) next()
  }

  /** True when the request may go on, with `req.auth` set; otherwise it has been answered. */
  async function check(req, res) {
    const token = bearerOf(req)
    const ip = String(clientIp(req) || 'unknown')
    const lookup = parseKey(token)?.lookup ?? null

    // 1. Frozen: before anything is compared, so a frozen guesser learns nothing,
    // not even with the right key. Logged as `locked` only for the ADDRESS — a
    // key frozen by somebody else's guesses must not get its holder banned.
    const addrFor = lockouts.addr.lockedFor(ip)
    if (addrFor) {
      logAuth('locked', req, KEY_LOG_NAME)
      frozen(res, addrFor)
      return false
    }
    const keyFor = lookup ? lockouts.key.lockedFor(lookup) : 0
    if (keyFor) {
      frozen(res, keyFor)
      return false
    }

    // 2. Switched off: suspended. Nothing is compared and nothing counted —
    // no key can succeed, so there is nothing to guess at.
    if (config()?.keys !== true) return refuse(invalid, req, res)

    // 3. The key itself.
    const key = keys.verify(token)
    if (!key) {
      lockouts.addr.fail(ip)
      if (lookup) lockouts.key.fail(lookup)
      logAuth('failure', req, KEY_LOG_NAME)
      return refuse(invalid, req, res)
    }

    // 4. The account, and its right to an assistant, read now (X2).
    const user = findUser(key.userId)
    if (!user) {
      keys.revokeUser(key.userId)
      return refuse(invalid, req, res)
    }
    if (!scopeAllows(config().access, user)) {
      keys.revokeUser(user.id)
      return refuse(notAllowed, req, res)
    }

    // 5. The account's own lock. No log line: the key is valid, and banning
    // its holder's address for somebody else's password guesses is backwards.
    const lockedFor = accountLocked(user.username)
    if (lockedFor) {
      frozen(res, lockedFor)
      return false
    }

    lockouts.key.succeed(lookup)
    keys.touch(key.id)
    const nowS = Math.floor(now() / 1000)
    const horizon = nowS + AUTH_HORIZON_S
    req.auth = {
      // Never the key: the handlers get who and at which level, not the credential.
      token: '',
      clientId: KEY_LOG_NAME,
      scopes: [],
      expiresAt: key.expiresAt === null ? horizon : Math.min(horizon, Math.floor(key.expiresAt / 1000)),
      resource: new URL(resource()),
      extra: { userId: user.id, keyId: key.id, level: levelOf(key.level), via: 'key' },
    }
    return true
  }

  return { handles, middleware }
}
