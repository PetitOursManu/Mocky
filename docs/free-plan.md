# The free plan

Every account is on one of two plans. **Standard** is what every account was
before the free plan existed: the instance's own text model, its image and video
generators, paid for by whoever holds the keys. **Free** costs the instance
nothing but its own hardware: its text goes to a model that costs nothing, its
pictures and footage come from the free libraries, and the paid generators are
closed to it.

It exists so an instance can open its sign-ups to people it does not know
without opening its wallet to them. New accounts start on the free plan by
default; an administrator moves an account to standard in one click.

## What a free account can do

| | Free plan | Standard plan |
|---|---|---|
| Write screens, edit them, polish them, fix their accessibility, fit a document | Yes, with the **free model** | Yes, with the instance's model |
| Muse (art direction, dossier, live inspiration) | Yes, with the free model | Yes |
| Pictures in a screen | **Free photos** (Pexels, Pixabay) and your own uploads | Generated or free, your choice |
| Footage for a scroll sequence | **Free footage** and your own uploads | Generated or free |
| AI-generated images and clips, film variants | **No** — refused by the server | Yes |
| Motion Ultra films (the local render worker) | As its own access list says (Admin → Motion Ultra) | Same |
| A daily limit | Yes, set by the administrator | No |

Everything the free plan keeps costs the server time and nothing else: a film is
rendered by the worker on the same machine, a live inspiration fetch runs the
local Chromium. Those features keep their own access lists.

## Setting it up

### 1. A model that costs nothing

**Admin → Providers → Text models → ③ Free plan.** It is a third profile beside
generation and Muse, with the same providers. Pick one of these:

- an **OpenRouter** model whose id ends in `:free`, with a key from an account
  that holds **no credit** — a key with nothing to spend cannot be billed. The
  free models share a small daily allowance per key: check OpenRouter's own page
  for the current numbers;
- a **Groq**, **Google Gemini** or **Cerebras** key from an account with **no
  payment method attached** — their free tiers are rate-limited rather than
  billed;
- a model running **on the server itself**, through Ollama or LM Studio
  ("Compatible OpenAI" with a `http://127.0.0.1:…` address): no key, no bill, but
  every generation takes the processor, and a CPU-only server writes slowly.

Mocky guarantees that a free account's call never reaches the **paid** profile.
Whether the key you put in the free profile can be charged is the provider's
business — which is why the advice above is always "an account with nothing to
spend".

**Left empty, the free profile borrows nothing.** Free accounts then use the
provider each person fills in under **Settings**, with their own key — which
costs the instance nothing either. They never fall back onto the paid model.

### 2. Who starts free

**Admin → Users → Free plan → Plan for new accounts.** Free by default. It
applies to public sign-ups, to accounts created through "Sign in with Dashy", and
to accounts an administrator creates (the creation form has a **Plan** field
that starts on this value).

Changing it never moves an account that already exists, and every account
created before the free plan existed is standard. **An administrator stays on
the standard plan** — they are the one configuring the paid models — unless they
try the free plan on their own account ([step 4](#4-testing-it-with-your-own-account)).

To move one account, use **Move to free** / **Move to standard** on its row in
the account list. It takes effect on its next request.

### 3. The daily limit

**Admin → Users → Free plan → Generations a day.** Twenty by default; `0` means
unlimited.

What counts as **one generation**: a new screen, an edit, a polish, an
accessibility fix, a fit to page — each thing a person asked for that rewrites a
screen. The calls that serve it (the planner, a repair, reading a screenshot,
choosing a photo, Muse's dossier) do not count, so one new screen costs one
generation, not four.

Three details:

- **Those other calls still have a ceiling** — twelve times the limit — so a
  browser that labelled every call as a planner call would still meet a wall.
  An honest account never does.
- **Once the generations are spent, every call is refused**, counted or not: a
  new screen's planner would otherwise run on the shared key only for the
  generation behind it to be refused.
- **The count resets at midnight, server time**, and it is kept on disk
  (`free-quota.json`), so a restart does not hand everyone a fresh day.

The limit only applies to calls that reach the instance's free model. A free
account using its own key (no free model configured) spends nobody's quota but
its own.

### 4. Testing it with your own account

**Admin → Users → Test with my account → My account behaves as: Free.** Your
administrator account then gets exactly what a free account gets: the free model
writes your screens, the daily limit counts your generations, pictures come from
the free libraries, and the paid generators refuse you. It is how you judge a
free model before opening sign-ups, without a second account to sign in with.

- You keep administration. A **Testing free** badge sits in the masthead on every
  page, and Settings says it too: a forgotten switch must not pass for a broken
  instance.
- It is your account's switch only — nobody can turn it on for someone else, and
  **Move to free** still refuses an administrator. Set it back to **Standard** in
  the same place.
- Each change is written to the audit log.

## What a free account sees

- **Settings** opens on a **Free plan** card: what the plan includes, which
  model answers, and how many generations are left today — or, with no free
  model on the instance, a note asking for their own provider below.
- The composer offers no **Images · AI / Free** choice: pictures come from the
  free libraries, and the AI door of a document's picture is closed.
- When the day is spent, a generation fails with: *"Daily limit reached: the
  free plan allows N generations a day. It resets at midnight."*
- A paid generator reached anyway (the image picker, a film's variants) answers
  with a sentence saying it is not on the free plan.

## How it is enforced

Everything is decided **on the server, from the account**, never from what the
browser says. The rules are written down as invariants
[F1 to F3](architecture/invariants.md#series-f-the-free-plan); in short:

- every route that resolves a text model for somebody goes through one function,
  `textTargetFor`, and on the free plan it answers the free profile or nothing;
- the paid generators (`/api/images/generate`, `/api/videos/generate`,
  `/api/video/variants`) refuse a free account at the door, with
  `code: "free-plan"`;
- the limit answers `429` with `code: "free-quota"`.

`server/plan-routes.test.js` proves it on a real server: two fake providers on
loopback, one standing for the paid model and one for the free model, and a count
of what each one received.

## Limits

- **In `npm run dev`, Vite serves the model proxy itself**, without accounts, so
  the plan does not apply to generations there. Check the free plan against a
  production build — the same caveat as [the admin dashboard](admin-dashboard.md).
- The plan does not make a key free. See [step 1](#1-a-model-that-costs-nothing).
- Open sign-ups invite people to make several accounts to get several days'
  worth. The limit is a fairness rule between honest accounts, not a wall
  against a determined one; closing sign-ups is.
