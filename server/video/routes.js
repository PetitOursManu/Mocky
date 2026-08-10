// Express routes for video export. Mounted at /api/video, behind requireUser.
//
// Note the singular: `server/video/` is the export pipeline, `server/videos/` is
// the clip library that feeds scroll sequences into a mockup. They are different
// features that happen to sit one letter apart.
//
// `express.json()` is applied at the /api level in server/index.js, so req.body
// is parsed here.
import express from 'express'
import {
  VideoTimelineSchema,
  attachTheme,
  readableIssues,
  timelineImageIds,
  MAX_SCENES,
  MAX_TOTAL_DURATION_MS,
} from './timeline.js'
import { proposeTimeline } from './compose.js'
import {
  MAX_THREE_D_LAYERS,
  threeDBlocksIn,
  threeDLoadOf,
  threeDLoadRefusal,
  threeDRefusal,
} from './three-d.js'
import { publicMotionKinds } from './kinds.js'
import { makeVariants, clampVariantCount, MIN_VARIANTS, MAX_VARIANTS } from './variants.js'
import { makeLlm, credsFromReq } from '../muse/llm.js'
import { MAX_WORKER_PAYLOAD_BYTES, payloadBytesFor } from './worker.js'
import { quotaError } from '../storage-quota.js'

const HASH_RE = /^[a-f0-9]{64}$/

/**
 * What a job looks like to the account that owns it.
 *
 * `userId` never leaves the server. `publicUser()` in server/index.js
 * deliberately omits the account id, and the image library strips `owners` from
 * every listing for the same reason; a job document would hand one straight back
 * on the first poll of the first export.
 */
const publicJob = ({ userId, ...rest }) => rest

/**
 * The same strip `server/images/routes.js` applies to every library listing.
 *
 * `owners` holds account ids and the image library is instance-wide, so leaving
 * it in hands an ordinary account its own id on the first variant it generates —
 * and `publicUser()` deliberately withholds exactly that. Duplicated here rather
 * than exported, because the two routers already share nothing and a helper
 * imported across them would be the only reason to couple them.
 */
const withoutOwners = (meta) => {
  if (!meta || typeof meta !== 'object') return meta ?? null
  const { owners, ...rest } = meta
  return rest
}

/**
 * How many ids /compose will even look at.
 *
 * The route runs one `existsSync` per id before anything else happens, so an
 * unbounded array is a few thousand stat() calls for the price of one request.
 * The ceiling is deliberately above MAX_SCENES rather than equal to it: a
 * selection of twenty-five images has no valid timeline, and the composer says
 * so by naming the real count — a cap of twenty would have made that sentence
 * lie.
 */
const MAX_COMPOSE_IMAGES = 100

/**
 * How much of a project id is kept on a film.
 *
 * The same slice `ImageLibrary` applies to its own `project`, and for the same
 * reason: the string comes from a request body and lands in an index that is
 * re-serialised whole on every write. A caller sending a megabyte here would be
 * writing a megabyte back to disk on every export from then on.
 */
const MAX_PROJECT_ID = 100

/**
 * Refuse a set of image ids that still contains something nobody has looked at.
 *
 * THE GUARD IS HERE, on the server, and that is the whole point of it. The
 * multi-step flow's two confirmation gates are interface: they can be skipped by
 * closing a modal, by a stale tab, by a client that never had them, or by
 * anybody with a hash and curl. What makes "the user chose these pictures" true
 * of a film is that the route which turns pictures into a film refuses the ones
 * they did not choose.
 *
 * Both entry points, not just /render. /compose spends a model call and hands
 * back a running order; letting it read unconfirmed images would put a discard
 * into a proposal, name it scene four, and leave /render to reject the timeline
 * the user was just shown — a refusal arriving one step after the decision that
 * caused it, about a picture they thought they had thrown away.
 *
 * 409 rather than 400 or 404: the request is well formed and the images are all
 * on disk. What is wrong is the STATE they are in, and it is a state the caller
 * can change — confirm them, or drop them from the selection — which is exactly
 * what a conflict means. A 400 would read as "you built the timeline wrong".
 *
 * @returns {boolean} whether it answered. The caller stops when it did.
 */
function refusedForPending(res, imageLibrary, ids) {
  const pending = imageLibrary.pendingAmong(ids)
  if (!pending.length) return false
  res.status(409).json({
    error: `${pending.length} image${pending.length > 1 ? 's are' : ' is'} still awaiting your confirmation. Confirm ${pending.length > 1 ? 'them' : 'it'} or drop ${pending.length > 1 ? 'them' : 'it'} from the selection — nothing was done.`,
    pendingImageIds: pending,
  })
  return true
}

/**
 * What one variant is assumed to weigh before anyone has generated it.
 *
 * The same reservation `POST /api/images/generate` makes, for the same reason: a
 * generated image is a few hundred kilobytes, but its real size is only known
 * once the provider has been paid. Reserving one typical image per requested
 * variant keeps the check honest without pretending to know the answer.
 */
const TYPICAL_IMAGE_BYTES = 2 * 1024 * 1024

