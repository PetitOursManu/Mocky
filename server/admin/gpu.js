// The graphics card of the machine Mocky runs on — when there is one.
//
// Mocky itself draws nothing on a GPU: generation runs in the browser, models
// answer from a provider, the render worker is software Chromium. The card is
// reported because an instance often shares its machine with something that
// DOES use it — a local Stable Diffusion WebUI or ComfyUI behind the image
// provider, a local LLM behind the text one — and "why is everything slow"
// is then answered on this screen or nowhere.
//
// "Is there a GPU" has no portable answer, so this asks, in order, the sources
// that exist without installing anything:
//
//   1. `nvidia-smi` — every NVIDIA driver ships it, on Linux and on Windows,
//      and inside a container the NVIDIA Container Toolkit injects it.
//   2. Linux sysfs — the amdgpu driver publishes `gpu_busy_percent` and VRAM
//      counters as plain files; NVIDIA and Intel only publish that they EXIST.
//   3. macOS `ioreg` — Apple GPUs report "Device Utilization %" without sudo.
//   4. Windows — the display-adapter class in the registry says which cards
//      exist and how much memory each has (CIM's AdapterRAM is 32-bit and says
//      4 GB for anything larger); the "GPU Engine" performance counters, read by
//      `typeperf`, say how busy they are. That read takes about three seconds of
//      wall time (it samples twice, a second apart) and next to no CPU, so it
//      runs asynchronously and only while somebody is watching.
//
// A card that is present but cannot be measured is reported as exactly that,
// not as absent: "no GPU" on a machine with one would send the administrator
// looking for a problem in the wrong place.

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const MIB = 1024 * 1024

/** A number, or null for "[N/A]", "[Not Supported]" and friends. */
function num(v) {
  const s = String(v ?? '').trim()
  // Number('') is 0: a counter that is not there would read as an idle card.
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export const NVIDIA_QUERY = [
  '--query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,power.limit',
  '--format=csv,noheader,nounits',
]

/** One device per line of `nvidia-smi ${NVIDIA_QUERY}`. Memory arrives in MiB. */
export function parseNvidiaSmi(stdout) {
  const out = []
  for (const line of String(stdout || '').split(/\r?\n/)) {
    if (!line.trim()) continue
    const f = line.split(',').map((x) => x.trim())
    if (f.length < 5) continue
    const memUsed = num(f[3])
    const memTotal = num(f[4])
    out.push({
      vendor: 'nvidia',
      name: f[1] || 'NVIDIA GPU',
      util: num(f[2]),
      memUsed: memUsed == null ? null : memUsed * MIB,
      memTotal: memTotal == null ? null : memTotal * MIB,
      temp: num(f[5]),
      power: num(f[6]),
      powerLimit: num(f[7]),
    })
  }
  return out
}

/**
 * PCI vendors that are a GPU somebody could be using. Everything else found
 * under /sys/class/drm is a display adapter nobody computes on — the ASPEED and
 * Matrox chips of a server's remote console, virtio/QXL/bochs/VMware/Hyper-V in
 * a VM — and counting those would report a GPU on every rack server there is.
 */
const GPU_VENDORS = { '0x10de': 'nvidia', '0x1002': 'amd', '0x8086': 'intel' }

/**
 * Cards under a sysfs DRM root. `read(path)` returns the file's text or throws;
 * `list(dir)` returns entry names or throws.
 */
export function readSysfsGpus({ read, list, root = '/sys/class/drm' }) {
  let names
  try {
    names = list(root)
  } catch {
    return []
  }
  const out = []
  // card0, card1… — not the connectors (card0-HDMI-A-1), not renderD128.
  for (const card of names.filter((n) => /^card\d+$/.test(n)).sort()) {
    const dev = path.posix.join(root, card, 'device')
    const tryRead = (f) => {
      try {
        return String(read(path.posix.join(dev, f))).trim()
      } catch {
        return null
      }
    }
    const vendor = GPU_VENDORS[(tryRead('vendor') || '').toLowerCase()]
    if (!vendor) continue
    const busy = num(tryRead('gpu_busy_percent'))
    const used = num(tryRead('mem_info_vram_used'))
    const total = num(tryRead('mem_info_vram_total'))
    const product = tryRead('product_name')
    out.push({
      vendor,
      name: product || { nvidia: 'NVIDIA GPU', amd: 'AMD GPU', intel: 'Intel GPU' }[vendor],
      util: busy,
      memUsed: used,
      memTotal: total,
      temp: null,
      power: null,
      powerLimit: null,
    })
  }
  return out
}

/** Names that are a virtual or remote display, never a card anyone computes on. */
const VIRTUAL_ADAPTER =
  /basic display|remote display|hyper-v|vmware|virtualbox|parsec|virtual display|citrix|indirect display|spacedesk|displaylink|qxl|virtio|red hat/i

/**
 * One adapter per line of `WINDOWS_ADAPTERS`: `DriverDesc|qwMemorySize`, the
 * size being absent on drivers that do not write it.
 */
export function parseWindowsAdapters(stdout) {
  return String(stdout || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, mem] = l.split('|')
      return { name: (name || '').trim(), mem: num(mem) }
    })
    .filter((a) => a.name && !VIRTUAL_ADAPTER.test(a.name))
    .map(({ name, mem }) => ({
      vendor: /nvidia/i.test(name) ? 'nvidia' : /amd|radeon/i.test(name) ? 'amd' : /intel/i.test(name) ? 'intel' : 'other',
      name,
      util: null,
      memUsed: null,
      memTotal: mem && mem > 0 ? mem : null,
      temp: null,
      power: null,
      powerLimit: null,
    }))
}

