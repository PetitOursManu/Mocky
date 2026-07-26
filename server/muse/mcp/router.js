// McpToolRouter — maps a semantic ROLE (e.g. "inspiration-fetch") to whichever
// declared server exposes a matching tool, and calls it. This is what lets users
// swap servers in mocky.mcp.json without touching code.
//
// Every failure degrades to `null` (M3): unknown role, no matching tool, server
// unavailable, or a tool error are all reported via `onNotice` and return null,
// so a Muse run continues without that source instead of throwing.

/** Pick the first candidate tool the server actually exposes; else its first tool. */
export function pickTool(tools, candidates) {
  const names = new Set((tools || []).map((t) => t.name))
  if (candidates && candidates.length) {
    for (const c of candidates) {
      if (names.has(c)) return c
    }
    return null // caller asked for specific tools; none present
  }
  return tools && tools.length ? tools[0].name : null
}

export class McpToolRouter {
  constructor(host) {
    this.host = host
  }

  /** @returns {Array} status snapshot passthrough. */
  status() {
    return this.host.status()
  }

  /**
   * Route a call to the first healthy server for `role` that exposes one of
   * `candidateTools`.
   *
   * @param {string} role
   * @param {string[]} candidateTools  tool names to try, in preference order
   * @param {object|((toolName:string)=>object)} args  args object, or a factory
   *        of args given the chosen tool name (tools differ in their arg shape)
   * @param {{onNotice?:(msg:string)=>void}} [opts]
   * @returns {Promise<object|null>}  the tool result, or null on any failure
   */
  async call(role, candidateTools, args, opts = {}) {
    const notice = opts.onNotice || (() => {})
    const servers = this.host.serversForRole(role)
    if (!servers.length) {
      notice(`Muse: no MCP server declares role "${role}"`)
      return null
    }
    for (const desc of servers) {
      try {
        const adapter = await this.host.ensure(desc.name)
        if (!adapter) {
          notice(`Muse: MCP server "${desc.name}" is unavailable`)
          continue
        }
        const toolName = pickTool(adapter.tools, candidateTools)
        if (!toolName) {
          notice(`Muse: MCP server "${desc.name}" exposes no matching tool for "${role}"`)
          continue
        }
        const finalArgs = typeof args === 'function' ? args(toolName) : args
        return await this.host.callTool(desc.name, toolName, finalArgs)
      } catch (err) {
        notice(`Muse: MCP call to "${desc.name}" failed: ${err instanceof Error ? err.message : String(err)}`)
        continue
      }
    }
    return null
  }
}
