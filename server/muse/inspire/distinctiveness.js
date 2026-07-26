// Distinctiveness self-critique (Muse §5.3). After the Dossier is built, a cheap
// LLM pass scores 1–5 how distinguishable the direction is from a generic
// default template; if the score is ≤3, it revises the Concept + accent ONCE.
// Best-effort (M3): with no LLM or on any failure it returns the dossier
// unchanged — it never blocks a run.

const CRITIQUE_SCHEMA = {
  type: 'object',
  properties: { score: { type: 'number' }, reason: { type: 'string' } },
  required: ['score'],
}
const REVISE_SCHEMA = {
  type: 'object',
  properties: { concept: { type: 'string' }, accentHex: { type: 'string' } },
  required: ['concept'],
}

function normHex(h) {
  if (typeof h !== 'string' || !/^#?[0-9a-fA-F]{6}$/.test(h)) return null
  return h.startsWith('#') ? h.toLowerCase() : `#${h.toLowerCase()}`
}

/**
 * @param {((req:object)=>Promise<any>)|null} llm
 * @param {object} dossier  a validated dossier (mutated in place on revision)
 * @param {{prompt:string}} ctx
 * @param {{onNotice?:Function}} [opts]
 * @returns {Promise<object>} the (possibly revised) dossier
 */
export async function refineDistinctiveness(llm, dossier, ctx, opts = {}) {
  const onNotice = opts.onNotice || (() => {})
  if (!llm || !dossier) return dossier
  try {
    const critique = await llm({
      system:
        'You are a strict design critic. Score 1–5 how DISTINGUISHABLE this art direction is from a generic default template (1 = totally generic "modern/clean/professional", 5 = highly distinctive with a clear point of view). Return JSON {score, reason}.',
      user: `Concept: ${dossier.concept}\nPalette: ${(dossier.tokens?.colors || []).map((c) => c.hex).join(', ')}\nHeadline: ${dossier.voice?.headline || ''}`,
      schema: CRITIQUE_SCHEMA,
      options: { num_predict: 200, temperature: 0.2 },
    })
    const score = Number(critique?.score)
    dossier.__distinctiveness = Number.isFinite(score) ? score : null
    if (!Number.isFinite(score) || score > 3) return dossier // distinctive enough

    onNotice(`Muse: direction scored ${score}/5 — revising once for distinctiveness`)
    const revised = await llm({
      system:
        'Revise this art direction to be MORE distinctive and specific. Avoid all generic filler. Return JSON {concept, accentHex}: a sharper 2–3 sentence concept and ONE bolder accent color hex (#rrggbb) that still fits the brief.',
      user: `Brief: ${ctx.prompt}\nCurrent concept: ${dossier.concept}\nWhy it reads generic: ${critique.reason || 'n/a'}`,
      schema: REVISE_SCHEMA,
      options: { num_predict: 500, temperature: 0.85 },
    })
    if (revised?.concept && typeof revised.concept === 'string') dossier.concept = revised.concept
    const hex = normHex(revised?.accentHex)
    if (hex) {
      const accent =
        (dossier.tokens?.colors || []).find((c) => c.role === 'accent') ||
        (dossier.tokens?.colors || []).find((c) => /accent|primary|brand/i.test(c.label))
      if (accent) accent.hex = hex
    }
    dossier.__revised = true
    return dossier
  } catch (err) {
    onNotice(`Muse: distinctiveness pass skipped (${err instanceof Error ? err.message : String(err)})`)
    return dossier
  }
}
