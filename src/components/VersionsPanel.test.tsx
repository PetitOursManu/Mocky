import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import VersionsPanel from './VersionsPanel'
import type { VersionsApi } from '../lib/useVersions'
import type { VersionSummary } from '../lib/versions'
import { partsEn, partsFr } from '../i18n/parts'

const version = (over: Partial<VersionSummary>): VersionSummary => ({
  id: 'v1',
  projectId: 'p1',
  branch: 'main',
  label: 'Modification',
  kind: 'auto',
  scope: 'screen',
  screenId: 's1',
  createdAt: 1_700_000_000_000,
  projectName: 'Carte',
  designHash: null,
  screens: [{ id: 's1', name: 'Fait moi une carte de visite', codeHash: 'a'.repeat(64) }],
  ...over,
})

const render = (versions: VersionSummary[]) =>
  renderToStaticMarkup(
    <VersionsPanel
      api={{ versions, loading: false, working: false, error: null } as unknown as VersionsApi}
      branch="main"
      busy={false}
      screenName={(id) => (id === 's1' ? 'Fait moi une carte de visite' : null)}
      onCompare={() => {}}
      onClose={() => {}}
    />,
  )

describe('the versions panel', () => {
  it('shows what each change was, not only the screen’s first prompt', () => {
    const html = render([version({ note: 'Rends le fond plus sombre' }), version({ id: 'v2', note: undefined })])
    expect(html).toContain('Rends le fond plus sombre')
    expect(html).toContain('title="Rends le fond plus sombre"')
  })

  it('says where the history stands, and offers each screen’s own history', () => {
    const html = render([version({})])
    expect(html).toContain(`aria-label="${partsFr['versions.crumbs']}"`)
    expect(html).toContain('aria-current="page"')
    expect(html).toContain(partsFr['versions.crumbAll'])
    expect(html).toContain(`title="${partsFr['versions.showScreen']}"`)
  })

  it('names every kind of change in both languages', () => {
    const keys = Object.keys(partsFr).filter((k) => k.startsWith('versions.note.'))
    expect(keys.length).toBeGreaterThanOrEqual(15)
    for (const k of keys) expect(partsEn[k], k).toBeTruthy()
  })
})
