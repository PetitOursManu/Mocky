---
description: Prototypes that work — forms that change data, a simulated sign-in, real filters, a cart shared between screens — with the next screens created for you, and demo scenarios.
badge: New
---

# Working prototypes

With `Flows` on in the composer (it is on by default), a generated screen is not
only a picture of a page: it is a page of a **prototype that works** in
[Demo mode](interface.md#demo-mode).

- **Forms** validate what is typed and do something with it.
- **Sign-in** is simulated: any well-formed email with a password of 4
  characters or more signs you in, and the next screen knows who you are.
- **Filters**, search, sorting and tabs really change what is listed.
- **The cart** is shared: add a product on one screen, the badge counts it on
  every screen, and the cart screen lists it.

And the screens a flow leads to are **created automatically**.

## The screens created for you

Ask for "a sign-in page for an online bank". The model writes the form, and
writes that a successful sign-in opens the page called `account`. No screen of
the project answers to `account` yet — so Mocky creates it, right after, as a
second generation: an account page that greets the person who just signed in.

:::why
The model that wrote the sign-in is the one that knows what comes next — not
the person who asked for a sign-in. So Mocky reads the new screen's code for the
pages it opens and creates the ones that do not exist yet, telling each one
which data the previous screen wrote, so the account page reads the user the
sign-in page stored, with the same shape.
:::

A few rules keep it in proportion:

| | |
|---|---|
| How many | **3 screens at most** per generation, following the flow two steps deep (a cart, its checkout, its confirmation). |
| What it costs | Each created screen is a **normal generation** with your model. Muse and Motion Ultra do not run for them: they take the project's direction and look. |
| When | Only for a **new** screen with `Flows` on — never for an edit, and never for a document. |
| Names | The usual pages get a name in your language (`Panier`, `Mon compte`, `Confirmation`…). |

Turn `Flows` off in the composer to generate a screen on its own, exactly as
before.

## Trying it: Demo mode

In `Demo`, the screens share their data while you move between them. Sign in
on the first screen, and the account screen says hello; add two products, and
the cart lists them.

- `Data (N)` shows the data the screens share right now — the signed-in user,
  the cart, the forms sent — and `Clear all` empties it.
- `Restart` goes back to the first screen with the starting data.
- A button that opens a page nobody answers to says so in the bar, instead of
  doing nothing.

On the canvas, `Interact` makes a screen work on its own: its form, its
filters. Moving to another screen is the demo's job.

## Scenarios

A scenario is **a way to start the demo**: a screen, and the data as it should
be. "A visitor", "a signed-in customer with two items in the cart".

:::steps id=record-a-scenario
1. **Play the demo up to the state you want** — sign in, fill the cart.
2. **Press `+` beside the scenario list**, and name it.
3. **Pick it from the list** whenever you show the prototype: the demo starts
   on that screen, with that data. `Restart` comes back to it.
:::

Scenarios are saved with the project (20 at most, 64 kB of data each). The
bin beside the list deletes the selected one.

## A screen's route

Screens open each other by **route** — a short name like `cart` or `account`.
A screen created for a flow carries its route; any other screen answers to its
name (a screen called "Cart" answers to `cart`).

## In the approval link and the export

The client who opens an [approval link](review.md) can try the flow too: in
`Navigate`, signing in and filling the cart work as in the demo. In an
[exported project](interface.md#the-project-toolbar), the screens share the same
data and open each other by route.
