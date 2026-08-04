# Architecture overview

## 1. Where things live

The single most structural fact about the project:

> **The generation pipeline runs in the browser.**

| Concern | Runs in | Files |
|---|---|---|
| Capability selection (deterministic) | Browser | `src/lib/capabilities/select.ts` |
| Planner (optional, structured output) | Browser | `src/lib/plan.ts` |
| Generation, editing, repair (streamed) | Browser | `src/lib/generate.ts` |
| Pipeline orchestration and phases | Browser (React) | `src/components/ProjectView.tsx` |
| `DESIGN.md` bridge (preamble, tokens, export) | Browser | `src/lib/design.ts`, `designTokens.ts`, `export/` |
| Which direction governs a generation | Browser | `src/lib/direction.ts` |
| Sandboxed render | Browser | `src/components/Preview.tsx`, `lib/capabilities/prelude.ts` |
| Persistence | `localStorage`, mirrored to the server when signed in | `src/lib/project.ts`, `sync.ts`, `merge.ts` |
| Accounts, SSO, JSON sync, model proxy | Server | `server/index.js`, `server/provider-proxy.js` |
| Muse: MCP, fetching, distillation, dossier | Server | `server/muse/` |
| Images, videos, libraries | Server | `server/images/`, `server/videos/` |

The back end is deliberately small: JSON files under `server/data/`, no database,
no native dependencies. The runtime dependencies are `express`, `cookie-parser`,
plus `@modelcontextprotocol/sdk` and `zod` for Muse.

Writes are atomic — write to a temporary file, then rename. A crash mid-write
never leaves a half-written file.

This "no database, no native dependencies" posture is a de facto invariant, and
the `node:20-slim` image depends on it holding.

---

## 2. The capability registry

A **capability** is something Mocky injects into the preview so a generated
component can use code it did not write itself. There are three kinds, declared
in `src/lib/capabilities/types.ts`:

```ts
export type CapabilityKind = 'cdn-script' | 'cdn-css' | 'snippet-pack'
```

- **`snippet-pack`** — plain JSX, held as a string, prepended to the generated
  code *before* `Babel.transform`. This is the dominant kind.
- **`cdn-css`** — a `<link>` tag.
- **`cdn-script`** — a `<script>` tag that exposes a global.

The `cdn-*` names are historical. **No capability points at a third party.**
`daisyui` loads `/vendor/daisyui.min.css` and `motion-lib` loads
`/vendor/motion.js`, both served by the same server that served the page. That is
[invariant I3](architecture/invariants.md), and it is about the *dependency*, not
about the shape of the tag.

### What ships

| id | Kind | Triggers | Provides |
|---|---|---|---|
| `icons` | snippet-pack | baseline, always selected | `Icon.*` — 42 inline SVG icons, plus 3 aliases (`GitHub`, `LinkedIn`, `YouTube`) |
| `daisyui` | cdn-css | `daisy`, `semantic`, `btn`, `card component`… | A vendored stylesheet of semantic classes |
| `charts` | snippet-pack | `chart`, `graph`, `dashboard`, `analytics`, `sparkline`… | `BarChart`, `LineChart`, `DonutChart`, `Sparkline`, `ProgressRing` |
| `motion` | snippet-pack | none — `retired: true` | `FadeIn`, `Stagger`, `Marquee`, `Counter`, `Reveal`, `ShimmerButton`, `BentoGrid`, `BentoCard`, `BorderBeam`, `TextReveal`, `Meteors`, `AnimatedBeam` |
| `motion-lib` | cdn-script | none — pulled in by `requires` | `window.Motion`, from `/vendor/motion.js` |
| `animate` | snippet-pack | `animation`, `motion`, `hero`, `landing`, `parallax`… | `Animated`, `Ticker`, `CountUp`. Declares `requires: ['motion-lib']` |
| `scrollvideo` | snippet-pack | none — added explicitly | `ScrollSequence` |

### Selection

`selectCapabilities()` is deterministic and calls no model.

