import { useMemo, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

/*
 * The dashboard's charts, drawn by hand in SVG.
 *
 * No chart library: four shapes are needed (a line over time, columns per
 * minute, a meter, a figure), and a library big enough to draw them would be
 * the largest thing in the admin bundle while fighting the house style at every
 * turn — no radius, no shadow, 1px rules, one accent.
 *
 * Every chart is ONE series in the accent. Mocky's shell has a single chromatic
 * colour (Muse wears it too), and the obvious second series colour — the grey
 * ink — measures ΔE 2.9 from the accent under deuteranopia on paper: the two
 * lines would be one line to one reader in twelve. So scopes that belong side
 * by side (Mocky's process, the machine) are two small charts rather than two
 * lines, which is also what keeps each axis honest.
 *
 * The SVG is stretched to its box (`preserveAspectRatio="none"`) with
 * non-scaling strokes, so nothing measures the box — a hidden pane delivers no
 * ResizeObserver callbacks, and a chart that waited for one would stay blank.
 * Anything that must not stretch (text, the end dot, the crosshair) is HTML
 * positioned in percentages on top of it.
 */

const VW = 1000
const VH = 100
/** Room at the top and bottom of the plot so a 100 % line is not drawn on the frame. */
const PAD = 3
/**
 * The shortest span a chart covers. The server keeps an hour, but just after a
 * restart it HAS three minutes, and an hour-wide axis squeezed them into a
 * sliver at the right edge — so the span grows with the data, from ten minutes
 * up to the hour.
 */
const MIN_SPAN_MS = 10 * 60 * 1000

export interface Point {
  t: number
  v: number | null
}

function yOf(v: number, max: number) {
  return VH - PAD - (Math.max(0, Math.min(v, max)) / max) * (VH - 2 * PAD)
}

/** A ceiling that reads well on an axis: 1, 2, 5 × 10^n. */
export function niceCeil(v: number): number {
  if (!(v > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 5, 10]) if (v <= m * p) return m * p
  return 10 * p
}

/**
 * A value over the last hour.
 *
 * `max` fixes the ceiling (100 for a percentage — a chart of CPU that rescales
 * to 3 % makes an idle machine look pinned); without it the ceiling is the data
 * rounded up.
 */
export function TimeChart({
  points,
  now,
  windowMs = 60 * 60 * 1000,
  max,
  format,
  label,
  clock,
  height = 88,
  gapMs = 20_000,
}: {
  points: Point[]
  now: number
  windowMs?: number
  max?: number
  format: (v: number) => string
  /** The accessible name; also the tooltip's subject. */
  label: string
  clock: (t: number) => string
  height?: number
  /** Two samples further apart than this are not joined: the server was down. */
  gapMs?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const oldest = points.length ? points[0].t : now - windowMs
  const span = Math.min(windowMs, Math.max(MIN_SPAN_MS, now - oldest))
  const start = now - span
  const visible = useMemo(() => points.filter((p) => p.t >= start && p.t <= now), [points, start, now])
  const values = visible.map((p) => p.v).filter((v): v is number => v != null)
  const ceiling = max ?? niceCeil(Math.max(0, ...values) * 1.1)
  const xOf = (t: number) => ((t - start) / span) * VW

  const paths = useMemo(() => {
    const segments: Point[][] = []
    let cur: Point[] = []
    let prevT = -Infinity
    for (const p of visible) {
      if (p.v == null || p.t - prevT > gapMs) {
        if (cur.length) segments.push(cur)
        cur = []
      }
      if (p.v != null) cur.push(p)
      prevT = p.t
    }
    if (cur.length) segments.push(cur)
    let line = ''
    let area = ''
    const base = yOf(0, ceiling)
    for (const seg of segments) {
      const pts = seg.map((p) => `${xOf(p.t).toFixed(1)},${yOf(p.v as number, ceiling).toFixed(2)}`)
      line += `M${pts.join('L')}`
      area += `M${xOf(seg[0].t).toFixed(1)},${base}L${pts.join('L')}L${xOf(seg[seg.length - 1].t).toFixed(1)},${base}Z`
    }
    return { line, area }
    // `xOf` reads only `start` and `span`, which are listed.
  }, [visible, ceiling, start, span, gapMs])

  const withValue = visible.filter((p) => p.v != null)
  const last = withValue[withValue.length - 1]
  const shown = hover != null ? withValue[hover] : null
  const peak = values.length ? Math.max(...values) : null

  function nearest(clientX: number, rect: DOMRect) {
    if (!withValue.length) return null
    const t = start + ((clientX - rect.left) / rect.width) * span
    let best = 0
    for (let i = 1; i < withValue.length; i++) {
      if (Math.abs(withValue[i].t - t) < Math.abs(withValue[best].t - t)) best = i
    }
    return best
  }

  function onKey(e: KeyboardEvent) {
    if (!withValue.length) return
    const i = hover ?? withValue.length - 1
    const step = e.shiftKey ? 12 : 1
    let next: number | null = null
    if (e.key === 'ArrowLeft') next = Math.max(0, i - step)
    else if (e.key === 'ArrowRight') next = Math.min(withValue.length - 1, i + step)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = withValue.length - 1
    else if (e.key === 'Escape') {
      setHover(null)
      return
    }
    if (next != null) {
      e.preventDefault()
      setHover(next)
    }
  }

  const pos = (p: Point) => ({ left: `${(xOf(p.t) / VW) * 100}%`, top: `${(yOf(p.v as number, ceiling) / VH) * 100}%` })

  return (
    <div>
      <div
        className="relative cursor-crosshair outline-none focus-visible:ring-1 focus-visible:ring-ring"
        style={{ height }}
        tabIndex={0}
        role="img"
        aria-label={`${label} — ${last ? format(last.v as number) : '—'}${peak != null ? ` · max ${format(peak)}` : ''}`}
        onPointerMove={(e: PointerEvent<HTMLDivElement>) => setHover(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover(withValue.length ? withValue.length - 1 : null)}
        onBlur={() => setHover(null)}
        onKeyDown={onKey}
      >
        <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {[0, 0.5, 1].map((f) => (
            <line
              key={f}
              x1={0}
              x2={VW}
              y1={yOf(ceiling * f, ceiling)}
              y2={yOf(ceiling * f, ceiling)}
              className="stroke-line-soft"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={paths.area} className="fill-accent" fillOpacity={0.1} />
          <path
            d={paths.line}
            className="stroke-accent"
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* The axis in words: the ceiling top-left, zero is the bottom rule. */}
        <span className="pointer-events-none absolute left-0 top-0 -translate-y-1/2 bg-surface pr-1 font-mono text-caption text-ink-faint">
          {format(ceiling)}
        </span>
        {last && !shown && (
          <span
            aria-hidden
            className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-accent ring-2 ring-surface"
            style={pos(last)}
          />
        )}
        {shown && (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0 top-0 w-px bg-ink/40"
              style={{ left: pos(shown).left }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-accent ring-2 ring-surface"
              style={pos(shown)}
            />
            <Tooltip x={(xOf(shown.t) / VW) * 100}>
              <span className="block font-mono text-body-sm font-semibold text-ink">{format(shown.v as number)}</span>
              <span className="block text-caption text-ink-muted">
                {label} · {clock(shown.t)}
              </span>
            </Tooltip>
          </>
        )}
      </div>
      <div className="mt-1 flex justify-between font-mono text-caption text-ink-faint" aria-hidden>
        <span>{clock(start)}</span>
        <span>{clock(start + span / 2)}</span>
        <span>{clock(now)}</span>
      </div>
    </div>
  )
}

/** The floating readout: value first, subject second (see the dataviz rules). */
function Tooltip({ x, children }: { x: number; children: ReactNode }) {
  // Flip to the left of the crosshair past the middle, so it never leaves the card.
  const right = x > 55
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 z-panel whitespace-nowrap border border-line bg-raised px-2 py-1"
      style={right ? { right: `${100 - x}%`, marginRight: 8 } : { left: `${x}%`, marginLeft: 8 }}
    >
      {children}
    </div>
  )
}

/**
 * Counts per minute over the hour, as columns. Used for the overview's total and
 * for each kind of work as a small multiple — same scale inside one set, so the
 * busiest kind is visibly the busiest.
 */
export function MinuteColumns({
  buckets,
  valueOf,
  max,
  label,
  unit,
  clock,
  height = 48,
}: {
  buckets: Array<{ t: number }>
  valueOf: (b: { t: number }) => number
  /** Shared ceiling for small multiples; the series' own peak otherwise. */
  max?: number
  label: string
  /** "3 requêtes" — how a count reads in the tooltip. */
  unit: (n: number) => string
  clock: (t: number) => string
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const values = buckets.map(valueOf)
  const n = Math.max(1, buckets.length)
  const ceiling = Math.max(1, max ?? Math.max(0, ...values))
  const slot = VW / n
  const total = values.reduce((a, b) => a + b, 0)

  function onKey(e: KeyboardEvent) {
    const i = hover ?? n - 1
    if (e.key === 'ArrowLeft') setHover(Math.max(0, i - 1))
    else if (e.key === 'ArrowRight') setHover(Math.min(n - 1, i + 1))
    else if (e.key === 'Escape') setHover(null)
    else return
    e.preventDefault()
  }

  return (
    <div
      className="relative outline-none focus-visible:ring-1 focus-visible:ring-ring"
      style={{ height }}
      tabIndex={0}
      role="img"
      aria-label={`${label} — ${unit(total)}`}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        setHover(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n))))
      }}
      onPointerLeave={() => setHover(null)}
      onFocus={() => setHover(n - 1)}
      onBlur={() => setHover(null)}
      onKeyDown={onKey}
    >
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        <line x1={0} x2={VW} y1={VH - 0.5} y2={VH - 0.5} className="stroke-line-soft" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {values.map((v, i) =>
          v > 0 ? (
            <rect
              key={i}
              // A 20 % gap between columns is the surface doing the separating.
              x={i * slot + slot * 0.1}
              width={slot * 0.8}
              y={VH - (v / ceiling) * (VH - PAD)}
              height={(v / ceiling) * (VH - PAD)}
              className={hover === i ? 'fill-ink' : 'fill-accent'}
            />
          ) : null,
        )}
      </svg>
      {hover != null && buckets[hover] && (
        <Tooltip x={((hover + 0.5) / n) * 100}>
          <span className="block font-mono text-body-sm font-semibold text-ink">{unit(values[hover])}</span>
          <span className="block text-caption text-ink-muted">
            {label} · {clock(buckets[hover].t)}
          </span>
        </Tooltip>
      )}
    </div>
  )
}

/**
 * A share of a limit. The fill carries severity (accent, then warning, then
 * danger) and the words beside it carry the same thing, so it is never colour
 * alone.
 */
export function Meter({
  value,
  label,
  detail,
  warnAt = 75,
  dangerAt = 90,
}: {
  value: number | null
  label: ReactNode
  detail?: ReactNode
  warnAt?: number
  dangerAt?: number
}) {
  const v = value == null ? null : Math.max(0, Math.min(100, value))
  const tone = v == null ? '' : v >= dangerAt ? 'bg-danger' : v >= warnAt ? 'bg-warn' : 'bg-accent'
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body-sm text-ink">{label}</span>
        {detail && <span className="font-mono text-caption text-ink-muted">{detail}</span>}
      </div>
      <div
        className="mt-1 h-1.5 w-full bg-ink/10"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v ?? undefined}
        aria-label={typeof label === 'string' ? label : undefined}
      >
        {v != null && <div className={`h-full ${tone}`} style={{ width: `${v}%` }} />}
      </div>
    </div>
  )
}

/** One headline figure. `tone` marks a figure that needs attention — with words, in `sub`. */
export function Stat({
  label,
  value,
  sub,
  tone,
  onClick,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'warn' | 'danger' | 'ok'
  onClick?: () => void
}) {
  const edge = tone === 'danger' ? 'border-l-danger' : tone === 'warn' ? 'border-l-warn' : tone === 'ok' ? 'border-l-ok' : 'border-l-line-soft'
  const body = (
    <>
      <span className="block text-body-sm text-ink-muted">{label}</span>
      <span className="mt-1 block text-h2 leading-none tabular-nums text-ink">{value}</span>
      {sub && <span className="mt-1.5 block text-caption text-ink-muted">{sub}</span>}
    </>
  )
  const cls = `block w-full border border-line-soft border-l-2 ${edge} bg-surface px-3 py-2.5 text-left`
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} transition hover:bg-ink/5`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}
