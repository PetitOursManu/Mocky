import { describe, expect, it } from 'vitest'
import { isMockyAsset, keepScreenAddress, keepScreenCssUrl, screenStillCsp } from './stillCopy'

/**
 * What the inert copy of a screen may still name. html2canvas loads these from
 * Mocky's own window, with the session cookie and no CSP, so the list is the
 * guard: the whole markup behaves as a model chose to write it.
 */

const ORIGIN = 'https://mocky.test'
const keep = keepScreenAddress(ORIGIN)

describe('the addresses a copy of a screen keeps', () => {
  it('knows Mocky’s files from Mocky’s routes', () => {
    expect(isMockyAsset('/api/images/abc', ORIGIN)).toBe(true)
    expect(isMockyAsset(`${ORIGIN}/fonts/inter.woff2`, ORIGIN)).toBe(true)
    expect(isMockyAsset('/api/video/abc', ORIGIN)).toBe(true)
    expect(isMockyAsset('/api/admin/users', ORIGIN)).toBe(false)
    expect(isMockyAsset('/api/images/../admin/users', ORIGIN)).toBe(false)
    expect(isMockyAsset('/api/images/%2e%2e/admin/users', ORIGIN)).toBe(false)
    expect(isMockyAsset('https://evil.test/api/images/abc', ORIGIN)).toBe(false)
  })

  it('keeps a picture’s address only if it is a file, or elsewhere and refused', () => {
    expect(keep('/api/images/abc', 'img', 'src')).toBe(true)
    expect(keep('/api/video/abc', 'video', 'src')).toBe(true)
    // Named for the export's notice; the CSP and html2canvas's options refuse it.
    expect(keep('https://cdn.example/x.jpg', 'img', 'src')).toBe(true)
    expect(keep('/api/admin/users', 'img', 'src')).toBe(false)
    expect(keep(`${ORIGIN}/api/admin/users`, 'img', 'src')).toBe(false)
    expect(keep('javascript:alert(1)', 'img', 'src')).toBe(false)
    expect(keep('https://cdn.example/x.mp4', 'video', 'src')).toBe(false)
  })

  it('keeps links, which the PDF carries, and only links', () => {
    expect(keep('https://example.com/offre', 'a', 'href')).toBe(true)
    expect(keep('mailto:a@b.c', 'a', 'href')).toBe(true)
    expect(keep('javascript:alert(1)', 'a', 'href')).toBe(false)
    expect(keep('https://example.com/x', 'use', 'href')).toBe(false)
  })

  it('applies the same list to stylesheets, plus in-page references', () => {
    const css = keepScreenCssUrl(ORIGIN)
    expect(css('#grad')).toBe(true)
    expect(css('/fonts/inter.woff2')).toBe(true)
    expect(css('/api/admin/users')).toBe(false)
    expect(css('https://evil.test/x.png')).toBe(false)
  })

  it('runs nothing and allows nothing but its own files', () => {
    const csp = screenStillCsp(ORIGIN)
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain(`img-src ${ORIGIN} data:`)
    expect(csp).not.toMatch(/script-src|connect-src https?:|\*/)
  })
})
