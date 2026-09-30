/**
 * A social post in the demo player, shown where it will be seen: on a phone,
 * in a feed — or full screen, for a story.
 *
 * The devices of `deviceFrames.ts` are chosen by a screen's size, and a post is
 * 1080 px wide: it would be put in a tablet, at a size nobody will ever see it.
 * A post is a picture in somebody else's app, so the phone's screen is that
 * app, drawn in the same ink as the phone — an author row, the picture at the
 * full width of the screen, the actions under it, the caption, and the next
 * post starting — and the page sits in it exactly where the platform puts it.
 *
 * Same split as the devices and the hand: every number here, in the phone
 * screen's own pixels; the component only draws. The tests hold what a drawing
 * cannot show: the picture keeps its proportions, lies between the status bar
 * and the tab bar (or, for a story, the reply bar), and nothing of the app is
 * drawn over it except what the app really draws over it.
 */

/** An iPhone's screen in CSS px — the size a feed is actually seen at. */
export const PHONE_SCREEN = { w: 390, h: 844 } as const
/** The status bar and the island: the same 54 px MOBILE_HINT keeps clear. */
export const STATUS_BAR_H = 54
/** The home indicator's band at the bottom. */
export const HOME_BAR_H = 34

export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin'

export interface Box {
  x: number
  y: number
  w: number
  h: number
  r: number
}

export interface Circle {
  cx: number
  cy: number
  r: number
}

export type ActionIcon = 'heart' | 'comment' | 'share' | 'save' | 'like'
export type TabIcon = 'home' | 'search' | 'add' | 'play' | 'profile'

export interface SocialLayout {
  mode: 'feed' | 'story'
  /** Where the page is drawn. */
  post: Box
  /** The author: an avatar and two lines (name, then a faint line under it). */
  avatar: Circle
  author: Box[]
  /** The app's own top bar (feed only): a wordmark and two icons. */
  appBar: { wordmark: Box; icons: Circle[] } | null
  /** Placeholder lines for the post's text — above the picture on Facebook and LinkedIn, under it on Instagram. */
  caption: Box[]
  actions: { icon: ActionIcon; c: Circle; label: Box | null }[]
  /** A carousel's position: dots under the picture (feed) or segments over it (story). */
  dots: Circle[]
  progress: Box[]
  /** Feed: the counter pill over a carousel's picture. */
  counter: Box | null
  /** Story: the reply field at the foot. */
  reply: Box | null
  tabBar: { y: number; icons: { icon: TabIcon; c: Circle }[] } | null
  /** Feed: the next post starting under this one, so it reads as a feed. */
  next: { avatar: Circle; author: Box[]; picture: Box } | null
}

const W = PHONE_SCREEN.w
const H = PHONE_SCREEN.h
const APP_BAR_H = 44
const AUTHOR_H = 54
const ACTIONS_H = 44
const CAPTION_LINE = 16
const TAB_BAR_H = 49
const REPLY_H = 44
const DOTS_H = 20

function authorRow(top: number, x = 14): { avatar: Circle; author: Box[] } {
  const cy = top + AUTHOR_H / 2
  return {
    avatar: { cx: x + 16, cy, r: 16 },
    author: [
      { x: x + 42, y: cy - 10, w: 112, h: 8, r: 4 },
      { x: x + 42, y: cy + 3, w: 72, h: 6, r: 3 },
    ],
  }
}

function captionLines(top: number, widths: number[]): Box[] {
  return widths.map((w, i) => ({ x: 14, y: top + i * CAPTION_LINE + 4, w, h: 7, r: 3.5 }))
}

/** Evenly spaced dots, centred on `cx`. */
function dotsAt(n: number, cx: number, cy: number): Circle[] {
  if (n < 2) return []
  const gap = 10
  const start = cx - ((n - 1) * gap) / 2
  return Array.from({ length: n }, (_, i) => ({ cx: start + i * gap, cy, r: 3 }))
}

/**
 * The layout of one post on a phone. `format` is the page (its size decides
 * feed or story), `pages` the carousel's length, `platform` where the caption
 * goes: Instagram prints it under the picture, Facebook and LinkedIn above.
 */
export function socialLayout(
  format: { w: number; h: number },
  pages: number,
  platform: SocialPlatform | null,
): SocialLayout {
  const n = Math.max(1, Math.floor(pages))
  const ratio = Math.max(0.1, format.h / Math.max(1, format.w))
  // 9:16 and taller is a story: it owns the screen.
  if (ratio >= 1.7) return storyLayout(ratio, n)
  return feedLayout(ratio, n, platform)
}

