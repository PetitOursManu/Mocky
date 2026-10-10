/**
 * The prompts an assistant's client offers its person — the "/" menu in Claude,
 * the suggestions elsewhere — and the downloadable skill's example requests.
 *
 * A prompt is a STARTING message, written as the person would write it, that
 * already names the right tool and the right order. It exists because the guide
 * (guide.js) is read by the model, while the person meets Mocky through what
 * their client shows them: "Design a screen with Mocky" is a door; a guide is
 * not. Each one is a few sentences, never a second copy of the guide — the
 * tools' rules stay in one place, and a prompt that restated them would drift.
 *
 * Every argument is optional: a prompt picked from a menu with nothing filled
 * in must still start a sensible conversation (the assistant asks what it
 * lacks), and a client that cannot ask for arguments sends none.
 */
import { z } from 'zod'

const text = (s, n = 500) => z.string().max(n).optional().describe(s)
const said = (label, value) => (value && String(value).trim() ? `${label}: ${String(value).trim()}\n` : '')
const LANGUAGE = 'Reply in my language.'

/** name → { title, description, args (zod shape), message(args) } */
export const PROMPTS = {
  'new-design': {
    title: 'Design a screen with Mocky',
    description: 'Starts a short interview, then has Mocky generate the screen.',
    args: { subject: text('What you want to design, if you already know.') },
    message: ({ subject }) =>
      (subject ? `I want to design this with Mocky: ${subject}\n\n` : 'I want to design a screen with Mocky.\n\n') +
      'Ask me at most three short questions about what you do not know yet — the kind of screen, who it is for, the tone and colours — then call create_design with my answers. ' +
      LANGUAGE,
  },
  'social-post': {
    title: 'A social media post',
    description: 'An Instagram, Facebook or LinkedIn post with its picture.',
    args: {
      subject: text('What the post announces or shows.'),
      network: text('instagram, facebook or linkedin — Instagram if omitted.', 40),
    },
    message: ({ subject, network }) =>
      `I want a ${network || 'Instagram'} post made with Mocky.\n` +
      said('Subject', subject) +
      '\nIf the subject, the dates or the tone are missing, ask me in one short message. Then choose the picture: search_free_images with a few English words, look at the thumbnails, add_image with the best one — or pass picture_subject in English if none fits. ' +
      'Call create_design with screen_type set to the network, the post\'s content as the brief, and the picture. Show me the result and its link. ' +
      LANGUAGE,
  },
  'printed-document': {
    title: 'A flyer, poster, menu or CV',
    description: 'A printable page — A4 unless you name another size.',
    args: {
      kind: text('flyer, poster, menu, CV, invoice, certificate…', 60),
      subject: text('What it is about, and the facts it must carry.'),
    },
    message: ({ kind, subject }) =>
      `I want a printable ${kind || 'document'} made with Mocky.\n` +
      said('Content', subject) +
      '\nAsk me in one short message for any fact the page must carry that I did not give (names, dates, prices, contact). ' +
      'Use the matching screen_type, and page_format if I name a size. If the page shows a photo, choose it with search_free_images and add_image, or pass picture_subject in English. ' +
      'Then create_design and show me the result and its link. ' +
      LANGUAGE,
  },
  'landing-page': {
    title: 'A landing page',
    description: 'A product or service landing page, art-directed by Muse.',
    args: {
      product: text('The product, service or event the page presents.'),
      audience: text('Who the page is for.', 200),
    },
    message: ({ product, audience }) =>
      'I want a landing page made with Mocky.\n' +
      said('Product', product) +
      said('For', audience) +
      '\nAsk me at most three short questions if the offer, the audience or the tone are unclear. Pick a hero picture with search_free_images and add_image when one fits. ' +
      'Call create_design with screen_type "landing" and Muse on, then show me the result and its link. ' +
      LANGUAGE,
  },
  'add-to-project': {
    title: 'Add a screen to one of my projects',
    description: 'A new screen in an existing project, in that project’s style.',
    args: {
      project: text('The project’s name, as it is called in Mocky.', 120),
      screen: text('The screen to add.'),
    },
    message: ({ project, screen }) =>
      'I want to add a screen to one of my Mocky projects.\n' +
      said('Project', project) +
      said('Screen', screen) +
      '\nFind the project with list_projects — only the one I named; if several could match or none does, ask me. Then add_screen with its project_id and the screen as the brief, and show me the result and its link. ' +
      LANGUAGE,
  },
  'change-screen': {
    title: 'Change a screen',
    description: 'Edit a screen already made — only what you ask changes.',
    args: {
      change: text('What to change.'),
      screen: text('Which screen, if it is not the one we just made.', 200),
    },
    message: ({ change, screen }) =>
      'I want to change a screen in Mocky.\n' +
      said('Screen', screen) +
      said('Change', change) +
      '\nIf it is not the screen we just made, find it with list_projects and get_project. Call edit_design with my change, in my words, as the instruction — only that change. ' +
      'Show me the new picture, and remind me that the previous version can be restored in Mocky. ' +
      LANGUAGE,
  },
  'review-screen': {
    title: 'Review a screen',
    description: 'Quality pass, or accessibility and SEO check, on an existing screen.',
    args: {
      screen: text('Which screen, if it is not the one we just made.', 200),
      focus: text('quality, or accessibility — quality if omitted.', 40),
    },
    message: ({ screen, focus }) =>
      'I want a screen reviewed in Mocky.\n' +
      said('Screen', screen) +
      '\n' +
      (/access|seo|a11y/i.test(String(focus || ''))
        ? 'Run audit_design and tell me the findings in plain words. Ask me before fixing them; if I agree, run fix_accessibility — the screen must look the same.'
        : 'Run polish_design: tell me the score, what was corrected and what is left.') +
      ' If it is not the screen we just made, find it with list_projects and get_project first. ' +
      LANGUAGE,
  },
}

/** Registers every prompt on an MCP server. */
export function registerPrompts(server) {
  for (const [name, p] of Object.entries(PROMPTS)) {
    server.registerPrompt(name, { title: p.title, description: p.description, argsSchema: p.args }, (args) => ({
      messages: [{ role: 'user', content: { type: 'text', text: p.message(args || {}) } }],
    }))
  }
}
