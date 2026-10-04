#!/usr/bin/env node
/**
 * mocky-mcp — a local bridge between an MCP client that runs on your machine
 * (Claude Desktop, Claude Code…) and a Mocky its assistant cannot reach from the
 * Internet: one on a LAN, behind a VPN, with a certificate only your machine
 * trusts.
 *
 * Claude and ChatGPT connect to a remote MCP server FROM THEIR OWN SERVERS, so
 * a Mocky that is not public is out of their reach (docs/mcp.md). A client on
 * your machine can start a local program instead, and talk to it over stdio:
 * this is that program. It speaks stdio to the client and Streamable HTTP to
 * Mocky's `/mcp`, and relays every message unchanged — it adds no tool, reads
 * nothing, decides nothing. Mocky stays the server, with the same OAuth, the
 * same consent page and the same rules (X1–X6).
 *
 *   mocky-mcp --url https://mocky.lan [--port 33418]
 *
 * The first time, it opens your browser on Mocky's consent page: sign in, Allow,
 * and the code comes back to a server listening on 127.0.0.1 only (Mocky
 * accepts loopback redirects for exactly this). The connection is then kept in
 * ~/.mocky-mcp/, readable by you alone; Settings → Connected assistants in
 * Mocky lists it and can cut it.
 *
 * stdout carries JSON-RPC and nothing else: every word for a person goes to
 * stderr. A Mocky whose certificate comes from your own CA: give it to Node
 * with NODE_EXTRA_CA_CERTS rather than switching checks off.
 *
 * Environment: MOCKY_MCP_BROWSER=none prints the address instead of opening a
 * browser (a headless machine, or a test); MOCKY_MCP_HOME moves ~/.mocky-mcp.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { auth, UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js'

const say = (line) => process.stderr.write(`mocky-mcp: ${line}\n`)

function argsOf(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--url') out.url = argv[++i]
    else if (a === '--port') out.port = Number(argv[++i])
    else if (a === '--help' || a === '-h') out.help = true
  }
  return out
}

/** Where one Mocky's connection is kept: one file per origin, mode 0600. */
function storeFor(origin) {
  const dir = process.env.MOCKY_MCP_HOME || path.join(os.homedir(), '.mocky-mcp')
  const file = path.join(dir, `${crypto.createHash('sha256').update(origin).digest('hex').slice(0, 16)}.json`)
  let data = {}
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    /* first run */
  }
  return {
    get: (k) => data[k],
    set(k, v) {
      data = { ...data, origin, [k]: v }
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
      const tmp = `${file}.${process.pid}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
      fs.renameSync(tmp, file)
    },
  }
}

/** The OAuth client the SDK drives: what to register as, and where to keep what it gets. */
function providerFor(store, redirectUrl, onRedirect) {
  return {
    get redirectUrl() {
      return redirectUrl
    },
    get clientMetadata() {
      return {
        client_name: 'Mocky bridge (mocky-mcp)',
        redirect_uris: [redirectUrl],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      }
    },
    state: () => {
      const s = crypto.randomBytes(16).toString('base64url')
      store.set('state', s)
      return s
    },
    // A registration made for another port is another client: register again.
    clientInformation: () => {
      const c = store.get('client')
      return c && Array.isArray(c.redirect_uris) && c.redirect_uris.includes(redirectUrl) ? c : undefined
    },
    saveClientInformation: (c) => store.set('client', c),
    tokens: () => store.get('tokens'),
    saveTokens: (t) => store.set('tokens', t),
    saveCodeVerifier: (v) => store.set('verifier', v),
    codeVerifier: () => store.get('verifier'),
    redirectToAuthorization: (url) => onRedirect(url),
    invalidateCredentials(scope) {
      if (scope === 'all' || scope === 'tokens') store.set('tokens', undefined)
      if (scope === 'all' || scope === 'client') store.set('client', undefined)
      if (scope === 'all' || scope === 'verifier') store.set('verifier', undefined)
    },
  }
}

function openBrowser(url) {
  say(`sign in to Mocky and allow the bridge: ${url}`)
  if (process.env.MOCKY_MCP_BROWSER === 'none') return
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]]
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref()
  } catch {
    /* the address is on stderr */
  }
}

/** Wait for Mocky to send the browser back to 127.0.0.1 with a code. */
function waitForCode(port, expectedState) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url || '/', `http://127.0.0.1:${port}`)
      if (u.pathname !== '/callback') return res.writeHead(404).end()
      const code = u.searchParams.get('code')
      const error = u.searchParams.get('error')
      const ok = Boolean(code) && u.searchParams.get('state') === expectedState()
      res.writeHead(ok ? 200 : 400, { 'content-type': 'text/html; charset=utf-8' })
      res.end(
        ok
          ? '<p style="font-family:sans-serif">Mocky is connected. You can close this tab.</p>'
          : '<p style="font-family:sans-serif">The connection was not completed. You can close this tab.</p>',
      )
      server.close()
      if (ok) resolve(code)
      else reject(new Error(error ? `Mocky answered: ${error}` : 'the answer did not match this request'))
    })
    server.on('error', reject)
    // Loopback only: the code must never be reachable from the network.
    server.listen(port, '127.0.0.1')
  })
}

