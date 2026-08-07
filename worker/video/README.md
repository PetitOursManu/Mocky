# Mocky — Remotion render worker

> ### ⚠️ Read this before you build the image
>
> This service renders video with **[Remotion](https://www.remotion.dev/)**, and
> Remotion is **not free for everyone**.
>
> Its licence is free for **individuals**, for **non-profit organisations**, and
> for **companies with up to three employees**. Past that threshold, using it —
> including inside something you run only for yourself — requires a paid
> **Company Licence**, bought per seat from Remotion.
>
> The licence also does not settle the case Mocky would otherwise be in:
> **redistribution inside a self-hosted product**. That is why Remotion is not in
> Mocky's `package.json`, not in Mocky's image, and not in the default
> `docker-compose.yml`. Nothing about video export exists on an instance that has
> not built this directory.
>
> **Building this image is the moment the question becomes yours.** Read
> <https://www.remotion.dev/> — the licence terms, and whether your organisation
> is over the threshold — before you run the build. Nobody else can answer it for
> you, and Mocky deliberately does not pretend to.

---

## Why this is a separate service

Three reasons, in the order they matter.

1. **Licensing.** The paragraph above. Keeping Remotion out of Mocky's
   dependency tree is what makes the licence question *not exist* for the people
   who never turn video export on, which is almost everyone.
2. **Size.** Remotion brings a Chrome build and a webpack toolchain. That is
   several hundred megabytes added to an image whose whole selling point is that
   it runs on a small self-hosted box.
3. **Blast radius.** A render is a browser plus an encoder pinned to a core for
   a minute. In its own container, with its own memory and CPU limits, a render
   that goes wrong is a failed export. In Mocky's container, it is an outage.

The separation is enforced in four places, and all four have to hold:

| Where | What it guarantees |
|---|---|
| `worker/video/package.json` | Remotion's packages live here, never in Mocky's manifest |
| `worker/video/Dockerfile` | A second image, built only on request |
| `.dockerignore` (repository root) | `worker/` never enters Mocky's own build context |
| `docker-compose.yml` | `profiles: ["video-export"]` — absent unless asked for |

---

## What it does today — phase 1

**This worker ignores the timeline and the images it is sent, and returns a
three-second test card.**

That is the point of the phase. The chain it has to prove is long — browser →
Mocky's API → timeline schema → in-memory queue → HTTP → this container →
Chromium → mp4 → back into the video library — and every link in it can be wrong
in a way that looks like one of the others. A fixed composition removes the
renderer from the list of suspects.

Because a solid-colour clip is indistinguishable from a broken render, the test
card says what it is in three ways:

- the picture reads *"test card — this is not your timeline"*, with a running
  second counter that proves frames actually advanced;
- the response carries `x-mocky-worker-phase: test-card`;
- the container logs a `PHASE 1` warning on every boot.

Phase 2 replaces `renderTestCard` with a composition that consumes a
`VideoTimeline`. The HTTP contract does not change.

**The model never writes Remotion code.** It writes one JSON object, validated
by `src/lib/video/timeline.ts`, and hand-written compositions consume it. Every
composition in `remotion/` is written by a person, and that is the founding rule
of the feature rather than a phase-1 convenience.

---

## Build and run

From the repository root:

```bash
docker compose --profile video-export up -d --build
```

Without `--profile video-export`, nothing here is built, created or started.
`docker compose up -d` behaves exactly as it did before this directory existed.

To stop only the worker:

```bash
docker compose --profile video-export stop video-worker
```

Locally, without Docker (it needs Node 22.12+ and will download a Chrome build
on first run):

```bash
cd worker/video
npm install
npm run ensure-browser   # optional; server.js does it at boot anyway
npm start                # listens on :3030
```

Check it:

```bash
curl http://localhost:3030/health
curl -X POST http://localhost:3030/render -H 'content-type: application/json' \
     -d '{}' --output test-card.mp4
```

---

## The HTTP contract

Two routes. The client is `server/video/worker.js` in the Mocky repository, and
its expectations are the specification.

### `GET /health`

```json
{ "ok": true, "version": "0.1.0" }
```

Anything other than a 200 means "unavailable" to Mocky's admin panel. `version`
is this package's version, and it is displayed to the administrator.

### `POST /render`

```jsonc
{
  "timeline": { /* a parsed VideoTimeline — ignored in phase 1 */ },
  "images":   [ { "id": "<sha256>", "mime": "image/png", "base64": "…" } ],
  "licenseKey": "…"   // optional; see below
}
```

Answers `200` with the video bytes and a video content type. Bodies are accepted
up to 80 MB, because the images travel inside the request rather than as URLs
back to Mocky — this container has no guarantee of a route home.

**Every failure is one line of plain text, not JSON and not an HTML page.** Mocky
splices up to 300 characters of a non-2xx body straight into the sentence the
user reads, and braces or a stack trace in the middle of that sentence help
nobody.

| Status | When |
|---|---|
| `429` | A render is already running. The worker does one at a time |
| `504` | The render passed 110 s and was abandoned — ten seconds under Mocky's own 120 s deadline, so the worker gets to be the one that explains |
| `500` | The render failed, or produced no bytes |
| `404` | A route that does not exist, usually a `workerUrl` with a stray path |
| `400` | A body Express refused: malformed JSON, or over the limit |

---

## Egress, and what a licence key changes

**With no licence key configured, this container has no outbound network access
at all.** The compose network it sits on is declared `internal: true`, so Docker
creates it without a gateway: the worker can talk to Mocky, and to nothing
beyond the host.

That is deliberate, and a licence key changes it. From **Remotion 5.0, telemetry
is mandatory for a licensed render** — a key that is configured but cannot reach
Remotion is a key that does not work. So:

1. Mocky's admin panel says this at the point where the key is entered. It is
   never applied silently.
2. The key is stored server-side, never returned to the browser, and travels to
   this worker in the render request.
3. Giving the container the access that telemetry needs is **one visible line**:
   `internal: true` → `internal: false` on the `video-worker` network in
   `docker-compose.yml`. It belongs to whoever entered the key.

The worker never logs the key and never echoes it in a response; a test in
`server.test.js` holds that.

---

## How Mocky reaches it

Put `http://video-worker:3030` in the admin panel's *Render worker URL* field.
That is the compose service name, on the internal bridge, and it is the intended
configuration rather than a workaround.

It needs saying because it looks like it should not work. Mocky guards every URL
the server fetches with `assertSafeTargetResolved()`, which rejects private
address ranges — SSRF protection for the deliberately open provider proxy — and
a compose service name resolves into `172.16/12`. **This URL is the third
administrator-only bypass of that guard**, alongside the text-provider target and
the sd-webui base URL, and it is written down with them in
`docs/architecture/invariants.md`.

The reasoning, because a bypass that is not argued for is one somebody removes:
the guard exists to stop a *browser* choosing where the server fetches, and this
URL arrives only through `PUT /api/admin/video/config` behind `requireAdmin`. It
is local by definition — this container has no published port and no route out
by design. The alternative the guard forced was worse in the direction that
counts: publishing an unauthenticated endpoint that accepts 80 MB bodies on a
resolvable address, which is what the panel used to advise.

What is still checked: the scheme must be `http` or `https`, and neither call
follows a redirect, so a worker answering `302` towards the metadata endpoint
cannot turn the bypass into an SSRF of its own.
`createVideoWorker({ guard })` still takes the check as a parameter — an operator
running this on a public host can hand `assertSafeTargetResolved` back in.

---

## Layout

```
worker/video/
  README.md            this file — the licence warning is the first section on purpose
  package.json         Remotion's packages, pinned exactly. Never merged into Mocky's
  Dockerfile           node:22-bookworm-slim + Chromium's libraries + ffmpeg
  .dockerignore        this directory is its own build context
  server.js            Express: GET /health, POST /render. Imports no Remotion package
  server.test.js       the HTTP contract, run by Mocky's own vitest suite
  render.js            everything that imports @remotion/*, behind a dynamic import
  remotion/
    index.js           registerRoot — bundled, never run by Node
    Root.jsx           the composition list; one entry in phase 1
    TestCard.jsx       the test card
    composition.js     its id and dimensions, in plain JS so render.js can import them
```

`server.test.js` runs from the repository root (`npm test`) even though this is a
separate sub-project. It tests the wire between two halves that cannot see each
other, which is exactly where a contract drifts unnoticed — and it works only
because `server.js` imports no Remotion package. If that stops being true, the
test stops running everywhere the worker has not been built, and that is the
signal to put the import back behind `render.js`.

## Versions

`@remotion/bundler`, `@remotion/renderer` and `remotion` are pinned to an exact
version, not a range. No lockfile is committed, because generating one means
installing Remotion inside the Mocky repository — the contamination this
sub-project exists to prevent. The exact pins are what make two builds of the
same commit ship the same renderer.

Upgrading is deliberate: change all three to the same version, rebuild, and
re-read the licence terms for that release.
