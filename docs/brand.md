---
description: Your logo, colours, typefaces and tone kept once in your account and applied to a project with one button — and any screen exported as a picture or as slides.
badge: New
---

# My brand, and exporting a screen

## My brand

**Settings → My brand** keeps your company's identity once for your account:

| Field | What it is used for |
|---|---|
| Logo | Placed where a logo goes — a page's header or footer, a post's corner, a document's logo slot. Used **as it is**: never redrawn, recoloured or cropped. A PNG or WebP on a transparent ground works best. |
| Name, tagline, website | The wordmark when there is no logo, the signature line, the address printed on a flyer. |
| Colours | Primary, secondary, accent, text, background — each optional. |
| Typefaces | A heading face and a body face, from Mocky's [font catalogue](fonts.md) (a name outside it is not kept). |
| Tone | How the brand speaks: "warm, informal, short sentences". |

:::why
A person makes screens for their own company and for clients in the same
account. A brand kept per account and switched on per project serves both: the
identity is typed once, and nothing about a client's project changes until you
say so.
:::

### Using it in a project

In a project, the composer shows a **Brand** button beside **Flows** as soon as
a brand exists. On, every new screen, document and post of the project — and
every edit of an existing one — is told the brand: its logo by its address, its
colours, its typefaces, its tone. Where the project's art direction disagrees on
a colour or a typeface, **the brand wins**. Muse, when it runs, writes its
dossier around the brand rather than beside it.

The setting belongs to the project and is remembered with it. Switching it off
stops future generations from receiving the brand; screens already made keep
what they were given.

From an assistant ([MCP](mcp.md)), `use_brand: true` on `create_design`,
`create_campaign` or `create_publication` makes the new project in your brand.

### Where it is kept

The brand travels with your account's DESIGN.md data, so it reaches every
device you sign in on. The logo is a picture of the image library like any
upload: removing it from the brand does not delete it from the library, where
screens may already show it.

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
