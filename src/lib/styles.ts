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
  /** Mini preview config: CSS values to render a sample card + button. */
  preview: {
    bg: string
    cardBg: string
    cardBorder: string
    text: string
    mutedText: string
    accent: string
    accentText: string
    radius: string
  }
  markdown: string
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'minimal-light',
    name: 'Minimal Light',
    description: 'Clean, airy, lots of whitespace',
    swatches: ['#ffffff', '#111827', '#4f46e5', '#f3f4f6'],
    preview: { bg: '#ffffff', cardBg: '#f9fafb', cardBorder: '#e5e7eb', text: '#111827', mutedText: '#6b7280', accent: '#4f46e5', accentText: '#ffffff', radius: '16px' },
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
    preview: { bg: '#0b1020', cardBg: '#131a2e', cardBorder: '#1e293b', text: '#e2e8f0', mutedText: '#94a3b8', accent: '#22d3ee', accentText: '#0b1020', radius: '16px' },
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
    preview: { bg: '#fff7ed', cardBg: '#ffffff', cardBorder: '#fde68a', text: '#1f2937', mutedText: '#6b7280', accent: '#7c3aed', accentText: '#ffffff', radius: '24px' },
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
    preview: { bg: '#f8fafc', cardBg: '#ffffff', cardBorder: '#e2e8f0', text: '#0f172a', mutedText: '#64748b', accent: '#2563eb', accentText: '#ffffff', radius: '12px' },
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
    preview: { bg: 'linear-gradient(135deg, #1e1b4b, #4c1d95)', cardBg: 'rgba(255,255,255,0.1)', cardBorder: 'rgba(255,255,255,0.2)', text: '#ffffff', mutedText: 'rgba(255,255,255,0.7)', accent: '#818cf8', accentText: '#1e1b4b', radius: '16px' },
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
    preview: { bg: '#fef9c3', cardBg: '#ffffff', cardBorder: '#000000', text: '#000000', mutedText: '#444444', accent: '#2563eb', accentText: '#ffffff', radius: '4px' },
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
  {
    id: 'warm-earth',
    name: 'Warm Earth',
    description: 'Natural tones, cozy, organic',
    swatches: ['#faf6f0', '#3c2a1e', '#b45309', '#d6c3a5'],
    preview: { bg: '#faf6f0', cardBg: '#fffaf3', cardBorder: '#d6c3a5', text: '#3c2a1e', mutedText: '#8b7355', accent: '#b45309', accentText: '#ffffff', radius: '14px' },
    markdown: `# Design System — Warm Earth

## Color tokens
- Background: #faf6f0 (warm sand)
- Surface: #fffaf3
- Text: #3c2a1e (dark brown)
- Muted text: #8b7355
- Primary: #b45309 (amber-700)
- Accent: #059669 (emerald-600)
- Border: #d6c3a5

## Typography
- Font: Source Serif Pro / Lora, serif headings
- Body: Inter, sans-serif 15px
- Headings: medium weight, warm

## Spacing & radius
- Cards: p-6, rounded-2xl, warm border, soft shadow
- Buttons: rounded-lg

## Component patterns
- Natural, cozy, organic. Earthy tones, warm borders, rounded shapes.
- Use serif headings for personality. Accent buttons in amber.`,
  },
  {
    id: 'mint-fresh',
    name: 'Mint Fresh',
    description: 'Cool greens, clean, refreshing',
    swatches: ['#f0fdf4', '#064e3b', '#10b981', '#a7f3d0'],
    preview: { bg: '#f0fdf4', cardBg: '#ffffff', cardBorder: '#a7f3d0', text: '#064e3b', mutedText: '#059669', accent: '#10b981', accentText: '#ffffff', radius: '14px' },
    markdown: `# Design System — Mint Fresh

## Color tokens
- Background: #f0fdf4 (mint-50)
- Surface: #ffffff
- Text: #064e3b (emerald-900)
- Muted text: #059669
- Primary: #10b981 (emerald-500)
- Border: #a7f3d0

## Typography
- Font: DM Sans / Inter, sans-serif
- Headings: semibold, fresh
- Body: 15px

## Spacing & radius
- Cards: p-6, rounded-2xl, soft mint border
- Buttons: rounded-xl

## Component patterns
- Cool, fresh, clean. Mint greens on white. Subtle shadows.
- Accent buttons in emerald. Light, airy, health/nature vibe.`,
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm gradients, pink/orange energy',
    swatches: ['#fff1f2', '#831843', '#f43f5e', '#fb923c'],
    preview: { bg: 'linear-gradient(135deg, #fff1f2, #fef3c7)', cardBg: '#ffffff', cardBorder: '#fbcfe8', text: '#831843', mutedText: '#be185d', accent: '#f43f5e', accentText: '#ffffff', radius: '16px' },
    markdown: `# Design System — Sunset

## Color tokens
- Background: gradient from #fff1f2 to #fef3c7 (rose to amber)
- Surface: #ffffff
- Text: #831843 (rose-900)
- Muted text: #be185d
- Primary: #f43f5e (rose-500)
- Accent: #fb923c (orange-400)
- Border: #fbcfe8

## Typography
- Font: Poppins / Inter, sans-serif
- Headings: bold, warm
- Body: 15px

## Spacing & radius
- Cards: rounded-2xl, white surface, soft pink border, warm shadow
- Buttons: rounded-xl

## Component patterns
- Warm, energetic, sunset vibes. Pink-to-orange gradients, rose accents.
- Soft white cards over a gradient background. Inviting and vibrant.`,
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep blue-black, gold accents, elegant',
    swatches: ['#020617', '#e2e8f0', '#fbbf24', '#1e3a5f'],
    preview: { bg: '#020617', cardBg: '#0f172a', cardBorder: '#1e3a5f', text: '#e2e8f0', mutedText: '#94a3b8', accent: '#fbbf24', accentText: '#020617', radius: '12px' },
    markdown: `# Design System — Midnight

## Color tokens
- Background: #020617 (slate-950)
- Surface: #0f172a (slate-900)
- Text: #e2e8f0
- Muted text: #94a3b8
- Primary: #fbbf24 (amber-400, gold)
- Secondary: #3b82f6 (blue-500)
- Border: #1e3a5f

## Typography
- Font: Playfair Display / Inter, serif headings
- Body: 14–15px, sans-serif
- Headings: elegant, serif, gold accents

## Spacing & radius
- Cards: rounded-xl, deep navy surface, subtle border
- Buttons: rounded-lg

## Component patterns
- Elegant, premium, dark. Deep blue-black with gold accents.
- Serif headings for sophistication. Gold primary buttons, dark surfaces.`,
  },
]
