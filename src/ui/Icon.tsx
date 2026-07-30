import type { SVGProps } from 'react'

/**
 * Monochrome line icons.
 *
 * The interface was built out of emoji — 🔗 ✂ 📱 ▶ ✨ 📚 🗑 ⬇ 👤 ✎ 💬 ⋯ — and
 * emoji are full-colour bitmaps the theme cannot touch. On a black-and-white
 * editorial shell they read as stickers dropped onto a printed page, and they
 * render differently on every OS (Segoe UI Emoji on Windows, Apple Color Emoji
 * on macOS, Noto elsewhere), so the toolbar was never twice the same.
 *
 * These are drawn with `currentColor`, so they are ink on paper and they follow
 * the theme like everything else. Stroke width 1.5 matches the 1px rules the
 * rest of the design uses; 20px is the default because the emoji they replace
 * were rendering at roughly 12-13px, which was too small to read as an icon.
 */

export type IconName =
  | 'link'
  | 'wand'
  | 'sparkle'
  | 'hand'
  | 'crop'
  | 'phone'
  | 'grid'
  | 'play'
  | 'download'
  | 'upload'
  | 'library'
  | 'trash'
  | 'pencil'
  | 'comment'
  | 'more'
  | 'close'
  | 'check'
  | 'plus'
  | 'chevronLeft'
  | 'chevronRight'
  | 'chevronDown'
  | 'user'
  | 'sun'
  | 'moon'
  | 'settings'
  | 'shield'
  | 'image'
  | 'code'
  | 'copy'
  | 'refresh'
  | 'undo'
  | 'star'
  | 'search'
  | 'warning'
  | 'zoomIn'
  | 'zoomOut'
  | 'fit'
  | 'pin'

/** Path data only — every icon shares the same 24×24 box and stroke settings. */
const PATHS: Record<IconName, string> = {
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  wand: 'M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z',
  hand: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5V4a1.5 1.5 0 0 1 3 0v7m0-1.5a1.5 1.5 0 0 1 3 0V13m-9 0a1.5 1.5 0 0 0-3 0v2a7 7 0 0 0 7 7h1a7 7 0 0 0 7-7v-4',
  crop: 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14',
  phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM10 18h4',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  play: 'M6 4l14 8-14 8V4Z',
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 19h16',
  upload: 'M12 21V9m0 0 4 4M12 9 8 13M4 5h16',
  library: 'M4 4h4v16H4zM10 4h4v16h-4zM17.5 4.6l3.3 15.1',
  trash: 'M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 11v5M14 11v5',
  pencil: 'M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4',
  comment: 'M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  close: 'M5 5l14 14M19 5 5 19',
  check: 'M4 12l5 6L20 5',
  plus: 'M12 4v16M4 12h16',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  chevronDown: 'M5 9l7 7 7-7',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z',
  shield: 'M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5l8-3Z',
  image: 'M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6',
  code: 'M9 18l-6-6 6-6M15 6l6 6-6 6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  refresh: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5',
  undo: 'M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5',
  star: 'M12 3l2.7 5.9 6.3.7-4.7 4.3 1.3 6.1L12 17l-5.6 3 1.3-6.1L3 9.6l6.3-.7L12 3Z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  warning: 'M12 3 1.8 21h20.4L12 3ZM12 10v5M12 18h.01',
  zoomIn: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3M11 8v6M8 11h6',
  zoomOut: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3M8 11h6',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  pin: 'M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z',
}

/** Icons whose shape reads better filled than stroked. */
const FILLED = new Set<IconName>(['play'])

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  /** Edge length in px. 20 by default — the emoji it replaces rendered near 12. */
  size?: number
}

export function Icon({ name, size = 20, className = '', ...rest }: IconProps) {
  const filled = FILLED.has(name)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorative by default: the accessible name belongs on the button that
      // wraps it, not on the glyph. IconButton enforces that.
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
