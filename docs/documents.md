---
description: Flyers, reports, résumés and social media posts — fixed pages you download as a PDF, a deck or images.
badge: New
---

# Documents and social posts

Most of what Mocky makes is a **screen**: a page of an app or a site, laid out
for a viewport and meant to be clicked. A **document** is the other kind of
thing it can make — a flyer, a report, a résumé, an Instagram carousel — and it
is not a screen at a different width. It is a stack of pages of a **fixed
size**, composed one by one like a sheet in a layout program, and it leaves
Mocky as a file: a PDF, a PowerPoint deck, images, or a layered PSD or SVG.

This page covers what changes when the thing you are making is a document, and
the three things you can only do with one: download it, fit it to its page, and
see it held in a hand or posted in a feed.

:::why
A document built as a web page fails in ways nobody sees until it is printed: a
"flyer" laid out at 1 440 px wide is a landing page with the word flyer in its
title, and a report that scrolls has no page breaks to put in a PDF. Fixing the
page size first is what makes three things agree — what the canvas shows, what
the file contains, and where a fillable field lands in it.
:::

---

## Making one

:::steps id=make-document
1. **Pick a type.** In the composer, open `Screen type` and choose one from
   `Documents to print or export` or `Social media`.
2. **Check the format.** The `Mobile` / `Desktop` / `Tablet` chips are replaced
   by page formats, with the type's own format selected. Pick another if you
   need it.
3. **Choose the picture.** A document offers `Picture`: `No picture` (shapes and
   colour only), `Generated` (one picture from the image model) or `Free photo`
   (one real photo from Pexels or Pixabay, when the instance has a key).
4. **Describe it and generate.** An empty field is filled with an example for
   the type; your own words are never replaced.
:::

:::hotspots src=assets/ui/types.webp alt="The Screen type menu: documents, social media and screens"
- 50,3.6 **What a type does**: It gives the model the structure of that kind of screen. Your words still come first, and the style stays your direction’s.
- 50,19.1 **Documents to print or export**: Flyer, poster, report, documentation, résumé, invoice or quote, certificate, menu — fixed pages. See [Documents](documents.md).
- 50,91.6 **Social media**: Instagram, Facebook and LinkedIn posts, in the platforms’ own sizes.
- 50,123.9 **Screens**: Dashboard, planning, kanban, table, landing page, pricing, product, checkout, sign-in, onboarding, settings, messaging, booking, article, portfolio.
:::

The type stays armed after the generation, and a project opens on the type and
format of its latest screen: the next request in a project of flyers is a flyer
too, not a web page. The ✕ beside the chip (`Remove the screen type`) goes back to
screens, and that choice is remembered the same way.

A document skips what only makes sense for a screen: the planner, Motion Ultra,
the scroll video and every animation — a page is printed at rest. Muse and the
project's direction still apply, so a flyer looks like the rest of the project.

The same announcement in several formats at once — a poster, a flyer, a post, a
story — is a **campaign**: one brief, each format composed for itself, the facts
and the pictures shared. See [Campaign Studio](campaign.md).

---

## The types

Each type gives the model the structure of that kind of piece. Your words win on
any conflict, and the look stays your direction's.

