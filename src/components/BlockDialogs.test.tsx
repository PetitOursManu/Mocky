import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BlockLibraryDialog, BlockSaveDialog } from './BlockDialogs'
import { partsFr } from '../i18n/parts'
import type { Block } from '../lib/blocks'

const block = (over: Partial<Block> = {}): Block => ({
  id: 'b' + 'a'.repeat(24),
  name: 'Pied de page Elisa30',
  kind: 'footer',
  jsx: '<footer>Tél</footer>',
  decls: [],
  rev: '1.2',
  from: { screen: 'Post carré' },
  createdAt: 1,
  updatedAt: 1,
  ...over,
})

const noop = () => {}

describe('BlockLibraryDialog', () => {
  it('lists each block with its kind, its origin and its copies here', () => {
    const b = block()
    const html = renderToStaticMarkup(
      <BlockLibraryDialog blocks={[b]} failed={false} uses={{ [b.id]: 2 }} after onInsert={noop} onRename={noop} onDelete={noop} onClose={noop} />,
    )
    expect(html).toContain('Pied de page Elisa30')
    expect(html).toContain(partsFr['blocks.kind.footer'])
    expect(html).toContain('depuis « Post carré »')
    expect(html).toContain('2 exemplaire(s) dans ce projet')
    expect(html).toContain(partsFr['blocks.whereAfter'])
    expect(html).toContain(`>${partsFr['blocks.insert']}<`)
  })

  it('says where an empty library comes from, and that it is loading', () => {
    const empty = renderToStaticMarkup(
      <BlockLibraryDialog blocks={[]} failed={false} uses={{}} after={false} onInsert={noop} onRename={noop} onDelete={noop} onClose={noop} />,
    )
    expect(empty).toContain(partsFr['blocks.whereEnd'])
    expect(empty).toContain('Enregistrer comme bloc')
    const loading = renderToStaticMarkup(
      <BlockLibraryDialog blocks={null} failed={false} uses={{}} after={false} onInsert={noop} onRename={noop} onDelete={noop} onClose={noop} />,
    )
    expect(loading).toContain(partsFr['blocks.loading'])
  })
})

describe('BlockSaveDialog', () => {
  it('asks for a name and a kind, prefilled', () => {
    const html = renderToStaticMarkup(
      <BlockSaveDialog initialName="Bandeau partenaires" initialKind="band" saving={false} error={null} onSave={noop} onClose={noop} />,
    )
    expect(html).toContain('value="Bandeau partenaires"')
    expect(html).toMatch(/<option value="band" selected="">/)
  })
})
