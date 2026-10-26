import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { z } from 'zod'
import { buildMcpServer } from './tools.js'
import { READ_TOOLS, KEY_LEVELS, levelOf, toolAllowed, gateTools, isReadTool } from './levels.js'
import { buildGuide, GUIDED_TOOLS, CLIENT_TOOLS } from './guide.js'

/**
 * X9: a read key reaches a closed list of tools — neither lists nor calls the
 * others — and an OAuth connection (level `write`) keeps everything it had.
 *
 * Through the SDK's own client over an in-memory transport: what is checked is
 * what an assistant would see, not a list kept in this file.
 */

const here = path.dirname(fileURLToPath(import.meta.url))

function fakeDeps(level, { client = true } = {}) {
  const runner = {
    enqueue: vi.fn(() => ({ job: { id: 'j1' }, existing: false })),
    wait: vi.fn(async () => null),
    availability: () => ({ available: false, reason: 'no-chromium' }),
    countToday: () => 0,
    isBusy: () => false,
    readShot: () => null,
    photographCode: vi.fn(),
  }
  const pictures = { stockAvailable: () => false, searchStock: vi.fn(), addFromStock: vi.fn(), addFromFile: vi.fn(), addFromUrl: vi.fn() }
  return {
    deps: {
      user: { id: 'u1', username: 'helper' },
      readProjects: () => JSON.stringify([{ id: 'p1', name: 'Site', screens: [{ id: 's1', name: 'Accueil', code: 'export default () => null' }] }]),
      linkFor: (p, s) => `https://m.example/p/${p}${s ? `?screen=${s}` : ''}`,
      runner,
      maintenance: () => false,
      dailyQuota: () => null,
      engine: () => 'mocky',
      engines: () => ({ mocky: true, client }),
      hasTextProvider: () => true,
      usesOwnText: () => false,
      shotLink: (h) => `https://m.example/mcp-shot/${h}.jpg`,
      viewLink: (h) => `https://m.example/mcp-view/${h}.html`,
      origin: 'https://m.example',
      pictures,
      ...(level === undefined ? {} : { level }),
    },
    runner,
    pictures,
  }
}

async function connect(server) {
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test', version: '1.0.0' })
  await Promise.all([server.connect(a), client.connect(b)])
  return client
}

async function toolsOf(level, opts) {
  const { deps } = fakeDeps(level, opts)
  const client = await connect(buildMcpServer(deps))
  try {
    return (await client.listTools()).tools
  } finally {
    await client.close()
  }
}

describe('the levels', () => {
  it('are two, and anything but exactly "write" is read', () => {
    expect(KEY_LEVELS).toEqual(['read', 'write'])
    for (const v of [undefined, null, '', 'admin', 'WRITE', 'Write', 'read', 1, {}]) expect(levelOf(v), String(v)).toBe('read')
    expect(levelOf('write')).toBe('write')
    expect(toolAllowed('nonsense', 'create_design')).toBe(false)
    expect(toolAllowed('write', 'create_design')).toBe(true)
  })

  it('keep a closed, frozen list of read tools', () => {
    expect([...READ_TOOLS].sort()).toEqual(['audit_design', 'get_design', 'get_project', 'get_screenshot', 'list_projects', 'mocky_guide', 'search_free_images'])
    expect(Object.isFrozen(READ_TOOLS)).toBe(true)
    expect(Object.isFrozen(KEY_LEVELS)).toBe(true)
  })

  it('cannot be widened from outside, by any door', async () => {
    // A Set survives Object.freeze: its `add` still worked, and one call
    // anywhere in the process gave every read key a tool that writes.
    const attempts = [
      () => READ_TOOLS.add('create_design'),
      () => READ_TOOLS.push('create_design'),
      () => READ_TOOLS.splice(0, 0, 'create_design'),
      () => {
        READ_TOOLS[READ_TOOLS.length] = 'create_design'
      },
      () => {
        READ_TOOLS[0] = 'create_design'
      },
    ]
    for (const widen of attempts) {
      try {
        widen()
      } catch {
        /* refused: what is wanted */
      }
    }
    expect([...READ_TOOLS].sort()).toEqual(['audit_design', 'get_design', 'get_project', 'get_screenshot', 'list_projects', 'mocky_guide', 'search_free_images'])
    expect(isReadTool('create_design')).toBe(false)
    expect(toolAllowed('read', 'create_design')).toBe(false)
    expect((await toolsOf('read')).map((t) => t.name)).not.toContain('create_design')
  })
})