It concatenates the user prompt and the design direction in force (`DESIGN.md`,
or the project's own — whichever `resolveDirection` returned), lowercases the
result, and selects a capability if **any** of its keywords or intents appears as
a substring. Then:

1. baseline capabilities are always added;
2. `requires` is resolved transitively, so `animate` pulls in `motion-lib`;
3. `conflictsWith` removes conflicting entries.

This is deliberately coarse. Refinement, when it happens, comes from the planner.
The planner can only **choose from this list**, never extend it.

### Two capabilities with no triggers, for opposite reasons

**`motion` is retired.** `<Animated>` replaced it.

Deleting the entry from the registry would have been the obvious move and would
have been a bug. Capability ids are **persisted on every screen** in
`Screen.caps`, so a screen generated last week still asks for `motion` at render
time. Without the entry its prelude is no longer injected, `FadeIn` and `Marquee`
become undefined, and every one of those screens throws.

So it keeps no triggers, which means the shortlist can never pick it, plus
`retired: true`, which removes it from the capability documentation the model
reads. Old screens keep rendering exactly as before; new screens only ever see
`<Animated>`.

**`scrollvideo` is never guessed.** The component is useless without a `base` URL
and a frame count, and those exist only once Muse has actually paid for a clip.
It is added at generation time when a sequence was produced, and only then. A
screen offered `<ScrollSequence>` with nothing to draw would render a black box
three viewports tall.

### Validation at module load

```js
validatePack(id, components, snippets)
```

This runs for every `snippet-pack` when the registry is imported, and it throws
in both directions: a documented component that no snippet exports, or an export
with no component metadata.

The `exports` list is written by hand, never derived from the source. That is
[invariant I1](architecture/invariants.md) applied to the prelude itself.

### The prelude

`buildPrelude(caps)` concatenates the `cn()` helper, then **all** the sources of
every selected snippet-pack.

Packs are **atomic**: never a subset, never filtered per component. Every source
passes through `sanitizeSource()`.

---

## 3. The planner

`src/lib/plan.ts` is a cheap, non-streamed model call that decides the screen's
structure and which capabilities it actually needs, before generation runs.

```ts
options: { temperature: 0.2, num_ctx: 8192, num_predict: 1024 }
format: PLAN_SCHEMA     // Ollama structured output
stream: false
```

The default timeout is 3 000 ms.

**The planner must never block or break a generation.** A network error, a
timeout, a non-JSON reply, a wrong shape: all of them resolve to `null`, and the
caller silently falls back to the deterministic shortlist. That is why this
module does its own `fetch` instead of reusing `chat()`, which throws.

`validatePlan()` filters the returned capability ids. Only ids that exist in the
registry **and** appear in the shortlist survive, so hallucinated ids disappear.
Baseline capabilities are always re-added, so the planner cannot drop them.

The validated plan becomes a plain-text section appended to the system message.
Structured output is safe here because the call is small and not streamed. It is
**never** used for code generation, which would break both the live preview and
the sentinel protocol.

The planner is **skipped when Muse ran**, because the dossier already supplies
the structure.

---

## 4. Generation

![A generated screen, rendered at full size](../assets/11-screen-hero.png)

*What comes out: a single self-contained React + Tailwind component, compiled inside the sandbox and rendered live.*

### The sentinel protocol

The model is asked to wrap its output:

```
<<<MOCKY>>>
…the complete component…
<<<END>>>
```

Not Markdown fences. The reason is streaming: partial code can be extracted as
soon as it arrives, without waiting for a closing fence.

`extractCode()` tries three things in order: sentinels, a legacy fenced code
block for backward compatibility, then the raw content.

#### Why the closing sentinel is matched loosely

The closing sentinel is accepted **as it arrives**, not as it was requested. One
real screen ended like this:

```
const __mockyDefault = App
<<<END>>ablytyped
```

One `>` short, with a fragment of prose welded on. `indexOf('<<<END>>>')` found
nothing, so the tail was kept **as code**, and every later compile of that screen
died on "Unterminated JSX contents".

`<<<` is not valid JavaScript anywhere outside a string. The moment it appears at
the start of a would-be sentinel, the code is over. `stripTrailingSentinel()`
cuts there, both at extraction and at render, so screens already stored with a
corrupted tail heal on their next load instead of failing forever.

### Parameters

```ts
options: { temperature: 0.4, num_ctx: 32768, num_predict: 16384 }
```

A full screen easily exceeds 8 000 tokens. When the cap is hit the code is cut
mid-string and the preview shows an incomprehensible syntax error, so the budget
is generous. `num_predict` must stay strictly positive — see
[invariant I8](architecture/invariants.md).

Truncation is detected through `done_reason` or `finish_reason` being `length`,
including via `choices[0]`, and reported to the user in plain words.

### Streaming

The response body is read as NDJSON: one JSON object per line. A partial line is
kept in a buffer and completed by the next chunk.

Each content fragment calls `onChunk(extractCode(full, { streaming: true }))`, so
the preview rebuilds live.

In streaming mode `extractCode` does **not** cut on an approximate closing
sentinel. A half-written sentinel is just the next few characters arriving, and
cutting on it would truncate the preview on every chunk. Once the response is
complete, a malformed sentinel is all there will ever be, so it does cut.

### The three call sites

| Function | Used for | Additional rules |
|---|---|---|
| `generateComponent()` | A new screen | `extraSystem` carries the project's design direction (`resolveDirection` — the established one, this run's Muse dossier, or `DESIGN.md`), the earliest screen as an identity reference, plus capabilities and the plan |
| `editComponent()` | Editing selected screens | `EDIT_RULES`: preserve everything the user did not ask to change, byte for byte. The complete component is returned, not a diff |
| `fixComponent()` | Auto-repair after a render error | Not streamed. Receives the **same** capability prompt — without the list of existing globals the model cannot tell which component is undefined, and swaps one React #130 error for another |

