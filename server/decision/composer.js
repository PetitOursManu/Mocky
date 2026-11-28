// The composer's Auto mode: the decision model says which of the composer's
// options a NEW screen should run with (docs/decision-model.md, "The composer's
// Auto mode").
//
// Every option is a yes/no about the request, which is exactly what Jev is for:
// a probability, not a paragraph. The browser says which options it can turn on
// at all (`offered`) — a document has no Motion Ultra and no flow, a project
// with no direction has nothing to redesign — and only those are asked, so an
// answer can never switch on what the composer would not have drawn.
//
// What is NOT asked, on purpose:
// - the pictures. Decided with the user: in Auto they default to the free
//   libraries, and the person can still pick "AI" without leaving Auto. A paid
//   picture is a choice a person makes, never a guess.
// - the brand. It is the project's identity, not a way of writing one screen;
//   a guess there would put a client's page in another client's colours.
// - the rules and the captures: they are things a person brings.
//
// Invariant Q5 holds as everywhere: the request is DATA, it travels in the
// `state`, never in a question's instructions.
import { langOf } from './grid.js'
import { SCREEN_TYPES } from '../mcp/screen-types.js'

/** The options Auto may decide, in the order the composer draws them. */
export const AUTO_OPTIONS = ['redesign', 'creative', 'creations', 'muse', 'ultra', 'flows', 'diagrams']

/**
 * The probability of "yes" an option needs to be switched on. Higher for the
 * ones that cost a run several more calls (a series of pictures, companion
 * screens, a creation and its review) or rewrite the project's direction: a
 * coin toss is not a reason to spend them.
 */
export const AUTO_THRESHOLDS = {
  redesign: 0.6,
  creative: 0.5,
  creations: 0.6,
  muse: 0.5,
  ultra: 0.6,
  flows: 0.6,
  diagrams: 0.5,
}

/**
 * The probability the chosen screen type needs: under it the composer stays on
 * "no type", which is what it was before Auto chose anything — a wrong type
 * (a flyer read as a landing page) costs a whole generation in the wrong shape.
 */
export const AUTO_TYPE_THRESHOLD = 0.5

const QUESTIONS = {
  redesign: {
    instructions:
      'The project already has a visual direction. Does the request ask to REPLACE it with a new one — a new style, palette, mood, typography or a rebrand? Adding a screen in the current look is no.',
    yes: 'The request asks for a new look for the project.',
    no: 'The request adds or describes a screen and keeps the current look.',
  },
  creative: {
    instructions:
      'Does the request ask for, or clearly invite, a bold, unconventional, editorial or experimental layout rather than a standard one?',
    yes: 'Bold, surprising, editorial, artistic, award-style composition is wanted or fits.',
    no: 'A clear, conventional, functional layout is what fits.',
  },
  creations: {
    instructions:
      'Does the request name a specific unusual visual element that a standard component kit would not have — a custom animation, transition, picture-frame shape or bespoke interactive element?',
    yes: 'A specific unusual effect or element is named.',
    no: 'Nothing unusual is named; standard components cover it.',
  },
  muse: {
    instructions:
      'Should a design-research pass run before this screen is written — web inspiration, an art-direction dossier and realistic copy? It is worth it for a brand-facing page whose look is still open (landing page, product, portfolio, restaurant, event, poster). It is not worth it for a plain utility screen (form, settings, table, admin), nor when the project already has a direction and the request only adds a page to it.',
    yes: 'Research and an art direction would improve this screen.',
    no: 'The screen is utilitarian, or its look is already settled.',
  },
  ultra: {
    instructions:
      'Does the request call for a rich, cinematic, scroll-driven showcase page — immersive storytelling, a series of art-directed pictures, striking animated sections — such as a product launch, a luxury brand or a portfolio? An app screen, a dashboard, a form or a plain page is no.',
    yes: 'A cinematic, picture-led showcase page.',
    no: 'A functional or plain page.',
  },
  diagrams: {
    instructions:
      'This is a printed or posted document (a flyer, a poster, a menu, a post…). Should its information be SHOWN as diagrams — an infographic: a programme as a timeline, steps as a process, figures as a chart or key numbers, parts of a whole, a comparison — rather than only written as text? Yes when the request asks for diagrams, an infographic, a visual explanation, or gives structured facts that read better drawn. No for a short announcement whose facts are a date, a place and a price.',
    yes: 'The information should be drawn as diagrams.',
    no: 'Text and pictures are enough.',
  },
  flows: {
    instructions:
      'Is this screen the start of an interactive flow that leads to other pages the request implies — a sign-in leading to an account, a shop leading to a cart and a checkout, a multi-step form — rather than a standalone page?',
    yes: 'It leads to other pages a working prototype would need.',
    no: 'A standalone page or screen.',
  },
}

const clip = (s, n) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '')

/** What travels from the browser, bounded and nothing else. */
export function composerInputFrom(body) {
  const b = body && typeof body === 'object' ? body : {}
  const p = b.project && typeof b.project === 'object' ? b.project : {}
  const offered = new Set((Array.isArray(b.offered) ? b.offered : []).filter((o) => AUTO_OPTIONS.includes(o)))
  // Nothing to redesign in a project with no direction: the first screen writes it.
  if (!p.hasDirection) offered.delete('redesign')
  return {
    lang: langOf(b.lang),
    text: clip(b.text, 4000),
    screenType: clip(b.screenType, 60) || null,
    // Asked only when the composer has no type: one the person chose is theirs.
    chooseType: b.chooseType === true && !clip(b.screenType, 60),
    // The video sources this account can use; asked only with at least one.
    videoChoices: (() => {
      const got = new Set((Array.isArray(b.videoChoices) ? b.videoChoices : []).filter((c) => VIDEO_CHOICES.includes(c) && c !== 'none'))
      return got.size ? ['none', ...VIDEO_CHOICES.filter((c) => got.has(c))] : []
    })(),
    document: b.document === true,
    site: b.site === 'reproduce' || b.site === 'redesign' ? b.site : null,
    project: {
      name: clip(p.name, 200),
      hasDirection: p.hasDirection === true,
      screens: Math.max(0, Math.min(999, Math.floor(Number(p.screens) || 0))),
    },
    offered: AUTO_OPTIONS.filter((o) => offered.has(o)),
  }
}

