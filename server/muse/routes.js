// Express routes for Muse. Phase 1: MCP health. Phase 3: the Inspiration Engine
// (Discover → Distill → Dossier). `express.json` is applied at the /api level in
// server/index.js, so req.body is parsed for POST /muse/dossier.
import express from 'express'
// `credsFromReq` moved to ./llm.js when the video-export composer became its
// second caller. Muse still runs offline when it returns null — the
// pattern-based dossier, no LLM.
import { makeLlm, credsFromReq } from './llm.js'
import { runInspiration } from './inspire/engine.js'
import { runQuality } from './quality/index.js'
import { judgeAudit } from './quality/audit-judge.js'

/** A hex string, and nothing that could be smuggled into a prompt as one. */
const HEX_RE = /^#[0-9a-fA-F]{6}$/
/** Roughly a 1 MP JPEG in base64 — a downscaled reference, not an original. */
const MAX_MEDIA_IMAGE_CHARS = 1_500_000

/**
 * Validate the media block before it reaches a prompt or a provider.
 *
 * Everything here arrives from the browser and ends up in two places that
 * deserve care: the text of an LLM prompt, and the body of a call to a
 * third-party model. So the palette is checked to be hex — not merely
 * stringified — the label is length-capped, and the attached picture is
 * accepted only as a base64 data URL of a known image type and only up to a
 * size that is plainly a reference rather than an upload.
 *
 * Returns null when there is nothing usable, which is the same state as "no
 * media selected" — the dossier then runs exactly as it did before.
 */
export function sanitizeUserMedia(raw) {
  if (!raw || typeof raw !== 'object') return null
  const swatches = (Array.isArray(raw.swatches) ? raw.swatches : [])
    .filter((s) => s && HEX_RE.test(String(s.hex || '')))
    .slice(0, 8)
    .map((s) => ({
      hex: String(s.hex).toLowerCase(),
      weight: Number.isFinite(Number(s.weight)) ? Math.min(1, Math.max(0, Number(s.weight))) : 0,
    }))
  if (!swatches.length) return null

  const image =
    typeof raw.image === 'string' &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(raw.image) &&
    raw.image.length <= MAX_MEDIA_IMAGE_CHARS
      ? raw.image
      : undefined

  return {
    kind: raw.kind === 'video' ? 'video' : 'image',
    swatches,
    accent: HEX_RE.test(String(raw.accent || '')) ? String(raw.accent).toLowerCase() : null,
    image,
  }
}

/**
 * @param {object} deps
 * @param {import('./mcp/host.js').McpHost} deps.host
 * @param {import('./fetch/fetcher.js').InspirationFetcher} [deps.fetcher]
 * @param {object} [deps.patterns]  PromptPatternLibrary
 * @param {string[]} [deps.blacklist]
 * @param {(profile:string)=>object|null} [deps.resolveTarget]  Admin-configured
 *   text provider. Muse runs on the 'inspiration' profile so art direction can
 *   use a different model than screen generation.
 */
