/**
 * What the documentation's screenshots show: an account's projects, written
 * by hand so the pictures never depend on a model.
 *
 * One function per language, because a French page photographed with English
 * mockups on it reads as a page from another product. The screens are ordinary
 * Mocky screens — Tailwind 3 classes, the document kit for documents — so the
 * previews render them exactly as they render a generated one.
 */

const T = {
  fr: {
    cafe: 'Café Atelier',
    cafeDeck: 'Le site d’un café de quartier : accueil, carte, réservation, et un flyer pour l’ouverture.',
    home: 'Accueil',
    menu: 'La carte',
    booking: 'Réservation',
    flyer: 'Flyer d’ouverture',
    post: 'Post Instagram',
    nav: ['Le lieu', 'La carte', 'Réserver'],
    book: 'Réserver une table',
    kicker: 'Le goût des choses simples',
    h1a: 'Le café qui prend',
    h1b: 'son temps.',
    lead: 'Un café de quartier, des produits choisis avec soin et un lieu pour ralentir un peu.',
    seeMenu: 'Voir la carte',
    findUs: 'Nous trouver',
    menuTitle: 'La carte du moment',
    dishes: [
      ['Espresso de la maison', 'Torréfaction locale, notes de cacao', '2,40 €'],
      ['Flat white', 'Lait entier ou avoine', '4,20 €'],
      ['Tartine du jour', 'Pain au levain, légumes de saison', '8,50 €'],
      ['Granola maison', 'Yaourt grec, fruits rouges', '6,00 €'],
      ['Cookie noisette', 'Cuit le matin', '3,20 €'],
      ['Citronnade', 'Citron, gingembre, menthe', '4,50 €'],
    ],
    bookTitle: 'Réserver',
    people: 'Personnes',
    date: 'Date',
    time: 'Heure',
    name: 'Votre nom',
    confirm: 'Confirmer la réservation',
    flyerKicker: 'Ouverture',
    flyerTitle: 'Samedi, on ouvre.',
    flyerBody: 'Café offert aux cinquante premiers, musique live à partir de 18 h.',
    flyerWhen: 'Samedi 14 juin · 9 h – 22 h',
    flyerWhere: '12 rue des Tanneurs, Lyon',
    postA: 'Nouveau à la carte',
    postB: 'Le flat white avoine',
    postC: 'Disponible dès samedi',
    postD: 'Venez goûter',
    others: [
      ['Tableau de bord ventes', 'Un tableau de bord SaaS avec revenus, abonnés et graphiques.'],
      ['Portfolio photo', 'Un portfolio sombre pour une photographe de mariage.'],
      ['Rapport annuel', 'Le rapport annuel d’une association, en A4.'],
    ],
    revenue: 'Revenus',
    subscribers: 'Abonnés',
    churn: 'Désabonnement',
    portfolio: 'Des images qui restent.',
    report: 'Rapport annuel 2026',
  },
  en: {
    cafe: 'Café Atelier',
    cafeDeck: 'A neighbourhood café’s site: home, menu, booking, and a flyer for the opening.',
    home: 'Home',
    menu: 'Menu',
    booking: 'Booking',
    flyer: 'Opening flyer',
    post: 'Instagram post',
    nav: ['The place', 'Menu', 'Book'],
    book: 'Book a table',
    kicker: 'The taste of simple things',
    h1a: 'The café that takes',
    h1b: 'its time.',
    lead: 'A neighbourhood café, carefully chosen produce and a place to slow down a little.',
    seeMenu: 'See the menu',
    findUs: 'Find us',
    menuTitle: 'Today’s menu',
    dishes: [
      ['House espresso', 'Locally roasted, cocoa notes', '£2.40'],
      ['Flat white', 'Whole or oat milk', '£4.20'],
      ['Toast of the day', 'Sourdough, seasonal vegetables', '£8.50'],
      ['House granola', 'Greek yoghurt, red berries', '£6.00'],
      ['Hazelnut cookie', 'Baked this morning', '£3.20'],
      ['Lemonade', 'Lemon, ginger, mint', '£4.50'],
    ],
    bookTitle: 'Book',
    people: 'Guests',
    date: 'Date',
    time: 'Time',
    name: 'Your name',
    confirm: 'Confirm the booking',
    flyerKicker: 'Opening',
    flyerTitle: 'Saturday, we open.',
    flyerBody: 'Free coffee for the first fifty, live music from 6 pm.',
    flyerWhen: 'Saturday 14 June · 9 am – 10 pm',
    flyerWhere: '12 Tanners Street, Bristol',
    postA: 'New on the menu',
    postB: 'The oat flat white',
    postC: 'From Saturday',
    postD: 'Come and taste it',
    others: [
      ['Sales dashboard', 'A SaaS dashboard with revenue, subscribers and charts.'],
      ['Photo portfolio', 'A dark portfolio for a wedding photographer.'],
      ['Annual report', 'A charity’s annual report, in A4.'],
    ],
    revenue: 'Revenue',
    subscribers: 'Subscribers',
    churn: 'Churn',
    portfolio: 'Pictures that stay.',
    report: 'Annual report 2026',
  },
}

