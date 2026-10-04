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
| `mocky_guide` | The guide written for the assistant itself: the steps from a request to a design, which tool when, the screen types, the pictures, what never to do. It is told to read it before its first design; also served as the resource `mocky://guide`. |
| `create_design` | Generates a new screen from a description, always in a **new project**, and returns **a picture of it and a link** to it in Mocky. |
| `add_screen` | The same, into an **existing project** — where the screen follows that project's art direction. Only when the person names that project: an assistant must never pick one because it looks related, and the answer says which project the screen went into. |
| `get_design` | Waits for a design that is still being made, then returns the same. |
| `list_projects` | The account's projects, each with a link. |
| `get_project` | One project's screens: name, device, the request that made it, a link. |
| `get_screenshot` | A picture of a screen that already exists. |
| `search_free_images` | Free photos from the libraries this Mocky is connected to (Pexels, Pixabay), as thumbnails the assistant looks at. |
| `add_image` | Puts one picture in the account's library for a design: a free photo chosen above, a picture from the conversation (one ChatGPT generated, or one the person attached), or a public address. |
| `edit_design` | Changes an existing screen as the person asks — "make the header dark" — keeping the rest. Returns a picture and the link. |
| `polish_design` | Mocky's [quality pass](quality.md) on a screen: corrects what it finds and scores it out of 20. Says what it fixed and what is left. |
| `audit_design` | The [SEO and accessibility report](seo-accessibility.md) of a screen: two scores and the named findings. Changes nothing; `deep` adds the model-judged questions. |
| `fix_accessibility` | That report's own correction: fixes the markup, the screen looking the same. |

And one prompt, **new-design** (the "/" menu in Claude), which starts a short
interview before designing.

- **Questions first.** The assistant is told to make sure it knows what the
  screen is, who it is for and the tone wanted, and to ask at most three short
  questions when the person has not said. If a request still arrives with almost
  nothing in it ("un site"), Mocky does not guess: it hands the assistant three
  questions, in the person's language, and generates once they are answered.
- **The screen type.** The assistant chooses one of Mocky's types (the composer's "Type d'écran": dashboard, landing, flyer, CV, Instagram post…), which sets the format — a flyer is an A4 page, an Instagram post a 4:5 image. A size the request names ("en 1:1", "a story", "A3") goes in `page_format`, or is read from the words when the assistant does not pass it: a post asked for in 1:1 once came back as a square drawn inside a 4:5 page, with a white band under it. When it does not, Mocky reads the type, and the device, from the request's own words ("un flyer", "une appli mobile"); the answer says which type was used.
- **Pictures: the assistant chooses.** Not Mocky's model: the assistant searches
  the free libraries and looks at the thumbnails itself, or brings a picture it
  has, adds it with `add_image`, and passes it to the design with what it is for
  ("hero: the storefront"). The page is told to use each one, by its address on
  Mocky, and to invent no other. A picture by address is the person's own upload,
  with the same responsibility for its rights; downloading it goes through the
  SSRF guard on every redirect, is capped at 15 MB, and keeps only a JPEG, PNG or
  WebP — never an SVG. Free photos follow the account's access to them (Admin →
  Providers). Claude does not generate pictures; ChatGPT can hand over one it
  made, through the file links of its Apps SDK.
