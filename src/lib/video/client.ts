// The browser's half of /api/video: what this account may do, queue a render,
// follow the job, download the file.
//
// Its own module rather than a block in `src/lib/api.ts`, and the reason is the
// `req()` helper there: it throws `new Error(data.error)`, which is exactly the
// right shape for a form that only needs a sentence and exactly the wrong one
// here. The three failures this panel has to name — the volume is full, the
// worker is unreachable, the images went away — are distinguished by the HTTP
// status and by a field beside the message, and `req()` drops both on the floor.
import {
  RenderTimelineSchema,
  VideoTimelineSchema,
  type RenderTimeline,
  type VideoTemplate,
  type VideoTheme,
  type VideoTimelineInput,
  type VideoTimeline,
} from './timeline'
import { loadSettings, type Settings } from '../settings'
import { proxyHeaders } from '../proxy'

export type VideoJobStatus = 'queued' | 'rendering' | 'done' | 'error'

/**
 * A job as the owning account sees it. Mirrors `publicJob()` in
 * server/video/routes.js, which strips `userId` — the account id never leaves
 * the server, so it is absent here by construction rather than by omission.
 */
export interface VideoJob {
  id: string
  status: VideoJobStatus
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
  /** The server's sentence when it failed. English, and shown verbatim. */
  error: string | null
  videoHash: string | null
  timeline?: VideoTimeline
}

export interface VideoWorkerState {
  available: boolean
  /** 'no-access' | 'not-configured' | 'blocked-target' | 'unreachable' | 'http-error' */
  reason?: string
  detail?: string
  version?: string
}

/** GET /api/video/status — access, worker health, and the bounds the UI quotes. */
export interface VideoAccess {
  enabled: boolean
  worker: VideoWorkerState
  /**
   * May this account spend a 3D render?
   *
   * A boolean about the account and never the mode or the list — which other
   * accounts an administrator ticked belongs to the admin projection, behind
   * requireAdmin. It exists so the panel can leave the 3D button OUT rather than
   * offer a control whose only outcome is a 403.
   *
   * That is presentation and nothing else: the enforcement is on `/compose` and
   * `/render`, because a document can reach the second without the first ever
   * having been called. Optional, and `undefined` is read as NO everywhere —
   * a server that predates the field is not a server saying yes, and a
   * permission is the one place a missing value must fail shut.
   */
  threeD?: boolean
  limits: { maxScenes: number; maxTotalDurationMs: number; minVariants?: number; maxVariants?: number }
  /**
   * Whether a variant will really be derived from the user's own picture.
   *
   * Quoted by /status so the panel can say it BEFORE the button is pressed. The
   * /variants response carries the same field about what actually happened, and
   * that one is the ground truth — this is a promise, not a receipt. Optional
   * because a server that predates the field answers nothing, and `undefined`
   * has to stay tellable apart from `false`: one is "we do not know yet", the
   * other is "these will only be siblings", and printing the second for the
   * first would be a claim nobody made.
   */
  variantsDerived?: boolean
  /**
   * The kinds of Motion this BUILD offers — what a film is for, not what it
   * looks like.
   *
   * Read off the server rather than held here, exactly as `limits` is, and for
   * the reason this feature has five hand-kept mirrors and wants no sixth: a
   * list retyped in the panel drifts from `server/video/kinds.js`, and the drift
   * shows up as a selector offering a name `/compose` refuses — after the call
   * is spent.
   *
   * Ids and bounds, never prose: the sentences in `MOTION_KIND_SPECS` are a
   * prompt written in English for a model, and what a person reads is
   * `muse.motionKind.<id>` in both dictionaries — the selector is in the Muse
   * panel, which is the only place a kind is chosen.
   *
   * Optional, and an absent list is read as "no kinds offered" — a server that
   * predates the field cannot be asked for one, and a selector drawn from an
   * empty array is a selector that is simply not there.
   */
  motionKinds?: MotionKindOffer[]
}