function feedLayout(ratio: number, n: number, platform: SocialPlatform | null): SocialLayout {
  const captionAbove = platform === 'facebook' || platform === 'linkedin'
  const appTop = STATUS_BAR_H
  const appBar = {
    wordmark: { x: 14, y: appTop + APP_BAR_H / 2 - 7, w: 96, h: 14, r: 7 },
    icons: [
      { cx: W - 62, cy: appTop + APP_BAR_H / 2, r: 10 },
      { cx: W - 26, cy: appTop + APP_BAR_H / 2, r: 10 },
    ],
  }
  const tabY = H - HOME_BAR_H - TAB_BAR_H
  const tabIcons: TabIcon[] = ['home', 'search', 'add', 'play', 'profile']
  const tabBar = {
    y: tabY,
    icons: tabIcons.map((icon, i) => ({ icon, c: { cx: (W / tabIcons.length) * (i + 0.5), cy: tabY + TAB_BAR_H / 2, r: 11 } })),
  }

  let y = appTop + APP_BAR_H
  const { avatar, author } = authorRow(y)
  y += AUTHOR_H
  let caption: Box[] = []
  if (captionAbove) {
    caption = captionLines(y - 6, [W - 60, W - 150])
    y += 2 * CAPTION_LINE + 6
  }
  const postH = W * ratio
  const post = { x: 0, y, w: W, h: postH, r: 0 }
  y += postH
  // Instagram centres a carousel's dots IN the action row, between the icons
  // on the left and the bookmark on the right. Facebook's and LinkedIn's row
  // is three columns wide, and the dots landed on "comment": they get a strip
  // of their own under the picture.
  const dotsOwnRow = captionAbove && n > 1
  const dotsY = dotsOwnRow ? y + DOTS_H / 2 : y + ACTIONS_H / 2
  if (dotsOwnRow) y += DOTS_H
  const actionsY = y + ACTIONS_H / 2
  const actions: SocialLayout['actions'] = captionAbove
    ? // Like, comment, share: three equal columns, each an icon and a word.
      (['like', 'comment', 'share'] as const).map((icon, i) => {
        const cx = (W / 3) * (i + 0.5) - 22
        return { icon, c: { cx, cy: actionsY, r: 10 }, label: { x: cx + 16, y: actionsY - 4, w: 36, h: 8, r: 4 } }
      })
    : [
        { icon: 'heart', c: { cx: 26, cy: actionsY, r: 11 }, label: null },
        { icon: 'comment', c: { cx: 62, cy: actionsY, r: 11 }, label: null },
        { icon: 'share', c: { cx: 98, cy: actionsY, r: 11 }, label: null },
        { icon: 'save', c: { cx: W - 26, cy: actionsY, r: 11 }, label: null },
      ]
  const dots = dotsAt(n, W / 2, dotsY)
  y += ACTIONS_H
  if (!captionAbove) {
    caption = captionLines(y - 6, [84, W - 60, W - 170])
    y += 3 * CAPTION_LINE
  }
  // The next post, as far as the tab bar lets it show.
  const nextTop = y + 14
  const next =
    nextTop + AUTHOR_H + 24 <= tabY
      ? (() => {
          const row = authorRow(nextTop)
          return { ...row, picture: { x: 0, y: nextTop + AUTHOR_H, w: W, h: Math.max(0, tabY - nextTop - AUTHOR_H), r: 0 } }
        })()
      : null
  return {
    mode: 'feed',
    post,
    avatar,
    author,
    appBar,
    caption,
    actions,
    dots,
    progress: [],
    counter: n > 1 ? { x: W - 58, y: post.y + 12, w: 44, h: 24, r: 12 } : null,
    reply: null,
    tabBar,
    next,
  }
}

function storyLayout(ratio: number, n: number): SocialLayout {
  // Under the status bar, full width, rounded like the app's own card; the
  // reply field sits between it and the home indicator.
  const top = STATUS_BAR_H
  const room = H - HOME_BAR_H - REPLY_H - 16 - top
  const w = Math.min(W, room / ratio)
  const h = w * ratio
  const post = { x: (W - w) / 2, y: top, w, h, r: 14 }
  const gap = 4
  const segW = (post.w - 16 - gap * (n - 1)) / n
  const progress = Array.from({ length: n }, (_, i) => ({ x: post.x + 8 + i * (segW + gap), y: post.y + 10, w: segW, h: 3, r: 1.5 }))
  const { avatar, author } = authorRow(post.y + 18, post.x + 6)
  const replyY = post.y + post.h + 10
  return {
    mode: 'story',
    post,
    avatar: { ...avatar, r: 14 },
    author,
    appBar: null,
    caption: [],
    actions: [
      { icon: 'heart', c: { cx: W - 72, cy: replyY + REPLY_H / 2, r: 11 }, label: null },
      { icon: 'share', c: { cx: W - 32, cy: replyY + REPLY_H / 2, r: 11 }, label: null },
    ],
    dots: [],
    progress,
    counter: null,
    reply: { x: 14, y: replyY, w: W - 14 - 100, h: REPLY_H, r: REPLY_H / 2 },
    tabBar: null,
    next: null,
  }
}

/** The platform a screen type posts to, or null for any other type. */
export function platformOf(theme: string | undefined): SocialPlatform | null {
  return theme === 'instagram' || theme === 'facebook' || theme === 'linkedin' ? theme : null
}
