/**
 * Every area dictionary, merged.
 *
 * Adding an area means adding a file next to this one and one line here. Nothing
 * else in the app changes — components only ever call `t('area.key')`.
 */
import { app } from './app'
import { auth } from './auth'
import { canvas } from './canvas'
import { project } from './project'
import { muse } from './muse'
import { library } from './library'
import { design } from './design'
import { settings } from './settings'
import { preview } from './preview'

const AREAS = [app, auth, canvas, project, muse, library, design, settings, preview]

export const partsFr: Record<string, string> = Object.assign({}, ...AREAS.map((a) => a.fr))
export const partsEn: Record<string, string> = Object.assign({}, ...AREAS.map((a) => a.en))

/** Exposed for the parity test, which checks each area separately. */
export const AREA_DICTS = { app, auth, canvas, project, muse, library, design, settings, preview }
