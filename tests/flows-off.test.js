import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildGenerationMessages } from '../src/lib/generate'
import { resolveCapabilities, selectCapabilities } from '../src/lib/capabilities/select'

/**
 * Invariant V7: with "Parcours" off, a generation and a preview are what they
 * were before working prototypes existed.
 *
 * Read off the source where the path is a dozen network stages no test can run
 * (lib/pipeline/newScreen.ts, ProjectView's `generate`), checked by behaviour
 * where it is pure — the prompt a model is sent, the document a frame loads.
 */
const pipeline = readFileSync(new URL('../src/lib/pipeline/newScreen.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const preview = readFileSync(new URL('../src/components/Preview.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const composer = readFileSync(new URL('../src/components/ProjectView.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

describe('Parcours off leaves generation unchanged (V7)', () => {
  it('adds the kit only when the request asks for flows', () => {
    expect(pipeline).toContain("if (req.flows && !pipe.document && !capIds.includes('flow')) capIds = [...capIds, 'flow']")
    expect(pipeline.match(/'flow'\]/g)).toHaveLength(1)
  })

  it('appends a flow context only when one was given', () => {
    expect(pipeline).toContain("if (req.flowContext) planSection = [planSection, req.flowContext].filter(Boolean).join('\\n\\n')")
  })

  it('never selects the kit from a prompt', () => {
    expect(selectCapabilities('une boutique avec un panier et une page de connexion')).not.toContain('flow')
  })

  it('sends a model no flow rule when the kit is not in scope', () => {
    const caps = resolveCapabilities(selectCapabilities('une page de connexion'))
    const { system } = buildGenerationMessages('une page de connexion', undefined, undefined, caps)
    expect(system).not.toContain('PROTOTYPE FLOWS')
    expect(system).not.toContain('MockyFlow')
    const withFlow = buildGenerationMessages('une page de connexion', undefined, undefined, resolveCapabilities([...caps.map((c) => c.id), 'flow']))
    expect(withFlow.system).toContain('PROTOTYPE FLOWS')
  })

  it('passes flows from the composer only when the switch is on, and makes companions only then', () => {
    expect(composer).toContain('...(flowsOn ? { flows: true } : {}),')
    // `composerPage`, not the remembered `pageFormatId`: a format remembered
    // from an earlier flyer while the type is now a web page used to skip the
    // companions of a screen that IS a page of a site.
    expect(composer).toContain('if (flowsOn && !outcome.error && !composerPage) {')
    expect(composer.match(/runFlowCompanions\(/g)).toHaveLength(1)
  })

  it('builds the frame of a screen outside a demo without any flow state', () => {
    // The only line that writes it, and only when a state was handed in…
    expect(preview.match(/__mockyFlowInit/g)).toHaveLength(1)
    expect(preview).toContain("${flowInit !== undefined ? `window.__mockyFlowInit = ${flowInit};` : ''}")
    // …which only a holder that passed `flow` does.
    expect(preview).toContain('flowRef.current ? flowStateScript(flowRef.current.state) : undefined')
  })
})
