/**
 * What an assistant may do once connected — one McpServer per request, built
 * for the account the token belongs to.
 *
 * Phase 2a ships a single read: `list_projects`, enough for a person to check
 * from Claude or ChatGPT that the connection works and is theirs. The tools
 * that make designs (plans/mcp-serveur.md §5) arrive with the headless runner.
 *
 * Two rules every tool here keeps, and every later one must:
 *  - it acts as `user` and as nobody else; a project id that is not theirs
 *    gets the same answer as one that does not exist (X5);
 *  - nothing private leaves: never a screen's notes (I9), never a key, never
 *    another account. What travels is what the person could read on their own
 *    home page.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { parseProjects } from '../merge.js'

export const SERVER_INFO = { name: 'mocky', version: '1.0.0' }

/** One project as an assistant sees it. A whitelist, so a new field stays home until someone adds it here. */
export function projectSummary(p, linkFor) {
  return {
    id: p.id,
    name: typeof p.name === 'string' ? p.name : '',
    screens: Array.isArray(p.screens) ? p.screens.length : 0,
    folder: typeof p.folder === 'string' ? p.folder : undefined,
    updatedAt: typeof p.updatedAt === 'number' ? new Date(p.updatedAt).toISOString() : undefined,
    link: linkFor(p.id),
  }
}

/**
 * @param {object} deps
 * @param {{ id: string, username: string }} deps.user
 * @param {() => string|null} deps.readProjects  the account's stored projects string
 * @param {(projectId: string) => string} deps.linkFor
 */
export function buildMcpServer({ user, readProjects, linkFor }) {
  const server = new McpServer(SERVER_INFO, {
    instructions:
      'Mocky turns a description of a screen into a working React + Tailwind design. ' +
      `You are connected as the Mocky account "${user.username}". ` +
      'Links to projects open in Mocky and require the person to be signed in to this account.',
  })

  server.registerTool(
    'list_projects',
    {
      title: 'List my Mocky projects',
      description:
        'Lists the projects of the connected Mocky account: name, number of screens, last change and a link that opens it in Mocky. Read-only.',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const projects = parseProjects(readProjects())
        .filter((p) => p && typeof p.id === 'string' && !p.deletedAt)
        .map((p) => projectSummary(p, linkFor))
      const text = projects.length
        ? projects.map((p) => `- ${p.name || '(untitled)'} — ${p.screens} screen(s) — ${p.link}`).join('\n')
        : 'This account has no projects yet.'
      return { content: [{ type: 'text', text }], structuredContent: { projects } }
    },
  )

  return server
}
