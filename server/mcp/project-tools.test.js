import { describe, it, expect, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { buildMcpServer } from './tools.js'

/*
 * The tools that change an EXISTING project or a template without the runner:
 * update_project, rename_screen, duplicate_screen, delete_screen, edit_template
 * and update_template. What they write goes through `writeProject` (the merge of
 * PUT /api/data, server/index.js) and `templates.replace`.
 */

const screen = (id, extra = {}) => ({ id, name: `Écran ${id}`, prompt: 'Une page pour la boulangerie', code: 'export default () => null', x: 0, y: 0, w: 1440, h: 900, links: [], ...extra })
const TEMPLATE = { id: 't0123456789abcdef01234567', name: 'Kit boulangerie', createdAt: 1, updatedAt: 2, design: '# Kit', settings: { creative: true }, screens: [screen('x')] }

function setup({ level = 'write', busy = false, maintenance = false, projects } = {}) {
  let stored = projects ?? [{ id: 'p1', name: 'Boulangerie', createdAt: 1, updatedAt: 2, screens: [screen('a'), screen('b', { x: 1840 })] }]
  const writeProject = vi.fn((p) => {
    stored = [p, ...stored.filter((x) => x.id !== p.id)]
  })
  const templates = {
    list: () => [{ id: TEMPLATE.id, name: TEMPLATE.name, screenCount: 1, screenNames: ['Écran x'] }],
    get: (id) => (id === TEMPLATE.id ? TEMPLATE : null),
    replace: vi.fn((id, content) => (id === TEMPLATE.id ? { id, name: TEMPLATE.name, screenCount: content.screens.length, screenNames: content.screens.map((s) => s.name) } : null)),
  }
  const deps = {
    user: { id: 'u1', username: 'manu' },
    readProjects: () => JSON.stringify(stored),
    readGlobalDesign: () => JSON.stringify({ enabled: true, markdown: '# Global' }),
    writeProject,
    linkFor: (p, s) => `https://m.example/p/${p}${s ? `?screen=${s}` : ''}`,
    runner: { availability: () => ({ available: true }), isBusy: () => busy, countToday: () => 0, readShot: () => null },
    maintenance: () => maintenance,
    dailyQuota: () => null,
    engine: () => 'mocky',
    engines: () => ({ mocky: true, client: false }),
    hasTextProvider: () => true,
    shotLink: (h) => `https://m.example/mcp-shot/${h}.jpg`,
    templates,
    origin: 'https://m.example',
    pictures: { owns: () => true },
    level,
  }
  return { deps, writeProject, templates, stored: () => stored }
}

async function withClient(deps, fn) {
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test', version: '1.0.0' })
  await Promise.all([buildMcpServer(deps).connect(a), client.connect(b)])
  try {
    return await fn(client)
  } finally {
    await client.close()
  }
}
const call = (deps, name, args) => withClient(deps, (c) => c.callTool({ name, arguments: args }))

const NEW_TOOLS = ['update_project', 'rename_screen', 'duplicate_screen', 'delete_screen', 'edit_template', 'update_template']

describe('changing an existing project', () => {
  it('renames it and changes its direction and rules, in one write', async () => {
    const { deps, writeProject } = setup()
    const out = await call(deps, 'update_project', { project_id: 'p1', name: 'Le Fournil', design: '## Product\nLe Fournil', rules: 'Aucun visage' })
    expect(out.isError).toBeFalsy()
    expect(writeProject).toHaveBeenCalledTimes(1)
    expect(writeProject.mock.calls[0][0]).toMatchObject({ id: 'p1', name: 'Le Fournil', design: '## Product\nLe Fournil', productName: 'Le Fournil', rules: 'Aucun visage' })
    expect(out.structuredContent).toMatchObject({ hasOwnDirection: true, rules: 'Aucun visage' })
  })

  it('shows the direction and rules it would change, when asked', async () => {
    const { deps } = setup({ projects: [{ id: 'p1', name: 'B', screens: [], design: '# Own', rules: 'R1' }] })
    const out = await call(deps, 'get_project', { project_id: 'p1', direction: true })
    expect(out.structuredContent).toMatchObject({ direction: '# Own', rules: 'R1' })
    expect(out.content[0].text).toContain('# Own')
    const plain = await call(deps, 'get_project', { project_id: 'p1' })
    expect(plain.structuredContent).not.toHaveProperty('direction')
  })

  it('renames, copies and deletes a screen', async () => {
    const { deps, stored } = setup()
    expect((await call(deps, 'rename_screen', { project_id: 'p1', screen_id: 'a', name: 'Accueil' })).isError).toBeFalsy()
    const dup = await call(deps, 'duplicate_screen', { project_id: 'p1', screen_id: 'a' })
    expect(dup.structuredContent.name).toBe('Accueil (copie)')
    const copyId = dup.structuredContent.screenId
    expect(stored()[0].screens.map((s) => s.id)).toEqual(['a', 'b', copyId])
    const del = await call(deps, 'delete_screen', { project_id: 'p1', screen_id: 'b' })
    expect(del.isError).toBeFalsy()
    expect(stored()[0].screens.map((s) => s.id)).toEqual(['a', copyId])
    expect(stored()[0].removedScreens).toHaveProperty('b')
  })

  it('refuses what is not this account’s, during maintenance, and while a job runs', async () => {
    expect((await call(setup().deps, 'rename_screen', { project_id: 'nope', screen_id: 'a', name: 'X' })).isError).toBe(true)
    expect((await call(setup().deps, 'delete_screen', { project_id: 'p1', screen_id: 'nope' })).isError).toBe(true)
    const m = setup({ maintenance: true })
    expect((await call(m.deps, 'update_project', { project_id: 'p1', name: 'X' })).isError).toBe(true)
    const b = setup({ busy: true })
    expect((await call(b.deps, 'delete_screen', { project_id: 'p1', screen_id: 'a' })).isError).toBe(true)
    expect(m.writeProject).not.toHaveBeenCalled()
    expect(b.writeProject).not.toHaveBeenCalled()
    expect((await call(setup().deps, 'update_project', { project_id: 'p1' })).isError).toBe(true)
  })
})

describe('changing a template', () => {
  it('opens it as a linked project, then the same project again', async () => {
    const { deps, writeProject, stored } = setup()
    const first = await call(deps, 'edit_template', { template_id: TEMPLATE.id })
    expect(first.isError).toBeFalsy()
    expect(writeProject).toHaveBeenCalledTimes(1)
    const opened = writeProject.mock.calls[0][0]
    expect(opened).toMatchObject({ templateId: TEMPLATE.id, name: 'Kit boulangerie', design: '# Kit', creative: true })
    expect(opened.screens[0].id).not.toBe('x')
    const again = await call(deps, 'edit_template', { template_id: TEMPLATE.id })
    expect(again.structuredContent).toMatchObject({ reused: true, project: { id: opened.id } })
    expect(writeProject).toHaveBeenCalledTimes(1)
    expect(stored().filter((p) => p.templateId)).toHaveLength(1)
  })

  it('writes the project back into it, and refuses a project that edits none', async () => {
    const editing = { id: 'p2', name: 'Kit boulangerie', templateId: TEMPLATE.id, screens: [screen('n1'), screen('n2', { userNotes: [{ text: 'privé' }] })] }
    const { deps, templates } = setup({ projects: [editing, { id: 'p1', name: 'B', screens: [screen('a')] }] })
    const out = await call(deps, 'update_template', { project_id: 'p2' })
    expect(out.isError).toBeFalsy()
    const [id, content] = templates.replace.mock.calls[0]
    expect(id).toBe(TEMPLATE.id)
    // No own direction: the account's DESIGN.md is what the project followed.
    expect(content.design).toBe('# Global')
    expect(content.screens.map((s) => s.id)).toEqual(['n1', 'n2'])
    expect(content.screens[1]).not.toHaveProperty('userNotes')
    expect((await call(deps, 'update_template', { project_id: 'p1' })).isError).toBe(true)
  })
})

describe('a read key', () => {
  it('sees none of them', async () => {
    const { deps } = setup({ level: 'read' })
    const names = await withClient(deps, async (c) => (await c.listTools()).tools.map((t) => t.name))
    for (const n of NEW_TOOLS) expect(names).not.toContain(n)
  })
})
