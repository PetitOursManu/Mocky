import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The worker's image copies its top-level modules BY NAME, so a module added
 * beside `server.js` and imported by it is a container that starts on an
 * ERR_MODULE_NOT_FOUND — a failure no test running from the source tree can see.
 * `qc.js` was one line away from being that.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url))

function topLevelImports(file, seen = new Set()) {
  if (seen.has(file)) return seen
  seen.add(file)
  const src = fs.readFileSync(path.join(HERE, file), 'utf8')
  for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s+'\.\/([\w.-]+\.js)'|import\(\s*'\.\/([\w.-]+\.js)'\s*\)/g)) {
    const name = m[1] || m[2]
    if (name) topLevelImports(name, seen)
  }
  return seen
}

describe('the worker image', () => {
  it('copies every top-level module the server reaches', () => {
    const docker = fs.readFileSync(path.join(HERE, 'Dockerfile'), 'utf8')
    const copied = new Set(
      docker
        .split('\n')
        .filter((l) => l.startsWith('COPY'))
        .flatMap((l) => l.split(/\s+/))
        .filter((w) => w.endsWith('.js')),
    )
    for (const file of topLevelImports('server.js')) expect(copied.has(file), file).toBe(true)
  })
})
