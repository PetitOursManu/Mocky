# Vendored browser bundles

These files are served to the **sandboxed preview iframes**, which compile and
run model-generated components. They are committed rather than fetched from a
CDN at runtime, for three reasons:

1. **Integrity.** A CDN compromise — or plain DNS interception on the local
   network — would otherwise mean arbitrary JavaScript executing inside Mocky.
   `src/lib/capture.ts` in particular used to load Babel from an *unversioned*
   `unpkg.com` URL, in an iframe that ran with Mocky's own origin.
2. **Offline.** The previews are the product. Loading Tailwind from
   `cdn.tailwindcss.com` meant every generated screen rendered unstyled without
   an internet connection, while the code claimed otherwise.
3. **A Content-Security-Policy is only possible once nothing external is
   loaded.** The preview `srcDoc` now declares a strict CSP; an external
   `<script src>` would be blocked by it.

This is invariant **I3** in `docs/adr/001-muse.md` ("No CDN `<script>` for JS").
`tests/preview-sandbox.test.js` fails the build if an `http(s)://`
script tag reappears in the preview pipeline.

## Contents

| File | Package | Version | SHA-256 | Patched |
|---|---|---|---|---|
| `react.production.min.js` | react | 18.3.1 | `d949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd` | — |
| `react-dom.production.min.js` | react-dom | 18.3.1 | `35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d` | — |
| `babel.min.js` | @babel/standalone | 7.29.7 | `b077558a0e5fbea26798443b6212cda6307583b09ec029bb8af207db570855a0` | yes |
| `html2canvas.min.js` | html2canvas | 1.4.1 | `e87e550794322e574a1fda0c1549a3c70dae5a93d9113417a429016838eab8cb` | — |
| `tailwind.min.js` | Tailwind Play CDN | 3.4.17 | `64b8656ae0edd79ff136198680367d51ac356621026cbd88bd6a9030e17b36dc` | yes |
| `daisyui.min.css` | daisyui | 4.12.10 | `36e28efcf6c4993c482e465b2cae3d63b2066f90ff91455d78bf3e9388af2925` | yes |
| `motion.js` | motion | 12.43.0 | `be2986aae4824690b4b1b451725e811a08ac44d1100ea269a4692f49f1a0f4ad` | built |
| `three.js` | three | 0.185.1 | `01940a583232ff8f1681548adbdeff74bb0e0ce83293cd9b5d1803cf8bace8bf` | built |
| `tegaki.js` | tegaki | 1.1.0 | `46b533b17993f9029be9c9c5654e1e69e926f2de74b9ea68ea7095db19353bbf` | built |
| `tegaki-caveat.js` | tegaki | 1.1.0 | `6b525a59a296892e7df7bc32d96ddd52ffcffd34889f2b4df16880c7c26017ff` | built |
| `tegaki-parisienne.js` | tegaki | 1.1.0 | `ad9ae0793beeaa0ea249f6f5d51c6196de83e6d6d0837ad15362318b8e70f1b2` | built |
| `tegaki-italianno.js` | tegaki | 1.1.0 | `cb654e0aefec89a4fa7665a307f601a7c0eb9c6c85c21f280a9b4468562cdf61` | built |
| `tegaki-ems-allure.js` | tegaki | 1.1.0 | `2bcfa642cde62fb60c96130ca0849d358e7393a3e0ec52a9d26b09ced4c52e4a` | built |
| `tegaki-hershey-script.js` | tegaki | 1.1.0 | `80c179751842bc6bc900ac132a6c9c96176b474d6c5c29ba136d6404aebbf2e8` | built |

### The two patches

Both remove console noise from inside the preview iframes. That console is where a
user reads real errors in their generated screen, so anything printed on every
render is not cosmetic — it is what buries the message that matters.

**`babel.min.js` — trailing `//# sourceMappingURL=babel.min.js.map` removed (38 bytes).**
The `.map` file is not vendored, so DevTools requested it on every render and the
preview CSP (`connect-src 'none'`) refused it — three errors per generated screen,
for a file that does not exist.

**`tailwind.min.js` — the `console.warn("cdn.tailwindcss.com should not be used in
production…")` call replaced by `void 0` (202 bytes).**
The warning tells you to stop loading Tailwind from a CDN. Mocky already did that:
the file is vendored here precisely so previews work offline and under a strict
CSP. The advice is correct in general and false in this context, and it printed
twice per render.

**`daisyui.min.css` — trailing `/*# sourceMappingURL=… */` removed (94 bytes).**
Same symptom, different file: DevTools asked jsdelivr for the `.map`, the preview
CSP refused it (`connect-src 'none'`), and the error appeared on every render of
a screen using the daisyUI capability.

