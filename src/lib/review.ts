import type { Hotspot, Screen } from './project'
import type { PageFormatId } from './pageFormats'

/**
 * Sending a project for approval — the client's half of `server/reviews.js`.
 *
 * Two audiences call this module. The OWNER, signed in, sends a round and reads
 * what came back. The REVIEWER, on `/r/<token>`, has no account: the token in
 * the address is their whole authority, which is why the reviewer's calls
 * send no credentials at all, like a share link's (`lib/share.ts`).
 *
 * The project's status is read off its newest round, never stored on the
 * project — the server's header says why.
 */

export type ProjectStatus = 'draft' | 'in_review' | 'changes_requested' | 'approved'
export type RoundStatus = 'in_review' | 'changes_requested' | 'approved' | 'closed'
export type Verdict = 'approved' | 'changes_requested'
export type ReviewTtl = '7d' | '30d' | '90d'

export interface ReviewComment {
  id: string
  from: 'reviewer' | 'owner'
  author: string
  text: string
  at: number
  /** Absent: a remark on the whole project rather than one screen. */
  screenId?: string
  /** A reply: the id of the comment it answers. One level only. */
  parentId?: string
  /** Where on the screen, as fractions of its box. Absent: not pinned. */
  x?: number
  y?: number
  /** Set by the owner once the remark has been dealt with. */
  resolvedAt?: number
}

export interface ReviewDecision {
  verdict: Verdict
  author: string
  at: number
  message?: string
}

/** A screen as the reviewer's page receives it: the server's whitelist. */
export interface ReviewScreen {
  id: string
  name: string
  code: string
  componentName: string
  caps: string[]
  w: number
  h: number
  device: 'iphone' | 'none'
  animations: boolean
  page?: PageFormatId
  links: Hotspot[]
  /** The name a working prototype opens it by (lib/flows.ts). */
  route?: string
}

export interface ReviewView {
  projectName: string
  createdAt: number
  expiresAt: number
  status: RoundStatus
  /** False once closed or superseded: readable, and takes nothing more. */
  open: boolean
  decisions: ReviewDecision[]
  comments: ReviewComment[]
  screens: ReviewScreen[]
}

/** A round as the owner's list shows it. */
export interface ReviewRound {
  token: string
  url: string
  projectId: string
  projectName: string
  versionId: string
  createdAt: number
  expiresAt: number
  status: RoundStatus
  open: boolean
  supersededAt?: number
  decisions: ReviewDecision[]
  comments: ReviewComment[]
  ownerSeenAt: number
  unread: number
}

export interface ProjectReviewState {
  status: ProjectStatus
  unread: number
  at: number
}

/** The status a project shows: its newest round's, a closed one read as a draft. */
export function projectStatusOf(rounds: Pick<ReviewRound, 'status' | 'createdAt'>[]): ProjectStatus {
  const newest = [...rounds].sort((a, b) => b.createdAt - a.createdAt)[0]
  if (!newest || newest.status === 'closed') return 'draft'
  return newest.status
}

/**
 * The threads of one screen — or of the whole project with `screenId` null —
 * oldest first, each root with its replies. A reply whose root is missing is
 * shown as a root: losing a sentence someone wrote is worse than a thread
 * drawn slightly wrong.
 */
export function threadsOf(
  comments: ReviewComment[],
  screenId: string | null,
): { root: ReviewComment; replies: ReviewComment[] }[] {
  const onThis = (c: ReviewComment) => (screenId ? c.screenId === screenId : !c.screenId)
  const ids = new Set(comments.map((c) => c.id))
  const roots = comments
    .filter((c) => onThis(c) && (!c.parentId || !ids.has(c.parentId)))
    .sort((a, b) => a.at - b.at)
  return roots.map((root) => ({
    root,
    replies: comments.filter((c) => c.parentId === root.id).sort((a, b) => a.at - b.at),
  }))
}

/** The pinned roots of a screen, numbered in order — the numbers drawn on the pins. */
export function pinsOf(comments: ReviewComment[], screenId: string): { comment: ReviewComment; n: number }[] {
  return comments
    .filter((c) => c.screenId === screenId && !c.parentId && typeof c.x === 'number' && typeof c.y === 'number')
    .sort((a, b) => a.at - b.at)
    .map((comment, i) => ({ comment, n: i + 1 }))
}

