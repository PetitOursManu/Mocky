import type { Capability } from './types'
import { cnSource } from './snippets/cn'

/**
 * Builds the prelude source string that is prepended to the generated code
 * before Babel.transform. For snippet-pack capabilities, this includes the
 * `cn` helper and all component sources. For CDN capabilities, nothing is
 * prepended (they are loaded via <script>/<link> tags in the iframe HTML).
 */
export function buildPrelude(caps: Capability[]): string {
  const parts: string[] = []

  // Always include the cn helper if any snippet-pack is present
  const hasSnippets = caps.some((c) => c.kind === 'snippet-pack')
  if (hasSnippets) {
    parts.push('// --- cn() helper ---')
    parts.push(cnSource)
  }

  // Include component sources from snippet-pack capabilities
  for (const cap of caps) {
    if (cap.kind !== 'snippet-pack' || !cap.components) continue
    for (const comp of cap.components) {
      parts.push(`// --- ${comp.name} (from ${cap.id}) ---`)
      parts.push(comp.source)
    }
  }

  return parts.join('\n\n')
}