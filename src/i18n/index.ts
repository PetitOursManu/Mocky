import { useCallback, useEffect, useState } from 'react'
import { fr } from './fr'
import { en } from './en'
import { partsFr, partsEn } from './parts'

/**
 * A very small i18n layer.
 *
 * Mocky's interface was bilingual *inside single components*: the same row of
 * buttons on the canvas read "Rename", "Voir le prompt qui a créé cet écran",
 * "More options (or right-click the screen)", "Delete screen". Five components
 * were French, twelve English, two mixed — and `index.html` declared
 * `lang="en"`, so a screen reader pronounced the French with English phonetics.
 *
 * ~400 strings does not justify i18next. This is a flat dictionary, a hook, and
 * a `lang` attribute kept in sync. French is the default because the newest and
 * best-documented screens (Muse, Bibliothèque, providers) were written in it.
 */

export type Lang = 'fr' | 'en'

/**
 * Keys come from two places: the core dictionary (fr.ts / en.ts) and the
 * per-area files under `parts/`. Areas exist so that several components can gain
 * translations at once without everyone editing one enormous shared file.
 *
 * The core file is still the source of truth for the CORE keys; area keys are
 * plain strings, checked for FR/EN parity by a test rather than by the compiler.
 */
export type TranslationKey = keyof typeof fr | (string & {})
export type Dict = Record<string, string>

const DICTS: Record<Lang, Dict> = {
  fr: { ...partsFr, ...fr },
  en: { ...partsEn, ...en },
}

const KEY = 'mocky.lang'

export function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'fr' || stored === 'en') return stored
  } catch {
    /* storage unavailable */
  }
  try {
    // Anything that isn't clearly English gets French, the default.
    return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'fr'
  } catch {
    return 'fr'
  }
}

let current: Lang = 'fr'
const listeners = new Set<(l: Lang) => void>()

export function getLang(): Lang {
  return current
}

export function setLang(l: Lang): void {
  current = l
  try {
    localStorage.setItem(KEY, l)
  } catch {
    /* ignore */
  }
  // Screen readers and hyphenation both depend on this being right.
  document.documentElement.lang = l
  for (const cb of listeners) cb(l)
}

/** Applied before render so the first paint is already in the right language. */
export function initLang(): Lang {
  const l = detectLang()
  current = l
  document.documentElement.lang = l
  return l
}

/**
 * Translate. Interpolates `{name}` placeholders.
 *
 * A missing key returns the key itself rather than an empty string: a visible
 * `project.delete` in the UI is a bug report, an empty button is a mystery.
 */
export function translate(lang: Lang, key: TranslationKey, vars?: Record<string, string | number>): string {
  const table = DICTS[lang] ?? fr
  const raw = (table as Record<string, string>)[key] ?? (fr as Record<string, string>)[key] ?? String(key)
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m))
}

/** `const t = useT()` → `t('nav.home')`. Re-renders when the language changes. */
export function useT() {
  const [lang, setLangState] = useState<Lang>(current)

  useEffect(() => {
    const cb = (l: Lang) => setLangState(l)
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  }, [])

  return useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  )
}

/** The current language, for components that need to branch on it. */
export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(current)
  useEffect(() => {
    const cb = (l: Lang) => setLangState(l)
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  }, [])
  return [lang, setLang]
}

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
]
