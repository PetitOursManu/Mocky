import { api } from './api'

const PROJECTS_KEY = 'mocky.projects.v1'
const DESIGN_KEY = 'mocky.design.v1'

let enabled = false
let timer: number | null = null

/** Turn server-sync on/off (on when signed in). */
export function enableSync(on: boolean) {
  enabled = on
}

/** Debounced push of the local projects + design to the server. */
export function scheduleSync() {
  if (!enabled) return
  if (timer) clearTimeout(timer)
  timer = window.setTimeout(pushNow, 800)
}

export async function pushNow() {
  if (!enabled) return
  try {
    await api.putData(localStorage.getItem(PROJECTS_KEY), localStorage.getItem(DESIGN_KEY))
  } catch {
    /* offline / transient — will retry on the next change */
  }
}

/**
 * On sign-in (or startup while signed in): if the server has data, adopt it
 * locally; otherwise push the current local data up (so a new account keeps
 * whatever you already made). Returns true when local storage was changed
 * (the caller should reload so the running stores pick it up).
 */
export async function reconcileOnLogin(): Promise<boolean> {
  const server = await api.getData()
  const localProjects = localStorage.getItem(PROJECTS_KEY)
  const localDesign = localStorage.getItem(DESIGN_KEY)
  const hasServerProjects = server.projects && server.projects !== 'null' && server.projects !== '[]'

  if (hasServerProjects) {
    const changed = server.projects !== localProjects || (server.design ?? '') !== (localDesign ?? '')
    if (server.projects != null) localStorage.setItem(PROJECTS_KEY, server.projects)
    if (server.design != null) localStorage.setItem(DESIGN_KEY, server.design)
    return changed
  }
  await api.putData(localProjects, localDesign)
  return false
}
