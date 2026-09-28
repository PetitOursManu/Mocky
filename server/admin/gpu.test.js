import { describe, it, expect } from 'vitest'
import {
  createGpuProbe,
  mergeWindows,
  parseIoreg,
  parseNvidiaSmi,
  parseTypeperf,
  parseWindowsAdapters,
  readSysfsGpus,
} from './gpu.js'

const MIB = 1024 * 1024

describe('parseNvidiaSmi', () => {
  it('reads one device per line, memory in MiB', () => {
    const out = parseNvidiaSmi('0, NVIDIA GeForce RTX 4090, 37, 5120, 24564, 61, 212.40, 450.00\n')
    expect(out).toEqual([
      {
        vendor: 'nvidia',
        name: 'NVIDIA GeForce RTX 4090',
        util: 37,
        memUsed: 5120 * MIB,
        memTotal: 24564 * MIB,
        temp: 61,
        power: 212.4,
        powerLimit: 450,
      },
    ])
  })

  it('keeps a device whose counters are not supported, as nulls', () => {
    const [d] = parseNvidiaSmi('0, Tesla T4, [N/A], 0, 15360, [Not Supported], [N/A], [N/A]')
    expect(d).toMatchObject({ util: null, memUsed: 0, temp: null, power: null })
  })

  it('reads two cards', () => {
    expect(parseNvidiaSmi('0, A, 1, 1, 2, 30, 1, 2\r\n1, B, 99, 1, 2, 80, 1, 2\r\n')).toHaveLength(2)
  })
})

describe('readSysfsGpus', () => {
  const tree = {
    '/sys/class/drm/card0/device/vendor': '0x1a03', // ASPEED — a server's remote console
    '/sys/class/drm/card1/device/vendor': '0x1002',
    '/sys/class/drm/card1/device/gpu_busy_percent': '42\n',
    '/sys/class/drm/card1/device/mem_info_vram_used': String(2 * 1024 * MIB),
    '/sys/class/drm/card1/device/mem_info_vram_total': String(16 * 1024 * MIB),
    '/sys/class/drm/card2/device/vendor': '0x8086',
  }
  const read = (p) => {
    if (!(p in tree)) throw new Error('ENOENT')
    return tree[p]
  }
  const list = () => ['card0', 'card0-VGA-1', 'card1', 'card1-DP-1', 'card2', 'renderD128', 'version']

  it('keeps real GPUs and drops the console chip and the connectors', () => {
    const out = readSysfsGpus({ read, list })
    expect(out.map((d) => d.vendor)).toEqual(['amd', 'intel'])
    expect(out[0]).toMatchObject({ util: 42, memUsed: 2048 * MIB, memTotal: 16384 * MIB })
    // Intel publishes that it exists, not how busy it is.
    expect(out[1].util).toBeNull()
  })

  it('answers nothing when there is no DRM directory', () => {
    expect(
      readSysfsGpus({
        read,
        list: () => {
          throw new Error('ENOENT')
        },
      }),
    ).toEqual([])
  })
})

describe('parseWindowsAdapters', () => {
  it('drops virtual and remote displays, keeps the 64-bit memory size', () => {
    const out = parseWindowsAdapters(
      'Microsoft Basic Display Adapter|\r\nNVIDIA GeForce RTX 3060|12884901888\r\nParsec Virtual Display Adapter|\r\nAMD Radeon(TM) Graphics|\r\n',
    )
    expect(out.map((d) => [d.vendor, d.name, d.memTotal])).toEqual([
      ['nvidia', 'NVIDIA GeForce RTX 3060', 12884901888],
      ['amd', 'AMD Radeon(TM) Graphics', null],
    ])
  })
})

