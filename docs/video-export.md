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

Six kinds of film, cut from pictures the user already picked.

| Template | What it is |
|---|---|
| `slideshow` | One image per scene, a Ken Burns move, a transition, an optional caption burnt into the frame |
| `overlay` | A screenshot that stays whole, drifting under a band of text above or below it |
| `vertical` | A 9:16 cut for a phone feed: full bleed, short beats |
| `titles` | Animated titling. Text only — **no image at all** |
| `product` | One picture, a headline, up to three arguments and a call to action |
| `composed` | A ground and a stack of typed blocks — the model arranges the frame itself, out of a closed catalogue of twenty-seven |

Two minutes at most, 30 fps, in `16:9`, `9:16` or `1:1` — and each template
narrows the rest to its own numbers, because a slideshow beat can be one second
while a banded screenshot at one second is a flash rather than a reading.

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
returns is one JSON object. It **composes each scene out of a fixed catalogue —
a ground and a stack of typed blocks — and fills in their parameters**, over
images the user has already chosen. It does not pick the pictures, and it never
writes a frame of rendering code. Every composition and every block under
`worker/video/remotion/` is written by hand.

**Naming a block is not choosing a rendering,** and the whole catalogue rests on
that distinction. What comes back is a name out of a closed enum — one of six
templates, one of six grounds, one of twenty-seven blocks — and each of those
names is a component somebody wrote and a reviewer read. The model gets the
variety; it never gets a string that becomes code, a layout it described, or a
file name.

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

### The catalogue is a union, and that is what keeps the rule intact

Variety was the obvious thing to want next, and there are exactly two ways to
get it. One is to let the model describe its own rendering — a bit of layout, a
bit of CSS, a component name — and that is the founding rule going out of the
window one field at a time. The other is a **catalogue**: five templates
discriminated on `template`, each with its own scene kind, its own bounds and
its own `.strict()`, and each rendered by a composition somebody wrote and a
reviewer read. A sixth look is an ordinary pull request. It is never a string
that turns into code.

Three things fall out of it and are worth stating.

**A document with no `template` is a slideshow.** Not politeness: montages
composed before the catalogue existed sit in saved drafts and in the queue's
journal, and every one of them would have started failing validation the day
this shipped — the panel refusing a timeline the user had built and been shown,
with nothing anywhere naming the change that caused it. It is a default, in the
same sense that `kenBurns` defaults to `zoom-in` and `move` to `drift-up`, and it
rescues nothing else: a
`product` missing its headline is a refused product, never re-tried as the
slideshow that would have passed.

**The 120-second ceiling is written once, on the union.** Per-variant ceilings
would be five numbers to keep under the queue's single `JOB_TIMEOUT_MS`, and the
fifth one would be the one that got it wrong.

**A ratio can be unreachable rather than discouraged.** `vertical` types its
`aspectRatio` as the literal `9:16`, so there is no rule about not asking for
16:9 — there is no way to ask. A vertical composition handed a landscape frame
would letterbox and put its captions in the wrong third: a legal document
rendering a film nobody described. Same trick as having no `fps` field at all.

The worker plays its part by refusing what it cannot draw. `RENDERABLE_TEMPLATES`
in `worker/video/validate.js` is that image's own list, and it is allowed to lag
Mocky's — the worker is a separate service behind an opt-in profile, so an
operator really can be running last month's build. A template it has no
composition for is refused **by name**, with a sentence saying to rebuild, rather
than drawn with the nearest composition it does have.

That lag is between two *deployed images*, never between two files in one commit:
a test requires `RENDERABLE_TEMPLATES` to equal the schema's `VIDEO_TEMPLATES`,
because a template Mocky can compose with no composition behind it is an export
that fails after the user was told it was queued.

### The sixth entry is not a sixth look: it is a stack of blocks

Five monolithic templates buy variety by the handful. A brief either fits one of
five layouts or it does not, and the interface made that everybody's problem: the
first control in the panel was a composition selector, so the person who had come
to describe a film was asked to pick a rendering before writing a sentence. The
answer to "how do I get something original" was a radio button with five
positions on it.

`composed` is the sixth entry in the union and the different kind of entry. A
scene is a **background plus a stack of typed blocks**, the model chooses which
blocks, in what order, in which zone and with what parameters, and the variety
becomes combinatorial instead of a choice among five.

**It does not reopen the founding rule, and the distinction is worth stating
because it looks as though it might.** Every `kind` is one name out of a closed
enum of twenty-seven. Every one of those names is a component in
`worker/video/remotion/blocks/` that somebody wrote and a reviewer read. Every
field of every block is a bounded integer, a closed enum or a `line(n)`, checked
by all three readers. What the model gained is *arithmetic* — combinations rather
than cards — not permission to describe its own rendering.

| Family | Blocks |
|---|---|
| Text | `heading`, `kicker`, `quote`, `textHighlight`, `funTitle` |
| Animated text | `typewriter`, `animatedList`, `counter`, `logoType` |
| Interface | `button`, `form`, `notification`, `lowerThird` |
| Data | `barChart`, `lineChart`, `equalizer`, `soundWave`, `map` |
| Media and time | `imageFrame`, `gallery`, `carousel`, `clock`, `dateStamp` |
| Misc | `separator`, `progressBar` |
| Set pieces | `codeBlock`, `solidScene` |
| Grounds | `solid`, `gradient`, `hairlines`, `gridPulse`, `particles`, `image` |

**The five stay, whole and renderable.** Saved drafts and the queue's journal are
full of them, and a template removed is every one of those documents refused at
validation with nothing anywhere naming the change that caused it. The panel's
selector and `draft.ts`'s flat record are keyed on `EDITABLE_TEMPLATES`, the five
a person can fill in by hand; the schema, the worker, the palettes and the
motions are keyed on `VIDEO_TEMPLATES`, which is now six. Two lists rather than
one with a flag, because "can this be rendered" and "can this be typed in" are
not the same question and have not had the same answer since the blocks arrived.

#### Three blocks that cost a dependency, and what the measurements said

The catalogue was asked for three more things — real 3D, "fun" titles and an
animation of code — and all three have an obvious package behind them that this
worker does not carry. `worker/video/` is a separate sub-project behind an opt-in
profile and excluded from Mocky's Docker build context, so adding one there
touches neither the root manifest, nor the root Dockerfile, nor the default
compose file; `tests/video-worker-separation.test.js` is what says so. Adding one
is therefore allowed. Whether it is worth it is a measurement, and each was
measured on the image that actually ships.

| | Installed | Image | Build | Render | Licence | Verdict |
|---|---|---|---|---|---|---|
| `three` + `@react-three/fiber` + `@remotion/three` | +26.6 MiB | 1.57 → 1.60 GB (+32 MB, +2.0%) | 83 s → 87 s | +0.9 s per second of film | MIT, no native binary | **taken** |
| `@remotion/skia` + `@shopify/react-native-skia` + `canvaskit-wasm` | **+461 MiB** | +30% of the whole image | — | — | MIT / BSD-3, **prebuilt `.a` and `.so` for four platforms** | refused |
| `shiki` / `prismjs` | +14.6 MiB / +2.1 MiB | negligible | negligible | — | MIT | refused, and not on cost |

**3D is taken, and the wireframe inside it is not.** WebGL works in this
container on Chromium's default backend — `swangle`, the software rasteriser —
with no change to `render.js` and no `chromiumOptions`. What it costs was
measured at 1080p on the two-core worker: a full-frame lit sphere took 14.9 s for
6 s of film against 9.2 s for a plain title, and 65.6 s against 39.1 s for 30 s,
which is an *additive* 0.9 s of render per second of film and linear across the
range. The duration-scaled deadline allows 6 s of render per second of film and
the measured worst case is 4.3, so 0.9 fits with 0.8 to spare. A wireframe torus
did not: 25.4 s for the same 6 s — 2.7 s/s — and 9.8 MB of output against 0.6 MB,
because a mesh of lines is the high-frequency detail h264 cannot compress and it
spends the whole bitrate allowance `worstCaseBytes` sizes the disk budget
against. So `SOLIDS` has four solids and no wireframe, and the absence is a
measurement rather than a taste.

Everything else about `solidScene` is the founding rule applied one more time. A
document names a solid and a spin out of two closed enums; the geometry, the
camera, the light rig and every colour are written by hand. The block imports
neither `three` nor `@remotion/three` — what it returns is react-three-fiber
intrinsics, which are lower-case strings the reconciler resolves, and the canvas
that gives them a meaning is opened by `ComposedSceneVideo`. That is not
tidiness: `blocks/index.js` is loaded inside Mocky's own vitest suite to prove the
registry matches the schema in both directions, and a single import of a package
that lives only in the worker would take the registry out of the one test that
keeps it honest.

