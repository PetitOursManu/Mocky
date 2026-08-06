// Who is using the instance, and how much of it.
//
// The disk budget next door answers "is the volume full"; it is one number for
// the whole instance and deliberately so. This answers a different question an
// administrator actually has to act on — WHOSE projects and media those bytes
// are — and the two cannot share a counter: the budget is a running total kept
// in memory precisely so it never walks the disk, and an attribution has to.
//
// Two honesty rules shape everything below.
//
// The media libraries are content-addressed and deduplicated (M8): one file on
// disk for identical bytes, however many people arrived at them. So ownership
// is a SET, not a field, and an image with two owners has its bytes split
// between them. Charging both the full size would make the column sum to more
// than the disk holds, which is the fastest way to make a dashboard untrusted.
//
// And nothing was recorded before this existed. Those images and clips are not
// unowned — their owner is simply unknown, and inventing one by correlating
// timestamps or project ids would be a guess printed as a fact. They are
// reported apart, under their own line, and left there.

import fs from 'node:fs'
import path from 'node:path'
import { dirSize } from './storage-quota.js'

/** Size of one file, or 0 when it is absent. Never throws. */
export function fileBytes(file) {
  try {
    const st = fs.statSync(file)
    return st.isFile() ? st.size : 0
  } catch {
    return 0
  }
}

/**
 * What a user's projects blob contains, without trusting it.
 *
 * The server stores this blob as an opaque string it never parses — that is
 * what lets projects gain fields without a server release. Counting them means
 * being the first code here to look inside, so it looks defensively: anything
 * that is not an array of objects is reported as unreadable rather than as
 * zero. A user whose blob failed to parse has not got zero projects, and
 * saying so would send an administrator hunting for a problem that is theirs.
 *
 * @param {string|null|undefined} raw the JSON string under `projects`
 * @returns {{projects:number, screens:number, deleted:number}|null}
 */
export function readProjectStats(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return { projects: 0, screens: 0, deleted: 0 }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  let projects = 0
  let screens = 0
  let deleted = 0
  for (const p of parsed) {
    if (!p || typeof p !== 'object') continue
    // Tombstones stay in the blob so a deletion can travel to the other devices
    // (see Project.deletedAt). They cost storage without being projects, which
    // is exactly the kind of gap that makes a total look wrong.
    if (p.deletedAt) {
      deleted += 1
      continue
    }
    projects += 1
    if (Array.isArray(p.screens)) screens += p.screens.length
  }
  return { projects, screens, deleted }
}

/**
 * Split each item's bytes across the users who put it there.
 *
 * Equal shares, so the per-user column and the unattributed line add up to the
 * libraries' real footprint. In practice the divisor is 1 almost always: it
 * takes two people arriving at byte-identical images for it to be anything
 * else, which is what deduplication is for and what makes it worth handling
 * rather than ignoring.
 *
 * @param {{owners?: string[], bytes: number}[]} items
 * @param {Set<string>} [known] user ids that still exist; owners outside it are
 *   treated as unattributed, so a deleted account does not keep a column
 * @returns {{byUser: Record<string,{bytes:number,count:number}>, unattributed:{bytes:number,count:number}}}
 */
export function splitOwnedBytes(items, known = null) {
  const byUser = {}
  const unattributed = { bytes: 0, count: 0 }
  for (const item of items) {
    const bytes = Math.max(0, Number(item?.bytes) || 0)
    const owners = Array.isArray(item?.owners)
      ? item.owners.filter((id) => typeof id === 'string' && id && (!known || known.has(id)))
      : []
    if (owners.length === 0) {
      unattributed.bytes += bytes
      unattributed.count += 1
      continue
    }
    const share = bytes / owners.length
    for (const id of owners) {
      const slot = byUser[id] || (byUser[id] = { bytes: 0, count: 0 })
      slot.bytes += share
      slot.count += 1
    }
  }
  // Fractional bytes are an artefact of the split, not a measurement.
  for (const slot of Object.values(byUser)) slot.bytes = Math.round(slot.bytes)
  return { byUser, unattributed }
}

/** The media libraries, reduced to the two things attribution needs. */
function imageItems(images) {
  if (!images?.list) return []
  return images.list().map((m) => ({ owners: m.owners, bytes: images.fileSize?.(m.hash) ?? 0 }))
}

function videoItems(videos) {
  if (!videos?.list) return []
  return videos.list().map((m) => {
    // A sequence is a directory — the source clip plus every extracted frame —
    // so its footprint is a walk, not a stat. This is the one genuinely
    // expensive part of the report, and why it is an admin-only route rather
    // than something the header polls.
    const dir = videos.dirFor?.(m.hash)
    return { owners: m.owners, bytes: dir ? dirSize(dir) : 0 }
  })
}

/**
 * The per-user report behind GET /api/admin/usage.
 *
 * @param {object} deps
 * @param {string} deps.dataDir
 * @param {{id:string, username:string, role?:string, createdAt?:number}[]} deps.users
 * @param {object} [deps.images] ImageLibrary
 * @param {object} [deps.videos] VideoLibrary
 * @param {{bytes:number, maxBytes:number, ratio:number|null}} [deps.instance] disk budget usage()
 */
export function collectUsage({ dataDir, users, images = null, videos = null, instance = null }) {
  const known = new Set(users.map((u) => u.id))
  const media = splitOwnedBytes([...imageItems(images), ...videoItems(videos)], known)

  const rows = users.map((u) => {
    const dataFile = path.join(dataDir, `data-${u.id}.json`)
    const dataBytes = fileBytes(dataFile)
    const avatarBytes = fileBytes(path.join(dataDir, 'avatars', String(u.id).replace(/[^a-zA-Z0-9-]/g, '')))
    let stats = { projects: 0, screens: 0, deleted: 0 }
    let readable = true
    if (dataBytes > 0) {
      try {
        stats = readProjectStats(JSON.parse(fs.readFileSync(dataFile, 'utf8'))?.projects)
      } catch {
        stats = null
      }
      if (!stats) {
        readable = false
        stats = { projects: 0, screens: 0, deleted: 0 }
      }
    }
    const mediaSlot = media.byUser[u.id] || { bytes: 0, count: 0 }
    return {
      id: u.id,
      username: u.username,
      role: u.role || 'user',
      createdAt: u.createdAt ?? null,
      projects: stats.projects,
      screens: stats.screens,
      deletedProjects: stats.deleted,
      /** False when the blob would not parse — reported, never rounded to zero. */
      readable,
      media: mediaSlot.count,
      bytes: {
        data: dataBytes,
        avatar: avatarBytes,
        media: mediaSlot.bytes,
        total: dataBytes + avatarBytes + mediaSlot.bytes,
      },
    }
  })

  rows.sort((a, b) => b.bytes.total - a.bytes.total)

  return {
    users: rows,
    /**
     * Media that predates ownership being recorded, or whose owner has since
     * been deleted. Its own line rather than a share of everyone's, because it
     * is a known quantity of bytes with an unknown owner.
     */
    unattributed: media.unattributed,
    instance,
  }
}
