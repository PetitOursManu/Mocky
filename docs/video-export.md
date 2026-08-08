# Motion

Mocky turns a list of images from the media library into an `.mp4`. Not a screen,
not a scroll sequence: a film, cut from pictures the user picked, rendered by
[Remotion](https://www.remotion.dev/) in a container that is absent from a
default install.

**The feature is called Motion; the code is called `video`.** It shipped as
"Video export", which named a file format rather than the thing on offer, so
every string a user reads now says Motion. Nothing under the surface followed:
`server/video/`, `src/lib/video/`, `/api/video/*`, the `video-export` compose
profile and the `video.*` translation keys all keep their names. Renaming them
would touch both halves of a dictionary, every call site and the tests that pin
them, to change identifiers no interface ever prints — and it would break the
one-letter distinction below, which people already trip over.

This page is about the decisions. What each control does is in
[the interface](interface.md); the worker's own HTTP contract is in
`worker/video/README.md`.

---

## What it makes, and what it does not

A slideshow. One image per scene, each with a duration, a Ken Burns move and a
transition into the next, optionally captioned with a line burnt into the frame.
Twenty scenes at most, two minutes at most, 30 fps, in `16:9`, `9:16` or `1:1`.

There is **no audio** — no music, no voice-over, no narration — and no field to
ask for one. That absence is enforced rather than merely unimplemented: every
object in the schema is `.strict()`, so a document carrying an `audio` key is
refused whole. A schema that stripped unknown keys instead would accept the
request, render silence, and report a success; the user would be told they got
what they asked for while watching something else.

The same singular/plural trap runs through the code and is worth learning once:
**`server/video/` is the export pipeline, `server/videos/` is the clip library**
that feeds scroll sequences into a mockup. Two features, one letter apart.

---

## The founding rule: the model writes JSON, never Remotion

A model is involved exactly once, in `server/video/compose.js`, and what it
returns is one JSON object. It **orders and tunes** images the user has already
chosen. It does not pick the pictures, and it never writes a frame of rendering
code. Every composition under `worker/video/remotion/` is written by hand.

This is the only tenable architecture for a self-hosted product where anybody
plugs in any model. The alternative — let the model emit Remotion/React source
and run it — means an instance owner's machine executing arbitrary code written
by whichever provider they configured, inside a container that has a browser and
an encoder in it. Mocky already runs model-written code in the preview, and it
gets away with it because that code runs in an iframe with an opaque origin and
no access to anything ([I2](architecture/invariants.md)). A render worker has no
equivalent cage: it is a Node process whose job is to touch the filesystem and
spawn Chromium.

So the trust boundary is moved instead. The model's entire output is data
matched against a schema, and the only thing that turns that data into pixels is
code a person wrote and a test covers.

### The schema is the entire surface

`src/lib/video/timeline.ts` is the definition to read. Anything the model can
express has to be something a composition already knows how to render, and
anything it cannot express is **unreachable rather than discouraged**: there is
no fps field, so there is no argument about frame rates; no `src`, so no way to
name a picture that is not in the library.

`imageId` is a 64-character lower-case SHA-256 — an address in Mocky's own image
library ([M8](architecture/invariants.md)), never a URL. Accepting a location
there would hand the model a way to pull remote bytes into a file Mocky then
hosts as its own, which is what [M2](architecture/invariants.md) exists to
forbid. Lower-case only, because `data/image-library/{hash}` is a path: `AB…` and
`ab…` would be two names for one file on a case-sensitive volume and one file
with two spellings elsewhere, a lookup miss that only reproduces on Linux.

### A refused document is refused, never repaired

There is no clamping of a forty-second scene to fifteen, no truncation of a
200-character caption, no dropping of the twenty-first scene. The temptation is
real, because each of those repairs turns a failed model call into a shipped
video. It is also the exact hole the schema was written to close.

Two reasons, and the second is the one that decides it:

- A repaired document is one nobody validated. Clamping a 40 s scene does not
  produce the film that was asked for, it produces a different legal one, and
  the user cannot tell which they are looking at.
- Repair is where the whole-timeline ceiling dies. Fix each scene independently
  and twenty of them still add up to five minutes.

The same refusal applies to an `imageId` the user did not select. It is refused,
not substituted for the nearest one — a helpful substitution puts a picture in
somebody's film that they never chose. An image left *out* of the proposal is
only a notice, because the difference is who pays: a foreign id adds something,
a missing one just makes the proposal shorter than the selection, and adding the
scene back is one click in an editor the user is already looking at.

A proposal that produced nothing answers **`200` with `timeline: null` and
notices**, never a 4xx. The user still has the manual editor they opened the
modal with, and a failed proposal is not a failed request
([Q1](architecture/invariants.md)).

### Two copies of the schema, held together by a test

`server/video/timeline.js` mirrors the TypeScript by hand. That is deliberate
duplication, for the same reason `server/images/zip.js` duplicates
`src/lib/zip.ts`: `package.json` declares `"node": ">=22.12"`, and at that floor
`node server/index.js` throws `ERR_UNKNOWN_FILE_EXTENSION` on a `.ts` import.
Making the API's only validation depend on which Node minor an administrator
happens to run is a much worse trade than one mirrored file.

`timeline.test.js` runs a corpus of documents through both schemas and requires
identical answers, defaults included. Edit one side alone and the suite fails —
which matters most in the dangerous direction: a bound loosened on the server
alone means the API accepts what nothing downstream can render.

---

## The Remotion licence, and the separate service

Remotion is free for individuals, for non-profit organisations, and for
companies with up to three employees. Past that threshold it requires a paid
Company Licence, bought per seat. And its licence does not settle the case Mocky
would otherwise be in: **redistribution inside a self-hosted product**.

So Remotion is not in Mocky's `package.json`, not in Mocky's `Dockerfile`, and
not in the default `docker-compose.yml`. It lives in `worker/video/`, behind
`profiles: ["video-export"]`:

```bash
docker compose --profile video-export up -d --build
```

Without that flag the service is not built, not created and not started, and
`docker compose up -d` behaves exactly as it did before the directory existed.
**Nothing about video export exists on an instance that has not built it** —
which is the point. Keeping Remotion out of the dependency tree makes the licence
question *not exist* for everyone who never turns the feature on, which is almost
everyone. Building that image is the moment the question becomes yours.

Two smaller reasons ride along and would not have been enough on their own:
Remotion brings a Chrome build and a webpack toolchain, several hundred
megabytes added to an image whose selling point is that it runs on a small box;
and a render is a browser plus an encoder pinned to a core for a minute, which in
its own container with its own limits is a failed export rather than an outage.

The separation is enforced by `tests/video-worker-separation.test.js`, and that
is the part worth insisting on: four documents explain this rule, and a document
cannot fail a build.

### The three-employee threshold counts employees, not accounts

Mocky cannot know how many people your organisation employs. The number it *can*
count is accounts on the instance, and those are not the same number — a
one-person company can run an instance with forty accounts on it, and a
forty-person company can run one with a single login.

Every sentence in the admin panel is therefore written to state the rule and let
the administrator apply it, and never to assert that they are over the line. The
warning quotes the account count explicitly as *not* being the answer. A warning
that is wrong half the time is one people learn to dismiss, including the times
it is right.

The licence key is stored server-side and never returned to the browser:
`publicView()` replaces it with a `hasLicenseKey` boolean, the same discipline
every provider key gets. It travels to the worker inside the render request,
because the worker is what renders.

**A key changes the worker's network posture, visibly.** From Remotion 5.0
telemetry is mandatory for a licensed render, so a key that is configured but
cannot reach Remotion is a key that does not work. The compose network the worker
sits on is declared `internal: true` — Docker creates it with no gateway, so with
no key the container has no outbound access at all. Granting the access telemetry
needs is one line, `internal: true` → `internal: false`, and it belongs to
whoever entered the key. The panel says so at the point of entry rather than
turning egress on quietly.

---

## The worker URL and the SSRF guard

The render worker's URL is the **third administrator-only bypass** of Mocky's
SSRF guard, alongside the admin text target and the sd-webui base URL. It is
enumerated with them in [the invariants](architecture/invariants.md), and the
full reasoning lives there rather than being repeated here — that list is short
and complete on purpose, and a bypass argued for in a feature page instead of in
the invariants is one somebody removes.

The short version: guarded, the feature had **no working configuration at all**.
The worker ships on an `internal: true` bridge with no published port, so its
only address is a service name resolving into `172.16/12`. What is still checked
is in the same entry.

---

## The arithmetic of transitions

A transition **bites into** its neighbours. It eats the end of the outgoing scene
and the start of the incoming one; it is never added to the running time.

That is what keeps the two-minute ceiling honest. If a transition appended its
own duration, twenty scenes would carry nineteen of them, and a timeline that
validated at exactly 120 000 ms would render 129.5 s — past the schema's ceiling,
and past the queue's own 120-second job timeout, which would then start killing
exports that had validated cleanly.

`msToFrames` rounds **down**, and that is the other half of the same guarantee.
Rounding to nearest lets twenty scenes add up to 3610 frames, which is 120.33 s.
`floor` is subadditive — the sum of the parts can never exceed the floor of the
whole — and the cost is at most one frame per scene.

| Constant | Value | Why |
|---|---|---|
| `FPS` | 30 | Not configurable. The schema has no fps field, so an option here would be one nobody can reach; 60 fps doubles the Chromium screenshots for a slideshow of stills |
| `TRANSITION_MS` | 500 → 15 frames | Long enough to read as intentional, short enough not to become the thing being watched |
| `MAX_TRANSITION_SHARE` | 3 | A transition may never eat more than a third of the shorter of the two scenes it joins |
| `MAX_TOTAL_DURATION_MS` | 120 000 | 20 × 15 s would permit a five-minute render — minutes of CPU on a worker nobody is watching |
| `JOB_TIMEOUT_MS` | 120 000 | Matches the ceiling: a render that has taken longer than the video is long is not going to finish |

The share cap is reachable, not theoretical. The schema's minimum scene is
1000 ms — 30 frames — and an uncapped 500 ms transition on each side of one
leaves zero frames of it standing alone: a video in which no image is ever
actually shown, produced from a timeline every validator accepted.

The field names follow from all this. `transitionOut` belongs to the scene that
*leaves*, but it is the scene that *arrives* which animates, fading or wiping in
on top of a predecessor that stays opaque. A two-sided fade dips through the
background at its midpoint and blinks.

All of it lives in `worker/video/remotion/composition.js`, in plain JavaScript
with no React and no Remotion import, so `composition.test.js` can run it inside
Mocky's own vitest suite where Remotion is not installed. Frame counts, offsets
and geometry are where the defects are, and they are the only part of a video
that can be checked without producing one. Do not move the maths into the JSX.

---

## Where a finished film lands

In `server/video/store.js`, under `data/video-exports/`. **Never** in the clip
library, and the reason is that library's existing callers rather than a taste
for new files.

A `VideoLibrary` entry is a *scroll sequence*. Its `ingest` runs ffmpeg to cut up
to 150 stills, `list()` promises `{ frames, width, fps }`, `GET /api/videos/library`
hands that straight to the front end, and `VideoPlayer.tsx` scrubs
`/f/1.jpg … /f/<frames>.jpg` out of it. A film has none of that. Filing an export
there would pay for the cutting, then put rows in that list with no frames to
play, a "Recut" button that would run ffmpeg over a two-minute movie to produce
stills nobody will display, and a `usage.js` walk expecting a directory. Every
one of those functions would have grown a conditional for a case it was never
about, which is the definition of making it lie.

What the export store *does* copy from its neighbours, because it earned its
place:

- **content addressing** — the file is named after the SHA-256 of its bytes, so
  two people who render byte-identical timelines share one file;
- **`owners` as a set**, exactly as [M8](architecture/invariants.md) requires:
  the store deduplicates, so the second person to arrive must not erase the
  first, and `server/usage.js` splits the footprint between them;
- **atomic writes** — temp file then rename, in the same directory, so a crash
  halfway through an 80 MB write cannot leave a truncated file under a hash that
  promises its own contents;
- **it refuses before writing.** A full volume fails writes silently almost
  everywhere in this repository, so the honest place to stop is the one place
  that still knows how many bytes are about to be spent. It shares the same
  `diskBudget` as the image and clip libraries.

Two deliberate absences. There is **no poster**: cutting one means ffmpeg, and
ffmpeg is the one dependency this path does not have — an export that needed it
would fail on every instance without it, and a film the browser can play is its
own thumbnail. And **nothing expires**: a job's `videoHash` is a link somebody
may follow days later, and a store that pruned itself would turn that into a
download button leading nowhere. The disk budget bounds the directory instead, by
refusing the next render with a message saying what to delete.

The timeline is **not** copied into the index. It carries overlay text somebody
wrote, and the index is read by the admin usage report; a report needs the shape
of a render, not its contents.

---

## Finding it again

Everything above is about where the bytes go. None of it answered the question a
user actually asks, and the feature shipped without an answer: *where is the
video I just made?*

The store is content-addressed, so a hash says what a file contains and nothing
about who wanted it. The only link back to a finished render was the job — and
`VideoQueue._trim` keeps the newest fifty finished ones, while the browser holds
the id for as long as the tab lives. The download button in the export panel was
therefore the whole of it: close the panel, and a file that was sitting on the
server became unreachable. **An export nobody can find is not an export.**

Three things close it, and they are the same three the image library already
has.

**A film is attached to the project it was cut in.** `projects` on the store's
metadata, a **list** and not a field — for exactly the reason `owners` is a set
(M8): the store deduplicates, so two projects that compose byte-identical
timelines land on one entry and the second must not erase the first. The id
travels `POST /api/video/render` → `VideoQueue.enqueue` → the render callback →
`store.put`, because that callback is the only place that will still know it. It
travels **beside** the timeline and never inside it: the schema is `.strict()`,
and a field the worker does not render has no business in the document.

A render started outside a project is filed under none. `null`, never a guess —
the honesty corollary M8 states about images whose owner is unknown.

**`GET /api/video/exports` lists what this account rendered.** Owned films only,
and the filter lives in `store.list({ owner })` rather than in the route, so it
cannot drift from `ownedBy` next door: `GET /api/video/:hash` refuses a hash the
account did not render — before it checks whether the file exists, deliberately,
so the route cannot be used as an oracle — and a listing naming other people's
exports would hand back exactly what that check withholds. `owners` is stripped
on the way out, like every other listing in this repository.

**Media grows a third tab, "Motion".** Its own tab, not a row in "Videos", and the
reason is the one the store was built on. A `videos` entry is a scroll sequence:
poster, frame count, a "Recut" button, played by scrubbing `/f/1.jpg …
/f/N.jpg`. A film has none of those, and `VideoPlayer.tsx` handed one would ask
the server for frames nobody ever cut — a 404 per position of the scrubber. A
film is an mp4; it plays in a `<video>` element pointed at `/api/video/:hash`,
which now answers **inline** unless `?download=1` is asked for, exactly as
`GET /api/images/:hash` already spells it. Serving it as an attachment and
relying on browsers ignoring `Content-Disposition` on a subresource happens to
work, and nobody promised it would.

Download and delete sit on the card, as they do for an image. Deletion is
explicit and remains the only thing that removes a file (M8); it names the
projects that were still pointing at the film, because a deduplicated store means
taking it out of one project takes it out of all of them.

Finally, the export panel **says where the film went** rather than only offering
a link that disappears with it. Two sentences, because the promise is not the
same: a film cut inside a project is filed under that project, and one cut from
the standalone Media page is filed under none — and saying otherwise would be a
plain untruth about somebody's own library.

---

## Attaching a film to a screen

A film in Media is findable. It is still not *in the work*: a project is a board
of screens, and a montage sitting in a tab beside it is a file, not a piece of
the design. So a screen can carry one.

**There are two relations between a screen and a media, and they must not be
confused.** Everything about this feature follows from keeping them apart.

1. **A media inside the code.** `src/lib/screenImages.ts` finds
   `/api/images/HASH` in `Screen.code` and replaces it by string substitution at
   offsets an AST vouched for. That is generated **source** being rewritten — no
   model call, nothing restyled, and "Revert" undoes it like any other edit. It
   deliberately cannot ADD an image to a screen that has none: that changes the
   component's structure, which is a generation.

   `src/lib/screenSequences.ts` does the same for a **scroll sequence**, and it
   is a separate module because a sequence is not named by a URL. It is named by
   a **pair** — `<ScrollSequence base="…/api/videos/HASH" frames={60}>` — and the
   two halves have to move together, for the reason `Screen.videoFrames` exists:
   the component walks 1…total, so a new address under an old count either stops
   early and holds its last frame for the rest of the scroll, or asks for frames
   that 404 and holds the last one that did not. Neither failure throws, neither
   shows in the code view, and both look like the swap worked. So
   `replaceScreenSequence` rewrites the address and the digits of the count in
   one call, and an element whose count is an expression rather than a literal —
   `frames={total}` — is not reported at all, because re-authoring it would mean
   guessing what that expression evaluates to.

   Matching is on the attribute pair, never on the element name: a model that
   wrapped `ScrollSequence` in a component of its own still wrote a hero the user
   must be able to re-point.

2. **A media attached to the screen.** `Screen.attachedMedia` — like
   `imageHash` and `design` — is **metadata**. Nothing of it is in the code; the
   canvas draws it on the card column beside the frame (`CARD_W`, in world
   units, not drawn below `CARD_MIN_SCALE`).

A film can only ever be the second kind. The generated component contains no
`<video>` tag, and injecting one would be a generation rather than a
substitution — a different operation, with a model call, a repair loop and an
undo behind it.

That is why **"Change the media" has two sections with two headings**, one of
which says it rewrites the screen's code and the other that it does not. In a
single list, "replace" would mean "rewrite the source" on one row and "point the
card elsewhere" on the next, with nothing on screen telling them apart.

**Section 1 lists images and sequences, and no films — and says why.** An
absence explains nothing: a user who wants their montage as the hero and finds
it only under "attach" is owed the reason rather than left to infer it. One
sentence carries it (`library.swapNoFilmInCode`): the generated component has no
video tag, adding one is a regeneration, so ask the composer for it. A sequence
belongs in that list because it already *is* a component the model was taught to
write; a film is not.

**A sequence row is a poster plus a badge, never a bare thumbnail.** A poster is
a still cut from the clip, so on its own it reads as a photograph — and the one
thing the row has to convey is that this slot is three viewport-heights of
pinned scrolling. The row also prints the frame count, because that is half of
what a swap writes back.

**A swap of the hero moves `videoHash`/`videoFrames` with it**, and only when the
record named the clip that was replaced. Those two are written at generation time
to say which sequence Muse paid for; left behind after a swap they describe a
clip the screen no longer shows. A screen carrying two sequences has one
`videoHash`, so moving it to whichever one the user happened to swap would make
the field state something nobody asked it to.

**And "Revert" has to move it back, or the pair splits the other way round.**
Reverting restored the source and left the record where the swap had put it: the
screen drew clip A while `videoHash` named B — the same defect, reached through
the button next to it. `onRevertScreen` therefore drops the pair when the
restored source no longer contains that content address. Dropped rather than
re-derived: what the old source pointed at cannot be known without a parse, and
absent means "not recorded", which is what almost every screen says. Looking for
a 64-hex string Mocky itself wrote is not reading structure out of generated
source (I1) — there is no pattern and no name discovery, and the answer is only
ever used to withdraw a claim.

**The field is on the whitelist.** `normalizeScreen` rebuilds every screen from
a fixed list of fields, so one that is missing from it is dropped in silence at
the next reload — it survives the whole session that added it and is gone the
next morning. `attachedMedia.test.ts` asks that question directly.

**Two kinds, one field.** `{ kind: 'film' | 'sequence', hash, frames? }`. A
scroll sequence can be attached too, and it carries its frame count for the
reason `Screen.videoFrames` exists: a sequence addressed with the wrong count
draws its last frame for the rest of the scroll. A hash plus a flag saying which
store to look in would let a caller read a film's hash out of the sequence
library and get a 404 it cannot explain.

**No poster is cut.** Producing a still from an mp4 means ffmpeg, the one
dependency this path deliberately does not have. The card uses
`<video preload="metadata">` and lets the browser draw the first frame, out of
bytes it would have fetched for a play anyway — so the server does no extra
work and the card shows the film rather than a grey rectangle. A sequence has a
real poster, cut at ingest, so that one is an `<img>` — and it carries the re-cut
stamp whenever the caller knows it, because posters are served `immutable` for a
year while the hash comes from the SOURCE: without the stamp, a re-cut sequence
shows last year's still for a year. The dialog passed it in its picker grid and
not on the thumbnail of the media already attached, three inches above.

**An unknown hash does not break anything** (Q1). The libraries are separate
stores and can lose a file at any time, and only an explicit deletion removes one
(M8) — so a screen keeps pointing at a media that went away, the card still
draws, and the dialog says the media is gone and offers to detach it. Detaching
is the only thing that clears the field.

**And the card says it too**, which took a second pass to get right. "The card
still draws" was true and not enough: what it drew was a black rectangle under
the ordinary caption, which is also exactly what a cut opening on a black frame
draws. A missing file has no other tell — `GET /api/video/:hash` answers `403`
for a deleted export, since it checks ownership before existence on purpose, and
neither a `403` nor a `404` is visible inside a `<video>` tag. So the element's
own `error` event switches the caption to `Media not found` and the tooltip says
it stays attached until you detach it. Nothing is retried and nothing is
detached: only an explicit detach clears the field.

Clicking the card plays the film, the way clicking the image card opens the
lightbox — `FilmLightbox`, shared with the Media tab so there is one `<video>`
for one file. That component grew the same `error` handler at the same time, and
for a sharper reason: the Media tab only ever opens a film the listing has just
named, while the card opens whatever hash the screen carries. Without it, a click
on a dead card answered with a black rectangle, a transport bar and not one word.
A sequence goes to Média instead: it is played by scrubbing numbered stills, which
`VideoPlayer` already does properly, and a second scrubber written for one card is
two players that drift.

---

## Starting from one image

The Motion panel can also make the pictures. Describe a subject, get one model
image, keep or regenerate it, then ask for two to six variants and tick the ones
worth cutting.

**Or take the model image out of the media library**, which the path refused to
allow at first: the only way to a set of variants was to pay a provider for a
picture, even with the exact one you wanted already sitting in the library. It is
the same `ImagePicker` the scene list uses, so "choose an image" is one component
in this panel rather than two that drift apart.

A library picture **skips the first gate**, and that is a decision rather than an
omission. Gate 1 asks "do you want to keep THIS one?" about a picture a provider
has just invented, which nobody has seen, and which arrived `pending` for exactly
that reason. A library image is the opposite on all three counts: it exists, it
is confirmed, and the user picked it out of a grid of its own thumbnails one
click ago. A confirmation with no question inside it is the kind people learn to
click through — and the gate that does matter, the one over the variants, is
downstream of that habit. The panel says so in a sentence, because an unexplained
missing confirmation is what somebody puts back six months later.

The step that follows now shows the source picture in small. It used to sit
directly under a gate displaying it full width, so there was nothing to say; two
of the three ways in no longer pass through that gate, and `Produce 4 variants`
of an unnamed image is a button nobody should have to trust.

The variation axes are a fixed table — angle, framing, light, background,
orientation — and **no model is asked to invent them**. What a multi-step flow
like this is worth is the human confirmation at the end, not the creativity of a
paraphrase: a model call here would cost tokens, add a failure mode to a path
that already has one, and make the series irreproducible. The same image would
answer differently on Tuesday, and "give me the other three" would stop meaning
anything. Seeds are derived from the source id, so asking twice returns the same
pictures instead of paying the provider again.

### The `edit` profile never falls back

Mocky has three image profiles. `inspiration` with no provider of its own falls
back to `content` — harmless, since both make a picture out of a prompt, and the
worst case is a less impressive reference.

**`edit` is optional the other way round.** Empty means image-to-image is off on
this instance, and nothing is substituted. A text-to-image provider handed a
source image either refuses, or — on a provider that quietly drops unknown
fields — renders the prompt alone and hands back a picture the user is told is a
derivative of their own. Nothing downstream can tell that apart from a real edit.
So `resolveImageProfile` answers `null`, which callers must handle, instead of
answering with a provider that cannot do the job.

That asymmetry is why `/api/video/variants` reports `derived` in its response,
and why `/api/video/status` quotes `variantsDerived` *before* the button is
pressed. With an `edit` profile the variants are of the user's picture; without
one they are siblings born of the same text — same subject, another photograph.
An interface that showed the two identically would be lying in the case that
costs nothing to detect, and the answer has to arrive before six provider calls
are spent, not after.

Its provider list is shorter than the others', and the panel says why: only
`fal`, `openai-image`, `cloudflare-workers-ai` and `sd-webui` accept an input
image. The default *models* differ too — inheriting the text-to-image ones would
ship a profile pre-configured to fail, since Cloudflare's flux default cannot
take an input image at all and fal's schnell endpoint has no field for one.

### fal's two field families

fal publishes two families of editing model and they disagree on the field name.
The `image-to-image` endpoints take a single **`image_url`**; the instruction-led
editors — Seedream, nano-banana, Qwen and the flux Kontext family — take
**`image_urls`**, an array, because they are built to reference several pictures
at once.

This matters more than a naming detail, because **fal validates strictly: an
unknown key is a 422, not a warning**. Sending both fields to be safe breaks
whichever model does not know the other one. That is how a correctly configured
`bytedance/seedream/v5/pro/edit` returned six failed calls while the panel
reported only "no variant could be produced".

The family is matched on the model **id**, not declared per provider, because the
id is the only thing Mocky knows: an administrator types it, fal publishes
hundreds, and new ones appear between releases. A model the pattern does not
recognise gets the singular form, and if that is wrong fal says so — which is
why the provider's own error text now reaches the panel instead of being
swallowed.

### A provider that cannot derive raises

`refuseInit()` always throws. This is the rule the whole feature turns on.

The tempting alternative — drop the source image and generate from the prompt
alone — fails in the one way Mocky cannot detect. The provider returns a
perfectly good picture, of the right size, with the right content type, reported
as a success, while the interface says it derived the user's own image. Nothing
downstream can tell the two apart, so the only honest failure is a loud one, and
the message names the setting that would fix it.

The direction of `strength` is part of the same contract: **1 drifts furthest
from the source**. A provider whose own parameter is documented the other way
round must not translate it — an inverted mapping yields an image the API is
perfectly happy with and the user never asked for, with no error anywhere to
point at. It reports `strengthApplied: false` instead, because "I derived your
image but could not set how far" is a true sentence.

---

## The `pending` flag

An image generated inside that flow is marked `pending: true` and is not a
library image yet. It stays out of the Media tab, out of "Download all", out of
the picker — and out of any film. Confirming it removes the mark; leaving it
unticked leaves it pending for good.

### Why `pending` and not `confirmed`

The obvious spelling is `confirmed: boolean`, defaulting to false. It is wrong
here, and the reason is the *upgrade* rather than the code.

The library already holds every image on the instance, and none of them carries
the field. `confirmed !== true` would make the whole of it ineligible the moment
this version boots: video export works today, and it would stop working on
update, for everybody, with no failing test to show for it. The flag would be
doing exactly what it was written to do, to a corpus it was never about.

So the flag marks the **exception** instead of the rule. `pending: true` is set
in one place — the variant flow, on images nobody has laid eyes on yet — and its
*absence* means eligible. Every image predating the field is therefore already
correct, and the migration is not a migration: there is nothing to backfill, and
nothing that can be forgotten.

`confirm()` **deletes** the key rather than setting it false, for the same
reason: a confirmed image and one from before the feature must be
indistinguishable, or "eligible" quietly becomes two different questions. It is
one-way and idempotent — there is no un-confirm, because the flag's meaning is
"nobody has looked at this yet", a fact about the past that a later call cannot
make untrue. A route that could re-arm it would let one account hide an image
another account had already built a film out of.

### Why the guard lives on the server

`refusedForPending()` in `server/video/routes.js` is the enforcement, and that is
the whole point of it. The flow's two confirmation gates are *interface*: they
can be skipped by closing a modal, by a stale tab, by a client that never had
them, or by anybody with a hash and curl. What makes "the user chose these
pictures" true of a film is that the route which turns pictures into a film
refuses the ones they did not choose.

It guards **both** entry points, not only `/render`. `/compose` spends a model
call and hands back a running order; letting it read unconfirmed images would put
a discard into a proposal, name it scene four, and leave `/render` to reject the
timeline the user had just been shown — a refusal arriving one step after the
decision that caused it, about a picture they thought they had thrown away.

The status is **`409`**, not `400` or `404`. The request is well formed and every
file is on disk; what is wrong is the *state* they are in, and it is a state the
caller can change — confirm them, or drop them from the selection. That is
exactly what a conflict means. A `400` would read as "you built the timeline
wrong".

---

## Who may export

Off by default, and by allowlist by default. Both defaults are the most closed
ones available, because the worker is an opt-in Docker service: an instance that
has not built it gains nothing from the feature being on, and one that has is
spending real CPU per render.

**An administrator is not allowed implicitly.** It is tempting — an admin can
grant themselves the right in one click anyway — but that click is the point. The
allowlist is what the per-account usage report counts, and a role that granted
access implicitly would make renders appear against nobody's name. An admin who
wants the feature adds themselves to the list, and the count stays honest. That
is [M8](architecture/invariants.md)'s accounting rule applied to CPU instead of
bytes.

Downstream of that, ownership is checked on the way back out. `GET /api/video/:hash`
checks **ownership before existence**, which is the reverse of the usual shape
and deliberate: answering `404` for an unknown hash and `403` for a stranger's
would turn the route into an oracle for what other people have exported. Checked
in this order it says the same thing either way, and it says something true — a
hash you did not render is not yours.

Two sources agree on that, because each is incomplete alone. The queue's journal
carries the account id but keeps only the newest fifty finished jobs, so
authorising on it alone would take a user's own export away from them on their
fifty-first; the store's `owners` set is not trimmed, but is bounded at twenty
accounts per file. Either is enough to say yes.

---

## The files

| File | What it holds |
|---|---|
| `src/lib/video/timeline.ts` | The zod schema, and the reasoning behind every bound. The definition to read |
| `server/video/timeline.js` | The same schema, mirrored by hand for Node. `timeline.test.js` holds the two together |
| `server/video/compose.js` | The one model call: it orders and tunes, it never picks |
| `server/video/variants.js` | The two variant paths, and the fixed table of axes |
| `server/video/config.js` | Admin settings. The licence key never leaves the server |
| `server/video/queue.js` | In-memory queue, atomic JSON journal, concurrency of one. No Redis, ever |
| `server/video/worker.js` | HTTP client for the render worker, and `assertWorkerTarget` |
| `server/video/store.js` | The finished file, kept whole. **Not** `server/videos/` |
| `server/video/routes.js` | `/api/video`, the pending guard, and the admin router |
| `src/components/VideoExportDialog.tsx` | The Motion panel. Opened from the toolbar, never from a screen |
| `worker/video/` | The Remotion worker: separate sub-project, separate image, separate README |
| `tests/video-worker-separation.test.js` | What actually keeps Remotion out of Mocky's manifest |

The queue is in memory with a JSON journal on disk, and there is no Redis and no
worker table — same posture as the rest of the store. A self-hosted Mocky is one
process; a job queue needing a second daemon to survive a restart would cost more
to operate than the feature is worth. The journal exists for exactly one thing:
so a restart can tell the user what happened to the render they were watching.
Nothing is resumed. Re-queueing would be one line, but a render nobody asked for
twice is CPU spent behind their back, and on an instance that crash-loops it is
spent on every boot.