The legibility guarantee had to be extended rather than reused, because this is
the only thing in the catalogue painted at more than one brightness. A Lambert
face is `material × (ambient + directional · n·l)`, so every face of a solid lies
on the segment between `material × ambient` and `material`. Contrast against a
fixed surface is monotone in luminance on each side of it, and luminance is
monotone along a channel-wise ramp — so measuring the two ENDS measures every
face between them. `solidShading` pins one end to the run the palette already
resolved and measures the other: against a dark ground it brightens, against
paper it darkens, and either way the shading only ever moves away from the
surface. When neither end clears, the solid is painted flat and keeps its
perspective (Q1). `composition.test.js` sweeps it across six grounds and a dozen
real directions.

**Skia is refused on a number that is not close.** `@remotion/skia` is 11 KB of
glue; what it needs is `@shopify/react-native-skia`, which installs 443 MiB on
its own — `libskia.xcframework`, `libsvg.a` and friends, prebuilt binaries for
iOS, tvOS, macOS and Android, none of which can execute in a Debian container
rendering in a headless browser. That is a third of this worker's whole image
added for files it cannot run, in a repository whose stated rule is that it has
no native dependencies. Its 2.x peer set also asks for React 19, `react-native`
and `react-native-reanimated`, against a worker on React 18. The equivalent
without it is the `funTitle` block: five treatments — an arc, a bounce, a
stretch, one word swapped into the accent, a shadowed stack — each a per-letter
transform, which is what a browser has always been able to do. It is less than
Skia. It is not nothing, and it costs zero bytes.

**A syntax highlighter is refused, and not on weight.** `prismjs` is 2.1 MiB,
which against 1.57 GB is nothing at all, so the answer is not the one the numbers
suggest. What a highlighter produces is a *theme*: twenty to forty hex values,
one per token type, none of them measured against the surface a film paints them
on. `composedPalette` offers three measured runs on a panel. Those thirty colours
therefore have exactly two places to go — into a block as hex nobody measured,
which is the defect that shipped a dark green headline on a near-black frame and
which `blocks.test.js` refuses outright, or collapsed onto three runs, at which
point the highlighter did nothing a role does not. So `codeBlock` carries a
`role` per line, the model says what each line is, and no language is inferred
from a string. That also keeps a regex engine off model-written text inside a
render under a deadline.

Both of those are in a family of their own, `setPiece`, and the family is not
decoration either: the other six group blocks by what they ARE, and this one
groups by what they COST. It is where the prompt gets to say "at most one in the
whole film", which is the only thing about these two a model has to be warned
about.

#### A zone, and a rank

Two fields ride on every block without exception, and both are the founding rule
applied to layout.

**`anchor` is a zone**, one of nine cells of a 3×3 grid plus `full`. A coordinate
would be a layout the model described: it depends on a frame size the document
cannot see, and it has no answer at all in the two ratios it was not written for.
Two blocks anchored to the same zone **stack** inside it, in the order the
document lists them — which is what lets `anchor` default to `center` without
anything landing on top of anything, and it is `ComposedSceneVideo` that decides
the stacking, never the document.

**`enter` is a rank, not a delay.** A millisecond would mean the model had to know
`cueFrames`, `MIN_CUE_TAIL_FRAMES` and the scene's own length to place an arrival
that lands inside its scene, and it knows none of the three. A rank says "this
comes after that", which is the only part of the timing that is an editorial
decision; the beat is `layerCues`, which is `cueFrames` under another name.
Blocks sharing a rank arrive together, so a heading and its rule are one arrival
for the price of a repeated integer.

An **absent** rank means "the position it was written in", and that default is
the `kenBurns: 'static'` lesson repeated: an optional field is a field a model
omits, so the case you get by saying nothing has to be the good one. Zero would
have made every silent document a pile.

#### A zone is a box, and the box is arithmetic

`composedLayout` turns those zones into pixels, in `composition.js` and not in
the composition, for the reason everything else is there: a `padding: '6%'` on a
CSS grid draws a plausible picture and cannot be asked whether anything crossed
it. Three things fall out of writing it down.

**The margin is per axis, and a portrait frame does not get the landscape one.**
A percentage in a CSS `padding` resolves against the *width* on all four sides,
which put a 65 px margin on the 1920 px edge of a 9:16 frame and a 115 px one on
the 1080 px edge of a 16:9 — the wrong way round in both, from one number that
looked symmetrical. And 6% is a broadcast margin: it is the right answer for a
frame nothing is drawn over, and the wrong one for the ratio that exists to be
posted. A 9:16 composed export keeps the feed's own bands clear —
`VERTICAL_SAFE_TOP_PERCENT`, `_BOTTOM_` and `_SIDE_`, the vertical template's own
numbers rather than a second set that would drift from them — because a
`bottom-center` block inside a 6% margin there is not close to an edge, it is
behind a button. A square pays neither: 1:1 is posted into a grid, and a fifth of
its height given to an interface nobody draws is a fifth of the film.

**A row is divided among the columns that are used.** A fixed 3×3 of equal thirds
is the obvious reading of "nine zones" and it makes the commonest scene there is
unreadable: `anchor` defaults to `center`, so a document that names none puts
everything in one cell — and a third of a 16:9 frame is 563 px, which is five
characters of display type on a line. One column used takes the whole measure,
two take half each, three take thirds, and the alignment still says which edge the
content sits on. The rows are *not* treated that way, and the asymmetry is the
point: a band's anchored edge is already the safe edge, so a stack too tall for
its band grows towards the middle of the frame and never past the edge it was
anchored to.

**`full` is the safe area, not the frame**, and two `full` blocks share it. A
field that bled to the frame's edge would be a map cropped by overscan and a
gallery whose bottom row sits under a caption box — the two failures the margin
exists to prevent, arriving through the one anchor that opts out of it. It is
painted first, under the nine cells, because a map or a wave is what an element
sits *on*.

`tests/video-composed-frame.test.js` is where those become claims rather than
prose: over the poorest document the schema accepts and one that uses all ten
zones, in all three ratios, every block is placed exactly once, every box is
inside the safe frame, every block has arrived by the end of its scene, and the
last frame differs from the first.

#### There is still no audio

`equalizer`, `soundWave` and every rhythm on a composed scene are **visual
motifs**. There is no audio track in this feature, no `@remotion/media-utils`, no
sound file and nothing being listened to — and that absence is enforced rather
than pending, because every object in the schema is `.strict()` and a document
carrying an `audio` key is refused whole. An equalizer whose bars follow a
deterministic curve is an equalizer; it would only be a lie if something claimed
it was hearing anything, and nothing does.

The same rule makes the clock and the date stamp state their own values.
`clock.time` is `HH:MM` from the document and `dateStamp.text` is a line the model
wrote — never the render host's own clock, which would burn a fact about the
*machine* into somebody's film and make two renders of one timeline differ, which
the content-addressed export store cannot have.

#### The legibility guarantee extends to the blocks, through one door

A block **never picks a colour**. It reads a run off `composedPalette` and paints
with it, and that is the whole contract: twenty-seven components cannot each be
trusted to measure, and twenty-seven components each measuring would be
twenty-three copies of the same search.

Three surfaces, because a block paints on exactly three things — the ground
(`display`, `body`, `accent`), a panel (`panelDisplay`, `panelBody`,
`panelAccent`), and the accent as a fill (`onFill`). A panel is opaque
`theme.surface` and therefore its own surface whatever the ground is; the fill is
where the product card's call to action proved the point, being the only legible
element in the export that started the whole legibility section.

**The ground is a range, and two of the six make it one.** `surfaceRange` already
had the vocabulary: a veil measured at the two extremes an unknown picture can
composite it to, and a tint measured beside its base. So every ground is a case
of `{ color, alpha, tint }` — an opaque colour, a colour plus the house texture,
a colour at a veil over a photograph, or a **ramp**.

The ramp is the one that needed new arithmetic. Two ends clearing 4.5:1 does prove
an ink is outside the band between them, since two ends 4.5 apart in each
direction would need a relative luminance past 1. At the **display floor of 3 it
proves nothing**: a ramp from black to a pale grey clears 3:1 at both ends against
an ink whose own luminance sits between them, and somewhere along that ramp the
contrast is 1:1. Every headline in this directory takes 3. So a gradient is
sampled along its length (`GRADIENT_RAMP`), and an ink hiding between two adjacent
samples is within a fraction of one of them — and a fraction is not three.

An animated ground is measured at its **maximum** density and animates only
downwards. `gridPulse` and `particles` fade to `PULSE_FLOOR` and never above what
was measured, which is the same asymmetry `vertical` relies on when it keeps a
directional gradient on top of a uniform dim: a layer that can only add legibility
cannot invalidate a guarantee made without it.

