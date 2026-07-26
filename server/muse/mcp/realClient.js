// Real MCP client adapter over the official SDK (stdio transport). The rest of
// Muse depends only on the small adapter shape below, so the host can be unit-
// tested with an injected fake factory (no subprocess, no network):
//
//   adapter = {
//     tools:  [{ name, description }],
//     callTool(toolName, args): Promise<result>,
//     close(): Promise<void>,
//   }
//
// Security (M4 / prompt §2.1): servers are spawned with a MINIMAL environment —
// we pass through only the OS essentials needed to launch a process, never
// Mocky's own secrets (SSO_SHARED_SECRET, provider keys, etc.).
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

/** OS vars a child needs to start; deliberately excludes everything Mocky-specific. */
const ENV_ALLOWLIST = [
  'PATH', 'Path', 'PATHEXT', 'HOME', 'USERPROFILE', 'SYSTEMROOT', 'SystemRoot',
  'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'APPDATA', 'LOCALAPPDATA', 'ComSpec',
  'LANG', 'LC_ALL', 'NODE_OPTIONS',
]

function minimalEnv(extra) {
  const env = {}
  for (const k of ENV_ALLOWLIST) {
    if (process.env[k] != null) env[k] = process.env[k]
  }
  return { ...env, ...(extra || {}) }
}

/**
 * Windows can't spawn a bare `npx` (it's `npx.cmd`); normalize common Node CLIs.
 * The SDK's transport spawns the command directly, so we fix it here.
 */
function normalizeCommand(command) {
  if (process.platform !== 'win32') return command
  if (command === 'npx' || command === 'npm' || command === 'pnpm' || command === 'yarn') {
    return `${command}.cmd`
  }
  return command
}

/**
 * Build the default (real) client factory. Returns an async fn that connects to
 * one server descriptor and resolves to the adapter shape above. Throws on
 * connection failure — the host catches it and marks the server `error`.
 */
export function createStdioClientFactory() {
  return async function connect(descriptor) {
    const transport = new StdioClientTransport({
      command: normalizeCommand(descriptor.command),
      args: descriptor.args || [],
      env: minimalEnv(descriptor.env),
      stderr: 'inherit',
    })
    const client = new Client(
      { name: 'mocky-muse', version: '0.1.0' },
      { capabilities: {} },
    )
    await client.connect(transport)
    let tools = []
    try {
      const listed = await client.listTools()
      tools = (listed?.tools || []).map((t) => ({ name: t.name, description: t.description }))
    } catch {
      // A server with no tools/list is still usable for nothing; treat as empty.
      tools = []
    }
    return {
      tools,
      async callTool(toolName, args) {
        return client.callTool({ name: toolName, arguments: args || {} })
      },
      async close() {
        try {
          await client.close()
        } catch {
          /* already gone */
        }
      },
    }
  }
}

export { minimalEnv, normalizeCommand }
