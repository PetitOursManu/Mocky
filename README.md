<p align="center">
  <img src="public/favicon.svg" width="96" alt="Mocky logo" />
</p>

<h1 align="center">Mocky</h1>

<p align="center">A self-hosted, chat-to-UI generator — describe a screen in natural language and get a real React + Tailwind component, live, on an infinite canvas.</p>

<p align="center">
  <a href="https://github.com/PetitOursManu/Mocky/actions/workflows/ci.yml"><img src="https://github.com/PetitOursManu/Mocky/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
</p>

<p align="center">
  <img src="docs/assets/mocky-welcome.png" width="900" alt="Mocky's new-screen view: a prompt field, the ✨ Muse panel with inspiration URLs and image mode, format presets, and a row of style presets." />
</p>

<p align="center"><sub>Describe a screen, pick a format, and let ✨ Muse build the art direction. — <a href="docs/DESIGN-SYSTEM.md">design system</a></sub></p>

---

Mocky is a self-hosted alternative to tools like Google Stitch / openStitch, built around two ideas:

- **Ollama Cloud as a first-class provider** — a configurable base URL (default `https://ollama.com`) + API key sent as a Bearer token, so you own your model access.
- **A portable design system (`DESIGN.md`)** — plain Markdown (color tokens, typography, spacing, component patterns) that Mocky prepends to every generation so screens stay on-brand across sessions.
- **Generation tuned for real UIs** — the system prompt forbids wireframes, gray placeholders, and "Lorem ipsum"; it asks for finished, interactive components with real copy, hover/focus states, and modern Tailwind styling.
- **Optional "Sign in with Dashy" SSO** — let users authenticate through a [Dashy](https://github.com/PetitOursManu/Dashy) instance and find their Mocky projects without another password.

## Features

- 🧠 **Chat-to-UI generation** — describe a screen, get a self-contained React + Tailwind component.
- ✨ **Muse — design intelligence** — one toggle turns a prompt into a distinctive art direction with real copy, a coherent palette, and genuine generated imagery (see [✨ Muse](#-muse--design-intelligence) below). Grounded in live award-winning references via local MCP servers; zero keys required.
- 🎨 **Production-ready output** — the prompt enforces real colors, spacing, rounded corners, shadows, interactive states, and realistic content (no wireframes).
- 🖼️ **Infinite canvas** — a Stitch-like dotted board; pan/zoom, real-size resizable frames, Windows-style multi-select (click / Ctrl-click / marquee), arrange-to-grid.
- ▶️ **Interact mode** — click buttons, hover states and animations run live, right in the grid.
- 🔗 **Interaction links + Demo mode** — bind a real element of one screen to another, then play the clickable prototype.
- 📱 **Format presets & device frame** — Mobile (iPhone) / Desktop / Tablet; mobile screens render inside a CSS iPhone frame (status bar, notch, home indicator).
- 🎨 **Design system + style presets** — load/paste a `DESIGN.md` or pick a built-in visual style (17 presets); it drives every generation.
- ✂️ **Screenshot annotations** — snip a region of a screen into the chat as numbered references, attached to (vision) generations.
- 📦 **Projects & export** — multiple projects, per-screen `.tsx` download, and a runnable Vite project as `.zip`.
- 👤 **Optional accounts + SSO** — sign in to a Mocky instance and your projects + DESIGN.md sync across devices (self-hosted backend, no cloud). With a [Dashy](https://github.com/PetitOursManu/Dashy) instance, users can also **"Sign in with Dashy"** and reuse their projects. Without an account everything stays in your browser's `localStorage`.
- 🌗 **Themes** — Dark, Beige, and a Mocky (teal) light theme.

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS on the front, and a tiny **Node + Express** backend (JSON file store, no database, no native deps) for accounts, project sync, the image library, Muse and the model proxy.

## Quick start

**Prerequisites:** Docker, *or* Node 20.19+ (see `.nvmrc`). Nothing else — no database, no native modules.

**Mocky requires an account.** The first one you create becomes the instance admin, and only an admin can add other users or configure an instance-wide model. There is no anonymous mode: projects, the image library and Muse all live behind a session.

### Docker (recommended)

```bash
git clone https://github.com/PetitOursManu/Mocky.git
cd Mocky
docker compose up -d --build
```

Mocky is live on **http://localhost:8787**. Data (accounts, projects, sessions, generated images) persists in the `mocky-data` Docker volume.

> The port is published on `127.0.0.1` only, so the instance is not reachable from your network. Several routes spend your model credits, so that is the safe default. To expose it deliberately, set `MOCKY_BIND=0.0.0.0` in `.env` — and read [Reverse proxy / HTTPS](#reverse-proxy--https) first.

| Command | Description |
|---|---|
| `docker compose up -d --build` | Build image and start in background |
| `docker compose logs -f` | Follow logs |
| `docker compose ps` | Status, including the health check |
| `docker compose down` | Stop and remove container (data preserved in the volume) |
| `docker compose down -v` | Stop and **delete all data** (volume removed) |

### Local development

```bash
npm install
npm run dev:all        # Vite + backend together — this is the one you want
```

Then open **http://localhost:5173**.

> `npm run dev` starts the **web server only**, with no backend. Since Mocky needs an account and accounts live on the backend, the sign-in box will tell you it cannot reach it. Use `dev:all` unless you specifically want the frontend alone.

**Production build:**

```bash
npm run build          # builds the frontend to dist/
npm start              # backend serves dist/ + API + model proxy on :8787
```

### First run

1. Open Mocky. The sign-in box appears and **cannot be dismissed** — that is by design.
2. Create the first account. **It becomes the admin.** Keep the credentials; there is no password-reset flow, and promoting another account means editing `server/data/users.json` by hand.
3. Configure a model — two ways, and they are mutually exclusive:

   - **Per browser** (default) — **Settings** → provider `Ollama Cloud`, base URL `https://ollama.com`, your API key, then pick a model from the list and hit **Test connection**. The key is kept in that browser's `localStorage` and never reaches the server.
   - **Instance-wide** (admin) — **Admin** → *Modèle de texte*. The key is stored server-side and used for everyone; each user's own Settings are then greyed out. Pick this if you would rather not paste a key into every browser.

4. Describe a screen and generate. Turn on ✨ **Muse** for a full art direction with real copy and generated imagery — see [✨ Muse](#-muse--design-intelligence).

### Housekeeping

```bash
npm run backup         # → backups/mocky-YYYY-MM-DD-HHmm.zip
npm run check:vendor   # verify the vendored browser bundles against their hashes
npm test               # the full suite
```

`npm run backup` is plain Node and works identically on Windows, macOS and Linux. For a Dockerised instance, copy the data out of the volume first:

```bash
docker compose cp mocky:/app/server/data ./server/data
npm run backup
```

## Docker deployment

### Architecture

The Docker image is a **multi-stage build** based on `node:20-slim`:

- **Stage 1 (builder)**: installs all dependencies, runs `npm run build` → produces `dist/`
- **Stage 2 (runtime)**: installs only production dependencies, copies `dist/`, `server/`, and `public/` from the builder. Runs `node server/index.js`.

The Express server serves the built frontend, the `/api` endpoints (auth, data sync), and the `/__provider` proxy (SSRF-guarded reverse proxy to the model provider).

### Environment variables

All environment variables are **optional**. Mocky runs out of the box: accounts are created from the sign-in screen and the model provider is configured in the UI.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8787` | Port the Express server listens on |
| `MOCKY_PORT` | _(unset)_ | Overrides `PORT` for the backend. Useful in dev: a tool that injects `PORT` to configure Vite won't push the backend onto Vite's port. Leave unset in production and use `PORT` |
| `MOCKY_BIND` | `127.0.0.1` | **Docker only** — the host interface the container publishes on. `0.0.0.0` exposes Mocky to your network; do that only on a network you trust, or behind a reverse proxy |
| `MOCKY_DATA_DIR` | `server/data` | Where the JSON store lives. Point it at a mounted volume to keep state outside the app directory |
| `TRUST_PROXY` | _(unset)_ | Set to `1` (or a hop count, or an Express `trust proxy` value) **when Mocky sits behind a reverse proxy**. Without it every request looks like it comes from `127.0.0.1`, so the login rate limit becomes a single instance-wide bucket — nine failed attempts a minute and nobody can sign in |
| `NODE_ENV` | `production` | Enables optimised serving. Cookie security is derived from the actual connection, not from this |
| `SSO_SHARED_SECRET` | _(unset)_ | HS256 secret shared with Dashy for SSO. Must match Dashy's `SSO_SHARED_SECRET`. Together with `SSO_DASHY_URL`, enables "Sign in with Dashy" |
| `SSO_DASHY_URL` | _(unset)_ | Public origin of your Dashy instance (e.g. `https://dashy.example.com`) |
| `MOCKY_ORIGIN` | _(auto-detected)_ | Mocky's own public origin, used as the SSO token's `aud` claim and to build the callback URL. **Set it explicitly whenever SSO is on** — the fallback trusts the request's `Host` header |

**Setting env vars in Docker.** `docker-compose.yml` reads a local `.env`:

```bash
cp .env.example .env
# edit .env, then:
docker compose up -d --build
```

The server also logs whether SSO came up at boot, so a typo in a variable name shows immediately:

```
Mocky backend on http://localhost:8787
SSO: disabled (set SSO_SHARED_SECRET and SSO_DASHY_URL in .env to enable)
```

You can equally hard-code values under `environment:` in `docker-compose.yml`.

### Volumes

| Volume | Mount point | Description |
|---|---|---|
| `mocky-data` | `/app/server/data` | JSON file store: user accounts, sessions, and per-user project data. Named volume in docker-compose — persists across container rebuilds |

**Backing up data.** Copy the volume out, then use the bundled script — it is plain Node, so it behaves the same on Windows, macOS and Linux:

```bash
docker compose cp mocky:/app/server/data ./server/data
npm run backup
```

To restore: stop Mocky, unzip the archive over `server/data`, copy it back and start again.

```bash
docker compose cp ./server/data mocky:/app/server/data
docker compose restart
```

> The previous `docker run -v $(pwd):/backup alpine tar …` recipe does not work on Windows: `$(pwd)` is not `cmd.exe` syntax, and under PowerShell it expands to a path that may contain spaces, which breaks the `-v` argument.

The archive contains password hashes and session tokens — `backups/` is git-ignored, keep it that way.

### Ports

| Port | Protocol | Description |
|---|---|---|
| `8787` | HTTP | Express server (frontend + API + provider proxy) |

To change the exposed port, edit `ports` in `docker-compose.yml`:

```yaml
ports:
  - "3000:8787"    # expose on host port 3000
```

### Health check

`GET /api/health` reports on the two things that actually break a running instance:

```json
{ "ok": true, "checks": { "dataWritable": true, "frontendBuilt": true } }
```

It answers `503` with a `detail` string when either fails — a read-only data directory, or `npm start` without `npm run build`. The container health check polls it every 30 seconds.

```bash
docker compose ps     # shows health status
curl -s localhost:8787/api/health
```

### Reverse proxy / HTTPS

Behind Nginx, Caddy or Traefik:

- **Set `TRUST_PROXY=1`.** Otherwise every request appears to originate from the proxy, and the login rate limit collapses into one bucket shared by everyone.
- **Set `MOCKY_ORIGIN`** to your public HTTPS URL — required if SSO is enabled.
- Keep `MOCKY_BIND=127.0.0.1` (the default) and let the proxy reach Mocky over the loopback interface.
- Terminate TLS at the proxy. The Express server does not handle it.

Generate the SSO shared secret without needing `openssl` (which is not on a standard Windows `PATH`):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Example Caddyfile:

```
mocky.example.com {
    reverse_proxy localhost:8787
}
```

Example Nginx:

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

## How generation works

All traffic goes to the provider's `POST /api/chat` through a reverse proxy:

- **New screen** — system prompt (output rules + `DESIGN.md` + format hint) + your description.
- **Edit a selected screen** — the same rules **plus the full current component code** and a strict "change only what's asked, preserve everything else" instruction. The model returns the complete updated component.

The model's response uses a **sentinel protocol** (`<<<MOCKY>>> ... <<<END>>>`) instead of markdown fences, so partial code can be extracted during streaming without waiting for a closing fence. The request uses `num_ctx: 32768` to avoid truncation on large components.

### Runtime capabilities

Mocky auto-detects what the prompt needs and injects capabilities into the sandboxed preview iframe:

- **Icons** (baseline, always loaded): 26 inline SVG icons under the `Icon.*` namespace. The prompt bans hand-written `<svg><path d="...">` to prevent truncation.
- **Charts** (conditional): 5 inline-SVG chart components (BarChart, LineChart, DonutChart, Sparkline, ProgressRing). No external chart library.
- **Motion** (conditional): 12 CSS-only animation components (FadeIn, Stagger, Marquee, Counter, Reveal, ShimmerButton, BentoGrid, BentoCard, BorderBeam, TextReveal, Meteors, AnimatedBeam). No framer-motion.
- **DaisyUI** (conditional): CDN CSS for semantic component classes.

Capabilities are snippet-packs (vendored plain-JS source prepended to the generated code) or CDN CSS links. All JS is vendored — the only thing that may come from a CDN is CSS. There is no external JS `<script>` capability: an unreliable CDN would gate otherwise-valid previews behind a network fetch, so icons/charts/motion are all inline.

## ✨ Muse — design intelligence

Muse is an optional pass that lifts generation above generic "AI slop". Flip the
**✨ Muse** toggle next to the prompt and Mocky will, before building anything:

1. **Gather inspiration** — match your request to a curated registry of
   fetch-friendly galleries (Awwwards, land-book, …) and any URLs you paste, then
   fetch them through a **local, free MCP server** (`fetcher-mcp`, Playwright +
   Readability). Optional — off unless you tick **"Inspiration live"**.
2. **Distill** each page into a structured *InspirationCard* (palette, style
   adjectives, layout grammar, motion notes, clichés to avoid) — vocabulary and
   grammar only, never a copy of any specific design.
3. **Write a Design Dossier** — a **superset of `DESIGN.md`** with a concept,
   token palette, layout grammar, motion language, **real written copy in your
   language** (headline, subheadline, value props, CTA labels, footer), and an
   imagery plan. It cites which reference drove which choice, and a
   distinctiveness self-critique revises anything too generic.
4. **Generate imagery** — a hero image via a zero-key provider and inject it into
   the mockup, served from Mocky's own origin.

The Dossier then drives generation as the design authority (superseding
`DESIGN.md` for that screen). **Muse off ⇒ generation is byte-identical to
before.** Muse needs the backend running (it does nothing in pure-`localStorage`
mode).

### Image providers

Pick the provider in **Admin → Génération d'images (Muse)**. Keys are stored on
the server and never sent back to the browser; a **Test** button really generates
a throwaway image so you know it works. If a provider fails, Muse degrades to
placeholders rather than breaking the run.

| Provider | Key? | Notes |
|---|---|---|
| `pollinations` | ❌ none | Default. Free, URL-based; may watermark. Rate-limited (~1 req/15 s) so requests are queued server-side. An optional free token raises the limit. |
| `fal` | ✔ | [fal.ai](https://fal.ai) — FLUX & co. Pick any model id (`fal-ai/flux/schnell`, `fal-ai/flux/dev`, `fal-ai/flux-pro/v1.1`…). Prefer a fast model: the synchronous endpoint is used. |
| `openai-image` | ✔ | Any endpoint exposing `POST {baseUrl}/v1/images/generations` — OpenAI (`gpt-image-1`, `dall-e-3`), LiteLLM, compatible gateways. |
| `cloudflare-workers-ai` | ✔ | Generous free tier. Needs an account id + an API token with the Workers AI permission. |
| `sd-webui` | ❌ | Your own **Automatic1111 / Forge / SD.Next** instance (started with `--api`). No key, no rate limit, nothing leaves your machine. |
| `none` | — | Muse still runs; slots get palette placeholders. |

> The `sd-webui` base URL is called by the Mocky server itself and is expected to
> be a local address, so it deliberately bypasses the SSRF guard applied to
> untrusted URLs. Only an admin can set it — point it at an instance you trust.

Every generated image is saved to a **global Image Library** (`data/image-library/`),
deduplicated by content hash, reusable across projects. Browse it from the
**📚 Bibliothèque** tab: search, filter, favorite, download, "Tout télécharger"
(ZIP + `manifest.json`), and **pin** images into the next run (pinned images are
assigned to slots before any new image is generated). Deleting a project never
deletes library images; only explicit deletion does.

### MCP servers

Local MCP servers are declared in [`mocky.mcp.json`](mocky.mcp.json) and spawned
by the backend over stdio — all local, free, open-source. Swap or add servers
there without touching code (the router matches semantic *roles* to whichever
server exposes a matching tool). Health is at `GET /api/mcp/status`. The Docker
image bundles `fetcher-mcp` + Chromium so live inspiration works out of the box;
if that layer is skipped, Muse falls back to the offline prompt-pattern library.

### Higgsfield (manual workflow)

Higgsfield.ai has no free API, so it isn't integrated. To use it: generate an
image on Higgsfield, download it, then drop it into Mocky's Image Library (or a
project) and pin it — Muse will use it like any other image.

### Ethics & ToS

Muse is built to respect the sites it learns from:

- **No bulk scraping.** It fetches only the curated registry pages and URLs you
  paste, capped at **6 fetches per run**, honoring **`robots.txt`**, with an
  honest `User-Agent` (`Mocky-Muse/…`) and a 7-day, **text-only** cache to keep
  load low.
- **No third-party images are ever stored, cached, proxied, or displayed** —
  only Mocky-generated images and text distillations persist.
- **Inspiration = tokens + vocabulary + structural grammar**, never a copy of a
  specific design.
- **Fetched web content is treated as untrusted data**, never as instructions.
- All outbound URLs pass an SSRF guard; the default path needs **zero API keys,
  zero accounts**.

> Note on dependencies: the MCP SDK pulls a few transitive packages with audit
> advisories (`hono`, `body-parser`, `shell-quote`, `esbuild`) — all in the SDK's
> HTTP-server transport, which Mocky does **not** use (we're a stdio client).

## SSO — "Sign in with Dashy"

Mocky can delegate authentication to a [Dashy](https://github.com/PetitOursManu/Dashy) instance, so a user signed in to Dashy can sign in to Mocky with one click and find their projects — without creating a separate Mocky account.

It's a standard **redirect OIDC-like flow**; the shared secret never touches the browser (the JWT is verified server-side). It is **disabled unless both `SSO_SHARED_SECRET` and `SSO_DASHY_URL` are set**, and it never interferes with the existing username/password login.

### Enable it

On the **Mocky** backend, set:

Generate a secret (Node rather than `openssl`, which is not on a standard Windows `PATH`):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Then, on the **Mocky** backend, set:

```bash
# The same HS256 secret Dashy signs SSO tokens with (must match Dashy's SSO_SHARED_SECRET)
SSO_SHARED_SECRET=<the value you just generated>
# The public origin of your Dashy instance
SSO_DASHY_URL=https://dashy.example.com
# Mocky's own public origin (used as the token's `aud` claim and to build the
# callback URL). In production: your Mocky domain. In dev: the Vite origin.
MOCKY_ORIGIN=https://mocky.example.com        # production
# MOCKY_ORIGIN=http://localhost:5173          # dev (Vite SPA origin, NOT :8787)
```

On the **Dashy** side (see Dashy's README → *SSO — "Sign in with Dashy"*), set the same `SSO_SHARED_SECRET` and add Mocky's callback to the allow-list:

```bash
SSO_SHARED_SECRET=<same value as Mocky>
SSO_ALLOWED_REDIRECTS=https://mocky.example.com/sso/dashy/callback,http://localhost:5173/sso/dashy/callback
```

### Flow

1. On the sign-in screen, Mocky shows a **Sign in with Dashy** button (only when SSO is enabled).
2. Clicking it stores an opaque `state` in `sessionStorage` and redirects to `${SSO_DASHY_URL}/api/sso/authorize?redirect_uri=<callback>&state=<state>`.
3. Dashy authenticates the user (its normal login, **including 2FA**), signs a 60-second HS256 JWT, and redirects to `${MOCKY_ORIGIN}/sso/dashy/callback?token=<jwt>&state=<state>`.
4. Mocky's backend verifies the signature, `iss === "dashy"`, `aud === MOCKY_ORIGIN`, `exp`, and that the `jti` hasn't been used before, then **finds-or-creates** a Mocky account linked to the Dashy user (by `sub`), sets the session cookie, and redirects to `/?sso=ok&state=…`.
5. The SPA checks the returned `state` matches, restores the session, and reconciles projects with the server — exactly like a normal sign-in.

SSO-only accounts have **no password** and can only sign in via Dashy. Dashy `admin` users map to Mocky `admin`. Existing Mocky accounts are never auto-linked (linking happens only by `dashySub`, which only SSO-created accounts carry).

### Token contract

Signed with `SSO_SHARED_SECRET` (HS256), 60 s lifetime. Claims: `sub` (stable Dashy user id), `email`, `name?`, `role`, `iss="dashy"`, `aud=<Mocky origin>`, `iat`, `exp`, `jti`. The token proves identity only — it grants **no** access to Dashy's own API.

## Notes

- **Model provider — two modes.** By default the API key never leaves your browser (per-user Settings). Optionally, an **admin can configure instance-wide text providers** (Admin → *Modèles de texte*): Ollama Cloud, OpenAI, OpenRouter, fal.ai, or any OpenAI-compatible endpoint (Groq, Together, DeepSeek, Mistral, LM Studio, vLLM…). In that mode the key is stored **on the server** and used by every account of the instance, and each user's own Settings are ignored. Leave the provider on *Aucun* to keep the browser-only behaviour.
- **Two text profiles.** *Génération* writes the screens and runs the planner — it is also the model that receives the ✨ inspiration image, so it is the one probed for vision. *Inspiration* powers Muse's Design Dossier; it writes no code, so a cheaper model does. Leaving it on *Aucun* makes it reuse the generation model. Internally the profile travels as an `x-mocky-profile` header, so untagged callers always get *génération*.
- Mocky always speaks the **Ollama dialect** internally; the provider proxy translates to/from OpenAI-compatible APIs (request shape, `response_format`, vision attachments, and SSE → NDJSON streaming), so generation, the planner and Muse are vendor-agnostic.
- An admin-configured endpoint may legitimately be a local address (a model on `127.0.0.1`), so it bypasses the SSRF guard that still applies to any browser-supplied URL.
- The provider proxy runs as a Vite middleware in dev and in the Express backend in production (so the browser never hits the provider cross-origin). Both proxies share the same SSRF-safe forwarding logic.
- Backend storage lives in `server/data/` (JSON files, git-ignored) — accounts and per-user projects. Writes are atomic (temp + rename) so a crash never leaves a corrupted file. It's a lightweight self-hosted store; for a hardened multi-user deployment you'd swap it for a real DB and add HTTPS.
- SSO secrets live in a `.env` file (git-ignored). `server/index.js` reads it automatically on startup so you don't need another dependency.

---

<p align="center"><sub>Built with <a href="https://claude.com/claude-code">Claude Code</a>.</sub></p>