/**
 * `/p/<projectId>?screen=<screenId>` — a link to a project of the signed-in
 * account, optionally to one screen in it.
 *
 * It exists for the MCP server (plans/mcp-serveur.md): a design made from
 * Claude or ChatGPT comes back with a link, and the person clicks it. It is not
 * a share link and must never behave like one. It carries ids and nothing
 * else, and what it opens is decided by the session: signed out, the sign-in
 * screen comes first and the link is honoured after it; signed in to an account
 * that does not own the project, it opens nothing and says so — in the same
 * words whether the project belongs to someone else or does not exist, so a
 * link cannot be used to learn which ids are taken.
 *
 * Read from the path, like `/s/<token>` (lib/share.ts): Mocky has no router,
 * and one would be a larger change than this link.
 */

/** What a project link names. */
export interface ProjectLink {
  projectId: string
  screenId?: string
}

/**
 * The ids `newId()` makes are base 36; anything of a sane shape is accepted, so
 * a project created by an older build or an import still has a link. The shape
 * check keeps a stray `/p/anything/else` from being read as one.
 */
const ID = /^[A-Za-z0-9_-]{4,64}$/

/** The link in this URL, or null when this is an ordinary Mocky page. */
export function projectLinkFromLocation(
  pathname = window.location.pathname,
  search = window.location.search,
): ProjectLink | null {
  const m = /^\/p\/([^/]+)\/?$/.exec(pathname)
  if (!m || !ID.test(m[1])) return null
  const screen = new URLSearchParams(search).get('screen')
  return screen && ID.test(screen) ? { projectId: m[1], screenId: screen } : { projectId: m[1] }
}

/** The link to a project (and a screen in it) on the Mocky at `origin`. */
export function projectLinkUrl(origin: string, link: ProjectLink): string {
  const base = `${origin.replace(/\/+$/, '')}/p/${encodeURIComponent(link.projectId)}`
  return link.screenId ? `${base}?screen=${encodeURIComponent(link.screenId)}` : base
}

/**
 * Where a link waits while the person signs in.
 *
 * The URL alone does not survive that: SSO goes to Dashy and comes back on
 * `/sso/dashy/callback`, and the first sign-in on a device reloads once to pick
 * up the merged projects. sessionStorage does — and stays in this tab, so a
 * link clicked in one tab does not open a project in another.
 */
const PENDING_KEY = 'mocky.pendingProjectLink'

export function rememberProjectLink(link: ProjectLink): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(link))
  } catch {
    /* private mode: the link works only if no reload comes between */
  }
}

/** The waiting link, removed as it is read: a link is followed once. */
export function takeProjectLink(): ProjectLink | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    sessionStorage.removeItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ProjectLink>
    if (typeof parsed.projectId !== 'string' || !ID.test(parsed.projectId)) return null
    return typeof parsed.screenId === 'string' && ID.test(parsed.screenId)
      ? { projectId: parsed.projectId, screenId: parsed.screenId }
      : { projectId: parsed.projectId }
  } catch {
    return null
  }
}