And the whole tint **yields**, exactly as `texturedGround` already made it yield
for the two flat templates: a ground whose texture — or whose gradient — is what
makes a line illegible is painted flat instead, and only ever when the bare ground
carries every run. A decoration cedes to a word, and it never cedes for nothing.

**And a `full` block is a second ground.** That sentence was missing and an export
found it: `equalizer` said of itself that it "carries no text, so the only thing it
can get wrong is spending contrast something else needed — which it cannot", which
is true of a block in a cell and false of one anchored `full`, because that one is
painted UNDER the nine cells on purpose. The film had eighteen accent bars across
the middle of the frame and a heading standing on them whose last word is in the
accent by design; the two met at 1:1, and every run in that palette had been
measured against a ground nothing was standing on.

So a scene that stacks something on a `full` block resolves a different palette
(`stackedField`), and the field enters the measurement the way every other
decorative layer does — as a tint, sampled along its own density for
`GRADIENT_RAMP`'s reason, since a field is not one colour. What it cedes is
DENSITY: `FIELD_ALPHAS` starts at 1, so a scene whose headline already clears over
a field at full strength pays nothing, and the first rung that clears wins. The
texture is given up only after the field has run out of rungs — both are
decorations, and one of them is in the document.

Two things fall out and both are load-bearing. The **accent run is measured on the
bare ground**, not on the fielded surface: measured against a field made of
itself it cannot clear, falls through `accentFirst` to a near-white, and the first
version of this fix came back with grey bars behind a grey headline — legible, and
the project's colour gone, which is the failure `theme.ts` refuses when it declines
to guess a token. The gap that leaves is named rather than hidden: accent TEXT over
a field of the same accent is not measured against it. And the density is an
opacity on the **zone**, not a colour handed to five components: `full` is the only
thing that makes a block a field, so the rule lives where `full` means something
and the twenty-eighth block cannot forget it. `palette.groundTint` is what the
composition paints and `palette.ground.tint` is what was measured — they differ by
exactly the field, and reading the second in `Ground` would paint it twice and take
a gradient's far end off the accent.

#### And so does the guarantee that nothing holds still

`tests/video-motion.test.js` asks its question of the composed variant too, on the
poorest document the schema accepts: one block, no anchor, no rank, and no
background at all. That last omission is the point — silence means `hairlines`,
which is the one ground of the six that **holds still**, so the scene has to move
through its stack and its drift alone. A version of this feature that leant on an
animated ground would pass every other case and fail exactly there.

What moves is the stack and not the ground, for the reason `TITLE_BLOCK_DRIFT`
already gives: the ground is the surface every run was measured against, and a
ground moving under fixed type would be text crossing a surface nobody measured.

The reported terms are `drift` and one `layers` progress per block, always — plus
`picture` only when the ground is a photograph and `ground` only when the ground
animates. A term is reported when the composition draws it and never otherwise,
which is the rule the kicker taught: a number that moves on a frame that does not
is exactly what a "did anything move" test would have accepted.

**There is deliberately no automatic kicker.** The other five draw the film's own
counter because their layout has a place for it. A composed scene's layout is the
document's, and a surtitle painted over a stack somebody arranged is an element
nobody asked for — a film that wants one writes a `kicker` block.

#### One file per block, and a registry nobody else edits

`worker/video/remotion/blocks/` holds one `.jsx` per kind, named after the kind,
plus `index.js` mapping kind to component. Two rules keep that arrangement
working, and `blocks.test.js` enforces both:

- **Nothing in the directory imports `remotion`.** A block is plain React — the
  frame arrives as `progress` and `life`, computed by `sceneMotion` — so there is
  no need for `useCurrentFrame` and no excuse for it. That is what lets the
  registry be loaded inside Mocky's own vitest suite, where Remotion is not
  installed and never will be, and therefore what lets a test prove the registry
  is complete in both directions.
- **No colour and no easing curve is written in a block.** A hex value in a
  component is a colour nobody measured, which is the defect that shipped a dark
  green headline on a near-black frame; a curve is a twenty-fifth notion of how
  things move. The test strips comments before looking, so the sentence explaining
  why the code is right does not fail the check that keeps it right.

`index.js` is deliberately a map and nothing else. Twenty-seven people can each own
one file in there without touching the same line, which is only true while it
holds no logic — anything genuinely shared belongs in `composition.js`, where a
test can reach it without React.

### The prompt is a manual for the blocks, not a menu of layouts

`compose.js` used to be five catalogue cards followed by a table mapping an
intention to a name — words alone to `titles`, a phone to `vertical`, and so on
down to `slideshow`. There is no name to arrive at any more. **The ordinary call
offers `composed` and nothing else**, and the system turn is the manual for a
catalogue: six grounds, twenty-seven blocks in six families, and the two fields
every block carries. The five hand-filled compositions are still reachable, but
only by NAME — a caller with a form for one gets that one card and no blocks —
because a card plus twenty-seven blocks is a prompt holding two contradictory
jobs.

Each block gets three sentences and a shape: what it is, when it is the right
one, and **how it fails**. The third is the one that earns its place. A model
shown twenty-seven blocks uses twenty-seven of them, and a catalogue is the only
thing that can argue against its own entries — so `counter` says a figure nobody
gave you is a claim in somebody's film, `separator` says the layout already
spaces things, and `equalizer` says nothing is being listened to.

Around them, two sections do the work no card can. **THE STACK** states the
discipline: a scene carries one idea, two or three blocks is the ordinary scene,
a scene of one is often the best one in the film, and variety belongs to the film
rather than to the frame. **STACKS THAT WORK** states the ambition, because a
model told only what to avoid writes one heading per scene and stops: a gradient
under a kicker and a heading that share a rank, a grid pulsing behind a counter,
a lower third and a progress bar over a photograph. Five of them, each one scene,
each two or three blocks.

**No number and no vocabulary is typed into that prose.** Every bound, every enum
and every default on a card is derived from the zod object the answer will be
validated against: `signature()` walks the schema and prints `≤70`,
`display|title|subtitle = title`, `[2–6 × …]`, and the legend at the top of the
prompt explains that notation once. It is the rule from CLAUDE.md applied where
it has already drawn blood — a floor restated by hand drifts from the validator,
and the drift is the expensive kind, since the call is spent by the time the
refusal quotes a number the model was never told. With twenty-seven blocks the
surface is twenty-seven times larger, so the check runs both ways: the suite
asserts the printed bounds are `BLOCK_LIMITS`'s own **and** that no line of prose
in the catalogue contains a digit.

The same walk builds the decoder hint, which is why the two cannot disagree. A
node type the walker has never met prints `(unrecognised)` rather than throwing —
Q1: a proposal must not fail over a description — and the suite fails on that
marker, which is how a field added with a new zod type is found before a user
finds it. Two things are restated in the hint that the five-card version leaves
out, and both are measured rather than stylistic: **array bounds**, because
llama.cpp compiles `minItems` into its grammar and a `gallery` hinted as
accepting one id produces exactly the document `min(2)` refuses; and **`anchor`,
`background` and `transitionOut` are marked required** although the schema
defaults all three, for the reason `move` is required on an overlay scene — the
default is a legal answer, and a grammar that lets the field be skipped puts
every block of every film in the middle of the frame on the same ground with the
same transition, which is the variety this variant exists to produce, thrown away
by a hint. `enter` is deliberately not required: its absence means "the order I
wrote them in", which is the good default.

**The selection narrows the catalogue rather than adding a rule about it.** Three
blocks and one ground put a picture on the screen, and how many they need is read
off the schema — `gallery` wants two because its array says `min(2)`. So an empty
selection is offered twenty-one blocks and five grounds, one picture adds
`imageFrame` and the `image` ground, and two open the catalogue. That is a hint
and never the gate: a provider that ignores structured output answers with a
gallery of ids it made up, and the refusal **names what is still possible** —
`imageFrame, gallery, carousel` and the `image` ground are the only parts that
need a picture, and the other twenty-one draw type, numbers and motifs. A bare
"no" would send somebody back to reword a brief that was never the problem, and
so would "an image was not in your selection" when the selection is empty.

The corollary is that `POST /api/video/compose` accepts an empty selection. It
used to answer `400`, which was right until a brief of words became the most
ordinary request there is.

**A document that names no template, on this path, is composed.** `template` is a
constant here — the prompt states it, the hint pins it to a one-value enum — and
a constant field is the field a model omits. Left alone, the schema's own
compatibility default reads a stack of blocks as a slideshow and refuses it with
half a dozen issues about keys nobody wrote. It is a default and not the repair
this feature forbids: it adds nothing the document did not already say, it is
applied before validation rather than to paper over a failure, and a document
that does name a template keeps it.

