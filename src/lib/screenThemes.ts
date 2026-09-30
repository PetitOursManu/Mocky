import type { IconName } from '../ui'
import type { PageFormatId } from './pageFormats'

/**
 * Screen TYPES — what a screen is for, not what it looks like.
 *
 * Two catalogues sit near each other and must not be confused. The DESIGN.md
 * presets in `styles.ts` decide the LOOK (a palette, a typeface, a radius); the
 * form-factor presets in `presets.ts` decide the WIDTH. Neither says what a
 * dashboard needs that a landing page does not, and "un dashboard" typed alone
 * came back as three cards and a chart — the model filled the gap with the
 * least it could get away with. A theme is that missing third axis: the
 * sections, components, sample data, states and interactions a competent
 * designer would assume for this kind of screen, written down once.
 *
 * The brief is therefore STRUCTURAL and nothing else. No colour, no font, no
 * spacing value — that is the direction's business, and a brief that named a
 * palette would argue with DESIGN.md and with Muse on every screen it touched.
 * No width either: the preset hint already carries it, and the theme joins the
 * system preamble right beside it (`withScreenTheme`), so a "planning" brief
 * that said "a seven-column grid" would be wrong on a phone. Each brief is
 * written so that the phone reading of it is also right ("columns become a
 * horizontal scroll or a stacked list on narrow screens" is the kind of clause
 * that makes that true).
 *
 * The briefs are English for the reason every other instruction to the model
 * is: the prompt around them is English. The words a person READS — label,
 * description, starter prompt — live in `src/i18n/parts/composer.ts`, keyed by
 * id, and `screenThemes.test.ts` holds the two in step.
 */

export const SCREEN_THEME_IDS = [
  'dashboard',
  'planning',
  'kanban',
  'table',
  'landing',
  'pricing',
  'product',
  'checkout',
  'auth',
  'onboarding',
  'settings',
  'messaging',
  'booking',
  'article',
  'portfolio',
  'flyer',
  'poster',
  'report',
  'documentation',
  'resume',
  'invoice',
  'certificate',
  'menu',
  'instagram',
  'facebook',
  'linkedin',
] as const

export type ScreenThemeId = (typeof SCREEN_THEME_IDS)[number]

export interface ScreenTheme {
  id: ScreenThemeId
  icon: IconName
  /** The type in a few English words, for prompts that only need to name it (Muse, the enhancer). */
  name: string
  /** What the screen must contain, for the generation's system preamble. */
  brief: string
  /**
   * Set when this type is a DOCUMENT — fixed-size pages to print, export to
   * PDF or open as slides (lib/pageFormats.ts) — rather than a screen of an
   * app or a site. `page` is the format the composer offers first; the person
   * can pick another among the page formats, never among the app presets,
   * because a flyer at 1440 × 900 is a web page wearing a flyer's name.
   */
  document?: { page: PageFormatId }
}

/*
 * Icons come from the existing set on purpose. Several lanes of work touch
 * `Icon.tsx` at once, and a glyph drawn for one chip is a merge conflict for a
 * benefit nobody would notice: `library` is three columns (a board), `grid` is
 * cells (a calendar), `pin` is a place (a reservation).
 */
