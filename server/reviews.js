// Sending a project for approval: an account-free link where someone outside
// the instance — a client — looks at the screens, pins comments on them, and
// approves or asks for changes.
//
// WHAT A REVIEW IS
//
// A ROUND. The owner sends the project as it is now; the server keeps a VERSION
// of it (server/versions.js, kind `review`) and mints a link to that version.
// What the client sees is therefore frozen at the moment it was sent: editing
// the project afterwards does not change what they are approving, which is the
// only honest thing an approval can be about. Sending again opens a NEW round
// on the new state, and the previous one becomes read-only history — its
// comments stay readable, nobody can add to them.
//
// The project's status is not stored on the project. It is READ off its newest
// round: none, or a round the owner closed, is a draft; otherwise the round's
// own status — in review, changes requested, approved. One source of truth, on
// the server, where the client's decision lands; writing a copy into the
// projects blob would be a second one, and the two would disagree the first
// time a browser was offline when the client answered.
//
// WHY A LINK AND NOT AN ACCOUNT
//
// Decided with the user: a client should not have to sign up to an instance to
// say "yes" to a mockup. So the link is a capability, exactly like a share link
// (server/share.js): 256 random bits, stored, revocable, expiring. It grants
// reading ONE frozen version and writing comments and a decision to ONE round —
// no project list, no generation, no library. The reviewer names themselves in
// a field, and nothing checks that name: it is a signature on a comment, not an
// identity, and the interface says so.
//
// The snapshot shown is WHITELISTED field by field (`publicScreen` in the
// route): a version holds the screen's prompt, its design record and the
// owner's private notes (I9), and none of them is the client's business.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** How long a review link may live, per option offered in the UI. */
export const REVIEW_TTL_CHOICES = {
  '7d': 7 * 24 * 60 * 60_000,
  '30d': 30 * 24 * 60 * 60_000,
  '90d': 90 * 24 * 60 * 60_000,
}
export const DEFAULT_REVIEW_TTL = '30d'

/** What a round can be. `closed` is the owner taking the project back to draft. */
export const ROUND_STATUSES = ['in_review', 'changes_requested', 'approved', 'closed']
/** What a reviewer can decide. */
export const VERDICTS = ['approved', 'changes_requested']
/** What a project can be, read off its newest round. */
export const PROJECT_STATUSES = ['draft', 'in_review', 'changes_requested', 'approved']

export const COMMENT_MAX_LEN = 2000
export const AUTHOR_MAX_LEN = 60
export const MAX_COMMENTS_PER_REVIEW = 400
export const MAX_REVIEWS_PER_USER = 100
export const MAX_REVIEWS_TOTAL = 3000

const TOKEN_RE = /^[a-f0-9]{64}$/
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
export const isReviewToken = (t) => TOKEN_RE.test(String(t || ''))

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })

/** Plain text, one paragraph break at most in a row, trimmed and capped. */
function cleanText(text, max) {
  if (typeof text !== 'string') return ''
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
    .trim()
}

/** A name on one line. */
function cleanAuthor(name) {
  return cleanText(typeof name === 'string' ? name.replace(/\s+/g, ' ') : '', AUTHOR_MAX_LEN)
}

/** A fraction of the screen's box, or null when the comment is not pinned. */
function fraction(v) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n <= 1 ? Math.round(n * 10000) / 10000 : null
}

/**
 * A screen of the frozen version, as the reviewer's page receives it.
 *
 * A whitelist, never a copy minus a few fields: a version keeps everything a
 * screen carries — its prompt (often the confidential part of a brief), its
 * design record, the owner's private notes (I9) — and a field added to Screen
 * next year must not reach a client because nobody remembered this function.
 */
export function publicScreen(s) {
  const src = s && typeof s === 'object' ? s : {}
  return {
    id: String(src.id || ''),
    name: typeof src.name === 'string' ? src.name.slice(0, 200) : '',
    code: typeof src.code === 'string' ? src.code : '',
    componentName: typeof src.componentName === 'string' ? src.componentName.slice(0, 80) : 'App',
    caps: Array.isArray(src.caps) ? src.caps.filter((c) => typeof c === 'string').slice(0, 30) : [],
    w: Number(src.w) || 1440,
    h: Number(src.h) || 900,
    device: src.device === 'iphone' ? 'iphone' : 'none',
    animations: src.animations === false ? false : true,
    ...(typeof src.page === 'string' && /^[a-z0-9-]{1,40}$/.test(src.page) ? { page: src.page } : {}),
    // The links between screens, so the client can click through the flow as
    // in a demo. Ids and selectors only — they say where a button leads.
    links: Array.isArray(src.links)
      ? src.links
          .filter((h) => h && typeof h.target === 'string')
          .slice(0, 200)
          .map((h) => ({
            id: String(h.id || ''),
            target: h.target,
            x: Number(h.x) || 0,
            y: Number(h.y) || 0,
            w: Number(h.w) || 0,
            h: Number(h.h) || 0,
            ...(typeof h.selector === 'string' ? { selector: h.selector.slice(0, 500) } : {}),
          }))
      : [],
  }
}