const INK = '#2b2a26'
const PAPER = '#f4efe6'
const MUTED = '#6b665c'
const OLIVE = '#6d7357'

const home = (t) => `export default function App() {
  return (
    <div className="min-h-screen bg-[${PAPER}] text-[${INK}]">
      <nav className="flex items-center justify-between px-16 py-7">
        <div className="font-serif text-2xl font-bold tracking-tight">café / atelier</div>
        <div className="flex gap-10 text-xs uppercase tracking-[0.2em] text-[${MUTED}]">
          ${t.nav.map((n) => `<a href="#">${n}</a>`).join('\n          ')}
        </div>
        <button className="rounded-full bg-[${INK}] px-6 py-2.5 text-sm text-[${PAPER}]">${t.book}</button>
      </nav>
      <section className="grid grid-cols-2 items-center gap-16 px-16 pt-14">
        <div>
          <p className="mb-6 text-xs uppercase tracking-[0.25em] text-[#8a8170]">${t.kicker}</p>
          <h1 className="font-serif text-7xl leading-[0.95] tracking-tight">${t.h1a} <em className="text-[${OLIVE}]">${t.h1b}</em></h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-[${MUTED}]">${t.lead}</p>
          <div className="mt-10 flex gap-4">
            <button className="rounded-full bg-[${INK}] px-7 py-3 text-[${PAPER}]">${t.seeMenu}</button>
            <button className="rounded-full border border-[${INK}] px-7 py-3">${t.findUs}</button>
          </div>
        </div>
        <div className="relative h-[500px] overflow-hidden rounded-[36px] bg-[#d6cbb6]">
          <div className="absolute left-1/2 top-14 h-72 w-72 -translate-x-1/2 rounded-full bg-[#b8b99e]" />
          <div className="absolute -bottom-10 left-0 right-0 h-48 -rotate-6 bg-[#c6bda9]" />
          <div className="absolute bottom-28 left-1/2 h-40 w-60 -translate-x-1/2 rounded-b-[90px] rounded-t-2xl bg-[#faf5ec] shadow-2xl" />
          <div className="absolute bottom-[17rem] left-1/2 h-8 w-52 -translate-x-1/2 rounded-[50%] border-4 border-[#f0e7d6] bg-[#3f3026]" />
        </div>
      </section>
    </div>
  )
}`

