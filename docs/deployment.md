# Deployment

## The Docker image

`Dockerfile` is a **multi-stage** build on `node:20-slim`.

### Stage 1 — build

```dockerfile
FROM node:20-slim AS builder
COPY package.json package-lock.json ./
RUN npm ci                 # all dependencies, devDependencies included
COPY . .
RUN npm run build          # tsc && vite build → dist/
```

### Stage 2 — runtime

```dockerfile
FROM node:20-slim AS runtime
RUN npm ci --omit=dev && npm cache clean --force
```

Then three layers that each need explaining.

**`ffmpeg`, roughly 120 MB, best-effort.** It cuts a generated clip into a JPEG
sequence (`server/videos/frames.js`).

The install is wrapped in a `|| echo …` so a build host without `apt` does not
fail the whole image. Without ffmpeg, scroll-driven video **reports itself as
unavailable**, says so in the Muse panel, and nothing else changes.

**Chromium and `fetcher-mcp`, roughly 300 MB, also best-effort.**

```dockerfile
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV FETCHER_MCP_VERSION=0.2.1
ENV PLAYWRIGHT_VERSION=1.49.1
RUN (npm install -g "fetcher-mcp@${FETCHER_MCP_VERSION}" \
     && npx --yes "playwright@${PLAYWRIGHT_VERSION}" install --with-deps chromium \
     && chmod -R a+rX /ms-playwright) \
    || (echo "…" && touch /app/.no-chromium)
```

Three decisions are encoded there:

- **Versions are pinned.** `npx --yes playwright install` resolved to whatever
  was published that day, so two builds of the same commit could ship different
  browsers.
- **`PLAYWRIGHT_BROWSERS_PATH` is set before the install, and outside `/root`.**
  The container no longer runs as root (see `USER` below), so a browser left in
  `/root/.cache` would be unreadable at runtime.
- **Failure leaves a marker.** `/app/.no-chromium` is something the server can
  report, instead of a log line nobody reads.

Runtime degradation stays in place regardless (M3 and M5). Without Chromium, Muse
falls back to `fetch` plus Readability, then to the offline pattern library.
Bundling the browser removes the first-run install, not the fallback.

**The copies from the builder.**

```dockerfile
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public
COPY --from=builder /app/mocky.mcp.json ./mocky.mcp.json
```

That last line is not decoration. `server/muse/mcp/config.js` resolves the file
relative to `ROOT_DIR`, which is `/app`.

Without it the MCP host starts **zero** servers and live inspiration silently
falls back to the offline dossier — while the Chromium layer has already been
paid for at build time. This happened, and CI now checks for it:

```yaml
- run: docker exec mocky-ci test -f /app/mocky.mcp.json
```

### The rest

```dockerfile
RUN mkdir -p /app/server/data && chown -R node:node /app/server/data
ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787
VOLUME ["/app/server/data"]
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.MOCKY_PORT||process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
```

The `chown` happens **before** `USER node` so the unprivileged user can write to
the data directory — and so the files in a mounted volume are not root-owned,
which made backups and rootless Docker painful.

---

## `docker compose`

```yaml
services:
  mocky:
    build: .
    image: mocky:latest
    container_name: mocky
    ports:
      - "${MOCKY_BIND:-127.0.0.1}:8787:8787"
    volumes:
      - mocky-data:/app/server/data
    env_file:
      - path: .env
        required: false
    environment:
      NODE_ENV: production
      PORT: 8787
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      start_period: 15s
      retries: 3

volumes:
  mocky-data:
```

| Command | Effect |
|---|---|
| `docker compose up -d --build` | Build and start in the background |
| `docker compose logs -f` | Follow the logs |
| `docker compose ps` | Status, including the health check |
| `docker compose down` | Stop and remove the container. **Data is preserved** |
| `docker compose down -v` | Stop and **delete all data** (the volume is removed) |

`env_file` with `required: false` is what makes `.env` **optional**. Without that
section, nothing in `.env` would ever reach the container.

