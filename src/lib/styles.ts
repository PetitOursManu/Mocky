/**
 * Built-in visual style presets. Each one is a ready-made DESIGN.md that the
 * user can apply in one click (it populates the design markdown, which is then
 * prepended to every generation). Swatches drive the gallery preview.
 */
export interface StylePreset {
  id: string
  name: string
  description: string
  swatches: string[]
  markdown: string
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'minimal-light',
    name: 'Minimal Light',
    description: 'Clean, airy, lots of whitespace',
    swatches: ['#ffffff', '#111827', '#4f46e5', '#f3f4f6'],
    markdown: `# Design System — Minimal Light

## Color tokens
- Background: #ffffff
- Surface: #f9fafb
- Text: #111827
- Muted text: #6b7280
- Primary: #4f46e5 (indigo-600)
- Border: #e5e7eb

## Typography
- Font: Inter, system-ui, sans-serif
- Headings: semibold, tight tracking
- Body: 15–16px, relaxed line height

## Spacing & radius
- Generous whitespace, base unit 4px
- Cards: p-6, rounded-2xl, border, very subtle shadow
- Buttons/inputs: rounded-lg

## Component patterns
- Light, airy layouts on white. Thin 1px borders instead of heavy shadows.
- Primary buttons: solid indigo, white text. Secondary: bordered, transparent.
- Minimal, content-first. Avoid gradients and bright fills.`,
  },
  {
    id: 'bold-dark',
    name: 'Bold Dark',
    description: 'High-contrast dark UI, vivid accents',
    swatches: ['#0b1020', '#e2e8f0', '#22d3ee', '#a855f7'],
    markdown: `# Design System — Bold Dark

## Color tokens
- Background: #0b1020
- Surface: #131a2e
- Text: #e2e8f0
- Muted text: #94a3b8
- Primary: #22d3ee (cyan-400)
- Secondary: #a855f7 (purple-500)
- Border: #1e293b

## Typography
- Font: Inter / Geist, sans-serif
- Headings: bold, large, tight tracking
- Body: 14–16px

## Spacing & radius
- Cards: p-6, rounded-2xl, surface bg, soft glow shadow
- Buttons/inputs: rounded-xl

## Component patterns
- Dark, high contrast. Vivid cyan/purple accents and subtle gradients (from-cyan-400 to-purple-500).
- Primary buttons: bright accent or gradient, dark text.
- Glowing focus rings, energetic and modern.`,
  },
  {
    id: 'playful',
    name: 'Playful',
    description: 'Rounded, colorful, friendly',
    swatches: ['#fff7ed', '#7c3aed', '#f97316', '#10b981'],
    markdown: `# Design System — Playful

## Color tokens
- Background: #fff7ed (warm cream)
- Surface: #ffffff
- Text: #1f2937
- Primary: #7c3aed (violet-600)
- Accent: #f97316 (orange-500)
- Success: #10b981
- Border: #fde68a

## Typography
- Font: Poppins / Nunito, rounded sans-serif
- Headings: extrabold, slightly playful
- Body: 15px

## Spacing & radius
- Big radius everywhere: rounded-3xl cards, rounded-full buttons
- Chunky padding (p-6/p-8), generous gaps

## Component patterns
- Friendly and colorful. Rounded shapes, soft drop shadows, occasional emoji.
- Bright multi-color accents, pill-shaped buttons with bold fills.`,
  },
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Trustworthy, structured, blue',
    swatches: ['#f8fafc', '#0f172a', '#2563eb', '#e2e8f0'],
    markdown: `# Design System — Corporate

## Color tokens
- Background: #f8fafc
- Surface: #ffffff
- Text: #0f172a
- Muted text: #64748b
- Primary: #2563eb (blue-600)
- Border: #e2e8f0

## Typography
- Font: Inter, system-ui
- Headings: semibold
- Body: 14–15px

## Spacing & radius
- Structured grids, consistent 8px rhythm
- Cards: rounded-xl, 1px border, subtle shadow
- Buttons/inputs: rounded-md

## Component patterns
- Professional and restrained. Blue primary, neutral grays, clear hierarchy.
- Data-dense friendly: tables, stat cards, top nav. No flashy gradients.`,
  },
  {
    id: 'glass',
    name: 'Glassmorphism',
    description: 'Frosted glass over gradients',
    swatches: ['#1e1b4b', '#ffffff', '#818cf8', '#f0abfc'],
    markdown: `# Design System — Glassmorphism

## Color tokens
- Background: gradient from #1e1b4b to #4c1d95 (indigo→violet)
- Surface: translucent white (bg-white/10 with backdrop-blur)
- Text: #ffffff
- Muted text: rgba(255,255,255,0.7)
- Primary: #818cf8
- Accent: #f0abfc

## Typography
- Font: Inter, sans-serif
- Headings: semibold, light tracking
- Body: 15px

## Spacing & radius
- Cards: rounded-2xl, bg-white/10, backdrop-blur, 1px white/20 border
- Buttons: rounded-xl, translucent or solid accent

## Component patterns
- Frosted-glass cards floating over a vivid gradient background.
- Use backdrop-blur, semi-transparent white surfaces, soft glows. Light text.`,
  },
  {
    id: 'neobrutalist',
    name: 'Neobrutalist',
    description: 'Hard edges, thick borders, bold',
    swatches: ['#fde047', '#000000', '#ffffff', '#2563eb'],
    markdown: `# Design System — Neobrutalist

## Color tokens
- Background: #fef9c3 (or #ffffff)
- Surface: #ffffff
- Text: #000000
- Primary: #2563eb
- Accents: #fde047 (yellow), #f43f5e (red), #22c55e (green)
- Border: #000000

## Typography
- Font: Space Grotesk / mono-ish bold sans
- Headings: black weight, uppercase friendly
- Body: 15px, strong

## Spacing & radius
- Sharp corners (rounded-none or rounded-sm)
- Thick 2–3px BLACK borders on everything
- Hard offset shadows: shadow-[4px_4px_0_0_#000]

## Component patterns
- Bold, raw, high-energy. Flat bright fills, thick black outlines, hard drop shadows.
- Buttons: solid color, black border, offset shadow, no gradient.`,
  },
]
