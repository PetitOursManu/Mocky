// Variants of one image: several takes on the same idea, so that a human picks.
//
// TWO PATHS, and the caller is always told which one ran. That is the design,
// not an implementation detail.
//
//  • The 'edit' image profile is configured — a REAL derivation. The source
//    image's bytes go to the provider together with its own recorded prompt, a
//    variation instruction and a moderate strength, and what comes back is a
//    picture of the user's picture. `derived: true`. This is the nominal path.
//
//  • No 'edit' profile — a FALLBACK. Sibling images born of the same text, with
//    the same variation instruction and a stably derived seed. They are of the
//    same subject; they are not of the same picture. `derived: false`, and the
//    interface has to say so — "here are variants of your image" printed over a
//    set that never saw that image is exactly the sentence `resolveImageProfile`
//    refuses to let a provider tell, told one layer higher instead.
//
// The variation axes are a fixed table, and no model is asked to invent them.
// What a multi-step flow like this one is worth is the human confirmation at the
// end, not the creativity of a paraphrase: a model call here would cost tokens,
// add a failure mode to a path that already has one, and make the series
// irreproducible — the same image would answer differently on Tuesday, and "give
// me the other three" would stop meaning anything.
import fs from 'node:fs'
import crypto from 'node:crypto'

/**
 * The bounds on how many variants one request may ask for.
 *
 * Two, because one variant is not a choice — the whole point is to put takes
 * side by side. Six, because each one is a provider call the account pays for
 * and a human has to actually look at all of them; past half a dozen the
 * confirmation step stops being a confirmation and becomes a chore that gets
 * clicked through.
 */
export const MIN_VARIANTS = 2
export const MAX_VARIANTS = 6

/**
 * How far a derivation is allowed to travel from its source, on the contract's
 * scale where 1 drifts furthest (see server/images/providers/init.js).
 *
 * Moderate on purpose, and the two failure modes are not symmetrical. Too low
 * returns the source back almost unchanged, which reads as a broken feature but
 * costs only the call. Too high returns a picture with no visible relationship
 * to the original — and since the interface calls it a variant, the user is left
 * believing Mocky derived something it plainly did not.
 */
export const VARIANT_STRENGTH = 0.45

/**
 * The variation axes. A bounded, readable table, deterministic, no model call.
 *
 * The hints are written in English because they are appended to an image prompt,
 * and every provider here is trained overwhelmingly on English captions; the
 * error messages around them are French like the rest of the server.
 */
export const VARIATION_AXES = [
  { id: 'angle', hint: 'seen from another angle, as if the camera had moved around the subject' },
  { id: 'framing', hint: 'framed tighter, the subject filling more of the picture' },
  { id: 'light', hint: 'lit from the other side, with softer shadows' },
  { id: 'background', hint: 'set against a different, plainer background' },
  { id: 'orientation', hint: 'the subject turned to face the other way' },
]

/**
 * Which axes variant #index moves.
 *
 * One axis each while there are axes left, then a PAIR — never the same axis
 * twice with only the seed changed. MAX_VARIANTS is deliberately one above the
 * length of the table, and wrapping around would have made the sixth request
 * produce a picture whose prompt is byte-identical to the first's: two images a
 * user cannot tell apart, in a panel whose entire job is to let them tell images
 * apart.
 */
export function axesFor(index) {
  const n = VARIATION_AXES.length
  if (index < n) return [VARIATION_AXES[index]]
  return [VARIATION_AXES[index % n], VARIATION_AXES[(index + 1) % n]]
}

/**
 * Clamp the requested count. An absent or unreadable one lands on the MINIMUM,
 * because that is the shape a malformed client sends and the cheapest answer to
 * a request nobody meant to make is the smallest one.
 */
export function clampVariantCount(value) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return MIN_VARIANTS
  return Math.min(MAX_VARIANTS, Math.max(MIN_VARIANTS, n))
}

