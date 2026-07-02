export interface DesignConfig {
  /** Raw DESIGN.md markdown. */
  markdown: string
  /** Whether to prepend it to generation prompts. */
  enabled: boolean
}

const STORAGE_KEY = 'mocky.design.v1'

export function defaultDesign(): DesignConfig {
  return { markdown: '', enabled: true }
}

export function loadDesign(): DesignConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultDesign()
    const parsed = JSON.parse(raw) as Partial<DesignConfig>
    return { ...defaultDesign(), ...parsed }
  } catch {
    return defaultDesign()
  }
}

export function saveDesign(d: DesignConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
}

/** True when a design system is configured and switched on. */
export function isDesignActive(d: DesignConfig): boolean {
  return d.enabled && d.markdown.trim().length > 0
}

/**
 * Wraps the DESIGN.md content with an explicit instruction so the model
 * treats it as the authoritative brand/design system to follow. Returned
 * string is passed as the `extraSystem` portion of the generation prompt.
 */
export function buildDesignPreamble(markdown: string): string {
  return [
    'The following is the project DESIGN SYSTEM (DESIGN.md). Treat it as authoritative.',
    'Every screen you generate MUST follow its color tokens, typography, spacing scale, and',
    'component patterns exactly, so all generated screens stay visually consistent and on-brand.',
    'Map its tokens to the closest Tailwind utility classes (use arbitrary values like',
    'bg-[#1d4ed8] when a token has no default Tailwind equivalent).',
    '',
    '<DESIGN_SYSTEM>',
    markdown.trim(),
    '</DESIGN_SYSTEM>',
  ].join('\n')
}

/** A minimal example so users without a DESIGN.md can see the expected shape. */
export const STARTER_TEMPLATE = `# Design System

## Color tokens
- Primary: #4f46e5 (indigo-600)
- Primary hover: #4338ca
- Background: #0f172a (slate-900)
- Surface: #1e293b (slate-800)
- Text: #e2e8f0 (slate-200)
- Muted text: #94a3b8 (slate-400)
- Border: #334155 (slate-700)
- Success: #10b981  Danger: #f43f5e

## Typography
- Font: system-ui / Inter, sans-serif
- Headings: bold, tight tracking
- Body: 14–16px, relaxed line height
- Scale: text-xs labels, text-sm body, text-lg section titles, text-2xl page titles

## Spacing & radius
- Base spacing unit: 4px (Tailwind default scale)
- Card padding: p-6 ; gaps: gap-4
- Radius: rounded-xl for cards, rounded-lg for inputs/buttons

## Component patterns
- Buttons: solid primary (bg-primary text-white), ghost (border, transparent bg). Medium weight, rounded-lg, px-4 py-2.
- Cards: surface bg, 1px border, rounded-xl, subtle shadow.
- Inputs: surface bg, border, focus ring in primary color.
- Layout: generous whitespace, max content width, clear visual hierarchy.
`