/** One entry of `VideoAccess.motionKinds`. See there. */
export interface MotionKindOffer {
  id: string
  aspectRatio: string
  minScenes: number
  maxScenes: number
  minSceneMs: number
  maxSceneMs: number
}

/**
 * Why a code and not a message.
 *
 * The panel says "the volume is full" in the reader's language, and the only
 * other way to know that is to match on an English sentence the server composes
 * — which breaks the day somebody rewords it, silently, in the one branch nobody
 * exercises. The status code is the part of the answer that is a contract.
 */
export type VideoErrorCode =
  | 'no-access'
  | 'invalid'
  | 'missing-images'
  /**
   * The selection still holds a picture nobody has confirmed.
   *
   * Its own code rather than a flavour of 'invalid', because it is the one
   * refusal here that is not about the timeline at all: the document is well
   * formed and every file is on disk. It sends the person back to the two
   * confirmation gates, and the ids say which pictures to deal with.
   */
  | 'pending-images'
  /**
   * The film carries a 3D block and this account may not render one.
   *
   * Its own code because it sends the person somewhere none of the others do:
   * the document is well formed, every file is on disk, and what is wrong is who
   * is asking — which an administrator can change. `no-access` would have said
   * "Motion is no longer enabled", which is false and points at the wrong
   * setting.
   *
   * It is set from `threeDBlocks` in the body and never from the sentence: the
   * route sends the list beside its message for exactly this, and matching on
   * English prose is how a branch nobody exercises stops working in silence.
   */
  | 'three-d'
  /** No image provider at all on this instance — nothing a different request fixes. */
  | 'no-provider'
  | 'quota'
  | 'not-found'
  | 'offline'
  | 'http'

export interface TimelineIssue {
  path: string
  message: string
}

export class VideoExportError extends Error {
  readonly code: VideoErrorCode
  readonly status: number
  /** Set when `code` is 'invalid'. Same shape as `readableIssues()` server-side. */
  readonly issues: TimelineIssue[]
  /** Set when `code` is 'missing-images'. */
  readonly missingImageIds: string[]
  /** Set when `code` is 'pending-images'. */
  readonly pendingImageIds: string[]
  /** Set when `code` is 'three-d'. The block kinds the document really carries. */
  readonly threeDBlocks: string[]
  /**
   * What the server said went wrong, axis by axis.
   *
   * Carried on the FAILURE and not only on the success, because a batch where
   * every variant failed is exactly when these sentences are the only thing
   * worth reading. The route already sent them — the client threw them away,
   * and a correctly configured edit model returning six 422s surfaced as
   * "no variant could be produced" with nothing to act on.
   */
  readonly notices: string[]

  constructor(
    code: VideoErrorCode,
    message: string,
    extra: {
      status?: number
      issues?: TimelineIssue[]
      missingImageIds?: string[]
      pendingImageIds?: string[]
      threeDBlocks?: string[]
      notices?: string[]
    } = {},
  ) {
    super(message)
    this.name = 'VideoExportError'
    this.code = code
    this.status = extra.status ?? 0
    this.issues = extra.issues ?? []
    this.missingImageIds = extra.missingImageIds ?? []
    this.pendingImageIds = extra.pendingImageIds ?? []
    this.threeDBlocks = extra.threeDBlocks ?? []
    this.notices = extra.notices ?? []
  }
}

/** The ids the server named, filtered to strings — it is a network body, not a type. */
const idsIn = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

/** The same projection `readableIssues()` makes server-side, so both read alike. */
export function readableIssues(error: { issues?: { path: (string | number)[]; message: string }[] }): TimelineIssue[] {
  return (error?.issues || []).map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
}

/**
 * `fetch`, with the network failure told apart from the HTTP one.
 *
 * A `TypeError` out of `fetch` means the server did not answer at all — the
 * container is down, the tab went offline, a proxy hung up. That is not a render
 * that failed, and a panel that shows both as "the export failed" sends the user
 * looking for a bug in their timeline. An abort is neither: it is the caller
 * cancelling, so it is re-thrown untouched for the caller to ignore.
 */
