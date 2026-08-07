import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The Remotion worker is kept out of Mocky, and this is the only thing that
 * enforces it.
 *
 * The separation was argued for in four documents — `worker/video/README.md`,
 * the Dockerfile, the compose file and `server/video/worker.js` — and guarded by
 * none of them. Prose does not fail a build. One `npm install remotion` run in
 * the repository root to "just try the composition locally", one line deleted
 * from `.dockerignore` while chasing something else, and the default image ships
 * Remotion to every operator who never asked for it.
 *
 * That is not a size regression, it is a licensing one. Remotion is free for
 * individuals, non-profits and companies up to three employees, and its licence
 * does not address redistribution inside a self-hosted product. The whole point
 * of the separate image and the opt-in compose profile is that the question
 * belongs to whoever builds the worker. Once Remotion is in the default image,
 * it belongs to everyone, silently, and no test after the fact can un-ship it.
 *
 * Everything below reads files as text, like `tests/preview-sandbox.test.js`:
 * no YAML parser, no new dependency, and it works on a checkout that has never
 * installed anything.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const manifest = JSON.parse(read('package.json'))

/** Every dependency field npm installs from, not just `dependencies`. */
const DEP_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']

const allDeps = () =>
  DEP_FIELDS.flatMap((field) => Object.keys(manifest[field] || {}).map((name) => `${field}: ${name}`))

describe("Mocky's manifest", () => {
  it('declares no Remotion package, in any dependency field', () => {
    // `peerDependencies` is in the list because it is the one that looks
    // harmless: it installs nothing itself, and it still puts Remotion in the
    // tree of anyone who resolves it.
    const remotion = allDeps().filter((entry) => /(^|[: ])(@remotion\/|remotion$)/.test(entry))
    expect(remotion, 'Remotion must live in worker/video/package.json and nowhere else').toEqual([])
  })

  /**
   * The other half of the same posture, and the one a queue invites: a job
   * runner is exactly the feature somebody reaches for Redis to build. The store
   * is JSON files written atomically — see "no database, no native dependencies"
   * in the invariants, which is also why SQLite was refused for Muse.
   */
  it('declares no queue server and no database driver', () => {
    const banned = /(^|[: ])(redis|ioredis|bullmq|bull|kue|agenda|better-sqlite3|sqlite3|node-sqlite3|pg|mysql|mysql2|mongodb)$/
    expect(allDeps().filter((entry) => banned.test(entry))).toEqual([])
  })

  it('does not reference the worker sub-project from a script or a workspace', () => {
    // A `workspaces` entry would hoist Remotion into the root node_modules on a
    // plain `npm install`, which is the contamination by the back door: nothing
    // in `dependencies` changes and the packages are installed anyway.
    expect(manifest.workspaces).toBeUndefined()
    const scripts = Object.values(manifest.scripts || {}).join(' ')
    expect(scripts).not.toMatch(/worker[/\\]video/)
  })
})

describe("Mocky's own source", () => {
  /** Every .js/.ts/.tsx under the app, excluding the worker sub-project itself. */
  function sourceFiles(dir, out = []) {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'data') continue
        sourceFiles(rel, out)
      } else if (/\.(m?js|ts|tsx|jsx)$/.test(entry.name)) {
        out.push(rel)
      }
    }
    return out
  }

  const files = [...sourceFiles('src'), ...sourceFiles('server'), ...sourceFiles('scripts')]

  it('found the source tree', () => {
    // A glob that matches nothing turns the check below into a loop over zero
    // files — green, and verifying nothing at all.
    expect(files.length).toBeGreaterThan(50)
  })

  it('imports no Remotion package anywhere', () => {
    // Not an import Mocky could satisfy: the package is not installed here, so
    // this would fail at run time inside the server — the worst place, because
    // the server boots fine until the first export.
    const offenders = files.filter((f) => /from\s+['"](@remotion\/[^'"]+|remotion)['"]/.test(read(f)))
    expect(offenders).toEqual([])
  })
})

