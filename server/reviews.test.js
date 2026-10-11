import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createReviewStore, isReviewToken, publicScreen, REVIEW_TTL_CHOICES, COMMENT_MAX_LEN } from './reviews.js'

/**
 * A review link is a credential in a client's hands, and what it unlocks is
 * deliberately narrow: one frozen version to read, one round to write to. What
 * is worth pinning is that narrowness — whose round it is, when it stops
 * taking writes — and the project status the owner reads off it.
 */

let dir
let clock
const now = () => clock
const store = () => createReviewStore(dir, { now })
const V1 = 'v' + 'a'.repeat(24)
const V2 = 'v' + 'b'.repeat(24)

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-reviews-'))
  clock = 1_700_000_000_000
})
afterEach(() => {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    /* best effort */
  }
})

const open = (s, over = {}) => s.create('u1', { projectId: 'p1', projectName: 'Softly', versionId: V1, ...over })

describe('a round', () => {
  it('is reached by an unguessable token, and expires', () => {
    const s = store()
    const { token, expiresAt } = open(s, { ttl: '7d' })
    expect(isReviewToken(token)).toBe(true)
    expect(expiresAt - clock).toBe(REVIEW_TTL_CHOICES['7d'])
    clock = expiresAt + 1
    expect(s.get(token)).toBeNull()
  })

  it('starts in review, and the project reads "in review"', () => {
    const s = store()
    open(s)
    expect(s.statusFor('u1').p1.status).toBe('in_review')
  })

  it('reads as draft once the owner closes it', () => {
    const s = store()
    const { token } = open(s)
    s.close('u1', token)
    expect(s.statusFor('u1').p1.status).toBe('draft')
  })

  it('supersedes the previous round of the same project, which stops taking comments', () => {
    const s = store()
    const first = open(s)
    clock += 1000
    open(s, { versionId: V2 })
    expect(() => s.addComment(first.token, { author: 'Paul', text: 'late' }, { from: 'reviewer' })).toThrow(/closed/)
    expect(s.list('u1', 'p1')).toHaveLength(2)
  })
})

describe('the reviewer', () => {
  it('signs a comment with the name they typed, pinned where they clicked', () => {
    const s = store()
    const { token } = open(s)
    const c = s.addComment(token, { author: '  Claire   Dupont ', text: 'Le logo est trop petit', screenId: 's1', x: 0.25, y: 1.4 }, { from: 'reviewer' })
    expect(c.author).toBe('Claire Dupont')
    expect(c.screenId).toBe('s1')
    // A point outside the box is not a pin: the comment stays on the screen, unpinned.
    expect('x' in c).toBe(false)
  })

  it('cannot comment without a name or a text', () => {
    const s = store()
    const { token } = open(s)
    expect(() => s.addComment(token, { author: '', text: 'x' }, { from: 'reviewer' })).toThrow(/name/)
    expect(() => s.addComment(token, { author: 'A', text: '   ' }, { from: 'reviewer' })).toThrow(/text/)
  })

  it('has a comment capped, not refused, past the length limit', () => {
    const s = store()
    const { token } = open(s)
    const c = s.addComment(token, { author: 'A', text: 'x'.repeat(COMMENT_MAX_LEN + 50) }, { from: 'reviewer' })
    expect(c.text.length).toBe(COMMENT_MAX_LEN)
  })

  it('answers in one level of threads', () => {
    const s = store()
    const { token } = open(s)
    const root = s.addComment(token, { author: 'A', text: 'root' }, { from: 'reviewer' })
    const reply = s.addComment(token, { author: 'B', text: 'reply', parentId: root.id }, { from: 'reviewer' })
    const deeper = s.addComment(token, { author: 'C', text: 'deeper', parentId: reply.id }, { from: 'reviewer' })
    expect(deeper.parentId).toBe(root.id)
  })

  it('decides, and may change their mind while the round is open', () => {
    const s = store()
    const { token } = open(s)
    s.decide(token, { author: 'Claire', verdict: 'changes_requested', message: 'Plus de contraste' })
    expect(s.statusFor('u1').p1.status).toBe('changes_requested')
    s.decide(token, { author: 'Claire', verdict: 'approved' })
    expect(s.statusFor('u1').p1.status).toBe('approved')
    expect(s.list('u1', 'p1')[0].decisions.map((d) => d.verdict)).toEqual(['changes_requested', 'approved'])
  })

  it('must say what to change when asking for changes', () => {
    const s = store()
    const { token } = open(s)
    expect(() => s.decide(token, { author: 'Claire', verdict: 'changes_requested' })).toThrow(/change/)
  })

  it('cannot decide on a closed round', () => {
    const s = store()
    const { token } = open(s)
    s.close('u1', token)
    expect(() => s.decide(token, { author: 'Claire', verdict: 'approved' })).toThrow(/closed/)
  })
})

