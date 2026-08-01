// Inspiration Engine orchestrator: Discover → Distill → Dossier. Emits stage
// progress (reused by the streaming UI in Phase 4). Never blocks (M3): missing
// fetcher/LLM just means fewer inputs; the dossier always resolves (LLM or the
// deterministic pattern fallback).
import { discover } from './discover.js'
import { distillAll } from './distill.js'
import { buildDossier, dossierToMarkdown } from './dossier.js'
import { refineDistinctiveness } from './distinctiveness.js'

/**
 * @param {object} args  { prompt, urls?, useFetch?, language?, projectName? }
 * @param {object} deps  { fetcher?, llm?|null, patterns, blacklist, onProgress?, onNotice? }
 * @returns {Promise<{dossier, markdown, cards, sources, patterns, notices, source}>}
 */
export async function runInspiration(args, deps) {
  const notices = []
  const onNotice = (m) => {
    notices.push(m)
    deps.onNotice?.(m)
  }
  const onProgress = deps.onProgress || (() => {})

  const patternHints = deps.patterns.match(args.prompt)
  let cards = []
  let sources = []

  if (args.useFetch !== false && deps.fetcher) {
    onProgress('discovering')
    const disc = await discover({ prompt: args.prompt, urls: args.urls }, { fetcher: deps.fetcher, onNotice })
    sources = disc.sources
    if (disc.fetched.length && deps.llm) {
      onProgress('distilling')
      cards = await distillAll(deps.llm, disc.fetched, { onNotice })
    } else if (disc.fetched.length && !deps.llm) {
      onNotice('Muse: fetched inspiration but no model configured — using patterns only')
    }
  }

  onProgress('dossier')
  let dossier = await buildDossier(
    deps.llm || null,
    {
      prompt: args.prompt,
      cards,
      patternHints,
      blacklist: deps.blacklist,
      language: args.language,
      // The user's own picture or clip, when one is selected — its measured
      // palette, and the bytes themselves if the model has vision.
      userMedia: args.userMedia,
    },
    { onNotice },
  )
  // Distinctiveness self-critique (§5.3) — one score + at most one revise.
  // Opt-out via args.distinctiveness === false. Best-effort, never blocks.
  if (deps.llm && args.distinctiveness !== false) {
    onProgress('refining')
    dossier = await refineDistinctiveness(deps.llm, dossier, { prompt: args.prompt }, { onNotice })
  }
  const markdown = dossierToMarkdown(dossier, { projectName: args.projectName })
  onProgress('done')

  return {
    dossier,
    markdown,
    cards,
    sources: sources.map((s) => ({ id: s.id, url: s.url })),
    patterns: patternHints.map((p) => ({ id: p.id, name: p.name })),
    notices,
    source: dossier.__source,
  }
}
