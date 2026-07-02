export type Theme = 'dark' | 'light' | 'logo'

export const THEMES: { id: Theme; label: string; icon: string }[] = [
  { id: 'dark', label: 'Dark', icon: '☾' },
  { id: 'light', label: 'Beige', icon: '☀' },
  { id: 'logo', label: 'Mocky', icon: '◆' },
]

const KEY = 'mocky.theme'

export function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'logo' ? v : 'dark'
  } catch {
    return 'dark'
  }
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
  const order: Theme[] = ['dark', 'light', 'logo']
  return order[(order.indexOf(t) + 1) % order.length]
}