- **When the assistant brings none.** A post or a document still gets its
  picture, the way the composer's "Images" choice gives it one: `picture_source`
  `auto` (the default) takes a free photo when the account has them, a
  generated picture otherwise; `free`, `generated` or `none` say it outright.
  The answer always says which picture the screen ended up with. The assistant
  is asked to say what that picture should show (`picture_subject`, in English):
  a subject guessed from a request written as an instruction ("créer
  directement dans Mocky le visuel…") once found a war grave for a food
  festival. And in `auto`, a free photo is taken only when Mocky's model can
  look at the candidates; otherwise the picture is generated.
- **Muse.** On by default in `create_design`: a new project's first screen sets
  the direction every later one follows, and left to the assistant, Muse almost
  never ran. Off in `add_screen`, where the project already has its direction;
  `muse` turns it on or off either way. The `picture_subject` reaches its
  dossier, which plans the picture. With pictures supplied,
  Muse looks at the first one before writing its dossier and uses them in its
  slots instead of making its own — so the palette is chosen with the photo,
  not beside it.
- **One pass per tool.** `edit_design`, `polish_design` and `fix_accessibility`
  each run ONE of Mocky's passes, with its own instruction — an edit does what
  it is told, a polish may restyle, an accessibility fix must leave the screen
  looking the same — so asking for one never runs another. Each keeps the
  screen's previous version: **Revert to the previous version**, in the screen's
  menu, undoes what the assistant did. A screen changed in a tab while the pass
  ran is left alone, and the answer says so. An audit changes nothing, works
  during maintenance, and is not counted in the daily quota.
- **The same Mocky.** The design is made by the headless runner (below), with
  the same pipeline as the interface, and saved in the account — in a tab already
  open on that project, the new screen appears on its own.
- **Waiting.** A generation takes from thirty seconds to a few minutes. A call
  waits about forty seconds; past that, the assistant gets a job id and asks
  `get_design`, which waits again.
- **The live view.** In a host that shows MCP Apps (Claude, ChatGPT), the
  answer is also the design itself, alive in the conversation: it scrolls, its
  buttons and animations work, and **Open in Mocky** takes you to the project.
  It is a small page (`ui://mocky/screen-v1.html`) framing one address on
  Mocky, `/mcp-view/…`, signed and valid for a day like the picture link — and
  served sandboxed, exactly as the composer's preview is (X7). A host without
  MCP Apps shows the picture, as before. The view reads the result from the
  standard notification and from ChatGPT's own channel (`window.openai`), and
  declares its one framed domain in both vocabularies; when it receives nothing
  it says so in the frame rather than staying empty.
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
- **Who writes a design's code** — Mocky's model only (the default), either,
  or the assistant's model only. See [Who writes the code](#who-writes-the-code).
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
- `mcp-prefs.json` — each person's default engine, nothing else.
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

## Who writes the code

By default Mocky's own model writes a design, on the instance's provider. An
administrator can also let **the assistant's model** write it — the model of
the conversation, on the person's own subscription — or allow only that.

- **What Mocky still does.** Everything that is not writing the code: the
  direction, Muse, the pictures, the plan. Then `create_design` (or
  `add_screen`) answers **awaiting_code** with the two turns Mocky's own model
  would have been sent, word for word — its rules and the request — and a job
  id. The assistant writes the component and sends it with `submit_screen`.
- **What Mocky checks.** The code goes through the same extraction, sanitising
  and motion guard as a screen Mocky's model wrote, then it is rendered. A
  render error — that error alone — goes back to the assistant to fix, twice at
  most, like the composer's own repair; after that the screen is kept and the
  answer says it does not render. Then it is saved, photographed and linked like
  any design, and the answer offers `polish_design`.
- **Who pays what.** The code's tokens are the person's subscription; Muse and
  the pictures stay on the instance. A weak model writes a weak screen: that is
  what the quality pass offered afterwards is for.
- **Who chooses.** The administrator sets which engines exist (**Who writes a
  design's code**). When both do, each person picks a default in **Settings →
  Connected assistants**, and the assistant may ask for the other one for a
  single request (`engine`). An engine that is not allowed is refused by name,
  never swapped for the other.
- **The rules are handed over as Mocky's**, with the dossier inside them marked
  as a brief written partly from web pages — material, not instructions to the
  assistant. Giving the rules away is not a licensing question: Mocky is AGPL
  and they are in its source.
- **While the assistant writes**, the job holds a runner slot and the account's
  one job at a time; ten minutes without code and it stops.

Edits, polishing and audits always use Mocky's model.

## For a person using it

**Settings → Connected assistants** gives the connector's address and lists the
assistants this account let in, each with **Disconnect**. When the administrator
allows both engines, it also asks **who writes your designs' code**. If the section says
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

- **A screen served alone stays sandboxed.** The live view's address serves
  model-written code from Mocky's own origin, so it answers with
  `Content-Security-Policy: sandbox allow-scripts`: an opaque origin, no
  cookie, no storage, whoever opens it.

The rules are written down as [series X](architecture/invariants.md) of the
invariants, X5 and X6 for the runner, X7 for the live view.

## A Mocky the assistants cannot reach

Claude and ChatGPT connect from their own servers: a Mocky on a LAN, behind a
VPN, or with a certificate only your machines trust is out of their reach. A
client that runs **on your machine** — Claude Desktop, Claude Code — can start a
local program instead, and `bridge/mocky-mcp.js` is that program: it speaks
stdio to the client and HTTPS to Mocky's `/mcp`, and relays every message
unchanged. Mocky stays the server: same switch, same list, same consent page.

- **Requirements.** The MCP server switched on, which still needs an
  `https://` origin — a certificate from your own CA is fine: give it to Node
  with `NODE_EXTRA_CA_CERTS`, never by switching checks off. Node 22.12+ on
  the machine, and the bridge's files (the `bridge/` folder of this repository,
  with `npm install` run in it).
- **Claude Desktop** — in `claude_desktop_config.json`:

  ```json
  {
    "mcpServers": {
      "mocky": {
        "command": "node",
        "args": ["/path/to/mocky/bridge/mocky-mcp.js", "--url", "https://mocky.lan"],
        "env": { "NODE_EXTRA_CA_CERTS": "/path/to/your-ca.pem" }
      }
    }
  }
  ```

- **The first time**, your browser opens on Mocky's consent page: sign in,
  **Allow**. The answer comes back to `127.0.0.1` only (port 33418, or
  `--port`), and the connection is kept in `~/.mocky-mcp/`, readable by you
  alone. Mocky lists it as *Mocky bridge* in Settings → Connected assistants,
  where **Disconnect** cuts it; the next start then asks again.
- **On a machine with no browser**, `MOCKY_MCP_BROWSER=none` prints the
  address to open instead; `MOCKY_MCP_HOME` moves `~/.mocky-mcp`.

## Development

`MOCKY_MCP_INSECURE_LOOPBACK=1` accepts an `http://localhost` or
`http://127.0.0.1` origin. Nothing outside the machine can reach a loopback
address, so this only serves a client on the same machine — Claude Code, for
instance — and the end-to-end test (`tests/mcp-oauth-e2e.test.js`). Never on a
server.
