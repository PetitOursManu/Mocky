import { describe, expect, it } from 'vitest'
import type { Project, Screen } from './project'
import {
  instantiateScreens,
  projectFromTemplate,
  templateFromProject,
  type ProjectTemplate,
} from './templates'

const screen = (id: string, extra: Partial<Screen> = {}): Screen => ({
  id,
  name: `Screen ${id}`,
  prompt: 'a page',
  code: `export default function App(){return <img src="/api/images/${'a'.repeat(64)}" />}`,
  componentName: 'App',
  createdAt: 1,
  x: 10,
  y: 20,
  w: 1024,
  h: 720,
  device: 'none',
  links: [],
  ...extra,
})

const project = (extra: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'Client site',
  createdAt: 1,
  updatedAt: 2,
  screens: [
    screen('a', { links: [{ id: 'l1', x: 0, y: 0, w: 1, h: 1, target: 'b' }], userNotes: [{ id: 'n', text: 'mine', at: 1 }] as never, previousCode: 'old', quality: { score: 12, band: 'good', open: [], fixed: [], iterations: 1, judged: false, checkedAt: 1 } }),
    screen('b', { page: 'a4' as never, theme: 'landing' }),
  ],
  referenceScreenId: 'a',
  folderId: 'f1',
  branch: 'experiment',
  useBrand: true,
  creations: true,
  ultra: { count: 6, video: true },
  campaign: { brief: 'x' } as never,
  scenarios: [{ id: 's', name: 'x' }] as never,
  ...extra,
})

const ids = () => {
  let n = 0
  return () => `new${++n}`
}

describe('a template', () => {
  it('carries the direction, the settings and the screens — not the project’s history', () => {
    const t = templateFromProject(project({ design: '# Own direction' }), 'Kit')
    expect(t.name).toBe('Kit')
    expect(t.design).toBe('# Own direction')
    expect(t.settings).toEqual({ useBrand: true, creations: true, ultra: { count: 6, video: true } })
    expect(t.referenceScreenId).toBe('a')
    expect(t).not.toHaveProperty('branch')
    expect(t).not.toHaveProperty('campaign')
    expect(t).not.toHaveProperty('scenarios')
    expect(t).not.toHaveProperty('folderId')
    const [a] = t.screens
    expect(a).not.toHaveProperty('userNotes')
    expect(a).not.toHaveProperty('previousCode')
    expect(a).not.toHaveProperty('quality')
    expect(a.code).toContain('/api/images/')
  })

  it('takes the global DESIGN.md when the project has no direction of its own', () => {
    expect(templateFromProject(project(), 'Kit', '# Global').design).toBe('# Global')
    expect(templateFromProject(project(), 'Kit').design).toBeUndefined()
  })
})

describe('a project from a template', () => {
  const template: ProjectTemplate = {
    ...templateFromProject(project({ design: '# Direction\n\n## Product\n\nSoftly\n' }), 'Kit'),
    id: 't1',
    createdAt: 1,
    updatedAt: 1,
  }

  it('gets fresh ids, and its links and reference follow them', () => {
    const p = projectFromTemplate(template, { idOf: ids(), now: 100 })
    const [a, b] = p.screens
    expect(a.id).not.toBe('a')
    expect(b.id).not.toBe('b')
    expect(a.links[0].target).toBe(b.id)
    expect(a.links[0].id).not.toBe('l1')
    expect(p.referenceScreenId).toBe(a.id)
    expect(new Set([p.id, a.id, b.id]).size).toBe(3)
  })

  it('keeps the screens’ code, kind and place', () => {
    const p = projectFromTemplate(template, { idOf: ids(), now: 100 })
    expect(p.screens[0].code).toBe(template.screens[0].code)
    expect(p.screens[1].page).toBe('a4')
    expect(p.screens[1].theme).toBe('landing')
    expect(p.screens[0]).toMatchObject({ x: 10, y: 20, createdAt: 100 })
  })

  it('carries the direction and the settings, and lands in the folder it is given', () => {
    const p = projectFromTemplate(template, { idOf: ids(), now: 100, folderId: 'f9', folderLabel: 'Clients' })
    expect(p.design).toContain('# Direction')
    expect(p.productName).toBe('Softly')
    expect(p).toMatchObject({ useBrand: true, creations: true, ultra: { count: 6, video: true }, folderId: 'f9', folder: 'Clients', name: 'Kit' })
    expect(p.branch).toBeUndefined()
    expect(projectFromTemplate(template, { idOf: ids() }).folderId).toBeUndefined()
  })

  it('drops a link to a screen the template does not hold', () => {
    const { screens } = instantiateScreens(
      { screens: [{ ...screen('a'), links: [{ id: 'l', x: 0, y: 0, w: 1, h: 1, target: 'elsewhere' }] }] },
      ids(),
    )
    expect(screens[0].links).toEqual([])
  })
})
