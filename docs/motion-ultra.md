# Motion Ultra — pages

Motion Ultra is a project setting that builds each new screen like a high-end,
motion-led page: a living background, display type, frosted surfaces, reveals
tied to the scroll — and a **series of pictures generated together for it**.

The films carry the same name, on purpose: until 2026-09 they were called
"Motion", and a person who builds a page around a film does not use two
features. The page is this setting; the film is made in the Motion Ultra panel
([Motion Ultra — films](video-export.md)); both can live on one screen.

---

## Turning it on

In the composer, the **Motion Ultra** control:

- **Off for the project** — one quiet chip. Clicking it switches Motion Ultra on
  for the whole project.
- **On** — the chip is lit, and **×3** / **×6** sits beside it: how many pictures
  each new screen gets. The cost and the waiting time are in the buttons' titles.
  Clicking the chip **pauses** Motion Ultra for the next generations in this
  session, without touching the project setting.
- The small **✕** switches it off for the project.

It is offered on every kind of screen. An application screen (a dashboard, a
form, settings) gets its own recipes: the expression goes into the chrome and one
panel, the data stays on opaque surfaces.

Motion Ultra only applies to **new** screens. An edit of an existing screen keeps
what it is.

**Who may use which size** is the administrator's decision, in Admin → Motion
Ultra: one list for ×3 and one for ×6, each "everyone" or named accounts, and
independent — an account may have ×3 without ×6. The composer offers only the
sizes an account has, and none means no Motion Ultra control at all; a project
saved at a size the account no longer has uses the one it does. The server is the
gate, not the button: every picture of a series is requested with its size, and
`POST /api/images/generate` refuses a size the account was not given. These apply
with the film switch off too — a picture series needs no render worker.

## What happens when you generate

```
prompt → storyboard → series of pictures → page → checks
```

1. **Storyboard.** One model call decides the screen's type, its sections, the
   recipe each one uses (a closed catalogue of eighteen, in
   `src/lib/ultra/recipes.ts`), the pictures to generate with their role — a
   backdrop, an isolated object, a scene, a texture — and **one style sentence
   they all share**, so they read as one shoot.
2. **Pictures.** Exactly as many as you chose, two at a time, through the image
   library. A picture that fails leaves its section to an animated CSS
   background; the page is still produced and a notice says what happened.
   With the composer's `Images · Free`, each picture is **found** in Pexels or
   Pixabay instead. The storyboard then also writes, per picture, a search of
   two to four English words and picks subjects a stock library actually has.
   The server returns eight thumbnails for it, and the model **looks at them**
   — with the subject, the picture's role and the photos already chosen for the
   series — and picks one, or none: a picture nothing fits is left to an
   animated CSS background rather than filled with an absurd photo. That look is
   what holds a found series together. One call per picture on small
   thumbnails, far below the price of a generated image. A model without vision
   takes the search's first result instead. The thumbnails of up to three of
   the chosen photos are then shown to the model that writes the page, so it
   takes its accents and its light from the real pictures — the storyboard was
   written before they existed.
3. **Page.** The generation prompt receives the storyboard and the pictures, and
   the page is written with the **Ultra kit**: `u-*` classes (glass, display
   type, gradient text, reveals, parallax, grain…) and `<Backdrop>`, six living
   backgrounds drawn in CSS.
4. **Checks.** Reported, never silently repaired: a picture of the series the
   page left out; a page that moves too much at once; and **text laid over a
   picture that cannot be read on it** — measured on the rendered pixels, with
   the ink removed, since a photograph has no single colour the accessibility
   audit could compare against. About a second, no model call.

The composer shows where it is: *storyboard*, *pictures 2/6*, then the usual
generation.

## Changing a Motion Ultra screen

Everything you can do to a screen still works, and a Motion Ultra screen stays
one:

- **Edits by chat, repairs, Polish and the accessibility fix** all receive the
  kit's vocabulary, so they keep it rather than "cleaning it up".
- **Polish** reports glass, gradient type and halos as advice on these screens,
  never as something to correct — it is what Motion Ultra was switched on for.
- An edit that **removes pictures or the Motion Ultra style** is reported, with
  "Revert to the previous version" in the screen's menu.
- **One picture missed?** Screen menu → *Change media* → **Another version**: the
  same description and format, a new take, put in its place. Nothing else is
  regenerated.

## Video background

The **Video background** switch, beside ×3 / ×6, is **off by default**. On, one
section of each new screen gets a moving background:

- The storyboard picks the section — the first one built on a full-bleed ground
  (an opening, a band, a closing call to action, an app's one expressive panel;
  never a card grid, never an app's navigation).
- The page is written with that section's `<Backdrop slot="film">`: a living CSS
  background from the first second.
- A Motion Ultra film is then composed from the series' pictures and **rendered by
  your own machine** (the Motion Ultra worker) — no video is billed; the cost is one
  text-model call and one to three minutes. The screen's badge says where it is.
- The film is plugged into that background — one attribute, no model call, no
  rewrite of the page. It plays over the CSS layers, which stay underneath for
  the thumbnail, for reduced motion and if the film never arrives.

With the video background on, no other Motion Ultra film is made for the same screen.

## The series, after the screen

- On the canvas, the picture card of a Motion Ultra screen shows **stacked
  frames** when it holds several pictures; clicking it opens the viewer on the
  **whole series** — arrows, ← →, thumbnails, "2 / 3".
- A screen generated **without** Motion Ultra (paused, or switched off) is
  **offered the pictures the project's screens already show** — the series first
  among them — and asked to reuse them wherever a picture fits, unless its
  request says otherwise. Nothing is generated for it.
- The legibility check (text laid over a picture) runs after **every** new
  screen that has a picture, Muse's and pinned ones included — not only Motion Ultra
  Ultra's.

## With Muse and Motion Ultra films

Muse still writes the direction and the copy; with Motion Ultra on it does not
generate a hero picture of its own — the series replaces it.

No film is made on its own. The only film a generation makes is the `Video
background` above, when it is switched on; any other film comes from the Motion Ultra
panel, and page animations are always on — a screen is held still from its own
menu.

## Why it is built this way

The rules behind it — why the model names treatments instead of writing CSS, why
the number of pictures is yours, how it degrades — are invariants **U1 to U5** in
[Invariants](architecture/invariants.md).
