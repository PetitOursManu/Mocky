// What `audit_project` hands an assistant: the run of server/decision/audit.js,
// in words for the person and as a whitelisted object for the assistant.
//
// A whitelist for the reason every MCP answer is one (X4): a field added to a
// run tomorrow stays home until somebody adds it here. And the words keep the
// rules the panel keeps — observations apart from recommendations, a doubt
// printed beside its number, "not found" never written as "absent".

const fmt = (n) => (typeof n === 'number' ? (Math.round(n * 10) / 10).toString() : '—')
const signed = (n) => `${n > 0 ? '+' : ''}${fmt(n)}`

function doubt(c, fr) {
  if (c == null) return fr ? ' (confiance non mesurée)' : ' (confidence not measured)'
  if (c < 0.5) return fr ? ' (incertain)' : ' (uncertain)'
  return ''
}

/** The report, as text the assistant can relay. */
export function auditReport(run, project, lang) {
  const fr = lang !== 'en'
  const grid = run.grid
  const pageName = (id) => run.pages.find((p) => p.id === id)?.name || id
  const label = (id) => (id === 'expected' ? grid.label.expected : grid.criteria.find((c) => c.id === id)?.label || id)
  const engine = run.engines.includes('jev')
    ? run.engines.includes('llm')
      ? fr ? 'modèle de décision (Jev), et modèle de Muse en relais' : 'decision model (Jev), with Muse’s model as a relay'
      : fr ? 'modèle de décision (Jev)' : 'decision model (Jev)'
    : fr ? 'modèle de Muse (confiance non mesurée)' : 'Muse’s model (confidence not measured)'

  const lines = [
    `${project.name || (fr ? '(sans titre)' : '(untitled)')} — ${fr ? 'audit de' : 'audit of'} ${run.pages.length} page${run.pages.length > 1 ? 's' : ''}`,
    `${fr ? 'Note d’ensemble' : 'Overall'} : ${fmt(run.overall)}/4 · ${fr ? 'évalué par' : 'evaluated by'} ${engine}`,
  ]
  if (grid.goal) lines.push(`${fr ? 'Objectif' : 'Goal'} : ${grid.goal}`)
  if (run.delta?.comparable && typeof run.delta.overall === 'number') {
    lines.push(fr ? `Depuis l’audit précédent : ${signed(run.delta.overall)}` : `Since the previous audit: ${signed(run.delta.overall)}`)
  } else if (run.delta && !run.delta.comparable) {
    lines.push(fr ? 'Grille différente de l’audit précédent : pas de comparaison.' : 'A different grid from the previous audit: no comparison.')
  }

  const items = (title, list) => {
    if (!list.length) return
    lines.push('', title)
    for (const it of list) {
      const refs = [...it.pages.map(pageName), ...it.criteria.map(label)]
      lines.push(`- ${it.priority ? `[${it.priority}] ` : ''}${it.text}${refs.length ? ` (${refs.join(', ')})` : ''}`)
    }
  }
  items(fr ? 'Problèmes observés' : 'Observed problems', run.synthesis.problems)
  items(fr ? 'Améliorations prioritaires' : 'Priority improvements', run.synthesis.actions)
  items(fr ? 'Points forts' : 'Strengths', run.synthesis.strengths)

  lines.push('', fr ? 'Critères (0 à 4)' : 'Criteria (0 to 4)')
  for (const [id, v] of Object.entries(run.criteria || {})) {
    const d = run.delta?.comparable ? run.delta.criteria?.[id] : undefined
    lines.push(`- ${label(id)} : ${fmt(v)}${typeof d === 'number' && d !== 0 ? ` (${signed(d)})` : ''}${run.project[id] ? doubt(run.project[id].c, fr) : ''}`)
  }
  if (run.expected.length) {
    lines.push('', grid.label.expected)
    for (const e of run.expected) {
      const where = e.found === true ? (fr ? `trouvé sur « ${pageName(e.page)} »` : `found on “${pageName(e.page)}”`) : e.found === false ? (fr ? 'non trouvé' : 'not found') : fr ? 'sans réponse' : 'no answer'
      lines.push(`- ${e.label} : ${where}${doubt(e.c, fr)}`)
    }
  }
  lines.push(
    '',
    fr
      ? 'Limites : l’audit lit le code et les textes, pas le rendu ; un élément non trouvé n’est pas forcément absent ; une note ne garantit pas l’efficacité d’une page.'
      : 'Limits: the audit reads the code and the words, not the rendering; an element not found is not necessarily absent; a score does not guarantee a page works.',
  )
  return lines.join('\n')
}

/** The same run, as the fields an assistant may read — nothing else. */
export function auditStructured(run, project) {
  return {
    project_id: project.id,
    overall: run.overall,
    engines: run.engines,
    goal: run.grid.goal || null,
    criteria: run.grid.criteria.map((c) => ({ id: c.id, label: c.label, scope: c.scope, score: run.criteria?.[c.id] ?? null })),
    pages: run.pages.map((p) => ({ id: p.id, name: p.name, scores: p.scores })),
    expected: run.expected.map((e) => ({ label: e.label, found: e.found, page_id: e.page, confidence: e.c })),
    problems: run.synthesis.problems,
    improvements: run.synthesis.actions,
    strengths: run.synthesis.strengths,
    change_since_last: run.delta || null,
  }
}
