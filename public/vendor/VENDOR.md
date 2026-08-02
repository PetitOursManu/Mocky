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

Keep `tailwind.min.js` on the same major/minor as the `tailwindcss` devDependency
in `package.json`: it is what compiles the utility classes inside every preview,
so a mismatch means previews render differently from the app.

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
