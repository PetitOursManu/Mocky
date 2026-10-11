import { describe, it, expect } from 'vitest'
import { openCountByScreen, pinsOf, projectStatusOf, reviewTokenFromLocation, threadsOf, type ReviewComment } from './review'

const c = (over: Partial<ReviewComment>): ReviewComment => ({
  id: 'c' + Math.random().toString(36).slice(2),
  from: 'reviewer',
  author: 'Claire',
  text: 'x',
  at: 1,
  ...over,
})

describe('a project\'s status', () => {
  it('is its newest round\'s, and a draft when there is none or it was closed', () => {
    expect(projectStatusOf([])).toBe('draft')
    expect(projectStatusOf([{ status: 'approved', createdAt: 1 }, { status: 'in_review', createdAt: 2 }])).toBe('in_review')
    expect(projectStatusOf([{ status: 'approved', createdAt: 1 }, { status: 'closed', createdAt: 2 }])).toBe('draft')
  })
})

describe('threads', () => {
  it('groups replies under their root, per screen, oldest first', () => {
    const root = c({ id: 'r', screenId: 's1', at: 2 })
    const first = c({ id: 'f', screenId: 's1', at: 1 })
    const reply = c({ id: 'a', parentId: 'r', screenId: 's1', at: 3, from: 'owner' })
    const elsewhere = c({ id: 'e', screenId: 's2' })
    const general = c({ id: 'g' })
    const t = threadsOf([root, reply, elsewhere, first, general], 's1')
    expect(t.map((x) => x.root.id)).toEqual(['f', 'r'])
    expect(t[1].replies.map((x) => x.id)).toEqual(['a'])
    expect(threadsOf([root, general], null).map((x) => x.root.id)).toEqual(['g'])
  })

  it('shows an orphaned reply rather than losing it', () => {
    expect(threadsOf([c({ id: 'o', parentId: 'gone', screenId: 's1' })], 's1').map((x) => x.root.id)).toEqual(['o'])
  })
})

describe('pins', () => {
  it('numbers the pinned roots of a screen in the order they were written', () => {
    const p = pinsOf(
      [c({ id: 'b', screenId: 's1', x: 0.1, y: 0.1, at: 5 }), c({ id: 'a', screenId: 's1', x: 0.2, y: 0.2, at: 1 }), c({ id: 'n', screenId: 's1', at: 2 })],
      's1',
    )
    expect(p.map((x) => [x.comment.id, x.n])).toEqual([['a', 1], ['b', 2]])
  })
})

describe('open remarks', () => {
  it('counts the reviewers\' unresolved roots per screen', () => {
    expect(
      openCountByScreen([
        c({ screenId: 's1' }),
        c({ screenId: 's1', resolvedAt: 3 }),
        c({ screenId: 's1', from: 'owner' }),
        c({ screenId: 's2', parentId: 'x' }),
      ]),
    ).toEqual({ s1: 1 })
  })
})

describe('the address', () => {
  it('recognises /r/<64 hex> and nothing else', () => {
    expect(reviewTokenFromLocation('/r/' + 'a'.repeat(64))).toBe('a'.repeat(64))
    expect(reviewTokenFromLocation('/s/' + 'a'.repeat(64))).toBeNull()
    expect(reviewTokenFromLocation('/r/abc')).toBeNull()
  })
})
