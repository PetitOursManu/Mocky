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
| **Block** | One element of a screen — a header, a band, a card, a footer | That element in any screen, identical, and its later changes. See [Reusable blocks](#reusable-blocks). |

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

Each template's card shows **the pictures of its screens** — the layout reference
large, up to three more beside it — taken in your browser when it is saved. A
template saved before pictures were kept gets them the first time Media shows it.

### Sections

:::why
Templates that are used together — a post, its story and its LinkedIn visual —
were a list of loose cards to pick one by one, every time.
:::

A **section** is a name several templates share. On a template's card, the
`Section` list moves it into an existing section, into a `New section…` you name,
or out of any (`No section`); when saving a template, the `Section` field does
the same. Media shows each section under its name with the number of templates
and screens it holds, the templates in no section after them.

- `New project from the section` makes one project from all its templates (see
  below what it holds).
- The pencil renames the section on every template in it.
- The cross ungroups it: the templates stay, in no section.

A section is nothing but that name: it exists while a template carries it, and
deleting its last template ends it.

## From the first composer

An empty project's first composer shows, under the style presets, a row
**From my designs** with your templates and your directions:

- a **direction** becomes this project's direction;
- a **template** fills this project with its screens, its direction and its
  settings. It is offered only while the project is empty: a template is a
  starting point, not something merged into existing work;
- a **section**, first in the row, fills it with **all** its templates at once:
  each template's screens keep their places relative to one another, the
  templates are laid side by side, left to right, and the project takes the
  direction and the settings of the section's first template.

The tiles show each template's first picture, so a template is recognised by
what it looks like rather than by its name.

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

### A series from a table

Product sheets, name cards, a month of menus: one row of a table, one copy of
the screen. In **Fill in…**, open the `Series` tab.

1. `Download the template table (.csv)` gives a file with one column per field,
   named after it, and a row holding what the screen says today. Fill it in
   with a spreadsheet, one row per copy.
2. Import it with `Import a CSV`, or paste the rows copied from the
   spreadsheet, header row included. Semicolons, commas and tabs are all read.
3. Check which column fills which field: Mocky matches them by name, and you
   can change any of them or keep the screen's value for a field.
   `Name of the copies` picks the column the copies are named after.
4. The window lists the copies it will make. `Create the copies` adds them in
   a row to the right of the screen, which does not change.

Each copy is filled from the original, with no model call, and keeps its
fields, so it can be filled again on its own. An **empty cell keeps the
screen's value**; a row that changes nothing makes no copy. A photo is named
by the file name it was imported under in the media library (with or without
its extension), or by its library address: import the photos first, then write
their names in the column. A photo the library does not know is left as it
is, and the window names it. At most 50 copies at once.

## Reusable blocks

:::why
A header with the logo, a band of partners, a contact card, a footer: the same
piece comes back in post after post. Asking the model for it again gives
something resembling it; copying it by hand means changing every copy when the
phone number changes.
:::

A **block** is one element of a screen kept on its own — its code exactly as
the screen wrote it, with what it reads (a logo component, a list of partners
declared above the page). It is put back into other screens with no model call,
so it arrives identical, and a change saved into the block can be carried to
every copy.

1. **Save.** In `Modify` mode, click the element, then
   `Save as a block` in the `Element` card. Give it a name and a type
   (header, band, card, footer, other). The element you clicked becomes the
   block's first copy.
2. **Insert.** `Insert a block here`, in the same card, puts the chosen block
   right after the clicked element. Right-click a screen → `Insert a block…`
   puts it at the end of the screen, or on the last page of a document. The
   library lists every block of your account, with where it came from and how
   many copies this project holds; it renames and deletes them too.
3. **Change everywhere.** Change a copy like any element (by hand, by
   `Modify`, with `Fill in…`), click it, then `Save into the block`. Mocky
   lists the other screens holding an older copy — in this project and in your
   other projects — and `Update` rewrites them. A copy changed by hand is
   counted, because the update replaces those changes; a copy holding a locked
   element is left as it is. Opening a project whose copies are behind offers
   the same update. Nothing is updated without the click, and `Revert` on a
   screen undoes it.

What cannot be a block, and the notice says why: the whole screen, one item of
a list the code repeats (save the element holding the list), and an element
that reads the screen's state — a menu that opens, a value a field changes.
A name the block uses that the screen already gives to something else is
renamed in the copy, so the two never collide. A copy is marked in the code
(`data-mocky-block`), like a lock: it follows the screen into a copy, a version
or a template, and a pass that rewrites it simply makes it ordinary code again.
Deleting a block leaves its copies in place; they are no longer updated.

## Limits

An account keeps up to 30 templates. A template holds at most 80 screens, each
under 512 KB of code, and 6 MB in all. Templates count against the instance's
disk budget like versions and the media library, and they are deleted with the
account. Making a project from a template calls no model and costs nothing,
including on the free plan. Each template keeps the pictures of up to four
screens, about 10 kB each, beside it.

An account keeps up to 100 blocks, each under 128 KB. They count against the
same disk budget, are deleted with the account, and inserting or updating one
calls no model.