async function call(path: string, options?: RequestInit): Promise<{ res: Response; body: any }> {
  let res: Response
  try {
    res = await fetch(path, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options?.headers || {}) },
      credentials: 'same-origin',
    })
  } catch (e) {
    if ((e as { name?: string } | null)?.name === 'AbortError') throw e
    throw new VideoExportError('offline', e instanceof Error ? e.message : String(e))
  }
  const body = await res.json().catch(() => ({}))
  return { res, body }
}

const said = (body: any, fallback: string) => (typeof body?.error === 'string' && body.error ? body.error : fallback)

export async function fetchVideoAccess(signal?: AbortSignal): Promise<VideoAccess> {
  const { res, body } = await call('/api/video/status', { signal })
  if (!res.ok) throw new VideoExportError('http', said(body, `HTTP ${res.status}`), { status: res.status })
  return body as VideoAccess
}

/**
 * Queue one render.
 *
 * The timeline is parsed here before it is sent, and that is not a substitute
 * for the server's parse — the server is the only side that can refuse a request
 * it actually received, and it re-parses for exactly that reason. This one
 * catches the form drifting away from the schema: a control that can express a
 * 20-second scene is a bug in this repository, and it should be visible as a
 * refusal at the click rather than as a 400 that reads like a server problem.
 *
 * Nothing is repaired on the way through, here or anywhere: `parsed.data` is
 * sent because it is the document with the schema's defaults applied and unknown
 * keys refused, never because anything was corrected into it.
 */
export async function startVideoRender(
  input: VideoTimelineInput,
  opts: { project?: string; theme?: VideoTheme | null; signal?: AbortSignal } = {},
): Promise<VideoJob> {
  const parsed = VideoTimelineSchema.safeParse(input)
  if (!parsed.success) {
    throw new VideoExportError('invalid', 'The timeline was refused before it was sent.', {
      issues: readableIssues(parsed.error),
    })
  }

  const { res, body } = await call('/api/video/render', {
    method: 'POST',
    /*
     * `projectId` travels beside the timeline rather than inside it.
     *
     * The schema is `.strict()`, so a field the worker does not render cannot be
     * in the document at all — that is the whole guarantee, and smuggling an
     * attribution through it would be the first exception. It is also not part
     * of the film: two projects can compose byte-identical timelines and the
     * store deduplicates them into one file with both projects on it, which a
     * field inside the hashed document could not express.
     *
     * `theme` travels beside it for a different reason, and the two must not be
     * confused. The look of the film IS rendered — it is not an attribution —
     * but it is not something a composed document may contain: the schema above
     * has no `theme`, precisely so that a model which writes one is refused.
     * `attachTheme` on the server is what puts it into the render document,
     * after this timeline has been accepted, and the server is free to drop it
     * (a 202 with a notice) without costing the export.
     */
    body: JSON.stringify({ timeline: parsed.data, projectId: opts.project, theme: opts.theme ?? undefined }),
    signal: opts.signal,
  })
  if (res.ok) return body as VideoJob

  const status = res.status
  /*
   * Two different 403s, told apart by a field and never by the sentence.
   *
   * The route answers 403 for "Motion is not enabled for this account" and for
   * "this film is drawn in 3D and this account may not spend one", and the two
   * send the person to two different settings. What separates them is
   * `threeDBlocks`, which the route sends beside its message for exactly this
   * reason — the same courtesy `missingImageIds` pays.
   *
   * It is reachable from a panel that never showed a 3D button: a draft composed
   * before an administrator narrowed the setting still carries its `solidScene`,
   * and hiding a control is presentation while refusing a document is the
   * control.
   */
  if (status === 403) {
    const blocks = idsIn(body?.threeDBlocks)
    if (blocks.length) {
      throw new VideoExportError('three-d', said(body, 'This film is drawn in 3D.'), { status, threeDBlocks: blocks })
    }
    throw new VideoExportError('no-access', said(body, 'Not enabled for this account.'), { status })
  }
  if (status === 400) {
    throw new VideoExportError('invalid', said(body, 'The timeline was refused.'), {
      status,
      issues: Array.isArray(body?.issues) ? body.issues : [],
    })
  }
  if (status === 404) {
    throw new VideoExportError('missing-images', said(body, 'Some images are gone.'), {
      status,
      missingImageIds: idsIn(body?.missingImageIds),
    })
  }
  // 409 Conflict. Not a malformed timeline — every file is there — but a
  // selection that still holds something nobody looked at. See the guard in
  // server/video/routes.js.
  if (status === 409) {
    throw new VideoExportError('pending-images', said(body, 'Some images are still awaiting confirmation.'), {
      status,
      pendingImageIds: idsIn(body?.pendingImageIds),
    })
  }
  // 507 Insufficient Storage. The one refusal that is about the instance rather
  // than the request, and the only one a different timeline will not fix.
  if (status === 507) throw new VideoExportError('quota', said(body, 'No room left on the volume.'), { status })
  throw new VideoExportError('http', said(body, `HTTP ${status}`), { status })
}