/** The display-adapter device class, where every GPU driver registers itself. */
export const WINDOWS_ADAPTERS = [
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  "Get-ItemProperty -Path 'HKLM:\\SYSTEM\\ControlSet001\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0*' -ErrorAction SilentlyContinue | ForEach-Object { \"$($_.DriverDesc)|$($_.'HardwareInformation.qwMemorySize')\" }",
]

/** English counter names: PDH accepts them on a localised Windows too. */
export const WINDOWS_COUNTERS = [
  '\\GPU Engine(*)\\Utilization Percentage',
  '\\GPU Adapter Memory(*)\\Dedicated Usage',
  '-sc',
  '1',
]

/**
 * `typeperf` CSV → one entry per adapter LUID.
 *
 * Utilisation is what Task Manager calls "GPU": per engine type, the sum over
 * every process using it, then the busiest engine type. A card decoding video
 * at 60 % with an idle 3D engine is 60 % busy — the same figure the owner sees
 * in Task Manager, which is the one they will compare this against.
 */
export function parseTypeperf(stdout) {
  const rows = String(stdout || '')
    .split(/\r?\n/)
    .filter((l) => l.startsWith('"'))
  if (rows.length < 2) return []
  const cells = (l) => l.replace(/^"|"$/g, '').split('","')
  const head = cells(rows[0])
  const vals = cells(rows[rows.length - 1])
  const luids = new Map()
  const of = (k) => {
    let e = luids.get(k)
    if (!e) luids.set(k, (e = { luid: k, engines: {}, memUsed: null }))
    return e
  }
  head.forEach((col, i) => {
    const id = /luid_(0x[0-9a-f]+_0x[0-9a-f]+)_phys_(\d+)/i.exec(col)
    if (!id) return
    const e = of(`${id[1]}_${id[2]}`.toLowerCase())
    const v = Number(String(vals[i] ?? '').trim()) || 0
    const eng = /engtype_([^)]*)\)/.exec(col)
    if (eng) e.engines[eng[1]] = (e.engines[eng[1]] || 0) + v
    else if (/dedicated usage/i.test(col)) e.memUsed = v
  })
  return [...luids.values()].map((e) => {
    const loads = Object.values(e.engines)
    return {
      luid: e.luid,
      engines: loads.length,
      util: loads.length ? Math.min(100, Math.round(Math.max(...loads) * 10) / 10) : null,
      memUsed: e.memUsed,
    }
  })
}

/**
 * Put the counters on the adapters. The counters know LUIDs, the registry knows
 * names, and Windows offers no cheap join between the two — so the real cards
 * are matched to the LUIDs that look like real cards (dedicated memory in use,
 * most engines), in order. Exact for the common single-card machine; on a
 * laptop with two, the figures are right and the pairing is a best guess.
 * A LUID with one engine and no memory is the Basic Render Driver.
 */
export function mergeWindows(adapters, luids) {
  const real = luids
    .filter((l) => l.engines > 1 || (l.memUsed ?? 0) > 0)
    .sort((a, b) => b.engines - a.engines || (b.memUsed ?? 0) - (a.memUsed ?? 0))
  return adapters.map((a, i) => (real[i] ? { ...a, util: real[i].util, memUsed: real[i].memUsed } : a))
}

/**
 * Apple GPUs from `ioreg -r -d 1 -c IOAccelerator`. Each accelerator block
 * carries a PerformanceStatistics dictionary with "Device Utilization %", and
 * usually "In use system memory" (unified memory, so no total of its own).
 */
