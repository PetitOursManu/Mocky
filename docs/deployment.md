# Deployment

## The Docker image

`Dockerfile` is a **multi-stage** build on `node:22-slim`.

### Stage 1 — build

```dockerfile
FROM node:22-slim AS builder
COPY package.json package-lock.json .puppeteerrc.cjs ./
RUN npm ci                 # all dependencies, devDependencies included
COPY . .
RUN npm run build          # tsc && vite build → dist/
```

### Stage 2 — runtime

```dockerfile
FROM node:22-slim AS runtime
COPY package.json package-lock.json .puppeteerrc.cjs ./
RUN npm ci --omit=dev --omit=optional && npm cache clean --force
```

`--omit=optional` belongs **here and nowhere else**: this stage installs runtime
dependencies and builds nothing, so it wants neither Puppeteer — an optional
dependency of `impeccable`, whose URL engine Mocky never calls — nor any
per-platform native binding, whereas the same flag in an `.npmrc` would also
apply to the builder stage, where it strips `@rolldown/binding-*` and breaks
`npm run build`.

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


### Motion Ultra's render worker, on a server

`docker-compose.yml` keeps the worker behind `profiles: ["video-export"]`, which
is a flag on a command line — and a platform that deploys a compose file from a
repository often has no command line to put it on. So there is a second file,
`docker-compose.motion.yml`: the shipped file with that one profile line
removed, generated by `npm run compose:motion` and held to its source by a test.
Choosing it is the same deliberate act as typing the flag, and the licence
question it answers is the same one.

It is whole rather than an `include:` of its neighbour, and that is a scar
rather than a preference: Coolify — like Dokploy and Portainer — does not hand
the file to Compose, it parses it, rewrites it with its own labels and networks,
and deploys the result. An `include:` key means nothing to that parser, so the
first version of this file reached the server as a service with no image and no
build, and the deploy failed with `no service selected`. Whatever edits
`docker-compose.yml` must be followed by `npm run compose:motion`; `npm test`
fails while the two disagree.

| Deployment | What to do |
|---|---|
| `docker compose` on the machine | `docker compose --profile video-export up -d --build` once, or `COMPOSE_PROFILES=video-export` in the `.env` beside the compose file, and then `docker compose up -d --build` as usual |
| A platform that deploys a compose FILE (Coolify, Dokploy, Portainer) | Point the resource at `docker-compose.motion.yml` instead of `docker-compose.yml`, and redeploy. Some of them also read `COMPOSE_PROFILES` from the resource's environment variables, which works too — the file is what works everywhere |
| A platform that builds a **Dockerfile** | There is no compose file in play at all, so the worker is a second resource of its own, built from `worker/video/` |

Three things to check after the first deploy, in this order:

1. **The container is there.** `docker ps` shows `mocky-video-worker`, and its
   health check turns healthy within about a minute and a half — it compiles the
   render bundle after it starts listening, which is what `start_period` is for.
2. **Mocky can reach it.** Admin → Motion Ultra shows the worker as available. The
   address is `http://video-worker:3030` — the service's name on the internal
   bridge, not a public URL, and it never needs one.
3. **The machine can carry it.** The worker asks for 4 GB of memory and 2 cores
   while it renders, on top of Mocky. Run the server test in Admin → Motion Ultra: it
   renders three reference films and says what each render level really costs on
   this host, then recommends one.

The worker publishes no port and its bridge has no route out, so nothing about
this exposes anything new. A Remotion licence key is the one exception, and the
compose file says where to uncomment it.

### The graphics card in Docker