**An answer that filled in one of the five instead is accepted, with a notice.**
The asymmetry with the refusal above is who loses what: there the user had set a
form and loading another composition would move it under them; here they asked
for a film and got one — validated, renderable, plainer. Refusing would hand back
nothing over an answer that works (Q1). Saying nothing would be worse, because
the whole point of composing is that the film is not one of five cards.

**An image left over is a notice, and the notice says which of two things
happened.** A film that shows none of them — a composed film of type and motifs,
or a `titles` card by construction — is not an oversight that asking again can
correct, and a notice that reads like one sends somebody to try. A per-template
cap is the other case: a `product` film holds six scenes, so ten selected images
leave four over however good the proposal is.

### The panel chooses too, and its default is not to

The composition selector is the first control in the Motion panel, and it opens
on **`Automatic`** — the model reads the brief and picks. That default is the
argument for the catalogue restated as an interface decision: a form defaulting
to `slideshow` makes the other four an option people find by accident, and the
one thing the catalogue exists for is that the film matches what was asked for.

Automatic is a real state, not a stand-in for slideshow. There is no timeline
until a composition is decided, so `toTimelineInput` answers `null` and the
render button names `no-template` as the reason it will not fire. Assembling the
slideshow that would have passed is the repair this feature refuses everywhere
else, reached through the one door nobody was watching: it hands back a film in a
composition the user never chose.

**A composition chosen by hand narrows the catalogue the model reads to one
entry.** The form the answer lands in has that composition's fields, so a
proposal in another one — or a stack of blocks it has no rows for — is a call
spent on a document the panel would refuse. The name travels as a `template`
field on `POST /api/video/compose` and is matched against `EDITABLE_TEMPLATES`;
anything else is ignored and read as "compose", including `composed` itself,
which is what asking for a film rather than for a layout already gets you. The
prompt then drops the block catalogue entirely and prints that composition's card
alone: a manual for twenty-seven blocks three lines under "the composition is
already chosen" is two contradictory instructions, and a model answers with
whichever it read last.

An answer naming something else anyway is **refused**, never loaded. A hint is
not the gate here either, and loading it would move the selector under somebody
who had just set it — and every field on the form with it.

**The form is what made the other four expressible.** Until it had them the
editor was a slideshow and nothing else: a brief about a phone came back
`vertical`, was refused by the panel with a sentence, and the model call was
spent for nothing. Each row now draws the chosen composition's own fields and
none of the others — a caption box on a product card would be a line somebody
writes and never sees, since `ProductSceneSchema` has no `textOverlay` and the
document would be refused for carrying one.

The draft behind that form is **one flat record holding every composition's
fields**, which looks like the sloppier choice and is the deliberate one. A union
would force a lossy conversion at every switch of the selector, and switching is
exactly what happens: somebody picks `product` to see what it looks like and goes
back to find the four pictures they had chosen gone. `toTimelineInput` switches
on the template and emits only what that composition reads, so nothing left over
reaches a schema that would refuse the whole document for it.

Three smaller rules fall out, and the first two are about not being helpful:

- **A scene count over the new composition's cap drops nothing.** Ten pictures
  switched to a six-scene product card keeps ten rows and reports
  `too-many-scenes`; the user removes four. Discarding somebody's images to
  honour a click on a radio button is the helpfulness this feature refuses.
- **Durations are pulled into the new window.** That one IS a correction, and it
  is legal for the reason `clampDuration` always was: it runs on the way in, on a
  slider that cannot express 15 s under `vertical` at all. Leaving the value
  would put the draft in a state the form cannot show and the user cannot leave.
- **A row that kept everything but its picture is named**, `image-missing`. That
  is the price of the first rule, and it went out unpaid: `titles` is the one
  scene kind with no `imageId`, so its rows carry `''`, and switching to a
  composition that puts a picture on the screen keeps them. The form then looked
  finished — no thumbnail is drawn because there is none to draw, no box is
  empty — and the button fired a document the schema refuses for an empty
  `imageId`, with the 400 arriving after the click. It is the one missing thing
  no box on that row can supply, so the sentence says to remove the row and add
  it back from the picker. The compose button counts pictures rather than rows
  for the same reason, and because that is the list the request actually carries.

### Five compositions, and one scene kind each

`worker/video/remotion/` holds one component per template —
`ImageSequenceVideo`, `OverlayBandVideo`, `VerticalStoryVideo`,
`AnimatedTitlesVideo`, `ProductSpotlightVideo` — and `COMPOSITIONS` maps a
template name to the one that draws it. `render.js` selects by that id and never
falls back, so a `product` is never drawn by the slideshow: the film would come
back without its arguments and its call to action, reported as a success.

The refusal runs both ways, and the validator is where it is written. Each
template has its **own scene reader** rather than one permissive reader plus a
key list, because a `band` accepted on a slideshow scene is a field the
composition does not read — a film missing the thing that was asked for,
delivered as an export. `slideshow` and `vertical` are the one pair whose scene
kinds are genuinely identical; what separates them is their bounds (8 s against
15 s) and the ratio literal, and the test says so rather than pretending
otherwise.

**The arithmetic is shared, not copied.** Five compositions have one notion of a
frame plan, one entrance, one easing, one Ken Burns transform and one type scale,
and all of them live in `composition.js` where a test can reach them without
Remotion. Two of those are newer than the catalogue and both exist because of a
specific failure:

- `frameBase` derives every type size from the **short** edge, which is 1080 in
  all three ratios. Deriving from `height` made a title tuned on a 16:9 frame
  come out at 1920/1080 times the size in `9:16`.
- `cueFrames` schedules the elements of a cascade and compresses the whole thing
  when the scene is too short for it. A product scene may be 3000 ms and carry a
  headline, three arguments and a call to action; five cues at a comfortable pace
  put the last one past the end of the scene. Text arriving after its own scene
  has finished is a film missing the line it was cut to deliver.

`VERTICAL_SAFE_TOP_PERCENT` and `VERTICAL_SAFE_BOTTOM_PERCENT` are the other
constant worth naming here. A 9:16 export exists to be posted, and a feed
application draws its own interface **over** the video: the caption and the sound
row along the bottom, the action rail up the right, the tabs across the top. Text
placed there is not close to an edge, it is behind a button — so the composition
keeps the caption inside 12% from the top and 20% from the bottom. Those are not
the slideshow's 6% padding under another name; that one is about broadcast
overscan, and the two would drift for different reasons.

### What each composition draws, and why it is more than a layout

The catalogue's first version was five layouts that each worked: a headline that
faded in and a bar under it, a full-width band, a caption over a picture, a
column of dotted lines. Nothing in any of them was wrong and nothing in any of
them was designed — one arrival, one ornament, one flat fill, and a viewer with
three seconds and nothing to look at.

What was missing was not effects. It was the devices Mocky's own interface
already uses, and they are shared for the reason everything else in
`composition.js` is: five compositions with five notions of "an element arrives"
is four of them drifting.

- **`easeOutCubic`, on every arrival.** Everything Mocky animates in a browser
  eases — `Animate.ts` gives each preset `ease: 'easeOut'` and `CountUp` walks an
  easeOutCubic — and everything the worker rendered was linear, because
  `progressAt` was written for a Ken Burns drift and then reused for entrances. A
  linear fade enters and stops at the speed it travelled, which nothing physical
  does; it is the single thing that most makes motion read as generated.
- **`cueFrames(…, { tailGap })`.** One extra beat before the last element of a
  cascade, scaled with the rest rather than added to it, so a scene too short for
  the pause loses the pause and never the element.
- **`EMPHASIS_ENTER_FRAMES`.** One element per scene may arrive more slowly than
  its neighbours — the stress mark of a cascade, and free, since the cue does not
  move. It is capped at `MIN_CUE_TAIL_FRAMES`, which is what guarantees a slow
  entrance still finishes before the cut.
- **`sceneLabel` and `ordinalLabel`.** A kicker is the most profitable device in
  the design system and it needs something to say. **No schema field was added
  for it**, deliberately: a surtitle a model writes about a film it cannot see is
  the guessed token `theme.ts` refuses, and it would be a sixth string to bound,
  translate and validate. A counter is the timeline restating itself — right by
  construction, and empty for a one-scene film, because `01 / 01` is a counter
  admitting it had nothing to count.
- **`hairlineTexture`.** 1 px rules are the house's own vocabulary, and a flat
  fill behind a headline is the one place a film has nothing at all in it. It is
  measured rather than painted over the measurement — see the legibility section.

On top of those, each template gained what its own format was missing.

