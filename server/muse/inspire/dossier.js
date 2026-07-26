// Dossier builder — the anti-slop core. Produces a Design Dossier that is a
// strict SUPERSET of DESIGN.md: the `## Tokens` section is emitted in the exact
// DESIGN.md format so src/lib/design.ts + designTokens.ts + the Vite export
// bridge keep working unchanged (regression-tested).
//
// Inputs: the user request + distilled InspirationCards + matched prompt-patterns
// + the anti-slop blacklist. Output: a structured dossier object AND its
// DESIGN-DOSSIER.md rendering. Cites which reference/pattern drove which choice
// (traceability = originality pressure, §3.3).
//
// Degrades (M3): with no LLM (offline / no key) or on any LLM failure it falls
// back to a deterministic pattern-based dossier — a Muse run never blocks.
import { z } from 'zod'

const ColorSchema = z.object({
  label: z.string(),
  hex: z.string().regex(/^#?[0-9a-fA-F]{3,8}$/),
  role: z.string().optional(),
})
export const DossierSchema = z.object({
  concept: z.string().default(''),
  references: z.array(z.object({ sourceUrl: z.string().optional(), note: z.string().optional() })).default([]),
  tokens: z
    .object({
      colors: z.array(ColorSchema).default([]),
      typography: z.object({ display: z.string().optional(), body: z.string().optional(), scaleFeel: z.string().optional() }).partial().default({}),
      spacing: z.string().optional(),
      radius: z.string().optional(),
    })
    .default({ colors: [] }),
  layoutGrammar: z.array(z.string()).default([]),
  motionLanguage: z.array(z.object({ name: z.string(), description: z.string().optional() })).default([]),
  voice: z
    .object({
      tone: z.string().optional(),
      headline: z.string().optional(),
      subheadline: z.string().optional(),
      valueProps: z.array(z.string()).default([]),
      ctaLabels: z.array(z.string()).default([]),
      footer: z.string().optional(),
    })
    .default({ valueProps: [], ctaLabels: [] }),
  imageryPlan: z
    .array(
      z.object({
        id: z.string(),
        slot: z.string().optional(),
        subject: z.string().optional(),
        style: z.string().optional(),
        lighting: z.string().optional(),
        aspectRatio: z.string().optional(),
        negative: z.string().optional(),
        prompt: z.string().optional(),
      }),
    )
    .default([]),
  forbidden: z.array(z.string()).default([]),
})

const DOSSIER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    concept: { type: 'string' },
    references: { type: 'array', items: { type: 'object', properties: { sourceUrl: { type: 'string' }, note: { type: 'string' } } } },
    tokens: {
      type: 'object',
      properties: {
        colors: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, hex: { type: 'string' }, role: { type: 'string' } }, required: ['label', 'hex'] } },
        typography: { type: 'object', properties: { display: { type: 'string' }, body: { type: 'string' }, scaleFeel: { type: 'string' } } },
        spacing: { type: 'string' },
        radius: { type: 'string' },
      },
    },
    layoutGrammar: { type: 'array', items: { type: 'string' } },
    motionLanguage: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } }, required: ['name'] } },
    voice: {
      type: 'object',
      properties: {
        tone: { type: 'string' },
        headline: { type: 'string' },
        subheadline: { type: 'string' },
        valueProps: { type: 'array', items: { type: 'string' } },
        ctaLabels: { type: 'array', items: { type: 'string' } },
        footer: { type: 'string' },
      },
    },
    imageryPlan: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' }, slot: { type: 'string' }, subject: { type: 'string' }, style: { type: 'string' },
          lighting: { type: 'string' }, aspectRatio: { type: 'string' }, negative: { type: 'string' }, prompt: { type: 'string' },
        },
        required: ['id'],
      },
    },
    forbidden: { type: 'array', items: { type: 'string' } },
  },
  required: ['concept', 'tokens', 'layoutGrammar', 'voice', 'imageryPlan', 'forbidden'],
}

