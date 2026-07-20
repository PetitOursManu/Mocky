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
  {
    id: 'constructivism',
    name: 'Constructivism',
    description: 'Geometry, asymmetry, motion',
    swatches: ['#1a1a1a', '#ffffff', '#dc2626', '#fbbf24'],
    preview: { bg: '#1a1a1a', cardBg: '#2a2a2a', cardBorder: '#dc2626', text: '#ffffff', mutedText: '#a3a3a3', accent: '#dc2626', accentText: '#ffffff', radius: '0px' },
    markdown: `# Design System — Constructivism

## Color tokens
- Background: #1a1a1a (near-black)
- Surface: #2a2a2a
- Text: #ffffff
- Muted text: #a3a3a3
- Primary: #dc2626 (red-600)
- Accent: #fbbf24 (amber-400)
- Border: #404040

## Typography
- Font: Helvetica / Arial, bold sans-serif
- Headings: heavy, tight, left-aligned, sans-serif
- Body: 14px, clean

## Spacing & radius
- Sharp corners (rounded-none). No rounded shapes.
- Asymmetric layouts: elements aligned to one side, offset blocks.
- Use diagonal lines and geometric shapes (triangles, rectangles).

## Component patterns
- Functional, geometry-driven, energetic. Asymmetrical layouts convey motion.
- Red and black dominate. Yellow accents for emphasis.
- Collages: black-and-white photo cutouts over bold backgrounds.
- No decorative flourishes. Every element serves a purpose.`,
  },
  {
    id: 'swiss',
    name: 'Swiss Style',
    description: 'Grid, Helvetica, clarity',
    swatches: ['#ffffff', '#000000', '#ef4444', '#f3f4f6'],
    preview: { bg: '#ffffff', cardBg: '#f3f4f6', cardBorder: '#d1d5db', text: '#000000', mutedText: '#6b7280', accent: '#ef4444', accentText: '#ffffff', radius: '0px' },
    markdown: `# Design System — Swiss Style

## Color tokens
- Background: #ffffff
- Surface: #f3f4f6
- Text: #000000
- Muted text: #6b7280
- Primary: #ef4444 (red-500)
- Border: #d1d5db

## Typography
- Font: Helvetica, Univers, or Akzidenz-Grotesk
- Headings: large, bold, sans-serif. Strong size contrast.
- Body: 14–15px, clean sans-serif

## Spacing & radius
- Strict modular grid. Everything aligns.
- Sharp corners (rounded-none or rounded-sm).
- Generous gutters and margins.

## Component patterns
- Clarity, functionality, understated elegance.
- Strong modular grid. Typography is king — large headings, small body.
- Minimal decoration. Color photography used sparingly for emphasis.
- Red accent on otherwise monochrome. Poster-inspired composition.`,
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Magazine layout, serif headlines',
    swatches: ['#faf9f6', '#1a1a1a', '#9333ea', '#e5e7eb'],
    preview: { bg: '#faf9f6', cardBg: '#ffffff', cardBorder: '#e5e7eb', text: '#1a1a1a', mutedText: '#6b7280', accent: '#9333ea', accentText: '#ffffff', radius: '0px' },
    markdown: `# Design System — Editorial

## Color tokens
- Background: #faf9f6 (warm off-white)
- Surface: #ffffff
- Text: #1a1a1a
- Muted text: #6b7280
- Primary: #9333ea (purple-600)
- Accent: #ec4899 (pink-500)
- Border: #e5e7eb

## Typography
- Headings: large decorative serif (Playfair Display, Cormorant, DM Serif)
- Body: small legible sans-serif (Inter, 14–15px)
- Strong contrast between heading and body sizes

## Spacing & radius
- Magazine-spread composition. Multilayer layouts.
- Minimal radius. Thin borders and dividing lines.
- Generous whitespace around visual content.

## Component patterns
- Inspired by Vogue, GQ, Harper's Bazaar. Print magazine on the web.
- Large bold visuals and photography dominate.
- Decorative elements: lines, frames, pull quotes in large type.
- Serif headlines overlaid on images or in dedicated blocks.`,
  },
  {
    id: 'hand-drawn',
    name: 'Hand-Drawn',
    description: 'Sketchy, casual, imperfect',
    swatches: ['#fefce8', '#3f3f46', '#f59e0b', '#84cc16'],
    preview: { bg: '#fefce8', cardBg: '#fffbeb', cardBorder: '#d4d4d8', text: '#3f3f46', mutedText: '#71717a', accent: '#f59e0b', accentText: '#3f3f46', radius: '20px' },
    markdown: `# Design System — Hand-Drawn

## Color tokens
- Background: #fefce8 (warm yellow-cream)
- Surface: #fffbeb
- Text: #3f3f46 (dark gray)
- Muted text: #71717a
- Primary: #f59e0b (amber-500)
- Accent: #84cc16 (lime-500)
- Border: #d4d4d8 (dashed or rough)

## Typography
- Headings: handwritten or script fonts (Caveat, Patrick Hand, Kalam)
- Body: simple sans-serif, 15px
- Use decorative fonts sparingly for charm, never in body copy

## Spacing & radius
- Loose, intentionally imperfect alignment. No strict grids.
- Rounded organic shapes. Dashed borders, rough edges.
- Scribbles, doodles, and sketchy accents throughout.

## Component patterns
- Casual, friendly, handmade. Imperfection is the point.
- Hand-lettered headings, rough-cut photos with bright outlines.
- Forget precise alignment — start with a grid, then shift things around.
- Illustrated icons, sketchy shapes, brush strokes.`,
  },
  {
    id: 'retro',
    name: 'Retro',
    description: 'Vintage, grainy, nostalgic',
    swatches: ['#2d1b00', '#fef3c7', '#f97316', '#06b6d4'],
    preview: { bg: '#2d1b00', cardBg: '#3d2b10', cardBorder: '#6b4d20', text: '#fef3c7', mutedText: '#d4a574', accent: '#f97316', accentText: '#2d1b00', radius: '8px' },
    markdown: `# Design System — Retro

## Color tokens
- Background: #2d1b00 (dark brown)
- Surface: #3d2b10
- Text: #fef3c7 (warm cream)
- Muted text: #d4a574
- Primary: #f97316 (orange-500)
- Accent: #06b6d4 (cyan-500)
- Border: #6b4d20

## Typography
- Font: retro-inspired sans (Bebas Neue, Press Start 2P, VT323)
- Headings: bold, slightly muted colors, vintage feel
- Body: 14px, readable

## Spacing & radius
- Rounded buttons with drop shadows (tactile, physical feel).
- Grainy textures, noise overlays, wear-and-tear effects.
- Slightly muted shades to mimic old displays.

## Component patterns
- Vintage vibes, bold colors, nostalgic typography.
- Grain/noise textures. Buttons with drop shadows echoing old-school tech.
- Warm palette: orange, yellow, turquoise, pink, brown.
- References to '80s and '90s: arcade, CRT, cassette, neon.`,
  },
  {
    id: 'flat',
    name: 'Flat',
    description: 'No shadows, pastel, clean',
    swatches: ['#fafafa', '#1f2937', '#3b82f6', '#f3f4f6'],
    preview: { bg: '#fafafa', cardBg: '#ffffff', cardBorder: '#e5e7eb', text: '#1f2937', mutedText: '#6b7280', accent: '#3b82f6', accentText: '#ffffff', radius: '8px' },
    markdown: `# Design System — Flat

## Color tokens
- Background: #fafafa
- Surface: #ffffff
- Text: #1f2937
- Muted text: #6b7280
- Primary: #3b82f6 (blue-500)
- Accent: #10b981 (emerald-500)
- Border: #e5e7eb

## Typography
- Font: Roboto, Open Sans, or Inter — clean sans-serif
- Headings: bold, clear hierarchy, no decorative elements
- Body: 15px, highly readable

## Spacing & radius
- Basic geometric shapes. No 3D, shadows, gloss, or bevels.
- Small radius (rounded-md). Solid colors only, no gradients.
- Clean blocks with clear headings and subheadings.

## Component patterns
- Simplicity and clarity above all. No depth effects.
- Solid pastel and bold colors. Accent colors used sparingly.
- Clean sans-serif typography. Content in digestible blocks.
- Minimal animation. Function over form.`,
  },
  {
    id: 'bento',
    name: 'Bento',
    description: 'Tidy tiles, modular, dense',
    swatches: ['#0f0f0f', '#ffffff', '#a78bfa', '#f9a8d4'],
    preview: { bg: '#0f0f0f', cardBg: '#1a1a1a', cardBorder: '#333333', text: '#ffffff', mutedText: '#a3a3a3', accent: '#a78bfa', accentText: '#0f0f0f', radius: '16px' },
    markdown: `# Design System — Bento

## Color tokens
- Background: #0f0f0f (near-black)
- Surface: #1a1a1a (dark tile)
- Text: #ffffff
- Muted text: #a3a3a3
- Primary: #a78bfa (violet-400)
- Accent: #f9a8d4 (pink-300)
- Border: #333333

## Typography
- Font: Inter / DM Sans, clean sans-serif
- Headings: medium weight, clear
- Body: 14px, minimal decorative touches

## Spacing & radius
- Rectangular content cells with softly rounded corners (rounded-2xl).
- Very little empty space — everything fits neatly.
- Small gaps between tiles (gap-2 to gap-4).

## Component patterns
- Inspired by Japanese bento boxes. Each content piece in its own container.
- Grid of tiles with rounded corners, minimal whitespace.
- Soft or muted colors. Small illustrations or charts to enrich.
- Popular in dashboards, e-commerce, and dense content layouts.`,
  },
]

