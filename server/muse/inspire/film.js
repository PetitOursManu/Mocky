/**
 * Whether a screen gets a Motion film — decided by the dossier call itself.
 *
 * ── Why here ────────────────────────────────────────────────────────────────
 *
 * Motion used to be a checkbox and a kind selector in the composer, which asked
 * a person who does not know what Remotion is to decide, before writing a word,
 * whether their page wanted a rendered film and which of eight kinds. The art
 * director is already being asked to read the request and decide how the page
 * looks and speaks; whether its first impression should MOVE is the same kind of
 * decision, so it is one more field on the same answer — no extra call.
 *
 * ── Two modes, and the prudence is the default ─────────────────────────────
 *
 * `auto` asks for a film only when the request plainly calls for one: a film is a
 * model call and minutes of render, and a settings page that arrives three
 * minutes late with a spinning torus on it is the failure this has to avoid.
 * `force` is the composer's "Animé" button — the person said so, and the answer
 * must be yes. The server settles both rules after the model answers
 * (`settleFilm`), so a model that ignores them cannot overrule the person.
 *
 * ── What the model is offered ──────────────────────────────────────────────
 *
 * Only the kinds this account can actually render (the panel read them off
 * `/api/video/status`), intersected with the enum `kinds.js` owns. The prose for
 * each is `kinds.js`'s own `what` and `right`, so the dossier and the compose
 * prompt describe a kind in the same words.
 */
import { MOTION_KINDS, MOTION_KIND_SPECS } from '../../video/kinds.js'

export const FILM_MODES = ['auto', 'force']

/** A section role, as the generation prompt names them: `hero`, `product`, `stats`… */
const SECTION = /^[a-z][a-z0-9-]{0,23}$/

/**
 * The request's `motion`, read strictly: a mode out of two, and kinds out of the
 * server's own enum. Anything else is no request — the dossier is written exactly
 * as it was before Motion existed (M1's spirit: nothing asked, nothing changed).
 */
export function readMotionRequest(raw) {
  if (!raw || typeof raw !== 'object') return null
  const mode = FILM_MODES.includes(raw.mode) ? raw.mode : null
  if (!mode) return null
  const offered = new Set(Array.isArray(raw.kinds) ? raw.kinds.filter((k) => typeof k === 'string') : [])
  const kinds = MOTION_KINDS.filter((k) => offered.has(k))
  return kinds.length ? { mode, kinds } : null
}

/** The lines the system prompt gains when a film may be decided. Server-written only. */
export function filmPromptLines(motion) {
  if (!motion) return []
  return [
    '- Film: this screen MAY carry one short rendered film — a hero that moves, the world turning, a figure arriving. Decide it in `film`.',
    motion.mode === 'force'
      ? '  The user pressed "Animated": `film.wanted` MUST be true. Choose the kind that serves this screen best.'
      : '  Be CONSERVATIVE: `film.wanted` is false unless the request asks for motion, video, animation or an immersive first impression, OR the one idea of the screen is plainly stronger moving (a launch, a key figure, a worldwide presence, a brand mark). A form, a settings page, a dashboard, a pricing table, documentation: false.',
    '  When wanted, `film.kind` is exactly one of:',
    ...motion.kinds.map((k) => `  - ${k}: ${MOTION_KIND_SPECS[k].what} Right when ${MOTION_KIND_SPECS[k].right}`),
    '  `film.section` is the ONE section it belongs in, as a single lowercase word: hero, product, features, stats, coverage, cta, footer… `film.why` is one short sentence.',
  ]
}

/** The schema fragment, present only when a film may be decided. */
export function filmJsonSchema(motion) {
  if (!motion) return null
  return {
    type: 'object',
    properties: {
      wanted: { type: 'boolean' },
      kind: { type: 'string', enum: [...motion.kinds] },
      section: { type: 'string' },
      why: { type: 'string' },
    },
    required: ['wanted'],
  }
}

/**
 * The decision, settled by the server's rules whatever the model wrote.
 *
 * - No request: no decision at all (`undefined`), so a dossier from a composer
 *   that did not ask carries nothing.
 * - `force`: always wanted. A kind the account cannot render, or none, becomes
 *   the first offered — `hero` when it is on offer, since the enum starts there.
 * - `auto`: wanted only when the model said so AND named a kind on offer. An
 *   unusable kind is a no rather than a guess, because the prudence is the point.
 */
export function settleFilm(raw, motion) {
  if (!motion) return undefined
  const r = raw && typeof raw === 'object' ? raw : {}
  const named = typeof r.kind === 'string' && motion.kinds.includes(r.kind) ? r.kind : null
  const wanted = motion.mode === 'force' ? true : r.wanted === true && named !== null
  if (!wanted) return { wanted: false }
  const section = typeof r.section === 'string' ? r.section.trim().toLowerCase() : ''
  return {
    wanted: true,
    kind: named ?? motion.kinds[0],
    ...(SECTION.test(section) ? { section } : {}),
    ...(typeof r.why === 'string' && r.why.trim() ? { why: r.why.trim().slice(0, 200) } : {}),
  }
}