export const SCREEN_THEMES: readonly ScreenTheme[] = [
  {
    id: 'dashboard',
    icon: 'pulse',
    name: 'analytics dashboard',
    brief: `An ANALYTICS DASHBOARD: the screen someone opens every morning to see how things are going.
- Navigation (sidebar or top bar) with the current section marked, a page title, a date-range selector and one primary action (export or create).
- A row of 4 KPI cards: label, a large figure with its unit, the change versus the previous period (+/−, a rise and a fall visibly told apart) and a small sparkline.
- One main time-series chart with a legend and a period toggle (day / week / month), and one secondary breakdown (donut or bar) beside or below it.
- A recent-activity or top-items table: 5–8 rows, a status badge per row, sortable headers.
- Realistic, internally consistent sample data: plausible magnitudes, figures that add up, dates within the selected range. No round placeholder numbers, no lorem ipsum.
- Hover states on chart points and rows; a subtle loading skeleton design is welcome but the screen is shown loaded.`,
  },
  {
    id: 'planning',
    icon: 'grid',
    name: 'planning / calendar',
    brief: `A PLANNING screen: a calendar or schedule someone uses to see and arrange what happens when.
- A header with the current period (e.g. "Week of 14 October"), previous / today / next controls, and a view switch (day / week / month).
- The main view is a WEEK grid: days as columns, hours as rows (roughly 8:00–19:00), with a visible "now" line on today. On narrow screens it becomes a single day or an agenda list.
- 8–12 events with realistic titles, times, durations and owners; some overlap and are laid side by side; a few span all day; each category is tagged distinctly.
- A side panel or strip with a mini month calendar, filters by category or person, and the list of upcoming items.
- A "New event" primary action; one event is shown selected with its details (time, place, participants).
- An empty slot suggests itself on hover ("+ Add").`,
  },
  {
    id: 'kanban',
    icon: 'library',
    name: 'kanban board',
    brief: `A KANBAN BOARD for a team tracking work.
- A header with the board name, members' avatars, a search, filters (assignee, label) and a "New task" action.
- 4 columns such as To do / In progress / Review / Done, each with a count and a "+" to add a card; on narrow screens the columns scroll horizontally.
- 3–5 cards per column: a title, label tags, an assignee avatar, a due date (one overdue, shown as such), and small counters for comments or subtasks; one card has a cover or a progress bar.
- One card is shown in its dragged state or with a visible drop target, so the board reads as interactive.
- Realistic task names for one coherent project; no "Task 1, Task 2".`,
  },
  {
    id: 'table',
    icon: 'list',
    name: 'data table / CRM list',
    brief: `A DATA TABLE screen, CRM-style: a list of records someone searches, filters and acts on.
- A title with the total count, a search field, filter chips or dropdowns (status, owner, date), and a primary "Add" action plus an export.
- The table: a checkbox column, 6–7 meaningful columns (name with avatar or logo, company, status badge, owner, value, last activity), sortable headers with the active sort shown.
- 8–12 rows of realistic, varied records; one row selected, which reveals a bulk-action bar (assign, change status, delete).
- Pagination or "load more" with the range shown ("1–12 of 248").
- Row hover with quick actions; on narrow screens rows become stacked cards keeping name, status and value.
- An empty-search state is described in the code even if the screen shows results.`,
  },
  {
    id: 'landing',
    icon: 'megaphone',
    name: 'marketing landing page',
    brief: `A MARKETING LANDING PAGE that has to convince a visitor in one scroll.
- A header: logo text, 3–5 navigation links, a secondary link and a primary call to action.
- A hero: a specific headline (a promise, not a slogan), a one-sentence subheadline, a primary and a secondary action, and a product visual or illustration.
- A strip of social proof (customer names or a short metric line).
- 3–6 features, each with an icon, a short title and one sentence of concrete benefit.
- A "how it works" sequence or a product showcase section, then testimonials with names and roles.
- A closing call-to-action section and a footer with grouped links and legal line.
- Copy that is specific to the product described; no generic "Lorem" or "Feature 1".`,
  },
  {
    id: 'pricing',
    icon: 'star',
    name: 'pricing page',
    brief: `A PRICING page where a visitor chooses a plan.
- A headline and one line of reassurance (free trial, cancel anytime), and a monthly / yearly toggle showing the yearly saving.
- 3 plan cards side by side (stacked on narrow screens): name, who it is for, price with period, primary action, and 5–8 included features with check marks; the middle plan is marked "Most popular".
- The prices change when the toggle changes (use state), and stay internally consistent.
- A feature comparison table below the cards, grouped by category, with check / dash / limit values.
- An FAQ of 4–6 real questions as an accordion, and a final contact-sales line for larger teams.`,
  },
  {
    id: 'product',
    icon: 'image',
    name: 'e-commerce product page',
    brief: `An E-COMMERCE PRODUCT PAGE for one item.
- A store header with search, account and a cart showing its item count; a breadcrumb.
- A gallery: one large image and 4 thumbnails, the active one marked.
- Product details: name, rating with review count, price (with a crossed-out former price if on sale), a short description, variant selectors (colour swatches, sizes with one unavailable), a quantity stepper, "Add to cart" as the primary action and a secondary "Save".
- Reassurance: delivery estimate, returns, stock level ("Only 3 left").
- Tabs or sections for description, specifications and reviews (3 reviews with names, dates, stars), then a row of 4 related products.
- Selecting a variant updates the selection state visibly.`,
  },
  {
    id: 'checkout',
    icon: 'shield',
    name: 'checkout',
    brief: `A CHECKOUT screen where an order is paid for.
- A minimal header (logo, "Secure checkout", a way back to the cart) and a step indicator (Cart → Delivery → Payment → Confirmation) with the current step marked.
- The form: contact email, delivery address with labelled fields, delivery options as selectable cards with prices and dates, and a payment section (card fields with brand icons, or alternative methods as tabs).
- An order summary beside the form (below on narrow screens): 2–3 line items with thumbnails and quantities, a promo-code field, subtotal, delivery, tax and a clearly larger total.
- One field shown with an inline validation error and its message; the primary "Pay €…" button repeats the total.
- Trust signals: secure payment note, return policy link.`,
  },
  {
    id: 'auth',
    icon: 'key',
    name: 'sign-in / sign-up',
    brief: `A SIGN-IN / SIGN-UP screen.
- A focused layout: the form in one panel, and optionally a second panel with the product's value proposition or a testimonial (hidden on narrow screens).
- A tab or link switch between "Sign in" and "Create account" (use state).
- Social sign-in buttons (2–3 providers) above a divider, then email and password fields with labels, a show/hide password toggle, "Remember me" and "Forgot password?".
- The primary action, and the switch line ("No account yet? Create one").
- One visible validation state (an error message under a field) and a disabled / loading state for the button described in the code.
- Legal line about terms and privacy under the form.`,
  },
  {
    id: 'onboarding',
    icon: 'hand',
    name: 'onboarding flow',
    brief: `An ONBOARDING step: the first minutes of a new user, collecting what the product needs to be useful.
- A progress indicator (step 2 of 4, or dots) and a way to go back and to skip.
- One clear question per step with a friendly title and one line of why it is asked.
- Choices as large selectable cards with an icon and a short description (multi-select allowed, the selected ones visibly checked), or a short form of 2–3 fields.
- A primary "Continue" disabled until an answer is given (use state), and a secondary "Skip for now".
- The screen feels welcoming but efficient: no wall of text, realistic option names for the product described.`,
  },
  {
    id: 'settings',
    icon: 'settings',
    name: 'settings / profile',
    brief: `A SETTINGS / PROFILE screen.
- Section navigation (a side list, or tabs on narrow screens): Profile, Account, Notifications, Billing, Security — the current one marked.
- The Profile section: avatar with change / remove, name, role, email, bio with a character count, language and time-zone selects.
- A Notifications group of toggles with a one-line explanation each; a Security group with password change and two-factor status.
- Save / Cancel actions that appear or enable only when something changed (use state), and a saved confirmation.
- A clearly separated danger zone (delete account) with a destructive-styled action.
- Realistic prefilled values for one plausible person.`,
  },
  {
    id: 'messaging',
    icon: 'comment',
    name: 'messaging / chat',
    brief: `A MESSAGING screen: conversations and one open thread.
- A conversation list: search, then 6–8 conversations with avatar, name, last-message preview, time and unread badge; the open one marked. On narrow screens only the list or the thread is shown, with a back control.
- The thread header: the contact's avatar, name, online status and actions (call, info).
- 10–14 messages alternating sides, grouped by sender with timestamps and a day separator; one message with an attachment or image, one with a reaction, read receipts on the last sent message, and a "typing…" indicator.
- A composer at the bottom: attach, text field, emoji, send; sending a message appends it (use state).
- A natural, coherent conversation, not placeholder lines.`,
  },
  {
    id: 'booking',
    icon: 'pin',
    name: 'booking / reservation',
    brief: `A BOOKING screen where someone reserves a time slot, a table, a room or a service.
- What is being booked, summarised at the top: name, photo or icon, duration or capacity, price, rating, location.
- A date picker (a month calendar with unavailable days greyed) and, for the chosen day, time slots as selectable chips, some taken.
- Options: number of people or guests (stepper), service or room type as selectable cards, an optional note.
- A booking summary (date, time, options, total) that updates live with the selection (use state), and a primary "Confirm booking" action.
- Policy lines: cancellation terms, what happens next.`,
  },
  {
    id: 'article',
    icon: 'note',
    name: 'blog article',
    brief: `A BLOG ARTICLE page made for reading.
- A site header, then the article header: category, a specific title, a standfirst of one or two sentences, author with avatar and role, date and reading time, and a wide cover image.
- The body at a comfortable reading measure: 5–8 paragraphs of real, on-topic prose with subheadings, one pull quote, one figure with a caption, one list and one inline link.
- A table of contents or reading-progress indicator on wide screens.
- Share actions, tags, an author bio card, and 3 related articles as cards.
- The writing is specific to the topic requested; no lorem ipsum anywhere.`,
  },
  {
    id: 'portfolio',
    icon: 'user',
    name: 'portfolio',
    brief: `A PORTFOLIO page presenting one person's or one studio's work.
- A short header: name, discipline, navigation (Work, About, Contact).
- An introduction: one confident sentence about what they do and for whom, and availability status.
- A grid of 6 projects with image, title, client and discipline tags; filters by discipline (use state); hover reveals a short description.
- A selected-clients or recognition strip, a brief about section with a portrait, and a services list.
- A contact section with email, social links and a clear call to action.
- Project names and clients are plausible and coherent with the discipline described.`,
  },
  {
    id: 'flyer',
    icon: 'sparkle',
    name: 'printed flyer',
    document: { page: 'a4' },
    brief: `A FLYER: one striking printed page that stops someone in the street and tells them everything in five seconds. ONE <Page>, unless the request asks for a recto-verso or several pages (then the back carries the detail and any coupon).
- A bold headline set HUGE — the single biggest thing on the page — with a short sub-headline under it. Three clear levels (headline, key facts, detail), readable from across a room.
- The KEY FACTS as a scannable block of their own: date, time, place, price or offer — each with a small icon or a label, never buried in a sentence.
- Three or four highlights (what you get, who is on the bill, what is included) as short punchy lines or badges.
- A call to action printed as WORDS — a verb and a URL, a phone number or a place — beside a square QR-code placeholder box labelled as such. Never a web button.
- A footer band with the contact details and a logo slot (the organiser's name set as a wordmark).
- COLOURFUL and graphic: two or three strong colour blocks and decorative SHAPES — blobs, circles, arcs, waves, stripes, dotted grids, a rotated sticker or starburst badge carrying the offer — layered with care behind and around the content, several bleeding off the page edges. Shapes are CSS boxes (rounded-full, rotate-*, rings, clip-path) or short inline SVG primitives, never long path data, and they carry aria-hidden.
- A hero picture when pictures are supplied, cropped boldly into a shape, a colour block or a frame; without one, a composition of shapes takes its place.
- Everything that must be read stays inside the page's safe margin; only backgrounds and decorative shapes bleed.
- Print contrast: text on a colour block is dark on light or light on dark, never mid on mid; nothing smaller than a caption.
- Only when the request implies signing up, booking or ordering: a tear-off coupon at the foot, behind a dashed cut line with a scissors mark, made of <Field>s (name, email, phone, a choice or a checkbox).
- Real copy for the event or offer described — names, dates, prices, an address — never placeholders.`,
  },
  {
    id: 'poster',
    icon: 'crop',
    name: 'printed poster',
    document: { page: 'a3' },
    brief: `A POSTER: one page seen on a wall or in a window, understood in three seconds from three metres away. ONE <Page>.
- ONE dominant element — a headline of a few words set enormous, or a striking picture with the headline over it — taking at least half of the page.
- A short line under it saying what it is, and the essential facts (date, place, price or where to find out more) grouped in one block, readable from a distance.
- A strong, simple composition: a clear grid, generous empty space, at most three levels of type and no paragraph of body text.
- Colour blocks and bold graphic shapes in the spirit of a screen-printed or Swiss poster, several bleeding off the edges; shapes are CSS boxes or short inline SVG primitives, marked aria-hidden.
- A call to action printed as words (a URL, a date, a place) and, when it helps, a square QR-code placeholder box labelled as such.
- A logo slot or the organiser's name as a wordmark in a corner.
- Real copy for what is announced, never placeholders.`,
  },
  {
    id: 'report',
    icon: 'pulse',
    name: 'multi-page report',
    document: { page: 'a4' },
    brief: `A REPORT: a structured multi-page document that presents findings and supports a decision — an annual report, a study, an activity or project report.
- A COVER page: the title, a subtitle, the organisation as a wordmark, the period or date, the author or department, and a strong visual block (a colour field, a picture when one is supplied, or a composition of shapes).
- A CONTENTS block listing the numbered sections with their page numbers, then an EXECUTIVE SUMMARY: three to five key findings, each a large figure and one sentence.
- Body pages with numbered section headings, well-set paragraphs of real prose at a comfortable measure (two columns on a wide page), pulled-out key figures, at least one chart with a title, labelled axes and a source line, and one table with a header row.
- A running header or footer on every body page: the report's short title and the page number.
- A conclusions or recommendations page as a numbered list, and an optional appendix or methodology note.
- Figures consistent from one page to the next — the summary quotes what the charts show — and realistic for the subject; never placeholders.
- Usually four to eight pages, each composed on its own and never overfilled.`,
  },
  {
    id: 'documentation',
    icon: 'code',
    name: 'user guide / documentation',
    document: { page: 'a4' },
    brief: `DOCUMENTATION: a user guide, a technical manual or a procedure that someone follows step by step.
- A title page: the product or process, the kind of document (guide, manual, procedure), a version number and a date.
- A table of contents with numbered sections and page numbers.
- Numbered sections and sub-sections (1, 1.1, 1.2…) with short, direct paragraphs; every procedure as NUMBERED STEPS, one action per step, each followed by the expected result.
- Callout boxes for a note, a tip and a warning, told apart by a label and an icon.
- Command or code samples in monospaced blocks with a caption when the subject is technical; otherwise a labelled diagram or a captioned screenshot frame.
- A reference table (parameters, options, shortcuts or specifications) with a header row.
- A running header with the document's title and a footer with the version and the page number on every page after the first.
- Accurate, specific content for the subject requested; no lorem ipsum.`,
  },
  {
    id: 'resume',
    icon: 'user',
    name: 'résumé / CV',
    document: { page: 'a4' },
    brief: `A RÉSUMÉ (CV): one page, two at most, that gets someone an interview in a thirty-second read.
- A header with the person's name set large, the job title sought, and the contact details on one line (email, phone, city, a portfolio or profile link); a round photo placeholder only if the request mentions a photo.
- A short profile: two or three sentences on who they are and what they bring.
- EXPERIENCE in reverse chronological order: role, employer, place and dates, then three concise achievements each, with figures where it makes sense.
- Education, then skills grouped by kind (as tags, or with a discreet level), languages with their level, and optionally certifications or interests.
- A clear two-column layout: a narrow side column for contact, skills and languages, a wide main column for the profile and the experience.
- Sober and highly legible: one accent colour for headings and markers, generous spacing, strict alignment, and no decorative shape competing with the text.
- Realistic, consistent content for the profile described; never placeholders.`,
  },
  {
    id: 'invoice',
    icon: 'list',
    name: 'invoice or quote',
    document: { page: 'a4' },
    brief: `An INVOICE or a QUOTE — whichever the request asks for, an invoice when it does not say: the business document a client pays or signs.
- A header: the issuer as a wordmark with its address and its registration and VAT numbers; the kind of document set large, with its number, its issue date and its due date or validity.
- The client block: name, company and billing address.
- The line-item table: description, quantity, unit price, VAT rate and line total, with a header row, figures aligned on the right, and four to eight realistic lines.
- A totals block on the right: subtotal, VAT per rate, and the total due set largest.
- Payment terms: due date, bank details (IBAN, BIC), late-payment conditions. On a quote, a validity date and an acceptance block (the words for "good for agreement", a date and a signature) made of <Field>s.
- A footer with the legal mentions and the page number.
- Every figure computed exactly: the line totals, the VAT and the grand total add up.`,
  },
  {
    id: 'certificate',
    icon: 'star',
    name: 'certificate or diploma',
    document: { page: 'a4-landscape' },
    brief: `A CERTIFICATE or a DIPLOMA: one formal page that is framed, printed or sent as a PDF. ONE <Page>.
- A decorative border around the page, drawn with nested rules, corner ornaments or a guilloche-like pattern of CSS shapes, marked aria-hidden.
- The issuing organisation as a wordmark or a seal at the top; the title (certificate of completion, diploma, award…) set large and centred.
- A presentation line ("is awarded to", "certifies that"), the RECIPIENT'S NAME as the most prominent text, and one or two lines saying what for, with the date and the place.
- One or two signature blocks at the foot — a line, the signatory's name and title — and a round seal or medal built from CSS shapes.
- A certificate number and, if it helps, a verification URL in small print.
- Centred, symmetric and ceremonial: a classical feel through proportions and ornaments.
- When the request asks for a blank template, the recipient's name and the date are <Field>s.`,
  },
  {
    id: 'menu',
    icon: 'note',
    name: 'restaurant menu',
    document: { page: 'a4' },
    brief: `A RESTAURANT MENU: the printed card a guest reads at the table.
- The restaurant's name as a wordmark, a short tagline, and the service (lunch, dinner, brunch) or the season when it matters.
- Sections in the order of a meal — starters, mains, desserts, drinks — each with a clear heading and a decorative divider.
- Each dish: its name, one line on what is on the plate, and its price aligned on the right with dotted leaders or a clean column; dietary markers (vegetarian, vegan, gluten-free, spicy) as small icons explained in a legend.
- One highlight: a set menu or the chef's special in a framed box with its price.
- A footer with the allergen information, the address, the opening hours and a phone number or website.
- Prices consistent with the kind of restaurant; real dish names and descriptions for the cuisine requested, never placeholders.`,
  },
  {
    id: 'instagram',
    icon: 'image',
    name: 'Instagram post',
    document: { page: 'social-portrait' },
    brief: `An INSTAGRAM POST: an image made to stop the thumb in a feed. ONE <Page>, or a CAROUSEL of several when the request asks for one or has more to say than one image holds — then the first page is the hook, each middle page carries one idea, and the last one a call to action.
- ONE big idea per image: a hook headline of a few words set very large, and at most one short supporting line.
- A picture when pictures are supplied, cropped boldly and full bleed, with the text on a solid band or a shape for contrast; without one, a bold composition of colour blocks and shapes.
- The brand's name or handle as a small wordmark in a corner, the same on every page, and a page counter ("1/5") on a carousel.
- A call to action as words ("link in bio", "save this post", "swipe") — never a web button.
- Bright, contrasted and graphic: nothing thin or pale that vanishes on a small screen; no fillable fields.
- Real copy for the subject requested, never placeholders.`,
  },
  {
    id: 'facebook',
    icon: 'comment',
    name: 'Facebook post',
    document: { page: 'social-landscape' },
    brief: `A FACEBOOK POST image: the visual of an announcement, an event or an offer, shown in a feed beside the post's own text. ONE <Page>, or several when the request asks for a carousel.
- A headline of a few words set large, and the one fact that matters (a date, a price, an offer, a place) in a block of its own.
- A picture when pictures are supplied, with the text on a solid area for contrast; otherwise a composition of colour blocks and shapes.
- The organisation's name or a logo slot as a wordmark, and a call to action as words ("book now", "learn more", a date or a place) — never a web button.
- Warm, legible and simple, with little text: the post's own text carries the detail. No fillable fields.
- Real copy for the subject requested, never placeholders.`,
  },
  {
    id: 'linkedin',
    icon: 'link',
    name: 'LinkedIn post',
    document: { page: 'social-square' },
    brief: `A LINKEDIN POST visual, professional in tone: an insight, a result, an announcement or a hiring post. ONE <Page>, or a CAROUSEL of several — LinkedIn's document post, exported as a PDF — when the request asks for one or teaches something in steps: then the first page is a strong promise, each middle page one numbered point, and the last one a summary and a call to action.
- A clear headline stating the insight or the news; one key figure set very large when there is one, with what it measures.
- A clean, structured layout on a grid: a title, a short supporting line, and at most three points per page.
- The author's or the company's name as a wordmark with a round photo or logo placeholder in a corner, the same on every page, and a page counter on a carousel.
- A call to action as words ("follow for more", "tell me in the comments", a URL) — never a web button.
- Credible and uncluttered: data drawn as a simple chart or a large number rather than a paragraph. No fillable fields.
- Real, specific content for the subject requested, never placeholders.`,
  },
]

