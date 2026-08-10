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
| Data | `barChart`, `lineChart`, `equalizer`, `soundWave`, `map`, `globe`, `solidChart` |
| Media and time | `imageFrame`, `gallery`, `carousel`, `clock`, `dateStamp` |
| Misc | `separator`, `progressBar` |
| Set pieces | `codeBlock`, `solidScene`, `extrudedType` |
| Fields in volume | `particleField`, `waveMesh`, `depthGrid` |
| Grounds | `solid`, `gradient`, `hairlines`, `gridPulse`, `particles`, `image` |

**The five stay, whole and renderable.** Saved drafts and the queue's journal are
full of them, and a template removed is every one of those documents refused at
validation with nothing anywhere naming the change that caused it. The panel's
selector and `draft.ts`'s flat record are keyed on `EDITABLE_TEMPLATES`, the five
a person can fill in by hand; the schema, the worker, the palettes and the
motions are keyed on `VIDEO_TEMPLATES`, which is now six. Two lists rather than
one with a flag, because "can this be rendered" and "can this be typed in" are
not the same question and have not had the same answer since the blocks arrived.

#### Two data blocks drawn by a renderer: a globe, and a chart with volume

The catalogue's data family gained two entries that are drawn in GL rather than
with divs, and both come from the same request: a world map that is not flat, and
a histogram with weight in it. Neither reopens the founding rule — a document
names `globe` or `solidChart`, fills in bounded integers and a closed enum, and
every vertex, every camera and every colour is written by hand — but each had one
question that had to be answered before it could ship.

**A 3D bar chart is a decoration unless the projection is parallel, and that is
the whole design of `solidChart`.** Under a perspective camera two equal values at
two depths draw two different columns: with this catalogue's own lens, a bar one
and a half units nearer than another projects at 1.73 times its height. That is
why a 3D bar chart is a data-visualisation anti-pattern everywhere it appears, and
it is not a tuning problem — the one thing a bar chart is FOR is exactly what the
vanishing point destroys. Orthographically it is simply not true: a vertical of
world height `h` maps to `h·cos(elevation)` wherever it stands. `chartProject` is
that arithmetic, one line long, and `dataVolume.test.js` holds it as an equality
over a grid of positions and depths rather than at the origin, because the defect
it refuses is precisely a column that draws differently BECAUSE of where it stands.

Occlusion is the second half and it is bounded rather than avoided. A box of width
`w` and depth `d` yawed by `a` has a silhouette `w·cos a + d·sin a` wide, and the
columns' centres are `p·cos a` apart, so the row is free of overlap exactly when
`w + d·tan a ≤ p`. With the air the flat chart already spends
(`FIGURE_GAP_SHARE`) and a depth equal to the width, that bounds the yaw at a
little over 23°; `CHART_AZIMUTH` is 16, and the test holds the inequality rather
than the angle. The elevation needs no bound at all, because every column stands
at the same depth. What is left is what makes the block worth a renderer: two lit
faces per column, on the same Lambert segment `solidShading` already measures, and
a plinth where the flat chart has a baseline — a plate rather than a rule, since a
line drawn in space is the one element whose thickness a projection is free to
change.

**Its labels are flat type over the canvas, and that is written down rather than
assumed.** Type in GL is either an extruded geometry, which needs a font file this
container does not carry, or a texture, which is glyphs at a size nobody chose in a
colour nobody measured. A caption is a RUN: it belongs to the one type scale, it is
sized by `labelBand` against the lane it sits under, and it disappears rather than
overflowing. So `blockCanvas` answers a `frame` taller than its canvas and an
`overlay`, the composition draws the DOM half over the GL one, and the lane a
caption is centred on is the PROJECTION of its column's centre line — a caption
under the wrong column is worse than no caption at all.

**The globe is the flat map's own coastline on a sphere, and it is the answer to a
resolution problem rather than a second map.** `map` gave up its sub-regions once
already: a plate carrée mask fine enough to draw a border is a mask that draws the
wrong border, so what it draws is a coastline at the scale of a continent. A sphere
has no border to miss — what a viewer reads is the SHAPE of the continents and the
fact that they curve away — and both survive at whatever resolution the box can
carry. It reads the same `LAND_ROWS`, because a globe whose Africa differed from
the map's would be two worlds in one film, and it takes the same three fields:
`region` says which face turns towards the camera when the scene opens, `markers`
is a count, and the positions are the composition's, since a latitude is a
coordinate under another name.

Its lattice is a Fibonacci spiral, which is the part worth stating twice. Equal
area is what it buys — a latitude/longitude grid sampled at a fixed step in both
puts five times as many dots per unit of surface at 78° north as at the equator, so
the poles read as bright caps — and DETERMINISM is what it costs nothing: the
shortest route to a scattered field of points is `Math.random`, and this is the
family where that temptation is strongest. Every position comes from an index.

**What the measurements changed is most of the block.** Bench: the worker image,
`--cpus=2.0 --memory=4g`, 1080p/30, six seconds of film, the encoder settings
`encoding.js` really uses. A plain display title is the control; a full-frame
`solidScene` sphere is the calibration, since this document already prices that at
+0.9 s of render per second of film.