export function createReviewStore(dataDir, { now = () => Date.now() } = {}) {
  const file = path.join(dataDir, 'reviews.json')

  function load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }

  function save(all) {
    const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`
    // 0600: the keys of this file ARE credentials, as in shares.json.
    fs.writeFileSync(tmp, JSON.stringify(all), { mode: 0o600 })
    fs.renameSync(tmp, file)
  }

  /** Drop expired rounds. Called on every read path, so the file cleans itself. */
  function prune(all) {
    const t = now()
    let changed = false
    for (const [token, r] of Object.entries(all)) {
      if (!r || typeof r.expiresAt !== 'number' || r.expiresAt <= t) {
        delete all[token]
        changed = true
      }
    }
    return changed
  }

  function loadLive() {
    const all = load()
    if (prune(all)) save(all)
    return all
  }

  /** Whether a reviewer may still write to this round. */
  const isOpen = (r) => r.status !== 'closed' && !r.supersededAt

  /** What the owner's list shows of a round: everything, the token included. */
  function ownerView(token, r) {
    return {
      token,
      projectId: r.projectId,
      projectName: r.projectName,
      versionId: r.versionId,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      status: r.status,
      open: isOpen(r),
      ...(r.supersededAt ? { supersededAt: r.supersededAt } : {}),
      decisions: r.decisions,
      comments: r.comments,
      ownerSeenAt: r.ownerSeenAt || 0,
      unread: unread(r),
    }
  }

  /** Comments and decisions from reviewers the owner has not opened yet. */
  function unread(r) {
    const seen = r.ownerSeenAt || 0
    return (
      r.comments.filter((c) => c.from === 'reviewer' && c.at > seen).length +
      r.decisions.filter((d) => d.at > seen).length
    )
  }

  function ownRound(all, userId, token) {
    if (!isReviewToken(token)) return null
    const r = all[token]
    return r && r.userId === userId ? r : null
  }

  return {
    /**
     * Open a round on a version the caller already checked belongs to them.
     * Every open round of the same project is superseded: two live links on one
     * project would collect two contradictory verdicts.
     */
    create(userId, { projectId, projectName, versionId, ttl } = {}) {
      if (!ID_RE.test(String(projectId || ''))) throw fail('Unknown project.')
      if (!/^v[a-f0-9]{24}$/.test(String(versionId || ''))) throw fail('Unknown version.')
      const all = loadLive()
      const mine = Object.values(all).filter((r) => r.userId === userId)
      if (mine.length >= MAX_REVIEWS_PER_USER) {
        throw fail(`You already have ${MAX_REVIEWS_PER_USER} review links. Revoke some first.`, 429)
      }
      if (Object.keys(all).length >= MAX_REVIEWS_TOTAL) throw fail('This instance has too many review links.', 507)

      const t = now()
      for (const r of mine) {
        if (r.projectId === projectId && !r.supersededAt) r.supersededAt = t
      }
      const token = crypto.randomBytes(32).toString('hex')
      all[token] = {
        userId,
        projectId,
        projectName: String(projectName || '').slice(0, 200),
        versionId,
        createdAt: t,
        expiresAt: t + (REVIEW_TTL_CHOICES[ttl] ?? REVIEW_TTL_CHOICES[DEFAULT_REVIEW_TTL]),
        status: 'in_review',
        decisions: [],
        comments: [],
        ownerSeenAt: t,
      }
      save(all)
      return { token, expiresAt: all[token].expiresAt }
    },

    /** The raw round behind a token, or null when unknown, expired or revoked. */
    get(token) {
      if (!isReviewToken(token)) return null
      return loadLive()[token] || null
    },

    /** What the reviewer's page is told about the round, besides the screens. */
    publicView(r) {
      return {
        projectName: r.projectName,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        status: r.status,
        open: isOpen(r),
        decisions: r.decisions,
        comments: r.comments,
      }
    },

    /** A project's rounds, newest first. */
    list(userId, projectId) {
      return Object.entries(loadLive())
        .filter(([, r]) => r.userId === userId && r.projectId === projectId)
        .sort((a, b) => b[1].createdAt - a[1].createdAt)
        .map(([token, r]) => ownerView(token, r))
    },

    /**
     * Every project's status at once, for the projects page — read off each
     * project's newest round (see the header). Projects with no round are
     * absent, and absent reads as draft.
     */
    statusFor(userId) {
      const newest = new Map()
      for (const r of Object.values(loadLive())) {
        if (r.userId !== userId) continue
        const prev = newest.get(r.projectId)
        if (!prev || r.createdAt > prev.createdAt) newest.set(r.projectId, r)
      }
      const out = {}
      for (const [projectId, r] of newest) {
        out[projectId] = {
          status: r.status === 'closed' ? 'draft' : r.status,
          unread: unread(r),
          at: Math.max(r.createdAt, ...r.decisions.map((d) => d.at), ...r.comments.map((c) => c.at)),
        }
      }
      return out
    },

    /**
     * A comment, from the reviewer's page (`from: 'reviewer'`, author typed by
     * them) or from the owner (`from: 'owner'`, author their account name).
     * The screen is checked by the route against the round's own version.
     */
    addComment(token, input, { from, userId = null }) {
      const all = loadLive()
      const r = isReviewToken(token) ? all[token] : null
      if (!r) throw fail('This link has expired or was revoked.', 404)
      if (from === 'owner' && r.userId !== userId) throw fail('This link has expired or was revoked.', 404)
      if (from === 'reviewer' && !isOpen(r)) throw fail('This review is closed: it no longer takes comments.', 409)
      if (r.comments.length >= MAX_COMMENTS_PER_REVIEW) throw fail('This review has reached its comment limit.', 429)

      const text = cleanText(input?.text, COMMENT_MAX_LEN)
      if (!text) throw fail('A comment needs some text.')
      const author = cleanAuthor(input?.author)
      if (!author) throw fail('Please give your name.')
      const screenId = typeof input?.screenId === 'string' && ID_RE.test(input.screenId) ? input.screenId : ''
      let parentId = ''
      if (input?.parentId) {
        const parent = r.comments.find((c) => c.id === input.parentId)
        if (!parent) throw fail('The comment being answered no longer exists.')
        // One level of replies: an answer to an answer joins the same thread.
        parentId = parent.parentId || parent.id
      }
      const x = parentId ? null : fraction(input?.x)
      const y = parentId ? null : fraction(input?.y)
      const comment = {
        id: 'c' + crypto.randomBytes(8).toString('hex'),
        from: from === 'owner' ? 'owner' : 'reviewer',
        author,
        text,
        at: now(),
        ...(screenId ? { screenId } : {}),
        ...(parentId ? { parentId } : {}),
        ...(x !== null && y !== null ? { x, y } : {}),
      }
      r.comments.push(comment)
      // The owner just wrote: what is above their own reply is read.
      if (comment.from === 'owner') r.ownerSeenAt = comment.at
      save(all)
      return comment
    },

    /**
     * The reviewer's verdict. It may change while the round is open — "approved"
     * after "changes requested" on the same version is a person changing their
     * mind — and every decision is kept, so the owner sees the path, not only
     * where it ended.
     */
    decide(token, input) {
      const all = loadLive()
      const r = isReviewToken(token) ? all[token] : null
      if (!r) throw fail('This link has expired or was revoked.', 404)
      if (!isOpen(r)) throw fail('This review is closed: it no longer takes a decision.', 409)
      if (!VERDICTS.includes(input?.verdict)) throw fail('Unknown decision.')
      const author = cleanAuthor(input?.author)
      if (!author) throw fail('Please give your name.')
      const message = cleanText(input?.message, COMMENT_MAX_LEN)
      // Asking for changes without saying which is a decision nobody can act on.
      if (input.verdict === 'changes_requested' && !message) throw fail('Say what should change.')
      const decision = { verdict: input.verdict, author, at: now(), ...(message ? { message } : {}) }
      r.decisions.push(decision)
      r.status = input.verdict
      save(all)
      return { status: r.status, decision }
    },

    setResolved(userId, token, commentId, resolved) {
      const all = loadLive()
      const r = ownRound(all, userId, token)
      const c = r?.comments.find((x) => x.id === commentId)
      if (!c) return null
      if (resolved) c.resolvedAt = now()
      else delete c.resolvedAt
      save(all)
      return c
    },

    markSeen(userId, token) {
      const all = loadLive()
      const r = ownRound(all, userId, token)
      if (!r) return false
      r.ownerSeenAt = now()
      save(all)
      return true
    },

    /** Back to draft: the link stays readable, and takes nothing more. */
    close(userId, token) {
      const all = loadLive()
      const r = ownRound(all, userId, token)
      if (!r) return false
      r.status = 'closed'
      save(all)
      return true
    },

    /** The link stops working at once, for everybody. */
    revoke(userId, token) {
      const all = load()
      if (!ownRound(all, userId, token)) return false
      delete all[token]
      prune(all)
      save(all)
      return true
    },

    revokeAllFor(userId) {
      const all = load()
      let changed = false
      for (const [token, r] of Object.entries(all)) {
        if (r.userId === userId) {
          delete all[token]
          changed = true
        }
      }
      if (changed) save(all)
    },

    /**
     * The versions a live link shows. Deleting one would turn the client's
     * page into an error, so the version routes refuse to.
     */
    lockedVersions(userId) {
      return new Set(
        Object.values(loadLive())
          .filter((r) => r.userId === userId)
          .map((r) => r.versionId),
      )
    },
  }
}
