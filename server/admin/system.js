// How hard the machine is working, sampled every few seconds, kept for an hour.
//
// Three scopes, because a single "CPU %" is a lie whichever one it picks:
//
//  - the PROCESS: Mocky's own Node — what the event loop costs, what the JSON
//    stores and the provider relay cost;
//  - the CONTAINER, when there is one: Mocky plus everything it spawned — the
//    Chromium Muse launches to read a site, the MCP servers, ffmpeg cutting a
//    clip. This is the figure a Docker limit is enforced against;
//  - the HOST: the whole machine, which is what somebody means by "the server
//    is slow" when a neighbour is the one eating it.
//
// And the percentages are taken against what Mocky may USE, not against the
// hardware it sees. Inside a container limited to two cores on a 32-core host,
// `os.cpus()` still answers 32 and `os.totalmem()` the host's memory; a process
// pinned at its two-core ceiling would read as 6 % busy while every request
// queued. The cgroup files say what the limit is, so they are read first.
//
// In memory, one hour, like the activity ring. Nothing here is written.

import fs from 'node:fs'
import os from 'node:os'
import { monitorEventLoopDelay } from 'node:perf_hooks'

// ---- cgroup parsing (pure, tested) ----

/** cgroup v2 `cpu.max`: "max 100000" (no limit) or "200000 100000" (2 cores). */
export function parseCpuMax(text) {
  const [quota, period] = String(text || '').trim().split(/\s+/)
  if (!quota || quota === 'max') return null
  const q = Number(quota)
  const p = Number(period) || 100000
  return q > 0 && p > 0 ? q / p : null
}

/** cgroup v1: `cpu.cfs_quota_us` is -1 when unlimited. */
export function parseCfsQuota(quotaText, periodText) {
  const q = Number(String(quotaText || '').trim())
  const p = Number(String(periodText || '').trim()) || 100000
  return q > 0 && p > 0 ? q / p : null
}

/**
 * A memory limit. cgroup v2 writes "max"; v1 writes a huge number close to
 * 2^63 rounded down to a page — both mean "none", and the second one would
 * otherwise show a limit of eight exabytes.
 */
export function parseMemLimit(text) {
  const s = String(text || '').trim()
  if (!s || s === 'max') return null
  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0 || n >= 2 ** 60) return null
  return n
}

/** `memory.stat` / `cpu.stat`: "key value" lines. */
export function parseKeyValues(text) {
  const out = {}
  for (const line of String(text || '').split('\n')) {
    const [k, v] = line.trim().split(/\s+/)
    if (k && v !== undefined && Number.isFinite(Number(v))) out[k] = Number(v)
  }
  return out
}

/**
 * The container's own view. `read(path)` returns text or throws.
 *
 * Memory is the WORKING SET — usage less the inactive page cache — because that
 * is what `docker stats` shows and what the OOM killer weighs. Raw usage counts
 * every file Mocky has read since boot, and on an instance serving a large image
 * library it climbs to the limit while nothing is wrong.
 *
 * @returns {{ version: 1|2, cpuLimit: number|null, memLimit: number|null, memUsed: number|null, cpuUsec: number|null } | null}
 */
