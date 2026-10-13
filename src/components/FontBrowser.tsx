import { useEffect, useMemo, useRef, useState } from 'react'
import { Input, Modal, Segmented } from '../ui'
import { useT } from '../i18n'
import {
  FONT_CATEGORIES,
  FONT_FAMILIES,
  registerSpecimens,
  specimenStack,
  type FontCategory,
  type FontFamily,
} from '../lib/fonts'

/**
 * The typefaces a screen can use, each set in its own face.
 *
 * A list of names is not a choice anybody can make — "Fraunces" and "Gloock"
 * mean nothing until they are seen — and the model is told the same names
 * (lib/fonts, FONTS_PROMPT), so what a person picks here is what a request can
 * ask for by name. Read-only on purpose: a typeface belongs to a direction or
 * to a request, both of which already exist, and a third place to set one
 * would be a third place for them to disagree.
 */
export default function FontBrowser({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FontCategory | 'all'>('all')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return FONT_FAMILIES.filter(
      (f) => (category === 'all' || f.category === category) && (!q || f.family.toLowerCase().includes(q)),
    )
  }, [query, category])

  // CSS for every family, once: a browser downloads a face only when text is
  // SET in it, and each row sets its text only once it is on screen (below).
  useEffect(() => registerSpecimens(FONT_FAMILIES), [])

  return (
    <Modal title={t('fonts.title')} onClose={onClose} size="lg">
      <p className="measure text-body-sm text-ink-muted">{t('fonts.intro', { n: FONT_FAMILIES.length })}</p>
      <div className="mt-4 flex flex-col gap-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('fonts.search')}
          aria-label={t('fonts.search')}
        />
        <div className="overflow-x-auto">
          <Segmented
            label={t('fonts.title')}
            value={category}
            onChange={(v) => setCategory(v ?? 'all')}
            options={[
              { value: 'all' as const, label: t('fonts.all') },
              ...FONT_CATEGORIES.map((c) => ({ value: c, label: t(`fonts.cat.${c}`) })),
            ]}
          />
        </div>
        <p className="font-mono text-caption text-ink-faint" aria-live="polite">
          {t('fonts.count', { n: shown.length })}
        </p>
      </div>
      <ul className="mt-2 max-h-[60vh] divide-y divide-line-soft overflow-y-auto border-y border-line-soft">
        {shown.map((f) => (
          <Specimen key={f.id} font={f} />
        ))}
        {!shown.length && <li className="py-6 text-body-sm text-ink-muted">{t('fonts.none')}</li>}
      </ul>
    </Modal>
  )
}

/**
 * One family. The sample is set in the face only once the row has been
 * scrolled into view: two hundred rows set at once would be two hundred
 * downloads for a dialog somebody opened to look at four.
 */
function Specimen({ font }: { font: FontFamily }) {
  const t = useT()
  const ref = useRef<HTMLLIElement>(null)
  const [seen, setSeen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSeen(true)
        io.disconnect()
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])

  const copy = () => {
    navigator.clipboard?.writeText(font.family).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      },
      () => {},
    )
  }

  return (
    <li ref={ref} className="flex items-baseline gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-h3 leading-tight text-ink"
          style={seen ? { fontFamily: specimenStack(font) } : undefined}
          title={font.family}
        >
          {font.family}
        </p>
        <p
          className="truncate text-body text-ink-muted"
          style={seen ? { fontFamily: specimenStack(font) } : undefined}
        >
          {t('fonts.sample')}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-caption text-ink-faint">{t(`fonts.cat.${font.category}`)}</p>
        <p className="font-mono text-caption text-ink-faint">{t('fonts.licence', { licence: font.license })}</p>
        <button type="button" onClick={copy} className="mt-1 font-mono text-caption text-ink underline-offset-2 hover:underline">
          {copied ? t('fonts.copied') : t('fonts.copy')}
        </button>
      </div>
    </li>
  )
}
