/**
 * Pictures handed to a generation by whoever asked for it — today an assistant
 * connected through MCP (server/mcp/tools.js): a free photo it chose, a picture
 * it generated, or one it was given. Each one is already in the account's image
 * library, so it is served from Mocky's own origin (M6) like every other
 * picture a screen shows.
 *
 * The section tells the model which picture is for what, by URL, and forbids
 * inventing others — the same contract `buildDocumentPictureSection` makes with
 * a document's one picture, for several. A request without pictures builds no
 * section, so the prompt is the one it always was (X5).
 */

export interface ProvidedPicture {
  /** The library hash: what the screen records as the image backing it. */
  hash: string
  /** Absolute, on Mocky's origin — the preview frame has an opaque origin. */
  url: string
  /** What it is for, in the requester's words: "hero", "the bakery's storefront"… */
  use: string
  /**
   * A game asset from the person's Sprixy (server/sprixy.js): pixel art, often
   * on a transparent background. Cropped by `object-cover` it loses its edges;
   * resized by the browser's default filter it turns to mush.
   */
  pixelArt?: boolean
}

/** At most this many: a page is designed around a few pictures, not a gallery dump. */
export const PROVIDED_PICTURES_MAX = 8

export function buildProvidedPicturesSection(pictures: ProvidedPicture[]): string {
  const list = pictures.slice(0, PROVIDED_PICTURES_MAX)
  if (!list.length) return ''
  const pixel = list.some((p) => p.pixelArt)
  const photos = list.some((p) => !p.pixelArt)
  return [
    `PICTURES — the person supplied ${list.length === 1 ? 'one picture' : `${list.length} pictures`} for this screen. Use ${list.length === 1 ? 'it' : 'each of them'}, where ${list.length === 1 ? 'its' : 'each'} purpose says:`,
    ...list.map((p, i) => `${i + 1}. ${p.use.replace(/\s+/g, ' ').trim().slice(0, 200) || 'a picture for this screen'}${p.pixelArt ? ' [PIXEL ART]' : ''} → ${p.url}`),
    photos
      ? `Embed ${pixel ? 'each other picture' : 'each'} as <img src="URL" alt="…" className="… object-cover"> with exactly its URL and an alt text describing what it shows; crop and frame it to fit the design.`
      : '',
    pixel
      ? 'Embed each [PIXEL ART] picture as <img src="URL" alt="…" className="… object-contain [image-rendering:pixelated]"> with exactly its URL: a game sprite, often on a transparent background. Never crop it, never put it in a rounded or circular mask, never stretch it to a different ratio; give it a fixed width and height (it is square-pixelled art, so a size like 128, 192 or 256 px keeps the pixels even), and let the background of its container show through.'
      : '',
    'Invent no other picture URL.',
  ]
    .filter(Boolean)
    .join('\n')
}
