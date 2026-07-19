import type { Settings } from './settings'
import { CAPABILITY_MAP, CAPABILITIES } from './capabilities/registry'
import { proxyFetch } from './proxy'

/**
 * Optional pre-generation "planner" pass. A cheap, NON-streamed LLM call that
 * decides the screen's structure and which capabilities it actually needs,
 * before the (streamed) code generation runs.
 *
 * Hard rule: the planner must NEVER block or break generation. Any failure —
 * network error, timeout, non-JSON, wrong shape — resolves to `null`, and the
 * caller falls back SILENTLY to the deterministic select.ts shortlist. That is
 * why this module does its own fetch (returning null on error) instead of
 * reusing chat(), which throws.
 *
 * It uses Ollama structured output (`format: <json schema>`) with `stream:
 * false`. Structured output is safe here (small, non-streamed) but is NEVER
 * used for code generation — that would break the live preview and the
 * <<<MOCKY>>> sentinel protocol.
 */
export interface Plan {
  /** Capability ids (validated against the registry + shortlist). */
  capabilities: string[]
  /** One sentence describing the overall structure. */
  layout: string
  /** Ordered sections to build, top to bottom. */
  sections: string[]
  /** Realistic copy/data hints (names, figures, labels). */
  contentNotes: string
}

/** JSON schema handed to Ollama's `format` for structured output. */
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    capabilities: { type: 'array', items: { type: 'string' } },
    layout: { type: 'string' },
    sections: { type: 'array', items: { type: 'string' } },
    contentNotes: { type: 'string' },
  },
  required: ['capabilities', 'layout', 'sections', 'contentNotes'],
}

const DEFAULT_TIMEOUT_MS = 3000

/** Capability ids that are always present (baseline) — never dropped. */
const BASELINE_IDS = CAPABILITIES.filter((c) => c.baseline).map((c) => c.id)

function buildPlanSystem(shortlist: string[], design?: string, presetHint?: string): string {
  const parts = [
    'You are a senior UI architect. PLAN a single screen from the user request — do NOT write any code.',
    'Respond with ONLY a JSON object matching the provided schema. No prose, no code fences.',
    '',
    'Fields:',
    '- capabilities: the ids this screen actually needs, chosen ONLY from this shortlist: [' +
      shortlist.join(', ') +
      ']. Prefer fewer. Only include an id if the screen clearly uses it.',
    '- layout: ONE sentence describing the overall structure (e.g. "centered card", "sidebar + main grid", "stacked mobile sections").',
    '- sections: an ordered list of the concrete blocks to build, top to bottom.',
    '- contentNotes: realistic, specific copy and data hints (names, numbers, labels) so the screen never looks like a placeholder.',
    'Be concise and specific to THIS request.',
  ]
  if (presetHint) parts.push('', 'Target form factor:', presetHint)
  if (design) parts.push('', 'Design system to honor:', design)
  return parts.join('\n')
}

/**
 * Validate the raw parsed object into a Plan, or return null if it doesn't have
 * the required shape. Capability ids are filtered to those that exist in the
 * registry AND are in the shortlist; baseline ids are always re-added so the
 * planner can never drop them.
 */
function validatePlan(raw: unknown, shortlist: string[]): Plan | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (
    !Array.isArray(o.capabilities) ||
    typeof o.layout !== 'string' ||
    !Array.isArray(o.sections) ||
    typeof o.contentNotes !== 'string'
  ) {
    return null
  }
  const allowed = new Set(shortlist)
  const chosen = (o.capabilities as unknown[])
    .filter((id): id is string => typeof id === 'string')
    .filter((id) => CAPABILITY_MAP[id] && allowed.has(id)) // drop unknown/hallucinated + off-shortlist
  const capabilities = Array.from(new Set([...BASELINE_IDS, ...chosen]))
  const sections = (o.sections as unknown[]).filter((s): s is string => typeof s === 'string')
  return {
    capabilities,
    layout: o.layout,
    sections,
    contentNotes: o.contentNotes,
  }
}

/**
 * Run the planner. Returns a validated Plan, or `null` on ANY failure (the
 * caller then uses the deterministic shortlist unchanged).
 */
export async function planScreen(
  s: Settings,
  userPrompt: string,
  shortlist: string[],
  opts?: { design?: string; presetHint?: string; timeoutMs?: number },
  signal?: AbortSignal,
): Promise<Plan | null> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const onExternalAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onExternalAbort)

  try {
    const body = JSON.stringify({
      model: s.model,
      stream: false,
      format: PLAN_SCHEMA,
      messages: [
        { role: 'system', content: buildPlanSystem(shortlist, opts?.design, opts?.presetHint) },
        { role: 'user', content: userPrompt },
      ],
      // num_predict MUST be positive — Ollama Cloud rejects -1 (invariant 8).
      options: { temperature: 0.2, num_ctx: 8192, num_predict: 1024 },
    })
    const res = await proxyFetch(s, '/api/chat', { method: 'POST', body, signal: ctrl.signal })
    if (!res.ok) return null
    const data = (await res.json()) as { message?: { content?: string }; choices?: Array<{ message?: { content?: string } }> }
    const content = data.message?.content ?? data.choices?.[0]?.message?.content ?? ''
    if (!content.trim()) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      return null // model didn't honor structured output
    }
    return validatePlan(parsed, shortlist)
  } catch {
    return null // network error, abort/timeout, anything
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}

/**
 * Render a Plan into a system-prompt section appended to the generation system
 * message. Kept plain text — the generator still owns the actual code output.
 */
export function planToPromptSection(plan: Plan): string {
  const lines = [
    'SCREEN PLAN (follow this structure; it was produced by a planning pass):',
    `- Layout: ${plan.layout}`,
  ]
  if (plan.sections.length) {
    lines.push('- Sections, in order:')
    plan.sections.forEach((sec, i) => lines.push(`  ${i + 1}. ${sec}`))
  }
  if (plan.contentNotes.trim()) lines.push(`- Content notes (use realistic copy like this): ${plan.contentNotes}`)
  return lines.join('\n')
}
