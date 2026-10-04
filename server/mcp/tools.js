/**
 * What an assistant may do once connected — one McpServer per request, built
 * for the account the token belongs to.
 *
 *   list_projects   the account's projects, with links            (read)
 *   get_project     one project's screens                         (read)
 *   create_design   a new screen in a NEW project, made by the runner (write)
 *   add_screen      a new screen in a project the person named    (write)
 *   get_design      a design being made: wait for it, get it      (read)
 *   get_screenshot  a picture of a screen that already exists     (read)
 *   + the prompt `new-design`, which starts the short interview
 *
 * Rules every tool here keeps, and every later one must:
 *  - it acts as `user` and nobody else; a project, screen or job that is not
 *    theirs answers exactly like one that does not exist (X4);
 *  - nothing private leaves: never a screen's notes (I9), never a key, never
 *    another account. What travels is what the person could read on their own
 *    home page — a whitelist, so a new field stays home until someone adds it;
 *  - a tool that WRITES checks maintenance itself, because /mcp is let through
 *    maintenance for the reads (server/maintenance.js);
 *  - the person's words are data: a brief is passed to the pipeline as the
 *    composer passes a prompt, never interpreted here.
 *
 * Long work does not hold a request open past `WAIT_MS`: an assistant's tool
 * call has a deadline of its own, shorter than a generation with Muse. So
 * `create_design` waits that long and then answers "still running, ask
 * get_design with this id" — which waits that long again.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { parseProjects } from '../merge.js'

export const SERVER_INFO = { name: 'mocky', version: '1.0.0' }

/** How long one call waits for a design before handing back a job id. */
export const WAIT_MS = 40_000

/**
 * The fewest words a brief may have when nothing else says what it is for.
 * Below it, `create_design` asks instead of generating: three questions cost
 * nothing, a screen invented from "un site" costs a generation and is wrong.
 */
export const THIN_BRIEF_WORDS = 6

const DEVICES = ['desktop', 'mobile', 'tablet']

/** One project as an assistant sees it. A whitelist. */
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

/** One screen as an assistant sees it. A whitelist: notes, code and history stay home. */
export function screenSummary(s, projectId, linkFor) {
  return {
    id: s.id,
    name: typeof s.name === 'string' ? s.name : '',
    device: typeof s.device === 'string' ? s.device : undefined,
    width: typeof s.w === 'number' ? s.w : undefined,
    height: typeof s.h === 'number' ? s.h : undefined,
    request: typeof s.prompt === 'string' ? s.prompt.slice(0, 500) : undefined,
    createdAt: typeof s.createdAt === 'number' ? new Date(s.createdAt).toISOString() : undefined,
    link: linkFor(projectId, s.id),
  }
}

/**
 * French or English, from the words themselves — the questions follow the
 * person. One unmistakably French word is enough: the briefs that need the
 * questions are exactly the shortest ones ("un site"), and two signals out of
 * two words was a bar a French person could not clear. Words both languages
 * use ("page", "site", "de" in a name) do not count.
 */
export function briefLanguage(text) {
  const t = ` ${String(text || '').toLowerCase().replace(/[’']/g, ' ')} `
  if (/[éèêàçùôîœ]/.test(t)) return 'fr'
  return /\s(le|la|les|un|une|des|pour|avec|et|du|au|aux|mon|ma|mes|accueil|appli|écran|boutique)\s/.test(t) ? 'fr' : 'en'
}

const QUESTIONS = {
  fr: [
    'De quel écran s’agit-il : une page d’accueil, un tableau de bord, une page de connexion, un formulaire… ?',
    'Pour qui, et pour quel produit ou service ?',
    'Quel ton visuel : sobre, chaleureux, luxueux, ludique… et y a-t-il des couleurs à respecter ?',
  ],
  en: [
    'What screen is it: a home page, a dashboard, a sign-in page, a form…?',
    'Who is it for, and for which product or service?',
    'What visual tone: sober, warm, luxurious, playful… and are there colours to keep?',
  ],
}

/** Whether a request says too little to design from. */
export function needsClarification({ brief, kind, audience, style }) {
  const words = String(brief || '').trim().split(/\s+/).filter(Boolean).length
  return words < THIN_BRIEF_WORDS && !kind && !audience && !style
}