/** How many open remarks each screen carries — what the screen list shows. */
export function openCountByScreen(comments: ReviewComment[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of comments) {
    if (c.parentId || c.resolvedAt || c.from !== 'reviewer' || !c.screenId) continue
    out[c.screenId] = (out[c.screenId] ?? 0) + 1
  }
  return out
}

/**
 * A review screen as a Screen, for the components that draw one. Only what
 * the server sent is real; the rest are placeholders nothing writes back.
 */
export function asScreen(s: ReviewScreen): Screen {
  return {
    id: s.id,
    name: s.name,
    prompt: '',
    code: s.code,
    componentName: s.componentName,
    createdAt: 0,
    x: 0,
    y: 0,
    w: s.w,
    h: s.h,
    device: s.device,
    links: s.links ?? [],
    caps: s.caps,
    animations: s.animations,
    ...(s.page ? { page: s.page } : {}),
    ...(s.route ? { route: s.route } : {}),
  }
}

/** The token in `/r/<token>`, or null on any other page. Same rule as `/s/`. */
export function reviewTokenFromLocation(pathname = window.location.pathname): string | null {
  const m = /^\/r\/([a-f0-9]{64})\/?$/.exec(pathname)
  return m ? m[1] : null
}

/** The name a reviewer typed last time, so a second comment does not ask again. */
const AUTHOR_KEY = 'mocky.review.author'
export function loadReviewAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) || ''
  } catch {
    return ''
  }
}
export function saveReviewAuthor(name: string): void {
  try {
    localStorage.setItem(AUTHOR_KEY, name)
  } catch {
    /* private mode: they will type it again */
  }
}

// ---------------------------------------------------------------------------

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
  return body as T
}

const post = (body: unknown, credentials?: RequestCredentials): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
  ...(credentials ? { credentials } : {}),
})

// The reviewer's calls: no credentials, the URL is the authority.

export function fetchReview(token: string): Promise<ReviewView> {
  return call(`/api/review/${token}`, { credentials: 'omit' })
}

export async function postReviewComment(
  token: string,
  input: { author: string; text: string; screenId?: string; parentId?: string; x?: number; y?: number },
): Promise<ReviewComment> {
  return (await call<{ comment: ReviewComment }>(`/api/review/${token}/comments`, post(input, 'omit'))).comment
}

export function postReviewDecision(
  token: string,
  input: { author: string; verdict: Verdict; message?: string },
): Promise<{ status: RoundStatus; decision: ReviewDecision }> {
  return call(`/api/review/${token}/decision`, post(input, 'omit'))
}

// The owner's calls.

export function createReview(input: {
  projectId: string
  projectName: string
  versionId: string
  ttl: ReviewTtl
}): Promise<{ token: string; url: string; expiresAt: number }> {
  return call('/api/reviews', post(input))
}

export async function listReviews(projectId: string): Promise<ReviewRound[]> {
  const out = await call<{ rounds: ReviewRound[] }>(`/api/reviews?projectId=${encodeURIComponent(projectId)}`)
  return Array.isArray(out.rounds) ? out.rounds : []
}

export async function reviewStatuses(): Promise<Record<string, ProjectReviewState>> {
  const out = await call<{ projects: Record<string, ProjectReviewState> }>('/api/reviews/status')
  return out.projects || {}
}

export async function replyAsOwner(
  token: string,
  input: { text: string; screenId?: string; parentId?: string; x?: number; y?: number },
): Promise<ReviewComment> {
  return (await call<{ comment: ReviewComment }>(`/api/reviews/${token}/comments`, post(input))).comment
}

export async function resolveComment(token: string, commentId: string, resolved: boolean): Promise<ReviewComment> {
  const out = await call<{ comment: ReviewComment }>(`/api/reviews/${token}/comments/${commentId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ resolved }),
  })
  return out.comment
}

export async function markReviewSeen(token: string): Promise<void> {
  await call(`/api/reviews/${token}/seen`, post({}))
}

export async function closeReview(token: string): Promise<void> {
  await call(`/api/reviews/${token}/close`, post({}))
}

export async function revokeReview(token: string): Promise<void> {
  await call(`/api/reviews/${token}`, { method: 'DELETE' })
}
