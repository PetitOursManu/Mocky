/**
 * Derive shadcn-compatible CSS custom properties from a DESIGN.md.
 *
 * This is the bridge to the shadcn / designmd.co ecosystem: after export the
 * user runs `npx shadcn@latest add button card` and the components inherit the
 * brand automatically, because globals.css already carries these tokens.
 *
 * DESIGN.md is free-form Markdown (and there are 17 built-in style presets), so
 * parsing is deliberately TOLERANT: we scan for `- <Token>: #hex` style lines
 * case-insensitively, fall back to sane defaults for anything missing, and
 * NEVER throw. Regex here scans Markdown prose (not code), so invariant 1 —
 * which forbids regex-parsing generated/vendored *source* — does not apply.
 */

export interface DesignTokens {
  background: string
  surface: string
  text: string
  mutedText: string
  primary: string
  border: string
}

/** Sane defaults (a neutral light theme with an indigo primary). */
export const DEFAULT_TOKENS: DesignTokens = {
  background: '#ffffff',
  surface: '#f8fafc',
  text: '#0f172a',
  mutedText: '#64748b',
  primary: '#4f46e5',
  border: '#e2e8f0',
}

/** First hex color found on a `- <label>: ... #hex ...` line, else null. */
function findToken(md: string, labels: string[]): string | null {
  const lines = md.split(/\r?\n/)
  for (const label of labels) {
    for (const line of lines) {
      // e.g. "- Primary: #4f46e5 (indigo-600)"  /  "* primary color — #4f46e5"
      const re = new RegExp(`^\\s*[-*]?\\s*${label}\\b[^#]*(#[0-9a-fA-F]{3,8})`, 'i')
      const m = re.exec(line)
      if (m) return normalizeHex(m[1])
    }
  }
  return null
}

/** Clamp a hex to #rrggbb (accepts #rgb / #rrggbbaa; drops alpha). */
function normalizeHex(hex: string): string | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length === 8) h = h.slice(0, 6)
  return '#' + h.toLowerCase()
}

/**
 * Parse the six brand tokens from a DESIGN.md. Missing tokens fall back to
 * DEFAULT_TOKENS. Always returns a complete, valid set — never throws.
 */
export function parseDesignTokens(markdown?: string): DesignTokens {
  const md = markdown || ''
  const get = (labels: string[], fallback: string) => findToken(md, labels) || fallback
  return {
    background: get(['background', 'bg', 'page'], DEFAULT_TOKENS.background),
    surface: get(['surface', 'card', 'panel'], DEFAULT_TOKENS.surface),
    text: get(['text', 'foreground', 'ink'], DEFAULT_TOKENS.text),
    mutedText: get(['muted text', 'muted', 'secondary text', 'subtle'], DEFAULT_TOKENS.mutedText),
    primary: get(['primary', 'accent', 'brand'], DEFAULT_TOKENS.primary),
    border: get(['border', 'divider', 'outline'], DEFAULT_TOKENS.border),
  }
}

/** Convert #rrggbb to a shadcn HSL triplet string like "243 75% 59%". */
export function hexToHslTriplet(hex: string): string {
  const norm = normalizeHex(hex) || '#000000'
  const r = parseInt(norm.slice(1, 3), 16) / 255
  const g = parseInt(norm.slice(3, 5), 16) / 255
  const b = parseInt(norm.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  const d = max - min
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h /= 6
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

/** Relative luminance (0..1) — used to pick a readable foreground. */
function luminance(hex: string): number {
  const norm = normalizeHex(hex) || '#000000'
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(norm.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

/** A readable foreground (near-black on light colors, white on dark). */
function foregroundFor(hex: string): string {
  return luminance(hex) > 0.5 ? '222 47% 11%' : '0 0% 100%'
}

/**
 * Emit a shadcn-compatible globals.css with :root (light) and .dark blocks.
 * Tailwind's base layer maps these to bg-background, text-foreground, etc.
 */
export function buildGlobalsCss(tokens: DesignTokens): string {
  const bg = hexToHslTriplet(tokens.background)
  const fg = hexToHslTriplet(tokens.text)
  const card = hexToHslTriplet(tokens.surface)
  const primary = hexToHslTriplet(tokens.primary)
  const primaryFg = foregroundFor(tokens.primary)
  const muted = hexToHslTriplet(tokens.surface)
  const mutedFg = hexToHslTriplet(tokens.mutedText)
  const border = hexToHslTriplet(tokens.border)

  return `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: ${bg};
    --foreground: ${fg};
    --card: ${card};
    --card-foreground: ${fg};
    --popover: ${card};
    --popover-foreground: ${fg};
    --primary: ${primary};
    --primary-foreground: ${primaryFg};
    --secondary: ${muted};
    --secondary-foreground: ${fg};
    --muted: ${muted};
    --muted-foreground: ${mutedFg};
    --accent: ${muted};
    --accent-foreground: ${fg};
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: ${border};
    --input: ${border};
    --ring: ${primary};
    --radius: 0.5rem;
  }

  /* Dark block: brand primary is carried over; the neutrals use a standard
     dark palette so the app is legible even when DESIGN.md is a light theme. */
  .dark {
    --background: 222 47% 11%;
    --foreground: 210 40% 98%;
    --card: 222 47% 13%;
    --card-foreground: 210 40% 98%;
    --popover: 222 47% 13%;
    --popover-foreground: 210 40% 98%;
    --primary: ${primary};
    --primary-foreground: ${primaryFg};
    --secondary: 217 33% 18%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217 33% 18%;
    --muted-foreground: 215 20% 65%;
    --accent: 217 33% 18%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 63% 45%;
    --destructive-foreground: 0 0% 100%;
    --border: 217 33% 20%;
    --input: 217 33% 20%;
    --ring: ${primary};
    --radius: 0.5rem;
  }

  * {
    border-color: hsl(var(--border));
  }
  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
  }
}
`
}

/** Convenience: DESIGN.md markdown → globals.css in one call. */
export function globalsCssFromDesign(markdown?: string): string {
  return buildGlobalsCss(parseDesignTokens(markdown))
}