/**
 * How long a brief this panel lets somebody type.
 *
 * Mirrors `MAX_BRIEF_CHARS` in server/video/compose.js, which SLICES rather than
 * refuses — so the two drifting apart does not fail anything, it just drops the
 * end of a sentence on the floor and composes a film from the rest. The form
 * counts the characters next to the box for the same reason: a limit nobody can
 * see is a limit that arrives as a mysteriously literal-minded montage.
 */
export const BRIEF_MAX_LENGTH = 600

/**
 * How many refusals the drift path shows before it counts the rest.
 *
 * Mirrors `MAX_REPORTED_ISSUES` in server/video/compose.js in intent, not in
 * value: this list is one of several banners in a modal, and a dozen identical
 * sentences is a wall people scroll past to reach the one that matters.
 */
const DRIFT_ISSUES_SHOWN = 4

/** What POST /api/video/compose answers with, on the ordinary path and the sad one. */
export interface VideoProposal {
  /**
   * Null when nothing usable came back. `notices` says why, in every case.
   *
   * A `RenderTimeline` and not a `VideoTimeline`, because the composer's answer
   * comes back with the project's direction already on it: the server attaches
   * the theme after the model's document has been validated, which is the whole
   * point of there being two schemas. The panel is free to ignore that key — the
   * form has no field for it and `/render` attaches it again from the same
   * source — but a client parsing this with `VideoTimelineSchema` would refuse
   * every themed proposal for an unrecognised key the server put there.
   */
  timeline: RenderTimeline | null
  /** The server's own sentences. English, and shown verbatim. */
  notices: string[]
}

/**
 * Ask a model to order and tune the images the user already picked.
 *
 * The model does not choose the pictures: `imageIds` is the whole world it is
 * shown, and the server refuses an id from outside it rather than substituting
 * the nearest one. This function's job is the transport — the credentials, and
 * telling a proposal that did not happen apart from a request that failed.
 *
 * A 200 carrying `timeline: null` RESOLVES. The proposal is an offer, and an
 * offer nobody could make is not an error the user committed: the manual editor
 * they opened the panel with is still there, still filled in, and a thrown error
 * would draw a red banner over a feature that is working (invariant Q1). The
 * four refusals that really are about the request — no access, an empty brief,
 * an empty selection, images that left the library — keep throwing, because each
 * one sends the person somewhere different and the panel already names them.
 */