/**
 * The seed for variant #index of a given source. Stable forever.
 *
 * Stable because the library's request cache is keyed on it: asking twice
 * returns the same pictures instead of paying the provider again (M8), so
 * "regenerate" has to be a deliberate button rather than something a double
 * click buys. Derived from the source id so that two images never share a
 * series, and folded to 31 bits because several providers reject a seed that
 * does not fit a signed integer.
 */
export function variantSeed(sourceId, index) {
  const digest = crypto.createHash('sha256').update(`${sourceId}|variant|${index}`).digest()
  return digest.readUInt32BE(0) % 2_147_483_647
}

/**
 * The prompt for one variant.
 *
 * Two shapes, because the two paths are asking for different things. With the
 * source image attached, "the supplied image" is a real referent and the model
 * is being asked to move one thing about it. Without it, there is no image in
 * the conversation at all, and a prompt that spoke of one would be describing
 * something the provider cannot see.
 */
export function variantPrompt(basePrompt, index, derived) {
  const hints = axesFor(index)
    .map((a) => a.hint)
    .join(', and ')
  const base = String(basePrompt || '').trim()
  return derived
    ? `${base}\n\nVariation of the supplied image: ${hints}. Keep the same subject, style and palette.`
    : `${base}\n\nVariation: ${hints}. Keep the same subject, style and palette as described above.`
}

