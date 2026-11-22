// POST /api/muse/project-audit — the audit of a project (audit.js).
//
// The browser sends the pages it shows (their code is in its working copy,
// which may be ahead of the server's), the grid it kept from the last run, and
// that run, so what moved can be said. Nothing is stored here: the run comes
// back and the browser files it on the project, beside its grid — the same
// place an assistant's audit reads it from (server/mcp/tools.js, audit_project).
//
// Credentials follow /muse/quality: the admin's text model wins over the
// browser's own headers for the grid, the synthesis and the fallback; the
// decision model is the instance's alone, and only for accounts allowed to
// spend the instance's money (`decisionTarget`, F1).
import express from 'express'
import { credsFromReq, makeLlm } from '../muse/llm.js'
import { makeDecider } from './decide.js'
import { runProjectAudit } from './audit.js'
import { langOf } from './grid.js'

const clip = (s, n) => (typeof s === 'string' ? s.slice(0, n) : '')

/** The project fields an audit reads, out of a request body — nothing else travels. */
export function auditInputFrom(body) {
  const b = body && typeof body === 'object' ? body : {}
  const p = b.project && typeof b.project === 'object' ? b.project : {}
  return {
    lang: langOf(b.lang),
    project: {
      name: clip(p.name, 200),
      goal: clip(p.goal, 600),
      direction: clip(p.direction, 20_000),
      rules: clip(p.rules, 4000),
    },
    pages: Array.isArray(b.pages) ? b.pages : [],
    grid: b.newGrid === true ? null : b.grid,
    // A line the person typed, or a campaign fact ({label, detail: its value}).
    expected: Array.isArray(b.expected)
      ? b.expected
          .filter((x) => typeof x === 'string' || (x && typeof x === 'object' && typeof x.label === 'string'))
          .map((x) => (typeof x === 'string' ? x : { label: x.label, ...(typeof x.detail === 'string' ? { detail: x.detail } : {}) }))
          .slice(0, 24)
      : undefined,
    previous: b.newGrid === true ? null : b.previous,
  }
}

/**
 * @param {object} deps
 * @param {(profile:string, req:object)=>object|null} deps.resolveTarget  the text model for this account
 * @param {(req:object)=>object|null} deps.decisionTarget  the decision model for this account
 * @param {(req:object, profile:string)=>((u:object)=>void)|undefined} [deps.meter]
 * @param {(req:object)=>((u:object)=>void)|undefined} [deps.decisionMeter]
 * @param {typeof fetch} [deps.fetchImpl]
 */
export function createDecisionRouter({ resolveTarget, decisionTarget, meter, decisionMeter, fetchImpl }) {
  const router = express.Router()

  router.post('/muse/project-audit', async (req, res) => {
    const input = auditInputFrom(req.body)
    if (!input.pages.length) return res.status(400).json({ error: 'pages' })

    let admin = null
    try {
      admin = resolveTarget ? resolveTarget('inspiration', req) : null
    } catch {
      admin = null
    }
    const creds = admin ? { ...admin, trusted: true } : credsFromReq(req)
    if (creds && meter) creds.onUsage = meter(req, 'inspiration')
    const llm = creds ? makeLlm(creds) : null

    const notices = []
    const decider = makeDecider({
      target: decisionTarget(req),
      llm,
      fetchImpl,
      onUsage: decisionMeter?.(req),
      onNotice: (m) => notices.push(m),
    })
    // Closing the panel stops paying for answers nobody will read.
    const ctrl = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) ctrl.abort()
    })
    try {
      const run = await runProjectAudit(input, { decider, llm, signal: ctrl.signal })
      res.json({ ...run, notices: [...new Set([...notices, ...run.notices])] })
    } catch (err) {
      if (ctrl.signal.aborted) return
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  return router
}
