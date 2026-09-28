/**
 * What the admin dashboard receives — the shapes of server/admin/routes.js.
 *
 * Types only, no import: api.ts imports this file for its method signatures,
 * and the dashboard's own hook imports api.ts; a value import in either
 * direction would make a cycle.
 */

/** The kinds of work, in display order. Mirrors KINDS in server/admin/activity.js. */
export const WORK_KINDS = ['mocky', 'muse', 'image', 'stock', 'clip', 'film'] as const
export type WorkKind = (typeof WORK_KINDS)[number]

export type PresenceState = 'active' | 'idle' | 'offline'

export interface GpuDevice {
  vendor: string
  name: string
  util: number | null
  memUsed: number | null
  memTotal: number | null
  temp: number | null
  power: number | null
  powerLimit: number | null
}

export interface GpuState {
  /** ok: a utilisation figure exists · unmeasurable: a card, silent · absent: none. */
  status: 'ok' | 'unmeasurable' | 'absent'
  source: string | null
  devices: GpuDevice[]
  /** 'nvidia-smi-missing' | 'nvidia-smi-failed' | 'no-counter' | null */
  hint: string | null
}

export interface MetricSample {
  t: number
  process: { cpu: number | null; rss: number; heapUsed: number; heapTotal: number }
  host: { cpu: number | null; memUsed: number; memTotal: number; load1: number | null }
  container: { cpu: number | null; memUsed: number | null; memLimit: number | null; cpuLimit: number | null } | null
  loop: { p99: number; max: number }
  disk: { free: number; total: number } | null
  gpu: Array<{ util: number | null; memUsed: number | null; memTotal: number | null; temp: number | null }> | null
}

export interface SystemInfo {
  node: string
  platform: string
  arch: string
  pid: number
  cpuModel: string | null
  cpuCount: number
  cores: number
  memTotal: number
  container: boolean
  cgroup: 1 | 2 | null
  cpuLimit: number | null
  memLimit: number | null
  startedAt: number
  hostUptime: number
  intervalMs: number
  gpu: GpuState | null
}

export interface Person {
  id: string
  username: string
  role: 'admin' | 'user'
  state: PresenceState
  /** Where the visible tab is: 'home' | 'project' | 'design' | 'media' | 'settings' | 'admin'. */
  area: string | null
  tabs: number
  lastSeen: number | null
  working: Array<{ kind: WorkKind; action: string; startedAt: number }>
  lastHour: Record<WorkKind, number>
}

export interface Work {
  id: number
  userId: string
  username: string | null
  kind: WorkKind
  action: string
  provider: string
  source: 'instance' | 'browser'
  startedAt: number
}

export type Outcome = 'ok' | 'aborted' | 'rate-limited' | 'refused' | 'timeout' | 'unavailable' | 'invalid' | 'failed'

export interface WorkEvent extends Omit<Work, 'id'> {
  seq: number
  endedAt: number
  ms: number
  ttfb: number | null
  status: number
  outcome: Outcome
}

export interface HealthRow {
  kind: WorkKind
  provider: string
  source: 'instance' | 'browser'
  count: number
  ok: number
  aborted: number
  /** Refused as malformed (4xx): shown, never counted as a failure. */
  invalid: number
  errors: number
  errorRate: number | null
  p50: number | null
  p95: number | null
  ttfbP50: number | null
  lastAt: number
  lastError: { at: number; outcome: Outcome; status: number } | null
  outcomes: Partial<Record<Outcome, number>>
}

export type MinuteBucket = { t: number } & Record<WorkKind, number>

export interface Counts {
  users: number
  admins: number
  active: number
  online: number
  working: number
  sessions: number
}

export interface Announcement {
  id: string
  /** May hold moments, `{{datetime:ISO}}` — render it with AnnouncementMessage. */
  message: string
  tone: 'info' | 'warn'
  createdAt: number | null
  /** Null: it started when it was published. */
  startsAt: number | null
  expiresAt: number | null
  /** Users only ever receive 'live'; the dashboard also sees 'scheduled'. */
  status: 'scheduled' | 'live'
}

export interface WorkerHealth {
  available: boolean
  reason?: string
  detail?: string
  version?: string
}

/** One tick of the live stream. */
export interface LiveTick {
  now: number
  people: Person[]
  inflight: Work[]
  counts: Counts
  sample: MetricSample | null
  /** Null until the first reading, a few seconds after somebody opens the dashboard. */
  gpu: GpuState | null
  perMinute: MinuteBucket[]
  health: HealthRow[]
  video: { queued: number; running: number; worker: WorkerHealth | null }
  maintenance: { on: boolean; message: string; since: number | null }
  announcement: Announcement | null
  events: WorkEvent[]
  lastSeq: number
}

export interface Overview extends LiveTick {
  info: SystemInfo
  metrics: MetricSample[]
  storage: {
    budget: { bytes: number; maxBytes: number; ratio: number | null } | null
    disk: { free: number; total: number } | null
  }
  security: { failedLogins24h: number; lockouts24h: number }
}

export interface SessionRow {
  id: string
  userId: string
  username: string
  role: 'admin' | 'user'
  createdAt: number | null
  lastUsedAt: number | null
  device: string | null
  ip: string | null
  current: boolean
}

export interface AuditEntry {
  id: string
  at: number
  action: string
  actor: { id: string | null; name: string | null } | null
  target: { id: string | null; name: string | null } | null
  detail: Record<string, string | number | boolean | string[]> | null
  ip: string | null
}
