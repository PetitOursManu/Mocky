import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CampaignPack from './CampaignPack'
import { partsFr } from '../i18n/parts'
import type { Screen } from '../lib/project'
import { codeDigest } from '../lib/publicationPack'

const piece = (id: string, code: string, alt?: { text: string; of: string }) =>
  ({
    id,
    name: `Pièce ${id}`,
    prompt: '',
    code,
    componentName: 'App',
    createdAt: 1,
    x: 0,
    y: 0,
    w: 1080,
    h: 1350,
    device: 'none',
    links: [],
    campaign: { format: 'instagram', facts: {}, ...(alt ? { alt } : {}) },
  }) as Screen & { campaign: NonNullable<Screen['campaign']> }

const noop = async () => {}

describe('CampaignPack', () => {
  it('offers to write the pack when there is none', () => {
    const html = renderToStaticMarkup(
      <CampaignPack campaignName="Portes ouvertes" campaign={{ brief: 'x', facts: [], formats: [] }} pieces={[piece('a', 'x')]} locked={false} onWrite={noop} onCaptions={() => {}} onAlt={() => {}} />,
    )
    expect(html).toContain(partsFr['campaign.pack.write'])
    expect(html).toContain(partsFr['campaign.pack.download'])
  })

  it('shows each caption with its count, a stale fact, and an alternative whose visual moved', () => {
    const html = renderToStaticMarkup(
      <CampaignPack
        campaignName="Portes ouvertes"
        campaign={{
          brief: 'x',
          facts: [{ id: 'f1', label: 'Date', value: '30 novembre' }],
          formats: [],
          pack: { captions: { linkedin: { text: 'Matinée portes ouvertes', hashtags: ['#ESS'] } }, facts: { f1: '23 novembre' } },
        }}
        pieces={[piece('a', 'v2', { text: 'Affiche du 23', of: codeDigest('v1') }), piece('b', 'same', { text: 'Story', of: codeDigest('same') })]}
        locked={false}
        onWrite={noop}
        onCaptions={() => {}}
        onAlt={() => {}}
      />,
    )
    expect(html).toContain('Matinée portes ouvertes')
    expect(html).toContain('value="#ESS"')
    expect(html).toContain('29 / 3000 caractères')
    expect(html).toContain('Écrites avec une ancienne valeur de : Date.')
    expect(html).toContain('Affiche du 23')
    expect(html.split(partsFr['campaign.pack.altStale']).length - 1).toBe(1)
    expect(html).toContain(partsFr['campaign.pack.rewrite'])
  })
})
