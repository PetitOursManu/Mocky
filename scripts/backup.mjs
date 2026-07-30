#!/usr/bin/env node
/**
 * Backs up Mocky's data directory into a timestamped ZIP.
 *
 *   npm run backup              → backups/mocky-YYYY-MM-DD-HHmm.zip
 *   npm run backup -- <dir>     → writes into <dir> instead
 *
 * Written in Node rather than documented as a shell one-liner because the two
 * procedures the README used to give — `docker run -v $(pwd):/backup …` and
 * `openssl rand` — cannot run on Windows: `$(pwd)` is not cmd.exe syntax, it
 * expands to a path containing a space under PowerShell (which breaks the `-v`
 * argument), and `openssl` is not on a standard Windows PATH.
 *
 * Uses the repo's own dependency-free ZIP writer, so this works with nothing
 * installed beyond Node.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = process.env.MOCKY_DATA_DIR
  ? path.resolve(process.env.MOCKY_DATA_DIR)
  : path.join(root, 'server', 'data')

if (!fs.existsSync(dataDir)) {
  console.error(`No data directory at ${dataDir} — nothing to back up.`)
  console.error('If Mocky runs in Docker, copy it out of the volume first:')
  console.error('  docker compose cp mocky:/app/server/data ./server/data')
  process.exit(1)
}

const outDir = path.resolve(process.argv[2] || path.join(root, 'backups'))
fs.mkdirSync(outDir, { recursive: true })

/** Every file under `dir`, as paths relative to it. */
function walk(dir, prefix = '') {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel))
    else if (entry.isFile() && !entry.name.endsWith('.tmp')) out.push(rel)
  }
  return out
}

const files = walk(dataDir)
if (files.length === 0) {
  console.error(`${dataDir} is empty — nothing to back up.`)
  process.exit(1)
}

// ---- minimal ZIP writer (store, no compression) + CRC32 --------------------
// Same approach as src/lib/zip.ts, kept standalone so this script has no build
// step and no imports from the app.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { time, date }
}

function buildZip(entries) {
  const chunks = []
  const central = []
  let offset = 0
  for (const { name, data, mtime } of entries) {
    const nameBuf = Buffer.from(name, 'utf8')
    const { time, date } = dosTime(mtime)
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // UTF-8 names
    local.writeUInt16LE(0, 8) // stored
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    chunks.push(local, nameBuf, data)

    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4)
    cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(0x0800, 8)
    cd.writeUInt16LE(0, 10)
    cd.writeUInt16LE(time, 12)
    cd.writeUInt16LE(date, 14)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(data.length, 20)
    cd.writeUInt32LE(data.length, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt32LE(offset, 42)
    central.push(Buffer.concat([cd, nameBuf]))

    offset += local.length + nameBuf.length + data.length
  }

  const centralBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...chunks, centralBuf, end])
}

const entries = files.map((rel) => {
  const full = path.join(dataDir, rel)
  return { name: rel, data: fs.readFileSync(full), mtime: fs.statSync(full).mtime }
})

const d = new Date()
const pad = (n) => String(n).padStart(2, '0')
const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
const outFile = path.join(outDir, `mocky-${stamp}.zip`)

fs.writeFileSync(outFile, buildZip(entries))

const bytes = fs.statSync(outFile).size
const mb = (bytes / 1024 / 1024).toFixed(1)
console.log(`Backed up ${entries.length} file(s) from ${dataDir}`)
console.log(`  → ${outFile} (${mb} MB)`)
console.log('\nTo restore: stop Mocky, unzip this over server/data, start again.')
