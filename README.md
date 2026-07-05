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
- 🎨 **Design system + style presets** — load/paste a `DESIGN.md` or pick a built-in visual style; it drives every generation.
- ✂️ **Screenshot annotations** — snip a region of a screen into the chat as numbered references, attached to (vision) generations.
- 📦 **Projects, export & history** — multiple projects, per-screen `.tsx` download and `.zip` export.
- 👤 **Optional accounts + SSO** — sign in to a Mocky instance and your projects + DESIGN.md sync across devices (self-hosted backend, no cloud). With a [Dashy](https://github.com/PetitOursManu/Dashy) instance, users can also **"Sign in with Dashy"** and reuse their projects. Without an account everything stays in your browser's `localStorage`.
- 🌗 **Themes** — Dark, Beige, and a Mocky (teal) light theme.

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS on the front, and an optional tiny **Node + Express** backend (JSON file store, no database, no native deps) for accounts + project sync and the production model proxy.

## Getting started

**Frontend only** (projects saved in your browser):

```bash
npm install
npm run dev
```

**With accounts + cross-device sync** (also runs the backend):

```bash
npm install
npm run dev:all        # Vite + backend together
# or, in two terminals: `npm run server` and `npm run dev`
```

Then click **Sign in** (top-right) to create an account. Your projects and `DESIGN.md` sync to the instance; your **API key stays in the browser** and is never sent to the server.

**Production:**

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

## How generation works

All traffic goes to the provider's `POST /api/chat` through a dev proxy:

- **New screen** — system prompt (output rules + `DESIGN.md` + format hint) + your description.
- **Edit a selected screen** — the same rules **plus the full current component code** and a strict "change only what's asked, preserve everything else" instruction. The model returns the complete updated component.

## SSO — "Sign in with Dashy"

Mocky can delegate authentication to a [Dashy](https://github.com/PetitOursManu/Dashy) instance, so a user signed in to Dashy can sign in to Mocky with one click and find their projects — without creating a separate Mocky account.

It's a standard **redirect OIDC-like flow**; the shared secret never touches the browser (the JWT is verified server-side). It is **disabled unless both env vars are set**, and it never interferes with the existing username/password login.

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