> `docker-compose.override.yml` is git-ignored, deliberately. Compose loads it on
> top of the main file, so a committed one would silently follow the repository
> onto a real deployment. The local one pins `MOCKY_ORIGIN` to
> `http://localhost:8787`, which is right on a laptop and wrong everywhere else.

---

## Environment variables

**All of them are optional.** Mocky starts with none: accounts are created from
the sign-in screen and the model provider is configured in the UI.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | The port Express listens on |
| `MOCKY_PORT` | *(unset)* | **Overrides `PORT`.** Useful in development: a harness that injects `PORT` to configure Vite must not push the back end onto Vite's port. Leave it unset in production |
| `MOCKY_BIND` | `127.0.0.1` | **Docker only** — the host interface the port is published on |
| `MOCKY_DATA_DIR` | `server/data` | Where the JSON store lives. Point it at a mounted volume if needed |
| `TRUST_PROXY` | *(unset)* | `1`, a hop count, or an Express `trust proxy` value. **Required behind a reverse proxy** |
| `NODE_ENV` | `production` | Affects serving mode. Cookie security does **not** depend on it |
| `SSO_SHARED_SECRET` | *(unset)* | The HS256 secret shared with Dashy |
| `SSO_DASHY_URL` | *(unset)* | The public origin of your Dashy instance |
| `MOCKY_ORIGIN` | *(auto-detected)* | Mocky's own public origin. **Set it explicitly whenever SSO is on** |

### The built-in `.env` loader

`server/index.js` reads `<repo>/.env` at startup, with no dependency:

```js
const m = /^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line.trim())
if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
```

It **does not overwrite** a value already present in the environment. A variable
set by Docker, Coolify or the shell therefore always wins over `.env`.

### Why `TRUST_PROXY` matters

Without it, behind Nginx or Caddy, **every request appears to come from
`127.0.0.1`**. The rate limit on auth routes collapses into a single bucket
shared by the whole instance.

Nine failed logins in a minute — from one clumsy user — and **nobody can sign
in**.

```js
if (process.env.TRUST_PROXY) {
  const v = process.env.TRUST_PROXY
  app.set('trust proxy', /^\d+$/.test(v) ? Number(v) : v === 'true' || v === '1' ? 1 : v)
}
```

It is **off by default** because the assumed default is direct exposure. Trusting
`X-Forwarded-For` with no proxy in front would let anyone forge their IP and
bypass the rate limit.

### Exposing the instance

The port is published on `127.0.0.1` by default. Several routes spend your model
credits, so that is the safe default.

To expose it deliberately, set `MOCKY_BIND=0.0.0.0` in `.env` — and read the
reverse proxy section first. The recommended setup is the opposite: keep
`127.0.0.1` and let the proxy reach Mocky over the loopback interface.

---

## Health

```bash
curl -s localhost:8787/api/health
```

```json
{ "ok": true, "checks": { "dataWritable": true, "frontendBuilt": true } }
```

Two checks, chosen because they are **the two things that actually break a
running instance**:

- `dataWritable` — is the data directory writable? Accounts, sessions and
  projects live there.
- `frontendBuilt` — does `dist/` exist? In other words, was `npm start` run
  without `npm run build`?

On failure it answers `503` plus a `detail` field that **names** the problem, so
an operator reading `docker inspect` output knows what to fix.

> The probe used to hit `/api/config`, which answers `200` from memory in both
> cases. An unusable instance therefore reported itself perfectly healthy.

Mocky also refuses to **start** if its data directory is not writable, with a
message explaining what to fix, rather than failing later on the first write.

---

## Reverse proxy and HTTPS

Behind Nginx, Caddy or Traefik:

1. **Set `TRUST_PROXY=1`.**
2. **Set `MOCKY_ORIGIN`** to your public HTTPS URL. Required if SSO is enabled.
3. **Keep `MOCKY_BIND=127.0.0.1`** and let the proxy reach Mocky over loopback.
4. **Terminate TLS at the proxy.** Express does not handle it.

Caddy:

```
mocky.example.com {
    reverse_proxy localhost:8787
}
```

Nginx:

```nginx
server {
    listen 443 ssl;
    server_name mocky.example.com;

    location / {
        proxy_pass http://localhost:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### The session cookie

```js
secure: Boolean(req?.secure)
```

Derived from the **actual connection**, not from `NODE_ENV`.

A production instance reached over plain HTTP on a local network would otherwise
set a `Secure` cookie that the browser then refuses to send, and sign-in would
fail silently. This is one more reason to set `TRUST_PROXY`: without it,
`req.secure` is false behind a TLS-terminating proxy.

The cookie is `httpOnly`, `sameSite: 'lax'`, with a 90-day `maxAge`. That
`maxAge` is only a hint to the browser; real expiry is enforced server-side, and
stale sessions are pruned at startup.

### Security headers

```js
res.setHeader('X-Content-Type-Options', 'nosniff')
res.setHeader('X-Frame-Options', 'SAMEORIGIN')
res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
```

There is no CSP on the application itself: the sandboxed previews need inline
scripts. The strict CSP lives **inside each preview's `srcDoc`**, where the
generated code actually runs. See the
[architecture overview](architecture/overview.md).

`x-powered-by` is explicitly disabled. Advertising the framework and its version
hands out a targeted exploit list for free.

---

## Backup and restore

```bash
docker compose cp mocky:/app/server/data ./server/data
npm run backup                 # → backups/mocky-YYYY-MM-DD-HHmm.zip
```

To restore: stop Mocky, unzip the archive over `server/data`, then

```bash
docker compose cp ./server/data mocky:/app/server/data
docker compose restart
```

`scripts/backup.mjs` is plain Node and reuses the repository's dependency-free
ZIP writer, so it behaves identically on Windows, macOS and Linux.

The previous recipe — `docker run -v $(pwd):/backup alpine tar …` — **does not
work** on Windows. `$(pwd)` is not `cmd.exe` syntax, and under PowerShell it
expands to a path that may contain spaces, which breaks the `-v` argument.

**The archive contains password hashes and session tokens.** `backups/` is
git-ignored; keep it that way.

What lives in the `mocky-data` volume:

| Path | Contents | Size |
|---|---|---|
| `users.json`, `sessions.json`, `config.json`, `sso-jti.json` | Accounts and sessions | Tiny |
| `data-<uuid>.json` | One user's projects and `DESIGN.md` | Small |
| `text-config.json`, `images-config.json` | Configured providers — **secrets** | Tiny |
| `muse-cache.json` | Distillations, 7-day TTL, text | Small |
| `image-library.json` and `image-library/` | The image library | Medium |
| `video-library/` | Sequences: one clip plus up to 150 frames each | **By far the largest** |

---

## SSO — "Sign in with Dashy"

Mocky can delegate authentication to a
[Dashy](https://github.com/PetitOursManu/Dashy) instance. It is a redirect flow
of the OIDC kind, and **the shared secret never touches the browser** — the JWT
is verified server-side.

It is **disabled unless both `SSO_SHARED_SECRET` and `SSO_DASHY_URL` are set**,
and it never interferes with password login.

### Enabling it

Generate a secret without `openssl`, which is not on a standard Windows `PATH`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

On the **Mocky** side:

```bash
SSO_SHARED_SECRET=<the value you just generated>
SSO_DASHY_URL=https://dashy.example.com
MOCKY_ORIGIN=https://mocky.example.com        # production
# MOCKY_ORIGIN=http://localhost:5173          # dev — the Vite SPA origin, NOT :8787
```

On the **Dashy** side: the same `SSO_SHARED_SECRET`, plus Mocky's callback in the
allow-list:

```bash
SSO_ALLOWED_REDIRECTS=https://mocky.example.com/sso/dashy/callback,http://localhost:5173/sso/dashy/callback
```

The server reports the state at startup, so a typo in a variable name shows
immediately:

```
Mocky backend on http://localhost:8787
SSO: disabled (set SSO_SHARED_SECRET and SSO_DASHY_URL in .env to enable)
```

### The flow

1. The sign-in screen shows **Sign in with Dashy**, only when SSO is enabled.
2. An opaque `state` is stored in `sessionStorage`, then the browser is
   redirected to
   `${SSO_DASHY_URL}/api/sso/authorize?redirect_uri=<callback>&state=<state>`.
3. Dashy authenticates the user — **including 2FA** — signs a 60-second HS256
   JWT, and redirects to
   `${MOCKY_ORIGIN}/sso/dashy/callback?token=<jwt>&state=<state>`.
4. The back end verifies the signature, `iss === "dashy"`,
   `aud === MOCKY_ORIGIN`, `exp`, and that the `jti` has never been used. It then
   **finds or creates** the account linked to the Dashy identity by `sub`, sets
   the cookie, and redirects to `/?sso=ok&state=…`.
5. The SPA checks the returned `state`, restores the session, and reconciles
   projects — exactly like a normal sign-in.

### What verification actually checks

- The header must declare `alg: HS256` — defence in depth against algorithm
  substitution.
- The signature is compared in **constant time** with `crypto.timingSafeEqual`,
  after a length check.
- `iss`, `aud` and `exp` are checked separately, with distinct messages.
- The `jti` is consumed once. `sso-jti.json` keeps used ids and prunes anything
  older than 10 minutes — the token lives 60 seconds, plus margin.
- A failure **does not produce a blank page**: the user is sent back to the app
  with `?sso=error&reason=…`.

### The token contract

Claims: `sub` (a stable Dashy user id), `email`, `name?`, `role`, `iss="dashy"`,
`aud=<Mocky origin>`, `iat`, `exp`, `jti`.

The token **proves an identity and nothing more**. It grants no access to Dashy's
own API.

SSO-created accounts have **no password** and can only sign in through Dashy. A
Dashy `admin` maps to a Mocky `admin`. Existing Mocky accounts are **never**
auto-linked: linking happens only by `dashySub`, which only SSO-created accounts
carry.

An SSO user who has also set a Mocky password keeps their chosen username. Only
SSO-only accounts follow the Dashy display name.

---

## Coolify

> **TODO: verify.** The repository contains **no Coolify configuration** — no
> `nixpacks.toml`, no manifest, no reference to Coolify in the code or in CI.
> This project's Coolify resources were created and configured by hand, outside
> the repository.
>
> What follows is a translation of the `Dockerfile` and `docker-compose.yml` that
> **are** present into what Coolify asks for. Confirm it against the actual
> configuration before relying on it.

### Resource 1 — the Mocky application

| Coolify setting | Value | Why |
|---|---|---|
| Build type | **Dockerfile** | The image is already multi-stage and complete. Do not let Nixpacks guess: it would miss `ffmpeg` and Chromium |
| Dockerfile | `./Dockerfile` | |
| Exposed port | `8787` | `EXPOSE 8787`, and `PORT` defaults to `8787` |
| Health check | `GET /api/health` | Answers `503` with a `detail` when something is missing |
| Persistent volume | mounted at `/app/server/data` | Accounts, projects, libraries. **Without it, everything is lost on each redeploy** |
| Domain | your HTTPS domain | Coolify's proxy terminates TLS |

Variables to set in Coolify:

```bash
TRUST_PROXY=1                              # Coolify's proxy sits in front
MOCKY_ORIGIN=https://mocky.example.com     # required as soon as SSO is on
# SSO_SHARED_SECRET=…
# SSO_DASHY_URL=https://dashy.example.com
```

`MOCKY_BIND` is **not used here**. It is a `docker-compose.yml` variable that
decides which host interface the port is published on; Coolify handles publishing
itself.

Four things specific to this image:

**Size.** Roughly 300 MB of Chromium plus 120 MB of ffmpeg on top of
`node:20-slim`. Plan for the build disk, and for a slow first build.

**The first build can partly fail without failing.** Both layers are deliberately
best-effort. If the build network hiccupped, the image still starts: video
reports itself unavailable and Muse falls back to its offline patterns. Check
`GET /api/mcp/status` and `GET /api/videos/availability` after a deploy.

**The container runs as `node`, not root.** A mounted volume must be writable by
that user, otherwise Mocky refuses to start — with a message that says so.

**Graceful shutdown matters.** `SIGTERM` triggers closing the MCP servers before
the HTTP server, with a 3-second net. Give Coolify a stop timeout of at least
those 3 seconds, or child processes may survive.

### Resource 2 — the documentation

See the next section. It is a **static** resource, entirely separate: no build,
no Node, no volume.

---

## The documentation

Two folders, two resources, deliberately decoupled.

- **`docs/`** — the content. Markdown files, nothing else.
- **`docs-site/`** — the viewer. Four static files.

### How it works

`docs-site/index.html` loads Docsify from `./vendor/` and sets:

```js
basePath: 'https://raw.githubusercontent.com/PetitOursManu/Mocky/main/docs/'
```

The viewer therefore fetches the Markdown **directly from GitHub on every page
view**. Three consequences:

- **There is no build step, ever.** Publishing documentation means pushing a
  `.md` to `main`. The site serves it on the next request.
- **The site does not need redeploying** when content changes.
- The content must stay **public**. `raw.githubusercontent.com` on a private
  repository would require a token, which a static page cannot hold.

> **The converse is the trap.** Everything in `docs-site/` — `index.html`, the
> favicon, the vendored Docsify files — is served by the deployed resource, not
> fetched from GitHub. Pushing a change to those files to `main` does **nothing**
> until the static resource is **redeployed**.
>
> So: a typo fixed in a `.md` appears on the next page load; a new favicon, a
> changed title or a Docsify upgrade appears only after a redeploy.

### Deploying `docs-site/`

Any static host works. On Coolify: a **static** resource, publish directory
`docs-site/`, no build command, no volume.

The files:

| File | Origin |
|---|---|
| `index.html` | Written for this project |
| `mocky.css` | Written for this project — Mocky's look, transposed from `src/styles/tokens.css` |
| `favicon.ico` | Copied from `public/favicon.ico` — the application's own icon |
| `logo.png` | The same artwork, rendered once at 128 px for the sidebar |
| `vendor/docsify.min.js` | docsify 4.13.1 — `lib/docsify.min.js` |
| `vendor/docsify-theme.css` | docsify 4.13.1 — `lib/themes/vue.css`, patched |
| `vendor/docsify-search.min.js` | docsify 4.13.1 — `lib/plugins/search.min.js` |

### The look

`mocky.css` loads after the vendored `vue.css` and overrides it. The values are
not invented: they are transposed from `src/styles/tokens.css` and
`tailwind.config.js`, so the documentation and the application agree.

What that gives, restated from the application's own token file — *black and
white, 1px rules, no radius, no shadow, one signature flat*:

| Element | Treatment |
|---|---|
| Background | Newsprint, not screen white. Pure `#fff` reads as "app" |
| Headings | The serif stack, tightened. No webfont is loaded — the faces ship with Windows and macOS, so the page needs no third-party request |
| Sidebar group titles | A kicker: 11 px, uppercase, letterspaced `0.14em`, with a rule under it |
| Sidebar links | A chevron on the left, and the teal on the active page |
| Corners | `0` everywhere, as in the application |
| Accent | The logo's teal, and it is the only chromatic colour in the chrome |