async function main() {
  const opts = argsOf(process.argv.slice(2))
  if (opts.help || !opts.url) {
    say('usage: mocky-mcp --url https://your-mocky [--port 33418]')
    process.exit(opts.help ? 0 : 2)
  }
  const base = new URL(opts.url)
  const serverUrl = new URL('/mcp', base.origin)
  const port = Number.isInteger(opts.port) && opts.port > 0 ? opts.port : 33418
  const redirectUrl = `http://127.0.0.1:${port}/callback`
  const store = storeFor(base.origin)

  let redirected = null
  const provider = providerFor(store, redirectUrl, (url) => {
    redirected = url
  })

  /** The whole browser round trip; once per machine, again only if the connection was cut. */
  let authorizing = null
  function authorize() {
    authorizing ??= (async () => {
      redirected = null
      const first = await auth(provider, { serverUrl })
      if (first === 'AUTHORIZED') return
      const code = waitForCode(port, () => store.get('state'))
      if (redirected) openBrowser(String(redirected))
      const result = await auth(provider, { serverUrl, authorizationCode: await code })
      if (result !== 'AUTHORIZED') throw new Error('Mocky did not authorize the bridge')
      say('connected')
    })().finally(() => {
      authorizing = null
    })
    return authorizing
  }

  const remote = new StreamableHTTPClientTransport(serverUrl, { authProvider: provider })
  const local = new StdioServerTransport()
  const pending = []
  let ready = false

  const fail = (message, error) => {
    if (message && 'id' in message && message.id !== undefined) {
      void local.send({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: `Mocky could not be reached: ${error?.message || error}` } })
    } else say(String(error?.message || error))
  }
  async function forward(message) {
    try {
      await remote.send(message)
    } catch (err) {
      // A connection cut in Mocky, or tokens that expired for good: ask again,
      // then retry this one message.
      if (!(err instanceof UnauthorizedError)) return fail(message, err)
      try {
        await authorize()
        await remote.send(message)
      } catch (again) {
        fail(message, again)
      }
    }
  }

  remote.onmessage = (m) => void local.send(m)
  remote.onerror = (e) => say(String(e?.message || e))
  local.onmessage = (m) => (ready ? void forward(m) : pending.push(m))
  local.onclose = () => process.exit(0)
  await local.start()

  try {
    if (!provider.tokens()) await authorize()
    await remote.start()
  } catch (err) {
    say(`could not connect to ${base.origin}: ${err?.message || err}`)
    for (const m of pending.splice(0)) fail(m, err)
    process.exit(1)
  }
  ready = true
  for (const m of pending.splice(0)) await forward(m)
}

main().catch((err) => {
  say(String(err?.stack || err))
  process.exit(1)
})
