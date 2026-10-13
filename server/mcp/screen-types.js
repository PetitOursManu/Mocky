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
  flyer: 'printable flyer (A6 to A3, DL or square; flat or a folded leaflet)',
  poster: 'poster (A3 document)',
  report: 'multi-page report document',
  documentation: 'documentation / user guide document',
  resume: 'CV / résumé document',
  invoice: 'invoice or quote document',
  certificate: 'certificate / diploma document',
  menu: 'restaurant menu document (can be a folded leaflet)',
  magazine: 'a magazine page — create_publication starts an issue (4 pages); in a project that has one, add_screen with this type adds one inside page',
  book: 'a book page — create_publication starts a book (4 pages); in a project that has one, add_screen with this type adds one inside page',
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
  'a3-landscape': 'A3 landscape',
  a2: 'A2 portrait (a large poster)',
  a5: 'A5 portrait (a common flyer, a book page)',
  'a5-landscape': 'A5 landscape',
  a6: 'A6 (postcard size)',
  dl: 'DL 99×210 mm (a rack leaflet)',
  'square-21': 'square 210×210 mm',
  letter: 'US Letter portrait',
  'letter-landscape': 'US Letter landscape',
  slides: '16:9 slides',
  'social-square': 'square 1:1, 1080×1080',
  'social-portrait': 'portrait 4:5, 1080×1350 (an Instagram post by default)',
  'social-story': 'story 9:16, 1080×1920',
  'social-landscape': 'landscape 1.91:1, 1200×628 (a Facebook or LinkedIn post by default)',
}

/**
 * The folds of a folded leaflet — FOLD_IDS in src/lib/folds.ts, mirrored for the
 * reason the lists above are and held equal by `tools.test.js`. Only a flyer
 * or a menu folds, and only on A5 to A3 (the composer offers the same).
 */
export const FOLDS = {
  half: 'two panels, folded in half like a card (A5, A4, A3, Letter)',
  roll: 'three-panel roll fold, the classic tri-fold (A4, A3, Letter)',
  z: 'three-panel Z fold, an accordion (A4, A3, Letter)',
  gate: 'gate fold, two flaps closing on a double centre panel (A4, A3, Letter)',
  accordion4: 'four-panel accordion (A4, A3)',
}

/**
 * A campaign's formats — CAMPAIGN_FORMAT_IDS in src/lib/campaign.ts, mirrored
 * and held equal the same way.
 */
export const CAMPAIGN_FORMATS = {
  poster: 'A3 poster',
  flyer: 'A4 flyer',
  instagram: 'Instagram post 4:5',
  story: 'Instagram story 9:16',
  linkedin: 'LinkedIn visual 1:1',
  facebook: 'Facebook visual 1.91:1',
}

/** A publication's kinds — PUBLICATION_KINDS in src/lib/publication.ts. */
export const PUBLICATION_KINDS = {
  magazine: 'a magazine issue: front cover, two inside pages, back cover — then pages added one by one',
  book: 'a book: front cover, two inside pages, back cover — then pages added one by one',
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
