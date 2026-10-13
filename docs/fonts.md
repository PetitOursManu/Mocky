---
description: About 200 typefaces, served by Mocky itself, that every generated screen and document can use by name.
---

# Fonts

:::why
A typeface is half of what makes a screen look designed rather than generated.
Until now a screen could NAME one — "headings in Playfair Display" — and still be
drawn in the system font, because nothing loaded it. The catalogue closes that
gap: the faces are served by Mocky, the model is told which ones exist, and a
screen is drawn in the faces its code names.
:::

Mocky ships about **200 font families**, in twelve kinds: sans serif, condensed,
rounded, serif for text, serif for display, slab, display, retro and decorative,
blackletter and medieval, handwriting, script, and monospace. Every generated
web page, flyer, poster or post can use them, and so can an art direction.

## Using a font {#using}

:::why
The model chooses well when it is given a choice. It is shown the whole list on
every generation, every edit and every polish, so a request only has to name a
face — or describe the mood — for the right one to come back.
:::

- **In a request**, name the face: *"a poster for a jazz night, title in
  Abril Fatface, text in Lora"*. Or describe it — *"something hand-written"* —
  and the model picks from the list.
- **In an edit**, the same works on an existing screen: *"set the headings in
  Bebas Neue"*.
- **In a direction**, the DESIGN.md's `Typography` section names the faces:
  `- Display: Fraunces` and `- Body: Inter`. Muse's dossier now always picks both
  from the list.

To see them all, open a design's **specification**, section *Typography*, and
choose **Browse fonts**: every family, set in its own face, filterable by kind,
with its name ready to copy. When a direction's faces are in the catalogue, the
specification and the web preview of the design are drawn in them too.

## What the model is told {#prompt}

:::why
A face the model invents ("Satoshi", "Söhne") is a face the screen cannot load.
Giving it the exact names, and the exact way to write them, is what makes the
choice it makes the choice that is drawn.
:::

The list goes to the model in one compact block, one line per kind, with two
spellings it should use: a Tailwind class, `font-['Playfair_Display',serif]`, or a
style, `fontFamily: "'Playfair Display', serif"`. It is also told to keep to two
or three families per screen, and that script, handwriting, blackletter, retro
and display faces are for headlines and logos, never for paragraphs.

The repair, the accessibility fix and the page fit do not receive the list: they
are told to change nothing but what they were given, and a screen they return
still names the faces it named.

## How a screen gets its fonts {#delivery}

:::why
A preview runs in a sandbox that may load nothing from the Internet, so a font
from Google Fonts was never an option. Serving the files from Mocky's own address
keeps previews working offline, and keeps every visitor's browser from telling a
third party what it is looking at.
:::

1. The font files are copied out of their `@fontsource` packages into
   `public/fonts/` by `npm run vendor:fonts` (it runs before `dev`, `build` and
   `test`), and served at `/fonts/` by Mocky itself, with long cache headers.
2. When a screen is drawn — on the canvas, in a thumbnail, in a PDF or image
   export, in the MCP live view — Mocky reads the families its code names and
   declares those, and only those. A screen that names two families downloads
   two families; a screen that names none is drawn exactly as before.
3. Only the Latin subsets are shipped (`latin` and `latin-ext`, which covers the
   accents of French, Polish, Czech, Turkish…), and a browser fetches the second
   only when the text needs it.
4. A capture waits for the faces before it draws, so a thumbnail or an exported
   flyer is not set in the fallback.

## Licences {#licences}

:::why
A font is software with a licence of its own. Each one is checked when it is
copied, not assumed, so a face that could not be redistributed never reaches a
server.
:::

Every family is under the SIL Open Font License 1.1, the Apache License 2.0 or
the Ubuntu Font Licence — the script reads the licence from each package and
refuses any other. All three allow the fonts to be bundled with software; the
licence of every family is served next to the files, in `/fonts/LICENSES.txt`.
See [License](license.md).

An **exported project** names the families it uses but does not carry the font
files: install them in that project (for example with the same `@fontsource`
package) or load them the way your site loads fonts.

## Adding a family {#adding}

:::why
The list is decided by a person, not derived from a package index: an art
direction asks for "a condensed grotesque" or "a slab", and only a category
someone chose can answer that.
:::

1. Add the package as an exact-version devDependency:
   `npm install -D --save-exact @fontsource-variable/<id>` (or `@fontsource/<id>`
   when there is no variable version).
2. Add `<id>` to its kind in `FAMILIES`, at the top of `scripts/vendor-fonts.mjs`.
3. Run `npm run vendor:fonts` and commit `src/lib/fonts/catalogue.json` and
   `server/fonts/families.json`. `tests/fonts-catalogue.test.js` fails when the
   committed catalogue and the installed packages disagree.
