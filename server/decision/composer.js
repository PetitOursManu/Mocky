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

/** The options Auto may decide, in the order the composer draws them. */
export const AUTO_OPTIONS = ['redesign', 'creative', 'creations', 'muse', 'ultra', 'flows']

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
}

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

/** The questions for what was offered — ids are the option names. */
export function composerQuestions(offered) {
  return offered.filter((id) => QUESTIONS[id]).map((id) => ({ id, type: 'check', ...QUESTIONS[id] }))
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
  const questions = composerQuestions(input.offered)
  if (!questions.length || !input.text) return { options: {}, unanswered: [], engines: [] }
  const answers = await decider.decide({ state: composerState(input), questions, signal })
  const options = {}
  const unanswered = []
  for (const q of questions) {
    const a = answers[q.id]
    if (!a || a.type !== 'check') {
      unanswered.push(q.id)
      continue
    }
    options[q.id] = { on: a.value >= AUTO_THRESHOLDS[q.id], p: a.value, confidence: a.confidence ?? null }
  }
  return { options, unanswered, engines: decider.engines() }
}