Admin → System shows the machine's graphics card when there is one (see
[The admin dashboard](admin-dashboard.md#the-graphics-card)). Mocky does not need
it; the card is shown for whatever else runs on the machine. Outside Docker nothing
is needed. Inside a container:

- **AMD, Intel** — the container sees the host's `/sys/class/drm`, so an AMD card's
  utilisation reads with nothing to configure; an Intel iGPU shows as present but
  unmeasurable.
- **NVIDIA** — the container sees no `nvidia-smi` until the host has the
  [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
  and the service asks for the card. `docker-compose.gpu.yml` is that request, on
  top of the usual file:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

It is a separate file rather than a line in `docker-compose.yml` because a GPU
reservation makes Compose REFUSE to start the service on a host without the
toolkit — the default file has to start everywhere. It asks for the `utility`
capability only: enough for `nvidia-smi`, nothing that would let the container
compute on the card.

---

## Environment variables

**All of them are optional.** Mocky starts with none: accounts are created from
the sign-in screen and the model provider is configured in the UI.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | The port Express listens on |
| `MOCKY_PORT` | *(unset)* | **Overrides `PORT`.** Useful in development: a harness that injects `PORT` to configure Vite must not push the back end onto Vite's port. Leave it unset in production |
| `MOCKY_HOST` | `127.0.0.1` | **Source installs** — the interface the server itself listens on. Loopback by default, because `app.listen(PORT)` with no host binds every interface, which put an instance with open sign-ups on the LAN for anyone to claim. The image sets `0.0.0.0`; leave it alone, a container listening on loopback cannot be reached through its published port |
| `MOCKY_BIND` | `127.0.0.1` | **Docker only** — the host interface the port is published on |
| `MOCKY_DATA_DIR` | `server/data` | Where the JSON store lives. Point it at a mounted volume if needed |
| `MOCKY_MAX_STORAGE_MB` | `10240` | The ceiling on everything under the data directory. `0` means no limit, for someone who would rather watch their own disk — it has to be an explicit opt-out, because "unlimited by default" is how the problem existed in the first place. This is the number **Admin → Usage** prints in its banner, as `Instance total … / no ceiling` |
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

To **move** an instance to another server rather than restore it on the same
one, use Admin → Maintenance and migration instead: it copies piece by piece,
checks the new server first, and never puts the data in a file you have to carry.
See [Maintenance and migration](migration.md).

What lives in the `mocky-data` volume:

| Path | Contents | Size |
|---|---|---|
| `users.json`, `sessions.json`, `config.json`, `sso-jti.json` | Accounts and sessions | Tiny |
| `data-<uuid>.json` | One user's projects and `DESIGN.md` | Small |
| `text-config.json`, `images-config.json` | Configured providers — **secrets** | Tiny |
| `muse-cache.json` | Distillations, 7-day TTL, text | Small |
| `image-library.json` and `image-library/` | The image library | Medium |
| `video-library/` | Sequences: one clip plus up to 150 frames each | **By far the largest** |
| `video-config.json` | Motion Ultra settings — the master switch, the 3D access list, the render level and the last server test, and **the Remotion licence key** | Tiny |
| `video-exports.json` and `video-exports/` | Exported films, whole. Nothing prunes them: a job's hash is a link somebody may follow days later, so the disk budget bounds the directory instead | Medium to large |

**How much 3D the render worker may spend is a setting, and the panel measures
it for you.** Without a graphics card, headless Chromium draws every WebGL frame
on the CPU, so the cost of a film is a property of the host rather than of Mocky:
Admin → Motion Ultra has three render levels — no 3D, limited 3D (the default), full 3D
— and a server test that renders three reference films and reports, per level,
how long a typical film takes, how many an hour the queue gets through, and how
many people can launch one at the same moment and all have it within three
minutes. It recommends a level; you apply it. The test holds the queue's render
slot while it runs, so a user's render waits rather than being refused.

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
`node:22-slim`. Plan for the build disk, and for a slow first build.

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

See the next section. It is a **separate, small** resource with its own
`Dockerfile`: no Chromium, no ffmpeg, and nothing shared with the application
but the repository.

---

## The documentation

Two folders, deliberately decoupled.

- **`docs/`** — the content. Markdown files, nothing else.
- **`docs-site/`** — the site around it: `lumy.config.json`, Mocky's own
  widgets, and the `Dockerfile` that serves it.

The site is built by [Lumy](https://github.com/PetitOursManu/Lumy), a
documentation tool written for Mocky and published on its own, open source like
Mocky. It is the `lumy-docs` development dependency, installed from Lumy's release
on GitHub, so the version that builds the site in production is the one in
`package-lock.json`.

### How it works

Lumy reads `docs/` and writes a static site: one HTML page per page and per
language, a search index, `llms.txt` for language models, a sitemap. Everything
the site needs is in the build — no CDN, no third-party font, no request to
GitHub.

English lives at the root of `docs/`; French lives under `docs/fr/`, path for
path. A French page that does not exist yet shows the English one, with a notice
saying so, instead of an error.

`docs-site/lumy.config.json` holds everything that is not prose: the two
languages, the navigation and who each group is for, the colours (the logo's
teal), the header links. Old addresses of the form `/#/architecture/overview`
still land on the right page (`legacyHashRoutes`), so links shared before the
move keep working.

> **What changed with the move.** The previous viewer fetched the Markdown from
> GitHub on every page view, so a pushed `.md` appeared without a redeploy. The
> site is now built, so **content reaches readers when the resource is
> redeployed**. With automatic deployment on push, which is how Coolify is
> usually set up, that is the same thing a few minutes later. In exchange, pages
> no longer depend on GitHub answering, and they carry search, both languages
> and the interactive blocks.

### Previewing locally

```bash
npm run docs
```

That serves the site on `http://127.0.0.1:4173` and rebuilds it on every save,
in both languages. Before pushing a change to the documentation:

```bash
npm run docs:check
```

It fails on a broken link, an image that does not exist, or a
block Lumy does not know. CI runs it on every push. The previous viewer showed
those mistakes to readers instead.

### Deploying the site

| Coolify setting | Value | Why |
|---|---|---|
| Build type | **Dockerfile** | |
| Dockerfile | `./docs-site/Dockerfile`, build context the repository root | It needs both `docs/` and `docs-site/` |
| Exposed port | `4000` | |
| Health check | `GET /_lumy/api/health` | |
| Persistent volume | mounted at `/data` | The dashboard account and the readers' feedback. The pages themselves are rebuilt at every start |
| Domain | `mocky-docs.emanuelvigreux.fr` | Coolify's proxy terminates TLS |

Variables to set in Coolify:

```bash
LUMY_TRUST_PROXY=1               # Coolify's proxy sits in front
LUMY_ADMIN_USER=…                # creates the dashboard account at first start
LUMY_ADMIN_PASSWORD=…
LUMY_SECRET=…                    # encrypts the API keys saved in the dashboard
```

**Set the two `LUMY_ADMIN_*` variables before the first deploy.** Like Mocky
itself, the first account created becomes the administrator; on a public domain,
whoever opens `/_lumy/setup` first would otherwise get it.

Reading needs no account: the site is public and registration stays closed. The
account only opens the dashboard at `/_lumy/admin`, where the answers to "Was
this page helpful?" arrive, each with the page and, when the reader wrote one,
what was missing. The dashboard is also where Lumy's reader assistant can be
switched on later, with a local Ollama or a hosted model.

A plain static host works too: `npm run docs:build` writes the site to
`docs-site/dist/`. Set `"feedback": false` in `lumy.config.json` first, since a
static host has nowhere to send the answers.

### Translations

Every French page starts with a `source_hash`: a fingerprint of the English page
it translates. When the English page changes, the fingerprint no longer matches,
the French page shows readers a notice that it may be behind, and
`npm run docs:check` lists it.

After bringing a translation up to date, record it:

```bash
npx lumy translations --root docs-site --stamp fr/deployment
```

`--stamp fr` records every French page at once — only after checking them all.
The changelog is the exception: `scripts/build-changelog.mjs` writes both
languages from the same history, so its French page says `generated: true` and
is never counted as behind.

`tests/docs-parity.test.js` keeps the two trees in step: the same pages, the
same headings at the same levels, and a reasoned `:::why` block under every
heading of the three documents that explain their decisions.

### Mocky's own blocks

Two pages show real data rather than a copy of it: `:::widget presets` draws the
preset gallery and `:::widget rules` the quality rules. `docs-site/widgets.js`
registers both with Lumy and reads `docs-site/data/*.json`, which
`scripts/build-docs-data.mjs` generates from the application's own sources.
`npm run check:docs-data` fails when the two drift apart.

The text inside each block is the fallback: it is what search indexes, and what
a reader without JavaScript sees.

### Adding a page

1. Create the `.md` file under `docs/`, and its translation under `docs/fr/` at
   the same path.
2. Add its path, without `.md`, to `nav` in `docs-site/lumy.config.json`. Give
   it an `audience` if it is for one kind of reader only.
3. Run `npm run docs:check`, then push.

Links are ordinary Markdown links, **relative to the current file**, the way
GitHub reads them: from `architecture/overview.md`, write `invariants.md` for its
neighbour and `../deployment.md` for this page. A link that leaves `docs/` — to
`src/` or `server/` — opens the file on GitHub.

`docs/README.md` is the home page, and `docs/fr/README.md` the French one.
