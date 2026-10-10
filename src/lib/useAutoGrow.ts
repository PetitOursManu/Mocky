import { useLayoutEffect, type RefObject } from 'react'

/**
 * The height a text field should take to show `content` px of text: at least
 * `min`, at most `max`, and the border on top — `scrollHeight` measures inside
 * it, while the height set on a border-box field includes it. Pure, so the
 * arithmetic is tested apart from a browser.
 */
export function autoGrowHeight(content: number, border: number, min: number, max: number): number {
  return Math.min(Math.max(content + border, min), max)
}

/**
 * A textarea as tall as what is written in it, between `min` and `max` px.
 *
 * The project's composer was one row high with `resize-none`: a brief of three
 * sentences read a line at a time through a slot, behind a scrollbar. Growing
 * with the text shows the whole request up to a ceiling, past which the field
 * scrolls instead of eating the canvas it sits on.
 *
 * Measured on every change of the text and of the field's WIDTH (a narrower
 * window wraps the same words onto more lines). The width is compared with the
 * last one seen, because setting the height is itself a resize the observer
 * reports, and reacting to that would measure forever.
 */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string, min: number, max: number): void {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      el.style.height = 'auto'
      const border = el.offsetHeight - el.clientHeight
      const height = autoGrowHeight(el.scrollHeight, border, min, max)
      el.style.height = `${height}px`
      el.style.overflowY = el.scrollHeight + border > max ? 'auto' : 'hidden'
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    let width = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return
      width = el.clientWidth
      fit()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, value, min, max])
}
