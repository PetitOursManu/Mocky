// A minimal, real MCP server over stdio — used by the integration test to prove
// the McpHost ⇄ real SDK ⇄ subprocess wiring end-to-end (not just fakes). It
// exposes `fetch_url` / `fetch_urls` tools that return canned Markdown, standing
// in for fetcher-mcp without any network or Playwright.
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'

const server = new Server(
  { name: 'mock-fetch', version: '0.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'fetch_url',
      description: 'Fetch one URL as Markdown',
      inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    },
    {
      name: 'fetch_urls',
      description: 'Fetch several URLs as Markdown',
      inputSchema: { type: 'object', properties: { urls: { type: 'array', items: { type: 'string' } } }, required: ['urls'] },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  const url = name === 'fetch_urls' ? args?.urls?.[0] : args?.url
  return { content: [{ type: 'text', text: `# Mock inspiration for ${url}\n\nClean, readable Markdown extracted from the page.` }] }
})

await server.connect(new StdioServerTransport())
