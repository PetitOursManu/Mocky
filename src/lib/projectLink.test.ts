import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { projectLinkFromLocation, projectLinkUrl, rememberProjectLink, takeProjectLink } from './projectLink'

describe('projectLinkFromLocation', () => {
  it('reads a project, and a screen when there is one', () => {
    expect(projectLinkFromLocation('/p/lx2k9a3bcd', '')).toEqual({ projectId: 'lx2k9a3bcd' })
    expect(projectLinkFromLocation('/p/lx2k9a3bcd/', '?screen=m01abcde')).toEqual({ projectId: 'lx2k9a3bcd', screenId: 'm01abcde' })
  })

  it('is not fooled by other paths or odd ids', () => {
    expect(projectLinkFromLocation('/', '')).toBeNull()
    expect(projectLinkFromLocation('/s/' + 'a'.repeat(64), '')).toBeNull()
    expect(projectLinkFromLocation('/p/', '')).toBeNull()
    expect(projectLinkFromLocation('/p/abc/def', '')).toBeNull()
    expect(projectLinkFromLocation('/p/a%20b', '')).toBeNull()
    expect(projectLinkFromLocation('/p/abc', '')).toBeNull() // too short to be an id
  })

  it('drops a screen id of the wrong shape and keeps the project', () => {
    expect(projectLinkFromLocation('/p/lx2k9a3bcd', '?screen=<script>')).toEqual({ projectId: 'lx2k9a3bcd' })
  })
})

describe('projectLinkUrl', () => {
  it('builds the link the MCP server hands back', () => {
    expect(projectLinkUrl('https://mocky.example/', { projectId: 'p1234', screenId: 's5678' })).toBe(
      'https://mocky.example/p/p1234?screen=s5678',
    )
    expect(projectLinkUrl('https://mocky.example', { projectId: 'p1234' })).toBe('https://mocky.example/p/p1234')
  })

  it('reads back what it builds', () => {
    const url = new URL(projectLinkUrl('https://m.example', { projectId: 'lx2k9a3bcd', screenId: 'm01abcde' }))
    expect(projectLinkFromLocation(url.pathname, url.search)).toEqual({ projectId: 'lx2k9a3bcd', screenId: 'm01abcde' })
  })
})

describe('a link waiting for sign-in', () => {
  // The suite runs in Node: a Map behind the three calls the module makes.
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('is followed once', () => {
    rememberProjectLink({ projectId: 'lx2k9a3bcd', screenId: 'm01abcde' })
    expect(takeProjectLink()).toEqual({ projectId: 'lx2k9a3bcd', screenId: 'm01abcde' })
    expect(takeProjectLink()).toBeNull()
  })

  it('ignores what it did not write', () => {
    sessionStorage.setItem('mocky.pendingProjectLink', '{"projectId":"../../etc"}')
    expect(takeProjectLink()).toBeNull()
    sessionStorage.setItem('mocky.pendingProjectLink', 'not json')
    expect(takeProjectLink()).toBeNull()
  })
})