const menu = (t) => `export default function App() {
  const dishes = ${JSON.stringify(t.dishes)}
  return (
    <div className="min-h-screen bg-[${PAPER}] px-16 py-14 text-[${INK}]">
      <p className="text-xs uppercase tracking-[0.25em] text-[#8a8170]">café / atelier</p>
      <h1 className="mt-3 font-serif text-6xl tracking-tight">${t.menuTitle}</h1>
      <div className="mt-12 grid grid-cols-3 gap-6">
        {dishes.map(([name, desc, price]) => (
          <div key={name} className="rounded-3xl bg-white/70 p-7 shadow-sm">
            <div className="mb-5 h-32 rounded-2xl bg-[#e3d9c6]" />
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-serif text-2xl">{name}</h2>
              <span className="text-[${OLIVE}]">{price}</span>
            </div>
            <p className="mt-2 text-[${MUTED}]">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}`

const booking = (t) => `export default function App() {
  return (
    <div className="min-h-screen bg-[${PAPER}] px-6 pb-10 pt-16 text-[${INK}]">
      <p className="text-xs uppercase tracking-[0.25em] text-[#8a8170]">café / atelier</p>
      <h1 className="mt-2 font-serif text-5xl">${t.bookTitle}</h1>
      <div className="mt-8 space-y-4">
        ${[[t.people, '2'], [t.date, '14/06'], [t.time, '19:30'], [t.name, '']]
          .map(([l, v]) => `<label className="block"><span className="text-sm text-[${MUTED}]">${l}</span><div className="mt-1 rounded-2xl border border-[#d8cfbe] bg-white px-4 py-3.5">${v || '&nbsp;'}</div></label>`)
          .join('\n        ')}
      </div>
      <button className="mt-8 w-full rounded-full bg-[${INK}] py-4 text-[${PAPER}]">${t.confirm}</button>
    </div>
  )
}`

const flyer = (t) => `export default function App() {
  return (
    <Doc format="a5">
      <Page className="flex flex-col bg-[${INK}] p-12 text-[${PAPER}]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#c9bfa8]">${t.flyerKicker} · café / atelier</p>
        <h1 className="mt-8 font-serif text-6xl leading-[0.95]">${t.flyerTitle}</h1>
        <div className="mt-10 h-48 rounded-[28px] bg-[#6d7357]" />
        <p className="mt-10 text-lg leading-relaxed text-[#e6dccb]">${t.flyerBody}</p>
        <div className="mt-auto border-t border-[#5a564d] pt-6 text-sm">
          <p>${t.flyerWhen}</p>
          <p className="mt-1 text-[#c9bfa8]">${t.flyerWhere}</p>
        </div>
      </Page>
    </Doc>
  )
}`

const post = (t) => `export default function App() {
  return (
    <Doc format="social-square">
      <Page className="flex flex-col justify-between bg-[#e9dfcc] p-20 text-[${INK}]">
        <p className="text-2xl uppercase tracking-[0.3em] text-[${OLIVE}]">${t.postA}</p>
        <h1 className="font-serif text-[9rem] leading-[0.9]">${t.postB}</h1>
        <p className="text-3xl">café / atelier</p>
      </Page>
      <Page className="flex flex-col justify-end bg-[${INK}] p-20 text-[${PAPER}]">
        <p className="text-3xl text-[#c9bfa8]">${t.postC}</p>
        <h1 className="mt-6 font-serif text-[8rem] leading-[0.9]">${t.postD}</h1>
      </Page>
    </Doc>
  )
}`