function buildSystem() {
  return [
    'You are a world-class ART DIRECTOR. Design a DISTINCTIVE visual direction for ONE product, then return it as JSON matching the schema.',
    'You are given: the user request, distilled inspiration cards (vocabulary + grammar, NOT designs to copy), matched art-direction patterns, and a list of clichés to AVOID.',
    '',
    'Requirements:',
    '- Concept: 2–3 sentences of specific art direction. NEVER generic ("modern, clean, professional" is banned).',
    '- Tokens: a coherent palette (6–8 colors, each with `label` + `hex`). `tokens.radius` MUST be a single string like "rounded-xl" (NOT an object).',
    '- Voice & Copy: write REAL, specific copy — headline, subheadline, exactly 3 value props, CTA labels, footer line. CRITICAL: write ALL copy in the SAME LANGUAGE as the user request. Never use Lorem ipsum or filler.',
    '- Imagery Plan: an ARRAY; EACH item MUST include a short string `id` (e.g. "hero", "product-1") plus subject/style/lighting/aspectRatio/negative and a final ready-to-use generation prompt ending with "high quality, no text, no watermark".',
    '- References: an ARRAY of objects, each { sourceUrl, note }, citing which reference or pattern inspired which choice.',
    '- Forbidden: restate the key clichés to avoid for THIS project.',
    'Respond with ONLY the JSON object. No prose, no code fences.',
  ].join('\n')
}

function buildUser(ctx) {
  const cardLines = (ctx.cards || []).map((c, i) =>
    `Reference ${i + 1} (${c.sourceUrl || 'n/a'}): style=[${(c.styleAdjectives || []).join(', ')}]; palette=[${(c.palette || []).map((p) => p.hex).join(', ')}]; layout=[${(c.layoutGrammar || []).join('; ')}]; tone="${c.contentTone || ''}"; avoid=[${(c.avoid || []).join('; ')}]`,
  )
  const patternLines = (ctx.patternHints || []).map(
    (p) => `Pattern "${p.name}": ${p.description} | imagery: ${p.imageryStyle} | seed colors: ${(p.tokenSeeds?.colors || []).map((c) => `${c.label} ${c.hex}`).join(', ')}`,
  )
  return [
    `USER REQUEST: ${ctx.prompt}`,
    ctx.language ? `Write all copy in this language: ${ctx.language}` : 'Write all copy in the same language as the user request above.',
    '',
    'DISTILLED INSPIRATION (vocabulary + grammar only — do not copy any specific design):',
    cardLines.length ? cardLines.join('\n') : '(none — rely on the patterns below)',
    '',
    'MATCHED ART-DIRECTION PATTERNS:',
    patternLines.length ? patternLines.join('\n') : '(none)',
    '',
    'CLICHÉS TO AVOID (do not produce any of these):',
    (ctx.blacklist || []).map((b) => `- ${b}`).join('\n'),
  ].join('\n')
}

/** Merge card.avoid lists + the global blacklist, deduped. */
function mergedForbidden(ctx, dossierForbidden = []) {
  const set = new Set([...(ctx.blacklist || []), ...dossierForbidden])
  for (const c of ctx.cards || []) for (const a of c.avoid || []) set.add(a)
  return Array.from(set)
}

// --- tolerant coercion --------------------------------------------------------
// Real models drift from the exact schema shape (references as an object, radius
// as a nested object, imagery items missing `id`, colors as a map, motion items
// as strings). Normalize those common variants BEFORE zod so a good response is
// used instead of falling back to the pattern dossier.

function coerceRefs(v) {
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') {
    if ('sourceUrl' in v || 'note' in v) return [v]
    const vals = Object.values(v)
    if (vals.length && vals.every((x) => x && typeof x === 'object')) return vals
  }
  return []
}

function coerceRadius(v) {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object') {
    const s = Object.values(v).find((x) => typeof x === 'string')
    return s || 'rounded-xl'
  }
  return undefined
}

function pickHex(o) {
  const h = o.hex || o.value || o.color || o.hexValue
  return typeof h === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(h) ? (h.startsWith('#') ? h : `#${h}`) : null
}
function coerceColors(v) {
  const arr = Array.isArray(v)
    ? v
    : v && typeof v === 'object'
      ? Object.entries(v).map(([label, val]) => (typeof val === 'string' ? { label, hex: val } : val && typeof val === 'object' ? { label, ...val } : null))
      : []
  return arr
    .map((c) => {
      if (!c || typeof c !== 'object') return null
      const hex = pickHex(c)
      if (!hex) return null
      return { label: String(c.label || c.name || c.role || ''), hex, role: c.role }
    })
    .filter(Boolean)
}

function coerceImagery(v) {
  if (!Array.isArray(v)) return []
  return v.map((it, i) => {
    const o = it && typeof it === 'object' ? it : {}
    return { ...o, id: String(o.id || o.slot || `image-${i + 1}`) }
  })
}

function coerceMotion(v) {
  if (!Array.isArray(v)) return []
  return v.map((m) => (typeof m === 'string' ? { name: m } : m)).filter((m) => m && m.name)
}

const firstDefined = (...xs) => xs.find((x) => x != null)