export function parseIoreg(stdout) {
  const text = String(stdout || '')
  const blocks = text.split(/\n(?=\+-o )/)
  const out = []
  for (const b of blocks) {
    const util = /"Device Utilization %"\s*=\s*(\d+)/.exec(b)
    if (!util) continue
    const model = /"model"\s*=\s*"([^"]+)"/.exec(b)
    const inUse = /"In use system memory"\s*=\s*(\d+)/.exec(b)
    out.push({
      vendor: 'apple',
      name: model ? model[1] : 'Apple GPU',
      util: Number(util[1]),
      memUsed: inUse ? Number(inUse[1]) : null,
      memTotal: null,
      temp: null,
      power: null,
      powerLimit: null,
    })
  }
  return out
}

function execText(cmd, args, timeout) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err)
      else resolve(String(stdout))
    })
  })
}

/** How long a "nothing measurable here" answer is trusted before asking again. */
const PRESENCE_TTL_MS = 5 * 60 * 1000

/**
 * @returns {{ sample(): Promise<GpuState>, last(): GpuState|null }}
 *
 * GpuState: { status: 'ok'|'unmeasurable'|'absent', source, devices, hint }
 *  - ok            at least one device has a utilisation figure
 *  - unmeasurable  a card is there, nothing on this machine will say how busy
 *  - absent        no card at all (virtual display adapters do not count)
 */
export function createGpuProbe({
  run = execText,
  read = (p) => fs.readFileSync(p, 'utf8'),
  list = (d) => fs.readdirSync(d),
  platform = process.platform,
  now = Date.now,
} = {}) {
  let last = null
  let lastAt = 0
  /** nvidia-smi is not there; do not spawn a failing process every 5 s. */
  let smiMissingUntil = 0
  let inflight = null
  /** Which cards Windows has, cached: a PowerShell start costs a second. */
  let winAdapters = null
  let winAdaptersAt = 0

  async function windowsAdapters() {
    if (winAdapters && now() - winAdaptersAt < PRESENCE_TTL_MS) return winAdapters
    try {
      winAdapters = parseWindowsAdapters(await run('powershell.exe', WINDOWS_ADAPTERS, 8000))
    } catch {
      winAdapters = []
    }
    winAdaptersAt = now()
    return winAdapters
  }

  async function probe() {
    let smiHint = null
    if (now() >= smiMissingUntil) {
      try {
        const devices = parseNvidiaSmi(await run('nvidia-smi', NVIDIA_QUERY, 4000))
        if (devices.length) return { status: 'ok', source: 'nvidia-smi', devices, hint: null }
      } catch (err) {
        // ENOENT: not installed — remember it. Anything else (driver not
        // loaded, a container without the toolkit's device) is worth saying.
        if (err?.code === 'ENOENT') smiMissingUntil = now() + PRESENCE_TTL_MS
        else smiHint = 'nvidia-smi-failed'
      }
    }

    if (platform === 'linux') {
      const devices = readSysfsGpus({ read, list })
      if (devices.some((d) => d.util != null)) return { status: 'ok', source: 'sysfs', devices, hint: null }
      if (devices.length) {
        const nvidia = devices.some((d) => d.vendor === 'nvidia')
        return {
          status: 'unmeasurable',
          source: 'sysfs',
          devices,
          hint: nvidia ? smiHint || 'nvidia-smi-missing' : 'no-counter',
        }
      }
    }

    if (platform === 'darwin') {
      try {
        const devices = parseIoreg(await run('ioreg', ['-r', '-d', '1', '-c', 'IOAccelerator'], 4000))
        if (devices.length) return { status: 'ok', source: 'ioreg', devices, hint: null }
      } catch {
        /* fall through to absent */
      }
    }

    if (platform === 'win32') {
      const adapters = await windowsAdapters()
      if (adapters.length) {
        try {
          const devices = mergeWindows(adapters, parseTypeperf(await run('typeperf', WINDOWS_COUNTERS, 10_000)))
          if (devices.some((d) => d.util != null)) return { status: 'ok', source: 'typeperf', devices, hint: null }
        } catch {
          /* counters unavailable — the card is still there */
        }
        return { status: 'unmeasurable', source: 'registry', devices: adapters, hint: 'no-counter' }
      }
    }

    return { status: 'absent', source: null, devices: [], hint: smiHint }
  }

  return {
    /**
     * A fresh reading when one is worth taking. A measurable card is read every
     * call; "absent" and "unmeasurable" are cached, because what they cost to
     * establish (a PowerShell start, a directory walk) buys nothing new a few
     * seconds later — a card does not appear between two samples.
     */
    async sample() {
      if (last && last.status !== 'ok' && now() - lastAt < PRESENCE_TTL_MS) return last
      if (!inflight) {
        inflight = probe()
          .catch(() => ({ status: 'absent', source: null, devices: [], hint: null }))
          .then((r) => {
            last = r
            lastAt = now()
            inflight = null
            return r
          })
      }
      return inflight
    },
    last: () => last,
  }
}
