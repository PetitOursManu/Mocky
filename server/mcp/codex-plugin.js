/**
 * The Codex plugin: Mocky's connector and its guide, packaged for OpenAI's
 * Codex and the ChatGPT desktop app the way `skill.js` packages them for Claude.
 *
 * A plugin is a folder: a manifest, the MCP server it connects to and the skills
 * it brings. What a person downloads is a ready-made LOCAL MARKETPLACE around that
 * folder, because a local plugin is installed through a marketplace file — they
 * unzip it, add it (`codex plugin marketplace add …/mocky-codex`, or by copying
 * it where the desktop app reads a personal marketplace) and install "Mocky"
 * from the Plugins Directory. The steps travel in the zip's README.
 *
 * TWO MANIFESTS, ON PURPOSE
 *
 * OpenAI's current format is a portable `plugin.json` at the plugin's root, with
 * `skills/` found by convention and the servers in `mcp.json`. The older layout —
 * `.codex-plugin/plugin.json` naming `./skills/` and `./.mcp.json` — is what the
 * catalogue in openai/plugins is still written in and what an older Codex reads.
 * Both are generated from the same values below, so they cannot disagree, and a
 * person on either version installs the same plugin.
 *
 * NOTHING SECRET IS IN IT
 *
 * The plugin names this instance's `/mcp` address and nothing else. Signing in is
 * the connector's OAuth flow (`provider.js`), with a client the plugin host
 * registers itself (`mode: "dcr"`, the SDK's `/register`): the manifest format
 * has no field for a secret, and an assistant key (`mocky_ak_`) is something a
 * person creates for a client and never something a download carries (X8).
 */
import { buildSkillMarkdown, SKILL_NAME } from './skill.js'
import { makeZip } from '../images/zip.js'

/** The plugin's identifier and component namespace — kebab-case, stable. */
export const CODEX_PLUGIN_NAME = 'mocky'

/** The marketplace the zip is, and the folder it unzips to. */
export const CODEX_MARKETPLACE_NAME = 'mocky-local'
export const CODEX_FOLDER = 'mocky-codex'

/** The server's name inside the plugin; tools are namespaced by it. */
const SERVER = 'mocky'

const SHORT = 'Design screens and visuals with Mocky'
const LONG =
  'Create and change designs in your Mocky account from Codex: social media posts, flyers, posters, menus, CVs, landing pages, dashboards and app screens, as real React + Tailwind screens. ' +
  'Mocky generates, polishes and audits them; this plugin connects Codex to your Mocky through its MCP connector and brings the guide that explains the steps, the screen types and the pictures.'

const PROMPTS = [
  'Create an Instagram post announcing our summer opening, in Mocky',
  'Make a one-page menu for a small Italian restaurant in Mocky',
  'Polish the landing page I made in Mocky yesterday',
]

function interfaceOf(origin) {
  return {
    displayName: 'Mocky',
    shortDescription: SHORT,
    longDescription: LONG,
    developerName: 'Mocky',
    category: 'Design',
    capabilities: ['Read', 'Write'],
    websiteURL: origin,
    defaultPrompt: PROMPTS,
  }
}

const json = (value) => `${JSON.stringify(value, null, 2)}\n`

/**
 * Every file of the plugin folder, by its path inside it.
 *
 * @param {{ origin: string, mcpUrl: string, client?: boolean, version?: string }} opts
 */