describe('a write connection (OAuth, or a write key) keeps everything', () => {
  it('lists every tool, submit_screen included when the client engine is allowed', async () => {
    const names = (await toolsOf('write')).map((t) => t.name).sort()
    expect(names).toEqual([...GUIDED_TOOLS, ...CLIENT_TOOLS].sort())
  })

  it('and the list is exactly the one READ_TOOLS was cut from: readOnlyHint ⇔ READ_TOOLS', async () => {
    // The two cannot drift apart without somebody deciding it here.
    for (const t of await toolsOf('write')) {
      expect(t.annotations?.readOnlyHint === true, t.name).toBe(isReadTool(t.name))
    }
  })

  it('offers the prompts and the same instructions as before the levels', async () => {
    const { deps } = fakeDeps('write')
    const client = await connect(buildMcpServer(deps))
    try {
      expect(client.getServerCapabilities()?.prompts).toBeTruthy()
      expect((await client.listPrompts()).prompts.length).toBeGreaterThan(0)
      const text = client.getInstructions()
      expect(text).toContain('A new design goes in a NEW project (create_design)')
      expect(text).toContain('submit_screen')
      expect(text).not.toMatch(/read-only/i)
    } finally {
      await client.close()
    }
  })
})

describe('a read key (X9)', () => {
  it('lists exactly READ_TOOLS', async () => {
    const names = (await toolsOf('read')).map((t) => t.name).sort()
    expect(names).toEqual([...READ_TOOLS].sort())
  })

  it('is what a missing or unknown level gets', async () => {
    expect((await toolsOf(undefined)).map((t) => t.name).sort()).toEqual([...READ_TOOLS].sort())
    expect((await toolsOf('admin')).map((t) => t.name).sort()).toEqual([...READ_TOOLS].sort())
  })

  it('cannot call a tool that writes: "not found", and nothing is started', async () => {
    const { deps, runner, pictures } = fakeDeps('read')
    const client = await connect(buildMcpServer(deps))
    try {
      const calls = [
        ['create_design', { brief: 'Une page d’accueil pour une boulangerie de quartier à Lyon' }],
        ['add_screen', { project_id: 'p1', brief: 'Une page contact pour la boulangerie' }],
        ['edit_design', { project_id: 'p1', screen_id: 's1', instruction: 'en vert' }],
        ['polish_design', { project_id: 'p1', screen_id: 's1' }],
        ['fix_accessibility', { project_id: 'p1', screen_id: 's1' }],
        ['add_image', { image_url: 'https://example.com/a.jpg' }],
        ['create_campaign', { brief: 'Fête du quartier' }],
        ['create_publication', { brief: 'Un magazine', publication: 'magazine' }],
        ['submit_screen', { job_id: 'j1', code: 'export default () => null' }],
      ]
      // What a tool that does not exist at all answers — the refusal says nothing more.
      const missing = await client.callTool({ name: 'no_such_tool', arguments: {} })
      for (const [name, args] of calls) {
        const out = await client.callTool({ name, arguments: args })
        expect(out.isError, name).toBe(true)
        expect(out.content[0].text, name).toBe(missing.content[0].text.replace('no_such_tool', name))
        expect(out.content[0].text, name).toMatch(new RegExp(`Tool ${name} not found$`))
      }
      expect(runner.enqueue).not.toHaveBeenCalled()
      expect(pictures.addFromUrl).not.toHaveBeenCalled()
    } finally {
      await client.close()
    }
  })

  it('still reads: list_projects answers', async () => {
    const { deps } = fakeDeps('read')
    const client = await connect(buildMcpServer(deps))
    try {
      const out = await client.callTool({ name: 'list_projects', arguments: {} })
      expect(out.isError).toBeFalsy()
      expect(out.content[0].text).toContain('Site')
    } finally {
      await client.close()
    }
  })

  const writers = [...GUIDED_TOOLS, ...CLIENT_TOOLS].filter((n) => !isReadTool(n))
  const namesWriter = (s) => writers.filter((n) => new RegExp(`\\b${n}\\b`).test(s))

  it('describes its tools without naming one it does not have', async () => {
    // audit_design → fix_accessibility, search_free_images → add_image,
    // get_design → create_design: each a call the assistant would try.
    for (const tool of await toolsOf('read')) expect(namesWriter(JSON.stringify(tool)), tool.name).toEqual([])
    // A write connection keeps every pointer.
    const full = Object.fromEntries((await toolsOf('write')).map((t) => [t.name, JSON.stringify(t)]))
    expect(full.audit_design).toContain('fix_accessibility')
    expect(full.search_free_images).toContain('add_image')
    expect(full.get_design).toContain('create_design')
  })

  it('answers without naming one either: an audit, a design awaiting code, a design with no picture', async () => {
    const jobs = {
      audit: {
        id: 'j1',
        status: 'done',
        lang: 'en',
        result: { kind: 'audit', projectId: 'p1', screenId: 's1', audit: { parsed: true, seo: 80, a11y: 70, judged: true, findings: [{ name: 'img-alt', fixable: true }] } },
      },
      awaiting: { id: 'j2', status: 'awaiting_code', lang: 'en', contract: { system: 'RULES', user: 'REQUEST', round: 0 } },
      design: { id: 'j3', status: 'done', lang: 'en', engine: 'client', result: { projectId: 'p1', screenId: 's1', picture: 'none' } },
    }
    const answers = async (level) => {
      const { deps, runner } = fakeDeps(level)
      runner.availability = () => ({ available: true })
      runner.wait = vi.fn(async (id) => Object.values(jobs).find((j) => j.id === id) ?? null)
      runner.enqueue = vi.fn(() => ({ job: { id: 'j1' }, existing: false }))
      const client = await connect(buildMcpServer(deps))
      try {
        return [
          await client.callTool({ name: 'audit_design', arguments: { project_id: 'p1', screen_id: 's1' } }),
          await client.callTool({ name: 'get_design', arguments: { job_id: 'j2' } }),
          await client.callTool({ name: 'get_design', arguments: { job_id: 'j3' } }),
        ].map((out) => out.content.map((c) => c.text || '').join('\n'))
      } finally {
        await client.close()
      }
    }
    const read = await answers('read')
    for (const text of read) expect(namesWriter(text), text).toEqual([])
    expect(read[0]).toContain('accessibility: 70/100')
    expect(read[1]).not.toContain('RULES')
    expect(read[2]).toContain('Picture: none.')
    const write = await answers('write')
    expect(write[0]).toContain('fix_accessibility')
    expect(write[1]).toContain('submit_screen')
    expect(write[2]).toContain('add_image')
    expect(write[2]).toContain('polish_design')
  })

  it('offers no prompt, keeps the two resources, and says it is read-only', async () => {
    const { deps } = fakeDeps('read')
    const client = await connect(buildMcpServer(deps))
    try {
      expect(client.getServerCapabilities()?.prompts).toBeUndefined()
      const uris = (await client.listResources()).resources.map((r) => r.uri).sort()
      expect(uris).toEqual(['mocky://guide', 'ui://mocky/screen-v1.html'])
      expect(client.getInstructions()).toMatch(/READ-ONLY/)
      expect(client.getInstructions()).not.toMatch(/create_design|submit_screen|add_image/)
      const guide = await client.callTool({ name: 'mocky_guide', arguments: {} })
      expect(guide.content[0].text).toMatch(/read-only/)
    } finally {
      await client.close()
    }
  })
})

