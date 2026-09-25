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
   * Does this bundle DRAW the screen, or only move it?
   *
   * The capture shell (`lib/capture.ts`) loads no CDN script at all, and for one
   * library that is right and for the other it is not. Motion only animates
   * elements the markup already contains, so a still is the same picture without
   * it. three.js IS the picture: a screen with a `<Scene3D>` captured as an empty
   * gradient, in the thumbnail on the home page and in an annotation snip alike.
   *
   * So a capability says which kind it is, and only the drawing ones are paid
   * for in a frame whose whole output is one image. Nothing else reads this
   * flag — a preview loads every selected bundle, as it always did.
   */
  drawsContent?: boolean
  /**
   * Superseded, but still injected for screens that were generated with it.
   *
   * A retired capability has no triggers and is absent from the documentation
   * the model reads, so nothing new can ever use it — while `Screen.caps`
   * entries from before it was retired still resolve, and those screens keep
   * rendering. Removing the entry instead would break them at load.
   */
  retired?: boolean
  /**
   * Class names this capability's stylesheet defines, for a pack that styles
   * as well as renders.
   *
   * `capabilitiesUsedBy` looks for component names, and a screen that uses the
   * Ultra kit's `u-glass` but no `<Backdrop>` names none: it would be judged as
   * not needing the pack, and its every frosted surface would silently turn
   * into a plain box. Declared here so the check can find them too.
   */
  classes?: string[]
  /** For snippet-packs: metadata for the CAPABILITIES prompt section. */
  components?: CapabilityComponent[]
  /** For snippet-packs: one or more source blocks, each with an explicit exports list. */
  snippets?: SnippetSource[]
}