export function getScreenTheme(id: string | null | undefined): ScreenTheme | undefined {
  return id ? SCREEN_THEMES.find((th) => th.id === id) : undefined
}

/** The theme's section of the system preamble, or nothing. */
export function screenThemeSection(id: string | null | undefined): string | undefined {
  const theme = getScreenTheme(id)
  if (!theme) return undefined
  // A document is not "a screen", and the word matters: a model told to build a
  // SCREEN reaches for navigation and hover states however many rules further
  // down say otherwise.
  return theme.document
    ? `DOCUMENT TYPE — build this document as the following kind of printed piece, adapting everything to the user's request (their words win on any conflict):\n${theme.brief}`
    : `SCREEN TYPE — build this screen as the following kind of screen, adapting everything to the user's request (their words win on any conflict):\n${theme.brief}`
}

/**
 * The page format a DOCUMENT type starts on — undefined for every other type,
 * and for none. See `ScreenTheme.document`.
 */
export function themeDocumentPage(id: string | null | undefined): PageFormatId | undefined {
  return getScreenTheme(id)?.document?.page
}

/**
 * The form-factor hint with the theme's brief appended — the ONE string that
 * travels wherever `preset.hint` used to go.
 *
 * Appended rather than threaded as a separate argument because the preset hint
 * already reaches every stage that must see it: the system preamble (and so
 * Muse's path), the planner and the Motion Ultra storyboard. One value that goes
 * everywhere is a value no new stage can forget. With no theme it returns the
 * hint UNCHANGED, byte for byte — a project that never touches the picker must
 * generate exactly what it generated before the picker existed (M1's spirit).
 */
