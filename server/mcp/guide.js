/**
 * The guide an ASSISTANT reads — Claude or ChatGPT, not a person.
 *
 * docs/mcp.md is for the people who run and use Mocky. This is for the model on
 * the other end of /mcp: how to go from "fais-moi un post Instagram" to a
 * finished design, which tool when, what never to do. It exists because two
 * real tests went wrong on things a tool description had no room to say: the
 * assistant put a new design into an unrelated old project, and made a post
 * with no picture although one was asked for.
 *
 * Served twice, because clients differ: as the `mocky_guide` tool (every
 * assistant sees tools and calls them) and as the `mocky://guide` resource (for
 * the clients that read resources). Built from the real lists — tool names and
 * screen types — so it cannot describe a tool that does not exist; the test
 * holds it to the registered tools.
 */
import { SCREEN_TYPES } from './screen-types.js'

/** Every tool the guide must explain — and `tools.test.js` checks it against the server. */
export const GUIDED_TOOLS = [
  'mocky_guide',
  'list_projects',
  'get_project',
  'create_design',
  'add_screen',
  'get_design',
  'get_screenshot',
  'search_free_images',
  'add_image',
]

export function buildGuide() {
  const types = Object.entries(SCREEN_TYPES)
    .map(([id, what]) => `| \`${id}\` | ${what} |`)
    .join('\n')
  return `# Using Mocky — a guide for the assistant

Mocky turns a description of a screen into a real React + Tailwind design, saves
it in the person's Mocky account and photographs it. You drive it with the tools
below. Talk to the person in THEIR language; the tool arguments can be in any
language, except free-photo searches, which work best in English.

## The usual way, step by step

1. **Understand the request.** You need three things: what screen it is, who it
   is for (and which product or service), and the tone. If the person has not
   said, ask **at most three short questions**, in one message. Never ask what
   they already told you. If they say "just do it", go with sensible choices.
2. **Pick the screen type** (\`screen_type\`) from the table below whenever the
   request names one — a post, a flyer, a CV, a dashboard, a landing page… It
   decides the format: a flyer is an A4 page, an Instagram post a square image.
3. **Pick the pictures yourself** whenever the screen shows a photo (posts,
   flyers, posters, landing pages, product pages, menus…), and ALWAYS when the
   person asks for an image:
   - \`search_free_images\` with a few English words → look at the thumbnails →
     \`add_image\` with the chosen \`free_image_id\`;
   - or a picture from this conversation (one you generated, one the person
     attached) → \`add_image\` with \`image_file\`;
   - or a public address → \`add_image\` with \`image_url\`.
   Each \`add_image\` returns an \`image_id\`. Pass them to the design in
   \`images\`, each with what it is for: \`[{ "image_id": "…", "use": "hero:
   the bakery's storefront" }]\`.
   If you pass none, Mocky finds one itself for a post or a document
   (\`picture_source\`: \`auto\` by default — a free photo, else a generated one).
4. **Create the design** with \`create_design\`. It ALWAYS starts a NEW project;
   give it a short \`project_name\`. Pass what you learnt in \`kind\`,
   \`audience\` and \`style\`, and \`device\` (\`desktop\` by default, \`mobile\`,
   \`tablet\`) when it matters.
5. **Wait if needed.** A design takes from thirty seconds to a few minutes. If the
   answer says it is still running, call \`get_design\` with the \`job_id\`
   (again if needed). Do NOT call \`create_design\` a second time for the same
   request: one design at a time per account, and a second call only returns the
   first one.
6. **Show the result.** Show the picture you get back and give the link. The
   link opens the project in Mocky and requires the person to be signed in to
   their account. Repeat the notes the answer carries (the screen type used,
   which picture the screen got, anything that could not be done).

## Adding to an existing project

Only when the person **explicitly** asks for a project — by its name or its
link. Then: \`list_projects\` to find its id, and \`add_screen\` with that
\`project_id\`. The new screen follows that project's art direction. **Never
choose a project yourself because it looks related**: a new design in an
unrelated project inherits its look, and that is a mistake the person has to
clean up. When in doubt, \`create_design\`.

## The tools

| Tool | When |
|---|---|
| \`mocky_guide\` | This guide. Once, before your first design in a conversation. |
| \`list_projects\` | To find a project the person named, or to answer "what do I have in Mocky". |
| \`get_project\` | The screens of one project (ids, names, links). |
| \`create_design\` | Every new design. Always a new project. |
| \`add_screen\` | A new screen in a project the person explicitly asked for. |
| \`get_design\` | To wait for a design that is still running. |
| \`get_screenshot\` | A picture of a screen that already exists. |
| \`search_free_images\` | Free photos (Pexels, Pixabay) as thumbnails to look at. |
| \`add_image\` | Put one picture in the account's library, to pass to a design. |

## Screen types

| \`screen_type\` | What it is |
|---|---|
${types}

Omit \`screen_type\` only for a screen that is none of these. If you omit it,
Mocky reads it from the request's words when it can, and says which it used.

## Other options

- \`muse: true\` — Mocky's art direction designs the look first (palette, type,
  mood). Slower. Use it when the person wants something distinctive and has
  given no visual direction.
- \`picture_source\` — when you pass no \`images\`: \`auto\`, \`free\`,
  \`generated\` or \`none\`.

## When something goes wrong

- **"needs_clarification"** — the request said too little. Ask the person the
  questions it lists, then call again with the answers in \`kind\`,
  \`audience\`, \`style\`.
- **Maintenance** — Mocky is read-only for a while; say so and try later.
- **Daily limit reached**, **no generation provider**, **remote generation not
  available** — an administrator's setting; tell the person.
- **Free photos not available** — no photo library is configured for this
  account; bring a picture another way, or let \`picture_source\` decide.
- **An id that is not found** — projects, screens, jobs and images of other
  accounts do not exist for you. Use the ids the tools returned.
- **The generation failed** — say what the answer says; one new attempt is
  reasonable, not a loop.

## Never

- Never pick an existing project on your own.
- Never invent an id, a URL or a picture address.
- Never call \`create_design\` again while a design is still running.
- Never promise a picture you did not get: repeat what the answer says.
`
}