| | What it was | What it does now |
|---|---|---|
| `titles` | A centred headline, a fade, a short bar | A left margin everything aligns to, a kicker, each word revealed from behind its own mask on `stagger`, the **last word in the accent** and arriving more slowly, a double rule that runs the measure, and a ground of hairlines |
| `overlay` | A full-width band across the frame | A block that **stops where its text stops** (`bandInset`), an accent rule down its leading edge, a wipe in from that same edge, a kicker, and a title revealed from behind the block rather than faded onto it |
| `vertical` | The slideshow in a portrait frame | A push-in on every cut (`punchTransform`), a type size that **ramps with the caption's length** (`verticalCaptionSize`) instead of being tuned for the longest legal one, a caption that arrives word by word, and a story rail |
| `product` | Three lines behind three dots | Numerals that count the arguments, each sliding in from the margin and closing with a rule, an accent rule in the gutter, a picture that drifts, and a call to action that arrives **after a beat**, growing where everything above it rose |

Two of those are worth their own sentence.

**The `vertical` rail is the only thing in the catalogue outside a `Sequence`.**
It has to be: a rail that restarted at every cut would be six rails, which is the
opposite of what it is for. Six full-bleed pictures with nothing constant between
them are six pictures, and the eye finds its place again at every one — which is
why a feed application draws exactly this bar. `railSegments` fills a segment
between its own start and the **next scene's** start rather than over its own
duration, because transitions overlap: measured on durations, two segments would
be in motion during every crossfade and the rail would contradict the picture.

**The `overlay` band gives the capture back.** A band that runs the full width
and touches three sides is a lower third from a news bulletin: it covers the
screenshot edge to edge whatever the sentence on it is, and a four-word title
then sits in the middle of a bar with two thirds of it empty. Nothing about the
legibility promise changes — same colour, same density, measured over both
extremes of what the capture can composite it to — the block simply covers less.

### Nothing holds still, and silence never asks for a freeze

A user watched an export and said, of a film of still screenshots with titles laid
on them, that it was not a film. He was right, and four separate decisions had
each been defensible on the way there.

`kenBurns` defaulted to `static`. An optional field is a field a model omits, so
that default was not an edge case — it was what every generated slideshow
actually rendered. The compose prompt then described `static` as "the calm
choice, and the right one when the image carries text", and further down said
that calm means "long scenes, static shots or slow zooms": a brief asking for
something restrained was answered with immobility twice over. The `overlay`
template had no movement field at all, and its catalogue card said "there is no
camera move here at all". And the slideshow's caption was simply present from the
first frame of the scene to the last — a title, on a picture, for fifteen seconds.

Each of those is now the other way round.

**The default is a move, and `static` is something a document asks for.**
`DEFAULT_KEN_BURNS` is `zoom-in` on both templates that carry the field. `static`
stays in the enum: a capture of an interface has real reasons to be held, and
removing an enum value would refuse every saved draft and every entry in the
queue's journal that names it. What changed is which case you get by saying
nothing. `zoom-in` and not a pan, because the library mixes portrait and
landscape freely — `cover` has already cropped a portrait still inside a landscape
frame, so a pan there slides the crop instead of revealing anything, while a zoom
is the same move on every ratio and every subject.

**The `overlay` moves, and the rule it was protecting was about amplitude.** A
pan is refused because it spends 4% of travel on a 12% overscale: an eighth of
the interface cropped before the first frame, a twentieth of it sliding past. The
new `move` field spends 1.2% on 3% — the picture is a fortieth larger than the
frame, the travel stays inside the margin that leaves, and every pixel visible at
rest is visible on every frame. Three values, `drift-up`, `drift-down` and
`settle`, and no `still` among them: `static` exists elsewhere because a pan and a
zoom really can destroy a capture and a document must be able to refuse them, and
a drift destroys nothing.

**The motion of all five compositions lives in `composition.js`.** `sceneMotion`
returns every quantity that changes between two frames of a scene, and the five
`.jsx` files read it rather than working out their own arrivals. That is what
makes "does this scene move at all" a question a test can answer — the same reason
the frame plan and the palettes are there — and `tests/video-motion.test.js` asks
it: for each template, over a document where the model filled in nothing optional,
the last frame of every scene differs from the first, and not by a single jump.
A term is reported only when the composition draws it, because a `caption`
progress on a scene with no caption is a number that changes while the frame does
not, and the test would have accepted it. That is not only about what the scene
carries: the kicker exists when the FILM has more than one scene, so its text is
computed once in `planTimeline` and travels on the plan entry. Computed twice —
once by the motion, once by the composition — the two disagreed, and every
one-scene film reported a kicker arriving that no frame contained.

### The typeface a container actually has

The Dockerfile installs `fonts-liberation`, and that is the whole font situation:
nothing in Mocky loads a webfont and this image has no egress to fetch one. A
container with no matching family renders every glyph as a hollow box, burnt into
an mp4 nobody previewed.

So a declared family is named **first** and Liberation Sans follows it, in one
`font-family` stack built by `fontStack`. CSS's own fallback then does the work,
per glyph: an instance whose image really carries the face gets it, everyone else
gets Liberation Sans, and nobody gets a failed export over a decoration (Q1). The
quotes around the family name are safe only because the schema's charset has no
quote, comma, semicolon or brace in it — which `composition.js` re-checks, since
it is the file that would be wrong if the validator were ever loosened.

Two derived values follow the same "prevent one specific unreadable frame" shape.
`withAlpha` turns a declared hex into the veil that keeps a caption legible over a
photograph nobody previewed. `readableInk` picks black or white for a call to
action out of the accent's own relative luminance — a label coloured for a deep
navy is invisible on a pale mint, and no direction states a token for it.

### The look comes from the project, and the model never sees it

A film carries a `theme`: four colours, two font families and a corner radius.
It is what makes an export resemble the product it was cut from instead of a
stock template, and it costs no tokens, because **the model does not write it**.

`VideoTimelineSchema` — the schema a composed document is validated against —
has no `theme` at all. Every object in it is `.strict()`, so a model that
invents one is refused exactly like a model that invents an audio track, with
the same message and no repair path. The server attaches the theme afterwards,
through `attachTheme`, to `RenderTimelineSchema`: the same catalogue with the
one extra key. Two schemas rather than one optional field, because the
difference between them is *who is allowed to write which key*, and a single
schema with an optional theme would accept the model that wrote its own.

**Only what the direction declared.** `parseDesignSystem` always answers with
seven filled roles and a radius, because a style sheet has to render something;
most of those are inventions when the document is quiet. `parseDesignSpec`
records which ones were actually stated, and `src/lib/video/theme.ts` emits
those and no others. A guessed accent burnt into a film is a lie nobody can see
through — the video is simply the wrong colour, with nothing saying so — while
an absent one leaves the composition on a default somebody chose on purpose.
The 12px `parseRadius` falls back to is the same case, which is why `readRadius`
now exists to say "the document did not mention one".

**Nothing in it can become CSS.** Colours are hex and only hex. A font is ONE
family name from a charset of letters, digits, spaces and hyphens — never a
stack — because that value ends up in a `font-family`, where a comma, a quote,
a semicolon or a brace is the difference between naming a typeface and writing a
declaration; the composition appends its own fallbacks, which it has to do
anyway since nothing here loads a webfont. The radius is an integer number of
pixels, so there is no unit to parse and no `calc()` to smuggle.

**The derivation runs in the browser and the attachment on the server,** and
that split is structural rather than stylistic: the server keeps a project as an
opaque blob and could not import a `.ts` module at the Node 22.12 floor even if
it held one — the same constraint that makes `server/video/timeline.js` a
hand-kept mirror. A browser therefore hands the server a theme, which is fine
and deliberate: the schema is bounded tightly enough that the worst a modified
client can do is render its own film in its own colours.

**A direction that will not parse costs the colours, never the export.** The
user has already waited in a queue; `POST /render` answers 202 with a notice
naming what was dropped ([Q1](architecture/invariants.md)). All or nothing,
though — removing just the field that failed would be the repair this feature
refuses everywhere else, and it would render a film in the project's colours
with somebody else's typeface.

**And the panel says so.** The tokens are printed under the composition cards —
the swatches and the family names — because the alternative reading is the wrong
one: a panel silent about colour invites the assumption that a colour control
waits further down, and there is none, and there cannot be. Printed rather than
summarised, too. "Your colours are applied" is unfalsifiable from the outside,
and the failure this note exists to make visible is a direction that states less
than its author thinks: a project whose accent was inferred shows no accent here,
which is the difference between a film in the project's colours and a film in a
guess. Three states and not two — a direction that states nothing this schema can
carry is neither "your project's colours" nor "no direction at all", and it gets
its own sentence.