export async function proposeVideoTimeline(
  brief: string,
  imageIds: string[],
  opts: {
    settings?: Settings
    theme?: VideoTheme | null
    /**
     * The composition the panel's selector is on. Omitted on `auto`.
     *
     * A hint that narrows the catalogue the model is shown to one entry, for the
     * reason an empty selection already narrows it: the form the answer lands in
     * has that composition's fields, so a proposal in another one is a call
     * spent on a document the panel would refuse. The server still decides — it
     * matches this against its own enum, and a proposal that names something
     * else is refused rather than loaded.
     */
    template?: VideoTemplate
    /**
     * The panel's 3D button. An ambition, never a permission.
     *
     * It changes what the catalogue INSISTS on — the prompt gains a paragraph
     * requiring at least one set piece drawn in 3D — and it is refused with a
     * 403 for an account the config does not allow, rather than quietly composed
     * flat. That refusal is the reason this is not simply hidden: a button that
     * silently does nothing is what gets filed as "3D is broken".
     *
     * Absent when false rather than sent as `false`, like `template` above: the
     * route reads `=== true`, and a body that carries only what was asked for is
     * one an older server ignores rather than misreads.
     */
    forceThreeD?: boolean
    /**
     * What the film is FOR — a hero, a background, a globe — out of the enum
     * `GET /api/video/status` publishes as `motionKinds`.
     *
     * A DOORWAY into the catalogue and not a template: it narrows which blocks
     * the model is shown, pins the ratio and the scene window, and nothing
     * downstream ever learns it existed — what comes back is an ordinary
     * `composed` document. That is why it is a hint and the server still owns
     * the enum: a name this build does not offer comes back as a proposal that
     * did not happen, with a notice naming every name that would have worked.
     *
     * Typed as a plain string on purpose. The list lives in `server/video/
     * kinds.js` and is read off /status, so a union retyped here would be the
     * sixth hand-kept mirror in a feature that has been bitten by five.
     */
    motionKind?: string
    /**
     * The project's art direction, in its own words — `directionBriefFrom`.
     *
     * NOT the theme, and it does not become one. The theme is four colours and
     * a font, it is attached by the server after the model's answer has been
     * validated, and nothing of it reaches a prompt; this is prose, it travels
     * in the user turn as data (Q5), and it decides what gets COMPOSED. Strip
     * the colours out of two films and the direction is the only thing left
     * that tells them apart.
     */
    direction?: string
    signal?: AbortSignal
  } = {},
): Promise<VideoProposal> {
  const s = opts.settings ?? loadSettings()
  const { res, body } = await call('/api/video/compose', {
    method: 'POST',
    // The provider settings live in this browser (ADR D7), so the call carries
    // them: the base URL and the key as headers, the model name in the BODY —
    // `credsFromReq` reads the body first, and a route sending only the header
    // is how the SEO deep pass spent a release reporting "no model configured"
    // on an instance whose model picker was plainly set.
    headers: proxyHeaders(s),
    /*
     * `theme` travels here for the same reason it travels to /render: the
     * direction lives in a project the server keeps as an opaque blob, so this
     * browser is the only party that can read it. It is never shown to the
     * model — the server attaches it to the document the model's answer became,
     * after that answer has been validated — and a composer that wrote its own
     * was refused before this key was ever looked at.
     */
    body: JSON.stringify({
      brief,
      images: imageIds,
      model: s.model,
      theme: opts.theme ?? undefined,
      template: opts.template ?? undefined,
      forceThreeD: opts.forceThreeD ? true : undefined,
      motionKind: opts.motionKind || undefined,
      direction: opts.direction || undefined,
    }),
    signal: opts.signal,
  })

  if (!res.ok) {
    const status = res.status
    /*
     * A 403 here is a permission that moved under the panel, and — unlike
     * /render's — the answer does not say WHICH: this door refuses a request for
     * 3D before any document exists, so it has no block list to send, and the
     * route uses one status for "Motion is off" and "3D is off".
     *
     * It is deliberately not guessed from the fact that `forceThreeD` was sent.
     * The panel re-reads /status instead — that answer is a fact rather than an
     * inference, and it also takes the offending button off the screen, which a
     * better-worded banner would not have done.
     */
    if (status === 403) throw new VideoExportError('no-access', said(body, 'Not enabled for this account.'), { status })
    if (status === 400) throw new VideoExportError('invalid', said(body, 'The request was refused.'), { status })
    if (status === 404) {
      throw new VideoExportError('missing-images', said(body, 'Some images are gone.'), {
        status,
        missingImageIds: idsIn(body?.missingImageIds),
      })
    }
    if (status === 409) {
      throw new VideoExportError('pending-images', said(body, 'Some images are still awaiting confirmation.'), {
        status,
        pendingImageIds: idsIn(body?.pendingImageIds),
      })
    }
    throw new VideoExportError('http', said(body, `HTTP ${status}`), { status })
  }

  const notices: string[] = Array.isArray(body?.notices) ? body.notices.filter((n: unknown) => typeof n === 'string') : []
  if (body?.timeline == null) {
    /*
     * A 200 with no timeline and not a word about why is the one answer this
     * function must not pass on as it stands.
     *
     * The route never produces it — every exit that yields no timeline goes
     * through `refuse()`, which carries a sentence. So reaching here means the
     * answer did not come from the route: something in front of it returned its
     * own 200 (a reverse proxy, a maintenance page), or the server predates
     * /compose. Left alone the button would spin, stop, and change nothing
     * visible anywhere on the panel — degrading is allowed, degrading in
     * silence is exactly what Q1 forbids.
     */
    return {
      timeline: null,
      notices: notices.length
        ? notices
        : ['Nothing came back from the composer, and no reason with it. Compose the timeline by hand, or ask again.'],
    }
  }

  /*
   * Parsed again here, and this is not distrust of the server — it is the one
   * check that can see the two schemas disagree.
   *
   * `server/video/timeline.js` mirrors `timeline.ts` by hand because Node cannot
   * import the TypeScript one, and a corpus test keeps them level. If they ever
   * drift anyway, the failure without this parse is silent and late: the form
   * fills with a document this browser would refuse, the user tunes it, and the
   * refusal arrives from POST /render as if they had composed it themselves.
   * Refused here it is a notice on the panel that just proposed it, and the
   * timeline they already had is untouched — nothing is repaired into shape.
   *
   * `RenderTimelineSchema`, because this document has been through
   * `attachTheme`: it is the same catalogue with the one key the server is
   * allowed to write. The strictness that matters — the model may not invent a
   * theme — was enforced server-side by `VideoTimelineSchema`, before the
   * attachment; re-applying it here would refuse the server's own contribution.
   */
  const parsed = RenderTimelineSchema.safeParse(body.timeline)
  if (parsed.success) return { timeline: parsed.data, notices }
  const issues = readableIssues(parsed.error)
  const shown = issues.slice(0, DRIFT_ISSUES_SHOWN)
  return {
    timeline: null,
    notices: [
      ...notices,
      ...(shown.length
        ? shown.map(
            (i) => `The proposal was refused before it reached the form${i.path ? ` at ${i.path}` : ''}: ${i.message}`,
          )
        : ['The proposal was refused before it reached the form.']),
      // Announced, never silent. `compose.js` says the same thing about its own
      // list, and a report trimmed without saying so reads as the whole story —
      // which is how "two things are wrong" becomes the reason nobody looked
      // for the other seven.
      ...(issues.length > shown.length
        ? [`…and ${issues.length - shown.length} more problems with the same document.`]
        : []),
    ],
  }
}

