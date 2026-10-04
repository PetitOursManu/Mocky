/**
 * The OAuth 2.1 authorization server behind Mocky's MCP endpoint — the
 * `OAuthServerProvider` the SDK's router calls.
 *
 * The SDK does the protocol: metadata, client registration, PKCE verification,
 * the token endpoint's grammar, redirect_uri matching at /authorize. This file
 * decides everything that is MOCKY's to decide:
 *
 *  - who the person is: the Mocky session they already have (`mocky_sess`).
 *    /authorize never asks for a password; it sends the browser to a consent
 *    page in Mocky, which signs them in first if it has to;
 *  - whether they may: `scopeAllows(config.access, user)`, read again on EVERY
 *    call (X2) — removing someone from the list cuts them off at their next
 *    request, and their connections go with it;
 *  - which clients may register at all (`config.clients`, KNOWN_REDIRECT_HOSTS);
 *  - what a token is for: one resource, `${origin}/mcp` (RFC 8707). A token
 *    minted for anything else is refused, which is the confused-deputy hole the
 *    MCP specification names.
 */
import {
  AccessDeniedError,
  InvalidClientMetadataError,
  InvalidGrantError,
  InvalidRequestError,
  InvalidTargetError,
  InvalidTokenError,
  TemporarilyUnavailableError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js'
import { scopeAllows } from '../access.js'
import { KNOWN_REDIRECT_HOSTS } from './config.js'

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

/** Whether a redirect URI belongs to a client this instance accepts. */
export function redirectAllowed(uri, policy) {
  let u
  try {
    u = new URL(uri)
  } catch {
    return false
  }
  if (u.hash) return false
  const loopback = u.protocol === 'http:' && LOOPBACK.has(u.hostname)
  if (u.protocol !== 'https:' && !loopback) return false
  if (policy === 'any') return true
  return loopback || KNOWN_REDIRECT_HOSTS.includes(u.hostname.toLowerCase())
}

/** The same resource, written either way (`/mcp` vs `/mcp/`, a fragment). */
function sameResource(a, b) {
  const norm = (x) => {
    const u = new URL(String(x))
    u.hash = ''
    return u.href.replace(/\/+$/, '')
  }
  try {
    return norm(a) === norm(b)
  } catch {
    return false
  }
}

/**
 * @param {object} deps
 * @param {ReturnType<import('./oauth-store.js').createOAuthStore>} deps.store
 * @param {() => object} deps.config            the live McpConfigStore value
 * @param {() => string} deps.resource          `${origin}/mcp`
 * @param {(id: string) => object|undefined} deps.findUser
 * @param {() => boolean} [deps.maintenance]    no new grants while read-only
 * @param {(event: object) => void} [deps.onEvent]  audit hook: connect / reuse
 */
export function createMcpOAuthProvider({ store, config, resource, findUser, maintenance = () => false, onEvent = () => {} }) {
  const ttl = () => ({
    accessMs: config().tokenTtl.accessMin * 60 * 1000,
    refreshMs: config().tokenTtl.refreshDays * 24 * 60 * 60 * 1000,
  })

  /** The user behind a connection, if they still exist and are still allowed. */
  function allowedUser(userId) {
    const user = findUser(userId)
    return user && scopeAllows(config().access, user) ? user : null
  }

  function tokensFor(access, refresh, scopes) {
    return {
      access_token: access,
      token_type: 'bearer',
      expires_in: Math.round(ttl().accessMs / 1000),
      refresh_token: refresh,
      ...(scopes?.length ? { scope: scopes.join(' ') } : {}),
    }
  }

  const clientsStore = {
    getClient: (id) => store.getClient(id),
    registerClient(info) {
      const uris = Array.isArray(info.redirect_uris) ? info.redirect_uris : []
      if (!uris.length || !uris.every((u) => redirectAllowed(u, config().clients))) {
        throw new InvalidClientMetadataError(
          config().clients === 'known'
            ? 'This Mocky accepts connections from Claude and ChatGPT only (an administrator can open it to any client).'
            : 'Redirect URIs must be https, or http on a loopback address.',
        )
      }
      try {
        return store.registerClient(info)
      } catch (err) {
        throw new TemporarilyUnavailableError(err.message)
      }
    },
  }

  return {
    clientsStore,

    /**
     * Step one: remember the request and send the browser to Mocky's consent
     * page. Who is asking is not known yet, and it does not need to be — the
     * consent page is behind the session like every other page.
     */
    async authorize(client, params, res) {
      if (params.resource && !sameResource(params.resource, resource())) {
        throw new InvalidTargetError('This authorization server only issues tokens for its own /mcp endpoint.')
      }
      let id
      try {
        id = store.addPending({
          clientId: client.client_id,
          clientName: String(client.client_name || 'Assistant').slice(0, 80),
          redirectUri: params.redirectUri,
          codeChallenge: params.codeChallenge,
          state: params.state,
          scopes: params.scopes || [],
        })
      } catch (err) {
        throw new TemporarilyUnavailableError(err.message)
      }
      res.redirect(302, `/connect/${id}`)
    },

    async challengeForAuthorizationCode(client, code) {
      const grant = store.peekCode(code)
      if (!grant || grant.clientId !== client.client_id) throw new InvalidGrantError('Invalid authorization code.')
      return grant.codeChallenge
    },

    async exchangeAuthorizationCode(client, code, _verifier, redirectUri, res) {
      const grant = store.takeCode(code)
      if (!grant || grant.clientId !== client.client_id) throw new InvalidGrantError('Invalid authorization code.')
      // OAuth 2.1 §4.1.3: the redirect_uri, when it was in the request, must be the same.
      if (redirectUri !== undefined && redirectUri !== grant.redirectUri) throw new InvalidGrantError('redirect_uri does not match.')
      if (res && !sameResource(res, resource())) throw new InvalidTargetError('Wrong resource.')
      // Consent was given a moment ago, but the list could have changed since.
      if (!allowedUser(grant.userId)) throw new AccessDeniedError('This account may no longer connect an assistant.')
      if (maintenance()) throw new TemporarilyUnavailableError('Mocky is in maintenance.')
      const { connection, access, refresh } = store.createConnection({
        userId: grant.userId,
        clientId: client.client_id,
        clientName: grant.clientName,
        scopes: grant.scopes,
        ...ttl(),
      })
      onEvent({ type: 'connect', userId: grant.userId, connectionId: connection.id, clientName: grant.clientName })
      return tokensFor(access, refresh, grant.scopes)
    },

    async exchangeRefreshToken(client, refreshToken, _scopes, res) {
      if (res && !sameResource(res, resource())) throw new InvalidTargetError('Wrong resource.')
      if (maintenance()) throw new TemporarilyUnavailableError('Mocky is in maintenance.')
      const out = store.rotate(refreshToken, client.client_id, ttl())
      if (out.reused) {
        onEvent({ type: 'reuse', userId: out.connection.userId, connectionId: out.connection.id, clientName: out.connection.clientName })
      }
      if (!out.ok) throw new InvalidGrantError('Invalid refresh token.')
      if (!allowedUser(out.connection.userId)) {
        store.revoke(out.connection.id)
        throw new AccessDeniedError('This account may no longer connect an assistant.')
      }
      return tokensFor(out.access, out.refresh, out.connection.scopes)
    },

    /** Every /mcp call comes through here: the access check is per call, not per token (X2). */
    async verifyAccessToken(token) {
      const found = store.findToken(token)
      if (!found || found.rec.kind !== 'access') throw new InvalidTokenError('Invalid or expired token.')
      const user = allowedUser(found.conn.userId)
      if (!user) {
        store.revoke(found.conn.id)
        throw new InvalidTokenError('This account may no longer connect an assistant.')
      }
      store.touch(found.conn.id)
      return {
        token,
        clientId: found.conn.clientId,
        scopes: found.conn.scopes || [],
        expiresAt: Math.floor(found.rec.expiresAt / 1000),
        resource: new URL(resource()),
        extra: { userId: user.id, connectionId: found.conn.id },
      }
    },

    async revokeToken(client, request) {
      store.revokeToken(request.token, client.client_id)
    },

    // ---- the consent page's two calls (not part of the SDK interface) ------

    /** What the consent page shows. Null when the request is unknown or expired. */
    describePending(id) {
      const p = store.getPending(id)
      if (!p) return null
      let host = ''
      try {
        host = new URL(p.redirectUri).host
      } catch {
        /* checked at registration; an unreadable one shows nothing */
      }
      return { clientName: p.clientName, redirectHost: host }
    },

    /**
     * The person's answer: `{ redirect }`, the URL to send their browser to —
     * the client's redirect URI with a code, or with `error=access_denied`.
     * `notAllowed` is set when THIS account may not connect at all, so the page
     * can say why before handing the assistant its refusal. Throws only for a
     * request that no longer exists.
     */
    decide(id, user, approve) {
      const p = store.takePending(id)
      if (!p) throw new InvalidRequestError('This request has expired. Start again from the assistant.')
      const back = new URL(p.redirectUri)
      if (p.state !== undefined) back.searchParams.set('state', p.state)
      const refuse = (notAllowed) => {
        back.searchParams.set('error', 'access_denied')
        return notAllowed ? { redirect: back.href, notAllowed: true } : { redirect: back.href }
      }
      if (!approve) return refuse(false)
      if (!allowedUser(user.id)) return refuse(true)
      const code = store.issueCode({
        clientId: p.clientId,
        clientName: p.clientName,
        userId: user.id,
        redirectUri: p.redirectUri,
        codeChallenge: p.codeChallenge,
        scopes: p.scopes,
      })
      back.searchParams.set('code', code)
      return { redirect: back.href }
    },
  }
}