// --- Light / dark variants -------------------------------------------------
// Each preset ships in its natural mode. `presetVariant` derives the opposite
// mode on demand: it swaps the neutral colors (background/surface/text/…) to
// the other family while KEEPING the accent + component character, and appends
// a "Theme mode" directive so generation honors it too. Derived variants are
// sensible starting points, not hand-tuned per style.

export type ThemeMode = 'auto' | 'light' | 'dark'

const DARK_NEUTRALS = { bg: '#0b1020', cardBg: '#131a2e', cardBorder: '#1e293b', text: '#e6e9f0', mutedText: '#94a3b8' }
const LIGHT_NEUTRALS = { bg: '#ffffff', cardBg: '#f8fafc', cardBorder: '#e2e8f0', text: '#0f172a', mutedText: '#64748b' }

/** Relative luminance (0..1) of a #rgb/#rrggbb color. */
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const full = (h.length === 3 ? h.split('').map((c) => c + c).join('') : h).slice(0, 6).padEnd(6, '0')
  const chan = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2]
}

/** True if a color is dark enough to want light text on it. */
export function isDarkColor(hex: string): boolean {
  return luminance(hex) < 0.5
}

/** A readable foreground (#0f172a on light colors, white on dark). */
function readableOn(hex: string): string {
  return luminance(hex) > 0.5 ? '#0f172a' : '#ffffff'
}