### Editing without a model call

`tryDirectTextReplace()` handles the common case. If the clicked element's
visible text appears **exactly once** verbatim in the source, it is replaced in
place: instant and free.

Zero or several occurrences return `null`, and the caller falls back to a
targeted model edit. This is not name discovery, so it does not violate invariant
I1: it swaps a literal the user is directly looking at.

When a model call is needed, anchoring is **text-first**. The rendered DOM path
(`nth-of-type`) cannot be reliably mapped back to JSX, whereas the element's
exact class string appears verbatim in the JSX and is the strongest anchor. The
selector is passed only as a last-resort hint.

### The Motion guard

`guardMotion()` runs every output through `stripForbiddenMotion()`, a real Babel
AST walk rather than a regular expression. See
[Animations](muse/animations.md).

---

## 5. The sandbox

![The mode toolbar of a project](../assets/08-toolbar.png)

*The eight verbs of a project. Link, Modify, Interact and Annotate all act through the sandboxed preview; Frame, System, Demo and Export act on the canvas around it.*

`src/components/Preview.tsx` builds a self-contained HTML document and injects it
as `srcDoc`.

### The iframe

```html
<iframe sandbox="allow-scripts" srcDoc={srcDoc} />
```

`allow-scripts` and nothing else. Without `allow-same-origin` the origin is
opaque: no `localStorage`, no cookies, no access to the parent DOM. Blob URLs are
same-origin relative to that opaque origin, so the compiled module runs without
CORS. This is [invariant I2](architecture/invariants.md).

A test reads the source file and requires **exact equality** of the attribute,
not a substring match. `"allow-scripts allow-same-origin"` contains
`"allow-scripts"`, so an `includes` check would have passed while the frame ran
model-generated code with Mocky's own origin.

### The Content-Security-Policy

`allow-scripts` alone restricts nothing outbound. A generated component could
call `fetch()`, `sendBeacon()` or `new Image().src = …` against any host, from
the user's IP, on every render.

```
default-src 'none'
script-src  <parent origin> 'unsafe-inline' 'unsafe-eval' blob:
style-src   <parent origin> 'unsafe-inline'
img-src     * data: blob:
font-src    * data:
connect-src 'none'
form-action 'none'
frame-src   'none'
object-src  'none'
base-uri    'none'
```

`'self'` would be a trap. The document has no origin of its own, so `'self'`
serialises to `"null"` and would block React, Babel and Tailwind. The parent's
origin is named explicitly instead.

