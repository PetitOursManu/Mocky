/**
 * Mocky's screen types — the composer's "Type d'écran" — with what each one is,
 * for the model choosing among them. A MIRROR of SCREEN_THEME_IDS in
 * src/lib/screenThemes.ts (the server cannot import TypeScript at the 22.12
 * floor); `tools.test.js` holds the two lists equal.
 *
 * It exists because the first real test asked for a type in plain words and
 * got a generic web page: the type was only a line of text appended to the
 * brief, and the pipeline's own type — the one that sets a flyer's A4 page or a
 * post's square frame — was never set.
 */
export const SCREEN_TYPES = {
  dashboard: 'dashboard with KPIs and charts',
  planning: 'planning, calendar, schedule',
  kanban: 'kanban board',
  table: 'data table, admin list',
  landing: 'landing page / home page of a site',
  pricing: 'pricing page, plans',
  product: 'product page (e-commerce)',
  checkout: 'cart / checkout / payment',
  auth: 'sign-in or sign-up page',
  onboarding: 'onboarding steps',
  settings: 'settings / account page',
  messaging: 'messaging, inbox, chat',
  booking: 'booking / reservation',
  article: 'article, blog post',
  portfolio: 'portfolio, gallery',
  flyer: 'printable flyer (A4 document)',
  poster: 'poster (A3 document)',
  report: 'multi-page report document',
  documentation: 'documentation / user guide document',
  resume: 'CV / résumé document',
  invoice: 'invoice or quote document',
  certificate: 'certificate / diploma document',
  menu: 'restaurant menu document',
  instagram: 'Instagram post (image)',
  facebook: 'Facebook post (image)',
  linkedin: 'LinkedIn post (image)',
}

/**
 * A document's page sizes — the composer's format chips. A MIRROR of
 * PageFormatId in src/lib/pageFormats.ts, held equal by `tools.test.js`.
 *
 * A post asked for "en 1:1" came back as a square drawn inside the 4:5 page an
 * Instagram post gets by default, with a white band under it: the size was a
 * word in the brief, and nothing set the page.
 */
export const PAGE_FORMATS = {
  a4: 'A4 portrait',
  'a4-landscape': 'A4 landscape',
  a3: 'A3 portrait',
  letter: 'US Letter portrait',
  'letter-landscape': 'US Letter landscape',
  slides: '16:9 slides',
  'social-square': 'square 1:1, 1080×1080',
  'social-portrait': 'portrait 4:5, 1080×1350 (an Instagram post by default)',
  'social-story': 'story 9:16, 1080×1920',
  'social-landscape': 'landscape 1.91:1, 1200×628 (a Facebook or LinkedIn post by default)',
}

/**
 * The size a request names in plain words, when the assistant did not pass
 * one. Only the social sizes, whose words cannot mean anything else; a paper
 * size is the type's own unless the assistant names one.
 */
export function inferPageFormat(text) {
  const t = String(text || '').toLowerCase()
  // No \b after "carré": é is not a word character, so that boundary never comes.
  if (/\b1\s*[:x/]\s*1\b|carr[ée]e?(?![a-z])|\bsquare\b/.test(t)) return 'social-square'
  if (/\b9\s*[:/]\s*16\b|\bstor(?:y|ies)\b/.test(t)) return 'social-story'
  if (/\b4\s*[:/]\s*5\b/.test(t)) return 'social-portrait'
  return null
}
