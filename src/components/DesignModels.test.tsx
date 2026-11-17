import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DesignModelsTab } from './DesignModels'
import { partsFr } from '../i18n/parts'
import type { TemplateSummary } from '../lib/templates'

const tpl = (id: string, over: Partial<TemplateSummary> = {}): TemplateSummary => ({
  id,
  name: `Modèle ${id}`,
  createdAt: 1,
  updatedAt: 7,
  settings: {},
  screenCount: 2,
  screenNames: ['Post', 'Story'],
  thumbs: [],
  ...over,
})

describe('DesignModelsTab', () => {
  it('shows each section under its name with its count, the loose templates apart, and the pictures of the screens', () => {
    const html = renderToStaticMarkup(
      <DesignModelsTab
        templates={[
          tpl('ta', { section: 'Réseaux Elisa30', thumbs: ['s1', 's2'] }),
          tpl('tb', { section: 'Réseaux Elisa30' }),
          tpl('tc'),
        ]}
        onTemplatesChange={() => {}}
        templatesFailed={false}
        directionsVersion={0}
        onDirectionsChanged={() => {}}
        onNewProjectFromTemplate={() => {}}
      />,
    )
    expect(html).toContain('Réseaux Elisa30')
    expect(html).toContain('2 modèle(s) · 4 écran(s)')
    expect(html).toContain(partsFr['templates.section.newProject'])
    expect(html).toContain(partsFr['templates.section.loose'])
    // The reference screen large, then the next one.
    expect(html).toContain('src="/api/templates/ta/thumbs/s1?v=7"')
    expect(html).toContain('src="/api/templates/ta/thumbs/s2?v=7"')
    // Each card can be moved to a section.
    expect(html).toContain('aria-label="Section du modèle « Modèle tc »"')
    expect(html).toMatch(/<option value="Réseaux Elisa30" selected="">/)
  })
})
