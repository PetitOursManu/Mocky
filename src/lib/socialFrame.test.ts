import { describe, expect, it } from 'vitest'
import { HOME_BAR_H, PHONE_SCREEN, STATUS_BAR_H, platformOf, socialLayout, type SocialPlatform } from './socialFrame'
import { PAGE_FORMATS } from './pageFormats'
import { deviceFrame, type PhoneFrame } from './deviceFrames'

const SOCIAL = PAGE_FORMATS.filter((f) => f.kind === 'social')
const PLATFORMS: (SocialPlatform | null)[] = ['instagram', 'facebook', 'linkedin', null]

// Where the phone drawn around the screen puts its island, in screen px.
const phone = deviceFrame('phone', PHONE_SCREEN.w, PHONE_SCREEN.h) as PhoneFrame
const islandBottom = phone.island.y + phone.island.h - phone.body.y

describe('socialLayout', () => {
  it.each(SOCIAL)('keeps the picture’s proportions and keeps it on the screen ($id)', (f) => {
    for (const platform of PLATFORMS) {
      const l = socialLayout(f, 3, platform)
      expect(l.post.h / l.post.w, `${f.id} ${platform}`).toBeCloseTo(f.h / f.w, 6)
      expect(l.post.x).toBeGreaterThanOrEqual(0)
      expect(l.post.x + l.post.w).toBeLessThanOrEqual(PHONE_SCREEN.w + 1e-9)
      expect(l.post.y, `${f.id} ${platform}`).toBeGreaterThanOrEqual(islandBottom)
      const floor = l.tabBar ? l.tabBar.y : PHONE_SCREEN.h - HOME_BAR_H
      expect(l.post.y + l.post.h, `${f.id} ${platform}`).toBeLessThanOrEqual(floor)
    }
  })

  it('puts a feed post at the full width of the screen, under the app bar and its author', () => {
    const l = socialLayout({ w: 1080, h: 1350 }, 1, 'instagram')
    expect(l.mode).toBe('feed')
    expect(l.post.w).toBe(PHONE_SCREEN.w)
    expect(l.appBar!.wordmark.y).toBeGreaterThanOrEqual(STATUS_BAR_H)
    expect(l.avatar.cy).toBeLessThan(l.post.y)
    expect(l.author.every((b) => b.y + b.h <= l.post.y)).toBe(true)
  })

  it('writes the caption where each platform does: under the picture on Instagram, above it elsewhere', () => {
    const insta = socialLayout({ w: 1080, h: 1080 }, 1, 'instagram')
    expect(insta.caption.length).toBeGreaterThan(0)
    expect(insta.caption.every((b) => b.y >= insta.post.y + insta.post.h)).toBe(true)
    for (const p of ['facebook', 'linkedin'] as const) {
      const l = socialLayout({ w: 1080, h: 1080 }, 1, p)
      expect(l.caption.every((b) => b.y + b.h <= l.post.y), p).toBe(true)
      expect(l.caption.every((b) => b.y >= l.avatar.cy + l.avatar.r - 12), p).toBe(true)
      expect(l.actions.map((a) => a.icon), p).toEqual(['like', 'comment', 'share'])
    }
  })

  it('shows a carousel’s length, and nothing for a single picture', () => {
    const one = socialLayout({ w: 1080, h: 1080 }, 1, 'instagram')
    expect(one.dots).toEqual([])
    expect(one.counter).toBeNull()
    const five = socialLayout({ w: 1080, h: 1080 }, 5, 'instagram')
    expect(five.dots).toHaveLength(5)
    // The counter sits ON the picture, the dots under it.
    expect(five.counter!.y).toBeGreaterThanOrEqual(five.post.y)
    expect(five.dots.every((d) => d.cy > five.post.y + five.post.h)).toBe(true)
  })

  it('never draws a carousel’s dots on an action or its word', () => {
    for (const platform of PLATFORMS) {
      const l = socialLayout({ w: 1080, h: 1080 }, 5, platform)
      for (const d of l.dots) {
        for (const a of l.actions) {
          const boxes = [
            { x: a.c.cx - a.c.r, y: a.c.cy - a.c.r, w: 2 * a.c.r, h: 2 * a.c.r },
            ...(a.label ? [a.label] : []),
          ]
          for (const b of boxes) {
            const apart = d.cx + d.r <= b.x || d.cx - d.r >= b.x + b.w || d.cy + d.r <= b.y || d.cy - d.r >= b.y + b.h
            expect(apart, `${platform} ${a.icon}`).toBe(true)
          }
        }
      }
    }
  })

  it('never lets the next post or the actions reach the tab bar', () => {
    for (const f of SOCIAL.filter((x) => x.h / x.w < 1.7)) {
      for (const platform of PLATFORMS) {
        const l = socialLayout(f, 2, platform)
        for (const a of l.actions) expect(a.c.cy + a.c.r, `${f.id} ${platform}`).toBeLessThanOrEqual(l.tabBar!.y)
        if (l.next) expect(l.next.picture.y + l.next.picture.h).toBeLessThanOrEqual(l.tabBar!.y + 1e-9)
      }
    }
  })

  it('gives a story the screen: progress segments over it, the reply field under it', () => {
    const l = socialLayout({ w: 1080, h: 1920 }, 4, 'instagram')
    expect(l.mode).toBe('story')
    expect(l.appBar).toBeNull()
    expect(l.tabBar).toBeNull()
    expect(l.progress).toHaveLength(4)
    for (const s of l.progress) {
      expect(s.y).toBeGreaterThanOrEqual(l.post.y)
      expect(s.x + s.w).toBeLessThanOrEqual(l.post.x + l.post.w)
    }
    expect(l.reply!.y).toBeGreaterThanOrEqual(l.post.y + l.post.h)
    expect(l.reply!.y + l.reply!.h).toBeLessThanOrEqual(PHONE_SCREEN.h - HOME_BAR_H)
    expect(socialLayout({ w: 1080, h: 1920 }, 1, null).progress).toHaveLength(1)
  })

  it('never divides by nothing', () => {
    const l = socialLayout({ w: 0, h: 0 }, 0, null)
    expect(Number.isFinite(l.post.w) && Number.isFinite(l.post.h)).toBe(true)
  })
})

describe('platformOf', () => {
  it('knows the three social types and nothing else', () => {
    expect(platformOf('instagram')).toBe('instagram')
    expect(platformOf('linkedin')).toBe('linkedin')
    expect(platformOf('flyer')).toBeNull()
    expect(platformOf(undefined)).toBeNull()
  })
})
