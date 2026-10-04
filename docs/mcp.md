# Connecting an assistant (MCP)

Mocky can be an **MCP server**: Claude, ChatGPT or another MCP client connects
to it and acts in Mocky on behalf of one account. The person signs in to Mocky,
says yes once, and from then on the assistant can work with their projects.

It is **off by default**, and off means absent: no endpoint, no discovery
document, nothing a scanner could find. It is switched on by an administrator,
for the accounts they choose, and only on an instance served over HTTPS.

## What an assistant can do

| Tool | What it does |
|---|---|
| `create_design` | Generates a new screen from a description, always in a **new project**, and returns **a picture of it and a link** to it in Mocky. |
| `add_screen` | The same, into an **existing project** — where the screen follows that project's art direction. Only when the person names that project: an assistant must never pick one because it looks related, and the answer says which project the screen went into. |
| `get_design` | Waits for a design that is still being made, then returns the same. |
| `list_projects` | The account's projects, each with a link. |
| `get_project` | One project's screens: name, device, the request that made it, a link. |
| `get_screenshot` | A picture of a screen that already exists. |

And one prompt, **new-design** (the "/" menu in Claude), which starts a short
interview before designing.

- **Questions first.** The assistant is told to make sure it knows what the
  screen is, who it is for and the tone wanted, and to ask at most three short
  questions when the person has not said. If a request still arrives with almost
  nothing in it ("un site"), Mocky does not guess: it hands the assistant three
  questions, in the person's language, and generates once they are answered.
- **The same Mocky.** The design is made by the headless runner (below), with
  the same pipeline as the interface, and saved in the account — in a tab already
  open on that project, the new screen appears on its own.
- **Waiting.** A generation takes from thirty seconds to a few minutes. A call
  waits about forty seconds; past that, the assistant gets a job id and asks
  `get_design`, which waits again.
- **The picture** is a JPEG of the top of the page (2,000 px at most): the whole
  page is in Mocky, behind the link. For an assistant whose interface does not
  show a tool's picture, the answer also carries a **picture link** — that JPEG
  alone, signed, valid for a day, and invalid after a restart.
- **The link** opens the project in Mocky, centred on the new screen, for
  someone signed in to that account and nobody else.
- **One design at a time per account**; maintenance refuses new designs (reads
  still work); the optional daily quota counts them.
- **In Admin → Live activity and Users**, an account using Mocky through an
  assistant shows as connected, with an **MCP** mark — also while a design is
  being made for it.

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

### The headless runner

A design asked for from an assistant has to run the same pipeline the composer
runs — direction, Muse, planner, generation — and that pipeline lives in the
browser. So the server drives a **Chromium of its own**: it opens Mocky's
`runner.html`, which runs the pipeline, writes the new screen into the account's
project, and shows its preview; the server then photographs that preview with
Chromium itself. Nobody needs a tab open.

- **Requirements.** A Chromium — the Docker image installs one; elsewhere set
  `MOCKY_RUNNER_CHROMIUM` — a built interface (`npm run build`), and an HTTPS
  `MOCKY_ORIGIN`. A **generation provider configured by the administrator**: the
  runner never uses a key kept in somebody's browser.
- **Check the runner** (free): starts Chromium, loads the runner page,
  photographs a fixed screen. No model is called.
- **Full try** (paid like any generation): a real generation in *your own*
  account, in a project called *Essai MCP*, with its picture and a link to it.
- **One generation at a time per account**, and `concurrency` at once for the
  instance (one by default).
- **What its browser may reach.** Requests to Mocky's own address are answered
  by the server itself, over loopback, carrying a token for that one job — which
  opens only the routes a generation needs (model, Muse, images, the account's
  projects) and dies with the job. Anything else the generated page asks for
  goes through Mocky's SSRF guard first: a font or a picture from the Internet is
  fine, an address inside your network is refused. WebSockets are refused.

### What is recorded

- `mcp-config.json` — the settings above.
- `mcp-jobs.json` and `mcp-shots/` — the runner's recent jobs and the pictures it
  took (the last 200, a week at most). Neither travels with a migration.
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
invariants, X5 and X6 for the runner.

## Development

`MOCKY_MCP_INSECURE_LOOPBACK=1` accepts an `http://localhost` or
`http://127.0.0.1` origin. Nothing outside the machine can reach a loopback
address, so this only serves a client on the same machine — Claude Code, for
instance — and the end-to-end test (`tests/mcp-oauth-e2e.test.js`). Never on a
server.
