// Generates `docker-compose.motion.yml` from `docker-compose.yml`.
//
// ── Why a generated file rather than an `include:` ───────────────────────────
//
// The first version of the Motion compose file was three lines: include the
// shipped file, clear the worker's profile. Real `docker compose` reads it
// exactly as intended — and the deployment it was written for does not. Coolify
// (like Dokploy and Portainer) does not hand the file to Compose: it PARSES it,
// rewrites it with its own labels and networks, and deploys the result. An
// `include:` key means nothing to that parser, so what reached the server was a
// file with one service that had no image and no build, and the deploy failed
// with `no service selected` — a message about a file nobody wrote.
//
// So the second file has to be whole. Whole means duplicated, and duplicated
// means drift: the worker's memory limit, its swap limit, its `/dev/shm`, the
// internal bridge with no route out — every one of those is a line that keeps a
// render from taking a host down, and a copy that quietly falls behind is worse
// than no copy. Hence this generator and the test beside it: the committed file
// is this script's output, `npm test` fails the day it is not, and the only
// edit anybody makes is to `docker-compose.yml`.
//
// ── What it changes, which is one line ───────────────────────────────────────
//
// `profiles: ["video-export"]` is removed from the worker service. Nothing else
// is touched — the comments travel with it, because in that file the comments
// are the documentation. The licence decision is untouched too: the shipped
// file still hides the worker, and choosing THIS file is the same deliberate
// act as typing `--profile video-export`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const SOURCE = 'docker-compose.yml'
export const TARGET = 'docker-compose.motion.yml'

/** The line that hides the worker, and the only thing this file removes. */
export const PROFILE_LINE = /^[ \t]*profiles:\s*\[\s*["']video-export["']\s*\]\s*$/

export const HEADER = `# Mocky + the Motion render worker, in one stack. GENERATED — do not edit.
#
#   npm run compose:motion        # after any change to docker-compose.yml
#   docker compose -f docker-compose.motion.yml up -d --build
#
# ── What this file is for ────────────────────────────────────────────────────
#
# \`docker-compose.yml\` keeps the render worker behind \`profiles:
# ["video-export"]\`, and that is a licensing decision rather than a technical
# one: Remotion is free for individuals, non-profits and companies with up to
# three employees, and its licence does not address redistribution inside a
# self-hosted product. Shipping it in the default path would hand the question
# to every operator who never uses the feature.
#
# A profile is a flag on a command line, and some deployments have no command
# line to put it on. A platform that deploys a compose file from a repository —
# Coolify, Dokploy, Portainer, a CI job — chooses a FILE, and several of them
# parse and rewrite that file rather than handing it to Compose, which is why
# this one is whole rather than an \`include:\` of its neighbour. Choosing it is
# the same deliberate act as typing the flag, and it answers the same question.
#
# Everything below is \`docker-compose.yml\`, with one line removed: the worker's
# profile. \`scripts/build-motion-compose.mjs\` does the removing and
# \`tests/video-worker-separation.test.js\` fails if this file has fallen behind,
# so the file to EDIT is always the other one.
#
# ── On a server ──────────────────────────────────────────────────────────────
#
# The worker asks for 4 GB of memory and 2 cores while it renders, so plan for
# them on top of Mocky itself. It publishes no port, has no route out of its own
# bridge, and Mocky reaches it in-cluster at http://video-worker:3030 — which is
# the address to leave in Admin → Motion.
#
# READ worker/video/README.md FIRST. It is a warning, not a footnote.
`

/** The shipped compose file, minus its own usage header and the worker's profile. */
export function motionCompose(source) {
  const lines = source.split(/\r?\n/)
  // The shipped file opens with a usage comment that says `docker compose up -d`
  // starts Mocky. True there, misleading here, and this file has a header of its
  // own — so the block is dropped rather than contradicted.
  let start = 0
  while (start < lines.length && (lines[start].startsWith('#') || lines[start].trim() === '')) start += 1
  const body = lines.slice(start).filter((line) => !PROFILE_LINE.test(line))
  if (body.length === lines.length - start) {
    throw new Error(`${SOURCE} no longer carries a video-export profile line; nothing to generate.`)
  }
  return `${HEADER}\n${body.join('\n').replace(/\s*$/, '')}\n`
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = fs.readFileSync(path.join(root, SOURCE), 'utf8')
  const out = motionCompose(source)
  fs.writeFileSync(path.join(root, TARGET), out)
  console.log(`compose: ${SOURCE} → ${TARGET} (${out.split('\n').length} lines)`)
}