`img-src` stays permissive on purpose. A remote image is a weak tracking vector,
but it is also how a mockup shows a photo, and models legitimately emit picture
URLs.

`'unsafe-inline'` and `'unsafe-eval'` are unavoidable: the whole point of the
document is to run code compiled at runtime.

### What the document loads

React, ReactDOM and Tailwind first, then the capability tags, then Babel — all
from `/vendor/`.

Every file is hash-pinned in `public/vendor/VENDOR.md` and verified by
`npm run check:vendor`, which runs in CI. Previews therefore work **offline**,
and a CDN compromise cannot reach them.

No tag carries `crossorigin`. Since the origin is null, that attribute would turn
every script into a CORS request with `Origin: null`, which the server does not
handle, so the script would fail to load.

### The compilation path

1. The source is base64-encoded into a `<script type="text/plain">`. This removes
   every character that could break the HTML or the template: backticks, `${`,
   quotes, newlines, `</script>`.
2. The prelude is encoded the same way, when there is one.
3. `Babel.transform(prelude + '\n' + source, { presets: [['react', { runtime: 'classic' }]] })`
   runs **inside the iframe**.
4. The result executes through a `blob:` URL, which gives real error positions.
5. The component mounts inside a React error boundary.

The boundary is necessary because `createRoot` renders **asynchronously**. A
render error is thrown after the synchronous `try/catch` has already returned, so
it would escape to `window.onerror` as an opaque "Script error." — the module
comes from a `blob:null` origin.

The boundary catches it with the real message and the component stack, and posts
it to the parent. That feeds both the error box and `fixComponent`. It only ever
fires on real errors, which is
[invariant I5](architecture/invariants.md).

React error #130 is rewritten before being reported, because its minified message
teaches nothing:

