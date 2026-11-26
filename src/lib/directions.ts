/**
 * Three art directions to choose from, before the first screen — the browser's
 * half of `server/muse/inspire/directions.js`.
 *
 * Two things live here. The call, made with the proxy's own headers like the
 * dossier's. And the LEDGER: what this person's other projects already look
 * like, read off their directions (`avoidFrom`), so the proposals can be asked
 * to look like something else. Read, never stored: a project's direction is
 * already on the project, and a second record of it would drift from the first
 * the day someone recolours a token.
 */
import { parseDesignSystem } from './designTokens'
import { parseDesignSpec } from './designSpec'
import { proxyHeaders } from './proxy'
import { loadSettings } from './settings'

export interface ProposedDirection {
  name: string
  school: string
  concept: string
  display?: string
  body?: string
  colors: { label: string; hex: string }[]
  /** The direction as a project keeps it: a dossier's markdown. */
  markdown: string
}

export interface DirectionProposals {
  source: 'llm' | 'patterns'
  notices: string[]
  directions: ProposedDirection[]
}

/** One past direction, as the server reads it: three colours and two faces. */
export interface AvoidEntry {
  colors: { label: string; hex: string }[]
  display?: string
  body?: string
}

/** How many of the other projects are sent; the server keeps twelve. */
export const AVOID_MAX = 12

/**
 * The look of the account's OTHER projects, most recent first, one entry per
 * distinct direction. A project with no direction says nothing about a look.
 */
export function avoidFrom(projects: { id: string; design?: string; updatedAt?: number }[], currentId?: string): AvoidEntry[] {
  const seen = new Set<string>()
  const out: AvoidEntry[] = []
  const ordered = [...projects].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  for (const p of ordered) {
    const md = p.id === currentId ? '' : p.design?.trim()
    if (!md) continue
    const { roles } = parseDesignSystem(md)
    const { typography } = parseDesignSpec(md)
    const entry: AvoidEntry = {
      colors: [
        { label: 'Background', hex: roles.bg },
        { label: 'Text', hex: roles.text },
        { label: 'Accent', hex: roles.accent },
      ].filter((c) => /^#[0-9a-fA-F]{6}$/.test(c.hex)),
      display: typography.display,
      body: typography.body,
    }
    const key = JSON.stringify(entry)
    if (!entry.colors.length || seen.has(key)) continue
    seen.add(key)
    out.push(entry)
    if (out.length >= AVOID_MAX) break
  }
  return out
}

export async function proposeDirections(
  brief: string,
  opts: { language?: string; avoid?: AvoidEntry[]; creative?: boolean; signal?: AbortSignal } = {},
): Promise<DirectionProposals> {
  const s = loadSettings()
  const res = await fetch('/api/muse/directions', {
    method: 'POST',
    headers: proxyHeaders(s),
    body: JSON.stringify({
      brief,
      model: s.model,
      language: opts.language,
      avoid: opts.avoid ?? [],
      ...(opts.creative ? { creative: true } : {}),
    }),
    signal: opts.signal,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Muse failed (HTTP ${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`)
  }
  return (await res.json()) as DirectionProposals
}
