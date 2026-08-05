/**
 * A local preview for the documentation site.
 *
 * `docs-site/` has no build step — it is docsify, vendored, reading Markdown
 * straight from GitHub. That is a virtue, but it left the site with no way to
 * be opened locally at all, and the consequence showed up on someone's phone:
 * the theme switch had been sitting in the middle of the menu on every narrow
 * screen, because nobody could look at the thing at a narrow width without
 * deploying it first.
 *
 * Zero dependencies, on purpose. The repository refuses native modules and the
 * server store is JSON files; a static file server is not the place to break
 * that. `node:http` and `node:fs` are enough.
 *
 * Note that pages still fetch their Markdown from `basePath` on
 * raw.githubusercontent.com. That is deliberate — it is what production does,
 * so the sidebar you preview is the sidebar people actually get, at its real
 * length. It also means this needs a network connection to show any prose.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..', 'docs-site')
const PORT = Number(process.env.DOCS_PORT || 4173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

const server = createServer(async (req, res) => {
  // Query and hash are docsify's routing, not ours: every real path is a file.
  const path = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0])
  // `normalize` collapses `..` before the prefix check, so a crafted path
  // cannot climb out of docs-site. Serving the repo over HTTP would expose
  // every key and note in it.
  const target = normalize(join(ROOT, path === '/' ? 'index.html' : path))
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    res.writeHead(403).end('Forbidden')
    return
  }

  try {
    const body = await readFile(target)
    res.writeHead(200, {
      'Content-Type': TYPES[extname(target).toLowerCase()] || 'application/octet-stream',
      // A preview that caches is a preview that lies about the edit you just made.
      'Cache-Control': 'no-store',
    })
    res.end(body)
  } catch {
    // Anything else is a docsify route, which index.html resolves client-side.
    try {
      const html = await readFile(join(ROOT, 'index.html'))
      res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' }).end(html)
    } catch {
      res.writeHead(404).end('Not found')
    }
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`docs preview: http://127.0.0.1:${PORT}/`)
})
