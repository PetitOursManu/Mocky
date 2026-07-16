<p align="center">
  <img src="public/favicon.svg" width="96" alt="Mocky logo" />
</p>

<h1 align="center">Mocky</h1>

<p align="center">A self-hosted, chat-to-UI generator — describe a screen in natural language and get a real React + Tailwind component, live, on an infinite canvas.</p>

---

Mocky is a self-hosted alternative to tools like Google Stitch / openStitch, built around two ideas:

- **Ollama Cloud as a first-class provider** — a configurable base URL (default `https://ollama.com`) + API key sent as a Bearer token, so you own your model access.
- **A portable design system (`DESIGN.md`)** — plain Markdown (color tokens, typography, spacing, component patterns) that Mocky prepends to every generation so screens stay on-brand across sessions.
- **Generation tuned for real UIs** — the system prompt forbids wireframes, gray placeholders, and "Lorem ipsum"; it asks for finished, interactive components with real copy, hover/focus states, and modern Tailwind styling.
- **Optional "Sign in with Dashy" SSO** — let users authenticate through a [Dashy](https://github.com/PetitOursManu/Dashy) instance and find their Mocky projects without another password.

## Features

- 🧠 **Chat-to-UI generation** — describe a screen, get a self-contained React + Tailwind component.
- 🎨 **Production-ready output** — the prompt enforces real colors, spacing, rounded corners, shadows, interactive states, and realistic content (no wireframes).
- 🖼️ **Infinite canvas** — a Stitch-like dotted board; pan/zoom, real-size resizable frames, Windows-style multi-select (click / Ctrl-click / marquee), arrange-to-grid.
- ▶️ **Interact mode** — click buttons, hover states and animations run live, right in the grid.
- 🔗 **Interaction links + Demo mode** — bind a real element of one screen to another, then play the clickable prototype.
- 📱 **Format presets & device frame** — Mobile (iPhone) / Desktop / Tablet; mobile screens render inside a CSS iPhone frame (status bar, notch, home indicator).
- 🎨 **Design system + style presets** — load/paste a `DESIGN.md` or pick a built-in visual style (17 presets); it drives every generation.
- ✂️ **Screenshot annotations** — snip a region of a screen into the chat as numbered references, attached to (vision) generations.
- 📦 **Projects, export & history** — multiple projects, per-screen `.tsx` download and `.zip` export.
- 👤 **Optional accounts + SSO** — sign in to a Mocky instance and your projects + DESIGN.md sync across devices (self-hosted backend, no cloud). With a [Dashy](https://github.com/PetitOursManu/Dashy) instance, users can also **"Sign in with Dashy"** and reuse their projects. Without an account everything stays in your browser's `localStorage`.
- 🌗 **Themes** — Dark, Beige, and a Mocky (teal) light theme.

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS on the front, and an optional tiny **Node + Express** backend (JSON file store, no database, no native deps) for accounts + project sync and the production model proxy.

## Quick start

### Docker (recommended)

```bash
git clone https://github.com/vigre2000/Mocky.git
cd Mocky
docker compose up -d --build
```

Mocky is now live on **http://localhost:8787**. Data (accounts, projects, sessions) persists in the `mocky-data` Docker volume.

**Commands:**

| Command | Description |
|---|---|
| `docker compose up -d --build` | Build image and start in background |
| `docker compose logs -f` | Follow logs |
| `docker compose down` | Stop and remove container (data preserved in volume) |
| `docker compose down -v` | Stop and **delete all data** (volume removed) |

### Local development

**Frontend only** (projects saved in your browser):

```bash
npm install
npm run dev
```

**With accounts + cross-device sync** (also runs the backend):

```bash
npm install
npm run dev:all        # Vite + backend together
```

**Production build:**

```bash
npm run build          # builds the frontend to dist/
npm start              # backend serves dist/ + API + model proxy on :8787
```

Then open the app, go to **Settings**, and configure your provider:

1. **Provider** — Ollama Cloud
2. **Base URL** — `https://ollama.com` (or your own Ollama host)
3. **API key** — your Ollama Cloud key (stored only in your browser's `localStorage`)
4. **Model** — pick from the auto-loaded list (e.g. `gpt-oss:120b`)
5. **Test connection**, then head to **Studio** and describe a screen.

## Docker deployment

### Architecture

The Docker image is a **multi-stage build** based on `node:20-slim`:

- **Stage 1 (builder)**: installs all dependencies, runs `npm run build` → produces `dist/`
- **Stage 2 (runtime)**: installs only production dependencies, copies `dist/`, `server/`, and `public/` from the builder. Runs `node server/index.js`.

The Express server serves the built frontend, the `/api` endpoints (auth, data sync), and the `/__provider` proxy (SSRF-guarded reverse proxy to the model provider).

### Environment variables

All environment variables are **optional**. Mocky works out of the box without any configuration — accounts are created via the sign-in screen, and the model provider is configured in the browser's Settings.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8787` | Port the Express server listens on |
| `NODE_ENV` | `production` | Set to `production` for secure cookies and optimized serving |
| `SSO_SHARED_SECRET` | _(unset)_ | HS256 secret shared with Dashy for SSO. Must match Dashy's `SSO_SHARED_SECRET`. When set together with `SSO_DASHY_URL`, enables "Sign in with Dashy" |
| `SSO_DASHY_URL` | _(unset)_ | Public origin of your Dashy instance (e.g. `https://dashy.example.com`) |
| `MOCKY_ORIGIN` | _(auto-detected)_ | Mocky's own public origin, used as the SSO token's `aud` claim and to build the callback URL. In production: your Mocky domain. If unset, falls back to the request's `Origin` header or the server host |

**Setting env vars in Docker:**

```yaml
# docker-compose.yml
environment:
  SSO_SHARED_SECRET: "your-shared-secret-here"
  SSO_DASHY_URL: "https://dashy.example.com"
  MOCKY_ORIGIN: "https://mocky.example.com"
```

Or via a `.env` file (see `.env.example`):

```bash
cp .env.example .env
# Edit .env, then:
docker compose up -d --build
```

### Volumes

| Volume | Mount point | Description |
|---|---|---|
| `mocky-data` | `/app/server/data` | JSON file store: user accounts, sessions, and per-user project data. Named volume in docker-compose — persists across container rebuilds |

**Backing up data:**

```bash
# Export the volume to a tarball
docker run --rm -v mocky-data:/data -v $(pwd):/backup alpine tar czf /backup/mocky-data-backup.tar.gz -C /data .

# Restore from backup
docker run --rm -v mocky-data:/data -v $(pwd):/backup alpine tar xzf /backup/mocky-data-backup.tar.gz -C /data
```

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

The container includes a built-in health check that hits `GET /api/config` every 30 seconds. Check status with:

```bash
docker compose ps     # shows health status
docker inspect --format='{{.State.Health.Status}}' mocky
```

### Reverse proxy / HTTPS

For production deployments behind a reverse proxy (Nginx, Caddy, Traefik), set `NODE_ENV=production` and `MOCKY_ORIGIN` to your public HTTPS URL. The Express server does not handle TLS itself — use your reverse proxy for that.

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
- **Lucide** (conditional): CDN script for Lucide icons.

Capabilities are snippet-packs (vendored plain-JS source prepended to the generated code) or CDN CSS links. No CDN `<script>` tags are used for JS (they fail in the sandboxed null-origin iframe).

## SSO — "Sign in with Dashy"

Mocky can delegate authentication to a [Dashy](https://github.com/PetitOursManu/Dashy) instance, so a user signed in to Dashy can sign in to Mocky with one click and find their projects — without creating a separate Mocky account.

It's a standard **redirect OIDC-like flow**; the shared secret never touches the browser (the JWT is verified server-side). It is **disabled unless both `SSO_SHARED_SECRET` and `SSO_DASHY_URL` are set**, and it never interferes with the existing username/password login.

### Enable it

On the **Mocky** backend, set:

```bash
# The same HS256 secret Dashy signs SSO tokens with (must match Dashy's SSO_SHARED_SECRET)
SSO_SHARED_SECRET=$(openssl rand -base64 48)
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

- The API key never leaves your browser and is not committed anywhere.
- The provider proxy runs as a Vite middleware in dev and in the Express backend in production (so the browser never hits the provider cross-origin). Both proxies share the same SSRF-safe forwarding logic.
- Backend storage lives in `server/data/` (JSON files, git-ignored) — accounts and per-user projects. Writes are atomic (temp + rename) so a crash never leaves a corrupted file. It's a lightweight self-hosted store; for a hardened multi-user deployment you'd swap it for a real DB and add HTTPS.
- SSO secrets live in a `.env` file (git-ignored). `server/index.js` reads it automatically on startup so you don't need another dependency.

---

<p align="center"><sub>Built with <a href="https://claude.com/claude-code">Claude Code</a>.</sub></p>