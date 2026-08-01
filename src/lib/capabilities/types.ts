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
}

export interface SnippetSource {
  /** The plain-JSX source string injected into the prelude. */
  source: string
  /** Explicit, hand-written list of global names this source defines. */
  exports: string[]
}

export interface Capability {
  id: string
  kind: CapabilityKind
  cdn?: { url: string; global?: string }
  /** Names to hoist onto window after the CDN script loads (e.g. ['PieChart', 'Bar', 'Tooltip']). */
  globals?: string[]
  triggers: { keywords: string[]; intents: string[] }
  conflictsWith?: string[]
  requires?: string[]
  /** If true, always selected (baseline) regardless of keywords. */
  baseline?: boolean
  /**
   * Superseded, but still injected for screens that were generated with it.
   *
   * A retired capability has no triggers and is absent from the documentation
   * the model reads, so nothing new can ever use it — while `Screen.caps`
   * entries from before it was retired still resolve, and those screens keep
   * rendering. Removing the entry instead would break them at load.
   */
  retired?: boolean
  /** For snippet-packs: metadata for the CAPABILITIES prompt section. */
  components?: CapabilityComponent[]
  /** For snippet-packs: one or more source blocks, each with an explicit exports list. */
  snippets?: SnippetSource[]
}