export function readCgroup(read) {
  const tryRead = (p) => {
    try {
      return String(read(p))
    } catch {
      return null
    }
  }
  const v2Current = tryRead('/sys/fs/cgroup/memory.current')
  if (v2Current != null) {
    const stat = parseKeyValues(tryRead('/sys/fs/cgroup/memory.stat'))
    const current = Number(v2Current.trim())
    const cpu = parseKeyValues(tryRead('/sys/fs/cgroup/cpu.stat'))
    return {
      version: 2,
      cpuLimit: parseCpuMax(tryRead('/sys/fs/cgroup/cpu.max')),
      memLimit: parseMemLimit(tryRead('/sys/fs/cgroup/memory.max')),
      memUsed: Number.isFinite(current) ? Math.max(0, current - (stat.inactive_file || 0)) : null,
      cpuUsec: Number.isFinite(cpu.usage_usec) ? cpu.usage_usec : null,
    }
  }
  const v1Usage = tryRead('/sys/fs/cgroup/memory/memory.usage_in_bytes')
  if (v1Usage != null) {
    const stat = parseKeyValues(tryRead('/sys/fs/cgroup/memory/memory.stat'))
    const usage = Number(v1Usage.trim())
    const acct = Number(String(tryRead('/sys/fs/cgroup/cpuacct/cpuacct.usage') || '').trim())
    return {
      version: 1,
      cpuLimit: parseCfsQuota(tryRead('/sys/fs/cgroup/cpu/cpu.cfs_quota_us'), tryRead('/sys/fs/cgroup/cpu/cpu.cfs_period_us')),
      memLimit: parseMemLimit(tryRead('/sys/fs/cgroup/memory/memory.limit_in_bytes')),
      memUsed: Number.isFinite(usage) ? Math.max(0, usage - (stat.total_inactive_file || 0)) : null,
      // cpuacct.usage is in nanoseconds.
      cpuUsec: Number.isFinite(acct) && acct > 0 ? acct / 1000 : null,
    }
  }
  return null
}

/** Summed CPU times over every core the OS reports. */
export function cpuTimes(cpus = os.cpus()) {
  let idle = 0
  let total = 0
  for (const c of cpus) {
    const t = c.times
    idle += t.idle
    total += t.user + t.nice + t.sys + t.idle + t.irq
  }
  return { idle, total }
}

/** Busy share between two `cpuTimes` readings, 0–100, or null with no elapsed time. */
export function hostCpuPercent(a, b) {
  const total = b.total - a.total
  if (!(total > 0)) return null
  return clampPct(((total - (b.idle - a.idle)) / total) * 100)
}

/**
 * CPU time spent over wall time, as a share of the cores available.
 * `cores` is the container's quota when there is one, else what the OS offers.
 */
export function cpuPercent(usedUsec, elapsedUsec, cores) {
  if (!(elapsedUsec > 0) || !(cores > 0) || !(usedUsec >= 0)) return null
  return clampPct((usedUsec / (elapsedUsec * cores)) * 100)
}

function clampPct(n) {
  return Math.round(Math.max(0, Math.min(100, n)) * 10) / 10
}

// ---- the sampler ----

/** Whether this process runs in a container — the same two markers the boot message uses. */
export function inContainer() {
  if (process.env.container) return true
  try {
    return fs.existsSync('/.dockerenv')
  } catch {
    return false
  }
}

/**
 * @param {object} deps
 * @param {string} deps.dataDir                     for the volume's free space
 * @param {{ sample(): Promise<object>, last(): object|null }} [deps.gpu]
 * @param {number} [deps.intervalMs]                5 s: fine enough to see a generation, cheap enough to leave on
 * @param {number} [deps.windowMs]
 * @param {() => boolean} [deps.watched]            someone has the dashboard open
 */
