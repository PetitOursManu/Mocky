import { useEffect, useState } from 'react'

/**
 * True on a phone: a coarse pointer AND a narrow viewport, both required.
 *
 * The two halves guard different mistakes. Width alone matches a narrowed
 * desktop window, where the canvas is perfectly usable with a mouse and taking
 * it away would be a regression for a developer with a split screen. A coarse
 * pointer alone matches a tablet and a touch laptop, where 768px of width is
 * enough for the canvas to be legible — and legibility, not input, is what
 * decides this: `fitAll` puts one 1440x900 screen at 0.16 on a phone, which
 * renders 14px type at 2.2px. No gesture fixes that arithmetic; only a
 * different viewport does.
 *
 * `matchMedia` and not a resize listener: the browser already evaluates this
 * and tells us when it changes, including on rotation, which a width-only
 * `resize` handler is famously bad at on iOS.
 */
const QUERY = '(pointer: coarse) and (max-width: 767px)'

export function usePhone(): boolean {
  const [phone, setPhone] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(QUERY).matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(QUERY)
    const onChange = () => setPhone(mq.matches)
    mq.addEventListener('change', onChange)
    // Re-read on mount: the query can have changed between the initial state
    // and the effect, and on a rotation during load it usually has.
    onChange()
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return phone
}