> Element type is invalid (React #130): a component or icon you rendered is
> undefined — likely a missing or misspelled name.

### The interaction bridge

A small script inside the frame talks to the parent over `postMessage`.

| Message | Direction | Purpose |
|---|---|---|
| `pick` mode | Parent → frame | Highlight the hovered element. On click, report a CSS selector, the visible text, the tag and the class string |
| `demo` mode | Parent → frame | Given a list of `{selector, target}` pairs, a click asks the parent to navigate |
| `ok` | Frame → parent | The component mounted successfully |
| `error` | Frame → parent | A compile or runtime error, with its real message |
| `size` | Frame → parent | The rendered content height |

In pick mode the selection is exact for *Modify*, and walks up to the nearest
interactive ancestor for *Link*.

Identity comes from **the sending window**, never from a field inside the
message. `frameId` is written in clear into every `srcDoc`, so one preview could
read another's id out of the DOM and forge messages on its behalf. And `e.origin`
is the useless string `"null"` for every sandboxed frame.

```js
if (e.source !== iframeRef.current?.contentWindow) return   // in the parent
if (e.source !== window.parent) return                      // in the frame
```

Symmetrically, a frame may only report a pick while pick mode is actually on, and
may only request navigation while it has demo links. Without those checks a
rendered component could drive the parent's UI at will.

### Keeping the mockup inside its own document

A sandboxed frame is always allowed to navigate **itself**. An `<a href="/">`, a
submitted form, a `location.assign()` — any of them make the frame drop the
`srcDoc` and load Mocky's own `index.html`. Because its origin is opaque, every
module script of the app then fails CORS: a white screen, a console full of
errors, and the screen the user just generated is gone.

Four guards, in depth:

1. **`window.open` is neutralised** before any generated code runs.
   `window.location` is deliberately untouched: it is a non-configurable
   accessor, so redefining it throws and would take the whole bridge down.
2. **A capturing click handler cancels every `<a href>` and `<area href>`**,
   fragments included. A `srcdoc` document inherits the *parent's* URL as its
   base, so `#pricing` resolves to `http://localhost:8787/#pricing` — a different
   document. The scroll a fragment was meant to perform is done by hand with
   `scrollIntoView`, so in-page anchors still behave like anchors.
3. **Form submissions are cancelled.** A `<form>` with no `action` posts to the
   document URL, which is Mocky's own page.
4. **The parent counts the frame's `load` events.** The first load is the
   `srcDoc`; any later one means the frame went elsewhere. The parent then
   re-assigns `srcdoc`, an attribute it owns whatever the frame's origin, and
   shows a "links are inert" notice for three seconds.

### Timing

The `srcDoc` is rebuilt with a **500 ms debounce**, so a token stream does not
rebuild the iframe on every character.

A **20 second timeout** prevents waiting forever if no message arrives.

During generation, errors are ignored because the code is incomplete by
construction. An error whose source code has changed since the `srcDoc` was built
is discarded as stale.

### Capture: the exception that no longer is

`src/lib/capture.ts` used to mount a **same-origin** iframe, and this document
used to explain at length why that was unavoidable. It no longer is.

The reason was html2canvas: it has to read the document it photographs, and it
clones that document into an iframe of its own, so a sandbox without
`allow-same-origin` gave every descendant a **fresh** opaque origin and the frame
could not read its own clone. It failed with "Blocked a frame with origin null
from accessing a cross-origin frame", on the default path and with
`foreignObjectRendering` alike.

Mocky now snapshots with **snapdom**, which serializes the subtree into an SVG
`<foreignObject>` with every node's computed style inlined, then rasterizes that
through a `data:` URL. Nothing in that path crosses an origin boundary, so the
capture frame carries `allow-scripts` and nothing else — exactly like a preview.
For the second or so of a capture, the model's code no longer runs with Mocky's
origin, which means it can no longer read the provider API key out of
`localStorage` or reach into `window.parent`.

Measured in an opaque origin before the change was made: the capture succeeds,
`toDataURL()` does not throw (the canvas is not tainted), Tailwind's injected
utilities are honoured, and `rgb(var(--token) / 0.5)` composites to the exact
pixel. 113 ms by default against 111 ms for html2canvas with the origin open.

Two consequences worth knowing:

- **`connect-src` had to open to this origin.** snapdom inlines a picture by
  fetching its bytes; under `connect-src 'none'` every fetch was blocked and each
  image became a grey placeholder. `/api/images/:hash` therefore also answers with
  `Access-Control-Allow-Origin: *` — it is already unauthenticated by design, so
  a wildcard exposes nothing. Every other outbound directive stays shut, so there
  is still nowhere to send anything.
- **A hidden tab defers the capture.** snapdom rasterizes by awaiting
  `img.decode()`, which never settles in a document the browser is not
  compositing: backgrounded, the same capture took 39 s where html2canvas took
  1 s. The shell now waits for `visibilitychange` rather than burning its
  watchdog.

---

## 6. One dialect for every model

Mocky always speaks the Ollama dialect internally: `POST /api/chat`, with
`options`, `num_ctx`, `num_predict`, `format`, and NDJSON streaming.

`server/text/dialect.js` translates to and from OpenAI-compatible APIs: request
shape, `response_format`, vision attachments as `image_url`, and SSE to NDJSON.
Generation, the planner and Muse are therefore vendor-agnostic, with no second
code path.

The proxy lives in two places that share the same module: a Vite middleware in
development, and `app.use('/__provider', …)` in Express for production.

Three protections apply.

**An allowlist of subpaths.** `/api/chat` and `/api/tags`, nothing else.

**An SSRF guard.** `assertSafeTargetResolved()` accepts http and https only,
rejects `localhost`, private ranges, link-local addresses and
`169.254.169.254` — then **resolves the hostname in DNS and re-checks every
returned address**. Without that second step, a hostname the caller controls
(`evil.test` → A 127.0.0.1) walked past the string tests untouched. IPv4-mapped
IPv6 forms are covered explicitly, in both spellings: `::ffff:127.0.0.1` and its
hexadecimal twin `::ffff:7f00:1`.

**A bounded body.** `readRawBody()` stops at 25 MB. Unbounded, it accumulated
whatever the client sent and then called `Buffer.concat` inside the `end`
listener. A body past `buffer.constants.MAX_LENGTH` threw outside any promise
chain and, with no `uncaughtException` handler, took the whole server down.

An **administrator-configured** target deliberately bypasses the SSRF guard.
Pointing at a local model — Ollama, LM Studio or vLLM on `127.0.0.1` — is a
supported setup, and only an administrator can set it. The guard stays fully in
force for any URL that came from a browser.

When an instance provider is configured, `/__provider` **requires a session**.
The request spends the host's credits, so it must belong to someone. With no
instance provider, the caller supplies its own key and the "your key never leaves
your browser" mode is preserved.

---

## 7. Persistence

### In the browser

| `localStorage` key | Contents |
|---|---|
| `mocky.projects.v1` | Projects, with screens, positions and links — and each project's own design direction |
| `mocky.design.v1` | The global `DESIGN.md` and its toggle — the fallback for a project that has no direction of its own |
| `mocky.settings.v1` | Provider, base URL, **API key**, planner on or off |
| `mocky.muse.v1` | Muse configuration: inspiration URLs, image mode, video, pinned media |
| `mocky.animations.v1` | `auto`, `on` or `off` |

### On the server

One file per user, `server/data/data-<uuid>.json`, holding serialised `projects`
and `design` plus an `updatedAt` timestamp. Two routes: `GET /api/data` and
`PUT /api/data`.

Syncing is **deferred and observable**. `scheduleSync()` marks state dirty, and a
`idle | syncing | failed` state is broadcast to subscribers so a failure is
visible in the UI. Previously a sync that gave up after thirty seconds of retries
was visible to nobody, not even the console.

Reconciliation compares `updatedAt` on both sides instead of assuming the server
is fresher, which used to overwrite local work. The merge in `src/lib/merge.ts`
uses tombstones with a TTL, so a deletion on one device does not come back from
another.

### The server store

| Path under `server/data/` | Contents |
|---|---|
| `users.json` | Accounts: scrypt salt and hash, role, `dashySub` |
| `sessions.json` | Token → `{ u: userId, t: timestamp }` |
| `config.json` | `{ allowRegistration }` |
| `sso-jti.json` | Consumed SSO token ids, pruned after 10 minutes |
| `data-<uuid>.json` | One user's projects and design |
| `text-config.json` | Administrator-configured text providers, including secrets |
| `images-config.json` | Image providers and video settings, including secrets |
| `muse-cache.json` | Distillations, 7-day TTL, text only |
| `image-library.json` | Image library metadata |
| `image-library/<hash>` | The image bytes |
| `video-library/` | Scroll sequences: clip, frames and poster |

Files holding secrets are written with mode `0600`. The default `0644` left them
readable by every other account on the machine.

---

## 8. HTTP surface

| Method and route | Auth | Purpose |
|---|---|---|
| `GET /api/health` | — | `dataWritable` and `frontendBuilt`; `503` with a `detail` naming what is wrong |
| `GET /api/config` | — | Registration open?, setup mode, SSO, instance model (no secrets) |
| `POST /api/register`, `/api/login` | rate-limited | The first account becomes administrator |
| `POST /api/logout`, `GET /api/me` | cookie | `/api/me` answers `200 { user: null }`, not `401` |
| `POST /api/account/password` | session, rate-limited | Revokes every session and issues a fresh one |
| `GET /sso/dashy/callback` | rate-limited | Verifies the HS256 token, finds or creates the account |
| `GET`/`PUT` `/api/admin/config`, `/users`, `…/password`, `DELETE /users/:id` | admin | Instance and user management |
| `GET`/`PUT` `/api/admin/text/config`, `POST /api/admin/text/test` | admin | The test sends a real request |
| `GET`/`PUT` `/api/admin/images/config`, `POST /api/admin/images/test` | admin | The test generates a real image, not stored |
| `POST /api/text/vision` | session | Probes the model's vision support. **Goes through the SSRF guard** |
| `GET`/`PUT` `/api/data` | session | The user's projects and design |
| `GET /api/mcp/status` | session | State of every declared MCP server |
| `POST /api/muse/dossier` | session | Discover → Distill → Dossier |
| `POST /api/images/generate`, `/upload` | session, 30/min | Generation is the expensive verb |
| `GET /api/images/library`, `/library.zip`, `POST /:hash/favorite`, `DELETE /:hash` | session | Library management |
| `GET /api/images/:hash` | **public** | See below |
| `POST /api/videos/generate` (6/min), `/upload` (20/min) | session | Different ceilings: generating costs money, uploading costs disk |
| `GET /api/videos/library`, `/:hash/meta`, `DELETE /:hash` | session | Sequence management |
| `GET /api/videos/:hash/poster.jpg`, `/:hash/f/:n.jpg` | **public** | See below |
| `ALL /__provider/api/chat`, `/api/tags` | session **if** an instance model is configured | Proxy and dialect translation |

### Why image and frame bytes are public

This is deliberate and load-bearing.

Preview iframes are sandboxed **without** `allow-same-origin`, so their origin is
opaque and their subresource requests carry **no SameSite cookie**. An
authenticated `/:hash` route would blank out every image in every mockup.

An exported ZIP also references these URLs from a machine with no session.

**The URL is the capability**: a 64-character hexadecimal SHA-256 of the content,
which cannot be guessed and is only ever handed out by an authenticated listing.
The pattern is exact — `PUBLIC_IMAGE_PATH = /^\/[a-f0-9]{64}$/` — so listing,
generating and deleting all stay behind a session.

The guard is attached to the **subpaths** the routers serve, not to the `/api`
mount. Mounted on `/api`, it ran for every later `/api/*` route too, which
silently put the public bytes behind authentication.

---

## 9. Export

`src/lib/export/project.ts` assembles a runnable **Vite + React + Tailwind**
project from the screens, with three targets.

| Target | Contents |
|---|---|
| `plain` | Tailwind plus Mocky's UI packs, vendored into the project |
| `shadcn` | The above, plus `components.json`, the standard `cn()` and the shadcn Tailwind theme, so `npx shadcn add …` inherits the brand through `globals.css` |
| `daisyui` | Tailwind plus the daisyUI plugin |

The JSX-to-ESM rewrite in `export/rewrite.ts` goes through Babel, never a regular
expression. It first transforms JSX into `React.createElement` so every component
reference becomes an ordinary identifier, then queries the scope.

`export/theme.ts` turns `DESIGN.md` into `globals.css`. Regular expressions are
allowed there because they scan **Markdown prose**, not code — the explicit
exemption in invariant I1.

The ZIP is written by `src/lib/zip.ts`, with no dependency: store method plus
CRC32. The same writer serves the image library's "Download all" and
`npm run backup`.

---

## 10. Tests

`npm test` runs Vitest across the repository. Three suites are worth knowing
about, because they read **the shipped code** rather than an abstraction.

**`tests/preview-sandbox.test.js`** locks the preview's security posture by
reading `Preview.tsx` and `capture.ts`: the exact `sandbox` value, the absence of
external tags, the CSP directives, the navigation guard, the behaviour of the
"no animation" mode, and the `postMessage` validation.

It exists because the only test enforcing invariant I3 looked at the
**registry**, and therefore never saw the `<script src="https://…">` tags written
directly into `buildSrcDoc`. Both had drifted to CDNs unnoticed.

**`tests/tokens-contrast.test.js`** reads `src/styles/tokens.css` and checks that
every text-on-background pair clears WCAG AA. Measured on the shipped values
before the fix: `text-slate-500` gave 2.09:1 on the beige theme, and the active
toolbar button measured 1.21:1 — its label was invisible.

**`tests/i18n-parity.test.js`** requires every key to exist in both French and
English, and no component to contain a hard-coded sentence. The interface used to
be bilingual **inside single components**: five components in French, twelve in
English, two mixed.

Alongside those: `registry.test.ts` for registry invariants at load time,
`ssrf-guard.test.js`, `routes-auth.test.js`, and the Muse, images and video
suites.

### CI

`.github/workflows/ci.yml` runs `build`, `test`, `check:vendor` and
`npm audit --omit=dev` on Node 20 **and** 22.

It then builds the Docker image, **starts it**, and waits for it to answer.
Building only proved that the Dockerfile parses; starting catches a missing
`COPY`, a broken `CMD`, or an unwritable data directory.

One step checks explicitly that `mocky.mcp.json` made it into the image. It had
gone missing once, and Muse started zero MCP servers while the image still paid
its 300 MB of Chromium.