export function createSystemMonitor({
  dataDir,
  gpu = null,
  intervalMs = 5000,
  windowMs = 60 * 60 * 1000,
  watched = () => false,
  now = Date.now,
  read = (p) => fs.readFileSync(p, 'utf8'),
  container = inContainer(),
} = {}) {
  const samples = []
  const loop = monitorEventLoopDelay({ resolution: 20 })
  let timer = null
  let prev = null
  /**
   * A GPU reading costs a process spawn; unwatched, one a minute is plenty —
   * and none at boot, where it would only slow the start (and every test
   * server) for a chart nobody has opened yet.
   */
  let gpuAt = now()
  const GPU_UNWATCHED_MS = 60_000

  const cgroupOf = () => (container && process.platform === 'linux' ? readCgroup(read) : null)

  function coresAvailable(cg) {
    const os_ = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length
    return cg?.cpuLimit ? Math.min(cg.cpuLimit, os_) : os_
  }

  function disk() {
    try {
      const st = fs.statfsSync(dataDir)
      return { free: st.bavail * st.bsize, total: st.blocks * st.bsize }
    } catch {
      return null
    }
  }

  function tick() {
    const t = now()
    const cg = cgroupOf()
    const reading = {
      at: t,
      hr: process.hrtime.bigint(),
      proc: process.cpuUsage(),
      host: cpuTimes(),
      cgUsec: cg?.cpuUsec ?? null,
    }
    const cores = coresAvailable(cg)
    const mem = process.memoryUsage()
    const hostTotal = os.totalmem()
    const sample = {
      t,
      process: { cpu: null, rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
      host: {
        cpu: null,
        memUsed: hostTotal - os.freemem(),
        memTotal: hostTotal,
        // Windows answers [0, 0, 0] — a load of zero is a lie, not a reading.
        load1: process.platform === 'win32' ? null : Math.round(os.loadavg()[0] * 100) / 100,
      },
      container: cg
        ? { cpu: null, memUsed: cg.memUsed, memLimit: cg.memLimit, cpuLimit: cg.cpuLimit }
        : null,
      loop: {
        p99: Math.round((loop.percentile(99) / 1e6) * 10) / 10,
        max: Math.round((loop.max / 1e6) * 10) / 10,
      },
      disk: disk(),
      gpu: null,
    }
    loop.reset()
    if (prev) {
      const elapsedUsec = Number(reading.hr - prev.hr) / 1000
      const procUsec = reading.proc.user - prev.proc.user + (reading.proc.system - prev.proc.system)
      sample.process.cpu = cpuPercent(procUsec, elapsedUsec, cores)
      sample.host.cpu = hostCpuPercent(prev.host, reading.host)
      if (sample.container && reading.cgUsec != null && prev.cgUsec != null) {
        sample.container.cpu = cpuPercent(reading.cgUsec - prev.cgUsec, elapsedUsec, cores)
      }
    }
    prev = reading

    if (gpu) {
      const g = gpu.last()
      if (g?.status === 'ok') {
        sample.gpu = g.devices.map((d) => ({ util: d.util, memUsed: d.memUsed, memTotal: d.memTotal, temp: d.temp }))
      }
      if (watched() || t - gpuAt >= GPU_UNWATCHED_MS) {
        gpuAt = t
        gpu.sample().catch(() => {})
      }
    }

    samples.push(sample)
    const floor = t - windowMs
    while (samples.length && samples[0].t < floor) samples.shift()
    return sample
  }

  return {
    start() {
      if (timer) return
      loop.enable()
      tick()
      timer = setInterval(tick, intervalMs)
      // Never the reason the process stays up: tests, a migration restart and
      // SIGTERM must not wait for the next sample.
      timer.unref?.()
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
      loop.disable()
    },
    /** Exposed for tests; the timer calls it. */
    tick,
    latest: () => samples[samples.length - 1] || null,
    /** The card's last reading, names and status included — it changes, so it rides every tick. */
    gpu: () => gpu?.last() || null,
    history: () => samples.slice(),
    /** What does not change between samples. */
    info() {
      const cg = cgroupOf()
      const cpus = os.cpus()
      return {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        cpuModel: cpus[0]?.model?.trim() || null,
        cpuCount: cpus.length,
        cores: coresAvailable(cg),
        memTotal: os.totalmem(),
        container,
        cgroup: cg ? cg.version : null,
        cpuLimit: cg?.cpuLimit ?? null,
        memLimit: cg?.memLimit ?? null,
        startedAt: Date.now() - Math.round(process.uptime() * 1000),
        hostUptime: Math.round(os.uptime()),
        intervalMs,
        gpu: gpu?.last() || null,
      }
    },
  }
}
