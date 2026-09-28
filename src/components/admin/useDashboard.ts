import { useCallback, useEffect, useRef, useState } from 'react'
import { api, dashboardLiveUrl } from '../../lib/api'
import type { LiveTick, Overview, WorkEvent } from '../../lib/dashboard'

/** The hour the charts show; older samples and events are dropped client-side too. */
const WINDOW_MS = 60 * 60 * 1000
/** The feed keeps this many events; the server's ring is larger, the screen is not. */
const MAX_EVENTS = 500

export type LiveStatus = 'loading' | 'live' | 'reconnecting' | 'offline' | 'error'

/**
 * Fold one tick into what the screen holds.
 *
 * The overview is loaded once — an hour of samples and events — and every tick
 * then REPLACES what is instantaneous (who is here, what is running, the
 * counters) and APPENDS what is a history (the newest sample, the new events).
 * Events are keyed on `seq`: EventSource reconnects with the URL it was opened
 * with, so after a drop the server replays from an older `since`, and the
 * duplicates must fold away rather than double the feed.
 */
export function mergeTick(prev: Overview, tick: LiveTick): Overview {
  const floor = tick.now - WINDOW_MS
  let metrics = prev.metrics
  if (tick.sample && tick.sample.t !== metrics[metrics.length - 1]?.t) {
    metrics = [...metrics, tick.sample].filter((s) => s.t >= floor)
  }
  let events: WorkEvent[] = prev.events
  const lastSeq = events[events.length - 1]?.seq ?? 0
  const fresh = tick.events.filter((e) => e.seq > lastSeq)
  if (fresh.length) events = [...events, ...fresh].filter((e) => e.endedAt >= floor).slice(-MAX_EVENTS)
  return {
    ...prev,
    now: tick.now,
    people: tick.people,
    inflight: tick.inflight,
    counts: tick.counts,
    sample: tick.sample,
    gpu: tick.gpu,
    perMinute: tick.perMinute,
    health: tick.health,
    video: tick.video,
    maintenance: tick.maintenance,
    announcement: tick.announcement,
    metrics,
    events,
    lastSeq: Math.max(prev.lastSeq, tick.lastSeq),
  }
}

/**
 * The dashboard's data: one overview, then a live stream.
 *
 * Server-Sent Events rather than a poll: one open response per admin, a tick
 * every 2 s, and EventSource reconnects on its own after a network blip. What
 * it does NOT survive is a refused reconnect (the session was revoked, the
 * account demoted) — that closes it for good, and the screen says "offline"
 * with a button rather than retrying into a 401 forever.
 */
export function useDashboard() {
  const [data, setData] = useState<Overview | null>(null)
  const [status, setStatus] = useState<LiveStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const seqRef = useRef(0)
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    let stopped = false
    setStatus('loading')
    api.admin.dashboard
      .overview()
      .then((o) => {
        if (stopped) return
        seqRef.current = o.lastSeq
        setData(o)
        setError(null)
        const es = new EventSource(dashboardLiveUrl(o.lastSeq))
        esRef.current = es
        es.addEventListener('tick', (ev) => {
          let tick: LiveTick
          try {
            tick = JSON.parse((ev as MessageEvent).data)
          } catch {
            return
          }
          seqRef.current = Math.max(seqRef.current, tick.lastSeq)
          setData((prev) => (prev ? mergeTick(prev, tick) : prev))
          setStatus('live')
        })
        // The server's way of saying "you are no longer an admin here".
        es.addEventListener('bye', () => {
          es.close()
          setStatus('offline')
        })
        es.onerror = () => {
          setStatus(es.readyState === EventSource.CLOSED ? 'offline' : 'reconnecting')
        }
      })
      .catch((e) => {
        if (stopped) return
        setError(e instanceof Error ? e.message : String(e))
        setStatus('error')
      })
    return () => {
      stopped = true
      esRef.current?.close()
      esRef.current = null
    }
  }, [generation])

  /** Start over: a fresh overview and a fresh stream. */
  const reconnect = useCallback(() => setGeneration((g) => g + 1), [])

  return { data, status, error, reconnect, setData }
}