/**
 * @param {object} deps
 * @param {import('./config.js').VideoConfigStore} deps.config
 * @param {import('./queue.js').VideoQueue} deps.queue
 * @param {ReturnType<import('./worker.js').createVideoWorker>} deps.worker
 * @param {import('../images/library.js').ImageLibrary} deps.imageLibrary
 * @param {import('./store.js').VideoExportStore} [deps.store] where a finished render lands
 * @param {{wouldExceed:(n:number)=>boolean, usage:()=>object}} [deps.budget] the instance disk ceiling
 * @param {(profile:string)=>object|null} [deps.resolveTarget] Admin-configured text
 *   provider, resolved on the 'inspiration' profile like every other structured
 *   server-side call. Absent, /compose falls back to the browser's own credentials.
 * @param {(profile:string)=>object|null} [deps.imageRegistryFor] the image providers
 *   for a profile. `'edit'` answers null on an instance where no image-to-image
 *   provider is configured, and /variants reads that null as "fall back to
 *   siblings and say so" — never as "use the content profile", which is the one
 *   substitution resolveImageProfile exists to forbid.
 */
export function createVideoRouter({
  config,
  queue,
  worker,
  imageLibrary,
  store,
  budget,
  resolveTarget,
  imageRegistryFor,
}) {
  const router = express.Router()

  /**
   * May this account put a 3D block in a film?
   *
   * One reading of the config, used by the three places that need it, so a door
   * cannot be opened by being written differently from its neighbour.
   *
   * `?.` and `Boolean()` together are the closed direction, deliberately: a
   * config object without the method — an older store, a partial fake — answers
   * `undefined`, which is a no. Degrading a permission has to fail shut, and the
   * one place a missing method must NOT read as "allowed" is a gate.
   */
  const mayThreeD = (user) => Boolean(config.threeDEnabledFor?.(user))

  /**
   * Can this account export, and is there anything to export with?
   *
   * The worker is only probed for someone who could actually use it. This route
   * is what a panel polls, `health()` spends up to three seconds on a connect,
   * and doing that for every signed-in account on an instance where the feature
   * is off would be three seconds of nothing, repeatedly.
   *
   * No secret appears here, and none can: `publicView()` is the only projection
   * of the config, and the licence key is a boolean in it.
   */
  router.get('/status', async (req, res) => {
    const enabled = config.enabledFor(req.user)
    const workerState = enabled
      ? await worker.health()
      : { available: false, reason: 'no-access', detail: 'Video export is not enabled for this account.' }
    res.json({
      enabled,
      worker: workerState,
      /*
       * May this account spend a 3D render?
       *
       * A BOOLEAN about the account, exactly like `enabled` above it, and never
       * the list or the mode: which other accounts an administrator ticked is
       * not this route's business, and `publicView()` — the admin projection —
       * is where that lives, behind requireAdmin.
       *
       * It is here so the panel can leave the 3D button out rather than offer a
       * control whose only outcome is a 403. That is presentation and nothing
       * else: the enforcement is on /compose and /render, because a document can
       * reach /render without this route ever having been called.
       */
      threeD: enabled && mayThreeD(req.user),
      /*
       * Will a variant really be derived from the user's picture?
       *
       * The /variants response answers this after the fact, and after the fact
       * is too late for the one person it matters to: somebody who expects a
       * retouch of THEIR image has to know before they spend six provider calls
       * discovering that an instance with no 'edit' profile can only make
       * siblings from the same sentence. So it is quoted here, where the panel
       * can print it beside the button rather than under the results.
       *
       * A statement about the instance, like `limits` beside it — not about the
       * account, and it names no provider, no model and no key.
       */
      variantsDerived: Boolean(imageRegistryFor ? imageRegistryFor('edit') : null),
      // The UI has to be able to stop a user before they compose a timeline the
      // API will refuse. Quoting the bounds from the schema rather than the
      // panel is what keeps the two from drifting apart — and the variant bounds
      // travel with them, so a picker cannot offer a count /variants would
      // silently clamp.
      limits: {
        maxScenes: MAX_SCENES,
        maxTotalDurationMs: MAX_TOTAL_DURATION_MS,
        minVariants: MIN_VARIANTS,
        maxVariants: MAX_VARIANTS,
      },
      /*
       * The kinds of Motion this build offers, so a selector can be drawn
       * without the browser holding a copy of the enum.
       *
       * The same argument `limits` makes one line up, and the reason this
       * feature has five hand-kept mirrors and wants no sixth: a list retyped in
       * the panel drifts from `kinds.js`, and the drift shows up as a selector
       * offering a name `/compose` refuses — after the call is spent.
       *
       * Ids and bounds, never the prose. `MOTION_KIND_SPECS`'s three sentences
       * are a prompt written in English for a model; what a person reads is
       * `muse.motionKind.<id>` in both dictionaries.
       *
       * Published whatever `enabled` says, unlike `threeD` beside it: this is a
       * fact about the BUILD, not about the account, and it names nothing an
       * account without the feature could not read in the source.
       */
      motionKinds: publicMotionKinds(),
    })
  })

  /**
   * Propose a montage for images the user has ALREADY chosen.
   *
   * The model picks one composition out of the catalogue and fills it in; it
   * never picks a picture and never writes a frame. `compose.js` holds the
   * reasoning — this route's job is the three things a router owns: who may ask,
   * what a well-formed question is, and where the credentials come from.
   *
   * The refusals mirror /render for the same reasons, in the same order. Access
   * first, so an account without the feature learns nothing about the shape of
   * the request. Then the body. Then the images, checked against the library
   * with `fileExists` rather than a metadata lookup: an id whose bytes are gone
   * would produce a beautiful proposal that fails at the first render.
   *
   * And it answers **200 with `timeline: null`** when nothing usable came back.
   * A proposal that did not happen is not a request that failed — the user still
   * has the manual editor they opened the modal with, and a 4xx there would draw
   * as a broken dialog over a feature that is working (Q1).
   */
  router.post('/compose', async (req, res) => {
    if (!config.enabledFor(req.user)) {
      return res.status(403).json({ error: 'Video export is not enabled for this account.' })
    }

    const brief = typeof req.body?.brief === 'string' ? req.body.brief.trim() : ''
    if (!brief) {
      return res.status(400).json({ error: 'Describe the film you want: a "brief" is required.' })
    }

    /*
     * The 3D button, checked against the permission before anything is spent.
     *
     * Two different things, and conflating them is the bug this shape avoids:
     * `threeDAllowed` is what this ACCOUNT may do and decides what the catalogue
     * OFFERS; `forceThreeD` is what this REQUEST asked for and decides what the
     * prompt INSISTS on. An account without the permission that sends the flag
     * is refused here — 403 and not a silent downgrade, because a button that
     * quietly does nothing is the failure people file as "3D is broken".
     *
     * `=== true` rather than a truthy read: `"false"` and `1` both arrive from
     * hand-made bodies, and a permission is not the place to guess.
     *
     * Named, never bare: `threeDRefusal` says who to ask and what the film can
     * still be made of, which is the module's rule for every refusal.
     */
    const forceThreeD = req.body?.forceThreeD === true
    const threeDAllowed = mayThreeD(req.user)
    if (forceThreeD && !threeDAllowed) {
      return res.status(403).json({ error: threeDRefusal([], 'Nothing was proposed.') })
    }

    /*
     * Ids only, from either spelling — a bare hash or the `{ id }` objects the
     * picker already holds. Deduplicated, because the same image chosen twice is
     * one lookup and one line in the prompt; the model is free to use it in two
     * scenes, and that is a decision about the film, not about the selection.
     */
    const ids = [
      ...new Set(
        (Array.isArray(req.body?.images) ? req.body.images : [])
          .map((img) => (typeof img === 'string' ? img : img && typeof img.id === 'string' ? img.id : null))
          .filter(Boolean),
      ),
    ].slice(0, MAX_COMPOSE_IMAGES)

    /*
     * An empty selection is a request, not a mistake.
     *
     * It used to be a 400 — "select at least one image" — which was true of
     * every film the catalogue could cut at the time. `titles` is text on a
     * background and has no `imageId` in its scene schema at all, so refusing
     * here would make the one composition that needs no picture unreachable
     * through the one route that composes. What the selection now decides is
     * which templates are on offer, and `compose.js` is where that is decided:
     * it shows the model `titles` alone, and refuses a picture-bearing
     * composition by naming the one that would have worked.
     */

    const missing = ids.filter((id) => !imageLibrary.fileExists(id))
    if (missing.length) {
      return res.status(404).json({
        error: `${missing.length} image${missing.length > 1 ? 's are' : ' is'} not in the image library. Nothing was proposed.`,
        missingImageIds: missing,
      })
    }

    // After "is it here", before the model call: a proposal built on a picture
    // the user rejected is a proposal they have to unpick, and it costs tokens
    // to produce.
    if (refusedForPending(res, imageLibrary, ids)) return

    /*
     * The descriptions come from the LIBRARY, never from the body.
     *
     * The browser knows them — it just drew them in the picker — but they are
     * what the model reads to decide the order of somebody's film, and the
     * library is the single source of truth for what an image is (M8). Taking
     * them from the request would mean the text steering the montage is text the
     * request supplied about itself. Uploads have a caption too: `ingestUpload`
     * records the file name as the prompt precisely so this field is never empty.
     */
    const images = ids.map((id) => {
      const meta = imageLibrary.get ? imageLibrary.get(id) : null
      return { id, prompt: meta?.prompt || '', width: meta?.width || 0, height: meta?.height || 0 }
    })

    // Credentials exactly as POST /api/muse/quality resolves them: an
    // admin-configured provider wins, otherwise the browser's own headers — and
    // the model name is read from the BODY first, which is the trap that once
    // left the SEO deep pass permanently "unconfigured". See credsFromReq.
    let admin = null
    try {
      admin = resolveTarget ? resolveTarget('inspiration') : null
    } catch {
      admin = null
    }
    const creds = admin ? { ...admin, trusted: true } : credsFromReq(req)
    const llm = creds ? makeLlm(creds) : null

    /*
     * Hang up on the provider when the browser hangs up on us.
     *
     * `proposeTimeline` has taken a `signal` since it was written and `museChat`
     * has always honoured one — nothing was ever passing it. So the panel's
     * Cancel button and closing the modal aborted the browser's fetch and left
     * the model call running to its 40 s ceiling, spending the account's own
     * provider key on an answer with nowhere left to go.
     *
     * On RES, not on req, and that is the whole subtlety. `req.on('close')` is
     * the spelling everyone reaches for — it is what server/provider-proxy.js
     * uses — but since Node 16 an IncomingMessage emits `close` when the request
     * MESSAGE completes, which for a small JSON body is a tick after
     * `express.json()` returns and long before the answer exists. Measured on
     * Node 22: `req.close` arrives with `res.writableEnded === false`, so the
     * obvious guard does not save it and every compose aborts itself. `res`
     * emits `close` once, at the real end: `writableFinished` is true when the
     * answer was delivered and false when the socket went away under it.
     */
    const abort = new AbortController()
    res.on('close', () => {
      if (!res.writableFinished) abort.abort()
    })

    try {
      /*
       * The theme travels with the request, exactly as it does to /render, and
       * for the same reason: the direction lives inside a project the server
       * keeps as an opaque blob, so the browser is the only party that can read
       * it (`src/lib/video/theme.ts`). It is NOT shown to the model — nothing of
       * it reaches the prompt — and it is attached to the composed document only
       * after the schema has accepted it. A model that wrote its own was already
       * refused by then, for the reason `VideoTimelineSchema` has no `theme` key.
       */
      const { timeline, notices } = await proposeTimeline(brief, images, {
        llm,
        theme: req.body?.theme ?? null,
        /*
         * The composition the panel's selector is on, or nothing for `auto`.
         *
         * Passed straight through rather than validated here: `compose.js` owns
         * the catalogue, and it matches this against `VIDEO_TEMPLATES` before it
         * reaches a prompt. A route that also knew the list would be a second
         * copy of it, and the copy that drifts is the one nobody tests.
         */
        template: req.body?.template ?? null,
        /*
         * What the film is FOR — a hero, a background, a globe.
         *
         * Passed straight through for the same reason `template` above it is:
         * `kinds.js` owns the enum and `compose.js` matches against it before a
         * prompt exists, and a route that also knew the list would be a second
         * copy of it. An unknown name comes back as a 200 with `timeline: null`
         * and a notice naming the whole enum, which is this route's rule — a
         * proposal that could not be made is not a request that failed.
         */
        motionKind: req.body?.motionKind ?? null,
        /*
         * The project's art direction, in its own words.
         *
         * From the BODY, and it has to be: the direction lives inside a project
         * the server keeps as an opaque blob, so the browser is the only party
         * that can read it — the same reason `theme` travels this way. What is
         * different is where it lands. A theme is attached AFTER validation and
         * never reaches the model; this is shown to the model, as data, in the
         * user turn under a header that says so (Q5).
         *
         * Bounded by `compose.js`, not here, so a second caller cannot have a
         * different ceiling from the one the prompt was written against.
         */
        direction: req.body?.direction ?? null,
        // What the account may spend, and what this request asked for. Read from
        // the config on every call rather than cached: an administrator who takes
        // 3D away should have taken it away by the next compose, not by the next
        // restart.
        threeD: threeDAllowed,
        forceThreeD,
        signal: abort.signal,
      })
      // Nobody is on the other end any more. Writing to a socket the client
      // closed buys nothing and risks a write-after-end on the way out.
      if (abort.signal.aborted) return
      res.json({ timeline, notices })
    } catch (err) {
      if (abort.signal.aborted) return
      // proposeTimeline is written not to throw. If it ever does, the modal is
      // open and the user's selection is intact; the honest answer is the same
      // shape with nothing in it (Q1).
      res.json({ timeline: null, notices: [err instanceof Error ? err.message : String(err)] })
    }
  })

  /**
   * Queue one render.
   *
   * The order of the three refusals is deliberate. Access first: someone with no
   * right to the feature learns nothing about what a well-formed timeline looks
   * like. Then the schema, because an id check on a document that is not a
   * timeline is meaningless. Then the images.
   */
  router.post('/render', (req, res) => {
    if (!config.enabledFor(req.user)) {
      return res.status(403).json({ error: 'Video export is not enabled for this account.' })
    }

    const parsed = VideoTimelineSchema.safeParse(req.body?.timeline)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'The timeline was refused. Nothing was queued.',
        // The issue list, not `error.message` — that is a JSON dump of the whole
        // tree and reads as a stack trace in a response body. This document is
        // model-written, so the failure being legible is what lets the caller
        // retry with a correction instead of guessing.
        issues: readableIssues(parsed.error),
      })
    }

    /*
     * `parsed.data`, never `req.body.timeline`.
     *
     * The parsed document is the one with defaults applied and unknown keys
     * refused; the raw body is the one somebody wrote. Queueing the raw body
     * would persist, and eventually send to the worker, exactly the fields the
     * schema exists to keep out — and the strictness in timeline.ts is the
     * feature's load-bearing guarantee, not a formality.
     */
    const timeline = parsed.data

    /*
     * A 3D block, from an account that may not spend one.
     *
     * **This is the gate, and /compose is not.** A document can reach this route
     * without ever having passed through the composer: a draft saved last week
     * from an account that has since been taken off the list, a tab left open
     * while an administrator narrowed the setting, a client with a hash and
     * curl, or simply the hand-written editor the panel has always had. Hiding a
     * button is presentation; refusing the document is the control. It is the
     * same argument `refusedForPending` makes about images the user discarded.
     *
     * Right after the schema and before the pictures, in the order this route
     * has always used: a check on a document that is not a timeline is
     * meaningless, and everything below this line touches the disk.
     *
     * 403 rather than 400: the document is well formed and nothing about it is
     * wrong. What is wrong is who is asking, and that is a state an
     * administrator can change — the message says so, and names the film that
     * could be rendered instead.
     */
    const in3d = threeDBlocksIn(timeline)
    if (in3d.length && !mayThreeD(req.user)) {
      return res.status(403).json({
        error: threeDRefusal(in3d, 'Nothing was queued.'),
        // Which blocks, as a list, for the same reason `missingImageIds` travels
        // beside its sentence: a panel that wants to point at the scenes can,
        // and one that only prints the message loses nothing.
        threeDBlocks: in3d,
      })
    }

    /*
     * And how MUCH 3D, which is a different question from whether any is
     * allowed and was missing until a film was measured end to end.
     *
     * 400 rather than 403: nothing here is about who is asking. The document
     * itself cannot finish inside the deadline, and no administrator setting
     * changes that — so the refusal names the arithmetic and the fix.
     *
     * Refused HERE and not in the schema, for the reason `three-d.js` gives at
     * the top of the file: three-dimensionality is a fact about a block's
     * RENDERER, not about what validates it, and the schema is a hand-kept
     * mirror in three places. Putting the list there to express this bound
     * would buy a fourth copy of it in exchange for a check the one door that
     * every document passes through can already make.
     */
    const load = threeDLoadOf(timeline)
    if (load > MAX_THREE_D_LAYERS) {
      return res.status(400).json({ error: threeDLoadRefusal(load, 'Nothing was queued.'), threeDLoad: load })
    }

    /*
     * Every image has to be on disk, checked here and not only at render time.
     *
     * `fileExists` rather than a metadata lookup: the render reads the file, so
     * an index entry whose bytes are gone is a job that fails minutes later, in
     * the queue, with the user watching a spinner. A 404 naming the ids costs
     * nothing and is the difference between a mistake and a mystery. It is a
     * check and not a guarantee — the file can still be deleted between here and
     * the render, which is why collectImages() checks again.
     */
    const ids = timelineImageIds(timeline)
    const missing = ids.filter((id) => !imageLibrary.fileExists(id))
    if (missing.length) {
      return res.status(404).json({
        error: `${missing.length} image${missing.length > 1 ? 's are' : ' is'} not in the image library. Nothing was queued.`,
        missingImageIds: missing,
      })
    }

    // The last thing about the pictures, before the first thing about the
    // instance. A render is minutes of CPU on somebody else's behalf; it is not
    // spent on an image whose only claim to being in the film is that a client
    // put it in a JSON body.
    if (refusedForPending(res, imageLibrary, ids)) return

    /*
     * Will the pictures even fit in the request that carries them?
     *
     * They travel as base64 inside one JSON body (`collectImages`), and the
     * worker's `express.json()` stops at 80 MB. Without this check that ceiling
     * was met at the far end of a queue: the job waited its turn, the images
     * were read and encoded, and the answer came back as "The render worker
     * answered 413" — a sentence about a machine, minutes after the only moment
     * the user could have done anything about it. A film of twenty photographs
     * straight off a camera reaches it easily; one cut from generated stills
     * never comes close.
     *
     * `fileSize` and not the metadata: the index records the dimensions asked
     * for, and this is a question about bytes on disk. It is measured on the
     * DEDUPLICATED ids, because that is what actually gets sent — a timeline
     * that opens and closes on the same photograph pays for it once.
     *
     * A floor, never an estimate — see `payloadBytesFor`. What is refused here
     * is a payload whose pictures alone are already over the ceiling, so nothing
     * that would have rendered is turned away; a body that clears this and fails
     * on the JSON around it still meets the worker's own 413, exactly as before.
     */
    const imageBytes = ids.reduce((sum, id) => sum + (imageLibrary.fileSize ? imageLibrary.fileSize(id) : 0), 0)
    const payload = payloadBytesFor(imageBytes)
    if (payload > MAX_WORKER_PAYLOAD_BYTES) {
      const mb = (n) => `${Math.round(n / (1024 * 1024))} MB`
      return res.status(413).json({
        error:
          `These ${ids.length} image${ids.length > 1 ? 's' : ''} weigh ${mb(imageBytes)}, which becomes ${mb(payload)} once encoded into the render request — over the worker's ${mb(MAX_WORKER_PAYLOAD_BYTES)} ceiling. ` +
          'Nothing was queued. Use fewer scenes, or lighter images.',
      })
    }

    /*
     * Is there anywhere to put the result?
     *
     * Last, because it is the only refusal here that is about the instance
     * rather than the request — and the only one whose answer can change while
     * the job waits, which is why the store checks again with the real size
     * before it writes. This one is cheap and asks a blunter question: the
     * volume is ALREADY at its ceiling, so a render that will take minutes of
     * CPU has nowhere to land before it starts. Spending them anyway and failing
     * at the last step is the same wasted wait, with a worse message.
     */
    if (budget?.wouldExceed(0)) {
      return res.status(507).json({ error: quotaError(budget.usage()) })
    }

    /*
     * Where this film will be findable afterwards.
     *
     * From the body and not from the session, unlike `userId` beside it, and the
     * asymmetry is not an oversight: the account is an attribution — a claim the
     * caller must not be trusted to make about itself — while the project is
     * simply which of this account's own projects the panel was opened from.
     * There is nothing to escalate to. Bounded, and null when absent, because an
     * export composed from the standalone Media page belongs to no project and
     * inventing one for it would be a guess printed as a fact (M8).
     */
    const projectId =
      typeof req.body?.projectId === 'string' && req.body.projectId
        ? req.body.projectId.slice(0, MAX_PROJECT_ID)
        : null

    /*
     * The look of the film is attached HERE, and never by the model.
     *
     * `VideoTimelineSchema` has no `theme`, so the document the composer wrote
     * could not have carried one — a model that tried was refused on the line
     * above with "Unrecognized key(s)". What goes to the worker is that accepted
     * document plus the project's own direction, which is what makes an export
     * look like the product it was cut from rather than a stock template.
     *
     * From the body, like `projectId` and for the same reason: the direction
     * lives in a project the server keeps as an opaque blob, so the browser is
     * the only party that can read it (see `src/lib/video/theme.ts`). Nothing is
     * escalated by that — `VideoThemeSchema` accepts hex, one font family name
     * and an integer, so the worst a hand-made request can do is render its own
     * film in its own colours.
     *
     * A theme that will not parse costs the colours, never the export (Q1).
     */
    const themed = attachTheme(timeline, req.body?.theme ?? null)

    const job = queue.enqueue({ userId: req.user.id, timeline: themed.timeline, projectId })
    // 202: accepted, not done. The body carries the id to poll.
    // `notices` rather than a silent drop: Q2's rule that nothing is discarded
    // without saying so applies to a direction as much as to a lint rule.
    res.status(202).json({ ...publicJob(job), notices: themed.notice ? [themed.notice] : [] })
  })

  /**
   * Every film this account rendered.
   *
   * The route that makes the feature finishable. Until it existed the only way
   * back to a finished export was the job id the panel happened to be holding —
   * which the journal forgets after fifty more renders, and the browser forgets
   * on reload — so the ordinary outcome was a file on the volume that nothing in
   * the interface could reach.
   *
   * **Owned films only, and the filter is not a convenience.** `GET /:hash`
   * refuses a hash this account did not render, deliberately and before it
   * checks whether the file exists; a listing that named other people's exports
   * would hand back exactly what that check withholds, and their scene counts
   * and durations with it. `list({ owner })` is therefore the whole query, not a
   * default a caller may widen: there is no "all" parameter here to forget to
   * guard.
   *
   * Declared before `/:hash`, and it would still be safe declared after —
   * `HASH_RE` does not match the word "exports". Both, because a router whose
   * safety rests on declaration order is one reordering away from serving a
   * literal path as a hash.
   */
  router.get('/exports', (req, res) => {
    if (!store?.list) return res.json({ videos: [] })
    const userId = req.user?.id
    // No session, no films. Not an error — this router sits behind requireUser,
    // so it cannot happen in the running server; answering an empty list rather
    // than throwing keeps a router built without one from 500ing (Q1).
    if (!userId) return res.json({ videos: [] })
    const project = typeof req.query?.project === 'string' ? req.query.project : ''
    const videos = store.list({ owner: userId, project: project || undefined }).map(withoutOwners)
    res.json({ videos })
  })

  /**
   * Delete one finished render. The only thing that removes the file (M8).
   *
   * Ownership before existence, exactly as the download does and for the same
   * reason: answering 404 for an unknown hash and 403 for somebody else's would
   * turn this into an oracle for what other people have exported. Checked in
   * this order it says the same thing either way.
   *
   * The store gives the bytes back to the disk budget itself, so unlike
   * `DELETE /api/images/:hash` this route does not measure anything — the one
   * place that knows the size is the one doing the unlink.
   */
  router.delete('/:hash', (req, res) => {
    const hash = String(req.params.hash)
    const userId = req.user?.id
    const mine = HASH_RE.test(hash) && (queue.hasVideo?.(userId, hash) || store?.ownedBy?.(hash, userId))
    if (!mine) {
      return res.status(403).json({ error: 'This render belongs to another account.' })
    }
    const out = store?.remove?.(hash)
    if (!out) return res.status(404).json({ error: 'This render is no longer stored on this instance.' })
    // Which projects were still pointing at it, so the interface can say so
    // afterwards rather than only before — the same courtesy the image library's
    // `wasUsedBy` pays.
    res.json({ removed: true, wasUsedBy: out.meta?.projects || [] })
  })

  /**
   * One job's status.
   *
   * 403 rather than 404 on someone else's job. A job carries the timeline, and a
   * timeline carries the overlay text somebody wrote — other people's briefs are
   * exactly what the image library refuses to publish, for the same reason. The
   * existence leak the 403 admits is bounded by the id being twelve random
   * bytes: it cannot be enumerated, only replayed by someone who already had it.
   */
  router.get('/jobs/:id', (req, res) => {
    const job = queue.get(req.params.id)
    if (!job) return res.status(404).json({ error: 'No such render job.' })
    if (job.userId !== req.user?.id) {
      return res.status(403).json({ error: 'This render job belongs to another account.' })
    }
    res.json(publicJob(job))
  })

  /**
   * Several takes on one image the user already has, for them to choose from.
   *
   * The refusals run in the same order as /render and /compose, for the same
   * reasons: access first, then the shape of the request, then the image, then
   * the instance. What is specific here is the last one — a batch of variants is
   * up to six files, and the volume has to be asked about all of them at once
   * rather than discovering it is full on the fifth.
   *
   * The response carries `derived`. It is the only field in it that is about
   * WHAT HAPPENED rather than about what came back, and it is the reason this
   * route exists in this shape: with an 'edit' provider the pictures are of the
   * user's picture, without one they are of the same description, and an
   * interface that showed the two identically would be lying in the case that
   * costs nothing to detect.
   */
  router.post('/variants', async (req, res) => {
    if (!config.enabledFor(req.user)) {
      return res.status(403).json({ error: 'Video export is not enabled for this account.' })
    }

    const imageId = typeof req.body?.imageId === 'string' ? req.body.imageId : ''
    if (!HASH_RE.test(imageId)) {
      return res.status(400).json({ error: 'An "imageId" from the image library is required.' })
    }
    if (!imageLibrary.fileExists(imageId)) {
      return res.status(404).json({ error: 'That image is not in the image library. Nothing was generated.' })
    }

    const count = clampVariantCount(req.body?.count)

    // The 'edit' registry decides the path, and `null` is a configuration, not a
    // failure: it means image-to-image is off on this instance, which the
    // fallback handles and `derived: false` reports.
    const editRegistry = imageRegistryFor ? imageRegistryFor('edit') : null
    const fallbackRegistry = imageRegistryFor ? imageRegistryFor('content') : null
    if (!editRegistry && !fallbackRegistry) {
      return res.status(503).json({ error: "Aucun fournisseur d'image n'est configuré sur cette instance." })
    }

    // Before writing, never after. A full volume fails its writes silently
    // almost everywhere in this repository, so the refusal has to happen while
    // there is still something to refuse.
    if (budget?.wouldExceed(count * TYPICAL_IMAGE_BYTES)) {
      return res.status(507).json({ error: quotaError(budget.usage()) })
    }

    /*
     * Hang up with the caller, exactly as /compose does — and for a bigger
     * stake. Six provider calls run here, sequentially, and a panel closed after
     * the second one used to leave four more to be paid for and thrown away. On
     * `res`, not on `req`: since Node 16 an IncomingMessage emits `close` when
     * the request MESSAGE completes, which for a small JSON body is a tick after
     * express.json() returns.
     */
    let gone = false
    res.on('close', () => {
      if (!res.writableFinished) gone = true
    })

    try {
      const out = await makeVariants(
        { imageId, count },
        {
          library: imageLibrary,
          editRegistry,
          fallbackRegistry,
          // From the session, never from the body: an attribution the caller
          // writes about itself is worth less than none (see images/routes.js).
          owner: req.user?.id,
          project: typeof req.body?.project === 'string' ? req.body.project : undefined,
          aborted: () => gone,
        },
      )
      /*
       * Charge the volume for what was actually written — before anything else,
       * including the hang-up check, because the files exist whether or not
       * anybody is still listening.
       *
       * The reservation above is a guess made before the provider was paid;
       * this is the measurement, and it is what every other write path in the
       * repository does (POST /api/images/generate, /upload, the export store).
       * This one did not, and the consequence is worse than an inaccurate
       * number: `wouldExceed` reads an in-memory total that only `add` moves, so
       * a route that reserves and never credits keeps passing its own check for
       * ever. Six files a call is then the quickest way to fill a volume that is
       * still reporting itself as well under the ceiling.
       *
       * `fromCache` is excluded for the reason /upload excludes it: the store is
       * content-addressed, so a reused image wrote nothing and charging for it
       * would leak quota on every duplicate.
       */
      for (const v of out.images) {
        if (!v.fromCache) budget?.add(imageLibrary.fileSize?.(v.hash) ?? 0)
      }

      if (gone) return

      /*
       * Nothing at all came back, so this is not a degradation.
       *
       * Q1 is about a CHECK never failing what it checks; this route is the
       * doing, and a 200 carrying an empty list would be a success message over
       * six failed provider calls. Partial success stays a 200 with notices —
       * that one really is the degradation — and the notices travel either way,
       * because "which axis failed and why" is the only thing that lets an admin
       * fix a misconfigured edit profile.
       */
      if (!out.images.length) {
        return res.status(502).json({
          error: 'Aucune variante n\'a pu être produite.',
          derived: out.derived,
          notices: out.notices,
        })
      }
      res.json({ ...out, images: out.images.map((v) => ({ ...v, meta: withoutOwners(v.meta) })) })
    } catch (err) {
      if (gone) return
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  /**
   * Play or download one finished render. `?download=1` → attachment.
   *
   * The two spellings mirror `GET /api/images/:hash`, and the default is inline
   * for a reason that is about this route rather than about symmetry: the Media
   * tab plays a film in a `<video src>`, and a response that always announced
   * itself as an attachment would be relying on browsers ignoring
   * `Content-Disposition` on a subresource load. They do today. Nobody promised
   * it, and a silent regression there is a black rectangle with no error in it.
   *
   * Declared last, and matched on 64 hex characters: `/status`, `/render` and
   * `/exports` are literals declared above it, so Express reaches them first,
   * but a router whose safety depends on declaration order is one reordering
   * away from serving `/status` as a hash. The regexp is the part that does not
   * move.
   *
   * NO OWNERSHIP CHECK, and that is a change from how this route started.
   *
   * The mount in `server/index.js` lets an unauthenticated GET reach exactly
   * this path shape, for the reason written there: a film has to be watchable
   * inside a generated screen, and that screen renders in an iframe with an
   * opaque origin (I2, I3) which cannot authenticate anything. So the URL is the
   * capability — the same trade `/api/images/:hash` and the clip library already
   * make, with the same argument: a 64-hex SHA-256 of the content cannot be
   * guessed, and it is only ever handed out by a listing that DOES require a
   * session.
   *
   * What was given up, stated rather than glossed: someone who obtains a hash —
   * from a shared screen's source, a screenshot of a URL, a leaked link — can
   * fetch the film without an account. What was kept: `GET /exports` still lists
   * only your own films, `DELETE /:hash` still proves ownership before removing
   * anything, and a hash this instance never stored still answers 404, so this
   * is a lookup for a string you were already given and not a probe for what
   * other people have rendered.
   *
   * `hasVideo` and `ownedBy` are still what `DELETE` reads. They are no longer
   * read here.
   */
  router.get('/:hash', (req, res) => {
    const hash = String(req.params.hash)
    const file = HASH_RE.test(hash) ? store?.filePath?.(hash) : null
    if (!file) {
      // The bytes are gone, or were never here: a deletion, a restored volume, a
      // wiped data directory, a hash from another instance. Saying "no longer"
      // rather than "not found" is the whole difference between a user checking
      // their own history and one filing a bug about a download button that lies.
      return res.status(404).json({ error: 'This render is no longer stored on this instance.' })
    }

    // `public` now, and it follows the route rather than leading it: the bytes
    // are content-addressed and immutable, so a shared cache holding them hands
    // the next request the same film it asked for by hash. This line said
    // `private` while the route proved ownership; changing one without the other
    // is how a cache starts answering a question the route stopped asking.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${store.downloadName(hash)}"`)
    }
    res.type(store.mimeFor(hash) || 'video/mp4')
    // `sendFile`, not `download`: it answers Range requests, which is what lets
    // a two-minute film be scrubbed instead of buffered whole before it plays.
    res.sendFile(file)
  })

  return router
}

/**
 * Admin settings. Mounted at /api/admin/video behind requireAdmin.
 *
 * A separate router because the mount points differ, not because the concerns
 * do: both halves read the same store, and `publicView()` is the only shape the
 * config is ever allowed to leave the server in — the licence key included, as a
 * boolean.
 */
export function createVideoAdminRouter({ config, worker }) {
  const router = express.Router()

  router.get('/config', (req, res) => {
    res.json(config.publicView())
  })

  /**
   * Probe the worker on the administrator's behalf.
   *
   * /status already reports worker health, but only to an account the feature is
   * enabled FOR — and `videoEnabledFor()` deliberately refuses to grant an admin
   * implicit access, so an admin who has not added themselves to the allowlist
   * reads `no-access` there. That is the wrong answer in the one place the URL
   * is typed: it would have made a working worker look unreachable.
   *
   * `health()` never throws (Q1: failing to CHECK must not look like failing to
   * DO), and a router built without a worker answers the same shape rather than
   * a 500 the panel would draw as a blank status line.
   */
  router.get('/health', async (req, res) => {
    res.json(
      worker?.health
        ? await worker.health()
        : { available: false, reason: 'not-configured', detail: 'No render worker is wired up on this server.' },
    )
  })

  router.put('/config', (req, res) => {
    config.update(req.body || {})
    // The updated view, so the panel shows what was actually stored rather than
    // what it sent: an ignored access mode or a refused worker URL is invisible
    // otherwise, and the admin walks away believing a setting that did not take.
    res.json(config.publicView())
  })

  return router
}