/** The brief the pipeline receives: the person's words, then what the assistant learnt. */
export function composeBrief({ brief, kind, audience, style }, lang) {
  const label = lang === 'fr' ? { kind: 'Type d’écran', audience: 'Public', style: 'Style' } : { kind: 'Screen type', audience: 'Audience', style: 'Style' }
  return [
    String(brief || '').trim(),
    kind ? `${label.kind} : ${String(kind).trim()}` : '',
    audience ? `${label.audience} : ${String(audience).trim()}` : '',
    style ? `${label.style} : ${String(style).trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 4000)
}

const text = (t) => ({ type: 'text', text: t })
const refuse = (message) => ({ content: [text(message)], isError: true })

/**
 * @param {object} deps
 * @param {{ id: string, username: string }} deps.user
 * @param {() => string|null} deps.readProjects          the account's stored projects string
 * @param {(projectId: string, screenId?: string) => string} deps.linkFor
 * @param {ReturnType<import('./runner.js').createRunner>} deps.runner
 * @param {() => boolean} deps.maintenance
 * @param {() => number|null} deps.dailyQuota
 * @param {() => boolean} deps.hasTextProvider
 * @param {(hash: string) => string} deps.shotLink        a signed, expiring URL to the JPEG
 */
export function buildMcpServer(deps) {
  const { user, readProjects, linkFor, runner } = deps
  const server = new McpServer(SERVER_INFO, {
    instructions:
      'Mocky turns a description of a screen into a working React + Tailwind design, generated by Mocky and saved in the person\'s Mocky account. ' +
      `You are connected as the Mocky account "${user.username}". ` +
      'A new design goes in a NEW project (create_design). Add to an existing project (add_screen) only when the person explicitly asks for that project — never because one looks related. ' +
      'Before designing, make sure you know what screen it is, who it is for and the tone wanted; when the person has not said, ask them at most three short questions — never questions they already answered. ' +
      'A generation takes from thirty seconds to a few minutes: if create_design answers that it is still running, call get_design with the job id. ' +
      'Show the person the picture you get back, and give them the link: it opens the project in Mocky and requires them to be signed in to this account.',
  })

  const projects = () => parseProjects(readProjects()).filter((p) => p && typeof p.id === 'string' && !p.deletedAt)
  const findProject = (id) => projects().find((p) => p.id === id)

  /** What a finished (or failed, or running) job becomes in a tool result. */
  function jobResult(job, lang) {
    if (!job) return refuse(lang === 'fr' ? 'Ce travail n’existe pas.' : 'No such job.')
    if (job.status === 'queued' || job.status === 'running') {
      return {
        content: [
          text(
            lang === 'fr'
              ? `Le design est en cours (${job.progress || 'en file'}). Rappelle get_design avec job_id "${job.id}" pour attendre la suite.`
              : `The design is still being made (${job.progress || 'queued'}). Call get_design with job_id "${job.id}" to wait for it.`,
          ),
        ],
        structuredContent: { status: job.status, jobId: job.id, progress: job.progress || null },
      }
    }
    if (job.status === 'failed') {
      return {
        content: [text((lang === 'fr' ? 'La génération a échoué : ' : 'The generation failed: ') + (job.error || '—'))],
        structuredContent: { status: 'failed', jobId: job.id, error: job.error || null },
        isError: true,
      }
    }
    const r = job.result
    const link = linkFor(r.projectId, r.screenId)
    const jpeg = r.shot ? runner.readShot(r.shot, 'jpg') : null
    const notes = [...(r.warning ? [r.warning] : []), ...(r.notices || [])]
    const lines = [
      lang === 'fr' ? `Design prêt. Ouvrir dans Mocky : ${link}` : `Design ready. Open it in Mocky: ${link}`,
      r.shot ? (lang === 'fr' ? `Image : ${deps.shotLink(r.shot)}` : `Picture: ${deps.shotLink(r.shot)}`) : '',
      notes.length ? (lang === 'fr' ? 'Remarques : ' : 'Notes: ') + notes.join(' ') : '',
    ].filter(Boolean)
    return {
      content: [...(jpeg ? [{ type: 'image', data: jpeg.toString('base64'), mimeType: 'image/jpeg' }] : []), text(lines.join('\n'))],
      structuredContent: {
        status: 'done',
        jobId: job.id,
        projectId: r.projectId,
        screenId: r.screenId,
        link,
        picture: r.shot ? deps.shotLink(r.shot) : null,
        notes,
      },
    }
  }

  server.registerTool(
    'list_projects',
    {
      title: 'List my Mocky projects',
      description:
        'Lists the projects of the connected Mocky account: name, number of screens, last change and a link that opens it in Mocky. Read-only.',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const list = projects().map((p) => projectSummary(p, (id) => linkFor(id)))
      const body = list.length
        ? list.map((p) => `- ${p.name || '(untitled)'} — ${p.screens} screen(s) — id ${p.id} — ${p.link}`).join('\n')
        : 'This account has no projects yet.'
      return { content: [text(body)], structuredContent: { projects: list } }
    },
  )

  server.registerTool(
    'get_project',
    {
      title: 'Show one Mocky project',
      description: 'The screens of one project of the connected account: name, device, the request that made it, and a link to each. Read-only.',
      inputSchema: { project_id: z.string().min(1).max(64).describe('The project id, from list_projects.') },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ project_id }) => {
      const p = findProject(project_id)
      if (!p) return refuse('No such project in this account.')
      const screens = (p.screens || []).map((s) => screenSummary(s, p.id, linkFor))
      const body = [
        `${p.name || '(untitled)'} — ${linkFor(p.id)}`,
        ...screens.map((s) => `- ${s.name || '(untitled)'} (${s.device || '?'}, id ${s.id}) — ${s.link}`),
      ].join('\n')
      return { content: [text(body)], structuredContent: { project: projectSummary(p, (id) => linkFor(id)), screens } }
    },
  )

  /**
   * The design itself, for both doors below. `project` is the existing project
   * a screen is added to, or null for a new project — decided by WHICH tool the
   * assistant called, never by an optional field it may fill on a hunch.
   */
  async function startDesign(args, project, toolName) {
    const lang = briefLanguage(args.brief)
    if (needsClarification(args)) {
      return {
        content: [
          text(
            (lang === 'fr'
              ? `Avant de générer, il me faut un peu plus de contexte. Pose ces questions à la personne, puis rappelle ${toolName} avec ses réponses (kind, audience, style) :\n`
              : `Before generating, I need a little more context. Ask the person these questions, then call ${toolName} again with the answers (kind, audience, style):\n`) +
              QUESTIONS[lang].map((q, i) => `${i + 1}. ${q}`).join('\n'),
          ),
        ],
        structuredContent: { status: 'needs_clarification', questions: QUESTIONS[lang] },
      }
    }
    if (deps.maintenance()) return refuse(lang === 'fr' ? 'Mocky est en maintenance : réessaie plus tard.' : 'Mocky is in maintenance: try again later.')
    if (!deps.hasTextProvider()) {
      return refuse(lang === 'fr' ? 'Ce Mocky n’a pas de fournisseur de génération configuré par son administrateur.' : 'This Mocky has no generation provider configured by its administrator.')
    }
    const why = runner.availability()
    if (!why.available) return refuse(lang === 'fr' ? `La génération à distance n’est pas disponible sur ce Mocky (${why.reason}).` : `Remote generation is not available on this Mocky (${why.reason}).`)
    const quota = deps.dailyQuota()
    if (quota && !runner.isBusy(user.id) && runner.countToday(user.id) >= quota) {
      return refuse(lang === 'fr' ? `Limite atteinte : ${quota} designs par jour pour ce compte.` : `Limit reached: ${quota} designs a day for this account.`)
    }
    const { job, existing } = runner.enqueue(user.id, {
      brief: composeBrief(args, lang),
      projectId: project ? project.id : undefined,
      projectName: project ? undefined : args.project_name || undefined,
      device: args.device || 'desktop',
      muse: args.muse === true,
      lang,
    })
    const waited = await runner.wait(job.id, user.id, WAIT_MS)
    const out = jobResult(waited, lang)
    if (project && out.structuredContent?.status !== 'failed') {
      // Said every time: a screen added to the wrong project is only noticed
      // if the answer names the project it went into.
      out.content.unshift(
        text(lang === 'fr' ? `Écran ajouté au projet existant « ${project.name || project.id} ».` : `Screen added to the existing project "${project.name || project.id}".`),
      )
    }
    if (existing) {
      out.content.unshift(
        text(
          lang === 'fr'
            ? 'Un design est déjà en cours pour ce compte : voici celui-là. Un seul à la fois.'
            : 'A design is already being made for this account: here is that one. One at a time.',
        ),
      )
    }
    return out
  }

  const designFields = {
    brief: z.string().min(1).max(4000).describe('What the screen is and what it contains, in the person\'s own words.'),
    device: z.enum(DEVICES).optional().describe('desktop (default), mobile or tablet.'),
    kind: z.string().max(200).optional().describe('The type of screen: home page, dashboard, sign-in, pricing…'),
    audience: z.string().max(300).optional().describe('Who it is for, and for which product or service.'),
    style: z.string().max(300).optional().describe('The visual tone, colours to keep, references.'),
    muse: z.boolean().optional().describe('Let Mocky\'s art direction (Muse) design the look first. Slower; off by default.'),
  }

  /*
   * Two tools, not one with an optional project id. With one, adding to an old
   * project was a field a model could fill on its own — and ChatGPT did: it
   * listed the projects, picked an unrelated one, and the new screen inherited
   * that project's art direction (its Muse dossier). A new project is now the
   * only thing `create_design` can do, and joining an existing one takes a
   * different tool whose description says when it may be used.
   */
  server.registerTool(
    'create_design',
    {
      title: 'Create a design in a new Mocky project',
      description:
        'Generates a new screen in Mocky from a description, in a NEW project of the connected account, and returns a picture of it and a link. ' +
        'This is the tool for any new design. Before calling it, make sure you know what the screen is, who it is for and the tone wanted; if the person has not said, ask them at most three short questions first. ' +
        'Pass what you learnt in kind / audience / style. Takes from thirty seconds to a few minutes: when it answers that the design is still running, call get_design with the job id. ' +
        'One design at a time per account.',
      inputSchema: {
        ...designFields,
        project_name: z.string().max(120).optional().describe('A short name for the new project.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => startDesign(args, null, 'create_design'),
  )

  server.registerTool(
    'add_screen',
    {
      title: 'Add a screen to an existing Mocky project',
      description:
        'Generates a new screen and adds it to an EXISTING project, where it follows that project\'s art direction. ' +
        'Use it ONLY when the person explicitly asked to add to that project, by name or by link. Never pick a project yourself because it looks related: for anything else, use create_design, which starts a new project. ' +
        'The answer names the project the screen went into. Same questions first, same waiting, as create_design.',
      inputSchema: {
        project_id: z.string().min(1).max(64).describe('The project the person asked for, from list_projects.'),
        ...designFields,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      const project = findProject(args.project_id)
      if (!project) return refuse(briefLanguage(args.brief) === 'fr' ? 'Aucun projet de ce compte ne porte cet identifiant.' : 'No such project in this account.')
      return startDesign(args, project, 'add_screen')
    },
  )

  server.registerTool(
    'get_design',
    {
      title: 'Get a design being made',
      description: 'Waits for a design started with create_design and returns its picture and link, or says it is still running. Read-only.',
      inputSchema: { job_id: z.string().min(1).max(64).describe('The job id create_design returned.') },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ job_id }) => {
      const job = await runner.wait(job_id, user.id, WAIT_MS)
      return jobResult(job, job?.lang || 'en')
    },
  )

  server.registerTool(
    'get_screenshot',
    {
      title: 'Picture of an existing screen',
      description: 'Returns a picture of a screen that already exists in one of the account\'s projects (ids from get_project). Read-only.',
      inputSchema: {
        project_id: z.string().min(1).max(64),
        screen_id: z.string().min(1).max(64),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ project_id, screen_id }) => {
      const p = findProject(project_id)
      const s = p?.screens?.find((x) => x?.id === screen_id)
      if (!s || typeof s.code !== 'string' || !s.code.trim()) return refuse('No such screen in this account.')
      const why = runner.availability()
      if (!why.available) return refuse(`Pictures are not available on this Mocky (${why.reason}).`)
      try {
        const hash = await runner.photographCode({
          code: s.code,
          w: typeof s.w === 'number' ? s.w : 1440,
          h: typeof s.h === 'number' ? s.h : 900,
          caps: Array.isArray(s.caps) ? s.caps : [],
        })
        const jpeg = runner.readShot(hash, 'jpg')
        const link = linkFor(p.id, s.id)
        return {
          content: [
            ...(jpeg ? [{ type: 'image', data: jpeg.toString('base64'), mimeType: 'image/jpeg' }] : []),
            text(`${s.name || '(untitled)'} — ${link}\nPicture: ${deps.shotLink(hash)}`),
          ],
          structuredContent: { projectId: p.id, screenId: s.id, link, picture: deps.shotLink(hash) },
        }
      } catch (err) {
        return refuse(`The picture could not be taken: ${String(err?.message || err).slice(0, 200)}`)
      }
    },
  )

  server.registerPrompt(
    'new-design',
    {
      title: 'Design a screen with Mocky',
      description: 'Starts a short interview, then has Mocky generate the screen.',
      argsSchema: { subject: z.string().max(500).optional().describe('What you want to design, if you already know.') },
    },
    ({ subject }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              (subject ? `I want to design this with Mocky: ${subject}\n\n` : 'I want to design a screen with Mocky.\n\n') +
              'Ask me at most three short questions about what you do not know yet — the kind of screen, who it is for, the tone and colours — then call create_design with my answers. Reply in my language.',
          },
        },
      ],
    }),
  )

  return server
}
