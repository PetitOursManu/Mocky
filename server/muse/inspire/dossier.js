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
  /**
   * What the product is CALLED.
   *
   * The dossier already decided how a project looks and how it speaks, and
   * said nothing about its name — so every screen invented its own wordmark
   * and the direction was powerless to stop it. Deciding it here, once, before
   * a single screen exists, is what makes it consistent by construction rather
   * than by asking each generation to copy the last one.
   *
   * Optional, and empty on every dossier written before this field: the
   * markdown simply omits the section and readers fall back to naming the
   * document.
   */
  productName: z.string().optional(),
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

/**
 * The schema handed to the model, and the one that decides what it emits.
 *
 * It is written by hand and is NOT derived from `DossierSchema` above, which is
 * a trap worth naming: zod validates what came back, this constrains what is
 * produced, and adding a field to only one of them silently does nothing. That
 * is exactly how `productName` shipped once without ever being generated — the
 * prompt asked for it, zod accepted it, and the model was never told the field
 * existed, so every dossier came back without one.
 */
const DOSSIER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    productName: { type: 'string' },
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
      // Models happily returned an empty array and left the screen with no
      // image at all; state the floor in the schema as well as the prompt.
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' }, slot: { type: 'string' }, subject: { type: 'string' }, style: { type: 'string' },
          lighting: { type: 'string' }, aspectRatio: { type: 'string' }, negative: { type: 'string' }, prompt: { type: 'string' },
        },
        required: ['id', 'prompt'],
      },
    },
    forbidden: { type: 'array', items: { type: 'string' } },
  },
  // `productName` is required, like every other field the screens depend on.
  // Left optional it was simply omitted: a model satisfies a schema, it does not
  // volunteer beyond it, however plainly the prompt asks.
  required: ['productName', 'concept', 'tokens', 'layoutGrammar', 'voice', 'imageryPlan', 'forbidden'],
}

function buildSystem() {
  return [
    'You are a world-class ART DIRECTOR. Design a DISTINCTIVE visual direction for ONE product, then return it as JSON matching the schema.',
    'You are given: the user request, distilled inspiration cards (vocabulary + grammar, NOT designs to copy), matched art-direction patterns, and a list of clichés to AVOID.',
    '',
    'Requirements:',
    '- Product name: invent ONE short, memorable name for this product — the wordmark that will appear in the header of every screen. One or two words, no tagline, no explanation, no generic placeholder like "Brand" or "Acme". Write it in the SAME LANGUAGE as the user request. If the user already named the product, use their name exactly as they spelled it.',
    '- Concept: 2–3 sentences of specific art direction. NEVER generic ("modern, clean, professional" is banned).',
    '- Tokens: a coherent palette (6–8 colors, each with `label` + `hex`). `tokens.radius` MUST be a single string like "rounded-xl" (NOT an object).',
    '- Voice & Copy: write REAL, specific copy — headline, subheadline, exactly 3 value props, CTA labels, footer line. CRITICAL: write ALL copy in the SAME LANGUAGE as the user request. Never use Lorem ipsum or filler.',
    '- Imagery Plan: an ARRAY that is NEVER EMPTY — it MUST contain AT LEAST ONE item, the "hero" image. Returning `"imageryPlan": []` is a failure: the screen would be generated with no image at all.',
    '  EACH item MUST include a short string `id` (e.g. "hero", "product-1") plus subject/style/lighting/aspectRatio/negative and a final ready-to-use generation prompt ending with "high quality, no text, no watermark".',
    '  CRITICAL — image subjects must be PHOTOGRAPHIC or ILLUSTRATIVE: a place, a person, an object, a texture, an abstract composition. NEVER ask for a user interface, a website, a landing page, an app screen, a dashboard, a mockup, a browser window, a phone showing an app, a chart, a logo, or anything containing readable text — image generators render these as garbled fake UI. If the screen needs a product visual, describe the REAL-WORLD subject behind the product (the team, the workshop, the material, the environment, an abstract brand texture), never a picture of the interface itself.',
    '  Each `negative` MUST include: "text, letters, words, watermark, logo, user interface, screenshot, mockup".',
    '  CRITICAL — every image prompt MUST depict the SUBJECT OF THE USER REQUEST. The art-direction pattern only sets the *look* (framing, palette, lighting); it is NEVER the subject. A pattern named "Swiss / International", "Brutalist" or "Scandinavian" describes TYPOGRAPHY AND LAYOUT — do not photograph a Swiss watch, a concrete building or a Nordic forest unless the user asked for one. If the request is a SaaS pricing page, the hero shows something from that product\'s world, rendered in the pattern\'s style.',
    '- References: an ARRAY of objects, each { sourceUrl, note }, citing which reference or pattern inspired which choice.',
    '- Forbidden: restate the key clichés to avoid for THIS project.',
    'Respond with ONLY the JSON object. No prose, no code fences.',
  ].join('\n')
}

