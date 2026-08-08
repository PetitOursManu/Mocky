# The interface

Mocky puts a great many controls on screen, and hardly any of them are labelled
with a verb. That is deliberate — a canvas tool that spelled out what each
button did would be a wall of text — but it leaves a gap this page fills:
**what each control actually does, which pairs of controls get confused with
each other, and which ones spend tokens.**

It is not a tour of the product. It assumes you can see the button; it tells you
the part you cannot see.

---

## How to read this page

Every icon below is the real one, drawn from the same path data as the running
interface (`src/ui/Icon.tsx`). If a button in your window looks like the icon in
the table, it is that button.

Every label is quoted verbatim from `src/i18n/en.ts` and `src/i18n/parts/*.ts`.
The French interface is not a translation of the English one — both are written
— so if you run Mocky in French, read `fr/interface.md` instead of translating
back.

Cost is the last column of every table:

| Cost | Meaning |
|---|---|
| **free** | Nothing leaves the browser. A state toggle, a local computation, a file written from memory. |
| **server** | A round trip to the Mocky backend. No model, no tokens — but it needs the backend up. |
| **model** | Spends tokens. Every one of these is behind an explicit click; none of them ever fires on its own. |
| **image** | Calls the image provider. Slower and more expensive than a text call. |

There is a recap of every **model** control at the [end of this page](#everything-that-spends-tokens).

---

## The main navigation

The bar across the top of every route. Nothing here touches a project's
contents; it is all navigation, theme and account.

| | Control | What it does | Cost |
|---|---|---|---|
| | **Mocky** (wordmark) | `Mocky home` — back to the project list. | free |
| | Project name (breadcrumb) | **Two different controls wearing one label.** Away from a project, it is `Back to the project`. Inside the project, it turns into an input: `Rename project`. Enter or leaving the field commits, Escape cancels. | free |
| | `Home` | The project list. | free |
| | `DESIGN.md` | The full-page art-direction editor. | free |
| | `Media` | The image library as a page rather than as a modal. | free |
| | `Settings` | Provider, key, model. | free |
| | `Admin` | Only rendered when your account is an admin — and the route checks a second time, so a hand-typed URL lands on `Admins only.` rather than on the panel. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg> | `Docs` | The only entry that is a real link: it opens `https://mocky-docs.emanuelvigreux.fr` in a new tab. The small arrow is what says so. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg> <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg> | Theme | `Switch to the Paper theme` / `Switch to the Ink theme`. **The icon is the destination, not the current state**: a sun means "go light", and it is shown while you are in the dark theme. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0"/></svg> | Account | `Signed in — click to sign out`. It asks for confirmation first, and signing out leaves your projects on this device. | free |
| | `Sign in` | Opens the sign-in modal. `Sign in to keep your projects on every device`. | free |

**Leaving a project is not free of consequence, even though the button is.**
`Home`, `DESIGN.md`, `Media`, `Settings` and `Admin` all unmount the project
view, and its cleanup aborts the generation in flight and every repair attempt
with it. If Mocky is mid-generation, that click cancels it.

### The folded masthead

Below `md` the row collapses to three controls: the sync indicator, the theme
toggle, and <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M10.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M17.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0"/></svg> `Navigation menu`, which opens a sheet. The sheet replays
the same routes as 44-pixel rows, adds `Docs` as a link, and appends
`Sign out` to the account row — the one label the wide header does not show,
because there the account button *is* the sign-out button.

---

## The projects page

### The header

| | Control | What it does | Cost |
|---|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3"/></svg> | `Search projects…` | Filters on the project name **and on every screen's name and prompt**. A project you cannot name is findable by what you asked for inside it. Not rendered at all with five projects or fewer. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h4v16H4zM10 4h4v16h-4zM17.5 4.6l3.3 15.1"/></svg> | `New folder` | Opens the folder dialog. Hidden until at least one project has a screen. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 6L20 5"/></svg> <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l14 14M19 5 5 19"/></svg> | `Select` / `Done` | Enters and leaves tick mode. Leaving it empties the selection. Hidden when there is only one project. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16M4 12h16"/></svg> | `New project` | Creates the project and opens it immediately. | free |

### The selection bar

Sticky, and only present in tick mode.

| | Control | What it does | Cost |
|---|---|---|---|
| | `Tick all` / `Untick all` | **Ticks what is visible, not what exists.** With a search active, the batch is the search result — which is how you delete "everything called draft" without ticking eleven boxes. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h4v16H4zM10 4h4v16h-4zM17.5 4.6l3.3 15.1"/></svg> | `File` | Opens the filing dialog for the ticked projects. Disabled with nothing ticked. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg> | `Delete` | Two-line confirmation: the count of projects, then the count of screens they hold, when they hold any. Disabled with nothing ticked. | free |

The tick boxes themselves are drawn, with a real `<input>` underneath. That is
not decoration for its own sake — a native checkbox paints the operating
system's accent colour, the one colour on the page the theme cannot reach.

### Lead, index, drafts

| | Control | What it does | Cost |
|---|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg> | `Open` | Opens the project. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg> | `Delete project` | One confirmation, naming the project. | free |
| | Lead thumbnail | Clickable, but deliberately **not** a button: it is a `div`, marked `aria-hidden`, because it duplicates the `Open` control beside it. A focusable element hidden from assistive technology is a defect, not a shortcut. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l7 7 7-7"/></svg> <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg> | Fold a section | Collapses a folder, or the `Unfiled` group. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4"/></svg> | `Rename the folder` | A browser prompt. Rendered only on a real folder — never on `Unfiled`, which is not a folder but the absence of one. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h4v16H4zM10 4h4v16h-4zM17.5 4.6l3.3 15.1"/></svg> | `File “{name}”` | Files that one project. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg> | `Clear all` | Deletes every empty draft at once, behind a single confirmation. | free |

### The two folder dialogs

`New folder` asks for a name (`Folder name`, placeholder
`Client, Drafts, To review…`) and a list of projects to put in it.
**`Create the folder` stays disabled until both are filled**, because a folder
in Mocky *is* its projects: there is no record of an empty one to store.

`File` shows the existing folders as chips, offers a new-folder field, and adds
`Take out of the folder` — but only when at least one of the chosen projects is
currently filed, since otherwise the button would undo nothing.

---

## The project toolbar

Top-left of the canvas, and the densest thing in the product. Three defences
keep it on screen: labels fold away below `md`, everything past `Modify` folds
into `More`, and the row scrolls itself rather than pushing the page sideways.

### The three that never fold

| | Control | What it does | Cost |
|---|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg> | `Back` | Leaves the project. As above: this aborts a generation in flight. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg> | `Link` | `Draw links between screens`. Click an element inside a screen, then pick a destination. Turning it on turns `Modify` and `Annotate` off — and closes `System` or `Audit`, because the Links list it opens wants the same slot they do. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4"/></svg> | `Modify` | `Click an element in a screen, then describe a change — no code needed`. Also mutually exclusive with the other two. | free |

The exclusivity is the point: all three modes make a click inside a screen mean
something different, and two of them at once would make a click mean nothing.

### The eight behind "More"

Rendered as buttons at `md` and above, as menu rows below it — from a single
list, so the two can never drift apart. <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M10.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M17.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0"/></svg> `More` itself only exists
below `md`.

| | Control | What it does | Cost |
|---|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5V4a1.5 1.5 0 0 1 3 0v7m0-1.5a1.5 1.5 0 0 1 3 0V13m-9 0a1.5 1.5 0 0 0-3 0v2a7 7 0 0 0 7 7h1a7 7 0 0 0 7-7v-4"/></svg> | `Interact` | `Make all screens interactive (clickable buttons, animations)`. Hands the pointer to **every** preview at once. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/></svg> | `Annotate` | `Snip a region of a screen into the chat as a numbered reference`. The rectangle you drag becomes a thumbnail attached to the composer, and it travels with your next prompt. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM10 18h4"/></svg> | `Frame` | `Show or hide the iPhone frame on mobile screens`. **Disabled when the project has no mobile screen** — and the preference is not cleared with it, because it lives in one browser-wide key shared by every project. Disabling the control rather than resetting the setting is what keeps your other projects framed. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6"/></svg> | `System` | `Live design system — your DESIGN.md tokens, and a way to recolor them`. Closes `Audit`, or `Link` mode, if one was open. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5l8-3Z"/></svg> | `Audit` | `Evaluate SEO and accessibility`. Closes `System`, or `Link` mode, if one was open — all three want the same slot. **Opening the panel evaluates nothing.** | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h12v12H3zM15 10l6-4v12l-6-4z"/></svg> | `Motion` | `Cut a video from the media library`. Opens the Motion panel — see below. | free to open |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l14 8-14 8V4Z"/></svg> | `Demo` | `Play the prototype — follows the links you placed`. Starts on the selected screen, or the first one if nothing is selected. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/></svg> | `Export` | `Export a runnable Vite + React + Tailwind project`. Opens a menu of three stacks. | free |

The rule falls before `Demo`. The last two are the two ways to get something
**out** of a project: a demo of screens that already exist, an archive of code
that already exists. `Motion` is on the other side of it, with the modes and the
panels, because it is the opposite operation — it makes something that did not
exist a minute ago, out of the media library, and it opens a panel exactly as
`System` and `Audit` do. Beside `Export` it read as a fourth output format, which
is the one thing it is not.

It is still **deliberately not in a screen's context menu**. A cut is made from
the media library; it does not read a screen and cannot be derived from one.
Hanging it off a screen would promise a relationship the pipeline does not have,
and the first thing the panel does — ask which pictures to use — would contradict
it.

---

## The canvas

### The zoom bar

Bottom-left of the canvas from `xl` up; below that it moves to the top and
tucks under the toolbar. Geometry, not taste: the bar is pinned to the left
margin and the composer is a centred 672px block, so seven controls only clear
it past roughly 1200px of window. Any narrower and the bottom-left corner sits
behind the composer, which is opaque — which is how the only zoom control in
the product came to be invisible on a laptop.

| | Control | What it does | Cost |
|---|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3M8 11h6"/></svg> | `Zoom out` | Steps out around the centre of the viewport. | free |
| | `100%` | The current scale. Not a control. | — |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3M11 8v6M8 11h6"/></svg> | `Zoom in` | Steps in around the centre of the viewport. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg> | `Fit all` | Frames every screen, and **keeps** doing so as screens are added, until you move the view yourself. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM12 2v3M12 19v3M2 12h3M19 12h3M13.4 12a1.4 1.4 0 1 0-2.8 0a1.4 1.4 0 1 0 2.8 0"/></svg> | `Zoom to the latest screen` | Frames the most recent screen. Disabled when there is none. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg> | `Arrange` | Repacks the board, respecting each screen's real size — a mobile screen does not get a desktop-sized cell — then fits the result. | free |

### What the mouse does

The hint in the top-right corner says it, and changes with the mode. Written out
once:

- **Drag on empty space** — marquee selection. Hold a modifier to add to it.
- **Space, or middle-click drag** — pan.
- **Wheel** — pans. **Ctrl or ⌘ + wheel** — zooms. A trackpad pinch arrives as
  the second, which is why it means zoom.
- **Double-click a screen** — that one screen becomes interactive, and says so
  with an `Interactive — click outside to leave` badge. This is not the same
  thing as the `Interact` toolbar button, which does it to all of them.
- **Right-click a screen** — the context menu.

---

## A selected screen's frame

Select exactly one screen and a small bar appears above it. Select two and it
disappears — every action in it is about one screen.

| | Control | What it does | Cost |
|---|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4"/></svg> | `Rename` | Edits the name in place. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z"/></svg> | `Show the request that created this screen` | Opens the original prompt, with a copy button. On a screen imported or made before this was recorded, the label reads `No request recorded` instead. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l14 8-14 8V4Z"/></svg> | Animations, this screen | Cycles three states, not two: follows the composer / forced on / forced off. A two-state switch would strand a screen on an override you could no longer clear. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M10.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M17.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0"/></svg> | `More options (or right-click the screen)` | The same context menu the right-click opens. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg> | `Delete screen` | One confirmation. | free |

Drag any of the eight handles to resize; the pixel size is printed under the
frame while it is selected.

### The badges

They sit beside the name, and two of them show even when the screen is not
selected — a screen behaving unusually should say so without being clicked.

| | Badge | What it means |
|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z"/></svg> | (pin, before the name) | `Reference screen for the layout of new screens`. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l14 8-14 8V4Z"/></svg> | `Still` | This screen never animates, whatever the composer says. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5V4a1.5 1.5 0 0 1 3 0v7m0-1.5a1.5 1.5 0 0 1 3 0V13m-9 0a1.5 1.5 0 0 0-3 0v2a7 7 0 0 0 7 7h1a7 7 0 0 0 7-7v-4"/></svg> | `Interactive — click outside to leave` | You double-clicked this one. |

### The cards beside the frame

When a screen was built with a Muse image, that image sits in the grid to the
right of the frame — outside its bounds, so it never covers the design. Below a
certain zoom it is not drawn at all, on the grounds that an illegible card that
sweeps across its neighbours is worse than no card.

The badge under the picture names its **role**, which is the thing you cannot
see by looking at it:

- `Placed` — the image is in the screen, as a real `<img>`.
- `Inspiration` — the image is **not** in the screen. It was shown to the model
  as an art-direction reference: palette, light, composition.
- `Placed + ref.` — both.
- `Muse image` — the role was never written down. Not a fourth role: it is what
  a screen generated before the distinction existed says instead of guessing.

Under it, the media **attached** to the screen, when there is one — an exported
cut, or a scroll sequence. Attached, never *used*: none of it is in the screen's
code, which is the whole distinction `Change the media…` keeps in two sections.
The still is drawn by the browser out of the file itself, because no poster is
cut for a cut (that would mean ffmpeg, the one dependency Motion deliberately
does not have). Clicking it plays the cut; a sequence opens in `Media`, where
the frame-by-frame player already lives.

A media the library has lost keeps its card, and the card **says so**:
`Media not found`, and the caption tells you it is still attached until you
detach it. That state is reached by the file failing to load — a deletion, or a
hash belonging to another account — and it exists because the alternative was a
black rectangle under the ordinary caption, which is also what a cut opening on
a black frame looks like.

Under that, the design system this screen was actually generated from. The card
holds one of two buttons, **never both** — which is why they are easy to
mistake for each other: you only ever see the one that applies, and the other
is what the same corner of the screen shows on a different screen.

| | Control | What it does | Cost |
|---|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 6L20 5"/></svg> | `Use this design` | Shown when a design **was** recorded. Restores the recorded copy as the project's current direction, byte for byte. No re-reading, no model call. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/></svg> | `Derive a DESIGN.md` | Shown when nothing was recorded, and only if the screen has code to read. Asks a model to read the screen and write the design system it implies. | model |

When something was recorded, the little rendering above the swatches is itself a
button: it opens the document full size, where the same `Use this design` sits
beside `Save as…`. At canvas zoom that card is a postage stamp, and a design
system is judged on its words rather than on eight squares of colour.

---

## The screen context menu

Right-click a screen, or use <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M10.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M17.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0"/></svg> in its label bar.

| | Item | What it does | Cost |
|---|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/></svg> | `Regenerate (new variant)` | Re-runs the screen's own original prompt for a different result. The previous code is kept, so `Revert to the previous version` undoes it. | model |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg> | `Polish (detect and correct)` | The quality pass: check, correct, check again. See [Quality pass](quality.md). | model |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4"/></svg> | `Rename` | A browser prompt. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9h11v11H9zM5 15H4V4h11v1"/></svg> | `Duplicate` | Copies the screen, named `{name} (copy)`, placed by the same rule as any new screen rather than on top of the original. **The links are not copied** — a duplicate arrives inert, because a hotspot pointing where the original pointed is a flow nobody drew. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg> | `Share (QR code)` | Creates a temporary public link to this one screen, with a lifetime you choose. A snapshot: editing the screen afterwards does not change what the other person sees. | server |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l-6-6 6-6M15 6l6 6-6 6"/></svg> | `Show code` | The generated source, read-only. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z"/></svg> | `Pin as layout reference` / `Unpin as reference` | Makes this screen the layout the **next** generations imitate. It does not change this screen. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/></svg> | `Download .tsx` | Writes the component to a file. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5"/></svg> | `Revert to the previous version` | Only present when there is a previous version. Every rewrite of the code records one — edit, automatic repair, polish, regenerate, add animations, audit fix, and the two free ones, an image swap and an instant text change. **One level, and it clears itself**: reverting drops the stored version, so the item disappears and there is no redo. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/></svg> | `Make this screen my DESIGN.md` | Reads the screen and writes the project's direction from it. Asks for confirmation when a direction already exists. | model |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6"/></svg> | `Edit DESIGN.md` | The full-page editor. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h4v16H4zM10 4h4v16h-4zM17.5 4.6l3.3 15.1"/></svg> | `Change the media…` | Lists the images actually present in the code and swaps them, one place or everywhere. Sources: the library, an upload, or a fresh generation. | free / image |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg> | `Delete screen` | One confirmation. | free |

### The three groups of small buttons

At the bottom of the menu, three rows that look alike and are not.

**`Display format` — `Mobile` · `Tablet` · `Desktop` · `Full`.** Resizes the
frame and tells later passes what device this is. `Full` means full height,
fitted to the content. Free: no code is rewritten.

**`Add animations` — `Subtle` · `Moderate` · `Rich`.** Rewrites the code to add
motion, keeping content and layout. Costs **model**, and is revertable.

**`Play animations` — `Auto` · `Yes` · `No`.** Decides whether the motion
already in the code runs. Free. Three visible choices rather than one cycling
label, because in a menu a single item that changes wording never shows you what
the other states are.

The middle one spends tokens. The two beside it do not.

---

## The composer

The floating bar at the bottom. It is the only control in the product that
changes verb depending on what is selected.

### The chips above the field

| | Chip | What it does | Cost |
|---|---|---|---|
| | `New direction` | This prompt writes the project's art direction, which every screen after it follows. **It unticks itself once the screen is generated.** Hidden while editing a screen — an edit reworks what a direction produced, and letting it rewrite that direction would reattribute every other screen in the project. | free (arms the next generation) |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg> | `Muse` | Inspiration, art direction and real copy. Turning it on changes what a generation costs — see [Muse](muse/overview.md). | free (arms the next generation) |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l14 8-14 8V4Z"/></svg> | `✦ Animations auto` / `✦ Animations forced` / `✦ No animation` | Three states. `✦ No animation` also holds the screens already on the canvas still, so the button and the board never disagree. | free |
| | `Format` | The viewport preset for the next screen. Only shown when creating, not when editing. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l7 7 7-7"/></svg> | The brief | Folds and unfolds the Muse dossier. Shown only when Muse is on and you are creating. `Show the full brief` / `Collapse the brief`. | free |

Above those sit the transient rows: numbered annotation thumbnails, each with a
remove button that is visible at rest rather than on hover — hover does not
exist on a phone, and a control that appears only on hover is not hard to find
there, it is unreachable. And, when screens are selected, one chip per screen
with `Remove from selection`, plus `clear`.

### The field and its two buttons

| Control | What it does | Cost |
|---|---|---|
| The text field | `Describe another screen to add to this project…` when nothing is selected; `Describe a change to apply to the selected screen…` when something is. **Ctrl/⌘ + Enter** submits. | — |
| `Generate` | Creates a new screen. | model |
| `Update ({count})` | The same button, when screens are selected: edits those screens instead of creating one. | model |
| `Stop` | Appears while working. Aborts the request. | free |

That one button doing two jobs is the single most common surprise in Mocky: if
a screen is selected, you are editing it, and there is no new screen coming.
`clear` next to the chips is the way out.

---

## The side panels

All three open at the same place, on the right, under the toolbar.

### Links

Open with `Link`. Lists every link in the project, with a count.

| | Control | What it does | Cost |
|---|---|---|---|
| | `Done` | `Leave link mode`. | free |
| | `From which screen` | Which screen to read. The screen is chosen **here** and not on the canvas, because link mode makes a click inside a frame designate an element rather than the frame. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/></svg> | `Suggest links` | Reads the rendered screen and proposes links. **Despite the wand, no model is involved**: it matches the `href` the model wrote, and labels that echo another screen's words. The proposal dialog says which of the two reasons applies for every row, and nothing is written until you confirm. | free |
| | A link row | Click to centre the canvas on it. | free |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l14 14M19 5 5 19"/></svg> | `Delete link` | Removes that one link. | free |

### System

Open with `System`. Your DESIGN.md's colour tokens, as a palette and a rendered
sample.

| Control | What it does | Cost |
|---|---|---|
| A swatch | Selects the token. The panel then offers a hex field and `Apply`. | free |
| `Apply` | **Rewrites that one token in DESIGN.md.** Every future generation follows the change; nothing already on the canvas moves. | free |
| `Edit` | `Open the full DESIGN.md editor`. | free |

### Audit

Open with `Audit`. One screen at a time, chosen from thumbnails — thumbnails
already captured, never taken here, because a capture needs a same-origin iframe
and running model-written code on Mocky's own origin is not something a panel
should do as a side effect of opening.

| Control | What it does | Cost |
|---|---|---|
| A thumbnail | Picks the screen, and frames it on the canvas so the report is about something you can see. | free |
| `Evaluate` / `Evaluate again` | Runs the deterministic rules over an AST, in the browser. Works with the backend down. | free |
| `Deep analysis` (checkbox) | Adds the questions a rule cannot settle — does the `alt` describe the picture, does the heading describe its section. Off by default. | model, when the evaluation runs |
| `Fix` | Corrects one finding. | model |
| `Fix all` | Corrects every enforceable finding. | model |

Two things the panel says out loud rather than in a tooltip.
**`Source-only analysis`**: the score is about markup and what classes declare,
so a 100 does not mean "conformant". And a family row can read `not applicable` or
`not measured` instead of a number — a screen with no form and a screen whose
forms are perfect produce the same empty finding list, and only one of them has
earned a score.

Findings marked `Advisory — not corrected automatically` have no `Fix` button by
design; they are judgement calls the correction pass is not allowed to spend an
iteration on.

The last block, `Exported document`, is not about the chosen screen at all. It
is computed once for the project and repeated under every screen, because a
Mocky screen is a component: it has no title, no language and no description,
and those three exist only in the HTML the export writes. Nothing there has a
`Fix` button either — the fault, when there is one, is in the project's name or
in its product name, not in any screen's markup.

---

## The Motion panel

Open with `Motion`. A slideshow cut from the media library: one image per scene,
with its duration, its motion and its transition. **The render runs on the
Remotion worker, not in this browser** — and that worker is a separate, opt-in
Docker service, so the first thing the panel does is say whether it is there. Why
it is built that way is in [Motion](video-export.md).

The feature was called "Video export" and the file names still are. That is
deliberate and explained on the page above: what a user reads says Motion, what a
developer greps says `video`.

An account the feature is not enabled for gets one terse sentence and nothing
else: it learns nothing about how the instance is configured, nor about what a
valid cut looks like.

There is **one form**, and two ways to fill it in — behind a switch, one visible
at a time. Stacked, the two of them filled a 900-pixel window on their own, so
the scenes, the running total and the render button all started below the fold on
a panel nobody had touched yet. They are alternatives, not steps, and two open
forms said the opposite. Which one you last used survives inside the open panel
and is not remembered afterwards: it is a fact about the cut you are making now.

| Control | What it does | Cost |
|---|---|---|
| `Describe the video` → `Propose a cut` | Sends your sentence and the images you already picked to the model. It **orders and tunes** — durations, motion, transitions, captions. It does not choose the pictures and cannot add any. | model |
| `Start from an image` → `Generate a model image` | Makes one picture from a subject you describe. Nothing continues until you `Keep`, `Regenerate` or `Abandon` it. | image |
| `Or start from a picture in the media library` | The same picker the scene list uses. A library image already exists and you just looked at it to pick it, so it goes straight to the variants with no first confirmation. | free |
| `Produce {n} variants` | Two to six takes on that picture, shown small above the button so you can see what they will derive from. Then you tick the ones worth cutting; anything left unticked stays pending, for good. | image, one call per variant |
| A scene row | Duration, motion, transition to the next, and an optional line of burnt-in text. Move up, move down, remove. | free |
| `Output` | Aspect ratio (`16:9`, `9:16`, `1:1`) and container (`mp4`, `webm`). | free |
| `Start the render` | Queues the job. One render at a time on the instance; you can close the panel and find it again on reopening. | server (minutes of CPU) |
| `Download the video` | The finished file. | free |

**A proposal is a pre-fill, not a mode.** What comes back is written into the
same controls, all of them still live, and replacing a cut you arranged by hand
asks first. A read-only preview would have to be taken whole or thrown away
whole, and the first thing anyone wants to do with a proposed running order is
move two scenes. The switch is about which assistant is on screen; neither of
them is a state the timeline is in, and switching away loses nothing — a brief
you typed, a picture you have not confirmed and a call still in flight all
survive it.

Three things the panel states rather than implies, because each is a fact about
your instance that changes what you get:

- **Whether the variants will really derive from your picture.** With an `Edit`
  image profile configured they come out of an image-to-image model fed with your
  own image; without one they are born of the same text — same subject, another
  photograph. The sentence appears twice: before the click, from what the server
  promises, and afterwards, from what the answer actually did.
- **`{used} s of {max} s`.** Two minutes total, twenty scenes, and the button
  names the reason it will not fire rather than sitting there greyed out.
- **`Last scene: this transition never plays.`** The field is on every scene
  because the schema is uniform. Hiding the control would give one row a
  different shape from the others for no visible reason the moment anything is
  reordered.

When a render fails, the banner is a heading and a next step, never "the export
failed". Four situations arrive as the same kind of error and send you somewhere
completely different: the volume is full (shorten nothing — ask the
administrator), the worker is unreachable (an instance setting, not your cut),
the pictures left the library (replace those scenes), the render stopped
answering (reopen the panel; it may have finished anyway). A fifth is not a
failure at all — `Some images are awaiting your confirmation` means the server
refused a picture nobody has looked at, which is the whole reason that guard is
on the server and not in this panel.

**Where the finished file goes**, and the panel says it rather than leaving a
download link that disappears with it: `Media`, under the **`Motion`** tab —
attached to the project you cut it in, or to no project at all when you cut it
from the standalone Media page. That tab carries the name of the feature, not of
the object, because it is where the panel sends you and the two have to read the
same. The object itself is a **cut**, the word this panel already uses in
`Propose a cut` and `New cut`; a scroll sequence in the `Videos` tab is a
*sequence*, and calling both of them a video is what made an export impossible to
find in the first place.

---

## The modals

Everything that opens over the canvas. The first is a dropdown rather than a
dialog, and it is listed here because it is where the export decision is
actually made.

| Modal | Opened by | What is worth knowing | Cost |
|---|---|---|---|
| `Runnable project (.zip)` | `Export` | Three stacks: `shadcn-ready`, `Plain Tailwind`, `daisyUI`. The zip is built in the browser and the exported HTML carries the interface language, which is what makes an exported French page readable aloud. | free |
| `Link` → `which screen?` | Clicking an element in link mode | Picks the destination. `Cancel` leaves nothing behind. | free |
| `Element` | Clicking an element in modify mode | See below — it holds three different costs in one card. | mixed |
| `Code` | `Show code` | Read-only. | free |
| `Share this screen` | `Share (QR code)` | A lifetime of `1 hour`, `24 hours` or `7 days`, a QR code, and `Revoke`. | server |
| `Media in “{name}”` | `Change the media…` | **Two sections, never one list.** `Images in the screen’s code`: per image, `Replace`, or `Everywhere ({n})` when the same file appears several times, or one slot at a time — this **rewrites the source**, and `Revert` undoes it. `Media attached to the screen (not in the code)`: a cut or a sequence to hang on the canvas card, and `Detach` — this **leaves the code alone**. `Upload a file` is free; `Generate` calls the image provider. | free / image |

The `Element` card, opened by clicking something in `Modify` mode, is the one
place where three costs sit in one dialog:

- **`Text` → `Update`** — free *when the text you typed is a unique verbatim
  match* in the source, in which case it is a string substitution and lands
  instantly. When it is ambiguous, it silently falls through to a model edit.
- **`Recolor` swatches** — each one is a model edit of that element. They are
  one tap, which is exactly why they are worth flagging: a swatch that costs
  tokens looks identical to a swatch that does not, and the panel next door has
  swatches that do not.
- **`Or describe any change` → `Apply change`** — a targeted model edit.
  **Ctrl/⌘ + Enter** submits.

The note at the bottom of that card says the same thing in one line: text
changes apply instantly when they are unique, other changes go through the
model, everything is revertable from the screen menu.

---

## Controls you will confuse

### This, not that

| This | Not this | The difference |
|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5V4a1.5 1.5 0 0 1 3 0v7m0-1.5a1.5 1.5 0 0 1 3 0V13m-9 0a1.5 1.5 0 0 0-3 0v2a7 7 0 0 0 7 7h1a7 7 0 0 0 7-7v-4"/></svg> `Interact` (toolbar) | Double-clicking one screen | The toolbar button makes **every** preview clickable at once. The double-click makes exactly one, and that one wears an `Interactive — click outside to leave` badge. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l14 8-14 8V4Z"/></svg> `Add animations` (context menu) | `Play animations` (context menu) | The first **rewrites the code** to add motion — a model call, revertable. The second only decides whether motion that is already there runs. They sit two rows apart in the same menu. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l14 8-14 8V4Z"/></svg> Composer animation switch | <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l14 8-14 8V4Z"/></svg> A screen's animation button | The composer's switch is the default for screens **generated from now on**, and also holds the board still when set to `✦ No animation`. The frame's button overrides that one screen, in three states, including "go back to following the composer". |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 6L20 5"/></svg> `Use this design` (beside a frame) | <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/></svg> `Make this screen my DESIGN.md` (context menu) | The first restores a **recorded** document, exactly, for free. The second asks a model to **read the screen and write a new one**. Same intent, opposite mechanism, and only one of them costs anything. |
| `Apply` in the System panel | A `Recolor` swatch in the Element card | The System panel rewrites a token in DESIGN.md: free, and it changes **future** generations only. The Element swatch is a model edit of **this** element, right now, and leaves DESIGN.md alone. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z"/></svg> `Pin as layout reference` | `Use this design` | The pin governs **layout** for the next screens. The design card governs the **art direction**. A screen can be one, the other, both or neither. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6"/></svg> `System` | <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6"/></svg> `Edit DESIGN.md` | Same icon, two depths: the panel shows the tokens and recolours them; the page is the document itself. `Edit` inside the panel is the bridge. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/></svg> `Regenerate (new variant)` | <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg> `Polish (detect and correct)` | The first throws the screen away and asks again from the same prompt: a different design. The second keeps the design and fixes named defects in it. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5l8-3Z"/></svg> `Audit` findings | <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg> `Polish (detect and correct)` findings | Two catalogues, two scores, two correction prompts. One is about markup, the other about taste. Neither one's score appears in the other's field. |
| `Generate` | `Update ({count})` | The same button. If a screen is selected you are editing, not creating. |
| `Tick all` | "select every project" | It ticks the **visible** projects. Under a search, that is the search result. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/></svg> `Suggest links` | Anything AI-shaped | Deterministic. It reads what is already in the rendered screen; it does not ask a model to imagine a flow. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg> Theme button | The current theme | The icon is where you are going, not where you are. |

### The three correction loops

Mocky can rewrite a screen for three different reasons, and the three are not
interchangeable. Merging them is the tempting refactor, and it breaks all three.

| | Repair | `Polish (detect and correct)` | `Fix` / `Fix all` |
|---|---|---|---|
| **Where** | Nowhere — no button | Screen context menu | The `Audit` panel |
| **Trigger** | The preview iframe reports a render or compile error | You ask for it | You ask for it |
| **What it is told** | Fix *only* the error, do not restyle | Fix these named findings, change nothing else | Fix the markup; the screen must look identical afterwards |
| **Budget** | 2 attempts | 2 iterations | 2 iterations |
| **Cost** | model, automatic | model | model |

Read the middle row again: each instruction is fatal to the other two.

- A slop finding **is** a styling problem. Hand it to a model told not to
  restyle and it returns the screen unchanged, having obeyed.
- An accessibility fix that restyles has **failed even when every finding is
  gone**, because a semantics correction came back as a redesign.
- And a repair that felt free to restyle would answer a compile error with a new
  design, which is not what anyone asked for while looking at a broken screen.

What they do share is the transport, the loop with its four stop conditions, and
the write-back conventions — an abort controller, a snapshot of the code checked
again before writing, and a previous version so `Revert to the previous version`
works. That is
`runPolishLoop`, and it is generic over its report type for exactly this reason:
the stopping rules are worth having once, and the checks that feed them are not
the same check.

---

## Everything that spends tokens

Nothing in Mocky calls a model on its own. Every entry below is a click, and
this is the complete list.

| Control | Where | Note |
|---|---|---|
| `Generate` | Composer | With `Muse` on, the one click also runs the inspiration pass and may call the image provider. |
| `Update ({count})` | Composer | One call per selected screen. |
| Repair | Automatic, after a failed render | The only unprompted model call — and it only happens after a generation you asked for produced code that will not run. Capped at two attempts. |
| `Regenerate (new variant)` | Screen context menu | |
| `Polish (detect and correct)` | Screen context menu | The check itself calls a model for the rules a regex cannot settle, then up to two corrections. |
| `Add animations` — `Subtle` / `Moderate` / `Rich` | Screen context menu | |
| `Make this screen my DESIGN.md` | Screen context menu | |
| `Derive a DESIGN.md` | Design card beside a frame | |
| `Text` → `Update` | Element card | **Only** when the text is not a unique verbatim match. Otherwise free and instant. |
| `Recolor` swatches, custom hex → `Go` | Element card | Every swatch is a model edit. |
| `Apply change` | Element card | |
| `Deep analysis` | Audit panel | Changes what `Evaluate` costs. Off by default. |
| `Fix` / `Fix all` | Audit panel | |
| `Generate` (an image) | `Change the media…`, image library | Calls the image provider, not the text model. |
| `Propose a cut` | Motion panel | The only model call in Motion. It orders and tunes the images you picked; it never picks one. |
| `Generate a model image`, `Produce {n} variants` | Motion panel | The image provider, once per picture. Six variants is six calls. |
| `Start the render` | Motion panel | No model and no provider — but minutes of CPU on the render worker, which is the most expensive click in the product on a small box. |

And the notable absences — things that look expensive and are not:
`Evaluate` in the audit panel with `Deep analysis` off, `Suggest links`, `Use this design`, `Export`,
`Download .tsx`, `Duplicate`, `Arrange`, the whole `System` panel, opening the
`Motion` panel, and every format, frame and playback toggle in the product.
