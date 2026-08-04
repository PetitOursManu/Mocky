/**
 * Never download Chrome.
 *
 * Nothing in Mocky drives a browser. Puppeteer is here only because
 * `impeccable` — the anti-pattern detector behind the quality pass — declares
 * it as an OPTIONAL dependency for its URL-scanning engine, which Mocky does
 * not use: the quality pass reads generated source, it never loads a page.
 *
 * Without this file, installing pulls a ~700 MB Chrome build into the npm cache
 * on every developer machine and every CI run, for code that never executes.
 *
 * This is the mechanism Puppeteer actually supports. Two alternatives look
 * right and are not:
 *
 *   - `omit=optional` in .npmrc removes far too much. Optional dependencies are
 *     how npm ships per-platform native binaries, so that flag also strips
 *     @rolldown/binding-* and esbuild's platform package, breaking the test
 *     runner and the build.
 *   - `puppeteer_skip_download` in .npmrc no longer does anything. Puppeteer
 *     stopped reading npm_config_* in v23; it reads this file, or the
 *     PUPPETEER_SKIP_DOWNLOAD environment variable.
 *
 * The file is .cjs because package.json declares "type": "module" and Puppeteer
 * loads its configuration with require().
 */
module.exports = {
  skipDownload: true,
}