/**
 * The section that appears when the user brought their own picture or clip.
 *
 * It is deliberately the most forceful passage in the whole prompt. Everything
 * else the dossier reads — patterns, distilled references — is *vocabulary*;
 * this is the actual material the screen will be built around, and it is
 * already decided. A palette invented next to it, however tasteful, produces a
 * page that fights its own hero image.
 *
 * The hex values are MEASURED from the file (see src/lib/palette.ts), not
 * described by a model, so they can be stated as fact rather than as a hint.
 */
function buildMediaSection(media) {
  if (!media || !Array.isArray(media.swatches) || media.swatches.length === 0) return null
  const kind = media.kind === 'video' ? 'video clip' : 'image'
  const lines = [
    `THE USER'S OWN ${kind.toUpperCase()} — THIS IS THE HERO OF THE SCREEN. It already exists; you are designing around it.`,
    '',
    'Its palette, sampled from the actual pixels (share of the picture in brackets):',
    ...media.swatches.map((s) => `- ${s.hex} (${Math.round((s.weight || 0) * 100)}%)`),
  ]
  if (media.accent) lines.push(`Most saturated colour, the natural accent: ${media.accent}`)
  lines.push(
    '',
    'RULES — these override the palettes suggested by any pattern or reference above:',
    '- `tokens.colors` MUST be built FROM the colours above. Keep their hex values, or shift them only as far as contrast requires; name them for their role (background, surface, ink, accent…).',
    '- Do NOT introduce a colour family that is absent from this list. A page whose palette disagrees with its own hero image is the failure this section exists to prevent.',
    '- The `concept` must describe a direction that suits THIS picture — its light, its density, its mood — not a generic one.',
  )
  if (media.kind === 'video') {
    lines.push(
      '- The hero is a video the visitor scrubs through by scrolling. Design the section around a full-bleed moving image with text laid over it: the copy must stay readable on top of these colours.',
    )
  }
  lines.push(
    '- The imagery plan still describes the SECONDARY images. Do not describe the hero again — it is provided.',
  )
  return lines.join('\n')
}

