import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {
  VideoConfigStore,
  mergeVideoConfig,
  publicVideoConfig,
  defaultVideoConfig,
  videoEnabledFor,
  ACCESS_MODES,
} from './config.js'

let dir
beforeEach(() => {
  dir = path.join(os.tmpdir(), `mocky-vidcfg-${crypto.randomBytes(6).toString('hex')}`)
  fs.mkdirSync(dir, { recursive: true })
})
afterEach(() => {
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
})

describe('mergeVideoConfig', () => {
  // The worker is an opt-in Docker service and a render costs CPU. Anything but
  // "off, allowlist" as a default would turn a `git pull` into a live feature.
  it('defaults to off, allowlist, no key and no worker', () => {
    const c = defaultVideoConfig()
    expect(c.enabled).toBe(false)
    expect(c.access).toBe('allowlist')
    expect(c.licenseKey).toBe(null)
    expect(c.allowedUserIds).toEqual([])
    expect(c.workerUrl).toBe(null)
  })

  it('KEEPS the stored licence key when the patch omits it or sends an empty string', () => {
    const withKey = mergeVideoConfig(null, { licenseKey: 'rmt-secret' })
    expect(mergeVideoConfig(withKey, { enabled: true }).licenseKey).toBe('rmt-secret')
    expect(mergeVideoConfig(withKey, { licenseKey: '' }).licenseKey).toBe('rmt-secret')
  })

  it('CLEARS the licence key when the patch sends null', () => {
    const withKey = mergeVideoConfig(null, { licenseKey: 'rmt-secret' })
    expect(mergeVideoConfig(withKey, { licenseKey: null }).licenseKey).toBe(null)
  })

  it('accepts a known access mode and ignores an unknown one', () => {
    expect(mergeVideoConfig(null, { access: 'all' }).access).toBe('all')
    expect(mergeVideoConfig(null, { access: 'everyone' }).access).toBe('allowlist')
  })

  // The panel edits a list: merging would make a removal unexpressible, so an
  // account revoked in the UI would keep its access forever.
  it('REPLACES the allowlist rather than merging it, and dedupes', () => {
    const c = mergeVideoConfig(null, { allowedUserIds: ['u1', 'u2'] })
    expect(mergeVideoConfig(c, { allowedUserIds: ['u2'] }).allowedUserIds).toEqual(['u2'])
    expect(mergeVideoConfig(c, { enabled: true }).allowedUserIds).toEqual(['u1', 'u2']) // untouched by an unrelated patch
    expect(mergeVideoConfig(null, { allowedUserIds: ['u1', 'u1', ' u1 '] }).allowedUserIds).toEqual(['u1'])
  })

  // `[''].includes(user?.id ?? '')` is a very quiet way to let an unauthenticated
  // request through.
  it('drops empty and non-string ids from the allowlist', () => {
    expect(mergeVideoConfig(null, { allowedUserIds: ['', '   ', null, 42, 'u1'] }).allowedUserIds).toEqual(['u1'])
    expect(mergeVideoConfig(null, { allowedUserIds: 'u1' }).allowedUserIds).toEqual([])
  })

  it('clears the worker URL on null or "", and refuses a non-http one', () => {
    const c = mergeVideoConfig(null, { workerUrl: 'http://remotion:3030' })
    expect(c.workerUrl).toBe('http://remotion:3030')
    expect(mergeVideoConfig(c, { workerUrl: null }).workerUrl).toBe(null)
    expect(mergeVideoConfig(c, { workerUrl: '' }).workerUrl).toBe(null)
    // The server fetches this URL; a stored typo fails much later, in the queue.
    expect(mergeVideoConfig(c, { workerUrl: 'file:///etc/passwd' }).workerUrl).toBe('http://remotion:3030')
    expect(mergeVideoConfig(c, { workerUrl: 'not a url' }).workerUrl).toBe('http://remotion:3030')
    expect(mergeVideoConfig(c, { enabled: true }).workerUrl).toBe('http://remotion:3030')
  })

  it('ignores a non-boolean enabled instead of coercing a string to true', () => {
    expect(mergeVideoConfig(null, { enabled: 'false' }).enabled).toBe(false)
    expect(mergeVideoConfig({ enabled: true }, { enabled: 'nope' }).enabled).toBe(true)
  })
})

describe('publicVideoConfig', () => {
  it('never exposes the licence key — only hasLicenseKey', () => {
    const cfg = mergeVideoConfig(null, { licenseKey: 'rmt-secret', enabled: true, allowedUserIds: ['u1'] })
    const view = publicVideoConfig(cfg)
    expect(JSON.stringify(view)).not.toContain('rmt-secret')
    expect(view.licenseKey).toBeUndefined()
    expect(view.hasLicenseKey).toBe(true)
    expect(view.enabled).toBe(true)
    expect(view.allowedUserIds).toEqual(['u1'])
    expect(view.accessModes).toEqual(ACCESS_MODES)
  })

  it('reports hasLicenseKey false when there is none', () => {
    expect(publicVideoConfig(defaultVideoConfig()).hasLicenseKey).toBe(false)
  })
})

