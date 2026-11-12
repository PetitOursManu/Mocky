import { describe, it, expect, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { buildMcpServer } from './tools.js'

/*
 * export_screen and list_templates, and create_design's template_id: what an
 * integration (a calendar of posts) needs to make one project per post from a
 * model and take the PNG and the Canva file away.
 */

const POST = {
  id: 's1',
  name: 'Post Semaine du goût',
  prompt: 'Post Instagram pour la Semaine du goût',
  code: 'export default () => null',
  page: 'social-portrait',
  theme: 'instagram',
  w: 1080,
  h: 1350,
  caps: ['icons'],
  previousCode: 'OLD',
  createdAt: 5,
}
const WEB = { id: 's2', name: 'Accueil', prompt: 'Une page d’accueil', code: 'export default () => null', w: 1440, h: 900 }
const TEMPLATE = { id: 't0123456789abcdef01234567', name: 'Cuisine', createdAt: 1, updatedAt: 2, design: '# DESIGN', settings: {}, screens: [{ id: 'x', code: 'SECRET TEMPLATE CODE', name: 'Modèle post' }] }

function setup({ level = 'write' } = {}) {
  const runner = {
    enqueue: vi.fn(() => ({ job: { id: 'j1' }, existing: false })),
    wait: vi.fn(async () => null),
    availability: () => ({ available: true }),
    countToday: () => 0,
    isBusy: () => false,
    readShot: () => null,
    photographCode: vi.fn(),
    exportCode: vi.fn(async () => 'a'.repeat(64)),
    readExport: vi.fn(() => ({ bytes: Buffer.alloc(2048), filename: 'Post Semaine du goût - Canva.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx', pages: 1, notices: [] })),
  }
  const templates = { list: vi.fn(() => [{ id: TEMPLATE.id, name: 'Cuisine', screenCount: 1, screenNames: ['Modèle post'], design: '# DESIGN', updatedAt: 2 }]), get: vi.fn((id) => (id === TEMPLATE.id ? TEMPLATE : null)) }
  const deps = {
    user: { id: 'u1', username: 'calendy' },
    readProjects: () => JSON.stringify([{ id: 'p1', name: 'Posts', screens: [POST, WEB] }]),
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
    exportLink: (h, ext) => `https://m.example/mcp-export/${h}.${ext}?e=1&s=x`,
    templates,
    origin: 'https://m.example',
    pictures: { owns: () => true },
    level,
  }
  return { deps, runner, templates }
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

describe('export_screen', () => {
  it('hands the exporter the screen and nothing private, and answers a download link', async () => {
    const { deps, runner } = setup({ level: 'read' })
    const out = await call(deps, 'export_screen', { project_id: 'p1', screen_id: 's1', format: 'pptx-edit' })
    expect(out.isError).toBeFalsy()
    const spec = runner.exportCode.mock.calls[0][0]
    expect(spec.kind).toBe('pptx-edit')
    expect(spec.screen).toMatchObject({ code: POST.code, page: 'social-portrait', w: 1080, h: 1350, name: POST.name })
    // A whitelist: what the exporter reads, nothing about the screen's history or its private notes (I9).
    expect(Object.keys(spec.screen).sort()).toEqual(['caps', 'code', 'h', 'id', 'name', 'page', 'prompt', 'theme', 'w'])
    expect(out.structuredContent).toMatchObject({ projectId: 'p1', screenId: 's1', format: 'pptx-edit', filename: 'Post Semaine du goût - Canva.pptx', download: `https://m.example/mcp-export/${'a'.repeat(64)}.pptx?e=1&s=x` })
  })

  it('refuses a PDF of a web screen, and a screen of nobody', async () => {
    const { deps, runner } = setup()
    expect((await call(deps, 'export_screen', { project_id: 'p1', screen_id: 's2', format: 'pdf' })).isError).toBe(true)
    expect((await call(deps, 'export_screen', { project_id: 'p1', screen_id: 'nope', format: 'png' })).isError).toBe(true)
    expect(runner.exportCode).not.toHaveBeenCalled()
  })
})

describe('list_templates', () => {
  it('lists names and counts, never a template’s code or direction', async () => {
    const { deps } = setup({ level: 'read' })
    const out = await call(deps, 'list_templates', {})
    expect(out.structuredContent.templates).toEqual([{ id: TEMPLATE.id, name: 'Cuisine', screens: 1, screenNames: ['Modèle post'], updatedAt: 2 }])
    expect(JSON.stringify(out)).not.toContain('# DESIGN')
  })
})

describe('create_design from a template', () => {
  const brief = 'Post Instagram pour la Semaine du goût, du 12 au 18 octobre, chez Elisa30'

  it('starts the new project from the account’s template, Muse off unless asked', async () => {
    const { deps, runner, templates } = setup()
    await call(deps, 'create_design', { brief, screen_type: 'instagram', template_id: TEMPLATE.id, project_name: 'Post 12 octobre' })
    expect(templates.get).toHaveBeenCalledWith(TEMPLATE.id)
    const request = runner.enqueue.mock.calls[0][1]
    expect(request.template).toBe(TEMPLATE)
    expect(request.projectId).toBeUndefined()
    expect(request.projectName).toBe('Post 12 octobre')
    expect(request.muse).toBe(false)
    // From a template, the template's posts are the layout the new one copies.
    expect(request.followLayout).toBe(true)
    await call(deps, 'create_design', { brief, template_id: TEMPLATE.id, muse: true })
    expect(runner.enqueue.mock.calls[1][1].muse).toBe(true)
  })

  it('refuses a template that is not this account’s, without generating', async () => {
    const { deps, runner } = setup()
    const out = await call(deps, 'create_design', { brief, template_id: 'tffffffffffffffffffffffff' })
    expect(out.isError).toBe(true)
    expect(runner.enqueue).not.toHaveBeenCalled()
  })

  it('takes several templates as EXAMPLES: their documents only, the first direction, no copy, Muse off', async () => {
    const { deps, runner, templates } = setup()
    const autre = { ...TEMPLATE, id: 'tabcdefabcdefabcdefabcdef1', name: 'Portraits', design: undefined, screens: [{ id: 'y', code: 'PORTRAIT', page: 'social-square', theme: 'instagram' }, { id: 'w', code: 'WEB' }] }
    templates.get.mockImplementation((id) => (id === TEMPLATE.id ? { ...TEMPLATE, screens: [{ id: 'x', code: 'SECRET TEMPLATE CODE', page: 'social-portrait' }] } : id === autre.id ? autre : null))
    await call(deps, 'create_design', { brief, inspiration_ids: [TEMPLATE.id, autre.id] })
    const request = runner.enqueue.mock.calls[0][1]
    expect(request.template).toBeUndefined()
    expect(request.followLayout).toBeUndefined()
    expect(request.muse).toBe(false)
    expect(request.inspirations).toEqual([
      { name: 'Cuisine', design: '# DESIGN', screens: [{ code: 'SECRET TEMPLATE CODE', page: 'social-portrait' }] },
      { name: 'Portraits', screens: [{ code: 'PORTRAIT', page: 'social-square', theme: 'instagram' }] },
    ])
  })

  it('refuses examples AND a model, and an example of nobody', async () => {
    const { deps, runner } = setup()
    expect((await call(deps, 'create_design', { brief, template_id: TEMPLATE.id, inspiration_ids: [TEMPLATE.id] })).isError).toBe(true)
    expect((await call(deps, 'create_design', { brief, inspiration_ids: ['tffffffffffffffffffffffff'] })).isError).toBe(true)
    expect(runner.enqueue).not.toHaveBeenCalled()
  })

  it('without a template, a new project still gets Muse by default', async () => {
    const { deps, runner } = setup()
    await call(deps, 'create_design', { brief })
    expect(runner.enqueue.mock.calls[0][1].template).toBeUndefined()
    expect(runner.enqueue.mock.calls[0][1].muse).toBe(true)
    expect(runner.enqueue.mock.calls[0][1].followLayout).toBeUndefined()
  })

  it('follow_layout: off when asked on a template, on when asked in an existing project', async () => {
    const { deps, runner } = setup()
    await call(deps, 'create_design', { brief, template_id: TEMPLATE.id, follow_layout: false })
    expect(runner.enqueue.mock.calls[0][1].followLayout).toBeUndefined()
    await call(deps, 'add_screen', { brief, project_id: 'p1', follow_layout: true })
    expect(runner.enqueue.mock.calls[1][1].followLayout).toBe(true)
    expect(runner.enqueue.mock.calls[1][1].projectId).toBe('p1')
  })
})