There is one structural surprise worth knowing before editing it. Docsify renders
a sidebar group as `<li>Architecture<ul>…</ul></li>`: **the title is a bare text
node**, not an element. The vue theme's own `.sidebar li > p` rule therefore
matches nothing. So the type is set on the `<li>` and every child link resets it,
and the group underline is drawn as the nested list's top border — which lands
exactly under the title.

### The theme switch

A button at the bottom of the sidebar, and the preference is remembered.

The theme is applied by an inline script in `<head>`, synchronously, before the
first paint. That is the same trick and the same reason as the application's own
`index.html`: running it later means the first frame is already on screen, so
opening the page in the dark theme flashes light on every single load.

With nothing stored it follows the operating system, through
`prefers-color-scheme`. The key is `mocky.docs.theme`, namespaced to the
documentation — this is a different origin from the application, so the two
preferences cannot be shared anyway.

### The favicon

The documentation tab carries the same icon as the application tab. The file is
copied rather than linked, so `docs-site/` stays self-contained and fetches
nothing from another host.

It is the `.ico` and not the `.svg`, deliberately. `public/favicon.svg` is a
1141×1107 PNG wrapped in an SVG element — 665 KB, which a documentation page
would re-request on every navigation. The `.ico` holds the same artwork at 16,
32 and 48 px for 15 KB, and every browser reads it.

