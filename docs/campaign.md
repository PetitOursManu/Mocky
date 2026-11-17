---
description: One brief made into a poster, a flyer, a post and a story — each composed for its own format, sharing the facts, the art direction and the pictures.
badge: New
---

# Campaign Studio

A campaign is the same announcement in several places: a poster on a wall, a
flyer in a hand, a post in a feed, a story on a phone. Campaign Studio makes
them **from one brief**. Each format is **composed for itself** — its own
layout, its own hierarchy — while the **key facts**, the **art direction** and
the **pictures** are shared. Change the date in the brief later, and you choose
which pieces to update; nothing is regenerated.

A project is a campaign: its pieces are ordinary document screens on the canvas,
and everything that works on a document — downloading, `Fit to page`, versions,
sending for approval — works on them.

---

## Starting a campaign

:::steps id=start-campaign
1. **Open the panel.** `Campaign` in the project toolbar; on an empty project,
   `Campaign` beside `Flows` under the composer.
2. **Write the brief.** What is announced, when, where, for how much, and how to
   take part — the way you would explain it to a designer.
3. **Read the key facts.** `Read from the brief` lists them: a title, a date, a
   place, a price, a call to action. Correct a value, rename a label, remove one
   or add one by hand.
4. **Tick the formats and choose the picture.** All six are ticked; untick the
   ones you do not need. `Image` decides the campaign's one picture: none,
   generated or a free photo.
5. **Press `Create the campaign`.** The pieces are made one after the other and
   appear on the canvas as they are written. `Stop` ends the campaign where it
   is; what is made stays.
:::

If you press `Create` before reading the facts, they are read first: the pieces
need them to write them the same way.

### Starting from a PDF

:::why
The content often exists already — the weekly menu, a programme, last year's
poster — as a PDF. Retyping it is where a price or a date goes wrong.
:::

`Import a PDF…`, above the brief, reads a PDF **in your browser** (up to 25 MB,
the first 20 pages) and shows what it read before anything is sent:

- **the text**, rebuilt into lines and paragraphs, editable — it becomes the
  brief. Correct it, shorten it, remove what must not appear;
- **the pictures** the PDF contains (photos, a large logo), ticked: they go into
  the pieces. Icons and anything under 150 px are left out;
- **each page**, unticked: tick one to show the model what the document looked
  like. A page is a style reference and is never placed as it is.

