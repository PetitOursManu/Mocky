# Mocky's design system

:::why
A tool for judging mockups and the mockups themselves answer to opposite constraints: the shell has to recede, the mockup has to assert itself — hence two separate systems and two documents. The real rules live in the code (`src/styles/tokens.css`, `tailwind.config.js`, `src/ui`); this text exists only to give their reasons, without which a constraint looks like a whim and gets worked around the first time someone is in a hurry.
:::

> This is about the interface of **Mocky itself**, not the screens it generates.
> For those, see `DESIGN.md` and the presets in `src/lib/styles.ts`.

## The direction: a dark studio

:::why
The eye never judges a colour in isolation: it compares it to whatever surrounds it, so a tinted frame shifts the perception of everything it frames. Since looking at mockups is precisely what Mocky is for, its shell stays neutral grey out of professional obligation before it is out of taste — and the one colour it does allow is kept rare for the same reason.
:::

A near-black studio, neutral greys and **one lime accent**. The reference it was drawn from is [`plans/refonte/modele-dark-glitch.html`](../plans/refonte/modele-dark-glitch.html), with its "acid" accent; the tokens read their values off it. Its glitch effect (offset magenta and cyan hairlines) was tried and set aside: the shell carries none.

Dark is the **default** theme: nothing chosen means dark, and the OS preference no longer decides. The light theme is the same roles at the other end of the scale.

What survived from the previous, editorial direction is the reason it was achromatic. The old palette was `slate` — a distinctly blue-leaning grey (`#64748b`). A warm mockup placed on it reads more yellow than it is; a blue mockup reads flat. **The chrome was lying about the colours it presented**, which is disqualifying for a design tool. So the greys here are a channel apart at most.

Three consequences:

- **Elevation is read from value first.** Three surface levels; rules are soft and only finish an edge; a shadow lifts only what floats (menus, the floating toolbar, modals).
- **The accent is rare.** It marks the primary action, the focus and the active state. An active control no longer inverts: it takes the lime on a tinted ground (`--selected`), as the reference draws its active tool — an inverted block on a dark shell is a white slab in the middle of the toolbar.
- **Corners are back**, small and graded: 4px for a thumbnail, 7px for a button or a field, 9–12px for a menu or a modal.

## The tokens

:::why
A colour named after its role ("a panel's surface") can change value when the theme changes; a colour named after its appearance ("grey 800") cannot, since its name is already the answer. Themes used to be obtained by re-declaring Tailwind utilities one by one — 96 rules written against the 109 colour classes the components actually used, so 83 were never translated — and that is the hole closed by a single set of variables which each theme reassigns.
:::

Everything lives in [`src/styles/tokens.css`](../src/styles/tokens.css), as raw RGB channels — that is what lets Tailwind compose opacity (`bg-surface/60` works).

