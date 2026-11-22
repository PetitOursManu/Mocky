import { describe, it, expect } from 'vitest'
import {
  cleanRules,
  deleteScreen,
  duplicateScreen,
  globalDesignOf,
  productNameOf,
  projectEditingTemplate,
  renameProject,
  renameScreen,
  setProjectDirection,
  templateContentFromProject,
} from './project-edits.js'
import { cleanRules as browserCleanRules } from '../../src/lib/rules.ts'
import { extractProductName } from '../../src/lib/design.ts'
import { projectFromTemplate, templateFromProject } from '../../src/lib/templates.ts'

const screen = (id, extra = {}) => ({ id, name: `Screen ${id}`, prompt: 'p', code: 'export default () => null', x: 0, y: 0, w: 1440, h: 900, links: [], ...extra })
const project = (extra = {}) => ({ id: 'p1', name: 'Boulangerie', createdAt: 1, updatedAt: 2, screens: [screen('a'), screen('b', { x: 1840 })], ...extra })

describe('what an assistant changes in a project without a model', () => {
  it('renames the project, and refuses an empty name', () => {
    expect(renameProject(project(), '  Le   Fournil ', 9)).toMatchObject({ name: 'Le Fournil', updatedAt: 9 })
    expect(renameProject(project(), '   ')).toBeNull()
  })

  it('sets the project’s own direction and rules, or hands it back to the account’s', () => {
    const md = '# Design\n\n## Product\nLe Fournil\n\n## Colours\n- Accent: #c2410c'
    const set = setProjectDirection(project(), { design: md, rules: 'Aucun visage\n\n  fond   sobre ' }, 9)
    expect(set).toMatchObject({ design: md, productName: 'Le Fournil', rules: 'Aucun visage\nfond sobre', updatedAt: 9 })
    const back = setProjectDirection({ ...set, designSync: { hash: 'x' } }, { design: '', rules: '' })
    expect(back).not.toHaveProperty('design')
    expect(back).not.toHaveProperty('productName')
    expect(back).not.toHaveProperty('designSync')
    expect(back).not.toHaveProperty('rules')
    // A field not passed is not touched.
    expect(setProjectDirection(set, { rules: 'Une règle' }).design).toBe(md)
    expect(setProjectDirection(project(), { design: 'x'.repeat(200 * 1024) })).toBeNull()
  })

  it('renames a screen of the project only', () => {
    expect(renameScreen(project(), 'b', 'Contact').screens[1].name).toBe('Contact')
    expect(renameScreen(project(), 'zz', 'Contact')).toBeNull()
  })

  it('copies a screen beside everything, without links or notes', () => {
    const p = project({ screens: [screen('a', { links: [{ id: 'l', target: 'b' }], userNotes: [{ text: 'privé' }] }), screen('b', { x: 1840 })] })
    const { project: next, screen: copy } = duplicateScreen(p, 'a', { id: 'c', now: 9 })
    expect(next.screens.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    expect(copy).toMatchObject({ id: 'c', code: p.screens[0].code, links: [], x: 1840 + 1440 + 400, y: 0, createdAt: 9 })
    expect(copy).not.toHaveProperty('userNotes')
    expect(copy.name).toBe('Screen a (copy)')
    expect(duplicateScreen(p, 'zz')).toBeNull()
  })

  it('deletes a screen as the canvas does: tombstone, no reference, no link to it', () => {
    const p = project({ referenceScreenId: 'b', screens: [screen('a', { links: [{ id: 'l', target: 'b' }, { id: 'm', target: 'a' }] }), screen('b')] })
    const next = deleteScreen(p, 'b', 9)
    expect(next.screens.map((s) => s.id)).toEqual(['a'])
    expect(next.screens[0].links).toEqual([{ id: 'm', target: 'a' }])
    expect(next.removedScreens).toEqual({ b: 9 })
    expect(next).not.toHaveProperty('referenceScreenId')
    expect(deleteScreen(p, 'zz')).toBeNull()
  })

  it('reads the account’s DESIGN.md only when it is switched on', () => {
    expect(globalDesignOf(JSON.stringify({ enabled: true, markdown: '# G' }))).toBe('# G')
    expect(globalDesignOf(JSON.stringify({ enabled: false, markdown: '# G' }))).toBeUndefined()
    expect(globalDesignOf('garbage')).toBeUndefined()
    expect(globalDesignOf(null)).toBeUndefined()
  })
})

describe('the mirrors of the browser’s code', () => {
  it('clean rules like lib/rules.ts', () => {
    for (const v of ['', '  a  \n\n b\tc ', 'x\n'.repeat(40), 'y'.repeat(2000), 3, undefined]) expect(cleanRules(v)).toEqual(browserCleanRules(v))
  })

  it('read a product name like lib/design.ts', () => {
    for (const md of ['', '## Product\nSoftly', '## Product\n\n- **Softly** — a sofa\n## Next', '## Product\nNot established', '# x', '## Product\n## Colours']) {
      expect(productNameOf(md)).toEqual(extractProductName(md))
    }
  })

  it('open a template as lib/templates.ts does, plus the link back to it', () => {
    let n = 0
    const idOf = () => `id${n++}`
    const tpl = {
      id: 't1',
      name: 'Kit',
      createdAt: 1,
      updatedAt: 1,
      design: '## Product\nKit',
      referenceScreenId: 'a',
      settings: { useBrand: true, brandId: 'b2', creative: true, rules: 'Une règle', ultra: { count: 6, video: true } },
      screens: [screen('a', { links: [{ id: 'l', target: 'b' }, { id: 'x', target: 'gone' }] }), screen('b')],
    }
    const server = projectEditingTemplate(tpl, { idOf, now: 5 })
    n = 0
    const browser = projectFromTemplate(tpl, { idOf, now: 5, editing: true })
    expect(server.templateId).toBe('t1')
    expect(browser.templateId).toBe('t1')
    // The browser normalizes the screens (a server-made project is normalized on arrival).
    const shape = (p) => ({ ...p, screens: p.screens.map((s) => ({ id: s.id, links: s.links, code: s.code })) })
    expect(shape(server)).toEqual(shape(browser))
  })

  it('write a project back as lib/templates.ts does, name aside', () => {
    const p = project({ design: '# Own', referenceScreenId: 'b', useBrand: true, brandId: 'b2', rules: 'R', ultra: { count: 3 }, templateId: 't1', screens: [screen('a', { userNotes: [{ text: 'n' }], quality: {} }), screen('b')] })
    // eslint-disable-next-line no-unused-vars
    const { name: _n, ...browser } = templateFromProject(p, 'x')
    expect(templateContentFromProject(p)).toEqual(browser)
    const follows = { ...p, design: undefined }
    // eslint-disable-next-line no-unused-vars
    const { name: _m, ...browserGlobal } = templateFromProject(follows, 'x', '# Global')
    expect(templateContentFromProject(follows, '# Global')).toEqual(browserGlobal)
  })
})