If the application's icon changes, copy it again:

```bash
cp public/favicon.ico docs-site/favicon.ico
```

Then **redeploy the static resource** — see the warning above. A favicon pushed
to `main` but not redeployed leaves the tab showing the browser's blank-document
icon, which is exactly what a missing favicon looks like.

Browsers also cache a favicon aggressively, including the *absence* of one. After
a redeploy, confirm with a hard reload, or by opening `<your-domain>/favicon.ico`
directly: it must answer `200` with `image/x-icon`.

### The tab title

Docsify names the tab after the **first sidebar link matching the current
route**. The language block sits at the top of the sidebar and its English entry
points at `/`, so the home page ended up titled "English" and the French home
"Français" — the language name, not the page.

A small plugin in `index.html` sets the title itself on every route: `Doc Mocky`
on the home pages, `Doc Mocky — <page>` elsewhere. The site name comes first
because a browser tab is narrow, and the first few characters are the only ones
anyone reads.

### Why Docsify is vendored

The same rule as `public/vendor/` on the application side, for the same reason.

The upstream theme opens with:

```css
@import url("https://fonts.googleapis.com/css?family=Roboto+Mono|Source+Sans+Pro:300,400,600");
```

That is a request to a third-party CDN on every page load — exactly the
dependency the local copy exists to remove. The line was removed and the removal
is documented at the top of the file. Both families already declare local
fallbacks in the rules below, so nothing else changes.

