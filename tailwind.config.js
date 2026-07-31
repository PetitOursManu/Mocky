/** @type {import('tailwindcss').Config} */

// Semantic colours, wired to the CSS variables in src/styles/tokens.css.
// The `<alpha-value>` placeholder is what keeps `bg-surface/60` working — which
// is why the variables hold bare RGB channels rather than finished colours.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // ---- overridden wholesale, not extended -------------------------------
    // The direction is editorial: 1px rules, no radius, no shadow. Replacing
    // these scales rather than adding to them means the ~100 existing
    // `rounded-lg` / `shadow-xl` usages resolve to the new geometry on their
    // own, instead of needing a rewrite before anything can be seen.

    borderRadius: {
      none: '0',
      DEFAULT: '0',
      sm: '0',
      md: '0',
      lg: '0',
      xl: '0',
      '2xl': '0',
      '3xl': '0',
      // The one exception: dots, avatars and status pills are meant to be round.
      full: '9999px',
    },

    boxShadow: {
      none: 'none',
      DEFAULT: 'none',
      sm: 'none',
      md: 'none',
      lg: 'none',
      xl: 'none',
      '2xl': 'none',
      inner: 'none',
      // Frames on the canvas are the one place where an object must read as
      // sitting *on* the board. A hairline offset, not a glow.
      frame: '0 0 0 1px rgb(var(--line) / 0.9)',
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
        // Headlines are set in a serif — this is what makes the difference
        // between "monochrome app" and "printed page". No webfont: previews must
        // work offline and under a strict CSP, so this is a stack of faces that
        // ship with Windows and macOS. Georgia is the workhorse on Windows,
        // Iowan/Palatino the nicer ones on macOS.
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
        // The editorial rule. There is no 2px.
        DEFAULT: '1px',
      },

      transitionDuration: {
        DEFAULT: '120ms',
      },
    },
  },
  plugins: [],
}
