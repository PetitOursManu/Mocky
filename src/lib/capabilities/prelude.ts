import type { Capability } from './types'
import { cnSource } from './snippets/cn'

/**
 * Builds the prelude source string that is prepended to the generated code
 * before Babel.transform. For snippet-pack capabilities, this includes the
 * `cn` helper and ALL component sources. For CDN capabilities, nothing is
 * prepended (they are loaded via <script>/<link> tags in the iframe HTML).
 *
 * Snippet-packs are ATOMIC: when a pack is selected, ALL of its components are
 * injected — never a subset. Sources are deduplicated so that a shared source
 * (e.g. all chart components in one file) is injected only once.
 */
export function buildPrelude(caps: Capability[]): string {
  const parts: string[] = []

  // Always include the cn helper if any snippet-pack is present
  const hasSnippets = caps.some((c) => c.kind === 'snippet-pack')
  if (hasSnippets) {
    parts.push('// --- cn() helper ---')
    parts.push(cnSource)
  }

  // Include component sources from snippet-pack capabilities.
  // Deduplicate by source string so shared sources are injected only once.
  const seenSources = new Set<string>()
  for (const cap of caps) {
    if (cap.kind !== 'snippet-pack' || !cap.components) continue
    const names = cap.components.map((c) => c.name).join(', ')
    for (const comp of cap.components) {
      if (!comp.source || seenSources.has(comp.source)) continue
      seenSources.add(comp.source)
      parts.push(`// --- ${names} (from ${cap.id}) ---`)
      parts.push(comp.source)
    }
  }

  return parts.join('\n\n')
}

/**
 * Returns the set of component names that buildPrelude would inject for the
 * given caps. Used by tests to assert advertisedNames === injectedNames.
 */
export function injectedNames(caps: Capability[]): Set<string> {
  const names = new Set<string>()
  for (const cap of caps) {
    if (cap.kind !== 'snippet-pack' || !cap.components) continue
    for (const comp of cap.components) {
      if (comp.source) names.add(comp.name)
    }
  }
  return names
}