| Scene | render | Δ s/s (bench) | **Δ s/s (this document's scale)** | Output |
|---|---|---|---|---|
| control (a title) | 12.9 s | — | — | 0.73 MB |
| `solidScene`, sphere, full frame | 20.3 s | +1.23 | **+0.90** (the calibration) | 0.79 MB |
| `globe`, full frame | 19.4 s | +1.09 | **+0.80** | 3.90 MB |
| `globe` + a heading | 21.2 s | +1.39 | **+1.01** | 3.53 MB |
| `solidChart`, full frame | 17.3 s | +0.74 | **+0.54** | 0.64 MB |
| `solidChart` + a kicker | 20.8 s | +1.32 | **+0.96** | 0.62 MB |
| eight `globe` blocks in one zone | 21.0 s | +1.37 | **+1.00** | 1.72 MB |
| ~~`globe` as a full SHELL of dots~~ | 23.8 s | +2.08 | **+1.81** | 7.50 MB — refused |
| ~~the same, with a translucent sphere~~ | 30.9 s | +3.26 | **+2.84** | 2.50 MB — refused |

The deadline leaves about 1.7 s/s spare at the schema's longest film, so both of
these fit and the two versions that were refused did not. **The first globe drew a
whole shell** — land bright over sea quiet, one lattice split in two — and it was
the wireframe's own failure arriving through a different geometry: thousands of
tiny high-contrast points moving every frame are the detail h264 cannot predict,
and it came back at ten times a title's bitrate. Replacing the sea with a
translucent sphere was worse, because a full disc of alpha blending on every frame
is what a software rasteriser is slowest at. What ships is `globeGraticule`: a
dozen meridians and seven parallels of points, which is what says "sphere" and
costs a twentieth of a shell.

The second measurement changed how the block is written. **A cloud of points costs
about fifteen milliseconds a frame whatever is in it** — the positions are rebuilt
on each of a scene's frames, so the geometry behind them is disposed and re-created
that many times, and the bill is per BUFFER rather than per point. The same globe
at 7854 dots and at 2827 took 23.8 s and 24.4 s; dropping one cloud of three took
2.7 s off. So the connections travel in the land's buffer, there are two clouds
rather than three, and the dot count is nearly free — which is why `GLOBE_PITCH_PX`
is chosen for the ENCODER rather than for the rasteriser: the same six seconds came
back at 7.5 MB at a pitch of eighteen and 3.9 at thirty.

The last row of the table is the one that says the box arithmetic still holds.
Eight globes in one zone cost what one costs, because eight boxes are eight eighths
of a safe area — `tests/video-composed-frame.test.js` proves it for `solidScene`
and the measurement confirms it here. A set piece crowded into a stack does not get
expensive; it gets small.

Two entries in `FIELD_PAINTS` follow from all of it. A `globe` anchored `full`
paints the accent at two opacities and nothing else, since there is no light in
that scene at all; a `solidChart` paints a `solid`, the same Lambert segment as
`solidScene`, because its columns are lit. Its labels are outside the canvas and
are measured as ordinary running text on the ground.

##### A shell is not the drawing, and a canvas edge is a knife

Two exports came back with the globe's right half stopping on a straight vertical
line a third of the way down the frame — the one class of defect a viewer reads as
broken software rather than as a choice, and the user's report said only that "the
3D renders are not always well cropped". The measurement is what settled which of
the three candidate causes it was: the canvas is not smaller than its box (it is
`min(box.width, box.height)` to the pixel), and the camera is not too near (it is
the catalogue's own lens). **The object is larger than the view volume, and the
object is not the sphere.**

`GLOBE_RADIUS` is `SOLID_BOUND`, whose own sentence is "the exact radius at which a
ball about the origin touches the edge of its canvas and never crosses it". The
ball never did. Four things this block hangs off that ball are not on it:

| what | how far off the shell | at a full 16:9 frame |
|---|---|---|
| a connection, bowed by `GLOBE_ARC_LIFT` | `1.16 · R` | 64 px outside the canvas |
| a marker, a sphere centred ON the surface | `R + m` | 39 px |
| a ripple, a ring in the tangent plane | `√(R² + (3m)²)` | 22 px |
| a dot, a sprite `dot` px across | half a dot | 7 px |

against the 2 % of rounding `SOLID_MARGIN` leaves. A rendered corpus is what
measured it: on a 1920×1080 export the ink was pinned to the canvas's last column
for 93 consecutive rows, on every frame — an arc bundle leaving one marker cuts as
one straight line, which is exactly what "its right half stops on a vertical line"
describes. It was intermittent in `life`, because the globe turns and a bulge
crosses the limb during the scene; that is the "not always".

The canvas cannot grow — a canvas larger than its box paints over the zone next
door — so what yields is the radius the dots sit at. `globeShell` is that bound,
closed form because every one of the four reaches is linear or Pythagorean in the
radius, and it reads the BLOCK: a globe with no marker and no connection keeps the
radius it always had, and only what a document actually drew is paid for. Nothing
about the block's claim on the frame changes — `blockExtent` still says a globe
draws to the minor side of its box, and after this it still does. What changed is
which part of the drawing touches the edge.

The same corpus, re-rendered: the extreme column moves from frame to frame
(1340, 1381, 1385, 1412 px) instead of sitting at 1425 on all of them, which is
what a silhouette does and a clip does not. `dataVolume.test.js` holds the claim in
world units rather than in pixels — every point of every cloud, plus its sprite,
plus the rim of every marker and every ripple, inside the ball `SOLID_BOUND`
describes — because a claim about pixels would be a claim about the projection
`SOLID_BOUND` was derived from.

The other eight 3D blocks were measured the same way, by the ink of a rendered
corpus, and none of them crosses: `solidScene` is normalised on its own bounding
sphere, `photoStage` and `photoRing` fit every corner through `frustumScale`,
`extrudedType` caps its canvas at what `blockExtent` claims and reserves its own
swing, and the three fields are meant to cover their box. `solidChart` fits its
canvas exactly — the projected hull spans `[0, canvas.width]` to the tenth of a
pixel — which is correct and has no margin at all; the 19–32 px vertical edges at
each end of its plinth are the box's own end faces and not a cut, and it is worth
knowing that before reading one as the other.

#### Three fields in volume: a dust, a swelling surface, and a floor

The request that names them is "the background should be in 3D", and the answer
is a family rather than three more set pieces. A set piece is a whole scene and
the prompt tells the model to spend at most one per film; a FIELD is what a scene
is made of — it is painted under the nine cells, a heading is meant to stand on
it, and a film may want one every other scene. What it must never do is share a
frame with a second field, and that is the sentence `FAMILY_TITLES.field` carries
instead.

| Block | What it is | Fields |
|---|---|---|
| `particleField` | dust hanging in space, drifting | `count`, `drift` |
| `waveMesh` | a lit surface, swelling | `swell`, `tilt` |
| `depthGrid` | rules running away from the eye, as a floor or a tunnel | `lines`, `form`, `travel` |

Nothing in there is a colour, a coordinate, a velocity or a size, and there is no
SEED — which is the one field through which a document could render differently
from itself, the same failure a `Math.random` is, arriving through a key instead
of through a call. Every position comes from an INDEX and a frame number, through
`noise` in `worker/video/remotion/blocks/field.js`: an integer hash, deliberately
not the `fract(sin(…))` idiom every shader tutorial reaches for, because
`Math.sin` is accurate to within an ulp and which ulp is the engine's business.
`field.test.js` proves two calls return the same bytes; the export store is
content-addressed, so a film that differs by a pixel between two runs is two
films on one disk budget.

**The measurements are the whole design of the family.** Same bench as above —
the worker image, `--cpus=2.0 --memory=4g`, 1080p/30, six seconds, `encoding.js`'s
own encoder settings — and every figure is a RATIO to a full-frame `solidScene`
measured in the same run, then put back on this document's scale, because some of
these benches ran while other work had the machine.

| Scene | Δ s/s (this document's scale) | Output |
|---|---|---|
| `solidScene`, sphere, full frame | **+0.90** (the calibration) | 0.86 MB |
| `particleField`, the count silence gives | **+0.25** | 1.27 MB |
| `particleField` at the schema's ceiling | **+0.37** | 2.03 MB |
| `waveMesh`, full frame, inside the pixel budget | **+1.00** | 2.12 MB |
| ~~`waveMesh` at its box's own pixels~~ | **+1.70** — refused | 2.81 MB |
| `depthGrid` as a `floor` | **+0.28** | 1.29 MB |
| `depthGrid` as the densest `tunnel` | **+0.85** | 4.09 MB |
| ~~the same tunnel with no fog and no fade~~ | **+1.15** — refused | 5.98 MB |

Two of those rows are the two decisions.

**A field fills its box on both axes**, which at full frame is 2.4 times the
pixels the largest square `solidScene` canvas covers — and a lit surface at that
size spends the entire 1.7 s/s the duration-scaled deadline leaves spare, for one
block of one scene. So `FIELD_PIXEL_BUDGET` caps what a field may DRAW and
`ComposedSceneVideo` paints the result back over the box with two scales, one per
axis, so the rounding of an integer backing store cannot leave a hairline of the
ground down the right edge. Cutting the budget a further third bought +0.19 s/s
for a fifth of the linear resolution, which is where the trade stops being worth
taking. A field in a CELL pays nothing: a third of a zone is already under the
budget, so `fieldCanvas` hands back its box unscaled and the drawing is sharp.
This is the only family drawn smaller than its box, and it is allowed to be
because none of the three has an edge on it finer than the gradient across it —
which is also why none of them may ever set type.

**A grid in perspective converges, and where it converges it costs bitrate.** The
first `depthGrid` came back at 6.0 MB for six seconds — three quarters of the way
to the 9.8 MB that got the wireframe refused — on a band of alternating pixels
crawling towards a vanishing point. `GRID_FOG_DENSITY` fixes it for nothing: fog
blends towards `palette.ground.color`, so every pixel of the block still lies
between the bare ground and the accent, which is the pair `composedPalette`
measures for this field. It is also the right picture, since a floor whose far
end simply stops has a visible edge across the frame. The rules themselves are
long thin BOXES and not `<lineSegments>`, and that is measured too: a line
primitive is one pixel wide whatever its depth, so a floor made of them has no
perspective in its own weight — and it is the geometry that got the wireframe
refused in the first place.

Three more things a rendered frame decided rather than a reading.

*The wave was a flat orange slab.* A Lambert face is lit by its NORMAL, and the
first swells had a steepest slope of eighteen degrees, which against an ambient
share of a half is a variation nobody can see. The product `rise × wave` is near
one at every swell now — about forty-five degrees at the crest — and the one
directional light sits to the SIDE rather than over the camera's shoulder, where
`solidScene` puts its own: a solid turns, so any angle finds its faces, and a
sheet that undulates in place needs grazing light to be read at all.

*Then it had a notch in it.* The sheet is displaced along its own normal, so a
trough at the far edge drops it below the top of the picture and opens a strip of
bare ground across the frame. `WAVE_WIDTH` and `WAVE_DEPTH` are derived from the
camera and not chosen, and `field.test.js` holds the inequality with twice the
deepest rise subtracted from it, at both tilts.

*And the dust wraps off-frame.* A particle walking upwards comes back by a
modulo, and a modulo inside the frustum is a speck teleporting through the middle
of the picture — once per particle per scene, on the drift a silent document
gets. `PARTICLE_RISE_SPAN` clears the frustum at the far side of the world, and
the test is the inequality rather than a paragraph.

The three are named in `server/video/three-d.js` with the blocks that came before
them, so the administrator's 3D permission covers them; a field added to the
catalogue and forgotten there is a block offered to every account, which is
precisely the failure nothing about it would make visible.

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

**The run it is pinned to is the ORNAMENT's, and it used to be the ink.** A
rendered film is what said so: a torus painted in `palette.display.color` under a
heading painted in `palette.display.color` is an object and the word laid on it
meeting at 1:1 wherever they overlap, which is the founding mistake of this whole
section arriving one composition later. A lit solid is a decoration, and a
decoration carries the project's colour (`accentRun`) — so the material is the
accent, and on a direction whose accent cannot be read at all it falls through
`accentFirst` to the ink like every other ornament, because being legible outranks
being distinct here as everywhere else.

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
on. `composedPalette` offers four measured runs on a panel. Those thirty colours
therefore have exactly two places to go — into a block as hex nobody measured,
which is the defect that shipped a dark green headline on a near-black frame and
which `blocks.test.js` refuses outright, or collapsed onto measured runs, at
which point the highlighter did nothing a role does not. So `codeBlock` carries a
`role` per line, the model says what each line is, and no language is inferred
from a string. That also keeps a regex engine off model-written text inside a
render under a deadline.

**The fourth of those runs is this block's, and it is a floor rather than a
shade.** A panel used to carry the same trio the ground does — display type at
3:1, running text at 4.5:1 and quieted, an ornament — because every panel in the
catalogue was a title, a subtitle and a mark. A listing is not that shape: its
`plain` lines are the MAJORITY of the panel, they are running text at the `body`
step, and they went to `panelDisplay` because that was the only run left that was
not the quiet one. So twenty lines of 21 px monospace shipped measured at 3:1,
worst case 3.19:1 across the sweep, on a floor the audit licenses by SIZE — 24 px,
or 18.66 px bold — and a wall of code is neither. Raising the type is not the way
out: 64 characters, the schema's own ceiling for a line, at 24 px are 921 px
across a 906 px safe measure in `9:16`, and a line of code that wraps is a
different program on the screen. So the run moved instead. `panelText` is running
text at full strength on the panel, `panelBody` stays the quiet one, and `plain`,
`muted` and `accent` are three roles on four runs rather than three roles fitted
to three. It costs the other three nothing — an opaque panel has no veil to
share — and it always has an answer wherever `panelBody` does, since quieting an
ink blends it towards the surface it is measured against.

Both of those are in a family of their own, `setPiece`, and the family is not
decoration either: the other six group blocks by what they ARE, and this one
groups by what they COST. That last word is worth being exact about, because half
of what it used to mean is now bounded by arithmetic. A `solidScene` canvas is a
share of the block's OWN box — see below — and a box is a share of the safe area,
so a scene naming eight of them draws what one frame draws, and
`tests/video-composed-frame.test.js` proves it rather than asking for it. The
render bill is therefore capped whatever a provider does with the advice. What is
not capped, and what the prompt is for, is ATTENTION: each of these two is a whole
scene, so "at most one in the whole film" is an editorial rule, and the card says
that a set piece crowded into a stack does not become expensive — it becomes
small, which is a whole renderer drawing a thumbnail.

#### The picture in perspective, and the bridge from the library to a renderer

Every 3D block above draws a SHAPE. `photoStage` and `photoRing` draw a PICTURE —
one the user selected, standing on a panel in real perspective, or several of them
on a carousel turning past the camera. That is the commercial use of this
capability and the one that pays for its own cost: a photograph on a turning panel
is what a product film is made of, and it is the only pair of blocks in the
catalogue whose subject came out of the image library rather than out of a closed
enum.

**Nothing in `blocks/` may import `three`, and a texture is an object rather than
a tag.** Every other 3D block returns bare intrinsics — `<mesh>`, `<boxGeometry>`
— which the reconciler resolves at render time, so the whole registry still loads
inside Mocky's own vitest suite where neither `three` nor Remotion is installed. A
`map` cannot be written that way: it is a `THREE.Texture`, and something has to
construct it. So the loading happens where the canvas is already opened.
`worker/video/remotion/textures.js` is the one file in the renderer that imports
`three`, `ComposedSceneVideo` calls it once per scene, and the pictures reach a
block as a `textures` prop exactly as the staged paths already reach it as
`images`.

**`delayRender` alone would not have been enough, and the reason is specific to a
3D block.** The panel's GEOMETRY is derived from the picture's own shape — the
slab takes the photograph's aspect, so nothing is cropped and nothing is stretched
— which means a component that rendered before the image decoded computed its
dimensions from a fallback. Releasing the frame at that moment captures a frame
whose material is right and whose slab is the wrong shape, and Remotion renders
many frames per page under concurrency, so the fallback would land on whichever
frame a page happened to start at: a film that differs between two runs of one
document, which the content-addressed store then files as two films. The frame is
therefore released from an EFFECT that runs after a render in which the images are
present — load, mark ready, re-render, continue — and a scene with no pictures
continues immediately rather than waiting for nothing.

**The fit is closed form, because the one thing a 3D block gets wrong that no
reviewer sees is geometry.** A flat block that overflows shows up in a screenshot;
a panel that swings its near corner through the edge of the frustum shows up on
frame two hundred and fourteen of an mp4 nobody watched to the end. The camera
sits at `(0, 0, d)`, so a point is inside when `|y| ≤ (d − z)·tan θ`, and scaling
the object by `s` makes that `s·(|y| + z·tan θ) ≤ d·tan θ` — linear in `s`, so the
largest legal scale is a minimum over the corners with no search in it.
`frustumScale` is that minimum, solved over the whole move rather than for one
pose (a panel fitted to the pose it is currently in would grow and shrink across
its scene), and `stage.test.js` re-derives the projection from its definition and
checks a hundred and one moments against a fit sampled at forty-one.

The lens follows from the same inequality. The share of the frame a panel may
occupy is `|y| / (|y| + z·tan θ)`, which RISES as the lens gets longer — `z` is
how far a turned corner leans towards the camera and `tan θ` is what that lean
costs. At `solidScene`'s 45° a card turning over composes its picture at 45% of
its canvas; at 30° the same flip composes at 60%. A wide angle would make this
family both smaller and uglier, since it turns a rectangle into a trapezoid whose
two vertical edges are visibly different lengths — which is why every catalogue in
the world shoots its objects on something near an 85 mm, and why 30° is what a
`photoStage` is seen through. A ring gets a longer one again, 18°, for a reason of
its own: the panel at the front stands a whole ring radius nearer the lens than
the origin the frustum was measured at, and at 30° that alone put a six-picture
carousel at a third of its canvas.

**Three things about the ring were wrong and a rendered frame is what said so, in
that order.** Sized on the WIDEST of its pictures, a carousel of five screenshots
containing one header banner asked for a ring nearly twice as wide as the others
needed and came back as a row of specks in a black frame — so a ring has ONE slot,
the median of the pictures' shapes clamped into a band a carousel can hold, and
one outlier costs a margin instead of the block. Built to that slot, the panels
were five slabs of saturated accent with a photograph inset in each — so a body
HUGS its own picture and the rim is the ornament rather than the block. And with
the panels facing outward, two or three of them show the camera their backs at any
moment, which is the accent again at the size of a panel — so a ring's picture is
drawn on the reverse too, turned half a turn about its own axis so it reads the
right way round rather than mirrored. What the fit is solved on is the box that
really holds the panels and not the slot they are bounded by: a ring of three
banners scaled as though each were a full card is three thin bars in the middle of
an empty frame.

**And a fourth, which only a PORTRAIT frame shows.** A ring is a horizontal
circle, so seen from the seven degrees above it that separate a carousel from a row
of sliding panels it projects to a flat ellipse: it spends measure and leaves
height. That is exactly right in a 16:9 frame and it is the small element in a
large void in a 9:16 one — a carousel of three alone on a portrait frame drew 78%
of the width and **21% of the height**, a strip of postage stamps in a column of
ground. The repair is the one a photographer makes and it is not a new degree of
freedom: `ringTilt` reads the CANVAS's shape — a fact about the frame, never about
the film — and opens the lean to 26° on the portrait ratio, so the circle becomes a
taller ellipse and the far panels stand above the near ones instead of behind them.
A landscape canvas keeps the exact lean it had, the fit re-solves at whatever lean
it is given, and the measured height went from 21% to 30% of the frame. It is an
improvement rather than a cure: a horizontal carousel alone on a vertical frame is
still a wide object in a tall box, and the honest advice is a `photoStage` there.

**What they cost, measured over twenty seconds of film on the two-core container
against a plain title.** Best of the runs rather than the mean, because the host
was doing other work: `solidScene` is what anchors the column at +0.90, which is
the figure already in this document, so the rest of it is comparable to
everything above.


| scene | Δ render seconds per second of film | output |
|---|---|---|
| control — a plain title | — | 1.75 MB |
| `photoStage`, full frame, mounted card, orbiting | **+0.18** | 2.09 MB |
| `photoStage`, full frame, in a case, turning over | **+0.19** | 2.12 MB |
| flat `gallery` of six, full frame | +0.26 | 4.58 MB |
| `solidScene`, full-frame lit sphere | +0.90 | 2.10 MB |
| `photoRing` of six, full frame, unbounded | +2.24 | 6.98 MB |
| `photoRing` of six, full frame, inside its budget | **+1.35** | 6.19 MB |

A stage is the cheapest 3D block in the catalogue — a fifth of a solid — and a
full-frame ring of six is the most expensive thing in it. The flat `gallery` is
the line that decided what to do about that: six screenshots on one frame cost
four and a half megabytes of h264, and the whole of that encoder bill is 0.26 s/s,
so a ring's two and a quarter are not the pictures being encoded but the pictures
being SAMPLED — eighteen textured quads at the grazing angles a software
rasteriser is slowest at. That cost falls with the resolution it is drawn at, so a
ring is drawn inside `RING_PIXEL_BUDGET` and painted back over its box exactly as
a field is; it lands at the same six hundred thousand pixels `field.js` arrived
at, which is not a shared constant but the same rasteriser in the same container
reaching the same trade from two different blocks. It does not fall to nothing —
about 0.9 s/s of geometry and encoding no budget touches — so this is a bound
rather than a cure, and the card says a ring is the expensive one. A ring in a
CELL is far under the budget and is drawn at its own size, to the pixel.

**Anisotropy is the one sampler setting that was chosen by measuring.** A panel
turned away from the camera is exactly the case a mipmapped texture without it
renders as a blurred smear along one axis — the softness `resolution.ts` is about,
arriving through a sampler instead of through a source that was too small. It is
not free and the cost is not where it looks: an orbiting stage is within the noise
at every setting, while a card turning OVER sweeps through the grazing angles
where the full tap count fires and measured 20.1 s at sixteen taps, 16.0 at four
and 13.4 with it off, against a 12.3 s control. Four is where that curve stops
being worth it.

**Their legibility is closed on both halves, and the second half is why `picture`
exists.** The body — the rim, the mount, the case, the back of a card — is
`palette.solid`: the ornament's run resolved on the bare ground and shaded along
the Lambert segment `solidShading` measures. The other half is the PHOTOGRAPH,
and `solid` alone said "the body of the panel" while a title stands on the
PICTURE — the panel is what holds it up. A real export of exactly this scene, a
`heading` over a `photoStage` anchored `full`, shipped white on pale wood at
1.68:1. So `FIELD_PAINTS` names both blocks `solid` AND `picture`, and the
photograph is bounded at black and at white with the zone's density as what cedes
— the legibility section carries the whole of that argument. Neither block paints
text over a picture either: a caption belongs to a `kicker` in a zone of its own,
on a surface somebody computed.

#### Type in three dimensions, and the two things that were refused to get it

The third thing asked of 3D was the first thing anybody does with it: an extruded
title, a wordmark with thickness, letters arriving in space and settling.
`extrudedType` is that block, and it is in `setPiece` with the other two — one
line of type, at most twenty-four characters, standing in a real scene and turning
in it.

**There is no glyph geometry in this container, and the package that would bring
some brings its own typeface with it.** The obvious way to extrude a letter is
`ExtrudeGeometry` over its outline, which is what `@react-three/drei`'s `<Text3D>`
does. It was measured before it was refused, exactly as Skia was: **+118.9 MiB
installed and +59 packages** on a base of 185.9 MiB, a 64% larger install for one
block. That is the cheaper half of the objection. `Text3D` does not read a system
font — it needs a `typeface.json`, a converted outline dump baked into the image —
and this container installs exactly ONE family. Every flat block in the catalogue
names the direction's DECLARED typeface first and falls back to Liberation Sans,
which is how "the project asked for Cormorant Garamond" becomes readable text in a
container with no egress. A baked outline set cannot do that, so a 3D title would
be Liberation Sans on every theme in the product while the heading beside it
honoured the art direction. A film in two typefaces is the guessed token
`theme.ts` refuses, arriving through a package.

So the type is rasterised by the browser that is already drawing the frame, in the
project's own font stack, and the third dimension is real geometry carrying it:
one textured quad per word for the face, one dilated copy behind it for the
thickness, a real perspective camera, a real turn. `funTitle` is what Skia became
without a package; this is what `Text3D` became without one.

**The second refusal is the letter, and it is the one the measurements made.** The
first version stacked ten copies of every LETTER, which is the obvious reading of
"letters arriving in space". Same bench as everything else here — the worker image,
`--cpus=2.0 --memory=4g`, 1080p/30, six seconds, `encoding.js`'s own encoder
settings:

| Scene | render | Δ s/s (bench) | Output |
|---|---|---|---|
| control (a flat title) | 13.2 s | — | 0.65 MB |
| `solidScene`, sphere, full frame | 20.8 s | +1.26 (the calibration) | 0.88 MB |
| ~~16 letters × 10 copies = 176 objects~~ | 75.1 s | **+10.3** — refused | 0.93 MB |
| ~~16 letters × 2 copies = 48 objects~~ | 32.1 s | **+3.1** — refused | 0.99 MB |

Two points on a line through the OBJECT count: 0.084 s of render per second of
film per object, and a fill term that solves negative — in a software rasteriser
the bill is the per-object state change and not the pixels. The 1.7 s/s the
duration-scaled deadline leaves spare is about 2.4 s/s on that bench, which is
twenty-eight objects. A sixteen-letter line at ten copies is 176 of them and a
twenty-four-letter one at two copies is 72: **per-glyph geometry does not fit, and
no number of copies makes it fit.** It is refused with its figure, exactly as the
wireframe was.

The object is a WORD instead — at most three of them, `SPATIAL_GROUPS` — and the
seam between two copies is closed by DILATION rather than by count: each copy is
stroked by the step it takes, so one copy behind the face is a solid side. Six
objects, whatever the line says. What it also buys back is the kerning the face
was drawn with, which a line placed letter by letter loses on every pair.

| Scene | render | Δ s/s (bench) | **Δ s/s (this document's scale)** | Output |
|---|---|---|---|---|
| control (a flat title) | 12.1 s | — | — | 0.65 MB |
| `solidScene`, sphere, full frame | 19.6 s | +1.25 | **+0.90** (the calibration) | 0.88 MB |
| `extrudedType`, full frame, `deep` | 18.9 s | +1.13 | **+0.81** | 0.97 MB |
| four of them, one per corner | 23.5 s | +1.91 | **+1.37** | 1.63 MB |
| the same block over 30 s of film | 82.5 s | +0.93 | **+0.67** | 4.32 MB |

**About +0.8 s/s**, 0.90 of what a lit solid costs on the same run, additive and
linear in the film's length — the thirty-second row is the same number measured
over five times the frames — and half again a title's bitrate where the refused
wireframe was sixteen times its control. Four of them on one frame still fit,
which is the property the layout gives this family for nothing: a canvas is the
block's own BOX, so a crowded scene does not get expensive, it gets small.

**Three bounds are the whole of the block, and each is a defect that a rendered
frame found.**

A long lens, because a wide one keystones a line of type: at twelve degrees of
field the near end of a seven-degree sway came back 14% larger than the far end on
the widest line the schema allows, which is one word set at two sizes and reads as
a mistake rather than as depth. The field is four degrees now, and past that the
returns stop — so a long LINE sways less instead, by exactly the amount that holds
the keystone at five per cent, with a floor under it because a film in which
nothing moves must not be producible by accident.

The arrival is a DEPTH and never an opacity, and the words come from BEHIND. A
word arriving from in front of the plane is magnified by the camera on its first
frames and draws outside the box the layout gave the block — `funTitleHeadroom`'s
lesson arriving through a camera instead of a padding — and a fade would paint
every word, for as long as it lasted, in a colour composited from the ink and the
ground that nobody measured. Same argument `heading` makes for its mask and
`solidScene` for its scale. The third of the three moves is a depth for the same
family of reasons and a different one: every ANGLE has to be paid for in the
stroke that closes the seam, and a per-word rotation of fourteen degrees put a ring
of nine per cent of the em around every word, which fills the aperture of an `e`.
So `float` breathes the words in depth, and it costs nothing to draw.

And the block scales UP to what `blockExtent` claims for it. The estimate that
solved the size rounds every glyph class up and adds six per cent on top, which on
a run that wraps disappears into the wrap and on this one cannot: a rendered frame
came back with `MOTION EN RELIEF` filling 74% of the measure its box had been
divided on, a quarter of the frame empty beside a title. That is the small element
in a large void arriving through an estimate. The line is scaled until it fills the
claim and never past it — the claim is what `stackIn` divided the zone on, so this
recovers slack and never takes a pixel from a neighbour.

Two entries elsewhere follow from all of it. `FIELD_PAINTS` gains a third answer,
`type`: this block paints the display ink on the face of every word and the accent
behind it, so a field measured as the accent alone would leave the largest ink on
the frame unmeasured, and a field measured as nothing at all is the 1:1 meeting the
whole legibility section exists to have prevented. And `blocks/canvases.js` is a
new file: which blocks need a GL canvas, how big it is and what camera looks into
it used to be a branch inside `ComposedSceneVideo`, which is one branch per 3D
block in a file every block author would then have to edit.

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

**And the margin includes the drift, which for two passes it did not.** A composed
scene translates its whole stack by `motion.drift × base`, from half
`COMPOSED_BLOCK_DRIFT` down on a scene's first frame to the same distance up on its
last. The boxes tiled the safe area exactly, so the top band's first block crossed
the safe top at the end of every scene and a bottom-anchored one crossed the safe
bottom at the start of it — 8.6 px on a 1080-line frame. A rendered corpus is what
found it: the ink of four solid-ground exports began 5 to 6 px above the margin at
three quarters of a scene, which is `(0.5 − 0.75) × 0.016 × 1080` to the pixel.
Nothing was cropped by it, and that is not the point — 6% of a landscape frame is
65 px — but the margin is a promise about somebody else's software, and on 9:16 the
band underneath is the feed's caption row rather than overscan. So `composedFrame`
is the safe area less `driftRoom(base)` on each of the two edges the stack moves
towards, and `composedLayout` lays out in that; `composedSafeArea` stays the
promise, so a test can say "the boxes are inside the frame" and "the frame plus the
drift is inside the promise" as two sentences. It is the trade `overlay` already
makes with its own amplitude: a move gets the room the layout leaves it.

**And the drift was not the whole movement of a scene.** The same defect, one
amplitude over, found the same way and on a witness with no 3D block in it at all:
`imageFrame` over `dateStamp` on 9:16, and the stamp's ink sat below the safe
bottom on every frame it was still arriving on. Every block in this catalogue that
arrives arrives from BELOW — `ENTER_RISE` is half a body line, 26 px on that
frame, against the drift's 9 — and nothing had bought that room.

`BLOCK_ENTER_TRAVEL` is the amplitude, as a table, because the five families that
have an entrance measure it against different things: half a body line for the
media blocks, a fifth of the RUN's own size for the text ones, a twentieth of the
card's own box for a notice. Those are mirrors of constants that live under
`blocks/` — `composition.js` cannot import a block, since `blocks/media.js`
imports it — and `composition.test.js` holds every row against its original, the
arrangement `contrast.js` and `server/video/timeline.js` already have.

The reservation is the SCENE's rather than the band's, and the difference is
measurable: taken out of the bottom band alone, a 105 px band paid a quarter of
itself and the date stamp came back at three quarters of its size; taken off the
grid it is 2% of the frame spread over every row, which is what the drift already
costs. Only the last used band is measured, because it is the only one that ends
on the bottom of the frame, and only when no foot is reserved — a field's declared
caption band is already between the cells and the edge. A `full` zone pays for its
own, off its own box, because it is in no band. What is absent from the table is a
decision too: `funTitle` travels UP by a third of its type and bought the room in
its own appetite (`funTitleHeadroom`), which is the better fix and the block's to
make; `heading`, `kicker` and `lowerThird` reveal their type from behind a mask,
and everything else arrives by opacity or by scale.

**A row is divided among the columns that are used, and a band among the rows.**
A fixed 3×3 of equal thirds is the obvious reading of "nine zones" and it makes
the commonest scene there is unreadable: `anchor` defaults to `center`, so a
document that names none puts everything in one cell — and a third of a 16:9
frame is 563 px wide, which is five characters of display type on a line, and 295
px tall, which is a stack sized for a third of a picture with the other two thirds
empty. One column used takes the whole measure, two take half each, three take
thirds, and the same arithmetic runs down the other axis. The alignment still says
which edge the content sits on.

The rows were fixed at first and the asymmetry was deliberate: a band's anchored
edge is already the safe edge, so a stack too tall for its band grew towards the
middle of the frame rather than past the edge it was anchored to. That was an
argument about OVERFLOW, and it stopped applying the day a stack's type size
started being solved against its own band — a stack that cannot be taller than its
band does not need two thirds of the frame held empty in case it is. What survives
of it is the alignment, which now decides which way the leftover is spent.

**And the bands are divided by APPETITE, not among the rows equally.** `stackIn`
has divided a zone that way since a `separator` above a `heading` took half a
column for three pixels of ink; the grid went on dividing by count, which is the
same defect one level up. A surtitle, a headline with its rule and a wordmark are
three used rows and three equal bands — so three quarters of the top band was
empty and the film's own headline was solved against a third of a frame that had
two thirds to spare. Air is the smaller half of what that costs: a stack fills the
box it is given, so an over-large band is an over-large type unit, and the export
that showed it had a `logoType` in the bottom band at three times the `heading` in
the middle one. A row's weight is the HUNGRIEST of its cells rather than their
sum, because the columns of a row sit side by side.

The consequence is the one that makes the rest of this section simpler: weighted
bands make every zone read the same unit *by construction*, since each ends up
with `safeHeight × (its share of what the scene asked for)`. `harmoniseUnits`
below then tidies a remainder instead of rescuing a frame.

**And a band is never larger than what its stack can DRAW, which is not the same
number as what it wants.** An appetite is a want; `shapeCeiling` is where a run of
type stops growing, because a word is bounded by its MEASURE and not by its box —
`RELIEF` in display type across 906 px is 195 px of type and there is no taller
version of it that keeps the word whole. For one pass the two were read as one
number, so a measure-bound stack asked for a band on its appetite and then drew a
fifth of it, and the four fifths came out of the blocks beside it, which had a use
for them. `waterFill` caps each band at what its stack can draw and hands the
surplus to the bands that can spend it, by the same weights, repeated because
giving a track more can push it over its own ceiling in turn.

**When no band can spend it, the empty frame is the DOCUMENT's.** That is the rest
of the answer to the 9:16 witness this pass was given: an `extrudedType` with the
word `RELIEF` alone on a portrait frame draws 7% of its height, and no
arrangement of boxes changes that. A line of type has an aspect ratio — chars ×
advance wide, one leading tall — and a 9:16 safe area has another; only one of the
two can be filled, and `fills: 'either'` already says which axis is the content's
business. Making the type larger needs the word broken, which `wordCeiling`
refuses because a rendered frame said what that looks like, or the margin a feed
draws its own interface over. There is no third lever.

So what the layout owes is not a rescue, it is that nobody is CHARGED for the air:
the block's box is its own extent, so `BOX_FILL_FLOOR` is measured against
something real; the band is bounded by what can be drawn in it, so no neighbour
pays; and the frame around it belongs to the ground. `composition.test.js` states
that as arithmetic rather than as prose — the same shape solved in a box ten times
as tall answers the same unit, which is the proof that the height was never what
bound it.

**And a band is never larger than what its stack can DRAW, which is not the same
number as what it wants.** An appetite is a want; `shapeCeiling` is where a run of
type stops growing, because a word is bounded by its MEASURE and not by its box —
`RELIEF` in display type across 906 px is 195 px of type and there is no taller
version of it that keeps the word whole. For one pass the two were read as one
number, so a measure-bound stack asked for a band on its appetite and then drew a
fifth of it, and the four fifths came out of the blocks beside it, which had a use
for them. `waterFill` caps each band at what its stack can draw and hands the
surplus to the bands that can spend it, by the same weights, repeated because
giving a track more can push it over its own ceiling in turn.

**When no band can spend it, the empty frame is the DOCUMENT's.** That is the rest
of the answer to the 9:16 witness this pass was given: an `extrudedType` with the
word `RELIEF` alone on a portrait frame draws 7% of its height, and no
arrangement of boxes changes that. A line of type has an aspect ratio — chars ×
advance wide, one leading tall — and a 9:16 safe area has another; only one of the
two can be filled, and `fills: 'either'` already says which axis is the content's
business. Making the type larger needs the word broken, which `wordCeiling`
refuses because a rendered frame said what that looks like, or the margin a feed
draws its own interface over. There is no third lever.

So what the layout owes is not a rescue, it is that nobody is CHARGED for the air:
the block's box is its own extent, so `BOX_FILL_FLOOR` is measured against
something real; the band is bounded by what can be drawn in it, so no neighbour
pays; and the frame around it belongs to the ground. `composition.test.js` states
that as arithmetic rather than as prose — the same shape solved in a box ten times
as tall answers the same unit, which is the proof that the height was never what
bound it.

**`full` is the safe area, not the frame**, and two `full` blocks share it. A
field that bled to the frame's edge would be a map cropped by overscan and a
gallery whose bottom row sits under a caption box — the two failures the margin
exists to prevent, arriving through the one anchor that opts out of it. It is
painted first, under the nine cells, because a map or a wave is what an element
sits *on*.

**And a field claims every band, because the tracks a collapse drops have to be
EMPTY.** A lone block takes the whole measure because nothing is beside it and the
whole height because nothing is above it; a block anchored `full` makes the second
half of that false, since it is painted over the whole safe area under the nine
cells. It occupies no cell, so the collapse could not see it: a scene of one
`equalizer` and one `kicker` handed the kicker the entire safe area and rendered a
surtitle as 200 px of capitals across the graph it was the surtitle *of* — the
smallest role in the scene as the largest element in the picture. With a field on
the frame the bands are the grid's own three. The columns still collapse, and that
asymmetry is the difference between the two axes rather than a taste: a box's
height is what sets the type SIZE and its width is what sets the MEASURE, so a
line that runs the full width of a field is a line doing what a line over a field
should do, while a block that takes the whole height is claiming to be the scene —
and the field was the scene. A field that is a scene's ONLY block still gets
everything, which is the case the fix had to leave alone.

`tests/video-composed-frame.test.js` is where those become claims rather than
prose: over the poorest document the schema accepts and one that uses all ten
zones, in all three ratios, every block is placed exactly once, every box — the
zone's and every block's inside it — is inside the safe frame, every block has
arrived by the end of its scene, and the last frame differs from the first.

#### A block inhabits the box it is given

Six real exports were rendered and looked at, and what they showed was one defect
wearing three costumes. A block drew at a fixed fraction of the FRAME and ignored
the box it had been handed: `equalizer` was `base * 0.18` whether it had been
anchored `center` or `full`, so a field occupied 18% of the height of a frame it
had been given all of. A `typewriter` alone in a scene was a small line of text in
the middle of a black frame; a `counter` alone was an eighth of the picture. Every
scene was a small element floating in a large void — which is what the user had
been calling "rudimentary" from the first export onwards.

The rule is at the top of `composition.js` and it is three sentences. **One box
per block**, published by `composedLayout` at `zone.layers[i].box`, never the
zone's box repeated — that alone is the third costume, since eight `solidScene`
blocks anchored `full` were eight canvases of 589 px, 4712 px of content inside
950 px of safe height. **Every size a block draws comes off that box.** And the
one legitimate use of the frame's own dimension is a **constant metric**: a
quantity that must be identical from one scene to the next because a viewer reads
it as the same object. There are exactly three — a hairline's thickness, a corner
radius, the grid's own gutters — they are named in `CONSTANT_METRICS`, and each is
bounded at a quarter of the box it is drawn in, because an exception with no
ceiling is the rule going back out of the window.

**A zone is divided by appetite, never by count.** A vertical stack of N blocks in
a zone of height H does not divide into H/N, because a title wants height and a
rule wants almost none: split evenly, a `separator` above a `heading` takes half
the column for three pixels of ink. `BLOCK_APPETITE` is the one table that says
what each kind is made of, in units of the body type size — the text runs, which
are wrapped against the measure the zone turned out to have, and the furniture
that is not type. The tiers are argued in the table itself, and the first version
answered the wrong question with them. "Below what height does this stop being
what it is" is a FLOOR — four lines for a motif of bars, six for a plot, nine for
a picture — and a floor is the right number for sharing a column and the wrong one
for owning a frame. A field's appetite is also the exchange rate between a box and
a type size: a `barChart` worth 6.4 units filling a 950 px safe area declares one
body line to be 130 px, so its own axis labels came out at 85 px, a row of
`L M M J V S D` set as large as a headline, and a `kicker` standing on the chart
inherited the same scale. Three real exports showed it and the user's word for all
three was "rudimentary".

So the field tier is what a field is worth when it IS the scene, and the number
behind it is a density: **a frame that carries twenty lines of running text is a
frame, and one that carries ten is a poster.** Twenty-two units across a safe area
is a body line at about 4% of the short edge and a caption at 2.7% — the surtitle
the house has always drawn. The order is the floors' own, so nothing about how two
fields share one column changed: 10 to 13 for a wave and an equalizer, 15 for a
carousel and a dial, 16 for a chart, 22 for a map, a gallery, a picture and a lit
solid.

**And there is one type scale.** `headingSize`, the counter's figure, the
typewriter's line and the wordmark used to be four fractions of `base` decided by
four authors, which is how a `counter` and a `heading` stacked in one zone came
out at 0.13 and 0.042 of the short edge — the figure crushing the title by a
factor of three in a frame nobody had asked for that emphasis in. Now a role is a
STEP on one scale (`TYPE_ROLES`: display, title, body, caption, figure, in the
ratios the catalogue already had), and the unit those steps multiply is solved per
STACK against its zone rather than read off the frame. Two blocks in one zone
therefore read one unit, and the ratio between them is a ratio between two steps.

Solving it needs to know where a line will break, which is a measurement a
Remotion bundle cannot make before it has laid out and a test cannot make at all.
It does not have to: the container installs one font family, so the average glyph
advance is a known number — `MEAN_GLYPH_EM`, 0.52. That is not a new constant
either. It is the one `verticalCaptionSize` was calibrated on by hand, recovered
from its own two ends and now written down once, with the test that keeps the two
agreeing. The size is then the largest one whose wrapped lines still fit the box,
which is `verticalCaptionSize`'s lesson generalised: a size tuned so the longest
legal caption fits renders every short one at the size a long one needed, and the
box is what does that arithmetic now instead of a ramp between two character
counts.

#### A word is not cut in half

An export was rendered and photographed: `NEUF SEIZIEMES`, in display type on a
9:16 frame, reading `NEUF S` / `EIZIEME` / `S`. It is the worst thing this feature
can put on a screen — every other defect in this document reads as a small
heading or a timid frame, and this one reads as broken software.

**The cause is that `word-break: break-word` was mistaken for the wrapping
model.** `textLines` packs characters against a measure, because that is the only
wrapping an estimate with no browser in it can predict, and the declaration was
put into every block so that a browser would do the same thing. It does not: CSS
puts an over-long word on a line of its OWN and breaks INSIDE it only when it
still does not fit. So the estimate found a size at which fourteen characters fit
two lines, `SEIZIEMES` did not fit one of them, and the browser did the only
thing left to it. The declaration was right about what a browser does and wrong
about what an eye reads.

The typographic rule is the other way round: **a word does not break, so the size
must be small enough for the longest one to fit the measure.** That is a bound,
exactly like the one an unbreakable run already puts on a shape, and it is one
bound in `composition.js` (`wordCeiling`, folded into `shapeCeiling`) rather than
a rule in twenty-seven components. The panel family keeps its own call to it,
against the width a card has left after its padding, which is the one thing about
it that is local.

**Two things had to move with it, and both were latent defects rather than
concessions.** A run was measured at the flat sentence average whenever it
wrapped, and `NEUF SEIZIEMES` really sets at 0.73 em a glyph — so a bound
computed on 0.52 would have been a bound that changed nothing, and the line count
was wrong by the same 40% before anybody asked about words. `runAdvanceEm` now
measures every run on its own glyphs; `meanAdvanceEm` is floored at
`MEAN_GLYPH_EM`, so an ordinary sentence answers exactly what it answered before
and the only runs that move are the ones the average was wrong about. And
`textLayout` scaled its furniture and its air by the unit it was HANDED while
counting its lines at the unit the shape could SPEND — identical while the four
text kinds had no ceiling, and two different blocks the moment they had one.

**The floor is where this stops, and what happens under it is a decision rather
than a fallback.** A word can be longer than its measure at every size worth
reading: a URL, a German compound, an identifier, or seventy characters of
heading with no space in them, which is what the schema lets a document write.
The answer cannot be a unit tending to zero. So the bound stops at
`WORD_FIT_FLOOR_PX` — which is `BOLD_LARGE_PX`, the same 18.66 px
`harmoniseUnits` floors its own lowering at, because it answers the same question:
`palette.accent` and `palette.display` are resolved at the 3:1 floor the audit
licences for bold type past that bar, and a bound that took a run under it would
have bought an unbroken word with the licence the colour was chosen under. Under
the floor the run is **not bounded at all** — the block goes on filling the box
its zone gave it and `word-break` breaks the word, which is why every wrapping
kind still carries the declaration and `blocks.test.js` still requires it. Paying
type for a word that would break anyway is `texturedGround`'s rule about a
decoration applied to the scale: it yields to a word, and it never yields for
nothing.

**And `BOX_FILL_FLOOR` had to be restated rather than dropped.** A block bounded
by its own word fills its MEASURE exactly — that is what the bound says — and
what it gives back is height. On the kinds whose row claims both axes that is a
box less full than three quarters, and it is an honest consequence rather than a
regression: the alternative on offer is the word cut through the middle. The
catalogue sweep is unchanged for every corpus written in words; the degenerate
sweep is where the reformulation is checked, one block alone in each of twelve
boxes across the three ratios, with every legal string rewritten as a single word
of the same length.

`composition.test.js` holds all of it: the whole catalogue at both ends of the
schema in all three ratios, where no drawn word crosses its measure; the
degenerate corpus, where the three branches — bounded, measure filled, floored —
are each reached at least once, so that neither half can go vacuous; and the
bound itself, where doubling a measure doubles it, which is why it takes no
absolute allowance for `typeSize`'s rounding. That allowance is `LINE_SAFETY`'s
six per cent instead, and the tests spend it explicitly rather than assuming it.

**And a role is a notion of the SCENE, not of the stack it was solved in.** Per
stack was the right denominator and the wrong scope, and the next export said so:
on a scene of eight blocks, `DENSE` — a `kicker` alone in its column, sized
against a column nothing else was in — came out three times the height of the
`heading` in the column beside it. A surtitle three times its own title is the
crushing above with the two blocks in two zones instead of one, and it is what an
eye reads as wrong however defensible each half of the arithmetic was.

The repair is not one unit for the whole scene. Two zones have two measures and
two heights, and a narrow column MUST be allowed to compose smaller — that is what
"a block inhabits the box it is given" means, and a scene-wide unit would be the
smallest zone's answer imposed on the frame, which is the void this pass removed
coming back through the scale. What is shared is the ORDER: `harmoniseUnits`
lowers a stack until it is inside it. It only ever shrinks, a lone stack is
returned exactly as `solveTypeUnit` answered it, and a stack already inside the
order pays nothing.

Bounding the drawn SIZE was the first version of that and it kept the letter of
the order while losing its point: a caption was allowed to be exactly as large as
a title elsewhere, and two runs of the SAME role were never compared at all. Both
came back in one export — `DENSE` at the identical cap height to the headline
beside it, and a `logoType` in a corner at 140 px against a 41 px `heading`, two
`title` runs in one frame at three and a half times each other. `TYPE_ROLES` says
why the first is wrong in a line: a surtitle that is not smaller than the line
under it is not a surtitle. So there are two bounds now, and they are different
questions:

- the ORDER, on the drawn size, for a strictly superior role. It has to stay,
  because a superior run held back by its own measure still draws what it draws;
- the SCALE, on the UNIT, for a role at least as high. A caption then lands at
  0.65/1.55 of that title, where the scale puts it, and two `title` runs in one
  frame are one size.

Two clauses hang off that. **A field is the scene, so the words laid on it read at
the field's own scale**: a block anchored `full` belongs to no band, which leaves
a cell zone solving against a third of the safe area with nothing to be compared
with — the 122 px `SIGNAL` over an equalizer, again — so the field's unit is the
ceiling for everything stacked on it. And **the lowering stops where the INK's
licence does**: `palette.accent` and `palette.display` are resolved at the 3:1
floor, which the audit licences for bold type past `BOLD_LARGE_PX` (18.66 px), so
the scale bound has a floor there. The order bound has none — an inversion is not
a quieter scene, it is a wrong one — and neither may raise a stack above what its
own box allowed.

Two things it deliberately does not do. It compares a stack with OTHER stacks and
never with itself, because a stack already agrees with itself and the one way it
can still invert internally is a per-block measure ceiling — correcting that would
mean lowering a whole zone below what its box allows, which is the guarantee the
box arithmetic exists to give. And it cannot leave a block floating in its
allotment: a block's box is what it DRAWS at the unit its stack ended up with, so
lowering a unit lowers the box with it and the leftover goes back to the zone,
where the alignment spends it.

Two things a document may still ask to be smaller, and they are named:
`solidScene.size` and `separator.extent`, both closed enums of three shares. A
`small` solid fills 42% of its box because somebody wrote `small`, and refusing
that would be the layout overruling the document.

`composition.test.js` is what makes this a rule rather than a paragraph.
`blockExtent` is pure — a box in, the dimensions a block draws out — so doubling a
box has to double every one of them, and the hairline is the only thing that does
not move. What it draws has to fill at least three quarters of its box on the axis
its own row claims (`BOX_FILL_FLOOR`), which is measured rather than chosen: a
sweep of twenty-seven kinds, each at both ends of what the schema allows, across
twelve box shapes in all three ratios, puts the worst case at 0.82, and nothing
can do better in general because a line count is an integer. And the box a block
is given has to be exactly what it draws in it — two computations from opposite
directions, `stackIn` solving a unit for a stack and `blockExtent` answering for
one box, which is what would catch a weight table drifting from the type scale.
The order between roles is held over the same corpus one level up: scenes covering
the ten zones, one to eight layers, spread across cells, stacked two to a zone and
laid over a field, in all three ratios — no run larger than a superior one, and
every box still filled, which is the guarantee a scene-wide cap is exactly the
sort of thing that would quietly undo.

The one exception to "everything comes off the box" has one implementation, and it
had three: `constantMetric` was written in `interface.js`, in `media.js` and a
third time in `dataFigures.js`, from one paragraph by three authors. The three
agreed on every box anybody had thought about and disagreed on the degenerate
one — one answered 0 and one answered the requested size unbounded, with a test
pinning the second, so a divergence nobody had decided read as a decision somebody
made. It lives in `composition.js` now and the three families read it; a 0×0 box is
a box with no room rather than a licence, and an ABSENT box is the different
question `hairline` splits on for the same reason.

#### A subject takes the scene, a piece of furniture takes its part

"A lone block is the scene" was paid for by the whole pass above, and it is right
about a picture, a chart, a headline and a quote: anything less than the frame is
the small element in a large void coming back. A rendered frame showed the seven
kinds it is wrong about. A `lowerThird` alone over a photograph became a
**full-frame card hiding three fifths of the picture**. A name band is not a scene
about a name.

**The distinction is not how much text a kind carries — it is where its size comes
from.** A subject is dimensioned by what is around it: give it more room and it is
a larger version of itself, which is exactly what the box arithmetic is for. A
piece of furniture is dimensioned by the FORMAT. A broadcast lower third is a sixth
of the frame because that is what a lower third *is*, and one that fills the frame
is not a bigger lower third — it is a card. The test is a sentence anybody can
apply to a twenty-eighth block: does this get larger when the scene does, or does
it only get wrong?

`BLOCK_FURNITURE` names the seven, and each classification is a sentence.
`lowerThird` is the case that made the rule: its whole grammar is that something
else is behind it. `kicker` is a surtitle, which is a surtitle *of* something — it
was already 200 px of capitals over a graph, and the field ceiling only closed that
when a field was on the frame. `dateStamp` is a stamp: one line, small, in a
corner. `separator` is a rule whose thickness is already a constant metric, so a
whole frame of it buys nothing but air. `progressBar` is a meter, and it reads as a
proportion of something that is never the frame. `notification` is a toast — an
object that arrived over whatever was there — and at full frame it is a card that
has lost the thing it was notifying about. `button` is a control sized to be
pressed; one that fills the frame is a coloured slab with a word on it.

The ones deliberately left out matter as much, because a rule is what it refuses to
cover: `heading`, `funTitle`, `quote`, `typewriter`, `counter`, `logoType`, `form`,
`codeBlock` and every field stay subjects. A title card, a pull quote, a number, a
wordmark and a sign-up form are all scenes somebody meant to make. `logoType` is
worth naming twice, since a wordmark in a corner is furniture in every ordinary
sense — but a wordmark alone on a frame is a title card, while a name band alone on
a frame is a mistake, and what keeps a corner wordmark beside its neighbours is
`harmoniseUnits` rather than this table.

**What it costs is a bound on the unit, and only where nothing else is in the
stack.** `furnitureCeiling` divides the safe height by `SCENE_UNITS` — 22, which is
not a new number but `BLOCK_APPETITE`'s own field tier, the density behind "a frame
that carries twenty lines of running text is a frame, and one that carries ten is a
poster". A `lowerThird` worth four of those units draws four twenty-seconds of the
frame, which is a band. Three properties make it a tidy-up rather than a second
layout engine:

- it bounds the UNIT and not the box, for `harmoniseUnits`'s reason — `stackIn`
  recomputes the heights at whatever unit arrives, so the block still *fills* the
  box it ends up with and the leftover is spent by the zone's own alignment;
- it is measured against the SAFE AREA and never against the zone, because the
  whole claim is that furniture is sized by the format: a band in a third of a
  frame and a band alone on one are the same band;
- and it applies to ALL of a stack or to none of it. The unit belongs to the stack,
  so lowering it for a `kicker` above a `heading` would set the headline at a
  surtitle's scale — and a mixed zone was already right for another reason, since
  `stackIn` divides it by appetite.

Two clauses hang off it, and both are the same sentence: **a block sized by the
format sets no scale for anything else.**

Furniture anchored `full` is **not a field**. `harmoniseUnits`'s field ceiling says
"the field sets the scale of the scene", and a `lowerThird` anchored `full` capping
every heading in the frame to a band's own unit is that read backwards. It is still
held to its share, and it still claims the bands, because it is still painted under
the nine cells.

And a stack of furniture is **not evidence about the scale**, so `harmoniseUnits`'s
SCALE bound skips it. That bound — no stack reads a larger unit than a stack
carrying a role at least as high — assumes both stacks were sized by their boxes,
which `furnitureCeiling` breaks on purpose: a `barChart` anchored `full` beside a
`kicker` was pulled from 56 px to 43 and drew three quarters of a safe area it had
all of, which is the void this whole pass removes arriving through the one door that
exists to keep surtitles small. The ORDER bound deliberately still applies, and the
asymmetry is the difference between the two questions: "two stacks of one scene read
one scale" is about a scale furniture does not participate in, while "no run is
drawn larger than a superior run" is about what an eye reads on the frame, and a
body line larger than the title of the band beside it is an inversion whatever made
the band small.

#### A field is not a uniform surface: it says where it sets type

The next export put a `kicker` anchored `bottom-center` over a `barChart` anchored
`full`, and the surtitle landed **exactly on the chart's row of axis labels**: two
runs of type in one band, three labels unreadable. Both were at the right size — the
field ceiling and the weighted bands had done their work — so the conflict was
purely positional and nothing about the scale could have caught it. "A `full` block
is what an element sits on" was true about the paint order and silent about the
geometry.

**The field declares, and the cell does not move.** The other repair on offer was
to push a cell laid on a field towards a band the field leaves free. It is cheaper
and it is wrong twice over: it would MOVE a block the document anchored — `anchor`
is the one composition decision a document makes, and a bottom-centre kicker
relocated to the top is a film that did not do what it was told — and it has to
guess, because only the block knows where its own caption goes. A rule written in
the layout would be right about `barChart` by luck and about the twenty-eighth kind
not at all. Declaring costs one table and one number per scene, and what it buys is
arithmetic: the cells are laid out in the safe area LESS the band the field
reserved, so no cell box can enter it.

`FIELD_FOOT` is that table, and all three entries are a FOOT rather than a mixture
of edges. A caption goes under the thing it captions: `barChart` and `lineChart`
set their labels under the plot, `imageFrame` its caption under the picture — three
components written by three hands, all three with the run last in a column. So
there is one edge and not two, and a kind that one day sets type at the top of its
box is a new question rather than a new row, since it would need the stack pinned
the other way and one stack cannot be pinned at both ends.

**The entry condition is `fills: 'both'`, and `clock` is why it is written down.** A
block can only promise where its foot is if it fills its box on that axis. A dial is
round: it fills the minor axis and floats in the middle of the other, so a
full-frame `clock` on a 9:16 export is 907 px of dial inside 1305 px of safe height
with its label 175 px above the bottom of its own box. A band reserved at the edge
would be a band reserved where nothing is drawn.

Three things make the subtraction exact rather than nearly exact. It is the **last**
block of the `full` stack that is measured, because that is the one whose box ends
on the safe bottom. The unit is the field's own, solved before `harmoniseUnits`,
which only ever lowers it — so the band reserved is never shorter than the type that
lands in it. And the field is **pinned** to the edge it declared (`justify:
'flex-end'` instead of the symmetric leftover a `full` zone otherwise keeps),
because centred, a field whose unit was lowered would draw its caption above the
band the cells were kept out of, and the reservation would have moved the defect
instead of removing it. One gutter of air is added — the grid's own, the same
number that separates any two zones — which is also what covers a picture block's
margin under its caption, `TILE_GUTTER` being four tenths of it.

**The case this must not break is a field with no text**, and it is checked as an
equality rather than as a number: a chart whose document named no labels, a gallery,
a solid, a field of particles or a map reserve nothing and lay out exactly as they
did before the declaration existed. The reservation is bounded at a quarter of the
safe area (`FIELD_FOOT_CEILING`) for the reason the constant metrics are bounded at
one: an exception with no ceiling is the rule going back out of the window, and a
cell with no height is a stack solved at a unit of zero (Q1). It over-reserves in
two directions on purpose — `labelBand` shrinks a chart's labels to fit one column
and drops the row entirely below `LABEL_FLOOR` — because a band a little taller than
the type that lands in it costs a cell a few pixels, and one too short is the defect
back.

**And it does not extend to a subject in the middle**, which is the reading the
next export invites: a heading straight across the equator of a `full` globe looks
like this defect one notch up, a field whose SUBJECT is in the way rather than
whose CAPTION is. Three properties of a foot are what make the subtraction work,
and a subject has none of them. A foot is at an EDGE, so what the cells get is one
contiguous run and `split` lays the bands over it; a `fills: 'minor'` block sits in
the middle of its box on both axes, so reserving it leaves two disjoint remainders
and a stack cannot be laid out in a hole. A foot is declared by a block that FILLS
the axis it reserves on — the stated entry condition, and `clock` is the case
already excluded for exactly this reason. And a foot is a twentieth of the frame,
where a globe's square covers all three rows of a 16:9 safe area, so the
reservation would leave the cells nothing at all: a refusal, where this feature
degrades (Q1).

Three repairs exist and two are already ruled out. Moving the CELL is out —
`anchor` is the one composition decision a document makes. Shrinking the subject
buys nothing, since it stays centred and a smaller globe is a smaller globe with
the same line across it. What is left is moving the SUBJECT, the only one that
takes nothing from the document, because `full` is the one anchor that names no
position; it is open, and its condition is that the grid rows no cell holds are
CONTIGUOUS, which a `center` cell is precisely what they stop being. Until then the
arrangement is the one `globe.jsx` says it was written for — "the words that belong
to a globe are a `kicker` or a `heading` anchored over it, measured against a
surface `composedPalette` resolved with the field in it" — and what made the
reported frame read as broken was not the word on the sphere but the arc bundle
sliced off behind it, which is `globeShell`'s defect and is fixed there.

`composition.test.js` holds it against the BLOCKS' own layout functions rather than
against the reservation: `barChartLayout`, `lineChartLayout` and `imageFrameBox` are
what really decide where a caption lands, so asking `composition.js` for both halves
would have been a test agreeing with itself.

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
bare ground when the field READS it**, not on the fielded surface: measured against
a field made of itself it cannot clear, falls through `accentFirst` to a near-white,
and — because `globe`, `equalizer`, `soundWave`, `map` and the two flat charts paint
`palette.accent` **itself** — republishing that run in the fallback ink repaints the
field in it. The first version of this fix came back with grey bars behind a grey
headline: legible, the project's colour gone, and the surface measured no longer the
surface painted.

**That is one case, and for two passes the code had it as the general one.** A
surtitle over a field the accent does not paint was measured on the bare ground
too, and four rendered frames say what it costs: a `kicker` over a `gallery` at
**1.03:1**, over a `carousel` at 2.46:1, over a `waveMesh` at 1.36:1, over a
`solidChart`'s plinth at 1.27:1, against a floor of 3. So the ornament a scene
publishes is resolved a second time, on the surface that WON — never as a request
inside the ladder, which would step the density down so a surtitle could keep its
colour, the exact trade `accentRun`'s locked veil refuses. The test is whether the
field READS the run, not whether it happens to be the same colour: `waveMesh`,
`solidScene`, `solidChart` and the two picture stages read `palette.solid`, whose
material is resolved from the plain accent and never republished, so there is no
loop to protect them from. The gap that is left is the real one: accent TEXT over
a field painted in `palette.accent`. And the density is an
opacity on the **zone**, not a colour handed to five components: `full` is the only
thing that makes a block a field, so the rule lives where `full` means something
and the twenty-eighth block cannot forget it. `palette.groundTint` is what the
composition paints and `palette.ground.tint` is what was measured — they differ by
exactly the field, and reading the second in `Ground` would paint it twice and take
a gradient's far end off the accent.

**A field is measured as what it PAINTS, and "the accent" was a guess that held
for five blocks out of six.** `equalizer`, `soundWave`, `map`, `lineChart` and
`barChart` paint the accent as a run or as a fill, which is what the boolean
version of this measured on everybody's behalf. `solidScene` paints a lit solid in
a colour of its own at two brightnesses, and an export showed both halves of the
omission at once: `field.alpha` walked its whole ladder against an accent nothing
on the frame carried, so it dimmed the object without ever helping the word, and
the frame came back a flat grey torus behind a title. So `FIELD_PAINTS` maps a
`full` block to what it puts on the frame, `fieldPaints` answers with the SET a
scene paints — deduped and in a fixed order, because that answer is also the
palette cache's key — and `composedPalette` samples those colours. A solid is two
of them: every Lambert face lies between `material` and `material × ambient`, so
its two ends measure every face, which is `solidShading`'s own proof reused one
layer out. Its material is resolved on the BARE ground for the reason the accent
run is: the field is what is being measured, and a colour taken from the pass that
includes it would be a fixpoint rather than an answer.

**A PHOTOGRAPH IS NOT A COLOUR, SO IT IS BOUNDED AND NEVER MEASURED.** The
paragraph that used to be here said the remaining gap "needs a picture, not a row
in a table", and it was wrong about which row. `gallery`, `carousel`,
`imageFrame`, `photoStage` and `photoRing` anchored `full` paint photographs, and
a surface nobody in this process has opened cannot be measured — but it can be
BOUNDED, which is a thing this file has done since the first export. An `image`
GROUND is measured at the two extremes a veil can composite an unknown picture
to, black and white, and the veil rises until both ends clear. `picture` is that
same answer moved one layer in.

An export made it urgent, and it is the plainest scene in the catalogue: a
`heading` over a `photoStage` anchored `full` — the thing a model writes most
often — measured the panel's BODY and never the picture on it, so white type
crossing pale wood shipped at 1.68:1 against a display floor of 3.

Two mechanics, and each was got wrong once before it was got right. The picture
enters as two tint LAYERS — black at the field's density and white at the field's
density — and not as an alpha on the ground: a `photoStage` puts a lit body AND a
photograph on the frame, beside each other, so taking the picture out of the
ground's alpha veils the body through the picture as well, and the pair composed
down a whole rung of density for nothing. Two grounds in one list is a union; an
alpha is a product. And there is no `FIELD_RAMP` on it, unlike every other paint:
a `map` draws its dots at full strength and its links at a fraction, while a
photograph is an opaque picture at ONE opacity whose content black and white
already bracket.

What cedes is the density, and it cedes because a decoration cedes to a word —
the sentence `FIELD_ALPHAS` was written under. The two ways of getting that trade
wrong are both in this document already: ceding density to the last rung
FANTOMISES the picture, and a band drawn over it to carry the words is the
`lowerThird` that came back as a card hiding three fifths of a photograph. What
settles it is the rung the ladder actually lands on, which is a measurement: over
the dozen real directions `composition.test.js` sweeps, a stack over a picture
field composes at 0.4 — MORE of the photograph than the same theme keeps on an
`image` BACKGROUND, whose veil `legibleOn` walks from `COMPOSED_IMAGE_VEIL` up to
0.7 to carry the same two runs. This feature has shipped photographs at three
tenths since its first export and nobody has called them ghosts.

One clause is not a detail: the veil is LOCKED for a picture field. A picture
block is painted OVER the ground and over the ground's own veil, so raising that
veil buys a run standing on the picture exactly nothing, and `sharedSurface` would
publish a contrast the frame does not have. The levers left are the ink, which
`legibleOn` still walks in full, and the density.

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

**`ground` is the term where "the composition draws it" is not a fact about the
document.** All three animated grounds move by moving the ground's second layer,
and that layer YIELDS: `texturedGround` drops it when the bare ground carries
every run and the tinted one does not, and `fieldedGround` drops it once the field
has run out of rungs. A decoration cedes to a word — and the frame it cedes on is
a flat colour with a `ground` progress running 0 → 1 over it. Whether it survives
is a legibility answer, so it needs a theme, and `sceneMotion` has never been
given one; the composition passes down what it is actually painting
(`groundPainted`, which `Ground` reads for the same decision) rather than the
motion guessing. It is theoretical on today's corpus — six grounds across a dozen
real directions and the tint survives every one — which is a statement about the
corpus and not about the next direction somebody writes.

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

### Two ornaments a rendered corpus caught

Neither is a legibility failure and neither is a bound anything could have checked.
Both are the kind of defect that only exists on a frame, which is why twelve
documents get rendered and looked at rather than reasoned about.

**A rule follows the edge the document chose.** Four blocks — `heading`, `kicker`,
`quote`, `textHighlight` — draw a rule across their whole box and reveal it with a
`scaleX`, and all four had `transform-origin: left`. In a `top-left` zone that is
the house device and it is handsome. In a centred one it is a rule flush against
the left margin under type sitting in the middle of the measure, and on the stack
of three (`kicker`, `heading`, `separator`, all `center`) it put that rule directly
above a `separator` the flex row *had* centred: two ornaments in one column
disagreeing about where the margin is. The zone now publishes its answer as
`--mocky-rule-origin`, inherited, and it is `textAlign`'s own value rather than a
second table — `left`, `center` and `right` are the three things `TEXT_OF` produces
and the three keywords `transform-origin` takes, and they answer the same question.
A CSS custom property because a block cannot read an inherited `text-align` from
JavaScript, and inheritance is what keeps this out of the props contract every
block is written to. `quote` keeps `left` on purpose and says so: its rule grows out
of the quotation mark beside it rather than across an empty measure, so an origin
taken from the zone would detach it from the glyph it is attached to.

**A shadow needs a second colour, and one direction has none.** `funTitle`'s `stack`
treatment draws the word twice, the copy behind it in `palette.accent`. On a
direction stating the same dark green for `text` and for `accent` over a near-black
ground, `legibleOn` resolves *both* runs to `#ffffff` — correctly, on its own terms —
and `MOTION` came back as two white copies of itself seven per cent apart: a word
that reads as a printing fault rather than as a title. `funTitleShadow` now takes
the two inks and returns zero when they are one ink. The floor, `STACK_SEPARATION`,
is just past "the same colour" and deliberately nowhere near a legibility bar: the
copy carries no glyph anybody reads, a luminance ratio cannot see the hue
difference that makes a gold shadow behind a white word obviously a shadow (1.76:1
on the editorial direction, and correct), and a 3:1 test would delete the treatment
on most themes that render it perfectly. A caller that names no inks keeps the
answer it always had.

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

("The direction" is one of **two** places a declaration can come from — see *A
colour asked for in the brief comes before the project's dossier*, below. What
never changes is that a colour nobody stated reaches nothing.)

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

### A colour asked for in the brief comes before the project's dossier

The rule above says the theme carries what was **declared**, and for a while
"declared" meant one document. It should not: the distinction it was really
making is *the user stated it* versus *the model guessed it*, and a brief that
says "texte blanc sur fond noir" is a statement by the same person the DESIGN.md
came from — more recent, more specific, and about this film rather than about the
product in general. So `src/lib/video/briefTheme.ts` reads the brief, and what it
finds wins.

**Token by token, never whole.** That is what priority means here: a brief that
names a ground has said nothing about the typeface, and throwing the project's
away would make asking for one colour cost every other one. `mergeFilmTheme`
overlays the brief's colours on the direction's theme and hands the result to
both doors unchanged — the same `theme` field, the same `attachTheme`, the same
`RenderTimelineSchema`. **Nothing about rule 9 moves.** The model still cannot
write a theme, `VideoTimelineSchema` still has no such key, and nothing of either
source reaches a prompt.

**The extraction is the design system's own.** `designTokens.ts` already finds
colours in prose and has been corrected twice by real documents — a background
inferred from an empty pool, a label regex eaten by Markdown emphasis. A second
reader here would have been a sixth hand-kept mirror in a module that already has
five, so `briefTheme.ts` does the one thing the existing one cannot: it turns
French and English prose into the `- Label: #hex` grammar `parseColors` was
written for, and then calls `themeFromDesign` on it. Role resolution is
`roleForLabel`, the hex charset is `ThemeColorSchema`, "declared" is
`parseDesignSpec.stated`. One implementation, reached through one door.

**A name is a declaration; the shade is Mocky's, once, in code.** Nobody types
`#c0392b` into a brief — they type "en rouge et noir" — so a closed table maps a
colour word to one hex, bilingual, with the feminine forms in it because French
agreement is not optional in prose. That hex is a choice, and it is the same kind
of choice as `THEME_FALLBACK.accent`: made once, in a file under review, and
visible in the result. `or` is deliberately absent while `doré` is present: as a
bare word it is one of the commonest conjunctions in written French, and a table
that fired on it would paint a film gold because of a sentence about something
else. A modifier — "foncé", "dark" — moves the named colour toward black or white
by one constant rather than by a second table of hexes, so "vert" and "vert
foncé" cannot drift onto unrelated greens.

**A role is never guessed.** "En rouge et noir" states two colours and no roles,
and this reads **nothing** from it: which of the two is the ground is exactly the
guess that burns an unseeable colour into a film. A colour counts only when the
brief also says what it is for — a role word within three words behind it or two
ahead ("fond noir", "white text"), the word `sur`/`on` immediately before it, or
the `X sur Y` idiom that names both at once. The window stops at a clause
boundary, comma included: "black background, white text" put a role word one word
behind a colour belonging to the next phrase, and read backwards it painted the
ground white. A colon is not a boundary, because "Fond : noir" is a person
stating a token.

**And the panel says which roles it understood,** in the line under the swatches.
That is not a courtesy: a reading nobody is shown is indistinguishable from a
request that was ignored, and the whole point of taking nothing from an ambiguous
sentence is that the writer can fix it in one edit. The sentence names the roles
and shows how to state one; the swatches above already say the colour.

**A brief's ground can meet a dossier's ink, and that is safe rather than
lucky.** A cream direction's near-black text over a black ground somebody just
asked for is a pair no design document moderated. It is the case the next section
exists for: `resolveTheme` pairs whatever is left unstated, every run is measured
against the surface it is really painted on, and one that cannot clear its floor
is degraded rather than failing the export ([Q1](architecture/invariants.md)).
The corpus in `composition.test.js` carries that exact request — a dark green on
black — so the guarantee is swept across all five palettes rather than argued.

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

### 3D is a second permission, and it narrows the first

An administrator can also decide **who may put a 3D block in a film**. It follows
the template above rather than inventing one — the same two modes, the same
"a list is replaced, never merged", the same absence of anything secret — and it
lives beside it in `server/video/config.js` as `threeDAccess` and
`threeDAllowedUserIds`, with `videoThreeDEnabledFor()` for the question.

**It asks `videoEnabledFor()` first.** That line is load-bearing: a 3D permission
granted to an account that cannot export at all is a right to nothing, and two
lists read independently is how an instance ends up with a "yes" nobody can act
on and an administrator debugging the wrong checkbox. It also means the two rules
the export permission earned are inherited rather than re-argued — the master
switch closes this too, and an administrator is still not allowed on their role
alone, so 3D renders keep appearing against a name.

**Its default is `all`, and it is the one default in that file that is not the
closed one.** The reasoning is written out in `DEFAULT_THREE_D_ACCESS`, and it
comes down to three things. The closed door already exists one level up, so "all"
here means "everyone an administrator already put on Motion's list", not
"everyone"; a second closed default would be the same door locked twice, and the
second lock is the one nobody knows about. The cost is a surcharge rather than a
new bill — a render already spends about 4.3 s of real time per second of film
and a lit solid adds about 0.9 s/s on the host those tables were taken on —
see **A scene carries at most two 3D blocks** below, because that surcharge is
four times larger on a host with no hardware acceleration, and it is now bounded
by a check rather than by an honour system. And `solidScene` shipped: a closed default would be an upgrade that
silently deletes a block from every instance already rendering films with it, and
the first symptom is a compose prompt that has quietly stopped offering it, which
reads as a regression rather than as a policy.

### A scene carries at most two 3D blocks

`MAX_THREE_D_LAYERS = 2`, checked at `POST /render` beside the permission.

The number the tables above give — a lit solid adds about 0.9 s of render per
second of film — was measured on a host with a fast software GL rasteriser, and
it is the sentence that let this defect ship. Measured again in the worker
container on two cores, with no hardware acceleration:

| film | s of wall clock per second of film |
|---|---|
| flat | 1.78 |
| one 3D block on screen | ~3.4 |
| three 3D blocks on screen | **6.68** |

`jobBudgetMs` grants 6. So a film whose scenes stack three 3D blocks is accepted
by the schema, queued, watched, and killed at about nine tenths of the way
through — twelve minutes of somebody looking at a spinner for nothing. Two fit,
with the fit linear in the number of blocks on screen: 1.78 + 2 × 1.63 = 5.04.

Three things about the shape of the bound:

- **Per SCENE, not per film**, because the cost is per FRAME. Eight scenes each
  carrying one solid cost what one scene carrying one solid costs; one scene
  carrying eight costs eight times as much. A per-film cap would refuse the
  cheap film and wave the expensive one through, which is why the refusal says
  spreading them is free.
- **Not in the schema.** Three-dimensionality is a fact about a block's
  *renderer*, not about what validates it — `three-d.js` argues this at the top
  of the file, and the schema is a hand-kept mirror in three places. Expressing
  the bound there would buy a fourth copy of the 3D list in exchange for a check
  the one door every document passes through can already make.
- **400, not 403.** The permission answers *who*; this answers *how much*, and
  no administrator setting makes the film finish. The two are checked in that
  order so an account without the permission learns nothing about the bound.

The margin is thin, and thin in the safe direction: it was computed on the
slower of the two hosts. An operator with hardware acceleration has far more
room; one slower still gets the worker's own 504, which names the machine.

### The enforcement is on the server, at two doors

Hiding a button is presentation. What makes the permission true of a film is that
the routes refuse it.

`POST /compose` **does not offer** what the account may not spend: `three-d.js`
names the 3D blocks, and `availableBlocks()` drops them from the catalogue and
from the decoder hint by exactly the mechanism an empty image selection uses. The
prompt then states it as a fact about the instance — "solidScene is not part of
the catalogue on this instance" — and never as a rule, because a model told a
block exists but is forbidden reaches for it anyway and the refusal arrives after
the tokens are spent.

`POST /render` **refuses the document**, and that is the gate. A timeline reaches
that route from a draft saved last week by an account since taken off the list, a
tab left open while an administrator narrowed the setting, the hand editor, or
curl — none of which passed through the composer. `threeDBlocksIn()` walks the
scenes the way `timelineImageIds()` does, the check sits right after the schema
and before anything touches the disk, and the answer is `403` rather than `400`
because the document is well formed and what is wrong is who is asking.

Both refusals **name what is still possible**, which is this module's rule
everywhere: `threeDRefusal()` says which blocks were involved, that an
administrator grants the right per account and roughly what it costs, and how
many blocks the film could be composed from instead — a count read off the
catalogue, never typed. The person reading it did not choose the block; a model
did, out of a catalogue narrowed after the fact.

### The 3D button, and what it is not

The panel's 3D button is a **composition option**, not a permission: it travels
as `forceThreeD: true` on `POST /compose`, the server validates it against the
same permission, and it becomes an instruction in the prompt — at least one set
piece, given a scene where it is the subject, one in the film and not one per
scene. An account without the permission that sends it gets the same named `403`,
because a button that quietly does nothing is the failure people file as "3D is
broken". Asked for on one of the five ready-made compositions it is refused
before the call, since those carry no blocks at all. And a run that was forced,
allowed and came back flat gets a **notice** rather than a refusal: the film
renders, it is simply not the one the button promised, and handing back nothing
over an answer that works is the wrong trade (Q1).

### What keeps the list honest

`server/video/three-d.js` names the 3D blocks by hand, and the list is guarded
from both ends because the dangerous direction is not the obvious one. A stale
name guards nothing; the failure that matters is a **new** 3D block written,
rendered, catalogued — and never added here, so the permission covers one block
out of two and nothing about that fails.

So `tests/video-3d-permission.test.js` compares the list against the **worker**,
where three-dimensionality actually lives: a 3D block is one whose component
returns react-three-fiber intrinsics, which is precisely the property
`ComposedSceneVideo` uses to decide what to wrap in a `ThreeCanvas` and precisely
what costs the render time being rationed. The files are read as text, like
`tests/video-worker-separation.test.js`, so the check runs on a checkout that has
never entered `worker/video/`.

The list is deliberately **not** in `server/video/timeline.js`. That file is a
hand-kept mirror of the TypeScript schema, and three-dimensionality is not a fact
about the schema: every 3D block is validated by the same bounded integers and
closed enums as a heading, which is the founding rule and the reason a 3D
capability costs it nothing. What makes a block three-dimensional is its
renderer.

---

## The files

| File | What it holds |
|---|---|
| `src/lib/video/timeline.ts` | The zod schema — the five templates, the theme, and the reasoning behind every bound. The definition to read |
| `server/video/timeline.js` | The same schema, mirrored by hand for Node, plus `attachTheme`. `timeline.test.js` holds the two together |
| `src/lib/video/theme.ts` | The project's art direction, read into the handful of tokens a film can carry. Declared ones only |
| `src/lib/video/briefTheme.ts` | The colours the USER asked for, read out of the brief. They beat the dossier token by token; a colour with no role stated beside it is read as nothing |
| `src/lib/video/resolution.ts` | How much a still is about to be enlarged, and what to ask a provider for. Mirrors the worker's frame geometry; `tests/video-frame-geometry.test.js` holds the two together |
| `server/video/compose.js` | The one model call: it composes a scene out of the block catalogue, it never picks the pictures |
| `server/video/variants.js` | The two variant paths, and the fixed table of axes |
| `server/video/config.js` | Admin settings, both permissions. The licence key never leaves the server |
| `server/video/three-d.js` | Which blocks are drawn in 3D, and the refusal that names what is still possible |
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
| `tests/video-3d-permission.test.js` | What keeps the 3D block list in step with the components that draw in GL |
| `tests/video-frame-geometry.test.js` | The frame size, the overscales and the picture share, compared between the browser and the worker |

The queue is in memory with a JSON journal on disk, and there is no Redis and no
worker table — same posture as the rest of the store. A self-hosted Mocky is one
process; a job queue needing a second daemon to survive a restart would cost more
to operate than the feature is worth. The journal exists for exactly one thing:
so a restart can tell the user what happened to the render they were watching.
Nothing is resumed. Re-queueing would be one line, but a render nobody asked for
twice is CPU spent behind their back, and on an instance that crash-loops it is
spent on every boot.

---

## Motion at the start of a project: the kinds

Motion began as a panel you open on a project that already exists, over pictures
you have already chosen. The request that produced this section is the other end
of it: a box ticked beside Muse, on the very first prompt, so that the film is
cut from the dossier at the moment the dossier is written.

Three things had to exist for that, and one that was asked for could not be
built. They are separated below because the third is a security boundary, and the
honest thing to do with one is to name it rather than route around it.

### A kind is a doorway into the catalogue, never a sixth template

"Templates de création Motion" — a globe, a background, a button, a hero. Read as
templates those are four more entries in `VIDEO_TEMPLATES`: four compositions to
write, four branches in the worker, and the sixth template's whole argument
thrown away. `composed` exists precisely so that a new look is a COMBINATION
rather than a card somebody wrote.

So a kind is a **doorway**. `server/video/kinds.js` holds a closed enum of eight
— `hero`, `background`, `banner`, `showcase`, `figure`, `globe`, `mark`, `story`
— and each one resolves to nothing but a subset of `BLOCK_KINDS`, a subset of
`BACKGROUND_KINDS`, one `ASPECT_RATIOS` value and a window inside
`TEMPLATE_LIMITS.composed`. A film composed under a kind is an ordinary
`composed` document: the worker never learns the kind existed, `validate.js` is
untouched, and a draft saved before this shipped parses exactly as it did.

Four consequences are worth stating, because each was a decision.

**A kind NARROWS; it never argues.** The prompt does not say "prefer these six
blocks" — the other twenty-one are not in the catalogue it prints, and they are
not in the decoder hint either. That is the lesson `availableBlocks` already
learned twice, about pictures and about 3D: a model shown a block and told not to
use it uses it, and the refusal arrives after the tokens are spent. A kind also
cannot add back a block the selection or the 3D permission already withheld,
which would be a permission written twice.

**`background` is the kind that proves the mechanism.** It is offered no block
that sets type at all, and no `image` ground. Not because a rule forbids it: a
`heading` is simply not in its catalogue. The defect the kind exists to avoid is
a headline burnt into a backdrop, competing with the headline the page sets on
top of it — at a size chosen by the film, correctable only by re-rendering.

**A narrowing can starve a kind, and that is refused by name.** `globe` on an
account without the 3D permission leaves `map`, `heading` and `kicker` standing,
so nothing downstream would notice; what would come back is a flat film with a
caption about the world, from a button that said globe. So `starvedMotionKind`
asks the question of the kind's SIGNATURE blocks rather than of the count, and
the refusal says which door to knock on. `showcase` over an empty selection is
the same case with the other cause.

**And it degrades rather than disappearing.** All three FIELD blocks are drawn in
GL, so a `background` made only of them would be withheld from every account
without 3D — the kind a page uses most, refused for a reason about renderers. It
carries `soundWave` and `equalizer` too: a moving surface with no glyph on it,
the same picture drawn flat, and the composed prompt's own worked example already
anchors one `full` (Q1).

Every bound a kind states is read from the entry that states it, and
`kinds.test.js` holds three claims about that: every window sits inside
`TEMPLATE_LIMITS.composed`, `scenes.max` times `sceneMs.max` stays under the
total ceiling, and no sentence of prose in the table contains a digit — the same
rule `BLOCK_NOTES` follows one file over.

### The list is published rather than mirrored

This feature has five hand-kept mirrors and has been bitten by four of them. The
panel needs the kinds to draw a selector, and a sixth mirror is exactly what that
would have become.

So `GET /api/video/status` publishes them beside `limits`, which is the same
argument `maxScenes` already makes: quoting a bound from its source is what keeps
the panel and the schema from drifting. What travels is ids and bounds — never
the prose. `MOTION_KIND_SPECS`'s three sentences are a prompt written in English
addressed to a model; the sentence a person reads is `muse.motionKind.<id>` in
both dictionaries, and `tests/video-motion-kinds.test.js` requires one per id in
each language, and no orphan in either direction.

`motionKinds` is published whatever `enabled` says, unlike `threeD` beside it: it
is a fact about the BUILD rather than about the account, and it names nothing an
account could not read in the source.

### The direction reaches the model, and the theme still does not

A theme makes a film carry the project's colours. It cannot make a film RESEMBLE
the dossier, and that turned out to be half the request: strip the colours out of
two films and what is left is the same document — a direction that says
"editorial, generous silence, one idea per screen" and one that says "dense,
saturated, everything at once" composed identical scenes.

`src/lib/video/directionBrief.ts` reads the same markdown `theme.ts` reads, for
the other half: the WORDS. They travel to `/compose` as `direction`, land in the
USER turn under a header saying they are data, and change what gets composed —
how many scenes, how crowded a stack, a hairline ground or a gradient.

Two rules keep it from becoming a theme by the back door.

**No colour crosses.** Every hex triplet is dropped, and that is not tidiness:
the colours already travel, exactly, as `theme`, attached by the server after the
model's answer has been validated. Repeating them in prose adds nothing a
composition can use and does the one thing this feature spends a paragraph
forbidding — it invites a model to write a colour, and a document carrying one is
refused WHOLE, after the call is paid for.

**It is prose, never a table.** A row of tokens read as prose is a list of
values, and a model handed values fills fields with them. Fenced blocks, table
rows, bare links and image embeds are dropped; a heading whose every line was
dropped goes with them, rather than arriving as the word "Tokens" pointing at
nothing.

Rule 9 is unchanged and is still enforced where it always was:
`VideoTimelineSchema` has no `theme` key, so a model that invents one is refused
like an `audio` key, and `attachTheme` writes it onto `RenderTimelineSchema`
after validation. Extracting nothing is not a failure — it returns an empty
string, the block is left out, and the film is composed from the prompt that
existed before this module did.

### Why the film cannot play inside the mockup

This is the part of the request that could not be built, and the reason is a
security boundary rather than an omission.

A generated screen runs in an iframe sandboxed with `allow-scripts` and **no**
`allow-same-origin`, so its origin is opaque (I2). Two independent things follow,
and either one alone is decisive.

**The CSP blocks the element.** `cspMeta()` in `src/components/Preview.tsx` sets
`default-src 'none'` and then names `script-src`, `style-src`, `img-src`,
`font-src`, `connect-src`, `form-action`, `frame-src`, `object-src` and
`base-uri`. There is no `media-src`, so it falls back to `default-src` and a
`<video>` is refused outright. `connect-src 'none'` closes the other routes at
the same time: no `fetch`, so no WebCodecs, and a `blob:` URL minted in the
parent is scoped to the parent's origin and unreadable from an opaque one.

**And the bytes would not be served anyway.** `GET /api/video/:hash` sits behind
`requireUser`, checks ownership BEFORE existence so it cannot be used as an
oracle, and sends `Cache-Control: private` with no `Access-Control-Allow-Origin`.
The session cookie is `SameSite=Lax`; a document with an opaque origin has a null
site-for-cookies, so a subresource load from the preview carries no session and
the route answers 403 — correctly.

That is why a scroll sequence works and a film does not. A sequence is cut into
JPEGs by ffmpeg at ingest and served by `server/videos/routes.js`, deliberately
unauthenticated with `Access-Control-Allow-Origin: *`, so `<ScrollSequence>`
needs `img-src` and nothing else. A film is one `.mp4`, private to the account
that rendered it, and there is no ffmpeg on the export path to cut it — which is
also why `mediaPoster` points a `<video preload="metadata">` at the file instead
of showing a still.

Making it play would mean adding `media-src` to the preview CSP, or serving film
bytes unauthenticated by hash. Both are changes to a control that exists for a
stated reason, and neither is a decision this feature gets to take on its own.

So the film goes where a film already goes: it is attached to the SCREEN as an
`AttachedMedia` of kind `film`, and drawn on the canvas beside the frame, in
Mocky's own same-origin document where the session works and no CSP is in the
way. `muse.motionCost` says so before the box is ticked rather than after the
render — somebody who expects a film inside the mockup and finds a card beside it
has been surprised by the interface, and that is the one failure a sentence can
prevent outright.

### What this pass did not build

Stated rather than left to be discovered.

- **No capability, and no `<MotionFilm>` component.** It would be a component
  that cannot draw its own subject, for the two reasons above. The registry entry
  is deliberately absent rather than present and inert: `scrollvideo` is the
  precedent, and its whole comment is about never offering a component with
  nothing to show.
- **The kinds are reachable from the composer, not yet from the export panel.**
  `VideoExportDialog` still offers the five editable templates and `auto`; a
  `motionKind` selector there is a straightforward increment, left out of this
  pass rather than half-wired.
- **One film per screen, cut once.** Nothing re-cuts a film when the direction
  changes, and nothing offers a second one for another section of the same
  screen. `AttachedMedia` holds one, which is the shape that made the canvas card
  possible; a screen wanting a hero film and a background film needs that field
  to become a list first, and the reasons `owners` is a set apply to it.
- **The render is polled to completion.** The screen is finished and on the
  canvas before this starts, so nothing is blocked — but closing the composer
  aborts the poll, and the film is then rendered, stored and findable in Media
  without being attached to anything.