describe('the default Docker image', () => {
  it('excludes worker/ from the build context', () => {
    // `COPY . .` in the root Dockerfile: without this line the worker's source
    // enters the image and the builder layer, and a build cache can be pushed.
    const lines = read('.dockerignore')
      .split(/\r?\n/)
      .map((l) => l.trim())
    expect(lines).toContain('worker')
  })

  it('never installs a Remotion package', () => {
    expect(read('Dockerfile')).not.toMatch(/remotion/i)
  })
})

describe('docker-compose.yml', () => {
  const compose = read('docker-compose.yml')

  /** The lines of one top-level service block, by two-space indentation. */
  function serviceBlock(name) {
    const lines = compose.split(/\r?\n/)
    const start = lines.findIndex((l) => new RegExp(`^ {2}${name}:\\s*$`).test(l))
    if (start === -1) return null
    const block = []
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue
      if (!/^ {3,}/.test(lines[i])) break
      block.push(lines[i])
    }
    return block.join('\n')
  }

  /**
   * The line that decides whether `docker compose up -d` builds Remotion. It is
   * one word, in a file people edit for unrelated reasons — a port, a volume, a
   * memory limit — and losing it looks like nothing in a diff.
   */
  it('keeps video-worker behind the video-export profile', () => {
    const block = serviceBlock('video-worker')
    expect(block, 'the video-worker service is missing from docker-compose.yml').toBeTruthy()
    expect(block).toMatch(/^\s*profiles:\s*\[\s*["']video-export["']\s*\]\s*$/m)
  })

  it('leaves the mocky service with no profile, so it still starts by default', () => {
    // The mirror-image mistake: a profile added to the app itself, and
    // `docker compose up -d` silently starts nothing.
    expect(serviceBlock('mocky')).not.toMatch(/^\s*profiles:/m)
  })

  it('builds the worker from its own context, not from the repository root', () => {
    expect(serviceBlock('video-worker')).toMatch(/context:\s*\.\/worker\/video/)
  })

  /**
   * No key configured means no egress, and that is the state the feature is
   * designed to run in. Flipping this to `false` is the one visible switch that
   * gives the render container outbound access, and it belongs to whoever
   * entered a Remotion licence key — never to a refactor.
   */
  it('keeps the worker network internal', () => {
    const networks = compose.slice(compose.lastIndexOf('\nnetworks:'))
    expect(networks).toMatch(/video-worker:\s*\n\s*internal:\s*true/)
  })
})

describe('the worker sub-project', () => {
  const workerManifest = JSON.parse(read('worker/video/package.json'))

  /**
   * Exact pins, not ranges. No lockfile is committed — generating one means
   * installing Remotion inside this repository, the contamination the whole
   * separation exists to prevent — so the pins are the only thing making two
   * builds of the same commit ship the same renderer, and the same licence
   * terms.
   */
  it('pins every Remotion package to an exact version', () => {
    const remotion = Object.entries(workerManifest.dependencies || {}).filter(([name]) =>
      /^(@remotion\/|remotion$)/.test(name),
    )
    expect(remotion.length).toBeGreaterThanOrEqual(3)
    for (const [name, range] of remotion) {
      expect(`${name}@${range}`).toMatch(/@\d+\.\d+\.\d+$/)
    }
  })

  it('agrees on one Remotion version across all three packages', () => {
    // Mixed versions of the bundler and the renderer fail at render time with a
    // message about a composition, which sends everyone to the wrong file.
    const versions = new Set(
      Object.entries(workerManifest.dependencies || {})
        .filter(([name]) => /^(@remotion\/|remotion$)/.test(name))
        .map(([, range]) => range),
    )
    expect([...versions]).toHaveLength(1)
  })

  it('is marked private, so it can never be published by accident', () => {
    expect(workerManifest.private).toBe(true)
  })
})
