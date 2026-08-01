# Animations

Motion in Mocky is powered by [Motion](https://motion.dev), and **the generating
model never writes a line of it**. It has no access to the library's API: no
`motion.div`, no transition, no variants object. It picks a name from a closed
list.

```jsx
<Animated preset="fade-up" delay={0.1} as="section">…</Animated>
<Ticker speed={24} pauseOnHover>{logos}</Ticker>
<CountUp to={1284} suffix="+" />
```

Everything else — variants, springs, intersection thresholds, the CSS fallback —
is written and tested once, in `src/lib/capabilities/snippets/Animate.ts`.

---

## Why the list is closed

This is the central decision, and it is not a matter of taste.

A model writing animation code by hand produces three classes of failure that no
automated review catches.

**A misremembered API.** Motion has changed name, package and surface —
`framer-motion` became `motion/react`. Models have read all three eras. A wrong
import or a non-existent prop is not a less pretty animation; it is a screen that
does not mount.

**An invisible resting state.** An entrance that starts at `opacity: 0` and whose
animation never begins leaves a **blank page**. That is not a degradation, it is
lost content.

**Unpredictability.** Every screen would invent its own durations, curves and
distances, and a twelve-screen project would have no shared motion language.

With a closed list, the worst the model can do is **name a preset that does not
exist**, which renders a plain, unanimated element with its content intact.

This is the same reasoning as the capability registry: shrink the surface the
model can get wrong, and move the complexity into tested code.

---

## The eleven presets

| Category | Preset | Effect |
|---|---|---|
| **Entrances** | `fade-in` | Opacity 0 to 1, 400 ms |
| | `fade-up` | Opacity plus a 16 px rise, 400 ms, `easeOut` |
| | `scale-in` | A spring, `stiffness: 300`, `damping: 24` |
| | `slide-left` | Enters from the left (−32 px), 450 ms |
| | `slide-right` | Enters from the right (+32 px), 450 ms |
| | `blur-in` | A 12 px blur lifting, 500 ms |
| | `stagger-list` | Children appear one after another, 0.06 s apart |
| **Hover** | `hover-lift` | Rises 4 px with a shadow |
| | `hover-glow` | `scale(1.02)` plus `brightness(1.08) saturate(1.08)` |
| **Scroll** | `parallax` | Drifts more slowly than the page, depth 0.25 |
| **Exit** | `exit-slide` | Enters from the left, exits to the right when removed |

Two details are worth explaining.

**`stagger-list` goes on the list, not on each item.** This is stated explicitly
in the description the model reads, because the opposite mistake is natural and
produces eleven simultaneous animations instead of a stagger.

**`hover-glow` uses light, not colour.** The generated screen has its own palette
and this preset must not guess at it. `brightness` works on any background,
whereas a hard-coded coloured halo would fight half the art directions.

A name absent from this list **is not an error**. `MOCKY_PRESETS[name]` is
`undefined`, `animating` is false, and the component renders a plain element with
its `className`, `style` and children.

### The list is declared twice, on purpose

```ts
export const ANIMATE_PRESETS = ['fade-in', 'fade-up', /* … */] as const
export type AnimatePreset = (typeof ANIMATE_PRESETS)[number]
```

`ANIMATE_PRESETS` sits **next to** the source rather than being derived from it.
What actually reaches the model is the registry's `components` metadata, and a
name present in one but absent from the other is exactly the divergence
`validatePack` exists to catch.

---

## The three components

### `<Animated>`

The only wrapper. `preset` is **required**. `delay` is in seconds, clamped to
`[0, 2]`. `as` chooses the tag, defaulting to `div`.

### `<Ticker>`

A row that scrolls forever: logo strips, testimonials, tags.

The track is **duplicated automatically**, so pass the items **once**. `speed` is
the number of seconds per full pass — higher is slower — clamped to `[4, 120]`.
`reverse` flips the direction. `pauseOnHover` is on by default.

The track is translated by exactly **half its width**, so the seam is invisible
and the loop point looks identical to the start. That detail is also what makes
it survive "no animation" mode: collapsing the animation to one instant pass
lands it at −50%, which is the same picture.

### `<CountUp>`

A number that counts up when it scrolls into view. `to` is required. `duration`
is clamped to `[200, 6000]` ms and `decimals` to `[0, 3]`. The easing is
`easeOutCubic`: fast first, then settling on the number. Thousands are spaced
automatically.

It renders an inline `<span>`, so wrap it in your own heading or paragraph for
styling.

**When animation is off it renders the final value.** A statistic stuck at 0 is
worse than a statistic that never moved: it is **wrong**.

---

## Two engines, one contract

Motion is vendored and loaded as a capability, so it is normally there. When it
is not — the script failed, or the screen was generated before the capability
existed — **the same presets run on a small CSS and IntersectionObserver path**.

The component's contract does not change. Only the smoothness does.

| | With `window.Motion` | Without |
|---|---|---|
| Entrances | `hidden`/`visible` variants | CSS `from`/`to` classes and a transition, revealed by IntersectionObserver |
| Hover | `whileHover` | `onMouseEnter`/`onMouseLeave` writing styles by hand |
| `parallax` | **the same code** | **the same code** |
| Exit | `AnimatePresence` | No exit; the element simply disappears |

`parallax` is **scroll-linked**, so it is the same DOM code in both engines —
there is nothing for a variant to describe.

A `requestAnimationFrame` is scheduled from a passive `scroll` listener. The
offset is computed from the element's centre relative to the viewport centre — −1
above, 0 centred, +1 below — and clamped to ±80 px. That keeps the block near its
layout position at every scroll offset, so it never drifts out of its own
section.

---

## The static escape hatch

```js
var mockyMayAnimate = function () {
  try {
    if (window.__mockyAnimations === false) return false;
    if (document.hidden) return false;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  } catch (e) { return false; }
  return true;
};
```

Three reasons not to animate, plus a fourth that is the catch-all, and all of
them belong to the user.

`document.hidden` is the measured, non-obvious one. Motion holds an element at
its `initial` state until its frame loop starts, and **browsers do not run that
loop in a background tab**. A mockup opened in an inactive tab therefore sat at
`opacity: 0` indefinitely — a blank screen, not a delayed one.

In every one of these cases the element renders in its **final state,
immediately**. A mockup that shows its content without animating is a small loss;
a mockup that shows nothing is a bug.

### The hooks trap

The decision is taken **once, at mount**, and frozen in a ref:

```js
var allowed = React.useRef(null);
if (allowed.current === null) allowed.current = mockyMayAnimate();
```

And **every hook runs on every render, unconditionally**.

They used to sit after the early return, which is a bug that waits.
`document.hidden` can flip while a mockup is open — switch tab, come back — and
the next parent re-render would then take the short path and call **fewer** hooks
than the previous one. That is "Rendered fewer hooks than expected", and it kills
the whole frame.

The effects simply do nothing when there is nothing to do.

---

## The switch

Three states, not two. They live in `src/lib/animations.ts` and are **per device
and sticky**, like the theme: this is a working preference, not a property of the
project.

| State | Effect |
|---|---|
| `auto` *(default)* | The existing selection stands — the keyword shortlist, possibly refined by the planner |
| `on` | `animate` and `motion-lib` are added regardless |
| `off` | `animate` and `motion-lib` are removed, and already-generated screens are held still |

A binary switch would have thrown away a decision Mocky already gets right most
of the time: a landing page wants entrances, an admin table does not.

`auto` keeps that decision. The other two states exist for when it guesses wrong
— `on` when a screen read as static should still breathe, `off` when a demo has
to hold still: a screen recording, a slow machine, a client who hates motion.

```js
const ANIMATION_CAPS = ['animate', 'motion-lib']
```

`off` removes **the library too**. Leaving `motion-lib` behind would load 129 kB
into a preview that has nothing to animate.

`applyAnimationMode()` is applied **once**, after both the shortlist and the
planner have had their say. The rest of the generation path is unaware the mode
exists.

### Per screen

Each screen can override the global setting from the bar above its frame or from
its context menu. `Screen.animations` holds:

| Value | Meaning |
|---|---|
| `undefined` *(the common case)* | Follow the global setting. This is what every screen generated before the option existed says |
| `true` | This screen animates |
| `false` | This screen holds still |

Resolution is `animations={s.animations ?? animations}`. It is persisted and
travels with the project, because "this one screen must hold still for the demo"
is a property of the screen, not of the session that happened to be open.

### What "off" really has to do

The `window.__mockyAnimations` flag only reaches `<Animated>`.

A screen animated with a Tailwind `animate-*` class, a hand-written `@keyframes`,
a CSS transition, or the retired `motion` pack would keep moving — and from the
user's side the switch **would** be broken.

So animations are **run to completion** rather than removed:

```css
*,*::before,*::after{
  animation-duration:0.01ms !important;
  animation-delay:0ms !important;
  animation-iteration-count:1 !important;
  animation-fill-mode:forwards !important;
  transition-duration:0.01ms !important;
  transition-delay:0ms !important;
  scroll-behavior:auto !important
}
```

`animation: none` on a fade-in whose resting state is `opacity: 0` would leave
the content **permanently invisible** — a blank mockup instead of a still one.
Collapsing the duration and forcing the final frame lands it at `opacity: 1`.

This is the same recipe Mocky's own stylesheet uses for
`prefers-reduced-motion`, for exactly the same reason.

Flipping the switch **rebuilds the document**: `animations` is in the dependency
list of the effect that builds the `srcDoc`, otherwise screens already on the
canvas would keep the setting they were built with. A test locks both points:

```js
expect(preview).toContain('animation-fill-mode:forwards !important')
expect(preview).not.toMatch(/animation:\s*none\s*!important/)
expect(preview).toMatch(/\[code, frameId, hideScrollbars, resolvedCaps, animations\]/)
```

---

## When the model writes Motion anyway

The model is told there is no module system in the sandbox, and only ever sees
`<Animated>`. It slips anyway: `import { motion } from "motion/react"` and
`<motion.div>` are muscle memory acquired from the whole internet, and either one
in a generated screen is a **hard** render failure, not a degraded one.

`stripForbiddenMotion()` in `src/lib/stripMotion.ts` removes it, through a
**Babel AST walk**, never a regular expression (invariant I1):

```js
const MOTION_MODULE = /^(motion|framer-motion)(\/.*)?$/
```

An `ImportDeclaration` whose source matches is removed.

A `JSXMemberExpression` whose object is the `motion` identifier is rewritten:
`<motion.section className="hero">` becomes `<section className="hero">`. The
element survives **with its children, its `className` and its content**, and
simply does not animate. Same contract as everywhere else in this feature:
degrade to the static version, never to a blank frame.

What it does **not** touch: `<Animated>`, and a component the user legitimately
named `Motion`. Only the lowercase `motion` namespace, the one the library is
known by, is targeted. If the renamed tag does not start with a lowercase letter
it falls back to `div`, because a capitalised JSX tag is a component reference,
not an HTML element.

The function **never throws**. A file Babel cannot parse is returned untouched,
because the compiler downstream will report that syntax error far better than
this can, and swallowing the code here would turn a fixable error into an empty
screen.

A removal is **reported in the console**, never done silently:

```
[mocky] raw Motion code removed from the generated screen (<motion.div>) —
animations come from <Animated preset="…"> only.
```

Silently rewriting someone's output is the kind of magic that makes a tool
untrustworthy.

---

## Motion, vendored

Motion is pinned to an **exact** version in `package.json` — `"motion":
"12.43.0"`, with no `^` — and the browser bundle is produced by
`scripts/build-vendor-motion.mjs`.

**Why a script.** Every other bundle in `public/vendor/` is copied from
`node_modules` because it already ships a browser build. Motion 12 publishes ESM
and CJS only, and the preview iframe has no module resolution: it loads plain
scripts and reads globals off `window`.

```js
stdin: { contents: `export { motion, AnimatePresence, useReducedMotion } from 'motion/react'` }
bundle: true, format: 'iife', globalName: 'Motion'
```

Only what `<Animated>` needs. Motion's full surface is deliberately not exposed —
that is the whole point of the closed preset registry — so there is no reason to
ship the parts nothing calls.

**React is not bundled in.** An esbuild plugin redirects `react` and `react-dom`
to the globals the preview shell has already set:

```js
args.path === 'react' ? 'module.exports = window.React' : 'module.exports = window.ReactDOM'
```

Bundling a second React would give the page two dispatchers, and **every hook
would throw "invalid hook call"** the moment a Motion component rendered.

**After a version bump.** Re-run the script, copy the printed SHA-256 into
`public/vendor/VENDOR.md`, and **verify the presets visually**. Motion has
shipped an upgrade that **silently stopped animating without throwing**: "no
console error" proves nothing here.

---

## The retired pack, and the one path that still reaches it

Before `<Animated>` there was a `motion` capability: twelve CSS-only components —
`FadeIn`, `Stagger`, `Marquee`, `Counter`, `Reveal`, `ShimmerButton`,
`BentoGrid`, `BentoCard`, `BorderBeam`, `TextReveal`, `Meteors`, `AnimatedBeam`.

It is marked `retired: true`: **injected** for screens carrying it in
`Screen.caps`, **never documented** to the model. The full mechanism is in the
[architecture overview](architecture/overview.md).

One UI action deliberately re-enables it: **"Add animations"**, in a screen's
menu, which layers motion onto an already-generated screen at three intensities —
`subtle`, `moderate` and `rich`.

```js
const capIds = Array.from(new Set([...(screen.caps ?? []), 'motion']))
```

This is an **edit** path, so `EDIT_RULES` applies: the model may add motion only,
and content, copy, colours, layout and structure stay byte-for-byte identical.
The instruction names the pack's components so the model **wraps** the existing
markup instead of writing its own keyframes.

One subtlety worth knowing. Retired capabilities are skipped in
`buildCapabilitiesPrompt()`'s documentation loop, so the per-component lines are
not emitted. The names reach the model through two other channels: the edit
instruction itself, and the trailing "ANIMATION: use the components listed above
(…)" paragraph, which is triggered by the presence of the `motion` id.

Finally, `applyAnimationMode('off')` removes **only** `animate` and `motion-lib`.
A screen built on the retired pack keeps its components, and it is the
override CSS described above that freezes it, not capability selection. That case
is precisely why the override exists.

---

## Muse's motion language

A design dossier contains a `## Motion Language` section: a list of names with
descriptions. It is **not** binding in the registry sense — it is art direction
in prose, passed to the model in the preamble.

The mechanical link is elsewhere. The dossier's tokens feed the existing
capability shortlist through `selectCapabilities(text, museMarkdown || designMd)`,
so a dossier that talks about motion naturally causes the `animate` capability to
be selected — exactly as a prompt mentioning it would.

No new capability kind, and no new code path.
