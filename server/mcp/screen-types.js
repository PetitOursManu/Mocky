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