function buildUser(ctx) {
  const cardLines = (ctx.cards || []).map((c, i) =>
    `Reference ${i + 1} (${c.sourceUrl || 'n/a'}): style=[${(c.styleAdjectives || []).join(', ')}]; palette=[${(c.palette || []).map((p) => p.hex).join(', ')}]; layout=[${(c.layoutGrammar || []).join('; ')}]; tone="${c.contentTone || ''}"; avoid=[${(c.avoid || []).join('; ')}]`,
  )
  const patternLines = (ctx.patternHints || []).map(
    (p) => `Pattern "${p.name}": ${p.description} | imagery: ${p.imageryStyle} | seed colors: ${(p.tokenSeeds?.colors || []).map((c) => `${c.label} ${c.hex}`).join(', ')}`,
  )
  const media = buildMediaSection(ctx.userMedia)
  return [
    `USER REQUEST: ${ctx.prompt}`,
    ctx.language ? `Write all copy in this language: ${ctx.language}` : 'Write all copy in the same language as the user request above.',
    // Placed FIRST among the inputs, before the borrowed vocabulary: it is the
    // only one of them that is already a decision.
    ...(media ? ['', media] : []),
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
  // The name arrives under whichever key the model felt like using. Coerced to
  // a trimmed string, and dropped if it came back as an object or a sentence —
  // a wordmark is short, and anything long is an explanation of one.
  if (!r.productName) r.productName = firstDefined(r.product_name, r.product, r.name, r.brand, r.brandName)
  const nameRaw = typeof r.productName === 'string' ? r.productName.trim() : ''
  r.productName = nameRaw && nameRaw.length <= 40 ? nameRaw : undefined
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

/** The imagery slot every dossier must have, derived from the request. */
export function defaultHeroSlot(ctx, pattern = null) {
  const subject = String(ctx?.prompt || 'this product').trim()
  return {
    id: 'hero',
    slot: 'hero',
    subject,
    style: pattern?.imageryStyle || 'clean, considered photography',
    lighting: 'natural, soft',
    aspectRatio: '16:9',
    negative: 'text, letters, words, watermark, logo, user interface, screenshot, mockup',
    prompt: `${subject}, ${pattern?.imageryStyle || 'clean editorial photography'}, high quality, no text, no watermark`,
  }
}

/** Words carrying no subject meaning — ignored when matching a prompt to a request. */
const STOP_WORDS = new Set([
  // en
  'a', 'an', 'the', 'and', 'or', 'of', 'for', 'with', 'to', 'in', 'on', 'at', 'by', 'from', 'that', 'this',
  'page', 'screen', 'site', 'app', 'application', 'website', 'view', 'layout', 'design', 'ui', 'interface',
  'landing', 'dashboard', 'three', 'two', 'four', 'toggle', 'section', 'style', 'modern', 'clean', 'simple',
  // fr
  'un', 'une', 'le', 'la', 'les', 'des', 'du', 'de', 'et', 'ou', 'pour', 'avec', 'dans', 'sur', 'par',
  'page', 'ecran', 'écran', 'site', 'appli', 'application', 'vue', 'maquette', 'moderne', 'simple',
])

/** Meaningful lowercase words of a phrase, accents stripped. */
function contentWords(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
}

/**
 * Keep every image prompt tied to what the user actually asked for.
 *
 * Real failure this exists for: the request was "a SaaS pricing page with three
 * tiers and a monthly/yearly toggle", the matched art-direction pattern was
 * "Swiss / International" — and the model wrote an image prompt for a Swiss
 * WATCH DIAL. It had latched onto the name of the typographic style instead of
 * the subject, and nothing downstream noticed: the hero image on the canvas was
 * a wristwatch on a pricing page.
 *
 * The instruction in the system prompt asks for this, but an instruction is not
 * a guarantee. So it is checked: if a prompt shares no meaningful word with the
 * request, it is re-anchored on the subject rather than trusted.
 */
export function anchorImageryToRequest(dossier, ctx) {
  const subject = String(ctx?.prompt || '').trim()
  const wanted = contentWords(subject)
  if (!subject || wanted.length === 0 || !Array.isArray(dossier.imageryPlan)) return dossier

  for (const slot of dossier.imageryPlan) {
    if (!slot || typeof slot !== 'object') continue
    // The subject field counts too — a prompt may paraphrase it.
    const have = new Set([...contentWords(slot.prompt), ...contentWords(slot.subject)])
    if (wanted.some((w) => have.has(w))) continue

    const style = slot.style || (ctx?.patternHints && ctx.patternHints[0]?.imageryStyle) || 'clean editorial photography'
    slot.subject = subject
    slot.prompt = `${subject}, ${style}, high quality, no text, no watermark`
    slot.driftCorrected = true
  }
  return dossier
}

/**
 * Guarantee at least one imagery slot.
 *
 * The schema requires the `imageryPlan` KEY, but an empty array satisfies it —
 * and real models do return `"imageryPlan": []`. Muse then generated no image at
 * all, silently: no hero on the canvas, nothing added to the library, and no
 * error anywhere to explain it. A dossier with no imagery is not a usable
 * dossier, so synthesise the hero slot the fallback path already builds.
 */
export function ensureHeroImagery(dossier, ctx) {
  if (!Array.isArray(dossier.imageryPlan) || dossier.imageryPlan.length === 0) {
    dossier.imageryPlan = [defaultHeroSlot(ctx, (ctx?.patternHints && ctx.patternHints[0]) || null)]
  }
  return anchorImageryToRequest(dossier, ctx)
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
          // The picture itself, when the model can see. The measured palette in
          // the prompt covers colour either way; this adds what a histogram
          // cannot report — composition, subject, density, light.
          images: ctx.userMedia?.image ? [ctx.userMedia.image] : undefined,
          options: { num_predict: 4096, num_ctx: 16384, temperature: attempt === 0 ? 0.7 : 0.4 },
        })
        const dossier = DossierSchema.parse(normalizeDossierRaw(raw))
        dossier.forbidden = mergedForbidden(ctx, dossier.forbidden)
        ensureHeroImagery(dossier, ctx)
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
    imageryPlan: [defaultHeroSlot(ctx, pattern)],
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
  // Same section name and shape the derived DESIGN.md uses, so one reader
  // (extractProductName, src/lib/design.ts) serves both documents.
  if (d.productName && String(d.productName).trim()) {
    lines.push('## Product')
    lines.push(String(d.productName).trim())
    lines.push('')
  }
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
