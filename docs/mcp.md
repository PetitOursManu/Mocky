# Connecting an assistant (MCP)

Mocky can be an **MCP server**: Claude, ChatGPT or another MCP client connects
to it and acts in Mocky on behalf of one account. The person signs in to Mocky,
says yes once, and from then on the assistant can work with their projects.

It is **off by default**, and off means absent: no endpoint, no discovery
document, nothing a scanner could find. It is switched on by an administrator,
for the accounts they choose, and only on an instance served over HTTPS.

What an assistant can do today is **read the list of projects** — enough to check
that a connection works and is the right account. Creating and editing designs
from the conversation arrives with the next stages of the plan
(`plans/mcp-serveur.md` in the repository): the headless runner that generates
without a Mocky tab open, and returns a picture of the result with a link to the
project.

## For the administrator

Everything is in **Admin → Assistants (MCP)**.

### Requirements

The section is always visible and stays **locked** until two things hold. It
lists them, with a tick or a cross:

1. **`MOCKY_ORIGIN` starts with `https://`.** It becomes the OAuth issuer and
   the address the tokens are bound to (`${MOCKY_ORIGIN}/mcp`).
2. **This admin page reached you over HTTPS, on that host.** That proves TLS and
   the reverse proxy work, not merely that the variable is spelled right. Behind
   a proxy, Mocky reads `X-Forwarded-Proto` and `X-Forwarded-Host`; set
   `TRUST_PROXY` as the [deployment page](deployment.md) says.

A third line is never ticked: **reachable from the Internet** cannot be checked
from inside — a self-test against one's own public address fails behind most
NATs and succeeds on some setups that are not reachable from outside. Claude and
ChatGPT connect from their own servers, so the first connection from either is
the only proof. A self-signed certificate passes both checks and is refused by
both assistants.

The server applies the same rule on its own: switching on is refused (`409`)
while a check fails, and if the origin stops being HTTPS — the variable changed,
the proxy removed — the MCP server is absent after the next restart, settings
and connections kept.

### Switching it on

- **Allow assistants to connect** — the switch. Switching off suspends every
  connection without deleting it; they work again if it is switched back on.
- **Who may connect an assistant** — every account, or a list. The list starts
  **empty**, and an administrator is **not** allowed by their role: add yourself
  if you want to use it, as with every other access list in Mocky.
- **Accepted clients** — *Claude, ChatGPT and clients on the person's own
  machine* (the default), or *any MCP client*. Decided on the address a client
  sends the person back to after consent: `claude.ai`, `claude.com`,
  `chatgpt.com`, or a loopback address.
- **Token lifetimes** — an access token lasts an hour by default; a connection
  that is not used for thirty days expires.
- **Generations per account per day** — empty means unlimited, as in the
  interface. Whatever the setting, one MCP generation at a time per account
  (from the runner onwards).

The page shows the **address to give the assistant** — `${MOCKY_ORIGIN}/mcp` —
and the list of **active connections**: account, assistant, since when, last
used, and a button that cuts one.

### What is recorded

- `mcp-config.json` — the settings above.
- `mcp-oauth.json` — registered clients and connections, with tokens stored
  **by hash** (SHA-256): a copy of the file does not let anyone call `/mcp`.
  Mode `0600`. It does **not** travel with a [migration](migration.md): like
  sessions, each assistant asks for consent again once on the new server.
- The **audit log** gains a group, *Assistants (MCP)*: a settings change (field
  names only), a connection, a disconnection, and a **reused token** — two
  parties holding the same refresh token, which cuts that connection.

Removing an account from the list cuts its connections at once; deleting an
account deletes them.

## For a person using it

**Settings → Connected assistants** gives the connector's address and lists the
assistants this account let in, each with **Disconnect**. If the section says
the feature is off, or that the account is not allowed, that is an
administrator's decision.

To connect:

1. **Claude** — add a custom connector with the address. **ChatGPT** — create a
   connector in developer mode with the address.
2. The assistant opens Mocky. Sign in if asked.
3. Mocky shows which assistant is asking, which account it would act as, and
   where you will be sent back. **Allow** or **Deny** — a refusal is handed back
   to the assistant, which stops waiting.

## How it is secured

- **The Mocky session decides who you are.** The OAuth authorization page sends
  the browser to Mocky's own consent page; no password is ever typed for an
  assistant, and nothing is granted without the click.
- **OAuth 2.1 with PKCE (S256)**, dynamic client registration, and tokens bound
  to one resource (RFC 8707): a token minted for any other address is refused.
- **Refresh tokens rotate**, and an old one presented again revokes its
  connection — that is what a stolen token looks like.
- **Access is read again on every call**, not when the token was issued.
- **Nothing private leaves**: a screen's notes never reach an assistant, nor a
  key, nor another account's data; a project that is not yours answers like one
  that does not exist.
- **No outbound request.** The MCP server never fetches anything a client names,
  so it adds nothing to the [SSRF guard's](architecture/invariants.md) surface.

The rules are written down as [series X](architecture/invariants.md) of the
invariants.

## Development

`MOCKY_MCP_INSECURE_LOOPBACK=1` accepts an `http://localhost` or
`http://127.0.0.1` origin. Nothing outside the machine can reach a loopback
address, so this only serves a client on the same machine — Claude Code, for
instance — and the end-to-end test (`tests/mcp-oauth-e2e.test.js`). Never on a
server.
