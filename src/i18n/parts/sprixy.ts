/**
 * Translations for the "sprixy" area: the person's own Sprixy (game assets)
 * connected to their Mocky account — Settings → Sprixy. See server/sprixy.js.
 *
 * Rules: same key set in `fr` and `en` (a test enforces it), keys under
 * `sprixy.`, placeholders are `{name}`.
 */
export const sprixy = {
  fr: {
    'sprixy.title': 'Sprixy',
    'sprixy.blurb':
      'Reliez votre Sprixy pour que vos sprites, icônes et tuiles en pixel art servent dans vos designs. Seuls les projets marqués « Shared with apps » dans Sprixy sont visibles, en lecture seule.',
    'sprixy.address': 'Adresse de votre Sprixy',
    'sprixy.addressHint': 'Par exemple https://sprixy.mondomaine.fr',
    'sprixy.token': 'Jeton de catalogue (lecture seule)',
    'sprixy.tokenHint': 'Dans Sprixy : Settings → API tokens → « Read-only catalog ». Un jeton à accès complet est refusé.',
    'sprixy.connect': 'Relier Sprixy',
    'sprixy.connecting': 'Vérification…',
    'sprixy.connectFailed': 'Sprixy n’a pas pu être relié : {error}',
    'sprixy.connected': 'Relié à {host}',
    'sprixy.owner': 'Compte Sprixy : {name}',
    'sprixy.shared': 'Projets partagés',
    'sprixy.assets': '{n} assets',
    'sprixy.nothingShared': 'Aucun projet n’est encore partagé. Dans Sprixy, ouvrez un projet et cliquez sur « Share with apps ».',
    'sprixy.howToUse': 'Demandez ensuite à votre assistant (Claude, ChatGPT) d’utiliser vos assets Sprixy dans un design : il les cherche avec search_sprixy_assets et Mocky les affiche en pixels nets.',
    'sprixy.unreachable': 'Sprixy ne répond pas en ce moment : {error}',
    'sprixy.disconnect': 'Délier',
  },
  en: {
    'sprixy.title': 'Sprixy',
    'sprixy.blurb':
      'Connect your Sprixy so your pixel-art sprites, icons and tiles can go into your designs. Only the projects marked "Shared with apps" in Sprixy are visible, read-only.',
    'sprixy.address': 'Address of your Sprixy',
    'sprixy.addressHint': 'For example https://sprixy.mydomain.com',
    'sprixy.token': 'Catalog token (read-only)',
    'sprixy.tokenHint': 'In Sprixy: Settings → API tokens → "Read-only catalog". A full-access token is refused.',
    'sprixy.connect': 'Connect Sprixy',
    'sprixy.connecting': 'Checking…',
    'sprixy.connectFailed': 'Sprixy could not be connected: {error}',
    'sprixy.connected': 'Connected to {host}',
    'sprixy.owner': 'Sprixy account: {name}',
    'sprixy.shared': 'Shared projects',
    'sprixy.assets': '{n} assets',
    'sprixy.nothingShared': 'No project is shared yet. In Sprixy, open a project and click "Share with apps".',
    'sprixy.howToUse': 'Then ask your assistant (Claude, ChatGPT) to use your Sprixy assets in a design: it finds them with search_sprixy_assets and Mocky shows them with crisp pixels.',
    'sprixy.unreachable': 'Sprixy is not answering right now: {error}',
    'sprixy.disconnect': 'Disconnect',
  },
}