export function codexPluginFiles({ origin, mcpUrl, client = false, version = '1.0.0' }) {
  const description = `${SHORT}: posts, flyers, menus, landing pages and app screens, through your Mocky account.`
  const portable = {
    $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    name: CODEX_PLUGIN_NAME,
    version,
    description,
    homepage: origin,
    repository: 'https://github.com/PetitOursManu/Mocky',
    license: 'AGPL-3.0-or-later',
    keywords: ['design', 'mockup', 'ui', 'social-media', 'flyer', 'landing-page', 'react', 'tailwind'],
    extensions: { 'com.openai': { interface: interfaceOf(origin) } },
  }
  const mcp = {
    $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
    mcpServers: {
      [SERVER]: {
        type: 'streamable-http',
        url: mcpUrl,
        extensions: { 'com.openai': { auth: { type: 'oauth', client: { mode: 'dcr' }, registrationUrl: `${origin}/register` } } },
      },
    },
  }
  const legacy = {
    name: CODEX_PLUGIN_NAME,
    version,
    description,
    homepage: origin,
    repository: 'https://github.com/PetitOursManu/Mocky',
    license: 'AGPL-3.0-or-later',
    skills: './skills/',
    mcpServers: './.mcp.json',
    interface: interfaceOf(origin),
  }
  const legacyMcp = {
    mcpServers: {
      [SERVER]: {
        type: 'http',
        url: mcpUrl,
        note: 'Your Mocky account. Signs in with OAuth on first connection.',
      },
    },
  }
  return {
    'plugin.json': json(portable),
    'mcp.json': json(mcp),
    '.codex-plugin/plugin.json': json(legacy),
    '.mcp.json': json(legacyMcp),
    [`skills/${SKILL_NAME}/SKILL.md`]: buildSkillMarkdown({ mcpUrl, client }),
  }
}

/** The local marketplace around the plugin — what `codex plugin marketplace add` reads. */
export function codexMarketplace() {
  return json({
    name: CODEX_MARKETPLACE_NAME,
    interface: { displayName: 'Mocky' },
    plugins: [
      {
        name: CODEX_PLUGIN_NAME,
        source: { source: 'local', path: `./plugins/${CODEX_PLUGIN_NAME}` },
        policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
        category: 'Design',
      },
    ],
  })
}

/**
 * The install steps, in both of Mocky's languages: a download has no locale.
 *
 * The marketplace's `source.path` is relative to the marketplace ROOT — the
 * folder holding `.agents/` — so the manual install keeps `.agents` and `plugins`
 * side by side in the home folder, where the personal marketplace is read.
 */
export function codexReadme(mcpUrl) {
  return `# Mocky for Codex

## English

1. Unzip this file. You get a folder named \`${CODEX_FOLDER}\`.
2. Add it as a marketplace:
   \`codex plugin marketplace add /path/to/${CODEX_FOLDER}\`
   (or, by hand: copy its \`.agents\` and \`plugins\` folders into your home folder,
   side by side, and restart the ChatGPT desktop app).
3. Open the Plugins Directory (ChatGPT desktop app, or Codex), choose the
   **Mocky** marketplace and install **Mocky**.
4. On first use, sign in to your Mocky account when asked. The plugin connects to
   ${mcpUrl}

## Français

1. Décompressez ce fichier : vous obtenez un dossier \`${CODEX_FOLDER}\`.
2. Ajoutez-le comme marketplace :
   \`codex plugin marketplace add /chemin/vers/${CODEX_FOLDER}\`
   (ou, à la main : copiez ses dossiers \`.agents\` et \`plugins\` dans votre dossier
   personnel, côte à côte, puis redémarrez l'application de bureau ChatGPT).
3. Ouvrez le répertoire des plugins (application de bureau ChatGPT, ou Codex),
   choisissez la marketplace **Mocky** et installez **Mocky**.
4. À la première utilisation, connectez-vous à votre compte Mocky quand c'est
   demandé. Le plugin se connecte à ${mcpUrl}
`
}

/** The zip a person downloads: a local marketplace holding the plugin. */
export function buildCodexPluginZip({ origin, mcpUrl, client = false }) {
  const plugin = codexPluginFiles({ origin, mcpUrl, client })
  return makeZip([
    { name: `${CODEX_FOLDER}/README.md`, data: codexReadme(mcpUrl) },
    { name: `${CODEX_FOLDER}/.agents/plugins/marketplace.json`, data: codexMarketplace() },
    ...Object.entries(plugin).map(([path, data]) => ({ name: `${CODEX_FOLDER}/plugins/${CODEX_PLUGIN_NAME}/${path}`, data })),
  ])
}
