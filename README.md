<p align="center">
  <img src="public/favicon.svg" width="96" alt="Mocky logo" />
</p>

<h1 align="center">Mocky</h1>

<p align="center">A self-hosted, chat-to-UI generator — describe a screen in natural language and get a real React + Tailwind component, live, on an infinite canvas.</p>

---

Mocky is a self-hosted alternative to tools like Google Stitch / openStitch, built around two ideas:

- **Ollama Cloud as a first-class provider** — a configurable base URL (default `https://ollama.com`) + API key sent as a Bearer token, so you own your model access.
- **A portable design system (`DESIGN.md`)** — plain Markdown (color tokens, typography, spacing, component patterns) that Mocky prepends to every generation so screens stay on-brand across sessions.

## Features

- 🧠 **Chat-to-UI generation** — describe a screen, get a self-contained React + Tailwind component.
- 🖼️ **Infinite canvas** — a Stitch-like dotted board; pan/zoom, real-size resizable frames, Windows-style multi-select (click / Ctrl-click / marquee), arrange-to-grid.
- ▶️ **Interact mode** — click buttons, hover states and animations run live, right in the grid.
- 🔗 **Interaction links + Demo mode** — bind a real element of one screen to another, then play the clickable prototype.
- 📱 **Format presets & device frame** — Mobile (iPhone) / Desktop / Tablet; mobile screens render inside a CSS iPhone frame (status bar, notch, home indicator).
- 🎨 **Design system + style presets** — load/paste a `DESIGN.md` or pick a built-in visual style; it drives every generation.
- ✂️ **Screenshot annotations** — snip a region of a screen into the chat as numbered references, attached to (vision) generations.
- 📦 **Projects, export & history** — multiple projects, per-screen `.tsx` download and `.zip` export.
- 👤 **Optional accounts** — sign in to a Mocky instance and your projects + DESIGN.md sync across devices (self-hosted backend, no cloud). Without an account everything stays in your browser's `localStorage`.
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

## Notes

- The API key never leaves your browser and is not committed anywhere.
- The provider proxy runs as a Vite middleware in dev and in the Express backend in production (so the browser never hits the provider cross-origin).
- Backend storage lives in `server/data/` (JSON files, git-ignored) — accounts and per-user projects. It's a lightweight self-hosted store; for a hardened multi-user deployment you'd swap it for a real DB and add HTTPS.

---

<p align="center"><sub>Built with <a href="https://claude.com/claude-code">Claude Code</a>.</sub></p>