| Type | Starts on | What it asks for |
|---|---|---|
| `Flyer` | A4 (A6 to A3, DL, square) | Flat or [folded](#flyers-sizes-and-folds). One striking page: a huge headline, the key facts (date, place, price) as their own block, highlights, a call to action printed as words beside a QR-code placeholder, colourful shapes bleeding off the edges. A tear-off coupon of fields only when the request is a sign-up. |
| `Poster` | A3 | One page read from three metres away: one dominant element, the essential facts in one block, no body text. |
| `Report` | A4 | A cover, a contents block, an executive summary of key figures, body pages with numbered sections, charts and a table, running headers and page numbers. Figures consistent from page to page. |
| `Documentation` | A4 | A title page with a version, a table of contents, numbered sections, procedures as numbered steps, note / tip / warning callouts, a reference table. |
| `Résumé / CV` | A4 | One page in two columns: profile, experience with achievements, education, skills, languages. Sober and legible. |
| `Invoice / quote` | A4 | The issuer, the client, a line-item table with VAT, totals that add up exactly, payment terms. A quote gets an acceptance block made of fillable fields. |
| `Certificate` | A4 landscape | A decorative border, the recipient's name as the most prominent text, signatures and a seal. Name and date become fields when you ask for a blank template. |
| `Menu` | A4 (A5 to A3, DL) | Flat or [folded](#flyers-sizes-and-folds). Starters, mains, desserts and drinks, prices aligned, dietary markers with a legend, one framed special. |
| `Magazine` | A4 (A5, Letter) | A [publication](#magazines-and-books): front cover, two inside pages, back cover — then pages added one by one. Editorial hierarchy, columns, pull quotes, folios and running heads. |
| `Book` | A5 (A6, A4, Letter) | A [publication](#magazines-and-books): front cover, two inside pages, back cover — then pages added one by one. Book setting, running heads, even folios on the left. |
| `Instagram post` | 4:5 | One big idea per image; a carousel when there is more to say (the first image is the hook, the last the call to action). |
| `Facebook post` | 1.91:1 | The visual of an announcement or an event, little text — the post's own text carries the detail. |
| `LinkedIn post` | 1:1 | A professional insight or result; a carousel exported as a PDF is LinkedIn's document post. |

---

## Page formats

The format chips show only the formats of the type's family: paper and slides
for a document, social sizes for a post — and a type with sizes of its own shows
those: a flyer is offered A6, A5, A4, A3, DL, a 21 cm square and US Letter; a
poster A4 to A2. A post laid out for a phone is not the
same piece at A4, so the composer never offers the jump — and a format picked for
a report does not follow you to the Instagram post typed next.

| Family | Format | Page size |
|---|---|---|
| Paper | `A4` · `A4 landscape` | 794 × 1 123 px (210 × 297 mm), and turned |
| Paper | `A3` · `A3 landscape` | 1 123 × 1 587 px (297 × 420 mm), and turned |
| Paper | `A2` | 1 587 × 2 245 px (420 × 594 mm), a shop-window poster |
| Paper | `A5` · `A5 landscape` | 559 × 794 px (148 × 210 mm), and turned |
| Paper | `A6` | 397 × 559 px (105 × 148 mm), postcard size |
| Paper | `DL` | 374 × 794 px (99 × 210 mm), the third of an A4 that fits a rack |
| Paper | `Square 21` | 794 × 794 px (210 × 210 mm) |
| Paper | `US Letter` · `US landscape` | 816 × 1 056 px (8.5 × 11 in), and turned |
| Paper | `Presentation 16:9` | 1 280 × 720 px — PowerPoint's and Google Slides' "Widescreen" |
| Social | `Square 1:1` | 1 080 × 1 080 px |
| Social | `Portrait 4:5` | 1 080 × 1 350 px, the tallest a feed shows whole |
| Social | `Story 9:16` | 1 080 × 1 920 px |
| Social | `Landscape 1.91:1` | 1 200 × 628 px, a shared link, Facebook, LinkedIn |

Paper sizes are in CSS pixels at 96 per inch, which map exactly to PDF points,
so a page exports at its real paper size. Social sizes are the platforms' own
pixels, so the exported image is the file they ask for, as it is.

The model is told the margins that must stay clear: 40 px on paper, past what an
office printer cannot reach; 64 px on a post; and on a story, the top and bottom
bands where the app draws its own bars.

---

## Flyers: sizes and folds

A flyer (or a menu) is chosen by two things in the composer: its **size** — the
chips — and its **fold**, the `Fold` menu beside them. `Flat sheet` is a single
page, as before. The folds:

| Fold | Panels | Offered on |
|---|---|---|
| `Bi-fold` | 2 per face, folded in half like a card | A5, A4, A3, Letter |
| `Tri-fold (roll)` | 3 per face; the panel that tucks in is 3 mm narrower | A4, A3, Letter |
| `Z-fold` | 3 per face, an accordion | A4, A3, Letter |
| `Gate fold` | 2 flaps closing like doors on a double centre panel | A4, A3, Letter |
| `4-panel accordion` | 4 per face | A4, A3 |

The size is the **flat sheet**: an A4 folded in three is an A4 landscape sheet
of three DL panels, printed on both sides. So a folded leaflet is always two
pages — the outside face and the inside face — and each page is a row of
panels, drawn by the page kit at their exact widths, with the fold lines dashed
on the canvas (never in an export).

:::why
Which panel ends up as the front cover is geometry, not reading order. On a
roll fold the front cover is the RIGHT-hand panel of the outside face; on a
gate fold the cover is split across both ends, its right half printed on the
left. A model asked for "a tri-fold" lays the outside face out as a reading
order — cover first, on the left — and the sheet that comes back from the
printer folds with its back cover in front. So Mocky computes the order once
(`lib/folds.ts`) and tells the model which slot is which, with its width.
:::

Words that run across a fold are reported like words past the page edge, and
**Fit to page** wins them back the same way. The PDF has the two faces at the
sheet's size: the file a print shop asks for.

---

## Several pages in a row: Parcours

The composer's `Flows` switch (Parcours) is about screens that open one another
in a prototype — and, on a document, about the **pages that follow one
another**:

- a **flyer or a menu** gets a **recto and a verso**: the front stops someone,
  the back carries the detail, the practical information and the coupon;
- a **post** becomes a **carousel** — five images unless your request names
  another number: the hook, one idea per image, the call to action, with a page
  counter and the same wordmark on each;
- a **story** becomes a sequence of stories.

A folded leaflet already has its two faces, a poster has no back, a report
runs to several pages by its own brief: on those the switch changes nothing.
Off, nothing is added to the prompt (invariant V7).

---

## Magazines and books

`Magazine` and `Book` are not one screen but a **publication**: sheets that
share **one art direction of their own**. It starts small — **four pages**:

1. Mocky plans what they say (one model call): the **front cover**, **two
   inside pages** (an editorial and the opening of a feature for a magazine, a
   title page and the first page of a chapter for a book), the **back cover**.
2. The **front cover** runs Muse on the publication's request; its dossier
   becomes the publication's direction.
3. **The three others** are generated under that direction, with Muse off —
   the same type, palette, grid, folio and running head.

Then you grow it **one page at a time**: generate again with the same type
(`Magazine` or `Book`) in the same project, describing the page you want — it
is added as an inside page **before the back cover**, under the same direction,
told its page number and the whole table of contents.

:::why
One component of forty designed pages is a call that runs out of tokens at page
eleven and leaves the whole issue to be regenerated for one bad spread. A page
is a part a model writes well in one go, and redoes alone — and four of them
are enough to judge a look before spending on the rest. And the direction is
the publication's, not the project's: an issue of a magazine and a flyer for its
launch party can live in the same project without one restyling the other.
:::

The progress line says which sheet is being made. Each sheet is an ordinary
document on the canvas — edit it, fit it, download it — and its pages print in
order with the others.

---

## Fields

A blank someone fills in — a name, a date, a box to tick, a choice — is a
**field**, not a drawn line. On the canvas it looks like the rest of the design;
in the exported PDF it becomes a real form field, fillable in any PDF reader. Two
fields with the same name on a recto-verso are renamed so both keep their own
value.

The social types ask for none: nobody fills in an Instagram post.

---

## Downloading

A document's frame carries a `Download` pill, and the screen context menu a
`Download…` item. Both open `Download the document`, with five buttons:

:::hotspots src=assets/ui/download.webp alt="Download the document: PDF, PowerPoint / Google Slides / Canva, PNG images, PSD, SVG"
- 50,12.3 **The format**: The page format the document was laid out in. The file downloads directly — no print dialog.
- 52.9,19.8 **PDF**: To print or send. Text stays selectable; every field becomes a real form field.
- 52.9,35.2 **PowerPoint / Google Slides / Canva**: To keep editing: every text an editable box, every picture in a shape a frame. Import it into Canva, or open it in Google Slides from Drive.
- 52.9,55.9 **PNG images**: To post: one image per page, in a `.zip` when there are several. A social post comes out at its exact pixels.
- 52.9,69.7 **PSD**: For Photoshop or Photopea: the page as one layer, every picture in a shape as a layer of its own.
- 52.9,86.1 **SVG**: For Figma, Illustrator or Inkscape: every picture in a shape is a named mask holding it.
:::

| Button | What you get | For |
|---|---|---|
| `PDF` / `PDF — fillable fields` | The pages as drawn — at 500 dpi for paper, three times for a slide and four times its pixels for a post, so it stays sharp zoomed in as well as printed (on an iPhone or an iPad, as high as Safari allows, about 350 dpi on A4) — with the text still selectable and every field fillable. | Printing, sending. |
| `PowerPoint / Google Slides / Canva (.pptx) — editable text and frames` | One slide per page: the design as one picture under everything — the slide's background when the page has pictures in a shape, otherwise a picture you can select (Canva refused that background on a page without any) — and every run of text as an editable text box over it. Each picture in a shape is a shape of its own, filled with its picture: Canva imports it as a frame to drop another photo into, PowerPoint and Google Slides as a picture you can change. Import it into Canva, or upload it to Google Drive and choose "Open with Google Slides". | Keeping on editing. |
| `PNG images` | One image per page, in a `.zip` when there are several. A social post comes out at exactly its format's pixels. | Posting. |
| `PSD — Photoshop, Photopea` | One layer for the page, then one per picture in a shape, with its outline, tape and shadow as layers of their own. The text is part of the page. | Finishing in Photoshop. |
| `SVG — Figma, Illustrator, Inkscape` | The page, and each picture in a shape as a named mask group holding it, with its outline and tape over it. The text is part of the page. | Finishing in Figma or Illustrator. |

The file is built in your browser, page by page, and downloads by itself. A
`Save “{file}”` link stays in the dialog, because a browser may block a second
automatic download from the same page.

When something could not be exported perfectly, the dialog says so under the
link rather than hiding it: content cut at the page edge, rotated text left in
the picture of a slide, a page drawn by the fallback renderer, a picture or font
that could not be embedded — and, named apart with its site, a picture the page
loads from another site. Those never travel: an export carries only Mocky's own
pictures, so add them to the library and put them in the document.

### Pictures in a shape, in the files

:::why
A post made in Mocky is often finished elsewhere, with the real photographs. So
every picture in a shape leaves as a thing of its own, in its shape: another
photo takes its place without anyone redrawing the frame.
:::

When the document has pictures in a shape (see [Pictures in a shape](#pictures-in-a-shape)),
each one is named after its place and its shape ("Frame 2 — Polaroid") and
travels on its own:

| File | The picture in a shape is… | To replace it |
|---|---|---|
| PowerPoint / Google Slides / Canva | a shape filled with its picture, over the page | In Canva, drop a photo on it: it is a frame. In PowerPoint or Google Slides, change the picture. |
| PSD | a layer of the picture, in its shape | Place a photo above that layer, then Alt + click between the two: a clipping mask. |
| SVG | a named mask group holding the picture | Replace the picture inside the group. |

A frame still waiting for its picture comes out holding a grey placeholder,
ready to be replaced. A document of several pages gives one PSD or SVG per
page, in a `.zip`. Like the PDF and the PowerPoint, they are drawn at twice a
post's pixels, so they stay sharp when an editor shows them larger. In the PSD
and the SVG the text is part of the page's picture; to edit the words, take the
PowerPoint download.

---

## When content runs past the page

A page has one size, and the model writes it without seeing it rendered: it can
guess a height and guess it long. When text or a field ends up past a page's
edge, Mocky says so — a notice names the document and the page — because on
paper that content is simply cut.

:::hotspots src=assets/ui/docmenu.webp alt="A document’s context menu"
- 50,4.4 **Edit with a message**: Selects the document and puts the cursor in the composer.
- 50,10.6 **Polish**: Checks the design against named rules and corrects what it finds.
- 50,16.7 **Regenerate a variant**: The same prompt again, for a different design.
- 50,35.1 **Fit to page**: A document only: when content runs past a page, measures it and asks the model to win the space back. Kept only if it fits better.
- 50,43 **Export ›**: `Download…` — PDF with fillable fields, PowerPoint / Google Slides / Canva, PNG images, PSD or SVG — and the `.tsx`.
- 50,49.1 **Share**: A temporary public link and a QR code.
- 50,69.3 **Notes**: Private notes on this screen, never sent to a model.
- 50,95.6 **Delete screen**: One confirmation, and it is gone.
:::

**Right-click the document → `Fit to page`** asks the model to win the space
back. It is not an edit and not a polish:

1. The document is rendered off screen and measured the way the export reads
   it: how many pixels past which edge, and which words are outside.
2. The model gets those numbers and a strict instruction — tighten spacing,
   then pictures, then oversized type; keep every section, the copy, the palette
   and the number of pages.
3. The answer is rendered and measured again **before** anything is written.

| Result | What happens |
|---|---|
| Everything fits | The new version replaces the old one. `Revert to the previous version` undoes it. |
| Closer, still over | The new version is kept, and the notice gives what is left, in pixels. You can fit it again. |
| No better, worse, or a different number of pages | Nothing changes, and the notice says so. |

One model call per click, never retried on its own. Adding a page is a different
document, so it is left to you: ask for it in the composer.

:::quiz
You run `Fit to page`, and the model's answer only fits by adding a second page. What does Mocky do?
- It keeps the two-page version, since everything now fits
- [x] It keeps the original, and says the fit did not work
- It asks you which one to keep
> A different number of pages is a different document, so the answer is rejected however well it fits. Ask for a second page in the composer if that is what you want.
:::

---

## Social posts

A post is one image or a **carousel** of several: each `<Page>` is one image,
swiped one at a time, and each must work on its own. The `PNG images` download
gives them numbered, at the platform's size; for LinkedIn, the PDF download is a
ready-made document post.

A story is sized 9:16, and the model keeps text out of the bands the app covers
at the top (progress, name) and at the bottom (reply field).

### Pictures in a shape

:::why
A post is mostly one picture, and a picture cut into a blob, an arch or a
polaroid is half the look of a post. The model draws none of these shapes
itself: a long SVG path written by a model gets cut off and breaks the render.
:::

A picture can sit in a **frame**, a shape that cuts it the way a clipping mask
does in an image editor. Ask for it in the brief ("the photo in a blob", "a
polaroid", "a collage of three photos in arches"). The social formats always
offer it to the model; on other pages, those words do.

There are 42 frames in four families:

| Family | Frames |
|---|---|
| Geometric | circle, rounded, squircle, triangle, diamond, pentagon, hexagon, octagon, star, burst, heart, arch, dome, pill, drop, shield, cross, parallelogram, flower, leaf |
| Organic | six blobs, splash, pebble |
| Waves and edges | wavy bottom, wavy top, wavy both, scalloped, zigzag, torn |
| Photo frames | polaroid, stamp, film strip, ticket, speech bubble, taped photo, torn-edged print, oval mount |

A frame keeps the picture's important part in view (a face at the top, for
instance), and can take an outline, a soft shadow that follows the shape and a
slight tilt. Without a picture, the shape is drawn in grey as a placeholder.

To change a frame afterwards, right-click the screen, then `Frames…`: a
frame's shape, picture, framing and shadow, and `Put in a frame` for the
screen's plain pictures. It edits the screen's code directly, with no call to
the model, and `Revert` undoes it.

---

## In demo mode

With `Device` on, the demo shows a document the way it will be seen:

- **A printed document** is held in a hand, drawn in the same line as the
  device frames, one page at a time with a pager under it.
- **A social post** is shown on a phone, in its feed: an author row, the picture
  at the full width of the screen, the actions and the caption — under the
  picture on Instagram, above it on Facebook and LinkedIn — and the next post
  starting. A carousel shows its counter and its dots; the arrows under the
  phone turn the pages.
- **A story** fills the phone's screen, with its progress segments and the reply
  field.
- **A presentation** has no frame: it is projected, not held.

A flyer, held:

:::hotspots src=assets/ui/demo-hand.webp alt="Demo mode: a flyer held in a hand"
- 23.9,3.5 **Device**: On for a printed document: it is held in a hand, drawn in the same line as the devices.
- 44,46.5 **The page**: The real document, one page at a time; a pager appears under it when there are several.
- 58.8,63.6 **The hand**: Only the thumb lies on the sheet, along its edge; the rest of the page stays clickable.
- 50,95.3 **Caption**: The page format.
:::

A carousel, in its feed:

:::hotspots src=assets/ui/demo-phone.webp alt="Demo mode: an Instagram carousel on a phone, in its feed"
- 40.7,23.1 **Author row**: The feed drawn around the post: generic, in the phone’s ink — no logo, no copied interface.
- 50,43.2 **The post**: At the full width of the screen, where the platform puts it.
- 59,27.7 **Carousel counter**: The page shown and the carousel’s length.
- 40.4,62.9 **Actions and caption**: Under the picture on Instagram; above it on Facebook and LinkedIn.
- 50,94.7 **Pages**: Turns the carousel’s pages. A story fills the screen instead.
:::

The drawn app is deliberately generic — no logo, no copied interface. It says
where the picture will live and leaves the eye on the picture.
