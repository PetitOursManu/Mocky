/** @type {import('tailwindcss').Config} */

// Loaded by `@config` in src/index.css: Tailwind 4 still reads a JS config, and
// keeping it means the scales below stay where the design system says they
// are. The files it scans are the `@source` lines next to that `@config`, and
// the default transition duration is in the `@theme` block there — v4 ignores
// both keys here.

// Semantic colours, wired to the CSS variables in src/styles/tokens.css.
// The `<alpha-value>` placeholder is what keeps `bg-surface/60` working — which
// is why the variables hold bare RGB channels rather than finished colours.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  theme: {
    // ---- overridden wholesale, not extended -------------------------------
    // Replacing these scales rather than adding to them means the ~200 existing
    // `rounded-*` / `shadow-*` usages resolve to the geometry of the reference
    // (plans/refonte/modele-dark-glitch.html) on their own. The previous,
    // editorial direction set every step to zero; the components kept their
    // classes, which is why turning the radius back on needed no rewrite.

    borderRadius: {
      none: '0',
      sm: '4px', // a thumbnail, a swatch
      DEFAULT: '6px', // an icon button
      md: '7px', // a button, a field, a chip
      lg: '9px', // a menu, the prompt
      xl: '10px', // the floating toolbar
      '2xl': '12px', // a modal
      '3xl': '16px',
      full: '9999px',
    },

    // Elevation is read from value first; a shadow only lifts what FLOATS —
    // menus, the floating toolbar, modals. Its colour and strength are tokens,
    // because a shadow tuned for a black canvas is a smudge on a white one.
    boxShadow: {
      none: 'none',
      sm: '0 1px 2px rgb(var(--shadow) / calc(0.3 * var(--shadow-k)))',
      DEFAULT: '0 7px 22px rgb(var(--shadow) / calc(0.33 * var(--shadow-k)))',
      md: '0 7px 22px rgb(var(--shadow) / calc(0.33 * var(--shadow-k)))',
      lg: '0 12px 42px rgb(var(--shadow) / calc(0.56 * var(--shadow-k)))',
      xl: '0 12px 42px rgb(var(--shadow) / calc(0.56 * var(--shadow-k)))',
      '2xl': '0 18px 70px rgb(var(--shadow) / calc(0.6 * var(--shadow-k)))',
      inner: 'inset 0 1px 2px rgb(var(--shadow) / calc(0.3 * var(--shadow-k)))',
      // A frame on the canvas: a hairline so it reads as an object, and a soft
      // drop so it sits ON the board. Shallower than `2xl` on purpose — the
      // canvas can hold dozens of frames, and the blur is painted per frame.
      frame:
        '0 0 0 1px rgb(var(--ink) / 0.13), 0 10px 32px rgb(var(--shadow) / calc(0.5 * var(--shadow-k)))',
    },

    fontSize: {
      // Six steps, and nothing between them. The product used to be 12px or
      // smaller everywhere outside twelve headings — 134 `text-xs` against 64
      // arbitrary sizes below it (`text-[11px]`, `[10px]`, `[9px]`, `[8px]`).
      caption: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }], // 11px — badges only
      'body-sm': ['0.8125rem', { lineHeight: '1.15rem' }], // 13px — controls, toolbar
      body: ['0.875rem', { lineHeight: '1.4rem' }], // 14px — the default
      lead: ['1rem', { lineHeight: '1.55rem' }], // 16px — prompt field, intros
      h3: ['1.25rem', { lineHeight: '1.6rem', letterSpacing: '-0.015em' }], // 20px
      h2: ['1.75rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }], // 28px
      display: ['2.75rem', { lineHeight: '2.9rem', letterSpacing: '-0.035em' }], // 44px
      // Tailwind's own names, kept so nothing breaks mid-migration.
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      lg: ['1.125rem', { lineHeight: '1.75rem' }],
      xl: ['1.25rem', { lineHeight: '1.75rem' }],
      '2xl': ['1.5rem', { lineHeight: '2rem' }],
      '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    },

    extend: {
      colors: {
        sunken: token('sunken'),
        surface: token('surface'),
        raised: token('raised'),
        line: token('line'),
        'line-soft': token('line-soft'),
        ink: token('ink'),
        'ink-muted': token('ink-muted'),
        'ink-faint': token('ink-faint'),
        accent: token('accent'),
        // Small text in the accent colour. Same hue, a hair darker on paper so
        // it clears 4.5:1 — use it for links and labels, `accent` for fills.
        'accent-ink': token('accent-ink'),
        'accent-wash': token('accent-wash'),
        'on-accent': token('on-accent'),
        danger: token('danger'),
        'on-danger': token('on-danger'),
        warn: token('warn'),
        ok: token('ok'),
        muse: token('muse'),
        'muse-ink': token('muse-ink'),
        ring: token('ring'),
        // The edge of a form field — the one rule held to 3:1.
        field: token('field'),
        // The active state: a tinted ground and the accent on it.
        selected: token('selected'),
        'on-selected': token('on-selected'),
      },

      fontFamily: {
        sans: [
          'Inter var',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        // No longer the headline face (headlines are in the sans since the
        // redesign); kept for the few specimens that show a serif on purpose.
        // No webfont: a stack of faces that ship with Windows and macOS.
        serif: [
          'Iowan Old Style',
          'Palatino Linotype',
          'Palatino',
          'Book Antiqua',
          'Georgia',
          'Times New Roman',
          'ui-serif',
          'serif',
        ],
        // Numbers that change under the eye — zoom level, frame dimensions,
        // hashes — belong in a monospace so they stop reflowing as they update.
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },

      // One ladder instead of the seven ad-hoc values in use, two of which put a
      // panel exactly on top of another with no way to tell which would win.
      zIndex: {
        panel: '20',
        menu: '30',
        overlay: '40',
        modal: '50',
        top: '60',
      },

      borderWidth: {
        DEFAULT: '1px',
      },
    },
  },
  plugins: [],
}