export function withScreenTheme(hint: string, id: string | null | undefined): string {
  const section = screenThemeSection(id)
  if (!section) return hint
  return hint ? `${hint}\n\n${section}` : section
}

/**
 * A single line naming the type, for the Muse dossier's brief.
 *
 * The dossier writes an art direction and an imagery plan, and the one thing
 * it needs from the theme is to know what it is dressing: a dashboard wants no
 * hero photograph, a landing page does. The full structural brief would only
 * invite it to write a layout — which is the page's job, not the dossier's.
 */
export function screenThemeBriefLine(id: string | null | undefined): string | undefined {
  const theme = getScreenTheme(id)
  return theme ? `Screen type: ${theme.name}.` : undefined
}

/**
 * What the prompt field holds after the type changes from one whose starter is
 * `prevStarter` to one whose starter is `nextStarter` (undefined: no type).
 *
 * The field is the person's as soon as they typed in it, and never replaced
 * then. But a starter the PICKER wrote is not their words: browsing the menu —
 * Dashboard, then Planning — used to leave the dashboard starter under a
 * Planning chip, and since the type's brief tells the model the user's words
 * win, a dashboard came out labelled Planning. So a field that is empty, or
 * still exactly the previous type's starter, follows the type — including back
 * to empty when the type is cleared.
 */
