import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import IllustratePanel from './IllustratePanel'
import { splitBlocks } from '../lib/visuals/textBlocks'
import { partsFr } from '../i18n/parts'
import type { Project, Screen } from '../lib/project'

const TEXT = `# La méthode

Quand un nouveau client nous contacte, on commence toujours par l'écouter pendant une heure, sans rien proposer.

## Les chiffres

Cette année nous avons livré quarante projets et gardé neuf clients sur dix d'une année sur l'autre, sans publicité.`

describe('the “Illustrate a text” panel', () => {
  const project = { id: 'p', name: 'P', screens: [], createdAt: 0, updatedAt: 0, illustration: { text: TEXT, page: 'slides' } } as unknown as Project
  const [first] = splitBlocks(TEXT)
  const made = { id: 's1', name: 'La méthode', code: '', illustrates: first.digest } as unknown as Screen

  it('lists the blocks, shows a made one as made, and offers the rest', () => {
    const html = renderToStaticMarkup(
      <IllustratePanel project={project} screens={[made]} busy={false} progress={null} onSave={() => {}} onMake={() => {}} onFocus={() => {}} onClose={() => {}} />,
    )
    expect(html).toContain(partsFr['visuals.illustrate.blocks'].replace('{count}', '2'))
    expect(html).toContain(partsFr['visuals.illustrate.show'].replace('{name}', 'La méthode'))
    expect(html).toContain(partsFr['visuals.illustrate.makeAll'].replace('{count}', '1'))
    expect(html).toContain(partsFr['visuals.illustrate.make'])
  })
})
