---
description: The open-source projects and services Mocky is built on, what each one does here, and its licence.
---

# Thanks

Mocky is built on the work of many open-source projects, and this page thanks
them. Each one remains under its own licence. The notices that licences require
are kept where the licences ask for them: in
[`NOTICE`](https://github.com/PetitOursManu/Mocky/blob/main/NOTICE), in
`public/vendor/VENDOR.md` and in each vendored file. The [License](license.md)
page explains how they fit together. The same list appears at the foot of the
Settings page, for the people who use an instance and never see the repository.

## The application {#app}

:::why
These run every time someone opens Mocky or generates a screen. The ones whose
code is copied into a screen or an export say so, because there the licence
travels with the file.
:::

| Project | What it does in Mocky | Licence |
|---|---|---|
| [React](https://react.dev) | The interface, and every generated screen | MIT |
| [Babel](https://babeljs.io) | Compiles a screen inside its preview | MIT |
| [Tailwind CSS](https://tailwindcss.com) | Styles for the interface (v4) and for generated screens (v3) | MIT |
| [daisyUI](https://daisyui.com) | Components that generated screens can use | MIT |
| [Motion](https://motion.dev) | Animations in generated pages | MIT |
| [three.js](https://threejs.org) | 3D scenes in generated pages | MIT |
| [html2canvas](https://html2canvas.hertzen.com) | Captures and image exports | MIT |
| [impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus | Deterministic defect detection in the [quality pass](quality.md) | Apache-2.0 |
| [PDF.js](https://mozilla.github.io/pdf.js/) | Reading an imported PDF | Apache-2.0 |
| [pdf-lib](https://pdf-lib.js.org) | PDF exports | MIT |
| [ag-psd](https://github.com/Agamnentzar/ag-psd) | Layered PSD exports | MIT |
| [Fontsource](https://fontsource.org) | The ~200 [fonts](fonts.md) served to screens | OFL-1.1, Apache-2.0, UFL-1.0 (per family) |
| [Magic UI](https://magicui.design) | Components copied into exports | MIT |
| [Feather](https://feathericons.com) | Icons copied into exports | MIT |
| [Express](https://expressjs.com) | The server | MIT |
| [Model Context Protocol SDK](https://modelcontextprotocol.io) | The [MCP server](mcp.md) assistants connect to | MIT |
| [Playwright](https://playwright.dev) | The browser that runs a generation an assistant asked for | Apache-2.0 |
| [Zod](https://zod.dev) | Validating film documents | MIT |
| [Lumy](https://github.com/PetitOursManu/Lumy) | This documentation site | MIT |

## Films {#video}

:::why
The video worker is a separate image that only an administrator who turns
[video export](video-export.md) on ever builds. Its projects are listed apart
because one of them is the one exception to Mocky's licence.
:::

| Project | What it does in Mocky | Licence |
|---|---|---|
| [HyperFrames](https://github.com/heygen-com/hyperframes) by HeyGen | The engine that draws and encodes a film | Apache-2.0 |
| [Remotion](https://www.remotion.dev) | The same job, as the fallback engine | Remotion License, [granted in `NOTICE`](license.md#remotion) |
| [React Three Fiber](https://github.com/pmndrs/react-three-fiber) | The 3D blocks of a film | MIT |
| [lottie-web](https://github.com/airbnb/lottie-web) | Animated icons in films | MIT |
| [useAnimations](https://useanimations.com) | The animations of those icons | MIT |
| [esbuild](https://esbuild.github.io) | Compiles a film for HyperFrames | MIT |
| [FFmpeg](https://ffmpeg.org) | Video encoding, run as a separate program | LGPL-2.1+ |
| [Chromium](https://www.chromium.org) | Draws every frame, run as a separate program | BSD-3-Clause |

## Services {#services}

:::why
These are not software Mocky ships but sites it asks for pictures, with a key
the administrator provides. Their terms apply to the pictures they return.
:::

| Service | What it does in Mocky |
|---|---|
| [Pexels](https://www.pexels.com) | Free stock photos and videos, for pictures and the Media library |
| [Pixabay](https://pixabay.com) | Free stock photos and videos, for pictures and the Media library |
