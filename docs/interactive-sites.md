---
description: Describe a page the visitor handles — a shelf to drag, a product that travels down the page, a gallery to walk through — bring your pictures, and get it working in the first preview.
badge: New
---

# Interactive sites

Some pages are not read, they are handled. A shelf of film boxes you drag to
change film. A product you pick at the top that travels down the page, turns to
show its back, and lands on its own card in the shop. A gallery you walk through
and whose prints you open. Mocky can build these from one description, with the
interactions working in the first preview.

There is nothing to switch on. When your description talks about dragging,
a shelf or a carousel, crop boxes on a picture sheet, a custom cursor, text that
slides through a mask or a view that grows out of an element, the generation gets
the interaction kit. An ordinary page is generated exactly as before.

## Bring your pictures

Write the addresses of your pictures in the description, as they are. Mocky reads
them before anything else:

- **Pictures** are used by their exact address. They come before anything Mocky
  would have made: while your description brings pictures, Muse makes no picture
  of its own and Motion Ultra makes no series.
- **Picture sheets** — one image holding several covers, wrappers or prints —
  stay one file. Give the sheet's size and each crop as `x, y, width, height` in
  the sheet's own pixels: the crop stays right whatever size the sheet is served at.
- **A video from another site** cannot play in the preview. Mocky tells you which
  one; import it into the media library to use it.
- **A library from another site** (three.js from a CDN, for example) cannot load.
  The page is built with Mocky's own components instead, and Mocky says so.

## What the page can do

| You describe | What the page uses |
|---|---|
| Drag, flick, scroll or use the arrow keys to move through items | One shared position: half-way through a drag, every item is half-way |
| A crop of a picture sheet | The crop, from the sheet, at any size |
| A title that changes by sliding through a mask | The old text leaves, the new one arrives |
| A detail view that grows out of the card you clicked, and shrinks back onto it | Measured on the real card, even if you close it while it opens |
| A poster that appears like ink spreading | Ragged blots that merge into the picture |
| A colour that grows out of a point | A feathered circle over the old colour |
| A custom cursor that changes over what it points at | Mouse and trackpad only; touch keeps the finger |
| A box seen from its spine and its cover, a product seen front and back | A lit box in 3D, shading itself as it turns |
| One product that travels from section to section and lands on its card | One object, never two copies |
| A gallery or a room to walk through | A camera in a 3D space; a click opens the print you really touched |

The 3D is drawn without WebGL, so it costs no graphics context and works in many
previews at once. A volume you can click is also a keyboard button.

## After the generation

Mocky checks what the description imposed:

- a picture your description named that the page does not use is listed;
- a crop that falls outside its sheet is named, with its coordinates;
- a description of gestures answered without any of the interaction kit is said.

When one of these checks fails on a description that brought its own pictures,
Mocky makes **one** correction pass — never more — and keeps it only if it fixed
something without breaking anything else. Otherwise the first version stays, and
the messages say what is still missing.

An edit keeps your pictures, your crops, your anchors and your interactions. If
an edit removes one, Mocky says which, and **Revert** brings the previous version
back.

## What it costs

A page that uses the kit costs what a page costs. A description that brings its
own pictures saves Muse's and Motion Ultra's picture generation. The correction
pass, when it runs, is one more model call, filed as "brief correction" in the
administrator's activity.

Every new screen carries a generation id; the account that ran it can read its
trace — calls, durations, tokens and price — at `/api/runs/<id>`.

## Limits

- Thumbnails, captures and exports draw 3D flat: html2canvas does not render
  CSS 3D. The preview is the reference.
- Fonts come from Mocky's catalogue. A Japanese or Chinese face named in a
  description falls back to the system's own.
- Exporting the page as a single standalone HTML file is not available yet.