Re-apply all three after any update, then refresh the hashes above.

### `three.js` is built too, and deliberately partial

three publishes ESM only, so the same argument as `motion.js` applies — and one
more. The full library is about a megabyte of loaders, controls, curves, audio
and post-processing, and the preview can reach none of it: the model never
writes three code, it names a scene out of the closed catalogue in
`src/lib/capabilities/snippets/Scene3D.ts`. So the bundle is built from a
hand-written entry point that re-exports exactly the classes those scenes draw
with, and esbuild drops everything else:

```bash
node scripts/build-vendor-three.mjs   # or: npm run vendor:three
```

522 KB raw, 133 KB gzipped, of which most is `WebGLRenderer` and the shaders it
compiles. It is loaded only by a screen whose capabilities include `three-lib`,
never by the shell. A scene that needs a class the entry point does not list
cannot be written without adding it there, rebuilding and re-pinning — which is
the point: every byte the sandbox executes is a byte somebody chose.

**A loader would be useless here even if it were bundled.** The preview CSP sets
`connect-src 'none'`, so a glTF or an HDRI could not be fetched at all. Every
scene in the catalogue is procedural for that reason, and that is a constraint
the catalogue was designed around rather than one it works against.
### `tegaki.js` and its fonts are built too, and split

Tegaki (MIT) writes text by hand: `<Handwriting>` (`snippets/Handwriting.ts`)
asks it for a self-drawing SVG — paths and CSS keyframes — which every renderer
of a page copies as it is. Tegaki publishes ESM only, so it is bundled here:

```bash
node scripts/build-vendor-tegaki.mjs   # or: npm run vendor:tegaki
```

`tegaki.js` is the renderer (`textToSvg` and nothing else, 68 KB) plus a loader,
and each font is a file of its own beside it, 94 to 269 KB, fetched the first
time a screen names it: five fonts in one file would be a megabyte for a screen
that writes one word in one of them. The renderer keeps Tegaki's MIT notice at
its top; each font file names its licence (SIL OFL 1.1, or the Hershey fonts'
terms). Not bundled: the DOM engine, the harfbuzz shaper — WebAssembly, which
the preview CSP would have to be widened for — and the font files, which only
the shaper and the engine read. It is loaded only by a screen whose
capabilities include `tegaki-lib`.

### `motion.js` is built, not copied

Every other file here is copied out of `node_modules` because it already ships a
browser build. Motion 12 publishes ESM and CJS only, and the preview iframe has
no module resolution — it loads plain scripts and reads globals off `window`.
So the bundle is produced once, at development time:

```bash
node scripts/build-vendor-motion.mjs
```

It bundles only what `<Animated>` uses (`motion`, `AnimatePresence`,
`useReducedMotion`) as an IIFE exposing `window.Motion`, and **redirects `react`
and `react-dom` to the globals the shell already sets**. Bundling a second React
inside it would give the frame two dispatchers and every hook would throw
"invalid hook call" the moment a motion component rendered.

Re-run it after bumping the pin in `package.json` — the pin is exact on purpose
— then paste the printed SHA-256 into the table above. Motion has shipped at
least one upgrade that silently stopped animating without throwing, so verify
the six presets **visually** before committing, not just "no console error".

### daisyUI was the last external request

It was the one capability still loaded from a CDN (`cdn.jsdelivr.net`). Vendoring
it means the preview and capture shells now fetch **nothing** from the network:
they work offline, and their CSP no longer needs to name any external host.

`tailwind.min.js` stays on Tailwind **3** while the `tailwindcss` devDependency
in `package.json` is on 4, and that split is deliberate. The devDependency builds
Mocky's own shell (`src/index.css`) and nothing else; this file compiles the
utility classes inside every preview, and the generation prompts, the quality
rules and the export chain all speak its v3 vocabulary — moving it to v4 would
change how screens that already exist render. Update it within 3.x only. (The
two were kept on the same version until 2026-10, when a security alert on a
dependency only v3 pulled in moved the shell alone.)

## Verifying

```bash
node scripts/check-vendor.mjs
```

It recomputes every hash and exits non-zero on a mismatch — run it after any
manual update, and it runs in CI.

## Updating

`react`, `react-dom`, `@babel/standalone` and `html2canvas` come from
`node_modules` after an `npm install` of the matching version. The Tailwind Play
build is not published to npm; fetch it from the official CDN, pinned:

```bash
curl -o public/vendor/tailwind.min.js https://cdn.tailwindcss.com/3.4.17
```

Then update the table above with the new version and hash.
