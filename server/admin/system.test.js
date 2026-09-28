import { describe, it, expect } from 'vitest'
import os from 'node:os'
import {
  cpuPercent,
  createSystemMonitor,
  hostCpuPercent,
  parseCfsQuota,
  parseCpuMax,
  parseKeyValues,
  parseMemLimit,
  readCgroup,
} from './system.js'

describe('cgroup parsing', () => {
  it('reads a v2 CPU quota', () => {
    expect(parseCpuMax('max 100000\n')).toBeNull()
    expect(parseCpuMax('200000 100000\n')).toBe(2)
    expect(parseCpuMax('50000 100000')).toBe(0.5)
  })

  it('reads a v1 CPU quota', () => {
    expect(parseCfsQuota('-1', '100000')).toBeNull()
    expect(parseCfsQuota('150000', '100000')).toBe(1.5)
  })

  // v1 says "no limit" with a number near 2^63; shown raw it is eight exabytes.
  it('treats both spellings of "no memory limit" as none', () => {
    expect(parseMemLimit('max')).toBeNull()
    expect(parseMemLimit('9223372036854771712')).toBeNull()
    expect(parseMemLimit('4294967296\n')).toBe(4294967296)
  })

  it('reads key/value stat files', () => {
    expect(parseKeyValues('usage_usec 1234\nuser_usec 1000\nbogus\n')).toEqual({ usage_usec: 1234, user_usec: 1000 })
  })

  it('reports the working set, not the page cache', () => {
    const files = {
      '/sys/fs/cgroup/memory.current': '3000000000\n',
      '/sys/fs/cgroup/memory.stat': 'anon 900000000\ninactive_file 2000000000\n',
      '/sys/fs/cgroup/memory.max': '4294967296\n',
      '/sys/fs/cgroup/cpu.max': '200000 100000\n',
      '/sys/fs/cgroup/cpu.stat': 'usage_usec 5000000\n',
    }
    const read = (p) => {
      if (!(p in files)) throw new Error('ENOENT')
      return files[p]
    }
    expect(readCgroup(read)).toEqual({
      version: 2,
      cpuLimit: 2,
      memLimit: 4294967296,
      memUsed: 1000000000,
      cpuUsec: 5000000,
    })
  })

  it('answers null outside any cgroup', () => {
    expect(
      readCgroup(() => {
        throw new Error('ENOENT')
      }),
    ).toBeNull()
  })
})

describe('CPU arithmetic', () => {
  // The case the cgroup read exists for: two busy cores on a big host.
  it('measures against the cores Mocky may use', () => {
    expect(cpuPercent(2_000_000, 1_000_000, 2)).toBe(100)
    expect(cpuPercent(2_000_000, 1_000_000, 32)).toBe(6.3)
    expect(cpuPercent(1, 0, 2)).toBeNull()
  })

  it('takes the busy share of host CPU time', () => {
    expect(hostCpuPercent({ idle: 100, total: 200 }, { idle: 150, total: 400 })).toBe(75)
    expect(hostCpuPercent({ idle: 0, total: 0 }, { idle: 0, total: 0 })).toBeNull()
  })
})

describe('createSystemMonitor', () => {
  it('keeps an hour of samples and computes rates from the second one on', () => {
    let t = 0
    const m = createSystemMonitor({ dataDir: os.tmpdir(), now: () => t, windowMs: 10_000, container: false })
    const first = m.tick()
    expect(first.process.cpu).toBeNull()
    expect(first.process.rss).toBeGreaterThan(0)
    t += 5000
    const second = m.tick()
    expect(second.process.cpu).not.toBeNull()
    expect(second.host.memTotal).toBe(os.totalmem())
    t += 20_000
    m.tick()
    expect(m.history()).toHaveLength(1)
    m.stop()
  })

  it('reads the GPU every tick while watched, once a minute otherwise, never at boot', () => {
    let t = 0
    let reads = 0
    let watching = false
    const gpu = {
      sample: async () => {
        reads++
        return { status: 'ok', devices: [] }
      },
      last: () => ({ status: 'ok', devices: [{ util: 5, memUsed: 1, memTotal: 2, temp: null }] }),
    }
    const m = createSystemMonitor({ dataDir: os.tmpdir(), now: () => t, gpu, watched: () => watching, container: false })
    m.tick()
    t += 5000
    m.tick()
    expect(reads).toBe(0)
    watching = true
    t += 5000
    m.tick()
    t += 5000
    const s = m.tick()
    expect(reads).toBe(2)
    watching = false
    t += 60_000
    m.tick()
    expect(reads).toBe(3)
    expect(s.gpu).toEqual([{ util: 5, memUsed: 1, memTotal: 2, temp: null }])
    m.stop()
  })
})
