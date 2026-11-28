import { translate, type Lang } from '../../i18n'
import type { SectionId } from './AdminDashboard'

/**
 * Every setting of the Admin page, for its search bar.
 *
 * Admin is eleven sections and some sixty blocks, and the one an administrator
 * wants is a word they remember — "Pexels", "inscriptions", "clé OpenRouter" —
 * not the section it was filed under. So each block is listed here once: the
 * section that holds it, its label (an i18n key, the words the page itself
 * shows), and the words someone might type for it that the label does not say.
 *
 * A hand-kept list, and it is held to the page in both directions:
 * `settingsIndex.test.ts` requires every id here to be on exactly one element
 * as `data-admin-setting="<id>"`, and every such attribute in the components to
 * be here. A block added without an entry fails the suite, and so does an entry
 * whose block was removed — which is the drift a search over a list nobody
 * renders would otherwise go stale with.
 *
 * Matching reads BOTH languages, whatever the interface is in: an admin on the
 * French page who types "signups" finds "Inscriptions". The result is shown in
 * the interface's language.
 */
export interface AdminSetting {
  /** Also the `data-admin-setting` the page carries on the block. */
  id: string
  section: SectionId
  /** The block's own title, as the page shows it. */
  label: string
  /** A sentence of the page that says more, when it helps tell two results apart. */
  detail?: string
  /** Words a person might type that neither the label nor the detail says. */
  keywords?: string
}

export const ADMIN_SETTINGS: AdminSetting[] = [
  // Users
  { id: 'signups', section: 'users', label: 'admin.allowSignups', detail: 'settings.allowSignupsHelp', keywords: 'inscription inscriptions signup register registration ouvrir fermer accès access' },
  { id: 'own-keys', section: 'users', label: 'settings.ownKeysAllow', detail: 'settings.ownKeysAllowHelp', keywords: 'clé personnelle own key byok propre clé' },
  { id: 'kosmy-board', section: 'users', label: 'auth.kosmy.admin.title', keywords: 'kosmy board sso oidc openid connect connexion unique single sign-on secret client' },
  { id: 'add-user', section: 'users', label: 'admin.addUser', keywords: 'créer compte create account utilisateur user mot de passe password rôle role' },
  { id: 'user-list', section: 'users', label: 'admin.users', keywords: 'comptes accounts utilisateurs users rôle role supprimer delete réinitialiser reset mot de passe password plan admin' },
  { id: 'free-plan', section: 'users', label: 'plan.adminHeading', keywords: 'plan gratuit free plan quota limite quotidienne daily limit nouveaux comptes new accounts' },
  { id: 'test-plan', section: 'users', label: 'plan.testHeading', keywords: 'tester test plan gratuit free essayer try' },
  // Sessions
  { id: 'sessions', section: 'sessions', label: 'dashboard.nav.sessions', keywords: 'session sessions révoquer revoke déconnecter sign out appareil device navigateur browser' },
  // System
  { id: 'system-machine', section: 'system', label: 'dashboard.system.title', keywords: 'cpu processeur ram mémoire memory boucle event loop charge load' },
  { id: 'system-storage', section: 'system', label: 'dashboard.system.storage', keywords: 'disque disk stockage storage budget espace space volume' },
  { id: 'system-worker', section: 'system', label: 'dashboard.system.worker', keywords: 'gpu vram carte graphique nvidia worker rendu render' },
  // Providers
  { id: 'text-models', section: 'providers', label: 'settings.textModelsTitle', detail: 'settings.textProfileGeneration', keywords: 'llm modèle texte text model génération generation inspiration muse openai anthropic claude ollama openrouter groq mistral gemini deepseek clé api key raisonnement reasoning fournisseur provider gratuit free' },
  { id: 'images', section: 'providers', label: 'settings.imagesSectionTitle', keywords: 'image images génération generation fal replicate cloudflare stable diffusion flux modèle model clé api key' },
  { id: 'stock-photos', section: 'providers', label: 'settings.stockTitle', keywords: 'pexels pixabay photos libres free stock clé api key' },
  { id: 'generated-images', section: 'providers', label: 'settings.generatedImagesTitle', keywords: 'images ia ai générées generated génération accès access comptes accounts' },
  { id: 'stock-images', section: 'providers', label: 'settings.stockImagesTitle', keywords: 'images gratuites free photos accès access composer' },
  { id: 'videos', section: 'providers', label: 'settings.videosSectionTitle', keywords: 'vidéo video clip séquence sequence scroll frames images par seconde fps' },
  { id: 'muse-sources', section: 'providers', label: 'settings.museSources.title', keywords: 'galeries galleries sources inspiration sites muse références references' },
  { id: 'video-export', section: 'providers', label: 'video.sectionTitle', keywords: 'motion ultra film films export remotion worker licence license adresse url' },
  { id: 'video-tier', section: 'providers', label: 'video.tierTitle', keywords: 'niveau tier full 3d monde world particules particles' },
  { id: 'decision-model', section: 'providers', label: 'decision.admin.title', keywords: 'jev typesafe openrouter vercel opper décision decision audit system one clé api key' },
  // Spending
  { id: 'spend', section: 'spend', label: 'spend.title', keywords: 'dépenses spending coût cost tokens jetons budget projet project' },
  { id: 'prices', section: 'spend', label: 'spend.prices', keywords: 'prix price prices tarif tarifs pricing importer import' },
  // Audit log
  { id: 'audit-log', section: 'audit', label: 'dashboard.nav.audit', keywords: 'journal log historique history actions qui who' },
  // Announcement
  { id: 'announcement', section: 'announcement', label: 'dashboard.announce.title', keywords: 'annonce announcement bannière banner message planifier schedule maintenance prévue' },
  // Assistants (MCP)
  { id: 'mcp', section: 'assistants', label: 'mcp.admin.enabled', keywords: 'mcp claude chatgpt assistant assistants activer enable connecteur connector https' },
  { id: 'mcp-keys', section: 'assistants', label: 'mcp.admin.keys', keywords: 'clés assistant keys clé key lecture read écriture write' },
  { id: 'mcp-engines', section: 'assistants', label: 'mcp.admin.engines', keywords: 'moteur engine client code assistant' },
  { id: 'mcp-quota', section: 'assistants', label: 'mcp.admin.quota', keywords: 'quota limite limit jour day' },
  { id: 'mcp-connections', section: 'assistants', label: 'mcp.admin.connections', keywords: 'connexions connections révoquer revoke' },
  // Maintenance and migration
  { id: 'maintenance', section: 'maintenance', label: 'migration.maintenance.title', keywords: 'maintenance lecture seule read-only read only bloquer block' },
  { id: 'migration-source', section: 'maintenance', label: 'migration.source.title', keywords: 'migrer migrate migration code appairage pairing ancien serveur old server' },
  { id: 'migration-import', section: 'maintenance', label: 'migration.import.title', keywords: 'migrer migrate import importer nouveau serveur new server' },
]