/** The bytes of a library image, ready for the provider contract. */
function readSource(library, imageId) {
  const file = library.filePath(imageId)
  if (!file) throw new Error("Identifiant d'image invalide : impossible de lire l'image source.")
  try {
    return { buffer: fs.readFileSync(file), contentType: library.mimeFor(imageId) }
  } catch (err) {
    throw new Error(
      `Impossible de lire l'image source (${imageId.slice(0, 8)}…) : ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * Produce `count` variants of one library image.
 *
 * @param {object} req  { imageId, count }
 * @param {object} deps
 * @param {import('../images/library.js').ImageLibrary} deps.library
 * @param {object|null} [deps.editRegistry]  the 'edit' profile's providers, or
 *   null when nothing is configured. Its presence is what selects the path — and
 *   `resolveImageProfile` guarantees it is null rather than a text-to-image
 *   provider wearing an edit profile's name.
 * @param {object|null} [deps.fallbackRegistry]  used only when there is no edit
 *   registry, to make siblings from the same text.
 * @param {string} [deps.owner]  the account, from the session
 * @param {string} [deps.project]
 * @param {()=>boolean} [deps.aborted]  "the caller has gone away"
 * @returns {Promise<{derived:boolean, sourceId:string, requested:number, images:object[], notices:string[]}>}
 */
export async function makeVariants({ imageId, count } = {}, deps = {}) {
  const { library, editRegistry = null, fallbackRegistry = null, owner, project, aborted = () => false } = deps

  const source = library.get(imageId)
  if (!source) {
    throw new Error("Cette image n'est pas dans la bibliothèque : il n'y a rien dont tirer des variantes.")
  }

  const derived = Boolean(editRegistry)
  const registry = editRegistry || fallbackRegistry
  if (!registry) throw new Error("Aucun fournisseur d'image n'est disponible sur cette instance.")

  /*
   * The prompt comes from the LIBRARY (M8), and on the fallback path it is the
   * only material there is. An image with no recorded description — which the
   * library goes out of its way to avoid, `ingestUpload` storing the file name
   * precisely so this field is never empty — leaves the sibling path with
   * neither an image nor a text, and five pictures of nothing in particular
   * would still be reported as variants of somebody's photograph. Refusing says
   * the true thing, and it names the setting that would fix it.
   */
  const base = String(source.prompt || '').trim()
  if (!derived && !base) {
    throw new Error(
      "Cette image n'a pas de description enregistrée, et aucun profil « Édition » n'est configuré sur cette instance : il n'y a ni image d'entrée ni texte à partir desquels produire des variantes.",
    )
  }

  const requested = clampVariantCount(count)
  const notices = []

  /*
   * The one case where a variant CANNOT inherit its source's shape, said out
   * loud rather than papered over.
   *
   * The spec below falls back to 1024×1024, and that fallback is the library's
   * square default — the exact geometry `SOURCE_DIMENSIONS` exists to stop a
   * film asking for, enlarged 1.88× on a 16:9 frame with 44% of it cropped away.
   * It is reachable: `ingestUpload` records 0 when the browser could not decode
   * the file, and rows from before the field existed carry nothing at all. So a
   * 16:9 photograph somebody imported can hand back square variants, which is a
   * crop nobody asked for, produced in silence.
   *
   * There is nothing better to send — this server decodes no images, by the
   * same no-native-dependencies rule that keeps it on JSON files — so the honest
   * move is the one this repository makes everywhere else: degrade, and say what
   * was lost. The panel measures the file it gets back and will flag the
   * enlargement too; this names the CAUSE, which the measurement cannot.
   */
  const geometryKnown = Number(source.width) > 0 && Number(source.height) > 0
  if (!geometryKnown) {
    notices.push(
      "Cette image n'a pas de dimensions enregistrées : les variantes sont demandées en 1024×1024. " +
        "Sur un film 16:9 ou 9:16, elles seront recadrées — réimportez l'image pour que sa géométrie soit reprise.",
    )
  }
  // Read once, outside the loop: the same bytes go to every variant, and
  // re-reading them per call is a few hundred kilobytes of disk for an identical
  // result. A failure here is fatal to the whole request rather than to one
  // variant — there is no source, so there is nothing to derive.
  const init = derived ? readSource(library, imageId) : null

  const images = []
  /*
   * One at a time, and the reason is not caution.
   *
   * `SpacedQueue` already serialises every provider call in this process
   * (Pollinations' anonymous tier is one request per fifteen seconds, per IP),
   * so six in parallel would arrive no sooner — they would only queue somewhere
   * else. What sequencing buys is the two things this loop actually needs: a
   * failure that stops at one variant instead of the batch (Q1), and a place to
   * notice that the caller has hung up before spending the next call on an
   * answer with nowhere to go.
   */
  for (let index = 0; index < requested; index++) {
    if (aborted()) {
      notices.push(`Demande interrompue : ${images.length} variante(s) produite(s) sur ${requested}.`)
      break
    }
    const axis = axesFor(index)
      .map((a) => a.id)
      .join('+')
    const spec = {
      prompt: variantPrompt(base, index, derived),
      negative: source.negative || undefined,
      seed: variantSeed(imageId, index),
      // The source's own geometry, not a slot's. A derivative that came back in
      // a different shape from the picture it derives would be a crop nobody
      // asked for; on the sibling path it is simply what makes the set look like
      // one set. When there is none recorded, the square below is a fallback the
      // caller has already been warned about — see `geometryKnown`.
      width: Number(source.width) || 1024,
      height: Number(source.height) || 1024,
      tags: ['variant'],
      project,
      owner,
      // Nothing here is a library image until somebody says so — see task-level
      // note on `pending` in ImageLibrary.list().
      pending: true,
    }
    if (derived) {
      spec.init = init
      spec.strength = VARIANT_STRENGTH
    }

    try {
      const out = await library.generate(spec, { registry })
      if (out.skipped) {
        notices.push(`Variante ${index + 1} (${axis}) : le fournisseur n'a produit aucune image.`)
        continue
      }
      images.push({
        hash: out.hash,
        url: `/api/images/${out.hash}`,
        axis,
        fromCache: out.fromCache,
        meta: out.meta,
      })
    } catch (err) {
      // Partial degradation: one axis failing leaves the others alone, and the
      // notice names WHICH one died. A batch that silently came back short would
      // read as "the model only found three ideas" rather than as an error.
      notices.push(`Variante ${index + 1} (${axis}) : ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { derived, sourceId: imageId, requested, images, notices }
}
