import { describe, it, expect, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { buildMcpServer } from './tools.js'
import { VISUAL_FAMILY_IDS } from './visual-families.js'

/** create_visual and list_visual_families, called through a real MCP client. */

function setup({ level = 'write' } = {}) {
  const runner = {
    enqueue: vi.fn(() => ({ job: { id: 'j1' }, existing: false })),
    wait: vi.fn(async () => null),
    availability: () => ({ available: true }),
    countToday: () => 0,
    isBusy: () => false,
    readShot: () => null,
  }
  const deps = {
    user: { id: 'u1', username: 'demo' },
    readProjects: () => '[]',
    linkFor: (p, s) => `https://m.example/p/${p}${s ? `?screen=${s}` : ''}`,
    runner,
    maintenance: () => false,
    dailyQuota: () => null,
    engine: () => 'mocky',
    engines: () => ({ mocky: true, client: false }),
    hasTextProvider: () => true,
    usesOwnText: () => false,
    shotLink: (h) => `https://m.example/mcp-shot/${h}.jpg`,
    viewLink: (h) => `https://m.example/mcp-view/${h}.html`,
    origin: 'https://m.example',
    pictures: { owns: () => true },
    level,
  }
  return { deps, runner }
}

async function call(deps, name, args) {
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test', version: '1.0.0' })
  const server = buildMcpServer(deps)
  await Promise.all([server.connect(a), client.connect(b)])
  try {
    return await client.callTool({ name, arguments: args })
  } finally {
    await client.close()
  }
}

const TEXT = 'Bilan de l’année : 240 élèves accompagnés, 38 bénévoles et 92 % de réussite au brevet.'

describe('create_visual', () => {
  it('queues a Visual screen of the text, in a new project, with no questions, no Muse and no pictures', async () => {
    const { deps, runner } = setup()
    await call(deps, 'create_visual', { text: TEXT, page_format: 'social-square', project_name: 'Bilan' })
    expect(runner.enqueue).toHaveBeenCalledTimes(1)
    const job = runner.enqueue.mock.calls[0][1]
    expect(job.screenType).toBe('visual')
    expect(job.pageFormat).toBe('social-square')
    expect(job.muse).toBe(false)
    expect(job.pictureSource).toBe('none')
    expect(job.projectId).toBeUndefined()
    expect(job.projectName).toBe('Bilan')
    expect(job.brief).toContain('240 élèves accompagnés')
  })

  it('starts on a slide, and passes the family the person asked for', async () => {
    const { deps, runner } = setup()
    await call(deps, 'create_visual', { text: TEXT, family: 'bars' })
    const job = runner.enqueue.mock.calls[0][1]
    expect(job.pageFormat).toBe('slides')
    expect(job.brief).toContain('"bars" family')
  })

  it('refuses an unknown family before anything is queued', async () => {
    const { deps, runner } = setup()
    const out = await call(deps, 'create_visual', { text: TEXT, family: 'pie' })
    expect(out.isError).toBe(true)
    expect(runner.enqueue).not.toHaveBeenCalled()
  })
})

describe('list_visual_families', () => {
  it('lists every family with its use, on a read key too', async () => {
    const { deps } = setup({ level: 'read' })
    const out = await call(deps, 'list_visual_families', {})
    expect(out.structuredContent.families.map((f) => f.id)).toEqual(VISUAL_FAMILY_IDS)
    expect(out.structuredContent.formats).toContain('slides')
  })

  it('is the only visual tool a read key has', async () => {
    const { deps, runner } = setup({ level: 'read' })
    const out = await call(deps, 'create_visual', { text: TEXT })
    expect(out.isError).toBe(true)
    expect(runner.enqueue).not.toHaveBeenCalled()
  })
})