describe('parseTypeperf + mergeWindows', () => {
  // Shaped on a real capture: a Radeon decoding video with an idle 3D engine,
  // beside the one-engine Basic Render Driver LUID.
  const col = (inst, counter) => `\\\\PC\\${inst}\\${counter}`
  const csv = [
    '',
    [
      '(PDH-CSV 4.0)',
      col('GPU Engine(pid_1_luid_0x00000000_0x0001642C_phys_0_eng_0_engtype_3D)', 'Utilization Percentage'),
      col('GPU Engine(pid_2_luid_0x00000000_0x000141C7_phys_0_eng_0_engtype_3D)', 'Utilization Percentage'),
      col('GPU Engine(pid_3_luid_0x00000000_0x000141C7_phys_0_eng_0_engtype_3D)', 'Utilization Percentage'),
      col('GPU Engine(pid_2_luid_0x00000000_0x000141C7_phys_0_eng_5_engtype_VideoDecode)', 'Utilization Percentage'),
      col('GPU Adapter Memory(luid_0x00000000_0x000141C7_phys_0)', 'Dedicated Usage'),
      col('GPU Adapter Memory(luid_0x00000000_0x0001642C_phys_0)', 'Dedicated Usage'),
    ]
      .map((c) => `"${c}"`)
      .join(','),
    ['09/28/2026 13:16:09.544', '0.004', '2.5', '1.1', '57.3', '4015906816', '0'].map((c) => `"${c}"`).join(','),
  ].join('\r\n')

  it('sums per engine across processes and takes the busiest engine', () => {
    const real = parseTypeperf(csv).find((l) => l.luid.includes('141c7'))
    expect(real).toMatchObject({ engines: 2, util: 57.3, memUsed: 4015906816 })
  })

  it('gives the real card the real LUID, not the Basic Render Driver', () => {
    const [d] = mergeWindows(parseWindowsAdapters('AMD Radeon RX 6800 XT|17163091968'), parseTypeperf(csv))
    expect(d).toMatchObject({ name: 'AMD Radeon RX 6800 XT', util: 57.3, memUsed: 4015906816, memTotal: 17163091968 })
  })
})

describe('parseIoreg', () => {
  it('reads the utilisation Apple GPUs publish', () => {
    const out = parseIoreg(
      '+-o AGXAcceleratorG14X  <class AGXAcceleratorG14X>\n    {\n      "model" = "Apple M2 Pro"\n      "PerformanceStatistics" = {"In use system memory"=734003200,"Device Utilization %"=12,"Renderer Utilization %"=11}\n    }\n',
    )
    expect(out).toEqual([
      expect.objectContaining({ vendor: 'apple', name: 'Apple M2 Pro', util: 12, memUsed: 734003200 }),
    ])
  })
})

describe('createGpuProbe', () => {
  const enoent = () => Object.assign(new Error('spawn nvidia-smi ENOENT'), { code: 'ENOENT' })
  const noDrm = () => {
    throw new Error('ENOENT')
  }

  it('prefers nvidia-smi', async () => {
    const probe = createGpuProbe({
      platform: 'linux',
      run: async () => '0, RTX, 5, 100, 200, 40, 10, 20',
      list: noDrm,
    })
    expect(await probe.sample()).toMatchObject({ status: 'ok', source: 'nvidia-smi' })
  })

  it('reports absent on a machine with nothing, and does not spawn every sample', async () => {
    let t = 0
    let spawns = 0
    const probe = createGpuProbe({
      platform: 'linux',
      now: () => t,
      run: async () => {
        spawns++
        throw enoent()
      },
      list: noDrm,
    })
    expect(await probe.sample()).toMatchObject({ status: 'absent', devices: [] })
    t += 5000
    await probe.sample()
    expect(spawns).toBe(1)
  })

  // A card that is there but silent is not "no GPU": saying so would send the
  // administrator looking for a missing card instead of a missing tool.
  it('says an NVIDIA card without nvidia-smi is unmeasurable, and why', async () => {
    const probe = createGpuProbe({
      platform: 'linux',
      run: async () => {
        throw enoent()
      },
      read: (p) => {
        if (p.endsWith('card0/device/vendor')) return '0x10de'
        throw new Error('ENOENT')
      },
      list: () => ['card0'],
    })
    expect(await probe.sample()).toMatchObject({ status: 'unmeasurable', hint: 'nvidia-smi-missing' })
  })

  it('reads a Windows card through the registry and typeperf', async () => {
    const probe = createGpuProbe({
      platform: 'win32',
      run: async (cmd) => {
        if (cmd === 'nvidia-smi') throw enoent()
        if (cmd === 'powershell.exe') return 'AMD Radeon RX 6800 XT|17163091968\r\n'
        return [
          '"(PDH-CSV 4.0)","\\\\PC\\GPU Engine(pid_2_luid_0x0_0x1_phys_0_eng_0_engtype_3D)\\Utilization Percentage","\\\\PC\\GPU Engine(pid_2_luid_0x0_0x1_phys_0_eng_1_engtype_Copy)\\Utilization Percentage"',
          '"t","12","3"',
        ].join('\r\n')
      },
    })
    expect(await probe.sample()).toMatchObject({ status: 'ok', source: 'typeperf', devices: [{ util: 12 }] })
  })

  it('never throws, whatever the tools do', async () => {
    const probe = createGpuProbe({
      platform: 'win32',
      run: async () => {
        throw new Error('boom')
      },
    })
    expect((await probe.sample()).status).toBe('absent')
  })
})
