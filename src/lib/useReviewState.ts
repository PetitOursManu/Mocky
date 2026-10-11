import { useCallback, useEffect, useState } from 'react'
import { reviewStatuses, type ProjectReviewState } from './review'

/**
 * Every project's approval status, kept fresh while the page is open.
 *
 * The client answers on THEIR schedule, from a page that is not this one, so
 * the status has to be asked for: on mount, when the tab comes back into view,
 * and once a minute. The answer is one small object for all projects at once
 * (`GET /api/reviews/status`), never the comments. A failure leaves the last
 * answer in place — a badge that is a minute old is better than one that
 * blinks out whenever the network does.
 */
export function useReviewState(enabled = true) {
  const [states, setStates] = useState<Record<string, ProjectReviewState>>({})

  const refresh = useCallback(async () => {
    try {
      setStates(await reviewStatuses())
    } catch {
      /* not signed in, or offline: keep what we had */
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const id = window.setInterval(() => void refresh(), 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, refresh])

  return { states, refresh }
}
