# Motion Ultra

Motion Ultra is a project setting that builds each new screen like a high-end,
motion-led page: a living background, display type, frosted surfaces, reveals
tied to the scroll — and a **series of pictures generated together for it**.

It is the same Motion name as the film export on purpose: Motion Ultra is the
page, Motion is the film, and both can live on one screen.

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

## With Muse and Motion films

Muse still writes the direction and the copy; with Motion Ultra on it does not
generate a hero picture of its own — the series replaces it.

A Motion film is never placed in the opening Motion Ultra built. It goes into
another section, as another kind of film, and is composed from the series'
pictures.

## Why it is built this way

The rules behind it — why the model names treatments instead of writing CSS, why
the number of pictures is yours, how it degrades — are invariants **U1 to U5** in
[Invariants](architecture/invariants.md).