describe('the owner', () => {
  it('counts what reviewers wrote since they last looked', () => {
    const s = store()
    const { token } = open(s)
    clock += 10
    s.addComment(token, { author: 'A', text: 'one' }, { from: 'reviewer' })
    s.decide(token, { author: 'A', verdict: 'approved' })
    expect(s.statusFor('u1').p1.unread).toBe(2)
    clock += 10
    s.markSeen('u1', token)
    expect(s.statusFor('u1').p1.unread).toBe(0)
  })

  it('replies on a closed round, but nobody else can write to it', () => {
    const s = store()
    const { token } = open(s)
    s.close('u1', token)
    expect(s.addComment(token, { author: 'manu', text: 'noted' }, { from: 'owner', userId: 'u1' }).from).toBe('owner')
    expect(() => s.addComment(token, { author: 'manu', text: 'x' }, { from: 'owner', userId: 'u2' })).toThrow()
  })

  it('is the only one who can close, revoke or resolve', () => {
    const s = store()
    const { token } = open(s)
    const c = s.addComment(token, { author: 'A', text: 'one' }, { from: 'reviewer' })
    expect(s.close('u2', token)).toBe(false)
    expect(s.revoke('u2', token)).toBe(false)
    expect(s.setResolved('u2', token, c.id, true)).toBeNull()
    expect(s.setResolved('u1', token, c.id, true)?.resolvedAt).toBe(clock)
    expect(s.revoke('u1', token)).toBe(true)
    expect(s.get(token)).toBeNull()
  })

  it('locks the versions a live link shows', () => {
    const s = store()
    open(s)
    expect(s.lockedVersions('u1').has(V1)).toBe(true)
    expect(s.lockedVersions('u2').size).toBe(0)
  })
})

describe('what the reviewer\'s page receives of a screen', () => {
  it('is a whitelist: never the prompt, the design record or the private notes', () => {
    const out = publicScreen({
      id: 's1',
      name: 'Accueil',
      code: 'function App(){}',
      componentName: 'App',
      caps: ['motion'],
      w: 390,
      h: 844,
      device: 'iphone',
      prompt: 'the confidential brief',
      design: '# Direction',
      userNotes: [{ id: 'n', text: 'Paul hates this', createdAt: 1 }],
      quality: { score: 12 },
      route: 'home',
      links: [{ id: 'h', target: 's2', x: 0, y: 0, w: 1, h: 1, selector: '#buy', label: 'Acheter' }],
    })
    expect(Object.keys(out).sort()).toEqual(['animations', 'caps', 'code', 'componentName', 'device', 'h', 'id', 'links', 'name', 'route', 'w'])
    expect(JSON.stringify(out)).not.toMatch(/confidential|Paul hates|Direction/)
    expect(out.links[0]).toEqual({ id: 'h', target: 's2', x: 0, y: 0, w: 1, h: 1, selector: '#buy' })
  })
})
