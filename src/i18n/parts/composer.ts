/**
 * The composer's own additions: the screen-type picker and "improve my prompt".
 *
 * An area of its own rather than more lines in `project.ts`, because the screen
 * types are a catalogue (`lib/screenThemes.ts`) and their words — a label, a
 * one-line description, a starter prompt, per type — are easier to keep in
 * step with it in one place. `lib/screenThemes.test.ts` checks that every type
 * has all three, in both languages.
 *
 * The older `composer.*` keys (placeholder, generate, stop…) predate the area
 * files and still live in the core dictionaries; the parity test forbids a key
 * being declared in both, not the shared prefix.
 */
export const composer = {
  fr: {
    // ---- screen type ----
    'composer.themeLabel': 'Type d’écran',
    'composer.themeActiveAria': 'Type d’écran : {name}',
    'composer.themeTitle': 'Choisir un type d’écran — sa structure type guide la génération',
    'composer.themeMenu': 'Types d’écran',
    'composer.themeGroupDocuments': 'Documents à imprimer ou exporter',
    'composer.themeGroupScreens': 'Écrans',
    'composer.themeHint':
      'Le type donne au modèle les sections, composants et données attendus pour ce genre d’écran. Vos mots restent prioritaires, et le style reste celui de votre direction.',
    'composer.themeClear': 'Retirer le type d’écran',
    'composer.themeIgnored':
      'Ignoré en mode Reproduire : les captures du site sont le brief. Passez en Refonte pour que le type s’applique.',

    'composer.themes.dashboard': 'Tableau de bord',
    'composer.themes.dashboard.desc': 'Indicateurs clés, graphiques et activité récente',
    'composer.themes.dashboard.starter':
      'Un tableau de bord analytique pour suivre les ventes d’une boutique en ligne',
    'composer.themes.planning': 'Planning',
    'composer.themes.planning.desc': 'Calendrier à la semaine, événements et filtres',
    'composer.themes.planning.starter': 'Un planning hebdomadaire pour une équipe de six personnes',
    'composer.themes.kanban': 'Kanban',
    'composer.themes.kanban.desc': 'Colonnes de tâches, cartes, étiquettes et échéances',
    'composer.themes.kanban.starter': 'Un tableau kanban pour suivre le lancement d’une application mobile',
    'composer.themes.table': 'Tableau de données',
    'composer.themes.table.desc': 'Liste filtrable façon CRM, tri, sélection, pagination',
    'composer.themes.table.starter': 'Une liste de clients façon CRM avec filtres et actions groupées',
    'composer.themes.landing': 'Page d’accueil',
    'composer.themes.landing.desc': 'Accroche, bénéfices, preuves et appel à l’action',
    'composer.themes.landing.starter': 'Une page d’accueil pour une application de prise de notes collaborative',
    'composer.themes.pricing': 'Tarifs',
    'composer.themes.pricing.desc': 'Trois formules, bascule mensuel/annuel, comparatif, FAQ',
    'composer.themes.pricing.starter': 'Une page de tarifs pour un logiciel de facturation',
    'composer.themes.product': 'Fiche produit',
    'composer.themes.product.desc': 'Galerie, variantes, prix, avis et produits associés',
    'composer.themes.product.starter': 'La fiche produit d’une paire de chaussures de course',
    'composer.themes.checkout': 'Paiement',
    'composer.themes.checkout.desc': 'Étapes, livraison, paiement et récapitulatif de commande',
    'composer.themes.checkout.starter': 'Le paiement d’une commande sur une boutique de thé en ligne',
    'composer.themes.auth': 'Connexion',
    'composer.themes.auth.desc': 'Connexion et inscription, fournisseurs tiers, validation',
    'composer.themes.auth.starter': 'L’écran de connexion et d’inscription d’un outil de gestion de projet',
    'composer.themes.onboarding': 'Onboarding',
    'composer.themes.onboarding.desc': 'Premières étapes guidées, choix en cartes, progression',
    'composer.themes.onboarding.starter': 'L’onboarding d’une application de fitness',
    'composer.themes.settings': 'Paramètres',
    'composer.themes.settings.desc': 'Profil, notifications, sécurité et zone de danger',
    'composer.themes.settings.starter': 'Les paramètres du compte d’une application de messagerie d’équipe',
    'composer.themes.messaging': 'Messagerie',
    'composer.themes.messaging.desc': 'Conversations, fil de discussion et zone de saisie',
    'composer.themes.messaging.starter': 'Une messagerie entre un client et le support d’une banque en ligne',
    'composer.themes.booking': 'Réservation',
    'composer.themes.booking.desc': 'Date, créneaux, options et récapitulatif en direct',
    'composer.themes.booking.starter': 'La réservation d’une table dans un restaurant',
    'composer.themes.article': 'Article de blog',
    'composer.themes.article.desc': 'Lecture confortable, auteur, sommaire et articles liés',
    'composer.themes.article.starter': 'Un article de blog sur le télétravail dans les petites équipes',
    'composer.themes.portfolio': 'Portfolio',
    'composer.themes.portfolio.desc': 'Projets en grille, filtres, à propos et contact',
    'composer.themes.portfolio.starter': 'Le portfolio d’une photographe d’architecture',
    'composer.themes.flyer': 'Flyer',
    'composer.themes.flyer.desc': 'Document imprimable : grand titre, infos clés, formes colorées, PDF',
    'composer.themes.flyer.starter':
      'Le flyer d’un festival de musique en plein air, un samedi de juin, entrée 12 €',

    // ---- page formats (document types) ----
    'composer.pageFormatsAria': 'Format de page',
    'composer.pageFormat.a4': 'A4',
    'composer.pageFormat.a4.full': 'A4 portrait (210 × 297 mm)',
    'composer.pageFormat.a4-landscape': 'A4 paysage',
    'composer.pageFormat.a4-landscape.full': 'A4 paysage (297 × 210 mm)',
    'composer.pageFormat.letter': 'US Letter',
    'composer.pageFormat.letter.full': 'US Letter portrait (8,5 × 11 in)',
    'composer.pageFormat.letter-landscape': 'US paysage',
    'composer.pageFormat.letter-landscape.full': 'US Letter paysage (11 × 8,5 in)',
    'composer.pageFormat.slides': 'Présentation 16:9',
    'composer.pageFormat.slides.full': 'Diapositive de présentation 16:9',

    // ---- improve my prompt ----
    'composer.enhance': 'Améliorer',
    'composer.enhanceTitle':
      'Améliorer le prompt — le modèle le réécrit en un brief complet : sections, contenu réaliste, états et interactions',
    'composer.enhanceStop': 'Arrêter',
    'composer.enhanceStopTitle': 'Arrêter l’amélioration et garder votre texte',
    'composer.enhanceUndo': 'Revenir à votre texte',
    'composer.enhanceFailed': 'Le prompt n’a pas pu être amélioré ({detail}). Votre texte est intact.',
    'composer.enhanceEmpty': 'le modèle a renvoyé une réponse vide',
    'composer.enhanceCaptures':
      'Indisponible avec des captures de site : ce sont elles qui décrivent l’écran, un brief inventé les contredirait',
  },
  en: {
    // ---- screen type ----
    'composer.themeLabel': 'Screen type',
    'composer.themeActiveAria': 'Screen type: {name}',
    'composer.themeTitle': 'Pick a screen type — its typical structure guides the generation',
    'composer.themeMenu': 'Screen types',
    'composer.themeGroupDocuments': 'Documents to print or export',
    'composer.themeGroupScreens': 'Screens',
    'composer.themeHint':
      'The type gives the model the sections, components and data expected for that kind of screen. Your words still come first, and the style stays your direction’s.',
    'composer.themeClear': 'Remove the screen type',
    'composer.themeIgnored':
      'Ignored in Reproduce mode: the site captures are the brief. Switch to Redesign for the type to apply.',

    'composer.themes.dashboard': 'Dashboard',
    'composer.themes.dashboard.desc': 'KPIs, charts and recent activity',
    'composer.themes.dashboard.starter': 'An analytics dashboard to track an online shop’s sales',
    'composer.themes.planning': 'Planning',
    'composer.themes.planning.desc': 'Week calendar, events and filters',
    'composer.themes.planning.starter': 'A weekly schedule for a team of six',
    'composer.themes.kanban': 'Kanban',
    'composer.themes.kanban.desc': 'Task columns, cards, labels and due dates',
    'composer.themes.kanban.starter': 'A kanban board to track the launch of a mobile app',
    'composer.themes.table': 'Data table',
    'composer.themes.table.desc': 'CRM-style filterable list, sorting, selection, pagination',
    'composer.themes.table.starter': 'A CRM-style customer list with filters and bulk actions',
    'composer.themes.landing': 'Landing page',
    'composer.themes.landing.desc': 'Hook, benefits, proof and a call to action',
    'composer.themes.landing.starter': 'A landing page for a collaborative note-taking app',
    'composer.themes.pricing': 'Pricing',
    'composer.themes.pricing.desc': 'Three plans, monthly/yearly toggle, comparison, FAQ',
    'composer.themes.pricing.starter': 'A pricing page for invoicing software',
    'composer.themes.product': 'Product page',
    'composer.themes.product.desc': 'Gallery, variants, price, reviews and related products',
    'composer.themes.product.starter': 'The product page for a pair of running shoes',
    'composer.themes.checkout': 'Checkout',
    'composer.themes.checkout.desc': 'Steps, delivery, payment and order summary',
    'composer.themes.checkout.starter': 'The checkout of an online tea shop',
    'composer.themes.auth': 'Sign in',
    'composer.themes.auth.desc': 'Sign in and sign up, third-party providers, validation',
    'composer.themes.auth.starter': 'The sign-in and sign-up screen of a project management tool',
    'composer.themes.onboarding': 'Onboarding',
    'composer.themes.onboarding.desc': 'Guided first steps, choice cards, progress',
    'composer.themes.onboarding.starter': 'The onboarding of a fitness app',
    'composer.themes.settings': 'Settings',
    'composer.themes.settings.desc': 'Profile, notifications, security and danger zone',
    'composer.themes.settings.starter': 'The account settings of a team messaging app',
    'composer.themes.messaging': 'Messaging',
    'composer.themes.messaging.desc': 'Conversations, thread and composer',
    'composer.themes.messaging.starter': 'A chat between a customer and an online bank’s support',
    'composer.themes.booking': 'Booking',
    'composer.themes.booking.desc': 'Date, time slots, options and a live summary',
    'composer.themes.booking.starter': 'Booking a table at a restaurant',
    'composer.themes.article': 'Blog article',
    'composer.themes.article.desc': 'Comfortable reading, author, contents and related posts',
    'composer.themes.article.starter': 'A blog article about remote work in small teams',
    'composer.themes.portfolio': 'Portfolio',
    'composer.themes.portfolio.desc': 'Project grid, filters, about and contact',
    'composer.themes.portfolio.starter': 'The portfolio of an architecture photographer',
    'composer.themes.flyer': 'Flyer',
    'composer.themes.flyer.desc': 'Printable document: big headline, key facts, colourful shapes, PDF',
    'composer.themes.flyer.starter': 'The flyer for an open-air music festival, one Saturday in June, entry €12',

    // ---- page formats (document types) ----
    'composer.pageFormatsAria': 'Page format',
    'composer.pageFormat.a4': 'A4',
    'composer.pageFormat.a4.full': 'A4 portrait (210 × 297 mm)',
    'composer.pageFormat.a4-landscape': 'A4 landscape',
    'composer.pageFormat.a4-landscape.full': 'A4 landscape (297 × 210 mm)',
    'composer.pageFormat.letter': 'US Letter',
    'composer.pageFormat.letter.full': 'US Letter portrait (8.5 × 11 in)',
    'composer.pageFormat.letter-landscape': 'US landscape',
    'composer.pageFormat.letter-landscape.full': 'US Letter landscape (11 × 8.5 in)',
    'composer.pageFormat.slides': 'Presentation 16:9',
    'composer.pageFormat.slides.full': 'Presentation slide, 16:9',

    // ---- improve my prompt ----
    'composer.enhance': 'Improve',
    'composer.enhanceTitle':
      'Improve the prompt — the model rewrites it into a complete brief: sections, realistic content, states and interactions',
    'composer.enhanceStop': 'Stop',
    'composer.enhanceStopTitle': 'Stop improving and keep your text',
    'composer.enhanceUndo': 'Back to your text',
    'composer.enhanceFailed': 'The prompt could not be improved ({detail}). Your text is unchanged.',
    'composer.enhanceEmpty': 'the model returned an empty answer',
    'composer.enhanceCaptures':
      'Unavailable with site captures: they describe the screen, and an invented brief would contradict them',
  },
}