/** Coerce a value into an array of plain strings (unwrapping {title/text/label/value}). */
function coerceStringArray(v) {
  const arr = Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : v != null ? [v] : []
  return arr.map((x) => (typeof x === 'string' ? x : (x && (x.title || x.text || x.label || x.value)) || '')).filter(Boolean)
}

/** Voice can arrive as `voice`/`voiceCopy`/`copy` with drifting field names. */
function coerceVoice(v) {
  if (!v || typeof v !== 'object') return { valueProps: [], ctaLabels: [] }
  return {
    tone: firstDefined(v.tone, v.voice, v.mood),
    headline: firstDefined(v.headline, v.title, v.h1),
    subheadline: firstDefined(v.subheadline, v.subtitle, v.sub, v.subHeadline),
    valueProps: coerceStringArray(firstDefined(v.valueProps, v.value_props, v.values, v.benefits, v.props)),
    ctaLabels: coerceStringArray(firstDefined(v.ctaLabels, v.ctas, v.cta, v.buttons, v.callToActions)),
    footer: firstDefined(v.footer, v.footerLine, v.footerText, v.footer_line),
  }
}

/** Repair common model-output shape/key drift into the shape DossierSchema expects. */
export function normalizeDossierRaw(raw) {
  const r = raw && typeof raw === 'object' ? { ...raw } : {}
  // Top-level key aliases seen from real models.
  if (!r.voice) r.voice = firstDefined(r.voiceCopy, r.copy, r.voice_copy)
  if (!r.forbidden) r.forbidden = firstDefined(r['clichés'], r.avoid, r.forbid, r.forbidden)
  r.references = coerceRefs(r.references)
  if (r.tokens && typeof r.tokens === 'object') {
    r.tokens = {
      ...r.tokens,
      radius: coerceRadius(r.tokens.radius),
      colors: coerceColors(firstDefined(r.tokens.colors, r.tokens.palette)),
    }
  }
  r.voice = coerceVoice(r.voice)
  r.imageryPlan = coerceImagery(r.imageryPlan)
  r.motionLanguage = coerceMotion(r.motionLanguage)
  r.forbidden = coerceStringArray(r.forbidden)
  return r
}

/**
 * Build the dossier. `llm` may be null (offline) → deterministic fallback.
 * @param {((req:object)=>Promise<any>)|null} llm
 * @param {object} ctx  { prompt, cards, patternHints, blacklist, language }
 * @param {{onNotice?:Function}} [opts]
 */
export async function buildDossier(llm, ctx, opts = {}) {
  const onNotice = opts.onNotice || (() => {})
  if (llm) {
    // The dossier is a large structured output; give it enough budget to avoid
    // mid-JSON truncation, and retry once (the LLM is non-deterministic) before
    // degrading to the pattern fallback (M3).
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await llm({
          system: buildSystem(),
          user: buildUser(ctx),
          schema: DOSSIER_JSON_SCHEMA,
          options: { num_predict: 4096, num_ctx: 16384, temperature: attempt === 0 ? 0.7 : 0.4 },
        })
        const dossier = DossierSchema.parse(normalizeDossierRaw(raw))
        dossier.forbidden = mergedForbidden(ctx, dossier.forbidden)
        dossier.__source = 'llm'
        return dossier
      } catch (err) {
        if (attempt === 1) {
          onNotice(`Muse: dossier LLM step failed (${err instanceof Error ? err.message : String(err)}) — using pattern fallback`)
        }
      }
    }
  }
  return buildFallbackDossier(ctx)
}

/**
 * Deterministic, no-LLM dossier from the top matched pattern. Real (non-lorem)
 * copy derived from the request. Keeps Muse useful offline / on failure.
 */