**Both doors attach it, and neither shows it to a model.** `/compose` runs
`attachTheme` on the document the model's answer became, once the schema has
accepted that answer — so a proposal comes back looking like the project it was
composed in, and the panel does not have to wait for a render to find out. The
order is what makes it safe: the model is validated against a schema with no
`theme` key, and only then is the key written. Nothing of the direction reaches
the prompt either. A colour quoted to a model is a colour it will improve on,
it costs tokens on every call, and it is not the model's decision to make.

### No text is illegible, and it is arithmetic that says so

Two real exports settled this. A `titles` film put "Gemini 3" in dark green on a
near-black frame and its subtitle in dark grey on the same; a `product` film did
the same to "Porsche 911" and to its three arguments. In both, the call to action
was the only legible thing on screen — because the pill was the only element in
the catalogue that already chose its ink by measuring.

The cause was not a colour. It was a **pairing**: `theme.ts` emits only the
tokens a direction actually stated, `composition.js` filled the rest from a
fallback, and a direction written for a page states an ink and leaves the ground
unsaid. The two colours met for the first time inside an mp4, having never
coexisted in the design they both came from.

**The ground follows the ink, and then everything is measured anyway.** Both
halves are needed and the order is the point:

- `resolveTheme` resolves background, ink and surface as a **pair**. A stated
  dark ink gets paper, a stated pale one keeps the dark ground, a stated ground
  gets an ink measured against it, and a direction that stated both is never
  overruled. This is the half that respects the design: a direction with a dark
  green wanted that green on paper, and re-colouring its text to white would have
  produced a legible film that is not the project's film — the same lie
  `theme.ts` refuses when it declines to guess a token.
- Every run of text is then held against the surface it is **really** painted on,
  by `legibleOn`, and corrected if it does not clear its floor. Derivation makes
  the common case right; measurement makes every case safe, including the two
  the pairing cannot reach — a direction that stated both colours badly, and the
  surfaces (`surface`, `accent`, the veils over photographs) that no pairing rule
  touches.

**The floors are the audit's own**, 4.5:1 and 3:1, so a film cannot ship a
contrast the accessibility panel would report as a finding on the screen it was
cut from. Which of the two applies is decided by the composition's type role and
never by a pixel count: display type and bold labels take 3 — `rules.ts` would
say the same, its threshold being 24 px or 18 px when bold — and running text
takes 4.5 even though that rule would call it large too. Every glyph in a 1080p
frame is past 24 px, and the lenient floor handed to everything is a subtitle
nobody can read on a frame watched from a sofa.