export function promptForThemeChange(
  prompt: string,
  prevStarter: string | undefined,
  nextStarter: string | undefined,
): string {
  const untouched = !prompt.trim() || (!!prevStarter && prompt.trim() === prevStarter.trim())
  return untouched ? (nextStarter ?? '') : prompt
}

export function isScreenThemeId(id: unknown): id is ScreenThemeId {
  return typeof id === 'string' && (SCREEN_THEME_IDS as readonly string[]).includes(id)
}

/**
 * The type — and, for a document, the page format — the composer starts on in
 * a project: whatever its most recently made screen was made with, "no type"
 * included.
 *
 * The composer used to forget the type after every generation, on the theory
 * that two screens in a row are rarely the same kind. In a project of flyers
 * they always are: "fais-moi le recto" was generated as a WEBSITE because the
 * menu had gone back to nothing, and every document meant opening it again.
 * Read off the screens rather than stored beside them, so it needs no new
 * field, survives sync and a reload, and follows what was really generated
 * rather than what was picked and abandoned.
 */
export function projectScreenType(
  screens: readonly { createdAt: number; theme?: string; page?: PageFormatId }[],
): { theme: ScreenThemeId | null; page: PageFormatId | null } {
  let latest: (typeof screens)[number] | undefined
  for (const s of screens) if (!latest || s.createdAt > latest.createdAt) latest = s
  const theme = isScreenThemeId(latest?.theme) ? latest.theme : null
  return { theme, page: theme && latest?.page ? latest.page : null }
}
