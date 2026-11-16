---
description: Start a new project from a saved direction or from a whole project kept as a template. Both live in Media, under Design.
badge: New
---

# Directions and templates

Two kinds of starting point can be reused, and they do different things:

| | What it is | What it gives a project |
|---|---|---|
| **Direction** | A DESIGN.md kept in your design library | How its next screens look. No screen. |
| **Template** | A whole project, kept as a starting point | Its screens and their code, its direction and its settings. |

Both are listed in **Media → Design**, in two sections.

## Directions

These are the documents you saved from DESIGN.md with `Save as…`. Each card shows
the palette, and can be renamed or deleted.

- On the **Media page**, `New project with this direction` creates an empty
  project that already follows it, in the folder the projects page was showing,
  and opens it.
- Inside a project (the media library opened from a project),
  `Apply to this project` makes it **this project's** direction. The global
  DESIGN.md, which every project without its own direction follows, does not
  change.

## Project templates

Save a project as a template from its card on the projects page (the bookmark icon),
or from `Export ▾ → Save as template` inside the project. You name it, and Mocky
keeps a copy on the server, in your account. Nobody else on the instance sees it.

A template keeps:

- the project's **direction** — its own, or the global DESIGN.md it was following
  when you saved it, so the template means the same thing later;
- its **settings**: brand identity, Créatif, Creations and Motion Ultra (with its
  picture count and video background);
- every **screen**: its code, its name and request, its type, page format and
  fold, its device, its place on the canvas, its links to the other screens of
  the template, and the shared-layout reference.

It does not keep the notes, the quality verdicts, the versions, the review
rounds, the campaign, the publications, the demo scenarios or the branch: those
are the history of one project, not a starting point.

**Pictures are not copied.** A screen names its pictures by their address in the
media library, and those files are shared by every project that uses them. A
picture you delete from Media later disappears from the template too, as it does
from every project showing it.

`New project from this template` (Media page) creates a project with fresh
identifiers for every screen and link, in the folder the projects page was
showing, and opens it. Editing the new project never touches the template, and
the reverse.

## From the first composer

An empty project's first composer shows, under the style presets, a row
**From my designs** with your templates and your directions:

- a **direction** becomes this project's direction;
- a **template** fills this project with its screens, its direction and its
  settings. It is offered only while the project is empty: a template is a
  starting point, not something merged into existing work.

## Screens to fill in

A weekly menu, an event poster, a price list: the same design every time, with a
few words and a picture that change. Right-click the screen → **Fill in…**.

1. **Choose the fields**, once. The window lists every text a reader sees and
   every picture from the media library, in the order the page says them. Tick
   the ones that change — a dish, a date, a price, a photo — and give each a
   name ("Monday's dish"). The same words written twice are two places: tick
   the one you mean.
2. **Fill in**, every time. The form asks for each field by its name, already
   holding what the screen says now; a picture is chosen from the library.
   - `Create a filled copy` adds the result to the right of the screen, which
     does not change. Next week, fill in from that copy.
   - `Fill this screen` writes into the screen itself; Revert undoes it.

The values are written in place in the code, **with no model call**: nothing
else on the page moves, and it costs nothing, including on the free plan. A
value that cannot go where it is asked (empty, or a `{ } < >` inside a text) is
not written, and the notice names it. A much longer text may overflow: a
document reports its overflowing pages, and `Fit to page` corrects them.

A field is found again by what it says. If an edit or a polish rewrites its
words, the field is reported **not found** rather than guessed: open
`Choose the fields` and tick it again. The fields travel with the screen into a
template, so a project template of a menu is filled in as soon as it is made.

## Limits

An account keeps up to 30 templates. A template holds at most 80 screens, each
under 512 KB of code, and 6 MB in all. Templates count against the instance's
disk budget like versions and the media library, and they are deleted with the
account. Making a project from a template calls no model and costs nothing,
including on the free plan.
