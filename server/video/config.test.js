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
  videoThreeDEnabledFor,
  ACCESS_MODES,
  DEFAULT_WORKER_URL,
  DEFAULT_THREE_D_ACCESS,
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
  it('defaults to off, allowlist and no key', () => {
    const c = defaultVideoConfig()
    expect(c.enabled).toBe(false)
    expect(c.access).toBe('allowlist')
    expect(c.licenseKey).toBe(null)
    expect(c.allowedUserIds).toEqual([])
  })

  /**
   * The one default that is NOT off, and the exception is the point: this
   * address is not the administrator's to invent. docker-compose.yml names the
   * service and fixes its port, so there is exactly one value that can work for
   * the shipped topology. An empty field made a mandatory question out of a
   * constant we control — and it changes nothing about safety, because
   * `enabled` is still false and nothing is reached until somebody turns it on.
   */
  it('points at the worker this repository ships, so nobody has to guess it', () => {
    expect(defaultVideoConfig().workerUrl).toBe(DEFAULT_WORKER_URL)
    expect(DEFAULT_WORKER_URL).toBe('http://video-worker:3030')
  })

  it('restores the shipped address when the field is cleared', () => {
    // Clearing used to mean "no worker", which was a second off-switch for a
    // feature that already has one. `enabled` is the master switch and the
    // panel puts it first; an address that disables by being wrong is a worse
    // control than a checkbox that says so.
    expect(mergeVideoConfig(defaultVideoConfig(), { workerUrl: '' }).workerUrl).toBe(DEFAULT_WORKER_URL)
    expect(mergeVideoConfig(defaultVideoConfig(), { workerUrl: null }).workerUrl).toBe(DEFAULT_WORKER_URL)
  })

  it('gives an instance that stored a null before the default existed', () => {
    // The real case this closes: a config saved when the field was mandatory
    // holds `workerUrl: null`, and a default applied only at file creation
    // never reaches it — so the admin who most needed the value still had to
    // go and find it.
    const stored = { ...defaultVideoConfig(), workerUrl: null }
    expect(mergeVideoConfig(stored, {}).workerUrl).toBe(DEFAULT_WORKER_URL)
  })

  it('keeps an address the operator actually chose', () => {
    const c = mergeVideoConfig(defaultVideoConfig(), { workerUrl: 'http://10.1.2.3:9000' })
    expect(c.workerUrl).toBe('http://10.1.2.3:9000')
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
  it('follows the same rules for the 3D scope and its list', () => {
    // The whole point of following the template instead of inventing one: the
    // mode is validated against the same enum, the list is REPLACED rather than
    // merged, and empty ids are dropped by the same helper.
    const base = mergeVideoConfig(null, { threeDAccess: 'allowlist', threeDAllowedUserIds: ['u1', 'u2'] })
    expect(base.threeDAccess).toBe('allowlist')
    expect(mergeVideoConfig(base, { threeDAccess: 'nobody' }).threeDAccess).toBe('allowlist')
    expect(mergeVideoConfig(base, { threeDAllowedUserIds: ['u2'] }).threeDAllowedUserIds).toEqual(['u2'])
    expect(mergeVideoConfig(base, { threeDAllowedUserIds: ['', 'u3', 'u3'] }).threeDAllowedUserIds).toEqual(['u3'])
    // And the two lists do not touch each other.
    expect(mergeVideoConfig(base, { allowedUserIds: ['u9'] }).threeDAllowedUserIds).toEqual(['u1', 'u2'])
  })

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

  it('resets the worker URL to the shipped one on null or "", and refuses a non-http one', () => {
    const c = mergeVideoConfig(null, { workerUrl: 'http://remotion:3030' })
    expect(c.workerUrl).toBe('http://remotion:3030')
    // Emptying restores the default rather than leaving nothing — `enabled` is
    // the off-switch, and a blank address was a second one that only ever
    // confused the panel.
    expect(mergeVideoConfig(c, { workerUrl: null }).workerUrl).toBe(DEFAULT_WORKER_URL)
    expect(mergeVideoConfig(c, { workerUrl: '' }).workerUrl).toBe(DEFAULT_WORKER_URL)
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

  /**
   * The 3D permission is admin-editable, so it has to be in the projection the
   * panel edits — and it has to be in it in the same shape as the pair above,
   * because a setting the panel cannot see is one an administrator cannot
   * change. Nothing here is a secret; the one thing that is stays a boolean.
   */
  it('carries the 3D scope and its list, and still leaks nothing', () => {
    const cfg = mergeVideoConfig(null, {
      licenseKey: 'rmt-secret',
      threeDAccess: 'allowlist',
      threeDAllowedUserIds: ['u1', 'u2'],
    })
    const view = publicVideoConfig(cfg)
    expect(view.threeDAccess).toBe('allowlist')
    expect(view.threeDAllowedUserIds).toEqual(['u1', 'u2'])
    expect(JSON.stringify(view)).not.toContain('rmt-secret')
    expect(view.licenseKey).toBeUndefined()
  })

  it('answers a known 3D mode for a config that has none, rather than undefined', () => {
    // The instance that saved this file before the setting existed. A panel
    // hydrating `undefined` into a <select> loses the value on the next save.
    expect(publicVideoConfig({ enabled: true }).threeDAccess).toBe(DEFAULT_THREE_D_ACCESS)
    expect(publicVideoConfig({ enabled: true }).threeDAllowedUserIds).toEqual([])
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

describe('videoThreeDEnabledFor', () => {
  const admin = { id: 'a1', role: 'admin' }
  const user = { id: 'u1', role: 'user' }
  /** An account Motion itself is open to, so only the 3D rule is under test. */
  const exporting = (over = {}) => ({ enabled: true, access: 'all', ...over })

  /**
   * The one default in this file that is not the closed one, and the reason is
   * that the closed default already exists one level up — see
   * DEFAULT_THREE_D_ACCESS. Pinned rather than left to the reader, because
   * "tighten this while you are in here" is exactly the change that would
   * silently delete a shipped block from every existing instance.
   */
  it('is open by default, inside a feature that is closed by default', () => {
    const c = defaultVideoConfig()
    expect(c.threeDAccess).toBe('all')
    expect(c.threeDAllowedUserIds).toEqual([])
    // And it grants nothing on its own: the master switch is still off.
    expect(videoThreeDEnabledFor(c, user)).toBe(false)
  })

  it('says no to an account that may not export at all', () => {
    // The load-bearing line: a 3D permission on an account with no Motion is a
    // right to nothing, and two lists read independently is how an admin ends up
    // debugging the wrong checkbox.
    expect(videoThreeDEnabledFor({ enabled: false, access: 'all', threeDAccess: 'all' }, user)).toBe(false)
    expect(
      videoThreeDEnabledFor(
        { enabled: true, access: 'allowlist', allowedUserIds: ['u2'], threeDAccess: 'all' },
        user,
      ),
    ).toBe(false)
  })

  it('says yes to everyone Motion is open to when the 3D scope is "all"', () => {
    expect(videoThreeDEnabledFor(exporting({ threeDAccess: 'all' }), user)).toBe(true)
    expect(videoThreeDEnabledFor(exporting({ threeDAccess: 'all' }), admin)).toBe(true)
  })

  it('checks membership when the 3D scope is "allowlist"', () => {
    const cfg = exporting({ threeDAccess: 'allowlist', threeDAllowedUserIds: ['u1'] })
    expect(videoThreeDEnabledFor(cfg, user)).toBe(true)
    expect(videoThreeDEnabledFor(cfg, { id: 'u2' })).toBe(false)
  })

  it('narrows, never widens: an empty 3D list means nobody', () => {
    // The configuration the user asked for — Motion for everyone, 3D for nobody
    // until somebody is named.
    const cfg = exporting({ threeDAccess: 'allowlist', threeDAllowedUserIds: [] })
    expect(videoEnabledFor(cfg, user)).toBe(true)
    expect(videoThreeDEnabledFor(cfg, user)).toBe(false)
  })

  // Inherited from `videoEnabledFor` rather than re-argued, and asserted because
  // inheritance is the kind of thing a refactor drops: the list is what the
  // per-account usage report counts, and a role that granted access implicitly
  // would make 3D renders appear against nobody's name.
  it('does NOT let an admin through on their role alone', () => {
    const cfg = {
      enabled: true,
      access: 'allowlist',
      allowedUserIds: ['a1'],
      threeDAccess: 'allowlist',
      threeDAllowedUserIds: ['u1'],
    }
    expect(videoThreeDEnabledFor(cfg, admin)).toBe(false)
    expect(videoThreeDEnabledFor({ ...cfg, threeDAllowedUserIds: ['u1', 'a1'] }, admin)).toBe(true)
  })

  it('says no with no account, an empty id, or no config at all', () => {
    const cfg = exporting({ threeDAccess: 'allowlist', threeDAllowedUserIds: ['', 'u1'] })
    expect(videoThreeDEnabledFor(cfg, null)).toBe(false)
    expect(videoThreeDEnabledFor(cfg, { id: '' })).toBe(false)
    expect(videoThreeDEnabledFor(null, user)).toBe(false)
    expect(videoThreeDEnabledFor({}, user)).toBe(false)
  })

  it('reads an unknown 3D mode as the closed one', () => {
    // A hand-edited file never passes through `mergeVideoConfig`, so anything
    // that is not the word "all" has to fail shut here.
    expect(videoThreeDEnabledFor(exporting({ threeDAccess: 'everyone' }), user)).toBe(false)
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