/** One variant, as it comes back. `meta` is the library entry, minus `owners`. */
export interface VariantImage {
  hash: string
  url: string
  /** Which axis was moved — 'angle', 'light', or a pair joined with '+'. */
  axis: string
  fromCache: boolean
  meta?: { hash: string; prompt: string; pending?: boolean }
}

export interface VariantBatch {
  /**
   * What actually happened, and the field this whole path exists to publish.
   *
   * `true` — the pictures were made FROM the user's image, by an image-to-image
   * provider. `false` — no 'edit' profile is configured, so they are siblings
   * born of the same sentence: of the same subject, not of the same picture.
   * Reported after the fact because it is the only account that cannot be wrong;
   * `VideoAccess.variantsDerived` promises it beforehand, and if the two ever
   * disagree this one is what happened.
   */
  derived: boolean
  images: VariantImage[]
  /** The server's own sentences, one per axis that failed. English, verbatim. */
  notices: string[]
}

/**
 * Several takes on one image the user already has.
 *
 * Up to six provider calls, so the signal is not optional in spirit even though
 * it is in the signature: the route stops the series when the socket closes, and
 * the only thing that closes it is this fetch being aborted.
 *
 * A batch that came back short still RESOLVES, with the notices saying which
 * axis died — one provider hiccup out of six is a degradation, not a failure of
 * the request (Q1). Nothing at all is a 502 and throws, because a success
 * message over six failed calls would be the lie the notices exist to prevent.
 */
