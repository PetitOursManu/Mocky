/**
 * The Claude skill a person downloads from Settings → Connected assistants.
 *
 * The connector already teaches its own use: `mocky_guide` is a tool, and the
 * server's instructions tell the assistant to call it before a first design.
 * What a skill adds is what the connector cannot: it is in the assistant
 * BEFORE any tool is called. So a conversation that says "fais-moi un flyer"
 * reaches for Mocky without the person naming it, the first design costs no
 * round trip to read the guide, and when the connector is missing the skill
 * knows this instance's address and can say how to add it. It cannot add the
 * connector itself — nothing a skill contains can.
 *
 * Built from the same guide the connector serves (guide.js) and the same
 * prompts (prompts.js), so the two cannot teach different things. Free: a text
 * file in a zip, generated per request, nothing stored.
 */
import { buildGuide } from './guide.js'
import { PROMPTS } from './prompts.js'
import { makeZip } from '../images/zip.js'

/** The folder name, and the skill's `name` — lowercase, digits and hyphens only. */
export const SKILL_NAME = 'mocky'

// ≤ 1024 characters and no angle brackets: the limits Claude puts on a skill's
// description, which is the one text it reads to decide whether to load it.
const DESCRIPTION =
  'Design screens and visuals with Mocky, a self-hosted design generator, through its MCP connector: social media posts (Instagram, Facebook, LinkedIn), flyers, posters, menus, CVs, landing pages, dashboards and app screens. ' +
  'Use it whenever the person asks to create, change, polish or check a design, a mockup, a visual or a page "in Mocky", or asks for such a visual while the Mocky connector is available. ' +
  'Covers choosing the screen type and the pictures, writing the brief, adding to an existing project, editing, the quality pass and the accessibility audit.'

/**
 * SKILL.md for this instance. `mcpUrl` is the connector's address (null when
 * the instance has none to give); `client` adds the section about writing the
 * code yourself, exactly as the connector's own guide does.
 */
export function buildSkillMarkdown({ mcpUrl = null, client = false } = {}) {
  const guide = buildGuide({ client }).replace(/^# .*\n+/, '')
  const examples = Object.values(PROMPTS)
    .map((p) => `- **${p.title}** — ${p.description}`)
    .join('\n')
  // Quoted: the description says "connector: social media posts", and a colon
  // followed by a space ends a plain YAML scalar — the skill would not load. A
  // JSON string is a valid YAML double-quoted scalar, escapes included.
  return `---
name: ${SKILL_NAME}
description: ${JSON.stringify(DESCRIPTION)}
---

# Mocky

Mocky turns a description into a real React + Tailwind design, saved in the
person's Mocky account. Everything here goes through the **Mocky connector**
(MCP): its tools create, change, photograph and review designs.

## Before anything

- If the Mocky tools (\`create_design\`, \`list_projects\`…) are **not available**
  in this conversation, the connector is not added. Do not pretend to design:
  tell the person to add it${mcpUrl ? ` — address \`${mcpUrl}\` — in their assistant's connector settings (Claude: Customize → Connectors → Add custom connector)` : ' in their assistant\'s connector settings, with the address shown in Mocky under Settings → Connected assistants'}, then to try again.
- If they are available, you do NOT need to call \`mocky_guide\` first: this
  skill is that guide. Call it only if a tool answers something this file does
  not explain — the server's guide is the newer of the two.

## What people ask for

${examples}

${guide}`
}

/** The zip a person imports into Claude: one folder, one SKILL.md. */
export function buildSkillZip(opts = {}) {
  return makeZip([{ name: `${SKILL_NAME}/SKILL.md`, data: buildSkillMarkdown(opts) }])
}
