# Mocky's design system

**English** · [Français](DESIGN-SYSTEM.md)

> **Why it works this way —** A tool for judging mockups and the mockups themselves answer to opposite constraints: the shell has to recede, the mockup has to assert itself — hence two separate systems and two documents. The real rules live in the code (`src/styles/tokens.css`, `tailwind.config.js`, `src/ui`); this text exists only to give their reasons, without which a constraint looks like a whim and gets worked around the first time someone is in a hurry.

> This is about the interface of **Mocky itself**, not the screens it generates.
> For those, see `DESIGN.md` and the presets in `src/lib/styles.ts`.

## The direction: high-contrast editorial

> **Why it works this way —** The eye never judges a colour in isolation: it compares it to whatever surrounds it, so a tinted frame shifts the perception of everything it frames. Since looking at mockups is precisely what Mocky is for, its shell is achromatic out of professional obligation before it is out of taste — and it is that obligation, not a graphic fashion, that then dictates the absence of shadows and the rarity of the accent.

Black and white, 1px rules, **no radius, no shadow**, one signature flat of colour. Swiss poster rather than dashboard.

This is not only a matter of taste. Mocky is a tool for **judging colour**: mockups sit side by side on a canvas, and the chrome surrounds them. The old palette was `slate` — a distinctly blue-leaning grey (`#64748b`). A warm mockup placed on it reads more yellow than it is; a blue mockup reads flat. **The chrome was lying about the colours it presented**, which is disqualifying for a design tool. An achromatic shell is the only one that does not distort what it frames, and black and white is the most complete version of it.

Two consequences, accepted deliberately:

- **Rules replace shadows.** Elevation is read from value (three surface levels) and from a rule, never from a blur.
- **The accent is rare.** One primary action per view carries it. An active tab or mode does not take the accent: it **inverts** (`bg-ink text-surface`). That is more direct, and it stays legible in both themes.

## The tokens

> **Why it works this way —** A colour named after its role ("a panel's surface") can change value when the theme changes; a colour named after its appearance ("grey 800") cannot, since its name is already the answer. Themes used to be obtained by re-declaring Tailwind utilities one by one — 96 rules written against the 109 colour classes the components actually used, so 83 were never translated — and that is the hole closed by a single set of variables which each theme reassigns.

Everything lives in [`src/styles/tokens.css`](../src/styles/tokens.css), as raw RGB channels — that is what lets Tailwind compose opacity (`bg-surface/60` works).