/** Where the hero's scroll video comes from, as Auto may decide it. Never "ai": a paid clip is asked of the person. */
export const VIDEO_CHOICES = ['none', 'free', 'motion', 'ai']
export const VIDEO_QUESTION = 'hero_video'
export const AUTO_VIDEO_THRESHOLD = 0.5

const VIDEO_MEANS = {
  none: 'no video: the page is better with still pictures, or the screen is functional',
  free: 'a free stock clip (Pexels, Pixabay) of a real scene, scrubbed by the scroll — for a real place, product or activity a camera could film',
  motion: 'a generated motion-graphics film (shapes, type-free patterns, light, abstract movement), scrubbed by the scroll — for a brand, a tech product or an atmosphere',
  ai: 'an AI-generated cinematic clip made for this page (paid, minutes) — when only a bespoke filmed shot would do',
}

/** The video question, over the choices this account can actually have. */
export function videoQuestion(choices) {
  const options = Object.fromEntries(choices.map((c) => [c, VIDEO_MEANS[c]]))
  return {
    id: VIDEO_QUESTION,
    type: 'choice',
    instructions:
      'Should the top of this page carry a video that plays as the visitor scrolls, and of which kind? A brand-facing page (a landing page, a product, an event, a portfolio) may gain from one; a utility screen (a form, settings, a table, a dashboard) never does.',
    options,
  }
}

/** The type question's id: not an option name, so it cannot collide with one. */
export const TYPE_QUESTION = 'screen_type'

/**
 * Which screen type the request is — the composer's own list
 * (mcp/screen-types.js, held to SCREEN_THEME_IDS), plus "none" for an ordinary
 * screen. One choice, so Jev answers with a probability per type.
 */
export function typeQuestion() {
  return {
    id: TYPE_QUESTION,
    type: 'choice',
    instructions:
      'Which kind of screen or document does the request ask for? Pick the one type that fits it best; "none" when it is an ordinary app or web screen that none of the others describes.',
    options: { ...SCREEN_TYPES, none: 'an ordinary app or web screen that none of the other types describes' },
  }
}

/** The questions for what was offered — ids are the option names — and the type when it is to be chosen. */
export function composerQuestions(offered, chooseType = false, videoChoices = []) {
  const checks = offered.filter((id) => QUESTIONS[id]).map((id) => ({ id, type: 'check', ...QUESTIONS[id] }))
  return [...(chooseType ? [typeQuestion()] : []), ...checks, ...(videoChoices.length > 1 ? [videoQuestion(videoChoices)] : [])]
}

/** The content a decision reads: the request and what the composer knows around it. */
export function composerState(input) {
  return {
    request: input.text,
    screenType: input.screenType || 'not chosen',
    printedDocument: input.document,
    ...(input.site ? { existingSiteScreenshots: input.site } : {}),
    project: {
      name: input.project.name || undefined,
      hasVisualDirection: input.project.hasDirection,
      screensAlready: input.project.screens,
    },
  }
}

/**
 * Ask, and read the answers into on/off per option. An option the engine did
 * not answer is listed in `unanswered` and absent from `options`: the composer
 * keeps its Manual value for it (src/lib/composerAuto.ts, `runOptionsFor`).
 *
 * @param {{decide:Function, engines:()=>string[]}} decider  decide.js
 * @returns {Promise<{options:Record<string,{on:boolean,p:number,confidence:number|null}>, unanswered:string[], engines:string[]}>}
 */
export async function decideComposer(input, { decider, signal }) {
  const questions = composerQuestions(input.offered, input.chooseType, input.videoChoices)
  if (!questions.length || !input.text) return { options: {}, unanswered: [], engines: [] }
  const answers = await decider.decide({ state: composerState(input), questions, signal })
  const options = {}
  const unanswered = []
  let screenType = null
  let video = null
  for (const q of questions) {
    const a = answers[q.id]
    if (q.id === VIDEO_QUESTION) {
      if (a && a.type === 'choice') {
        const p = a.probabilities?.[a.value] ?? a.confidence ?? null
        // Under the threshold, no video: a clip is minutes of a run.
        video = { value: p == null || p >= AUTO_VIDEO_THRESHOLD ? a.value : 'none', p }
      }
      continue
    }
    if (q.id === TYPE_QUESTION) {
      if (a && a.type === 'choice') {
        const p = a.probabilities?.[a.value] ?? a.confidence ?? null
        screenType = { value: a.value, p, on: a.value !== 'none' && (p == null || p >= AUTO_TYPE_THRESHOLD) }
      }
      continue
    }
    if (!a || a.type !== 'check') {
      unanswered.push(q.id)
      continue
    }
    options[q.id] = { on: a.value >= AUTO_THRESHOLDS[q.id], p: a.value, confidence: a.confidence ?? null }
  }
  return { options, unanswered, engines: decider.engines(), ...(screenType ? { screenType } : {}), ...(video ? { video } : {}) }
}