export function buildFallbackDossier(ctx) {
  const pattern = (ctx.patternHints && ctx.patternHints[0]) || null
  const seeds = pattern?.tokenSeeds || {}
  const colors = (seeds.colors || []).map((c) => ({ label: c.label, hex: c.hex }))
  const subject = String(ctx.prompt || 'this product').trim()
  const titleCase = subject.charAt(0).toUpperCase() + subject.slice(1)
  const dossier = DossierSchema.parse({
    concept: pattern
      ? `${pattern.name} direction for ${subject}. ${pattern.description}`
      : `A focused, distinctive direction for ${subject}.`,
    references: pattern ? [{ note: `Pattern: ${pattern.name}` }] : [],
    tokens: {
      colors,
      typography: { display: seeds.typography || 'Modern sans display', body: 'Readable humanist sans', scaleFeel: 'airy' },
      radius: seeds.radius || 'rounded-xl',
    },
    layoutGrammar: ['Distinctive hero anchored on the core offer', 'Clear vertical rhythm', 'One deliberate focal accent per section'],
    motionLanguage: [{ name: 'Reveal', description: 'Gentle fade + rise on scroll into view' }],
    voice: {
      tone: pattern ? pattern.description : 'Confident and specific',
      headline: titleCase,
      subheadline: `Everything you need for ${subject}, thoughtfully designed.`,
      valueProps: ['Built around what actually matters', 'Clear, honest, and fast', 'Details that feel considered'],
      ctaLabels: ['Get started', 'See how it works'],
      footer: `© ${new Date().getFullYear()} — crafted with care.`,
    },
    imageryPlan: [
      {
        id: 'hero',
        slot: 'hero',
        subject,
        style: pattern?.imageryStyle || 'clean, considered photography',
        lighting: 'natural, soft',
        aspectRatio: '16:9',
        negative: 'text, watermark, logo, lorem ipsum',
        prompt: `${subject}, ${pattern?.imageryStyle || 'clean editorial photography'}, high quality, no text, no watermark`,
      },
    ],
    forbidden: [],
  })
  dossier.forbidden = mergedForbidden(ctx, [])
  dossier.__source = 'fallback'
  return dossier
}

// --- Markdown rendering (DESIGN.md superset) ---------------------------------

function colorLines(colors) {
  return colors.map((c) => `- ${c.label}: ${c.hex}${c.role ? `  (${c.role})` : ''}`).join('\n')
}

/**
 * Render a dossier to DESIGN-DOSSIER.md. The `## Tokens` section uses the exact
 * DESIGN.md `- Label: #hex` shape so the existing token parser + export bridge
 * consume it unchanged.
 */
export function dossierToMarkdown(dossier, meta = {}) {
  const d = dossier
  const lines = []
  lines.push(`# Design Dossier — ${meta.projectName || 'Untitled'}`)
  lines.push('')
  lines.push('## Concept')
  lines.push(d.concept || '')
  lines.push('')
  if (d.references?.length) {
    lines.push('## References')
    for (const r of d.references) lines.push(`- ${[r.sourceUrl, r.note].filter(Boolean).join(' — ')}`)
    lines.push('')
  }
  lines.push('## Tokens')
  lines.push('')
  lines.push('### Colors')
  lines.push(colorLines(d.tokens?.colors || []))
  lines.push('')
  if (d.tokens?.typography) {
    lines.push('### Typography')
    if (d.tokens.typography.display) lines.push(`- Display: ${d.tokens.typography.display}`)
    if (d.tokens.typography.body) lines.push(`- Body: ${d.tokens.typography.body}`)
    if (d.tokens.typography.scaleFeel) lines.push(`- Scale: ${d.tokens.typography.scaleFeel}`)
    lines.push('')
  }
  lines.push('### Radius')
  lines.push(`- Radius: ${d.tokens?.radius || 'rounded-xl'}`)
  lines.push('')
  if (d.layoutGrammar?.length) {
    lines.push('## Layout Grammar')
    for (const l of d.layoutGrammar) lines.push(`- ${l}`)
    lines.push('')
  }
  if (d.motionLanguage?.length) {
    lines.push('## Motion Language')
    for (const m of d.motionLanguage) lines.push(`- ${m.name}${m.description ? `: ${m.description}` : ''}`)
    lines.push('')
  }
  lines.push('## Voice & Copy')
  if (d.voice?.tone) lines.push(`- Tone: ${d.voice.tone}`)
  if (d.voice?.headline) lines.push(`- Headline: ${d.voice.headline}`)
  if (d.voice?.subheadline) lines.push(`- Subheadline: ${d.voice.subheadline}`)
  for (const vp of d.voice?.valueProps || []) lines.push(`- Value prop: ${vp}`)
  if (d.voice?.ctaLabels?.length) lines.push(`- CTAs: ${d.voice.ctaLabels.join(' · ')}`)
  if (d.voice?.footer) lines.push(`- Footer: ${d.voice.footer}`)
  lines.push('')
  if (d.imageryPlan?.length) {
    lines.push('## Imagery Plan')
    for (const img of d.imageryPlan) {
      lines.push(`- **${img.id}** (${img.slot || 'image'}, ${img.aspectRatio || '16:9'}): ${img.subject || ''}`)
      if (img.prompt) lines.push(`  - prompt: ${img.prompt}`)
      if (img.negative) lines.push(`  - negative: ${img.negative}`)
    }
    lines.push('')
  }
  if (d.forbidden?.length) {
    lines.push('## Forbidden')
    for (const f of d.forbidden) lines.push(`- ${f}`)
    lines.push('')
  }
  return lines.join('\n')
}

export { DOSSIER_JSON_SCHEMA }