describe('videoEnabledFor', () => {
  const admin = { id: 'a1', role: 'admin' }
  const user = { id: 'u1', role: 'user' }

  it('says no while the feature is off, whatever the access mode', () => {
    expect(videoEnabledFor({ enabled: false, access: 'all' }, user)).toBe(false)
    expect(videoEnabledFor({ enabled: false, access: 'allowlist', allowedUserIds: ['u1'] }, user)).toBe(false)
  })

  it('says yes to everyone when access is "all"', () => {
    expect(videoEnabledFor({ enabled: true, access: 'all' }, user)).toBe(true)
    expect(videoEnabledFor({ enabled: true, access: 'all' }, admin)).toBe(true)
  })

  it('checks membership when access is "allowlist"', () => {
    const cfg = { enabled: true, access: 'allowlist', allowedUserIds: ['u1'] }
    expect(videoEnabledFor(cfg, user)).toBe(true)
    expect(videoEnabledFor(cfg, { id: 'u2' })).toBe(false)
  })

  // Deliberate: an admin grants themselves the right in one click, and that
  // click is what keeps the per-account count of who renders honest.
  it('does NOT let an admin through on their role alone', () => {
    const cfg = { enabled: true, access: 'allowlist', allowedUserIds: ['u1'] }
    expect(videoEnabledFor(cfg, admin)).toBe(false)
    expect(videoEnabledFor({ ...cfg, allowedUserIds: ['u1', 'a1'] }, admin)).toBe(true)
  })

  it('says no when there is no account at all, or an empty id', () => {
    const cfg = { enabled: true, access: 'allowlist', allowedUserIds: ['', 'u1'] }
    expect(videoEnabledFor(cfg, null)).toBe(false)
    expect(videoEnabledFor(cfg, undefined)).toBe(false)
    expect(videoEnabledFor(cfg, {})).toBe(false)
    expect(videoEnabledFor(cfg, { id: '' })).toBe(false)
  })

  it('says no on an empty or missing config rather than throwing', () => {
    expect(videoEnabledFor(null, user)).toBe(false)
    expect(videoEnabledFor({}, user)).toBe(false)
  })
})

describe('VideoConfigStore', () => {
  it('persists across instances, licence key included', () => {
    const s1 = new VideoConfigStore(dir)
    s1.update({ enabled: true, licenseKey: 'rmt-1', access: 'all', workerUrl: 'http://worker:3030' })
    const s2 = new VideoConfigStore(dir)
    expect(s2.get().enabled).toBe(true)
    expect(s2.get().licenseKey).toBe('rmt-1')
    expect(s2.get().access).toBe('all')
    expect(s2.get().workerUrl).toBe('http://worker:3030')
  })

  it('applies partial updates without losing other settings', () => {
    const s = new VideoConfigStore(dir)
    s.update({ licenseKey: 'rmt-1', allowedUserIds: ['u1'] })
    s.update({ enabled: true })
    expect(s.get().licenseKey).toBe('rmt-1')
    expect(s.get().allowedUserIds).toEqual(['u1'])
    expect(s.get().enabled).toBe(true)
  })

  it('starts from the defaults when the file is missing or corrupt', () => {
    fs.writeFileSync(path.join(dir, 'video-config.json'), '{ not json')
    expect(new VideoConfigStore(dir).get()).toEqual(defaultVideoConfig())
  })

  // temp + rename: a reader must never see a half-written config, and a crash
  // mid-write must not leave the previous one truncated.
  it('writes atomically and leaves no temp file behind', () => {
    const s = new VideoConfigStore(dir)
    s.update({ enabled: true })
    const files = fs.readdirSync(dir)
    expect(files).toContain('video-config.json')
    expect(files.filter((f) => f.endsWith('.tmp'))).toEqual([])
  })

  it('never throws when the path is unwritable, and still applies in memory', () => {
    const asFile = path.join(dir, 'afile')
    fs.writeFileSync(asFile, 'x')
    const s = new VideoConfigStore(asFile) // parent is a file → ENOTDIR on write
    expect(() => s.update({ enabled: true })).not.toThrow()
    expect(s.get().enabled).toBe(true)
    expect(s.lastPersistError).toBeTruthy()
  })

  it('exposes enabledFor on the store, with the same rules', () => {
    const s = new VideoConfigStore(dir)
    expect(s.enabledFor({ id: 'u1' })).toBe(false)
    s.update({ enabled: true, allowedUserIds: ['u1'] })
    expect(s.enabledFor({ id: 'u1' })).toBe(true)
    expect(s.enabledFor({ id: 'u2', role: 'admin' })).toBe(false)
  })
})
