---
description: Your brands — logo, colours, typefaces, tone, rules and pictures — kept once in your account and applied to a project with one button; and any screen exported as a picture or as slides.
badge: New
---

# My brands, and exporting a screen

## My brands

**Settings → My brands** keeps the identity of each brand you make visuals for —
your organisation, its restaurant, a client — once for your account. One tab per
brand, and `New brand` beside them; each has:

| Field | What it is used for |
|---|---|
| Logo | Placed where a logo goes — a page's header or footer, a post's corner, a document's logo slot. Used **as it is**: never redrawn, recoloured or cropped. A PNG or WebP on a transparent ground works best. |
| Name, tagline, website | The wordmark when there is no logo, the signature line, the address printed on a flyer. |
| Colours | Primary, secondary, accent, text, background — each optional. |
| Typefaces | A heading face and a body face, from Mocky's [font catalogue](fonts.md) (a name outside it is not kept). |
| Tone | How the brand speaks: "warm, informal, short sentences". |
| Rules | One per line, followed on every visual of the brand: "the plate fully visible", "no faces", "a plain, bright background". A specific request still wins over a rule. |
| Brand pictures | Photos and visuals from the media library that belong to the brand. They are offered to every new screen made in it, to be used as they are. |

:::why
A person makes screens for their own company and for clients in the same
account. A brand kept per account and switched on per project serves both: the
identity is typed once, and nothing about a client's project changes until you
say so.
:::

### Using it in a project

In a project, the composer shows a **Brand** button beside **Flows** as soon as
a brand exists. With several brands, a list under it says **which one** this
project is in. On, every new screen, document and post of the project — and
every edit of an existing one — is told the brand: its logo by its address, its
colours, its typefaces, its tone, its rules and its pictures. Where the project's art direction disagrees on
a colour or a typeface, **the brand wins**. Muse, when it runs, writes its
dossier around the brand rather than beside it.

The setting belongs to the project and is remembered with it, brand included.
Switching it off stops future generations from receiving the brand; screens
already made keep what they were given. A project whose brand you **delete**
receives no brand at all — never another one in its place — and its list says
so until you pick another.

From an assistant ([MCP](mcp.md)), `use_brand: true` on `create_design`,
`create_campaign` or `create_publication` makes the new project in your main
brand, and `brand: "Chez Elisa30"` in that one. A name Mocky does not know is
refused with the list of your brands.

### Rules kept from your corrections

A correction you make once should not have to be made again. After an edit —
the composer on a selected screen, or the words typed in `Modify`'s card —
Mocky offers, at the top of the canvas, **Keep this correction for the next
screens?**, with your own words ready to shorten into a rule ("The plate fully
visible"). You choose where it goes:

- **For this project** — the project's rules, in the composer's options under
  **Rules**, where you can also read, change or remove them;
- **For the brand** — when the project is in one: the brand's rules, in
  Settings → My brands, followed by every project in that brand.

Every rule is sent with every new screen and every pass on an existing one
(edit, repair, polish, accessibility fix, page fit), and Muse writes its dossier
with them. A specific request still wins over a rule: a rule "no faces" does not
stop you asking for a portrait on one poster. `Don't offer again` stops the
offer in this browser; the box in the Rules window turns it back on. No model
is called to word the rule: it is kept as you leave it.

### Where it is kept

The brands travel with your account's DESIGN.md data, so they reach every
device you sign in on. The single brand of earlier versions becomes the first
of the list, and projects that used it keep it. The logo and the brand's
pictures are pictures of the image library like any upload: taking one off a
brand does not delete it from the library, where screens may already show it.
An account keeps up to 12 brands, each with up to 24 pictures.

## Exporting a screen as a picture or slides

Documents have always had PNG and PowerPoint. An ordinary screen — a page of a
site or an app — now has them too, in its right-click menu:

- **Export as a PNG image (whole page)** — the entire page, top to bottom, in
  one picture at 1.5× its size.
- **Export as PowerPoint** — the page cut into slides of the presentation's
  shape: 16:9 for a wide screen, 9:16 for a phone. The text stays text, editable
  in PowerPoint, Keynote or Google Slides.

:::why
A whole page is laid out for a viewport. Made as tall as its content, a hero
written "full screen" would grow with it, and the picture of a 900-pixel hero
came back thousands of pixels high. So the page is laid out at the screen's own
height first, everything sized on the screen's height is held at the size you
see, and only then is the page drawn whole.
:::

A slide never cuts through a block of text when it can start at its top
instead: a heading shows whole on the next slide rather than in half on two.
Pages longer than 20,000 pixels are cut at that height.
