import type { Capability } from './types'
import { cnSource } from './snippets/cn'
import { sanitizeSource } from '../generate'

/**
 * Builds the prelude source string that is prepended to the generated code
 * before Babel.transform. For snippet-pack capabilities, this includes the
 * `cn` helper and ALL snippet sources. For CDN capabilities, nothing is
 * prepended (they are loaded via <script>/<link> tags in the iframe HTML).
 *
 * Snippet-packs are ATOMIC: when a pack is selected, ALL of its snippet
 * sources are injected — never a subset, never filtered per-component.
 * Every source is sanitized to strip invisible/invalid characters.
 */
export function buildPrelude(caps: Capability[]): string {
  const parts: string[] = []

  // Always include the cn helper if any snippet-pack is present
  const hasSnippets = caps.some((c) => c.kind === 'snippet-pack')
  if (hasSnippets) {
    parts.push('// --- cn() helper ---')
    parts.push(sanitizeSource(cnSource))
  }

  // Inject ALL snippet sources from each selected snippet-pack.
  // No per-component filtering — the whole pack is injected.
  for (const cap of caps) {
    if (cap.kind !== 'snippet-pack' || !cap.snippets) continue
    const allExports = cap.snippets.flatMap((s) => s.exports).join(', ')
    parts.push(`// --- ${allExports} (from ${cap.id}) ---`)
    for (const snippet of cap.snippets) {
      parts.push(sanitizeSource(snippet.source))
    }
  }

  return parts.join('\n\n')
}

/**
 * Returns the set of component names that buildPrelude would inject for the
 * given caps. Derived from each snippet's explicit `exports` array — never
 * from parsing source code.
 */
export function injectedNames(caps: Capability[]): Set<string> {
  const names = new Set<string>()
  for (const cap of caps) {
    if (cap.kind !== 'snippet-pack' || !cap.snippets) continue
    for (const snippet of cap.snippets) {
      for (const name of snippet.exports) {
        names.add(name)
      }
    }
  }
  return names
}