export function createMuseRouter({ host, fetcher, patterns, blacklist, resolveTarget }) {
  const router = express.Router()

  // GET /api/mcp/status — per-server lifecycle state for the Advanced drawer.
  router.get('/mcp/status', (req, res) => {
    res.json({ servers: host.status() })
  })

  // POST /api/muse/dossier — run the Inspiration Engine and return a Design
  // Dossier (superset of DESIGN.md). `useFetch:true` opts into live inspiration
  // (spawns the fetcher MCP); default is pattern-only (offline, lightweight).
  router.post('/muse/dossier', async (req, res) => {
    const body = req.body || {}
    if (!body.prompt || !String(body.prompt).trim()) {
      return res.status(400).json({ error: 'A "prompt" is required.' })
    }
    // An admin-configured provider wins over the browser's own settings, exactly
    // like /__provider — otherwise Muse would keep calling ollama.com with an
    // empty key while the rest of the app talks to OpenRouter.
    let admin = null
    try {
      admin = resolveTarget ? resolveTarget('inspiration') : null
    } catch {
      admin = null
    }
    const creds = admin ? { ...admin, trusted: true } : credsFromReq(req)
    const llm = creds ? makeLlm(creds) : null
    try {
      const result = await runInspiration(
        {
          prompt: body.prompt,
          urls: Array.isArray(body.urls) ? body.urls : [],
          useFetch: body.useFetch === true, // explicit opt-in (avoids surprise Chromium install)
          language: body.language,
          projectName: body.projectName,
          userMedia: sanitizeUserMedia(body.userMedia),
        },
        { fetcher, llm, patterns, blacklist },
      )
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  /*
   * POST /api/muse/quality — check one generated screen.
   *
   * The screen itself is generated in the browser; only the checking happens
   * here, for two reasons. The detector is a Node module that reads `node:fs`
   * at import, so it cannot be bundled for the browser at all. And keeping it
   * server-side means its ~1 MB of rule engine never reaches the client, which
   * matters for a tool whose previews are the product.
   *
   * Credentials follow the dossier route exactly: an admin-configured provider
   * wins, otherwise the browser's own headers. Without either, the deterministic
   * half still runs and the judged half reports itself as unavailable — which
   * is why this route answers 200 with an honest report rather than 4xx when
   * there is no model.
   */
  router.post('/muse/quality', async (req, res) => {
    const body = req.body || {}
    const code = typeof body.code === 'string' ? body.code : ''
    if (!code.trim()) {
      return res.status(400).json({ error: 'A "code" string is required.' })
    }

    let admin = null
    try {
      admin = resolveTarget ? resolveTarget('inspiration') : null
    } catch {
      admin = null
    }
    const creds = admin ? { ...admin, trusted: true } : credsFromReq(req)
    const llm = creds ? makeLlm(creds) : null

    try {
      const result = await runQuality(
        {
          code,
          hasDirection: body.hasDirection === true,
          critique: body.critique !== false,
        },
        { llm },
      )
      res.json(result)
    } catch (err) {
      // runQuality is written not to throw. If it ever does, the screen is
      // already generated and on the user's canvas — reporting the failure is
      // right, failing the request is not (invariant Q1).
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  /*
   * POST /api/muse/audit — the judged half of the SEO / accessibility report.
   *
   * Unlike /muse/quality, the DETERMINISTIC half of this evaluation does not
   * run here at all: those rules are Mocky's own markup analysis over an AST the
   * browser already parses, so they run in `src/lib/audit/` with no round trip,
   * no cost, and no dependency on this server being reachable. Only the
   * judgement questions — is the alt any good, does the heading describe the
   * section — need a model, which is why this route exists and why it is behind
   * a second, explicit button in the panel.
   *
   * Credentials follow /muse/quality exactly: an admin-configured provider wins,
   * otherwise the browser's own headers. With neither, this answers 200 with an
   * empty findings list and a notice saying so — the caller already has a
   * complete deterministic report and must not lose it (Q1).
   */
  router.post('/muse/audit', async (req, res) => {
    const code = typeof req.body?.code === 'string' ? req.body.code : ''
    if (!code.trim()) return res.status(400).json({ error: 'A "code" string is required.' })

    let admin = null
    try {
      admin = resolveTarget ? resolveTarget('inspiration') : null
    } catch {
      admin = null
    }
    const creds = admin ? { ...admin, trusted: true } : credsFromReq(req)
    const llm = creds ? makeLlm(creds) : null

    try {
      res.json(await judgeAudit(code, { llm }))
    } catch (err) {
      // judgeAudit is written not to throw. If it ever does, the screen is on
      // the user's canvas and the deterministic half is already in their hands.
      res.status(200).json({
        findings: [],
        notices: [err instanceof Error ? err.message : String(err)],
        judged: false,
      })
    }
  })

  return router
}
