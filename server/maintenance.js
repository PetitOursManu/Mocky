// Maintenance mode: the instance goes read-only for everyone but its admins.
//
// Read-only, not "no creating or deleting": the user first asked for the
// latter, and it cannot be enforced honestly. `PUT /api/data` carries the whole
// project list in one blob, so a server cannot tell an edit from a deletion
// without diffing every project — and the reason maintenance exists at all is
// the migration's final pass, after which an EDIT is lost exactly like a
// creation. So every write is refused, and the rule is a default-deny on the
// method: a route added next year is covered without anybody remembering to
// add it here.
//
// Admins pass. The new server boots in maintenance after an import (config.json
// travels with it), and the person checking it must be able to open a project
// and try a generation before letting anybody else in. The flip side is
// written down in docs/migration.md: on the OLD server, an admin's own changes
// after the final pass are not transferred either.

/**
 * Writes anyone may make during maintenance: signing in and out — and the
 * dashboard's heartbeat, which is a POST but writes nothing anywhere (presence
 * lives in memory). Refusing it would show every user offline to the admin
 * during exactly the window in which they want to see who is still around.
 *
 * And `/mcp`, which is POST for every call because JSON-RPC is: refused here,
 * an assistant could not even LIST projects during maintenance. Each MCP tool
 * that writes checks maintenance itself (server/mcp/), the way a route would.
 */
const ALWAYS_ALLOWED = new Set(['/api/login', '/api/logout', '/api/presence', '/mcp'])

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Whether this request must be refused.
 *
 * @param {{ method:string, path:string }} req
 * @param {{ on:boolean }} state
 * @param {boolean} isAdmin
 */
export function maintenanceBlocks(req, state, isAdmin) {
  if (!state?.on) return false
  if (SAFE_METHODS.has(String(req.method).toUpperCase())) return false
  if (ALWAYS_ALLOWED.has(req.path)) return false
  if (isAdmin) return false
  return true
}

/** The body of a refusal. `code` is what the client keys its message on. */
export function maintenanceBody(state) {
  return {
    code: 'maintenance',
    error: 'Mocky est en maintenance : rien ne peut être créé, modifié ni supprimé pour le moment.',
    message: state?.message || '',
  }
}

/** A message is shown to every user, so it is plain text of bounded length. */
export function cleanMaintenanceMessage(input) {
  return String(input ?? '')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 500)
}