/** Replace the neutral color-token lines in a DESIGN.md; leaves accents intact. */
function flipMarkdownTokens(md: string, dark: boolean): string {
  const N = dark ? DARK_NEUTRALS : LIGHT_NEUTRALS
  const rules: Array<[RegExp, string]> = [
    [/(^\s*[-*]\s*background\s*:\s*)#[0-9a-fA-F]{3,8}/im, '$1' + N.bg],
    [/(^\s*[-*]\s*surface\s*:\s*)#[0-9a-fA-F]{3,8}/im, '$1' + N.cardBg],
    [/(^\s*[-*]\s*text\s*:\s*)#[0-9a-fA-F]{3,8}/im, '$1' + N.text],
    [/(^\s*[-*]\s*muted text\s*:\s*)#[0-9a-fA-F]{3,8}/im, '$1' + N.mutedText],
    [/(^\s*[-*]\s*border\s*:\s*)#[0-9a-fA-F]{3,8}/im, '$1' + N.cardBorder],
  ]
  let out = md
  for (const [re, rep] of rules) out = out.replace(re, rep)
  return out
}

/**
 * Return a preset in the requested mode. 'auto' (or the mode a preset already
 * is) returns it unchanged; otherwise the opposite variant is derived. Never
 * throws.
 */
export function presetVariant(
  preset: StylePreset,
  mode: ThemeMode,
): { preview: StylePreset['preview']; markdown: string } {
  const naturalDark = isDarkColor(preset.preview.bg)
  const dark = mode === 'auto' ? naturalDark : mode === 'dark'
  if (dark === naturalDark) return { preview: preset.preview, markdown: preset.markdown }

  const N = dark ? DARK_NEUTRALS : LIGHT_NEUTRALS
  const preview: StylePreset['preview'] = {
    ...preset.preview,
    bg: N.bg,
    cardBg: N.cardBg,
    cardBorder: N.cardBorder,
    text: N.text,
    mutedText: N.mutedText,
    accentText: readableOn(preset.preview.accent),
  }
  const word = dark ? 'DARK' : 'LIGHT'
  const directive =
    `\n\n## Theme mode\n- Render this design in ${word} mode: ${dark ? 'dark backgrounds, light text' : 'light backgrounds, dark text'}. ` +
    'Keep the accent color and the component style; only the neutral background/surface/text colors change.'
  const markdown =
    flipMarkdownTokens(preset.markdown, dark).replace(/^(#\s.*)$/m, `$1 (${dark ? 'Dark' : 'Light'})`) + directive
  return { preview, markdown }
}
