/**
 * Where the documentation lives (`docs-site/lumy.config.json`, `url`).
 *
 * Its own host, and deliberately so: the docs are a separate static resource
 * built from the repository, with nothing in common with this application's
 * deployment.
 */
export const DOCS_URL = 'https://mocky-docs.emanuelvigreux.fr'

/**
 * The address of one documentation page, in the reader's language.
 *
 * Lumy publishes every language under its own directory, English included
 * (`/en/credits/`, `/fr/credits/`), which is what its own links point at.
 */
export function docsPage(slug: string, lang: string): string {
  return `${DOCS_URL}/${lang === 'fr' ? 'fr' : 'en'}/${slug}/`
}