| Token | Role |
|---|---|
| `--sunken` | the canvas, behind the frames |
| `--surface` | panels, cards, the header, the composer |
| `--raised` | popovers, menus, modals |
| `--line` | the **structural** rule: the outer edge of a floating surface, the rule under the header. Rare. |
| `--line-soft` | the **hairline** rule: rows in a list, field borders, separators. The default case. |
| `--ink` / `--ink-muted` / `--ink-faint` | primary / secondary text / the floor (never below it) |
| `--accent` / `--on-accent` | the signature flat (**#228477**) and its text |
| `--accent-ink` | the accent colour for **small text** — see below |
| `--danger` `--warn` `--ok` | statuses, desaturated one step so they never shout louder than a mockup |
| `--muse` | Muse's mark — a mode, not a state |
| `--ring` | the focus ring |

Two themes, **Paper** and **Ink**, defined by the same tokens. Neither one is an override of the other.

## Why two accent tokens

> **Why it works this way —** Accessibility standards do not demand the same difference in lightness for text (4.5:1) as for a flat, a rule or an icon (3:1): one and the same brand colour can therefore be perfectly legible behind a button and illegible in small type, on the same page. Rather than forbidding that colour to text, the system declines it into two variants — close enough to be indistinguishable to the eye, distinct enough that each clears its own threshold.

`#228477` measured on paper (`#faf8f3`):

| Usage | Contrast | Verdict |
|---|---|---|
| White on the flat (button) | **4.53:1** | passes AA |
| The accent as **small text** on paper | **4.27:1** | **fails** (AA = 4.5) |
| The accent as a flat, a rule, an icon | 4.27:1 | passes (interface component = 3:1) |

Hence `--accent-ink` (`#20796C`, **4.93:1**): the same hue, a hair darker, indistinguishable at text sizes. That is what makes it possible to use the colour **liberally** without shipping unreadable text.

**The rule: `text-accent-ink` for text, `bg-accent` / `border-accent` for everything else.** `text-accent` is only acceptable at `text-h2` or larger, and on an icon. The contrast test checks the two tokens separately, against two different thresholds.

In the Ink theme, both tokens hold the same light value (8.4:1 on the surface) — one is enough there.

## The devices of print

> **Why it works this way —** What makes a printed page recognisable comes down to a handful of signals that recur everywhere — a kicker, rules of differing weights, a column width, a fixed format — far more than to the drawing of any single element taken on its own. Reproducing those signals in a handful of reusable classes costs less than dressing the screens one by one, and leaves a single address to edit on the day the tone has to change.

Four things do almost all the work of making a screen look printed. They live in `src/index.css`.

| Class | Usage |
|---|---|
| `.masthead` | The paper's name, in the serif. Once, at the top. |
| `.kicker` | **The kicker** — small, capitals, widely tracked. The most profitable device of the lot: panel titles, group labels, tabs. Used 69 times. |
| `.rule-double` | The double rule (one heavy plus one hairline) under the masthead. |
| `.rule-thin` | The separating rule between sections. |
| `.section-head` | Section head: kicker plus rule. |
| `.measure` | 68ch — the reading width of a paragraph. **Full width does not mean 200-character lines**: that is precisely why newspapers have columns. |
| `.page` | **The page format**: 1440px max, centred, 24px gutter. |
| `.page-wide` | 1760px, reserved for the image gallery — a grid of thumbnails has no reading width. |

### The page format

> **Why it works this way —** A layout is made of relationships between elements, and a relationship comes apart beyond a certain distance: width is therefore not a free variable that would be worth maximising, it is a format to be chosen. The format settled on is a centred ceiling, because it behaves like full width on ordinary screens and simply stops growing past that — one value, and no per-screen rule to write.

A newspaper has a fixed format, and this is it. The pages were first locked into `max-w-4xl` (896px), which wasted half of a wide screen. Freeing them completely went too far the other way: on a 2000px screen the content ran edge to edge, the eye had to cross the whole width to connect a project name to its date, and nothing framed the page any more.

Measured, usable content by screen:

| Screen | Content | Occupancy |
|---|---|---|
| 1280 | 1232px | 96% |
| 1440 | 1392px | 97% |
| 1920 | 1392px | 73% |
| 2000 | 1392px | 70% |

Below 1440px the behaviour is that of a full width; beyond it, the page stops. **One value to set**, in `.page`.

The `h1/h2/h3` headings take the serif automatically, through a rule in the `base` layer. That is the line separating "monochrome application" from "printed page": a heading in a grotesque reads as chrome, a heading in a serif reads as an article.

No font is downloaded. The serif stack relies on faces shipped with the system (Iowan Old Style and Palatino on macOS, Georgia on Windows) — previews have to work offline and under a strict CSP.

## The icons

> **Why it works this way —** An icon has to take the colour of the text beside it and draw the same for everyone; an emoji can do neither, because it is a small colour image supplied by the operating system, and a different one under Windows, macOS and Android. A vector path painted in `currentColor` — the CSS keyword that picks up the text colour currently in force — inherits the theme instead, without being told to, and is sized like a character.

`src/ui/Icon.tsx` — 38 vector icons in `currentColor`.

```tsx
import { Icon, IconButton } from '../ui'

<Icon name="link" />                                  {/* 20px by default */}
<IconButton label="Delete"><Icon name="trash" /></IconButton>
```

The interface was built out of emoji. Those are **colour bitmaps**: the theme cannot touch them, they look like stickers on a black-and-white shell, and they render differently on every system (Segoe UI Emoji, Apple Color Emoji, Noto) — the toolbar was never twice the same. They also rendered at around 12px, too small to read as an icon.

`Icon` is `aria-hidden` by construction: the accessible name belongs to the button, and `IconButton` enforces it.

## The rules

> **Why it works this way —** Each of these five lines answers a drift observed in the code, not a theoretical preference: dozens of text sizes invented case by case, seven improvised z-index values plus two floating panels carrying no z-index at all that overlapped to the pixel, four focus declarations for a hundred and seven buttons. A rule stated briefly can be checked in review, and sometimes by a test, which a paragraph of intentions cannot.

**1. A component describes what a control *is*, never its colour.**
`bg-surface`, `text-ink-muted`, `border-line` — yes. `bg-slate-800`, `text-indigo-400` — no: that will not follow the theme.

**2. The type scale has six steps, and nothing between them.**
`caption` 11px (badges only) · `body-sm` 13px (controls, toolbar) · `body` 14px (**the default**) · `lead` 16px · `h3` 20px · `h2` 28px · `display` 44px.
Arbitrary sizes (`text-[11px]`…) are forbidden. Figures that change under the eye — zoom, dimensions, footprints — take `font-mono` so they stop jittering.

**3. Every clickable target is at least 32px high.**
The primitives enforce it. Going through them is enough.

**4. Focus is visible everywhere.**
A single rule in the `base` layer of `index.css`, written with `:where()` so it stays at zero specificity. Do not cancel it.

**5. One z-index scale, and only one.**
`panel: 20` · `menu: 30` · `overlay: 40` · `modal: 50` · `top: 60`. No `z-[70]`.

## The primitives

> **Why it works this way —** Requirements that keep recurring — a name a screen reader can pronounce on a button with no text, a label genuinely tied to its field, a focus trap in a dialog, a target of at least 32 pixels — hold once and for all if they live inside a component, and are lost every other time if they have to be remembered at each call site. These primitives exist, then, to make the correct behaviour shorter to write than the sloppy one.

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

## The guardrails

> **Why it works this way —** Contrast is one of the few qualities of an interface a machine can settle on its own: it is a number, computed from two colours and compared to a published threshold. The check is wired to the file that ships, and not to a copy of its values: a hue retouched by hand therefore fails the suite straight away, instead of waiting for a user to stop being able to see a label.

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

> **Why it works this way —** A centralised system only holds if the way to modify it is written down somewhere: otherwise the first emergency goes around it and puts a hard-coded colour back into a component. The three moves recalled here — declare the colour in both themes, expose it in `tailwind.config.js`, add its pair to the contrast test — are the ones nobody stated in the old version, the one where 83 of the 109 colour classes followed no theme at all.

- **Changing the accent**: one variable, in both theme blocks. Nothing else.
- **Adding a theme**: duplicate a token block. No component to touch.
- **Adding a colour**: first ask yourself whether it is an existing *role*. If it is, use the token. If not, add the token **in both themes**, expose it in `tailwind.config.js`, and add its pair to the contrast test.

## What was not done, and why

> **Why it works this way —** An option dismissed without leaving a trace comes back every six months and is re-evaluated from scratch; recorded together with its reason, it is only reopened if the reason has changed. This one is peculiar to a generator: the vocabulary of classes Mocky writes into mockups has already left for its users, inside screens they produced and exported, and that no update to the tool can go back and fix.

**No migration to Tailwind 4.** The main gain (native variables) is already obtained in v3 through `rgb(var(--x) / <alpha-value>)`. v4 forces `shadow-sm`→`shadow-xs`, `outline-none`→`outline-hidden`, changes the default ring, drops the JS config in favour of `@theme`, moves the Play CDN to `@tailwindcss/browser` — and above all **would invalidate the v3 classes of screens already generated**, along with the whole export chain (`src/lib/export/`). Real cost, zero user benefit.
