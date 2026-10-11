import type { Project } from '../project'
import {
  companionSection,
  knownRoutes,
  MAX_COMPANIONS,
  missingRoutes,
  readFlow,
  resolveRoute,
  routeFor,
} from '../flows'
import { runNewScreen, type NewScreenHooks, type NewScreenRequest } from './newScreen'

/** How far a flow is followed: the screen asked for, its pages, their pages. */
const MAX_DEPTH = 2

/** A screen created on its own because the flow needed it. */
export interface CompanionScreen {
  route: string
  screenId: string
}

/**
 * The screens a working prototype needs and nobody asked for by name.
 *
 * A sign-in form whose code says `MockyFlow.go("account")` is half a flow
 * until "account" exists — and it is the model that wrote the sign-in that
 * knows what comes next, not the person who asked for a sign-in. So after a
 * generation, the new screen's code is READ (`readFlow`, with Babel — I1), and
 * every route it opens that no screen answers becomes a screen of its own,
 * generated through the same pipeline as any other (`runNewScreen`), told
 * where it sits: its route, the screen that leads to it and the words clicked
 * there, and the exact shared data that screen writes (`companionSection`).
 *
 * Decided with the user: automatic, not proposed. Bounded, because every
 * companion is a full generation: `MAX_COMPANIONS` in all, `MAX_DEPTH` levels
 * (a cart's checkout's confirmation is the deepest a shop needs), the first
 * routes in the order the code opens them. A companion never runs Muse or
 * Motion Ultra — the direction is the project's, and the reference screen
 * carries the look — so it adds no dossier and no picture series to the bill.
 *
 * Failures follow the pipeline's rules: an abort ends the loop as it ends any
 * generation; any other error stops creating companions and is said, while
 * the screens already made stay.
 */
export async function runFlowCompanions(
  base: NewScreenRequest,
  hooks: NewScreenHooks,
  originId: string,
  originCode: string,
  opts: {
    /** The project NOW: the run that just ended may have set its direction. */
    getProject: () => Project
    /** The name a companion's route is shown as, in the person's language. */
    nameFor: (route: string) => string
  },
): Promise<CompanionScreen[]> {
  const created: CompanionScreen[] = []
  // The code travels with each step: the caller's screens are a render behind
  // (see NewScreenOutcome.code), and a screen read there may still be empty.
  const queue: { fromId: string; code: string; depth: number }[] = [{ fromId: originId, code: originCode, depth: 0 }]
  const { t } = hooks

  while (queue.length && created.length < MAX_COMPANIONS) {
    const { fromId, code, depth } = queue.shift()!
    const screens = hooks.currentScreens()
    const from = screens.find((s) => s.id === fromId)
    if (!from || from.page || !code.trim()) continue
    const reading = await readFlow(code)
    const made = new Set(created.map((c) => c.route))
    const missing = missingRoutes(screens, reading).filter((m) => !made.has(m.route))
    if (!missing.length) continue

    // The screen that opens the flow answers to a route of its own, so the
    // pages it leads to can lead back.
    const originRoute = routeFor(from, screens)
    if (from.route !== originRoute) hooks.updateScreen(from.id, { route: originRoute })

    for (const m of missing) {
      if (created.length >= MAX_COMPANIONS) break
      if (hooks.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const now = hooks.currentScreens()
      // Made meanwhile, by an earlier companion of the same run.
      if (created.some((c) => c.route === m.route) || resolveRoute(now, m.route)) continue

      const name = opts.nameFor(m.route)
      hooks.notice(t('flows.creating', { name, n: created.length + 1 }))
      const routes = [...new Set([...knownRoutes(now), originRoute, m.route])]
      const outcome = await runNewScreen(
        {
          ...base,
          text: m.label
            ? t('flows.companionPromptVia', { name, origin: from.name, label: m.label })
            : t('flows.companionPrompt', { name, origin: from.name }),
          name,
          route: m.route,
          flows: true,
          flowContext: companionSection({
            route: m.route,
            originName: from.name,
            originRoute,
            label: m.label,
            reading,
            routes,
          }),
          project: opts.getProject(),
          screens: now,
          // What belonged to the request that was typed, and not to the pages
          // it leads to: its pictures, its screenshots, its one-shot switches.
          images: [],
          annotationCount: 0,
          site: null,
          redesign: false,
          museConfig: { ...base.museConfig, enabled: false },
          ultraActive: false,
          pinnedImages: [],
          pinnedVideo: undefined,
          providedPictures: undefined,
          pictureSubject: undefined,
          themeId: null,
          pageFormatId: null,
        },
        hooks,
      )
      created.push({ route: m.route, screenId: outcome.screenId })
      if (depth + 1 < MAX_DEPTH && outcome.code && !outcome.error) {
        queue.push({ fromId: outcome.screenId, code: outcome.code, depth: depth + 1 })
      }
    }
  }
  return created
}
