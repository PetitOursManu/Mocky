// Express routes for Muse. Phase 1: MCP health. Phase 3: the Inspiration Engine
// (Discover → Distill → Dossier). `express.json` is applied at the /api level in
// server/index.js, so req.body is parsed for POST /muse/dossier.
import express from 'express'
import { makeLlm } from './llm.js'
import { runInspiration } from './inspire/engine.js'

/**
 * Extract per-request provider credentials (ADR D7) from the same headers the
 * /__provider proxy uses. Returns null when unset — Muse then runs offline
 * (pattern-based dossier, no LLM). Credentials are used only for this request
 * and never persisted.
 */
function credsFromReq(req) {
  const baseUrl = String(req.headers['x-provider-base'] || '').replace(/\/+$/, '')
  const auth = String(req.headers['authorization'] || '')
  const apiKey = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const model = String((req.body && req.body.model) || req.headers['x-provider-model'] || '')
  if (!baseUrl || !model) return null
  return { baseUrl, apiKey, model }
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
        },
        { fetcher, llm, patterns, blacklist },
      )
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  return router
}