const dashboard = (t) => `export default function App() {
  const bars = [40, 55, 48, 70, 62, 84, 78, 92]
  return (
    <div className="min-h-screen bg-slate-50 p-10 text-slate-900">
      <div className="grid grid-cols-3 gap-6">
        ${[[t.revenue, '€48.2k'], [t.subscribers, '1 284'], [t.churn, '2.1 %']]
          .map(([l, v]) => `<div className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">${l}</p><p className="mt-2 text-4xl font-semibold">${v}</p></div>`)
          .join('\n        ')}
      </div>
      <div className="mt-6 flex h-72 items-end gap-4 rounded-2xl bg-white p-8 shadow-sm">
        {bars.map((h, i) => <div key={i} className="flex-1 rounded-t-lg bg-indigo-500" style={{ height: h + '%' }} />)}
      </div>
    </div>
  )
}`

const portfolio = (t) => `export default function App() {
  return (
    <div className="min-h-screen bg-neutral-950 p-12 text-neutral-100">
      <h1 className="font-serif text-6xl">${t.portfolio}</h1>
      <div className="mt-10 grid grid-cols-3 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className={'h-56 rounded-xl ' + ['bg-stone-700', 'bg-amber-900', 'bg-neutral-700'][i % 3]} />)}
      </div>
    </div>
  )
}`

const report = (t) => `export default function App() {
  return (
    <Doc format="a4">
      <Page className="flex flex-col bg-white p-16 text-slate-900">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-700">2026</p>
        <h1 className="mt-6 text-6xl font-bold leading-tight">${t.report}</h1>
        <div className="mt-12 h-72 rounded-3xl bg-emerald-100" />
      </Page>
    </Doc>
  )
}`

const screen = (id, name, prompt, code, box, extra = {}) => ({
  id,
  name,
  prompt,
  code,
  componentName: 'App',
  createdAt: extra.createdAt ?? Date.now(),
  device: 'none',
  links: [],
  ...box,
  ...extra,
})

/** The account's projects, newest first, and the DESIGN.md every screen reads. */
export function fixtures(lang) {
  const t = T[lang]
  const now = Date.now()
  const min = 60_000
  const cafe = {
    id: 'docs-cafe',
    name: t.cafe,
    createdAt: now - 90 * min,
    updatedAt: now - 2 * min,
    screens: [
      screen('cafe-home', t.home, t.cafeDeck, home(t), { x: 0, y: 0, w: 1440, h: 900 }, {
        createdAt: now - 80 * min,
        // A cable to the menu, from the "See the menu" button's place.
        links: [{ id: 'l1', x: 0.06, y: 0.62, w: 0.13, h: 0.06, target: 'cafe-menu' }],
      }),
      screen('cafe-menu', t.menu, t.menuTitle, menu(t), { x: 1600, y: 0, w: 1440, h: 900 }, {
        createdAt: now - 60 * min,
        links: [{ id: 'l2', x: 0.05, y: 0.4, w: 0.25, h: 0.35, target: 'cafe-booking' }],
      }),
      screen('cafe-booking', t.booking, t.bookTitle, booking(t), { x: 3200, y: 0, w: 390, h: 844 }, {
        createdAt: now - 40 * min,
        device: 'iphone',
      }),
      screen('cafe-flyer', t.flyer, t.flyerTitle, flyer(t), { x: 3750, y: 0, w: 559, h: 794 }, {
        createdAt: now - 20 * min,
        page: 'a5',
        caps: ['document'],
      }),
      screen('cafe-post', t.post, t.postB, post(t), { x: 4470, y: 0, w: 1080, h: 1080 }, {
        createdAt: now - 5 * min,
        page: 'social-square',
        caps: ['document'],
      }),
    ],
  }
  const others = t.others.map(([name, deck], i) => ({
    id: `docs-other-${i}`,
    name,
    createdAt: now - (3 + i) * 24 * 60 * min,
    updatedAt: now - (3 + i) * 60 * min,
    screens: [
      screen(
        `docs-other-${i}-s`,
        name,
        deck,
        [dashboard, portfolio, report][i](t),
        i === 2 ? { x: 0, y: 0, w: 794, h: 1123 } : { x: 0, y: 0, w: 1440, h: 900 },
        i === 2 ? { page: 'a4', caps: ['document'] } : {},
      ),
    ],
  }))
  const design = `# Café Atelier — DESIGN.md

## Colours
- Background: ${PAPER}
- Text: ${INK}
- Muted: ${MUTED}
- Accent: ${OLIVE}
- Surface: #e9dfcc

## Typography
- Display: a serif, tight, large
- Body: a sans, 16px, relaxed
`
  return { projects: [cafe, ...others], design, ids: { cafe: cafe.id, flyer: 'cafe-flyer', post: 'cafe-post', home: 'cafe-home' } }
}
