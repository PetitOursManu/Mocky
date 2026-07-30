/**
 * Two themes, both first-class.
 *
 * There used to be three — `dark`, `light` (beige) and `logo` (teal) — and they
 * disagreed with each other: `logo` remapped indigo to teal while `light` did
 * not, so the same primary button was teal in one and indigo in the other. The
 * beige (#e9e0cd) was also a poor canvas for a design tool: warm and saturated
 * enough to tint every mockup laid on it.
 *
 * Now: paper and ink. Both are defined by the same tokens (src/styles/tokens.css),
 * so neither is an afterthought patched on top of the other.
 */
export type Theme = 'light' | 'dark'

export const THEMES: { id: Theme; label: string; icon: string }[] = [
  { id: 'light', label: 'Papier', icon: '☀' },
  { id: 'dark', label: 'Encre', icon: '☾' },
]

const KEY = 'mocky.theme'

/** The OS preference, used when nothing has been chosen yet. */
function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
    // 'logo' and the old beige 'light' both map onto the new light theme.
    if (v === 'logo') return 'light'
  } catch {
    /* storage unavailable */
  }
  return systemTheme()
}

export function applyTheme(t: Theme): void {
  document.documentElement.dataset.theme = t
}

export function saveTheme(t: Theme): void {
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* ignore */
  }
  applyTheme(t)
}

export function nextTheme(t: Theme): Theme {
  return t === 'light' ? 'dark' : 'light'
}
