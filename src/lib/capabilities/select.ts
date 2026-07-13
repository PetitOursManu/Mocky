import type { Capability } from './types'
import { CAPABILITIES, CAPABILITY_MAP } from './registry'

/**
 * Deterministic keyword/intent scoring over (userPrompt + active DESIGN.md).
 * No LLM. Returns a list of selected capability IDs with dependency resolution.
 *
 * Scoring: for each capability, count how many of its trigger keywords appear
 * in the combined text (case-insensitive). If any keyword matches, the
 * capability is selected. Dependencies (requires) are auto-pulled.
 * Conflicts (conflictsWith) are removed after selection.
 */
export function selectCapabilities(userPrompt: string, designMarkdown?: string): string[] {
  const text = (userPrompt + ' ' + (designMarkdown || '')).toLowerCase()

  const selected = new Set<string>()

  // Always include baseline capabilities (e.g. icons)
  for (const cap of CAPABILITIES) {
    if (cap.baseline) selected.add(cap.id)
  }

  for (const cap of CAPABILITIES) {
    if (cap.baseline) continue
    const allTriggers = [...cap.triggers.keywords, ...cap.triggers.intents]
    const hit = allTriggers.some((kw) => text.includes(kw.toLowerCase()))
    if (hit) {
      selected.add(cap.id)
    }
  }

  // Resolve dependencies: if a selected cap requires others, add them.
  const resolveDeps = (ids: Set<string>) => {
    let changed = true
    while (changed) {
      changed = false
      for (const id of Array.from(ids)) {
        const cap = CAPABILITY_MAP[id]
        if (cap?.requires) {
          for (const dep of cap.requires) {
            if (!ids.has(dep)) {
              ids.add(dep)
              changed = true
            }
          }
        }
      }
    }
  }
  resolveDeps(selected)

  // Remove conflicting caps. If A conflicts with B and both are selected,
  // keep the one with more keyword hits (simplified: keep the first one).
  for (const cap of CAPABILITIES) {
    if (cap.conflictsWith) {
      for (const conflict of cap.conflictsWith) {
        if (selected.has(cap.id) && selected.has(conflict)) {
          selected.delete(conflict)
        }
      }
    }
  }

  return Array.from(selected)
}

/**
 * Resolve a list of capability IDs into Capability objects, with dependencies.
 * Used when rebuilding from persisted caps on a Screen.
 */
export function resolveCapabilities(ids: string[]): Capability[] {
  const set = new Set(ids)
  // Resolve dependencies
  let changed = true
  while (changed) {
    changed = false
    for (const id of Array.from(set)) {
      const cap = CAPABILITY_MAP[id]
      if (cap?.requires) {
        for (const dep of cap.requires) {
          if (!set.has(dep)) {
            set.add(dep)
            changed = true
          }
        }
      }
    }
  }
  return Array.from(set).map((id) => CAPABILITY_MAP[id]).filter(Boolean)
}