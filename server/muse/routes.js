// Express routes for Muse. Phase 1 exposes only the MCP health endpoint; later
// phases add /api/muse/run, image serving, and the library here.
import express from 'express'

/**
 * @param {{host: import('./mcp/host.js').McpHost}} deps
 * @returns {import('express').Router}
 */
export function createMuseRouter({ host }) {
  const router = express.Router()

  // GET /api/mcp/status — per-server lifecycle state for the Advanced drawer.
  router.get('/mcp/status', (req, res) => {
    res.json({ servers: host.status() })
  })

  return router
}