| Token | Role |
|---|---|
| `--sunken` | the canvas, behind the frames, and the page |
| `--surface` | panels, the top bar, the composer |
| `--raised` | popovers, menus, modals, floating tools |
| `--line` | the edge of a floating surface. Soft. |
| `--line-soft` | rows in a list, separators. The default case. |
| `--field` | the edge of a form field — the one rule held to 3:1 |
| `--ink` / `--ink-muted` / `--ink-faint` | primary / secondary text / the floor (never below it) |
| `--accent` / `--on-accent` | the lime (**#d4ff46**) and the text on it |
| `--accent-ink` | the accent colour for **small text** — see below |
| `--selected` / `--on-selected` | the active state: a tinted ground and the accent on it |
| `--danger` `--warn` `--ok` | statuses |
| `--muse` | Muse's mark — a mode, not a state; it wears the house colour |
| `--ring` | the focus ring |
| `--shadow` / `--shadow-k` | the shadows' colour, and a strength every step is multiplied by |

Two themes, **Ink** (dark, the default) and **Paper**, defined by the same tokens. Neither one is an override of the other.

## Why two accent tokens

:::why
Accessibility standards do not demand the same difference in lightness for text (4.5:1) as for a flat, a rule or an icon (3:1): one and the same brand colour can therefore be perfectly legible behind a button and illegible in small type, on the same page. Rather than forbidding that colour to text, the system declines it into two variants — close enough to be indistinguishable to the eye, distinct enough that each clears its own threshold.
:::

On the dark grounds the lime needs no second value: `#d4ff46` is 15.8:1 on the surface, so `--accent` and `--accent-ink` are equal there.

On paper it is another story — lime on white is 1.1:1, invisible. The light theme keeps the hue and drops the value: an olive (`#547800`) that clears 4.5:1 under white text and as a rule, and `--accent-ink` (`#4a6a00`) a hair darker for small text.

**The rule: `text-accent-ink` for text, `bg-accent` / `border-accent` for everything else.** `text-accent` is only acceptable at `text-h2` or larger, and on an icon. The contrast test checks the two tokens separately, against two different thresholds.

## The recurring devices

:::why
What makes an interface recognisable comes down to a handful of signals that recur everywhere — a label above what it names, a wordmark, a rule, a fixed format — far more than to the drawing of any single element taken on its own. Reproducing those signals in a handful of reusable classes costs less than dressing the screens one by one, and leaves a single address to edit on the day the tone has to change.
:::

They live in `src/index.css`. The first three used to be a newspaper's masthead, kicker and double rule; they kept their names so the 270 places that use them changed look without changing code.

| Class | Usage |
|---|---|
| `.masthead` | The wordmark and page titles: the sans, heavy and tight. |
| `.kicker` | **The label** — the reference's "eyebrow": monospaced, capitals, widely tracked, in `--ink-faint`. Panel titles, group labels, tabs. |
| `.rule-double` | The rule under the top bar — soft, like every rule. |
| `.rule-thin` | The separating rule between sections. |
| `.section-head` | Section head: label plus rule. |
| `.measure` | 68ch — the reading width of a paragraph. Full width does not mean 200-character lines. |
| `.page` | **The page format**: 1440px max, centred, 24px gutter. |
| `.page-wide` | 1760px, reserved for the image gallery — a grid of thumbnails has no reading width. |

### The page format

:::why
A layout is made of relationships between elements, and a relationship comes apart beyond a certain distance: width is therefore not a free variable that would be worth maximising, it is a format to be chosen. The format settled on is a centred ceiling, because it behaves like full width on ordinary screens and simply stops growing past that — one value, and no per-screen rule to write.
:::

A page has a fixed format, and this is it. The pages were first locked into `max-w-4xl` (896px), which wasted half of a wide screen. Freeing them completely went too far the other way: on a 2000px screen the content ran edge to edge, the eye had to cross the whole width to connect a project name to its date, and nothing framed the page any more.

Measured, usable content by screen:

| Screen | Content | Occupancy |
|---|---|---|
| 1280 | 1232px | 96% |
| 1440 | 1392px | 97% |
| 1920 | 1392px | 73% |
| 2000 | 1392px | 70% |

Below 1440px the behaviour is that of a full width; beyond it, the page stops. **One value to set**, in `.page`.

The `h1/h2/h3` headings are set in the sans, heavy and tight, through a rule in the `base` layer. They used to take a serif — that was the whole "printed page" — and the redesign keeps one family for the interface, so the mockups are the only place a serif shows up.

No font is downloaded for the shell. The stack asks for Inter and falls back on the system's sans (Segoe UI on Windows, SF on macOS) — the self-hosted families in `public/fonts` are the mockups', and the shell keeps out of them on purpose.

## The icons

:::why
An icon has to take the colour of the text beside it and draw the same for everyone; an emoji can do neither, because it is a small colour image supplied by the operating system, and a different one under Windows, macOS and Android. A vector path painted in `currentColor` — the CSS keyword that picks up the text colour currently in force — inherits the theme instead, without being told to, and is sized like a character.
:::

`src/ui/Icon.tsx` — 48 vector icons in `currentColor`.

```tsx
import { Icon, IconButton } from '../ui'

<Icon name="link" />                                  {/* 20px by default */}
<IconButton label="Delete"><Icon name="trash" /></IconButton>
```

The interface was built out of emoji. Those are **colour bitmaps**: the theme cannot touch them, they look like stickers on a black-and-white shell, and they render differently on every system (Segoe UI Emoji, Apple Color Emoji, Noto) — the toolbar was never twice the same. They also rendered at around 12px, too small to read as an icon.

`Icon` is `aria-hidden` by construction: the accessible name belongs to the button, and `IconButton` enforces it.

## The rules

:::why
Each of these five lines answers a drift observed in the code, not a theoretical preference: dozens of text sizes invented case by case, seven improvised z-index values plus two floating panels carrying no z-index at all that overlapped to the pixel, four focus declarations for a hundred and seven buttons. A rule stated briefly can be checked in review, and sometimes by a test, which a paragraph of intentions cannot.
:::

**1. A component describes what a control *is*, never its colour.**
`bg-surface`, `text-ink-muted`, `border-line` — yes. `bg-slate-800`, `text-indigo-400` — no: that will not follow the theme.

**2. The type scale has six steps, and nothing between them.**
`caption` 11px (badges only) · `body-sm` 13px (controls, toolbar) · `body` 14px (**the default**) · `lead` 16px · `h3` 20px · `h2` 28px · `display` 44px.
Arbitrary sizes (`text-[11px]`…) are forbidden. Figures that change under the eye — zoom, dimensions, footprints — take `font-mono` so they stop jittering.

**3. Every clickable target is at least 32px high — and 44px under a finger.**
The primitives enforce it. Going through them is enough.

The 32px are sized for a trackpad: a fine pointer, guided by a cursor you can
see. A finger has neither, and it covers the target at the moment of touching
it. Under `@media (pointer: coarse)`, in `index.css`, the floor therefore rises
to 44px. That is not a contradiction of the rule but a second value for a
second device: the query is purely additive — the file holds no other
width-based media query — so it cannot regress the desktop.

**4. Focus is visible everywhere.**
A single rule in the `base` layer of `index.css`, written with `:where()` so it stays at zero specificity. Do not cancel it.

**5. One z-index scale, and only one.**
`panel: 20` · `menu: 30` · `overlay: 40` · `modal: 50` · `top: 60`. No `z-[70]`.

## The primitives

:::why
Requirements that keep recurring — a name a screen reader can pronounce on a button with no text, a label genuinely tied to its field, a focus trap in a dialog, a target of at least 32 pixels — hold once and for all if they live inside a component, and are lost every other time if they have to be remembered at each call site. These primitives exist, then, to make the correct behaviour shorter to write than the sloppy one.
:::

Import from [`src/ui`](../src/ui):

```tsx
import { Button, IconButton, Field, Input, Modal, Banner, Chip, Segmented, Panel } from '../ui'
```

| Primitive | Use it for |
|---|---|
| `Button` | variants `primary` (the view's action) · `ghost` (the default) · `quiet` (tertiary, no rule) · `danger` · `toolbar`. `active` inverts. |
| `IconButton` | icon-only button. **`label` is mandatory.** |
| `Field` + `Input`/`Textarea`/`Select` | `Field` generates the `id` and wires it to the `<label>` — impossible to forget. |
| `Modal` | `role="dialog"`, `aria-modal`, focus trap, Escape, focus restoration, a single overlay. |
| `Panel` / `PanelRow` | the canvas's floating surfaces. A row's actions stay visible on focus, not only on hover. |
| `Segmented` | mutually exclusive modes. The exclusivity is structural. |
| `Chip` | removable tokens. |
| `Banner` | inline messages. `role="alert"` when `tone="danger"`. |
| `Spinner` / `Skeleton` / `ScreenSkeleton` / `EmptyState` | waiting and empty states. |

**No primitive hard-codes a label.** `Panel`, `Modal`, `Chip`, `Spinner` and
`MockyLoader` all carry an accessible name that is the *entire* name of a control
with no text in it — a close cross, a spinning ring — and all five shipped it as
a French sentence, two of them (`Panel` and `Modal`) with no prop to override it
at all. An English interface
announced "Fermer le panneau", "Retirer" and "Chargement…", on every panel and
every spinner in the app. Each one now defaults through `t('common.*')` and takes
an optional prop for the callers that can say something more specific. A block in
`tests/i18n-parity.test.js` fails on any label-shaped prop assigned a literal
under `src/ui`: the FR/EN parity checks could never have caught this, because a
sentence that reaches no dictionary is perfectly consistent between two of them.

## The guardrails

:::why
Contrast is one of the few qualities of an interface a machine can settle on its own: it is a number, computed from two colours and compared to a published threshold. The check is wired to the file that ships, and not to a copy of its values: a hue retouched by hand therefore fails the suite straight away, instead of waiting for a user to stop being able to see a label.
:::

```bash
npx vitest run tokens-contrast
```

[`tests/tokens-contrast.test.js`](../tests/tokens-contrast.test.js) reads the real token file and checks **every text/background pair** against WCAG AA, in both themes. It also checks that both themes declare exactly the same tokens — a token present on one side only is precisely how a colour silently falls back to the other theme's value.

This test exists because of what was measured on the old version:

| Old | Actual contrast |
|---|---|
| `text-slate-500` | 3.75:1 (dark) · 2.09:1 (beige) · 2.34:1 (Mocky) |
| `text-slate-600` | 2.36:1 |
| the active "Frame" button (`bg-slate-700 text-white`) | **1.21:1** — the background was remapped for the light themes, the text never was. The active button's label was invisible. |

## Changing the system

:::why
A centralised system only holds if the way to modify it is written down somewhere: otherwise the first emergency goes around it and puts a hard-coded colour back into a component. The three moves recalled here — declare the colour in both themes, expose it in `tailwind.config.js`, add its pair to the contrast test — are the ones nobody stated in the old version, the one where 83 of the 109 colour classes followed no theme at all.
:::

- **Changing the accent**: one variable, in both theme blocks. Nothing else.
- **Adding a theme**: duplicate a token block. No component to touch.
- **Adding a colour**: first ask yourself whether it is an existing *role*. If it is, use the token. If not, add the token **in both themes**, expose it in `tailwind.config.js`, and add its pair to the contrast test.

## What was not done, and why

:::why
An option dismissed without leaving a trace comes back every six months and is re-evaluated from scratch; recorded together with its reason, it is only reopened if the reason has changed. This one is peculiar to a generator: the vocabulary of classes Mocky writes into mockups has already left for its users, inside screens they produced and exported, and that no update to the tool can go back and fix.
:::

**No migration of generated screens to Tailwind 4.** v4 forces `shadow-sm`→`shadow-xs`, `outline-none`→`outline-hidden`, changes the default ring and moves the Play CDN to `@tailwindcss/browser` — so it **would invalidate the v3 classes of screens already generated**, along with the whole export chain (`src/lib/export/`). Real cost, zero user benefit. The previews keep the vendored v3 runtime (`public/vendor/VENDOR.md`) and the prompts keep teaching its classes.

**Mocky's own shell did move, in October 2026**, for a reason that did not exist when the line above was written: a security alert on `postcss-selector-parser`, which only Tailwind 3 pulled in. That build is the one place where the argument does not apply — no generated screen goes through it. `tailwind.config.js` stays, loaded by `@config`; what v4 changed silently (the default border colour, the focus ring of fields, the transition duration, `hover:` on touch screens) is put back in `src/index.css`, each line with the reason it is there.