export async function requestVariants(
  imageId: string,
  count: number,
  opts: { project?: string; signal?: AbortSignal } = {},
): Promise<VariantBatch> {
  const { res, body } = await call('/api/video/variants', {
    method: 'POST',
    body: JSON.stringify({ imageId, count, project: opts.project }),
    signal: opts.signal,
  })

  if (!res.ok) {
    const status = res.status
    if (status === 403) throw new VideoExportError('no-access', said(body, 'Not enabled for this account.'), { status })
    if (status === 400) throw new VideoExportError('invalid', said(body, 'The request was refused.'), { status })
    if (status === 404) {
      throw new VideoExportError('missing-images', said(body, 'That image is gone.'), {
        status,
        missingImageIds: [imageId],
      })
    }
    // 503: no image provider at all. Its own code because no different request
    // fixes it — it is a thing an administrator has to configure.
    if (status === 503) throw new VideoExportError('no-provider', said(body, 'No image provider.'), { status })
    if (status === 507) throw new VideoExportError('quota', said(body, 'No room left on the volume.'), { status })
    // 502 lands here: every provider call failed. The route sends one notice per
    // failed axis, and those sentences carry the provider's own words — a 422
    // naming the field it did not recognise, a key it refused. Without them the
    // panel can only say that nothing came back, which is the one thing the user
    // already knows.
    throw new VideoExportError('http', said(body, `HTTP ${status}`), {
      status,
      notices: idsIn((body as { notices?: unknown })?.notices),
    })
  }

  return {
    /*
     * A plain boolean here, unlike `VideoAccess.variantsDerived` next door,
     * which keeps `undefined` as its own answer.
     *
     * The asymmetry is about who can be silent. /status is quoted by panels that
     * have to work against a server predating this feature, so "said nothing" is
     * a real third state there. This route is not: a server that answers 200 to
     * /api/video/variants at all is a server that computes `derived` on both
     * paths and always sends it. So a missing field is a malformed body rather
     * than an old instance, and `false` — "these are siblings, they never saw
     * your picture" — is the reading that cannot overclaim.
     */
    derived: body?.derived === true,
    images: Array.isArray(body?.images) ? (body.images as VariantImage[]) : [],
    notices: Array.isArray(body?.notices) ? body.notices.filter((n: unknown) => typeof n === 'string') : [],
  }
}

export async function fetchVideoJob(id: string, signal?: AbortSignal): Promise<VideoJob> {
  const { res, body } = await call(`/api/video/jobs/${encodeURIComponent(id)}`, { signal })
  if (res.ok) return body as VideoJob
  // 404 is reachable without anything being wrong: the journal keeps the newest
  // fifty finished jobs, and a restart marks whatever was in flight as failed
  // and eventually ages it out. "We no longer know" is the honest reading.
  if (res.status === 404) throw new VideoExportError('not-found', said(body, 'No such render job.'), { status: 404 })
  if (res.status === 403) throw new VideoExportError('no-access', said(body, 'Not your render job.'), { status: 403 })
  throw new VideoExportError('http', said(body, `HTTP ${res.status}`), { status: res.status })
}

/** How often a job is asked about while it is live. */
export const POLL_INTERVAL_MS = 2000

/**
 * How long past the render ceiling the browser keeps asking before it says so.
 *
 * The server bounds a render at `JOB_TIMEOUT_MS` and then marks the job failed,
 * so in the ordinary case the job's own error arrives first and this never
 * fires. What it covers is the case that produces no job at all: the container
 * went away mid-render, the process was killed, the answer stopped coming. The
 * margin is what separates "the server is about to tell us it gave up" from
 * "the server has stopped talking", and only the second deserves its own words.
 */
export const POLL_GRACE_MS = 30_000