**What gives, and in what order.** When the declared ink does not clear its
floor, `legibleOn` walks an ordered list of attempts and takes the first that
does: the veil gets denser first (the least visible repair there is, and it keeps
the project's colour), then the ink stops being quietened, then the theme's other
colours are tried in turn, and only then black or white. A direction with two
greens renders a legible green; a generic white would clear every threshold and
erase the art direction, which is the failure the order exists to prevent. When
nothing clears the bar — a mid-tone palette on a mid-tone surface genuinely can
have no answer — the most legible pair found is used and the export still ships
([Q1](architecture/invariants.md)).

The list ends at pure black (`INK_FLOOR`) rather than at the near-black the
compositions prefer, and that last entry is arithmetic rather than taste. Black
and white cross at 4.58:1, so an opaque surface always has an ink that clears
4.5 — while `INK_DARK`, a chosen `#101014`, carries a fifth of a point less and
moves that crossing to 4.36:1. A sweep of forty thousand random directions put
4164 runs in the band between the two: two thirds of every failure the search
reported, each missing its floor by a tenth, with the answer one candidate
further on. `#101014` is still tried first, so nothing about the look changed.

**A photograph is not in the theme,** so text over one is measured against the
veil at BOTH ends of what the picture can composite it to: over a backdrop that
is all black and one that is all white. The cost is a veil denser than a dark
photograph needs, and it is the price of a guarantee made without opening the
picture. It is also why `vertical` no longer relies on a gradient anchored to one
edge: what sits under a glyph in a ramp depends on where the line broke, and a
caption positioned `center` landed on the raw photograph with the scrim already
faded to nothing. A uniform dim has one value everywhere and can therefore be
computed; the directional ramp stays on top of it as framing, where it only ever
adds density.

**A decoration is measured too, and it pays for itself.** A kicker, a numeral
beside an argument, the rule under a headline: these exist to carry the project's
colour, so they enter the same search at a different point — `accentFirst` puts
the accent in front of the ordinary candidate list, which is otherwise unchanged,
so an accent nobody can read still falls through to something legible. They are
also resolved with the veil **locked** (`lockVeil`), and that is the whole
difference between an ornament and a caption: raising a band to 0.94 so that an
indigo kicker can stay indigo hides the capture the banded template exists to
show. Locked, the search changes the ink instead of the picture. It cannot fail
where the text succeeded, because `accentFirst` is a superset of `inkCandidates`
and every shared surface already carries a run at the display floor resolved from
that list — `composition.test.js` measures both, which is what keeps the sentence
true. The story rail is the one exception and the code says why: its track
carries no other run, so there is no density somebody else already proved, and it
is allowed to thicken because it costs a bar three pixels tall.

**A texture is part of the surface, not a layer over it.** The two flat-ground
templates are drawn on a field of 1 px rules, and a background is the one
decorative thing that can undo this entire section without touching a line of it:
a glyph on a hairline field sits on one of two colours, and a palette that
measured only one of them would go green on a texture dense enough to eat a
headline's margin. Both colours are **known** here, unlike a photograph, so
`surfaceRange` takes a `tint` and measures both — and the composition paints the
texture by reading that same object back off the palette, so a density somebody
nudges in a component cannot leave the measurement behind.

Measuring it was half the answer. Every other layer here can move — a veil rises,
a quiet ink goes back to full strength, an ink is replaced — and the texture was
the one that could not, fixed at 4% and therefore able to spend contrast nothing
could win back: a mid-tone ground with an answer at 4.5 bare, and none once the
field split it into two colours. So it yields. `texturedGround` resolves the
palette with the texture, and if any run fails while the bare ground would carry
all of them, the tint is dropped and the composition paints no field at all. Only
ever for a run that then **clears** — a ground where neither version works keeps
its texture, since giving up the design buys nothing there.

**And the contrast formula is a hand-kept mirror.** `worker/video/remotion/contrast.js`
copies the WCAG half of `src/lib/audit/colors.ts`, because a Remotion bundle
cannot import TypeScript — the same wall that makes `server/video/timeline.js` a
copy of `timeline.ts`, and the same discipline: `contrast.test.js` runs a corpus
through both and requires identical answers, unreadable inputs included.

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

And it applies to the composition itself. A `product` refused for a 2000 ms
scene is refused as a product, never re-tried as the slideshow whose floor is
1000 ms and which would have passed — that would hand back a different film from
the one that was proposed, with nothing saying so. The one refusal that carries
more than a "no" is the composition that needs a picture when nothing is
selected: there the notice names `titles`, because the user cannot fix that one
by rewording anything.

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

**There is a third copy, and it is the one that found a real disagreement.**
`worker/video/validate.js` is not a port of the schema — it asks whether the
composition can draw the document — but it applies the same bounds, and
`validate.test.js` runs its own corpus through both. That corpus is where
`" "` turned up: `min(1)` counts characters, so a blank caption satisfied zod,
while `readText` in the worker has always refused a string that trims to
nothing. Mocky validated a document its own renderer throws back — the timeline
passes, the job is queued, the user waits out a render, and the refusal arrives
at the end of it about a caption they can see on screen. Every text field in the
schema now takes `line()`, which is `min(1).max(n)` plus `/\S/`. A `regex` and
not a `refine`, because a refinement wraps the string in a `ZodEffects` and
`draft.ts` reads `TextOverlaySchema.shape.content.maxLength` off the schema
precisely so a `maxLength` attribute cannot drift from the rule. And refused
rather than trimmed: trimming is a repair, and the caller is a model that can be
told.

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
| `JOB_TIMEOUT_MS` | 120 000 | The FLOOR under a job's deadline, not the deadline. See below |
| `JOB_BUDGET_BASE_MS` / `JOB_BUDGET_PER_FILM_MS` | 45 000 + 6× | Wall clock a film of a given length is allowed |

### The deadline scales with the film, because rendering is not real time

`JOB_TIMEOUT_MS` used to be the whole answer, justified by "120 s matches
`MAX_TOTAL_DURATION_MS` — a render that has taken longer than the video is long
is not going to finish". That sentence sounds right and is false. Remotion lays
out and paints every frame in a headless browser, so 1080p renders at roughly a
QUARTER of real time. Measured on the two-core worker: 6 s of film took 22 s,
15.5 s took 66 s, 30.5 s took 130 s.

So the flat ceiling refused every film longer than about 28 s — a film the
schema accepts, the panel queues, the user watches, and the clock then kills.
The default Ken Burns move made that regime more common, not less.

`jobBudgetMs(totalDurationMs)` is `max(120 s, 45 s + 6 × film)`. The multiple is
6 against a measured 4.3 because the measurement is from one host and the number
that matters is what a slower one needs. Nothing that fits today loses time: the
old flat value is the floor.

There are now **three** copies of this arithmetic — `server/video/queue.js`,
`worker/video/server.js` (10 s lower, so the worker gives up first and gets to
name the machine), and `src/lib/video/timeline.ts` for the panel's own poll
deadline. None of the three can import another: a bundle cannot read the
server's `.js`, and `worker/` is excluded from Mocky's Docker build context so
that Remotion's licence stays out of the default image.
`tests/video-render-budget.test.js` sweeps every duration the schema can produce
and holds all three to the same answer.

The panel's copy is the one that was quietly wrong for a second reason: its poll
deadline was `MAX_TOTAL_DURATION_MS`, which conflated two quantities that merely
happened to both be 120 s — how long a film may BE and how long rendering it may
TAKE. Left alone, it would have reported a timeout on a sixty-second film while
the worker was calmly halfway through it, and the finished export would then
have appeared in Media with no panel left to show it.

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

## What the encoder is told

`renderMedia` was called with a codec and nothing else, and everything else was
Remotion's default. The report that found it was one sentence — *the video
quality is really bad, everything is pixelated* — from someone who had exported
a 1920×1080 film of forest photographs.

The defaults, at the pinned 4.0.507:

| Option | Default | What it meant here |
|---|---|---|
| `imageFormat` | `jpeg` | every frame left Chromium as a JPEG |
| `jpegQuality` | 80 | …quantised at 80, before the encoder had seen it |
| `crf` | 18 (h264), 9 (vp8) | the same frame quantised a second time |
| `pixelFormat` | `yuv420p` | correct, and inherited rather than chosen |
| `scale`, `everyNthFrame` | 1, 1 | correct, and nothing to fix |

Two quantisers on the same 8×8 grid, and the first bought nothing: the frames
never touch a disk, they come back over the devtools socket and go straight into
the encoder. On dark, high-frequency foliage that first pass **is** the blocking
in the report.

**The capture is still JPEG, at quality 100 — and now for a measured reason.**
`imageFormat: 'png'` is the correct answer to "do not quantise twice", and it
was refused the first time on an estimate: that a 1080p PNG is "an order of
magnitude" dearer per frame. Nobody had measured it. The same slideshow of
library photographs, 1920×1080, rendered twice in the worker container
(`cpus: 2.0`, concurrency 2):

| | jpeg 100 | png | against |
|---|---|---|---|
| 465 frames (15.5 s) | 66.2 s | 106.5 s | `RENDER_TIMEOUT_MS` = 110 s |
| 915 frames (30.5 s) | 129.9 s | 212.8 s | |
| peak container memory | 3081 MB | 4096 MB | `mem_limit: 4g` |
| PSNR vs a lossless reference | 43.15 dB | 44.32 dB | png capture, crf 1 |

Not an order of magnitude — about 60%. And still a refusal, for a sharper
reason than the estimate could give: a fifteen-second film lands 3.5 s inside
the deadline, and a thirty-second one takes twice the deadline while touching
the memory limit exactly. PNG does not buy a sharper export; it buys a 504 on
the next film that is slightly longer and an OOM kill that reaches the user as
"the worker could not be reached".

What settles it is the last row. PNG's entire gain is **+1.17 dB**, and +1.00 dB
of that was sitting in the bitrate cap below — for **+0.3%** of render time. The
capture was never where the remaining loss lived; it only looked like the
obvious place. Quality 100 flattens libjpeg's quantisation tables, so the luma
arrives intact; what it does not recover is chroma resolution, and that is why
it is most of the distance rather than a compromise — the output is 4:2:0
regardless.

**`yuv420p` is stated, not inherited, and it is deliberately the default.** The
instinct for a film made of type over photographs is `yuv444p`, and it is the
wrong move: h264 at 4:4:4 is the High 4:4:4 Predictive profile, which browsers
do not decode, and Mocky's own Media tab plays these films in a `<video>`. The
sharp export would be the one nobody can watch. Writing it down means a Remotion
release changing its own default cannot change what a Mocky export can be opened
in — v4 → v5 already moved the default `colorSpace`.

**h264 gets CRF 14 and a cap that depends on the film's length; vp8 gets a
bitrate.** They are not the same setting spelled differently:

- CRF has no size bound at all, and the film comes back whole in an HTTP
  response, crosses `server/video/worker.js` as one Buffer and is written
  against the same `diskBudget` as the image and clip libraries. So the CRF
  travels with `encodingMaxRate` and `encodingBufferSize` — a ceiling of
  **244 MB for the longest film the schema permits**, forty of them against the
  default 10 GB budget, and every real film a fraction of it.
- vp8 gets `videoBitrate: '8M'` and no CRF, because Remotion emits `-crf` and
  never `-b:v 0`. libvpx reads a CRF as *constrained* quality bounded by the
  target bitrate, and with no `-b:v` that target is ffmpeg's own default for a
  video encoder: 200 kbit/s. The webm path was not merely using a default — the
  default it used capped a 1080p film at a rate meant for a thumbnail.

**The cap had become a quality setting, and nobody could see it.** It was a flat
16 Mbit/s, justified as sitting "above the rate CRF 18 spends, so it cannot cost
a film anything". True of CRF 18 — 13.1 Mbit/s measured — and false from the
moment the CRF moved to 16, which spends 16.9. A clipped encode reports no
error, so every export since was quietly losing a decibel. Measured, per CRF,
with the cap lifted: 18 → 13.1 Mbit/s, 16 → 16.9, 14 → 21.8, 12 → 28.3.

So the thing that is bounded is now the **file**, not the rate — the store, the
Buffer and the response all care about bytes — and the rate is whatever a film
of that length can afford inside a 244 MB budget, up to a ceiling of 28 Mbit/s
and never below the old 16. A rate that depends on the length is a real choice:
two minutes of 1080p and eight seconds of it are not the same object, and the
flat cap was the only thing making them equal. At the schema's own 120 s the
formula returns exactly 16, so the worst case is **unchanged** and strictly
smaller at every other length; `encoding.test.js` sweeps every duration and
holds the bound.

28 rather than 24 because `maxrate` bounds a peak while a CRF's rate is an
average, and clearing the average is not clearing the cap: against the same
encode with no cap at all (45.24 dB), a cap of 24 cost 0.42 dB and 28 costs
0.10. 28 is the smallest ceiling that is not a quality setting.

**What the two changes are worth, end to end**, on identical documents:

| | PSNR | SSIM | size (3 s) | render time |
|---|---|---|---|---|
| before — jpeg 100, crf 16, 16 Mbit/s | 43.15 dB | 0.9863 | 5594 kB | 168.0 ms/frame |
| **after — jpeg 100, crf 14, 28 Mbit/s** | **45.14 dB** | **0.9895** | 8137 kB | 172.4 ms/frame |
| the PNG capture that was rejected | 44.32 dB | 0.9884 | 5303 kB | 249.8 ms/frame |

**+1.98 dB for +2.6% of render time** — against +1.17 dB for +48.7%. And
`x264Preset` stays absent, now for a measured reason too: `slow` returned
43.14 dB against `medium`'s 43.15 at the same CRF, a file 1.5% smaller, for 17%
more render time. A preset trades size against CPU at constant quality; there
was never a decibel in it.

**`concurrency` is stated too, and it is the one default a container makes
actively wrong.** Remotion opens half the CPU threads it can see. `cpus: 2.0` in
the compose file is a CFS quota, not an affinity mask, so nothing the worker can
call reports two — neither `os.cpus()` nor `os.availableParallelism()`. It reads
the host's threads, and on an ordinary sixteen-thread build machine the render
opens eight Chromium tabs to time-share two cores. As waste that is merely a
worse trade against a 110 s deadline; it stops being harmless the moment the
capture is raised, because `concurrency` is how many captured frames are in
flight at once and a quality-100 frame is several times the size of a quality-80
one. Raising the capture and leaving the multiplier to whatever host the image
happens to run on is how a worker that renders on one machine is OOM-killed on a
bigger one, against `mem_limit: 4g`, with nothing in the job but "the worker
could not be reached". So `RENDER_CONCURRENCY` sits in the compose file beside
the `cpus` it has to match, defaults to 2 in code, and `encoding.test.js` reads
both numbers out of `docker-compose.yml` so that raising one and forgetting the
other fails a build rather than a render.

All of it is in `worker/video/encoding.js`, with no Remotion import, for the
same reason `composition.js` has none: `render.js` cannot be loaded by any test
in this repository, and the construction of the call is the one part of a render
that can be checked without producing one. `encoding.test.js` holds Remotion's
defaults as literals — a test that read them from the module under test would
agree with anything — and asserts that each codec receives the keys it reads and
none it would ignore, that the five templates render at one quality, and that
the 244 MB ceiling is arithmetic rather than a sentence. It also carries the
measured rate of each CRF, so that a cap lowered under the CRF it is supposed to
be guarding fails a build instead of costing every export a decibel in silence.

---

## What the encoder cannot reach: a picture smaller than the frame

The same one-sentence report had a second cause, upstream of every setting an
encoder has. The pipeline was followed end to end and it loses nothing until the
last step:

| Step | What happens to the pixels |
|---|---|
| `server/images/library.js` | the provider's bytes, whole, at `data/image-library/<hash>.jpg`. No thumbnail, no second copy, no re-encode — the `.jpg` is a naming convention and `mime` records what the file really is |
| `collectImages` (`server/video/worker.js`) | the file is read and base64'd. Deduplicated, never resized |
| `POST /render` on the worker | an 80 MB body ceiling. It **refuses**; nothing there scales a picture down to fit |
| `stageImages` (`worker/video/staging.js`) | the same bytes, written beside the bundle |
| the composition | `object-fit: cover`, and this is where it is lost |

Mocky's image library defaults to **1024×1024**. A `16:9` export is
**1920×1080**. `cover` fills both edges, so the still is enlarged **1.88×** and
44% of it is cropped away on the way — and a Ken Burns move asks for 12% more on
top of that, a pan for the whole scene, a zoom at one end of it. At 2.1× a
photograph of dark foliage is mush, and no `crf`, no `jpegQuality` and no
bitrate puts back detail that was never in the file.

So there are two changes, and the first is worth more than it looks.

**A picture made FOR a film is asked for in the film's shape.** "Start from one
image" sent no dimensions at all, which meant the library's square default for
every export. It now sends `SOURCE_DIMENSIONS` — 1344×768 for `16:9`, 768×1344
for `9:16`, 1024×1024 for `1:1`. The provider call costs exactly the same and
both halves of the loss shrink at once: the shape matches, so `cover` stops
throwing away nearly half the picture, and the long edge is 1344 rather than
1024, so what is left is enlarged 1.43× instead of 1.88×. `makeVariants` copies
a source's geometry, so every variant inherits it without being told.

Those are **not the frame's own size**, and that is deliberate. A generator is
not a scaler: diffusion models are trained at a handful of shapes and drift badly
away from them, and a self-hosted sd-webui asked for 1920×1080 returns a slow,
duplicated subject rather than a sharper one. 1344×768 and 768×1344 are SDXL's
own buckets; Pollinations and fal take them verbatim, and OpenAI's `snapSize`
reads the ratio and answers 1536×1024, which is better still.

**What cannot be fixed is reported, before the render and not after.** 1.43 is
not 1, uploads are whatever the user has, and a library full of square pictures
predates all of this — so the panel measures every still against the box it will
actually be painted into and says so. Each affected scene row carries its own
`1024×1024 · enlarged ×1.9`, and one line in the pinned footer, beside the
budget and under the button, gives the count and the worst factor.

Four things about that check are decisions rather than details:

- **It runs in the browser, live.** `/compose` and `/render` both answer with
  notices and both are the wrong door: a draft assembled by hand out of the
  picker never composes, and by the time `/render` answers the job is queued. The
  answer changes with the aspect ratio, the composition and every camera move on
  the panel, and it has to be on screen while those are still choices.
- **It measures the file, not the index.** `width`/`height` in the image library
  record what was *asked* of a provider: OpenAI snaps a request to its own
  nearest bucket, an upload whose dimensions failed to decode is stored as 0×0,
  and entries from before the field have nothing. The panel decodes the picture
  it is already displaying — a cache hit, not a fetch — and reads
  `naturalWidth`. A picture that cannot be measured is skipped rather than
  guessed at.
- **It knows which composition is being cut.** `product` stands its picture on
  half a landscape frame, so the same still that is coarse in a slideshow is
  sharp there; `titles` paints no picture at all and is silent. Under `auto` the
  composition is not decided yet, so the report is the **floor** — no camera
  move counted — because a warning that cries wolf is one people learn to ignore
  the time it was right.
- **It never disables anything.** A soft still is a film people ship on purpose.
  The floor is 1.25 — a quarter more pixels than the picture has, strictly
  greater, so 1536×1024 in a landscape film, which is the best OpenAI's models
  return, passes.

The frame geometry is a fourth hand-kept mirror: `src/lib/video/resolution.ts`
copies `DIMENSIONS`, the two overscales and `PICTURE_SHARE` out of
`worker/video/remotion/composition.js`, which cannot be imported by a Vite
bundle. `tests/video-frame-geometry.test.js` holds them together, because this
copy drifts in the silent direction — raise the worker's output to 4K and the
panel keeps measuring against 1080p, so it stops reporting exactly the films that
got worse. `PICTURE_SHARE` moved out of `ProductSpotlightVideo.jsx` into
`composition.js` to make that possible, which is where the file's own rule said
it belonged anyway.

The 80 MB ceiling got the same treatment while the path was being walked. It is
a refusal and never a resize, and it used to be met at the far end of the queue:
job accepted, minutes waited, *the render worker answered 413*. `POST /render`
now adds up the images on disk, applies base64's four-for-three, and refuses
before enqueueing when the pictures **alone** are already over — a floor on the
real body, never an estimate, so nothing that would have rendered is turned away
and a body that clears it still meets the worker's own 413 exactly as before.

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
| `src/lib/video/timeline.ts` | The zod schema — the five templates, the theme, and the reasoning behind every bound. The definition to read |
| `server/video/timeline.js` | The same schema, mirrored by hand for Node, plus `attachTheme`. `timeline.test.js` holds the two together |
| `src/lib/video/theme.ts` | The project's art direction, read into the handful of tokens a film can carry. Declared ones only |
| `src/lib/video/resolution.ts` | How much a still is about to be enlarged, and what to ask a provider for. Mirrors the worker's frame geometry; `tests/video-frame-geometry.test.js` holds the two together |
| `server/video/compose.js` | The one model call: it composes a scene out of the block catalogue, it never picks the pictures |
| `server/video/variants.js` | The two variant paths, and the fixed table of axes |
| `server/video/config.js` | Admin settings. The licence key never leaves the server |
| `server/video/queue.js` | In-memory queue, atomic JSON journal, concurrency of one. No Redis, ever |
| `server/video/worker.js` | HTTP client for the render worker, and `assertWorkerTarget` |
| `server/video/store.js` | The finished file, kept whole. **Not** `server/videos/` |
| `server/video/routes.js` | `/api/video`, the pending guard, and the admin router |
| `src/components/VideoExportDialog.tsx` | The Motion panel. Opened from the toolbar, never from a screen |
| `worker/video/` | The Remotion worker: separate sub-project, separate image, separate README |
| `worker/video/encoding.js` | The codec table and what each codec is told about quality. No Remotion import, so the one testable part of a render can be tested |
| `worker/video/remotion/composition.js` | Every composition's shared arithmetic, their theme, and their palettes. No React, no Remotion, so a test can reach it |
| `worker/video/remotion/ComposedSceneVideo.jsx` | The layout engine for the composable variant: the ground, the nine cells, and the stack that drifts |
| `worker/video/remotion/blocks/` | One component per block kind, plus the registry. No Remotion import, no colour, no curve — `blocks.test.js` holds all three |
| `worker/video/remotion/contrast.js` | WCAG luminance and contrast, mirrored by hand from `src/lib/audit/colors.ts`. `contrast.test.js` holds the two together |
| `tests/video-worker-separation.test.js` | What actually keeps Remotion out of Mocky's manifest |
| `tests/video-frame-geometry.test.js` | The frame size, the overscales and the picture share, compared between the browser and the worker |

The queue is in memory with a JSON journal on disk, and there is no Redis and no
worker table — same posture as the rest of the store. A self-hosted Mocky is one
process; a job queue needing a second daemon to survive a restart would cost more
to operate than the feature is worth. The journal exists for exactly one thing:
so a restart can tell the user what happened to the render they were watching.
Nothing is resumed. Re-queueing would be one line, but a render nobody asked for
twice is CPU spent behind their back, and on an instance that crash-loops it is
spent on every boot.
