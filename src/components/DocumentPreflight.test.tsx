import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import DocumentPreflight, { PreflightResults } from './DocumentPreflight'
import { getPageFormat } from '../lib/pageFormats'
import { preflightChecks, type PageFacts } from '../lib/docExport/preflight'
import { partsFr } from '../i18n/parts'
import type { Screen } from '../lib/project'

const facts: PageFacts = {
  page: 1,
  pictures: [{ label: 'Assiette', nth: 1, density: 0.07 }],
  external: [],
  nearEdge: ['04 66 05 10 11'],
  edges: ['top'],
  overflow: ['Mentions'],
  clipped: [],
  qrCodes: [],
  qrPlaceholders: 1,
  flattened: 2,
  tilted: 0,
}

describe('DocumentPreflight', () => {
  it('offers the check before anything is measured', () => {
    const screen = { id: 's', name: 'Affiche', code: 'export default () => null', page: 'a3' } as unknown as Screen
    const html = renderToStaticMarkup(<DocumentPreflight screen={screen} disabled={false} onBusy={() => {}} />)
    expect(html).toContain(partsFr['docExport.check.title'])
    expect(html).toContain(`>${partsFr['docExport.check.run']}<`)
  })

  it('words every check, its findings, and offers the fit on an overflow', () => {
    const report = { code: 'x', pages: 1, checks: preflightChecks([facts], getPageFormat('a3'), (n) => `image ${n}`) }
    const html = renderToStaticMarkup(<PreflightResults report={report} stale={false} print onFit={() => {}} />)
    for (const id of ['pictures', 'margins', 'bleed', 'text', 'qr', 'canva']) expect(html).toContain(partsFr[`docExport.check.${id}`])
    expect(html).toContain('Assiette (7 dpi)')
    expect(html).toContain('04 66 05 10 11')
    expect(html).toContain(partsFr['project.docFit'])
    expect(html).toContain(partsFr['docExport.check.target.print'])
    expect(html).not.toMatch(/\{(pages|items|n)\}/)
    expect(html).not.toContain(partsFr['docExport.check.stale'])
  })
})