**Re-apply this after any Docsify version bump.**

### Languages

English is the default and lives at the root of `docs/`. French lives under
`docs/fr/`, with its own `_sidebar.md`.

`index.html` maps every nested sidebar request back to the right one:

```js
alias: {
  '/fr/.*_sidebar.md': '/fr/_sidebar.md',
  '/.*_sidebar.md': '/_sidebar.md',
}
```

Order matters: the `/fr/` rule must come first, because Docsify returns the first
match and `/.*/_sidebar.md` would also match a French path.

`fallbackLanguages: ['fr']` means a French page that does not exist falls back to
its English equivalent instead of showing an error.

### The language switch

Two tabs under the masthead, built by a plugin in `index.html` — **not** an entry
in `_sidebar.md`.

That distinction was learned the hard way. As a sidebar group, the English link
pointed at `/`, which is the same route as "Home". Docsify marks the **first**
sidebar link matching the current route as the active page and hangs that page's
table of contents underneath it — so on the home page the language block became
the active item and swallowed the whole contents list, with "Français" stranded
below it. Choosing a language is a preference, like the theme; it is not a page
in the document tree, and the sidebar now lists documents only.

Each tab carries a small flag drawn as **inline SVG**, not as an emoji: the
regional-indicator emoji (🇬🇧, 🇫🇷) render as bare letter pairs on Windows, which
is the platform this project is developed on. Each flag also carries a
one-pixel outline — without it the white band of the French flag disappears
against the sidebar and the flag reads as two loose rectangles.

The current language is marked with `aria-current`, not only with colour.

### Adding a page

1. Create the `.md` file under `docs/`, and its translation under `docs/fr/`.
2. Add it to `docs/_sidebar.md` and `docs/fr/_sidebar.md`.
3. Push.

Two rules make links work:

**Always write paths from the root of `docs/`**, never relative to the current
page. From `architecture/overview.md`, write `architecture/invariants.md`, not
`invariants.md`. Docsify resolves everything from `basePath`.

**`docs/README.md` is Docsify's required homepage.** Without it the site shows a
silent fetch error on first load. The same applies to `docs/fr/README.md` for the
French tree.