`Use for the campaign` replaces the brief, reads its key facts at once — check
them in the list, like a typed brief's — and adds the ticked pictures to the
library, chosen for the next pieces as if you had picked them in the composer.
Then tick the formats (a post and a story, for a weekly menu) and create; the
[publication pack](#publication-pack) writes their captions.

A scanned PDF has no text to read (there is no OCR): the dialog says so, and its
pages can still serve as a reference. A password-protected PDF is refused; save
an unprotected copy.

---

## The formats

| Format | Size | What it shows |
|---|---|---|
| `A3 poster` | 1 123 × 1 587 px (297 × 420 mm) | Seen from three metres: the title and the key-facts block dominate. |
| `A4 flyer` | 794 × 1 123 px (210 × 297 mm) | Read in the hand: every fact, the highlights, the call to action. |
| `Instagram post 4:5` | 1 080 × 1 350 px | One hook, the date, the call to action. |
| `Story 9:16` | 1 080 × 1 920 px | Full screen for three seconds: the hook, the date and the call to action, clear of the bands where the app draws its bars. |
| `LinkedIn visual 1:1` | 1 080 × 1 080 px | Professional in tone: the title, the fact that matters most, who is behind it. |
| `Facebook visual 1.91:1` | 1 200 × 628 px | A wide banner beside the post's own text: the title and the date or place. |

:::why
A story is not a cropped poster. What a piece shows depends on the distance it
is read from and the time it is looked at — a poster has three metres and ten
seconds, a story a thumb and three seconds — so a resized layout is wrong in
every format but the first. Each piece is therefore a generation of its own,
made by the document type that already knows its format (the poster, the
flyer, the Instagram, LinkedIn and Facebook posts), told that it belongs to a
campaign and what the other pieces are.
:::

---

## What the pieces share

- **The facts.** Every piece is given the same list and asked to write each value
  exactly as it is, in one piece of text. Which facts a format has room for is
  its own call: a story has no room for an address.
- **The art direction.** The first piece sets the project's direction when it has
  none; every piece after it is made against it, and the project's reference
  screen carries the look.
- **The pictures.** Only the first piece may make a picture — generated, a free
  photo, or Muse's when Muse is on. Every piece after it is offered the
  project's pictures and asked to reuse them.

:::why
Six pieces each making their own picture would cost six pictures and show six
different subjects. One key visual, reused and recropped by each format, is
what makes a campaign look like one — and what makes it cost one picture.
:::

---

## Changing a fact

:::steps id=update-campaign
1. **Change the value** in `Key facts` — the date, the place, the price.
2. **See which pieces said it.** Each piece written with the old value is marked
   `out of date`, with the change it needs. A piece that never showed that fact
   is left alone.
3. **Choose.** Every out-of-date piece is ticked; untick the ones to keep as
   they are.
4. **Press `Update`.** Each chosen piece is updated, and the panel says how.
:::

The update is **direct whenever it can be**: where a piece writes the old value
as it is, the text is replaced in place — no model call, nothing else moves,
capitals kept where the piece wrote capitals. Where it cannot be — the value is
split across two styles, or a fact was cleared — one targeted touch-up asks the
model to change those facts and nothing else.

A longer value can push a line past the page's edge. Each updated document is
measured afterwards, and a piece that runs past its page says so in the panel
with a `Fit to page` button beside it. `Revert` on a screen undoes its update,
like any edit.

:::why
"Change the date" is a promise that nothing else changes. A model rewriting a
finished poster cannot keep that promise reliably; a text replacement at the
exact place the date is written keeps it by construction. So the model is only
asked for what a replacement cannot reach, and only about those facts.
:::

---

## Adding a format later

Tick a format that has no piece yet and press `Create the missing formats`. The
new piece is made with the current facts, against the project's direction, and
reuses the campaign's pictures.

---

## Editorial calendar

:::why
A campaign is a sequence as much as a set: the poster goes up a month before,
the post a week before, the story on the day. A date kept on the piece — not in
a separate planner — travels with it: a reverted screen or a restored version
carries its own date, and the calendar is never out of step with the pieces.
:::

Under the pieces, the panel gives each one a **date** and, when it matters, an
**hour**, and shows the month with a mark per piece (click it to see the piece).

- `.ics` — one event per piece for any calendar (Google, Outlook, Apple). An
  hour is Paris time; a piece with no hour is an all-day event. Importing the
  file again updates the events instead of doubling them.
- `.csv` — the same list for a spreadsheet, semicolon-separated so Excel opens
  it as it is. Its columns are named after Calendy's fields.
- `Send to Calendy` — links your Calendy once (its address and an access
  token), then sends every **dated social piece** as an **idea to validate**,
  with its pages as pictures: Instagram post and story to Instagram, Facebook to
  Facebook, LinkedIn to LinkedIn. Posters and flyers have no network and stay in
  Mocky. Sending again updates the same idea — its date, its hour and its
  pictures — and never touches the text written in Calendy since.

:::why
Mocky never validates, schedules or publishes on your behalf: Calendy's own
`To validate` tab is where that is decided. The calls are made by Mocky's
server, not your browser — Calendy refuses a request from another site, and the
token, which can change your calendar, stays on the server; the browser is only
told which Calendy is linked.
:::

## Publication pack

:::why
A visual is not posted alone: it goes out with a caption written for its
network and a text alternative for people who cannot see it. Written from the
same brief in another tool, those words drift from the pictures — a date in the
caption that the visual no longer says.
:::

At the bottom of the panel, `Write the captions and text alternatives` makes
one model call that reads the brief, the key facts and, with the parser, what
each piece **displays** — its words, and its pictures as their own description
says. It writes:

- **three captions**, each for its network: Instagram opens on a hook and ends
  on a call to action, with 8 to 12 hashtags; Facebook is a little more
  practical, with at most 4; LinkedIn is professional, with 3 to 5. Facts are
  copied as they are written in the panel, and nothing is invented that the
  brief does not say. Each caption shows its length against the network's
  ceiling (2,200 characters, 3,000 for LinkedIn).
- **a text alternative per piece**, one or two sentences saying what the visual
  shows.

Everything is editable in place and has a `Copy` button that copies the caption
with its hashtags, ready to paste. `Rewrite` writes them all again, replacing
your edits.

- When a fact changes after the captions were written, the panel names it: the
  captions still say the old value.
- When a piece changes after its text alternative was written (an edit, an
  update), the alternative says it describes an earlier version.

`Download the pack (.zip)` builds one archive:

| In the archive | What it is |
|---|---|
| `visuels/` | Each piece, numbered in the campaign's order: the poster and the flyer as their print PDF, every social piece as one PNG per page (a carousel gives several). The same renders as the download dialog. |
| `legendes/instagram.txt`, `facebook.txt`, `linkedin.txt` | Each caption followed by its hashtags. |
| `textes-alternatifs.txt` | Each file's name and its text alternative. |
| `pack.csv` | One line per file: format, network, publication date and hour, text alternative and caption — semicolon-separated, for Excel. |

A piece that cannot be rendered is left out of the archive and named; the rest
still downloads.

With the captions written, `Send to Calendy` gives each **new** idea its
network's caption and hashtags (the Instagram one for a post or a story). An
idea that already exists keeps the text written in Calendy.

## From an assistant

`create_campaign` makes the same campaign from Claude or ChatGPT
([MCP](mcp.md)): the brief, the formats, and the key facts read the same way.

## What it costs

| | |
|---|---|
| Reading the facts | One small model call, when you ask for it (or before the first creation). |
| Each piece | One generation, like any new screen. |
| Pictures | One at most, made by the first piece, following `Image`. |
| An update | Free when direct; one edit per piece that needs the model. Measuring the page after it calls no model. |
| The publication pack | One model call for the three captions and every text alternative, when you ask for it. The .zip calls no model. |

---

## What is kept

The brief, the facts and the ticked formats are kept on the project. Each piece
keeps the values it was written with, which is how the panel knows which pieces
a change leaves behind — read, never stored as a flag, so a version restored or
a screen reverted carries its own answer. A client's approval page shows the
pieces as screens and nothing of the brief.
A piece's publication date and the Calendy idea it became
are kept on the piece too, and so is its text alternative, with a fingerprint of
the code it describes; the captions are kept on the campaign, with the facts
they were written with. The Calendy token is kept on the server, per
account, and is never sent back to the browser.
