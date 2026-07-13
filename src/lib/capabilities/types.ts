/**
 * A runtime capability that can be injected into the sandboxed preview iframe.
 * Capabilities are either CDN scripts/CSS (exposing a global) or snippet-packs
 * (plain JSX source prepended to the generated code before Babel.transform).
 */
export type CapabilityKind = 'cdn-script' | 'cdn-css' | 'snippet-pack'

export interface CapabilityComponent {
  name: string
  signature: string
  description: string
  tags: string[]
  source: string
}

export interface Capability {
  id: string
  kind: CapabilityKind
  cdn?: { url: string; global?: string }
  triggers: { keywords: string[]; intents: string[] }
  conflictsWith?: string[]
  requires?: string[]
  components?: CapabilityComponent[]
}