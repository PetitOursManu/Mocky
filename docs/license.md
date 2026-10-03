---
description: Mocky is AGPL-3.0-or-later, with two exceptions — the video worker's use of Remotion, and everything Mocky produces for you.
---

# License

Mocky is free software, released under the **GNU Affero General Public License,
version 3 or any later version** (`AGPL-3.0-or-later`). The licence text is the
[`LICENSE`](https://github.com/PetitOursManu/Mocky/blob/main/LICENSE) file at the
root of the repository; the copyright notice and the two additional permissions
are in [`NOTICE`](https://github.com/PetitOursManu/Mocky/blob/main/NOTICE), which
is the document that counts. This page explains them; it is not legal advice.

## In short {#summary}

:::why
Most people who meet a copyleft licence ask one question — "what do I have to
do?" — and the answer is almost always "nothing". The table puts that answer
first, so the obligations stand out where they actually exist.
:::

| You… | What the licence asks of you |
|---|---|
| Use Mocky, unmodified, for yourself or your team | Nothing |
| Host it, unmodified, for other people | Nothing beyond leaving its notices in place: the source is already public |
| Modify it for your own use | Nothing, as long as nobody else uses the modified version |
| Run a **modified** version that other people reach over a network | Offer those users the source code of your version (section 13) |
| Redistribute it, modified or not | Under the same licence, with its source and its notices |
| Publish a site or a document made with Mocky | Nothing: [what Mocky produces is yours](#output) |
| Build the video worker | Nothing more on Mocky's side; [Remotion's own licence](#remotion) applies to Remotion |

## Why the AGPL {#why-agpl}

:::why
Mocky is a server people use through a browser, and that is exactly the case an
ordinary copyleft licence never reaches: the GPL's obligations start when a copy
is distributed, and a hosted service distributes nothing.
:::

Under the GPL, someone could modify Mocky, run it as a service for thousands of
people and never publish a line of their changes, because no copy ever changes
hands. The AGPL adds one obligation, section 13: whoever lets users interact
with a modified version over a network must offer them that version's source.
Everything else — use, study, modification, sharing — is the same freedom the
GPL gives.

"Or later" means a future version of the AGPL published by the Free Software
Foundation can also be chosen by whoever receives the code.

## What Mocky produces is yours {#output}

:::why
An export carries Mocky's own code next to yours. Without an explicit exception,
every site published from an export would have to be AGPL too — a licence that
was chosen to protect Mocky would have reached into its users' projects.
:::

The code a model writes for you was never Mocky's to license. But Mocky adds its
own files to what it hands you: an exported project carries the components under
`src/components/ui/` (icons, charts, `<Animated>`, `<Scene3D>`, the Motion Ultra
kit…), the helpers under `src/lib/` and the scaffolding of a runnable Vite
project. Those files are Mocky's code, written by its authors.

So `NOTICE` grants a second additional permission: **any file Mocky produces for
a user to download or export** — an exported project, a downloaded screen, a PDF,
a `.pptx`, an image, a film — and any work that contains it may be used, modified
and distributed under terms of your choice, without the AGPL's conditions.
Every exported project says so in its own `README.md`, so the permission travels
with the zip.

Three limits:

- **Mocky itself is not covered.** A modified Mocky, or another program that
  generates or exports interfaces and uses those files to do it, stays under the
  AGPL. The exception frees your project, not a competing generator.
- **Third-party notices stay.** A file that carries its own notice keeps it: the
  `cn()` helper is MIT code from MagicUI, and the icon geometry comes from
  Feather, under MIT.
- **The exception speaks only for Mocky's authors.** A stock photo keeps its
  Pexels or Pixabay licence, and what a model writes keeps whatever terms your
  provider sets.

## The video worker and Remotion {#remotion}

:::why
Remotion's licence is not compatible with the GPL, so without a written
permission nobody could legally redistribute a worker built from this repository
— the AGPL would demand that the whole combination be offered under its terms.
:::

The first additional permission in `NOTICE`, under section 7 of the AGPL, allows
Mocky to be combined with `remotion` and `@remotion/*`. In practice that
combination exists only in `worker/video/`, the optional render worker behind the
`video-export` profile.

The permission settles Mocky's side of the question and nothing else. It grants
no right over Remotion: Remotion is free for individuals, non-profits and
companies of up to three employees, and requires a paid licence beyond that —
whoever builds the worker image is the one who has to check.
[Motion Ultra](video-export.md) explains why the worker is a separate service.

## Dependencies {#dependencies}

:::why
A copyleft licence holds only if everything combined with the code is compatible
with it. The inventory was taken when the licence changed, and it is written here
so the next dependency is checked against it rather than assumed.
:::

| Where | Licences | Compatible with the AGPL v3 |
|---|---|---|
| Mocky's npm dependencies (444 packages in `package-lock.json`) | MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, CC0-1.0, MIT AND Zlib; CC-BY-4.0 for one data package; MPL-2.0 for `lightningcss`, a build-time tool | Yes |
| Browser bundles in `public/vendor/` | React, ReactDOM, Babel standalone, html2canvas, Tailwind, daisyUI, Motion, three.js — all MIT | Yes |
| Quality detection | `impeccable`, Apache-2.0 | Yes: Apache-2.0 code may be included in a GPLv3 work |
| Video worker | `three`, `@react-three/fiber`, `express`, `lottie-web`, `react-useanimations`: MIT. Typefaces from `@fontsource`: OFL-1.1, shipped as separate font files | Yes |
| Video worker | `remotion`, `@remotion/*` | No — covered by [the section 7 permission](#remotion) |
| External programs | `ffmpeg`, the headless Chrome the worker renders with | Not combined: they run as separate programs |

## For contributors {#contributors}

:::why
Two exceptions only work if every line they cover belongs to the people granting
them. A contribution that changes that, or a dependency that breaks the
compatibility above, would quietly undo what `NOTICE` promises.
:::

- A contribution is accepted under `AGPL-3.0-or-later`, including the two
  permissions in `NOTICE` — the same licence it is read under, as GitHub's terms
  already provide.
- A new dependency must be compatible with the GPL v3. GPL-2.0-only, SSPL, BUSL,
  "Commons Clause" and non-commercial licences are not. A second incompatible
  package needs its own permission, decided by the copyright holders, never
  added in code.
- A component copied into exports (`src/lib/capabilities/snippets/`) must be
  Mocky's own code or carry a permissive notice of its own: the output exception
  can only grant what Mocky's authors own.
