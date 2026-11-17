import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ResponsiveCompare from './ResponsiveCompare'
import { partsFr } from '../i18n/parts'
import type { Screen } from '../lib/project'

const screen = {
  id: 's1',
  name: 'Accueil',
  prompt: '',
  code: 'export default function App() { return <main>Bonjour</main> }',
  componentName: 'App',
  createdAt: 1,
  x: 0,
  y: 0,
  w: 1440,
  h: 900,
  device: 'none',
  links: [],
} as Screen

describe('ResponsiveCompare', () => {
  it('shows the three widths, measuring, and no correction to ask for yet', () => {
    const html = renderToStaticMarkup(
      <ResponsiveCompare screen={screen} busy={false} onCorrect={async () => ({ code: '' })} onApply={() => true} onClose={() => {}} />,
    )
    for (const k of ['responsive.view.mobile', 'responsive.view.tablet', 'responsive.view.desktop'] as const) expect(html).toContain(partsFr[k])
    expect(html).toContain('390 px')
    expect(html).toContain('820 px')
    expect(html).toContain('1440 px')
    expect(html).toContain(partsFr['responsive.measuring'])
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*?Corriger pour les trois tailles/s)
  })
})