/**
 * Has the browser waited long enough to say the render stopped answering?
 *
 * `renderingSince` is null until a poll actually reports `rendering`, and that
 * is the load-bearing part: a job waiting behind another one is behaving
 * exactly as the queue was designed to behave — concurrency is one — and a
 * deadline that started at `enqueue` would abandon renders that had not begun.
 *
 * The browser's own clock, never the job's `startedAt`. The two machines do not
 * agree, and a laptop a few minutes behind its server would compute a deadline
 * already in the past and give up on the very first poll.
 */
export function pollDeadlinePassed(renderingSince: number | null, now: number, budgetMs: number): boolean {
  if (renderingSince === null) return false
  return now - renderingSince > budgetMs + POLL_GRACE_MS
}

/**
 * Where the finished file is. Content-addressed, like every other stored blob.
 *
 * A plain URL for a plain `<a download>`: the route sets
 * `Content-Disposition: attachment` with a name built from a closed set, so
 * fetching the bytes into a Blob only to hand them back to the browser would
 * buy a second copy of a 40 MB file in memory and nothing else.
 */
export function videoDownloadUrl(hash: string): string {
  return `/api/video/${hash}?download=1`
}

/**
 * The same bytes, for a `<video src>` rather than for a save dialog.
 *
 * Its own function, and not `videoDownloadUrl` reused, because the difference is
 * the whole point: without `?download=1` the route answers inline and honours
 * Range requests, so the player can seek. With it, the browser is being told to
 * put the film in the downloads folder — which is what a play button must not
 * do.
 */
export function videoStreamUrl(hash: string): string {
  return `/api/video/${hash}`
}

/**
 * One finished film, as its owner sees it in the Media tab.
 *
 * Mirrors the metadata `VideoExportStore.put` writes, minus `owners` — the
 * listing route strips it exactly as the image library's does, because the field
 * holds account ids and `publicUser()` deliberately withholds those.
 *
 * `projects` is a LIST, and reading it as one is not pedantry: the store is
 * content-addressed, so two projects that composed the same film share one entry
 * and both are named on it.
 */
export interface VideoExport {
  hash: string
  bytes: number
  container: string
  mime: string
  scenes: number
  durationMs: number
  aspectRatio: string
  projects: string[]
  createdAt: number
}

/**
 * Every film this account has rendered.
 *
 * Owned films only, and that is the server's rule rather than this function's: a
 * request without a project asks for all of them, never for everybody's. There
 * is no parameter here that widens the answer.
 *
 * It throws like the rest of this module rather than resolving empty, because
 * the Media tab has to be able to tell "you have exported nothing" apart from
 * "the backend did not answer" — those are the same empty grid and they mean
 * opposite things.
 */
export async function listVideoExports(
  opts: { project?: string; signal?: AbortSignal } = {},
): Promise<VideoExport[]> {
  const q = opts.project ? `?project=${encodeURIComponent(opts.project)}` : ''
  const { res, body } = await call(`/api/video/exports${q}`, { signal: opts.signal })
  if (!res.ok) throw new VideoExportError('http', said(body, `HTTP ${res.status}`), { status: res.status })
  return Array.isArray(body?.videos) ? (body.videos as VideoExport[]) : []
}

/**
 * Delete one film. The only thing that removes the file (M8).
 *
 * `wasUsedBy` names the projects that were still pointing at it, so the
 * interface can say what it just took away — the same courtesy
 * `DELETE /api/images/:hash` pays.
 */
export async function deleteVideoExport(hash: string): Promise<{ removed: boolean; wasUsedBy: string[] }> {
  const { res, body } = await call(`/api/video/${encodeURIComponent(hash)}`, { method: 'DELETE' })
  if (!res.ok) {
    const status = res.status
    if (status === 403) throw new VideoExportError('no-access', said(body, 'Not your render.'), { status })
    if (status === 404) throw new VideoExportError('not-found', said(body, 'No longer stored.'), { status })
    throw new VideoExportError('http', said(body, `HTTP ${status}`), { status })
  }
  return { removed: body?.removed === true, wasUsedBy: idsIn(body?.wasUsedBy) }
}
