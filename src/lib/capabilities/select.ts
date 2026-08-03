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
/**
 * Capabilities the CODE actually uses, whatever the prompt asked for.
 *
 * `selectCapabilities` reads the prompt, before a single line exists. The model
 * then writes whatever it likes — and when it reaches for `<Animated>` on a
 * prompt that never said "animation", the prelude has no such global and React
 * renders `undefined`. That is error #130, once per use, and the screen only
 * survives because an error boundary catches it.
 *
 * This closes the class rather than the case: every capability declares the
 * globals it defines, so the check is "does the code name one of them", asked
 * after the fact and for all of them at once.
 *
 * Word-boundary matching, and only where a component can appear — as a JSX tag
 * or as a namespace before a dot. A capability whose name merely occurs inside
 * a string or a class attribute must not be loaded: each one costs a script in
 * every preview.
 */
export function capabilitiesUsedBy(code: string): string[] {
  if (!code || !code.trim()) return []
  const out = new Set<string>()
  for (const cap of CAPABILITIES) {
    // Not every capability ships code: daisyUI is a stylesheet and declares no
    // globals, so there is nothing here to look for.
    const names = (cap.snippets ?? []).flatMap((s) => s.exports ?? [])
    for (const name of names) {
      // `<Animated`, `<Icon.Mail`, `Icon.Mail`, or the bare identifier in an
      // expression. Escaped because a name could in principle contain a dot.
      const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`<\\s*${n}[\\s/>.]|\\b${n}\\s*\\.`).test(code)) {
        out.add(cap.id)
        break
      }
    }
  }
  return [...out]
}

/**
 * What the prompt asked for, plus what the code turned out to need.
 *
 * The union, because both are evidence and neither is complete: the prompt knows
 * the intent before the code exists, the code knows what was actually reached
 * for. Dropping a capability the prompt selected but the code never used would
 * be tempting and wrong — a later edit may add it back, and the screen would
 * break with no change to its own text.
 */
export function capabilitiesFor(promptIds: string[], code: string): string[] {
  return [...new Set([...promptIds, ...capabilitiesUsedBy(code)])]
}

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