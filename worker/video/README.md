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

## What it renders

One composition, `ImageSequenceVideo`, and it is the only thing a caller can
reach: `render.js` selects it by id, so a request cannot name anything else.

**The model never writes Remotion code.** It writes one JSON object, validated
by `src/lib/video/timeline.ts`, and hand-written compositions consume it. Every
composition in `remotion/` is written by a person, and that is the founding rule
of the feature rather than a stage it went through. Read the props as hostile
and the rest follows: nothing from the timeline is ever interpolated into
markup, a class name, a style string or a URL. The overlay text is a React
child — escaped by React, and by nothing else. The image addresses are built
here from a validated 64-character hash. `dangerouslySetInnerHTML` does not
appear in this directory and must not start.

A scene is one image, shown for `durationMs`, with a Ken Burns move and a
transition into the scene that follows it.

| Field | What it does |
|---|---|
| `kenBurns` | `zoom-in` / `zoom-out` drift between 1.0 and 1.12; `pan-left` / `pan-right` slide a 1.12-overscaled frame by ±4%; `static` does nothing. Small on purpose — the model picks the effect without ever seeing the result |
| `transitionOut` | `crossfade`, `wipe-left`, `wipe-right`, `none`. It describes how a scene LEAVES, and it is implemented by how the next one arrives: only the incoming scene animates, on top of a predecessor that stays opaque, because a two-sided fade dips through the background at its midpoint and blinks |
| `textOverlay` | Up to 120 characters at `top` / `center` / `bottom`, on a semi-opaque panel with a shadow — either alone loses, over a bright sky or a dark photograph |
| `aspectRatio` | `16:9` → 1920×1080, `9:16` → 1080×1920, `1:1` → 1080×1080. 1080 on the long edge in all three, so a portrait export is not quietly the low-quality option |
| `outputFormat` | `mp4` (h264) or `webm` (vp8, not vp9 — several times slower for a gain nobody watching a slideshow will see, on a budget of 110 s and two cores) |

Everything runs at **30 fps**, which is not configurable: the schema has no fps
field, so an option here would be one nobody can reach.

**A transition never lengthens the video.** It bites into the end of the
outgoing scene and the start of the incoming one. Appending its own duration
instead would make the schema's 120-second ceiling a lie by up to nineteen
half-seconds, and Mocky's own 120-second job timeout would start killing exports
that had validated cleanly. It is also capped at a third of the shorter of the
two scenes it joins — the schema's minimum scene is one second, and an uncapped
half-second transition on each side of one leaves nothing of it standing alone.

`remotion/composition.js` holds all of that arithmetic in plain JavaScript, with
no React and no Remotion import, so `composition.test.js` can check it inside
Mocky's own vitest suite. Frame counts, offsets and geometry are where the
defects are, and they are the only part of a video that can be verified without
producing one. Do not move the maths into the JSX.

### How the images reach Chromium

They arrive as base64 in the request body, are written into a `mocky-frames/`
directory inside the served bundle, and are removed when the render ends.

That route was picked by elimination. **This container has no egress**, so
fetching an image by URL is not an option — and Mocky's origin is frequently a
name that only resolves on someone's LAN anyway. `file://` URLs cannot be loaded
as subresources of an `http://` page; Chromium refuses them, and the only way
round it is to disable web security in a renderer displaying model-supplied
content. `data:` URLs work, but they mean up to 80 MB of base64 serialised into
the props of a page that is also running an encoder.

The staging directory is emptied at the start of every render rather than named
per request, so a render abandoned mid-flight cannot leave stale frames inside a
bundle that lives as long as the container. And the composition uses Remotion's
`<Img>`, which cancels the render when it cannot load a picture — a staging
mistake is a failed job with a message, never a video of blank frames reported
as a success.

### It does not trust its caller

Mocky validates every timeline against the zod schema before enqueuing a job, so
`validate.js` never refuses anything on a healthy instance. That is why it is
here: this is a plain HTTP service with no authentication of its own, and the
internal bridge it sits on is a deployment choice rather than a guarantee.

It is deliberately not a third copy of the schema — it checks whether the
composition can *render* the document, and `validate.test.js` requires its
bounds and enumerations to match `server/video/timeline.js` on a corpus,
defaults included. Unknown keys are refused and named, which doubles as
version-skew detection: a Mocky that learned to send `audio` fails with the word
in the message instead of getting a silent video back.

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

# One scene, one pixel. `imageId` has to be 64 lower-case hex characters and the
# bytes for it have to be in the same request — the worker fetches nothing.
ID=$(printf 'a%.0s' $(seq 64))
PIXEL=iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=
curl -X POST http://localhost:3030/render -H 'content-type: application/json' \
     -d "{\"timeline\":{\"scenes\":[{\"imageId\":\"$ID\",\"durationMs\":2000}]},
          \"images\":[{\"id\":\"$ID\",\"mime\":\"image/png\",\"base64\":\"$PIXEL\"}]}" \
     --output scene.mp4
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
  "timeline": { /* a VideoTimeline — re-validated here, see above */ },
  "images":   [ { "id": "<sha256>", "mime": "image/png", "base64": "…" } ],
  "licenseKey": "…"   // optional; see below
}
```

Answers `200` with the video bytes, a video content type, and
`x-mocky-worker-composition: ImageSequenceVideo` — which is also how a container
left behind on an older image gives itself away in a network trace. Bodies are
accepted up to 80 MB, because the images travel inside the request rather than
as URLs back to Mocky: this container has no guarantee of a route home, and no
egress to use one with.

Every scene's `imageId` must have matching bytes in `images`. There is no
fallback for a missing one; a video with a blank scene in the middle would be
reported as a successful export.

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
| `400` | A body Express refused (malformed JSON, over the limit), or a timeline `validate.js` refused. The message names the field |

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
  validate.js          what this worker will render, checked without trusting the caller
  validate.test.js     that check, and its agreement with server/video/timeline.js
  render.js            everything that imports @remotion/*, behind a dynamic import
  remotion/
    index.js               registerRoot — bundled, never run by Node
    Root.jsx               the composition list; one entry, with calculateMetadata
    ImageSequenceVideo.jsx the composition. React, written by hand
    composition.js         its id, geometry and frame maths, in plain JS so both Node
                           and the bundle can import them
    composition.test.js    that arithmetic, without rendering a video
```

The tests run from the repository root (`npm test`) even though this is a
separate sub-project, and each one is deliberate about it.

`server.test.js` tests the wire between two halves that cannot see each other,
which is exactly where a contract drifts unnoticed. It works only because
`server.js` imports no Remotion package — if that stops being true, the test
stops running everywhere the worker has not been built, and that is the signal
to put the import back behind `render.js`. The same rule keeps `validate.js` and
`remotion/composition.js` free of Remotion imports.

`validate.test.js` imports `server/video/timeline.js`, which is the one place
this sub-project reaches outside itself. **That import is test-only and must
stay that way**: the Docker build copies this directory and nothing else, so a
runtime import of anything under `server/` produces a container that boots and
then fails every render on a missing module.

## Versions

`@remotion/bundler`, `@remotion/renderer` and `remotion` are pinned to an exact
version, not a range. No lockfile is committed, because generating one means
installing Remotion inside the Mocky repository — the contamination this
sub-project exists to prevent. The exact pins are what make two builds of the
same commit ship the same renderer.

Upgrading is deliberate: change all three to the same version, rebuild, and
re-read the licence terms for that release.