describe('the read-only guide', () => {
  const guide = buildGuide({ readOnly: true, client: true })

  it('explains every read tool and names no other', () => {
    for (const name of READ_TOOLS) expect(guide, name).toContain(`\`${name}\``)
    for (const name of [...GUIDED_TOOLS, ...CLIENT_TOOLS].filter((n) => !isReadTool(n))) expect(guide, name).not.toContain(name)
  })

  it('leaves the full guide as it was', () => {
    expect(buildGuide({ readOnly: false })).toBe(buildGuide())
    expect(buildGuide({ client: true, readOnly: false })).toBe(buildGuide({ client: true }))
  })
})

describe('the gate itself', () => {
  function bare(level) {
    const server = new McpServer({ name: 't', version: '1' })
    gateTools(server, level)
    const cb = async () => ({ content: [{ type: 'text', text: 'ran' }] })
    // A tool added tomorrow, by every door the SDK has.
    server.registerTool('brand_new_tool', { description: 'x' }, cb)
    server.tool('older_style_tool', cb)
    server.experimental.tasks.registerToolTask(
      'task_tool',
      { inputSchema: { x: z.string().optional() } },
      { createTask: async () => ({}), getTask: async () => ({}), getTaskResult: async () => ({}) },
    )
    server.registerTool('list_projects', { description: 'a read tool' }, cb)
    return server
  }

  it('makes a new tool a writer until it is declared: invisible to a read key, by every door', async () => {
    const client = await connect(bare('read'))
    try {
      expect((await client.listTools()).tools.map((t) => t.name)).toEqual(['list_projects'])
      const out = await client.callTool({ name: 'brand_new_tool', arguments: {} })
      expect(out.isError).toBe(true)
    } finally {
      await client.close()
    }
  })

  it('changes nothing at the write level', async () => {
    const client = await connect(bare('write'))
    try {
      expect((await client.listTools()).tools.map((t) => t.name).sort()).toEqual(['brand_new_tool', 'list_projects', 'older_style_tool', 'task_tool'])
    } finally {
      await client.close()
    }
  })

  it('refuses to build a read-only server on an SDK without the funnel', () => {
    expect(() => gateTools({}, 'read')).toThrow(/refusing/)
    expect(gateTools({}, 'write')).toEqual({})
  })

  it('is in place before the first tool, and tools.js has no other door', () => {
    const src = fs.readFileSync(path.join(here, 'tools.js'), 'utf8')
    const body = src.slice(src.indexOf('export function buildMcpServer'))
    expect(body.indexOf('gateTools(server, level)')).toBeGreaterThan(0)
    expect(body.indexOf('gateTools(server, level)')).toBeLessThan(body.indexOf('registerTool('))
    expect(src).not.toMatch(/\bserver\.tool\(|registerToolTask|_createRegisteredTool/)
  })
})