/** Lowercase, no accents, no punctuation: "Clé d’API" and "cle api" meet. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const LANGS: Lang[] = ['fr', 'en']

export interface SearchHit {
  setting: AdminSetting
  /** The label in the interface's language. */
  label: string
  /** The section's name in the interface's language. */
  sectionLabel: string
}

/**
 * The settings matching `query`, best first.
 *
 * Every word of the query must be found somewhere in an entry (its label, its
 * detail, its section, its keywords, in either language) as the START of one of
 * its words — "cle" finds "clé", "open" finds "OpenRouter", "ai" does not find
 * "mail". Ranked by where the words were found: the label first.
 */
export function searchSettings(query: string, lang: Lang, limit = 8): SearchHit[] {
  const words = fold(query).split(' ').filter(Boolean)
  if (!words.length) return []
  const hits: Array<SearchHit & { score: number }> = []
  for (const setting of ADMIN_SETTINGS) {
    const label = LANGS.map((l) => fold(translate(l, setting.label))).join(' ')
    const section = LANGS.map((l) => fold(translate(l, `dashboard.nav.${setting.section}`))).join(' ')
    const rest = [setting.detail ? LANGS.map((l) => fold(translate(l, setting.detail!))).join(' ') : '', fold(setting.keywords || '')].join(' ')
    // The start of a word ("open" → OpenRouter), or a word of four letters or
    // more that the typed one only extends by a plural ("signups" → signup,
    // "inscriptions" → inscription): people type the form they think of.
    const starts = (hay: string, w: string) =>
      ` ${hay}`.includes(` ${w}`) || hay.split(' ').some((h) => h.length >= 4 && w.startsWith(h) && w.length - h.length <= 2)
    let score = 0
    let all = true
    for (const w of words) {
      if (starts(label, w)) score += 3
      else if (starts(rest, w)) score += 2
      else if (starts(section, w)) score += 1
      else {
        all = false
        break
      }
    }
    if (!all) continue
    hits.push({
      setting,
      label: translate(lang, setting.label),
      sectionLabel: translate(lang, `dashboard.nav.${setting.section}`),
      score,
    })
  }
  // Stable within a score: the order of the list, which is the page's order.
  return hits
    .map((h, i) => ({ h, i }))
    .sort((a, b) => b.h.score - a.h.score || a.i - b.i)
    .slice(0, limit)
    .map(({ h: { score: _score, ...hit } }) => hit)
}
