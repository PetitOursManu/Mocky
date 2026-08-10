// What the panel holds while somebody is still describing a film.
//
// ── Why this module is half of what it was ───────────────────────────────────
//
// It used to be a scene editor: one flat record per scene carrying every field
// of five compositions, an "add", a "move up", a duration slider per row, and a
// selector deciding which of the five was being typed in. All of that is gone,
// and not because it was tedious to keep — because it was the wrong question.
// Picking one of five layouts and then dialling twenty rows of parameters is
// what made every export look like the same five exports. The model now writes
// the whole document, blocks and all, and what is left for a person to say is
// the only part a model cannot know: what the film is about, which pictures it
// may use, and what comes out of it.
//
// Everything here is pure, which is the point: the dialog is untestable in this
// repository (no DOM, no testing-library), so the arithmetic that decides
// whether a button is live has to live somewhere a test can reach it.
//
// ── What survives is the READING half ────────────────────────────────────────
//
// A timeline document arrives from two places the panel does not author: the
// composer's answer, and a job restored from the queue's journal when the panel
// is reopened on a render that is still going. Both have to stay legible —
// their duration is what the poll deadline is computed from, their pictures are
// what the definition warning is measured on, and their scene count is the one
// honest sentence the panel can say about a film nobody is being shown the
// insides of. A document this panel can no longer open is silent lost work,
// which is exactly why the reading functions below take a whole timeline of ANY
// template, including the two nobody can type in (`composed`) and the ones from
// before the catalogue existed (no `template` at all).
import {
  MAX_SCENES,
  timelineImageIds,
  totalDurationMs,
  type AspectRatio,
  type KenBurns,
  type OutputFormat,
  type RenderTimeline,
  type VideoTimeline,
  type VideoTimelineInput,
} from './timeline'

/**
 * How many pictures may be offered to the composer.
 *
 * The widest cap in the catalogue, and not a number of its own: `compose.js`
 * refuses a larger selection outright — twenty-five images have no valid
 * timeline in any composition — and a panel that let people pick past it would
 * spend a round trip to learn that.
 *
 * Pictures are no longer scenes, and the two numbers only look alike. A composed
 * scene can carry six of them in one gallery, and a film of words carries none;
 * this is the size of the POOL the model draws from, not the length of anything.
 */
export const IMAGE_CAP = MAX_SCENES

/**
 * A proposal, with the request it answered.
 *
 * The brief and the selection are kept beside the document for one reason:
 * editing either of them afterwards leaves a film on the panel that no longer
 * matches the sentence above it, and nothing else could tell. It is a REMARK and
 * never a refusal — see `proposalStale` — because throwing a model's answer away
 * on a keystroke is the one thing worse than keeping a stale one.
 *
 * A `RenderTimeline` and not a `VideoTimeline`: the composer's answer comes back
 * with the theme the SERVER attached to it, after validating the model's
 * document. The panel neither writes nor reads that key — `toRenderInput` drops
 * it — but a type that refused it would refuse every themed proposal.
 */
export interface Proposal {
  timeline: RenderTimeline
  /** The brief it was composed from. Trimmed, as it was sent. */
  brief: string
  /** The pictures it was offered, in the order they were picked. */
  imageIds: string[]
  /**
   * Whether the 3D button was down when this film was asked for.
   *
   * Part of the REQUEST and therefore part of what makes a proposal stale, for
   * the same reason the brief is: pressing 3D after a film has come back leaves
   * a flat film on the panel answering a question nobody is asking any more, and
   * nothing else on screen could tell. It is not part of the DOCUMENT — the
   * schema has no such field, the model was told about it in prose, and what
   * actually came back is whichever blocks it composed.
   */
  forceThreeD: boolean
}

/**
 * The panel's whole state, minus the network.
 *
 * Four things a person decides and one thing a model answered. There is no
 * `template` here and no scene: the composition is the model's to choose, which
 * is the change this whole file exists to record.
 */
export interface VideoDraft {
  /** What the film is about. The one required field on the panel. */
  brief: string
  /**
   * The pictures the film may use — optional, and deduplicated.
   *
   * A pool rather than a running order. The model is given this list and orders
   * it, crops it, groups it into a gallery or ignores it; picking the same
   * picture twice would say nothing it does not already say, so `addImage` is
   * idempotent where `addScene` deliberately was not.
   */
  imageIds: string[]
  aspectRatio: AspectRatio
  outputFormat: OutputFormat
  /**
   * The 3D button: an ambition, never a permission.
   *
   * It lives in the draft rather than in the component beside `fill`, because
   * unlike "where a picture comes from" it is part of the request the composer
   * answers — `/compose` reads it, it changes what the catalogue insists on, and
   * `proposalStale` has to be able to see it move.
   *
   * What it is NOT is the account's right to spend a 3D render. That is
   * `VideoAccess.threeD`, which the server computes and re-checks on both doors;
   * `forcedThreeD` below is the only thing that puts the two together, so a
   * draft carrying `true` on an account that has since lost the permission never
   * becomes a request that gets a 403.
   */
  forceThreeD: boolean
  /** The last thing the composer answered, or nothing yet. */
  proposal: Proposal | null
}

export function emptyDraft(): VideoDraft {
  return {
    brief: '',
    imageIds: [],
    aspectRatio: '16:9',
    outputFormat: 'mp4',
    forceThreeD: false,
    proposal: null,
  }
}

export function setBrief(draft: VideoDraft, brief: string): VideoDraft {
  return { ...draft, brief }
}

export function setForceThreeD(draft: VideoDraft, forceThreeD: boolean): VideoDraft {
  return { ...draft, forceThreeD }
}

/**
 * What the compose call may actually ask for.
 *
 * The permission wins over the button, and it is written here rather than at the
 * call site so that a stale draft cannot spend a round trip learning it. The
 * panel only draws the button when the account has the right, so this normally
 * changes nothing — the case it covers is an administrator narrowing the setting
 * while a panel is open, which is precisely when the button is still on screen
 * and the answer is already 403.
 *
 * `=== true` rather than a truthy read, matching the route: /status may answer
 * nothing at all on an instance that predates the field, and "said nothing" is
 * not "yes".
 */
export function forcedThreeD(draft: VideoDraft, allowed: boolean | undefined | null): boolean {
  return allowed === true && draft.forceThreeD
}

/** One picture into the pool. Refused past the cap, and never twice. */
export function addImage(draft: VideoDraft, imageId: string): VideoDraft {
  if (!imageId || draft.imageIds.includes(imageId)) return draft
  if (draft.imageIds.length >= IMAGE_CAP) return draft
  return { ...draft, imageIds: [...draft.imageIds, imageId] }
}

/**
 * Several at once — what the variant flow hands back after its second gate.
 *
 * Folded one at a time rather than concatenated, so the cap and the
 * deduplication apply to each: a batch that overflows the pool adds what fits
 * and stops, which is what the flow's own "room" sentence promised.
 */
export function addImages(draft: VideoDraft, imageIds: readonly string[]): VideoDraft {
  return imageIds.reduce(addImage, draft)
}

export function removeImage(draft: VideoDraft, imageId: string): VideoDraft {
  return { ...draft, imageIds: draft.imageIds.filter((id) => id !== imageId) }
}

export function setAspectRatio(draft: VideoDraft, aspectRatio: AspectRatio): VideoDraft {
  return { ...draft, aspectRatio }
}

export function setOutputFormat(draft: VideoDraft, outputFormat: OutputFormat): VideoDraft {
  return { ...draft, outputFormat }
}

/**
 * Record what the composer answered.
 *
 * The brief is trimmed here and nowhere else, so that `proposalStale` compares
 * what was SENT against what is typed — a trailing space added afterwards is not
 * a changed request, and reporting it as one would make the notice noise.
 */
export function withProposal(draft: VideoDraft, timeline: RenderTimeline, forceThreeD: boolean): VideoDraft {
  return {
    ...draft,
    proposal: {
      timeline,
      brief: draft.brief.trim(),
      imageIds: [...draft.imageIds],
      // What was really ASKED FOR — `forcedThreeD(draft, access.threeD)` — and
      // not the button's position. The two agree in every ordinary case, and the
      // one where they do not is a permission withdrawn while the panel is open:
      // recording the button there would leave a film that was composed flat,
      // by a request that never carried the flag, marked stale for ever against
      // a control the panel has just taken away.
      forceThreeD,
    },
  }
}

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i])

/**
 * Has the request moved on since the film was proposed?
 *
 * A remark, never a blocker. The proposal is still a valid film and rendering it
 * is still allowed — what would be dishonest is a panel showing a sentence and a
 * selection that had nothing to do with the thing about to cost two minutes of
 * somebody's CPU.
 */
export function proposalStale(draft: VideoDraft): boolean {
  const proposal = draft.proposal
  if (!proposal) return false
  return (
    draft.brief.trim() !== proposal.brief ||
    !sameIds(draft.imageIds, proposal.imageIds) ||
    // Pressing 3D after a film has come back is a changed request, exactly like
    // adding a picture: the catalogue the model would be shown is a different
    // one. It stays a remark rather than a refusal — the flat film on the panel
    // is still a renderable film, and taking it away for a button press would be
    // the recourse costing more than the thing it is a recourse for.
    draft.forceThreeD !== proposal.forceThreeD
  )
}

/**
 * Why "Propose a film" will not fire. One reason, and it is not the pictures.
 *
 * The picture gate is gone on purpose. It existed when the form was a slideshow
 * and a montage was built FROM a selection; a composed film can be words, shapes
 * and movement on a background with no photograph anywhere in it, so demanding
 * an image first would close the door on the very films the blocks were added
 * for. `compose.js` decides what it can offer against an empty selection.
 */
export type ComposeBlocker = 'no-brief'

export function composeBlocker(draft: VideoDraft): ComposeBlocker | null {
  return draft.brief.trim() ? null : 'no-brief'
}

/**
 * Why "Start the render" will not fire.
 *
 * One reason as well, and it is the whole shape of the new panel: there is no
 * timeline until a model has written one. Every other refusal this list used to
 * carry — an empty scene, a missing headline, a film over the ceiling — was a
 * form's way of catching a document it had built badly. The document is now
 * built by a composer and validated by the schema at both ends before it ever
 * gets here.
 */
export type RenderBlocker = 'no-proposal'

export function renderBlocker(draft: VideoDraft): RenderBlocker | null {
  return draft.proposal ? null : 'no-proposal'
}

/**
 * The ratio the film will really be rendered at, which is not always the one on
 * the selector.
 *
 * The panel's ratio wins, because a control that changes nothing is worse than
 * no control — with one exception the schema makes for us: `VerticalTimelineSchema`
 * types `aspectRatio` as the literal `9:16`, so forcing 16:9 onto a vertical cut
 * would not produce a wide film, it would produce a refused document and an
 * error banner over a proposal that was fine. So the film keeps its own ratio
 * there and the panel SAYS so, rather than pretending the selector applied.
 */
export function effectiveAspectRatio(draft: VideoDraft): AspectRatio | null {
  const timeline = draft.proposal?.timeline
  if (!timeline) return null
  return timeline.template === 'vertical' ? '9:16' : draft.aspectRatio
}

/** Whether the selector's ratio had to give way to the film's own. */
export function aspectRatioOverridden(draft: VideoDraft): boolean {
  const effective = effectiveAspectRatio(draft)
  return effective !== null && effective !== draft.aspectRatio
}

/**
 * The proposal as something `/render` will look at — or `null`.
 *
 * Two things happen to the document on the way out, and both are about who owns
 * which key.
 *
 * **`theme` is dropped.** It is not the model's to write and not this panel's to
 * send: `VideoTimelineSchema` has no such key and would refuse the whole
 * document for it, exactly as it refuses an `audio` track. The server attaches
 * it again on the other side, after validating, from the direction this browser
 * hands it separately.
 *
 * **The output settings are the panel's.** They are the two things the composer
 * was never told — `/compose` carries a brief, pictures and a theme, and nothing
 * about the frame — so a container or a ratio it happened to write is a default,
 * not an intention, and a selector that lost to a default would be decoration.
 *
 * The cast at the end is doing no work the schema does not redo: the document
 * has already been through `RenderTimelineSchema` in the client, and
 * `startVideoRender` parses it again with `VideoTimelineSchema` before it is
 * sent. A mistake here is a refusal at the click, never a bad film.
 */
export function toRenderInput(draft: VideoDraft): VideoTimelineInput | null {
  const timeline = draft.proposal?.timeline
  if (!timeline) return null
  const document: Record<string, unknown> = { ...timeline }
  delete document.theme
  document.outputFormat = draft.outputFormat
  document.aspectRatio = effectiveAspectRatio(draft)
  return document as VideoTimelineInput
}

/**
 * The one sentence the panel is allowed to say about a film it is not showing.
 *
 * Read off the document, never written by a model. The user asked not to see the
 * scenes and their settings, and that is honoured — but a plan nobody can see
 * and nobody can refuse is a plan people submit to. How many shots, how long,
 * what shape: enough to know whether the thing about to be rendered is the thing
 * that was asked for, and not one word about how it is laid out.
 */
export interface FilmSummary {
  scenes: number
  durationMs: number
  aspectRatio: AspectRatio
}

export function filmSummary(draft: VideoDraft): FilmSummary | null {
  const timeline = draft.proposal?.timeline
  const aspectRatio = effectiveAspectRatio(draft)
  if (!timeline || !aspectRatio) return null
  return { scenes: timeline.scenes.length, durationMs: totalDurationMs(timeline), aspectRatio }
}

/**
 * How long a film lasts — including one this panel did not compose.
 *
 * The poll deadline is computed from it, and the case that matters is a panel
 * reopened on a render started before it was closed: there is no proposal in
 * this browser then, only the job's own timeline out of the queue's journal.
 * Answering 0 for it would give the shortest possible deadline to the longest
 * film somebody has, and declare a healthy render dead.
 */
export function filmDurationMs(timeline: { scenes: ReadonlyArray<{ durationMs: number }> } | null | undefined): number {
  return timeline ? totalDurationMs(timeline) : 0
}

/**
 * Every picture a film paints, as the definition warning needs them.
 *
 * `undersizedScenes` asks for `{ imageId, kenBurns }` because it was written
 * against the five compositions where a scene IS a picture. A composed scene is
 * not: its photographs are on the background when the ground is one, and inside
 * `imageFrame`, `gallery` and `carousel` blocks anywhere in the stack — which is
 * what `timelineImageIds` already walks, and what a hand-written loop over
 * `scene.imageId` would have missed entirely, reporting a film of six enlarged
 * pictures as a film with nothing to say about.
 *
 * `static` for those, and it under-reports rather than guesses: the overscale of
 * a composed scene is the composition's business and `motionOverscale` reports
 * the floor for it. A warning that cries wolf is one people learn to dismiss,
 * including the time it was right.
 */
export function pictureScenes(
  // Both documents, because both arrive here: a proposal carries the server's
  // theme and a job's timeline does not, and a signature that took one of them
  // would send the other through a cast at the call site.
  timeline: VideoTimeline | RenderTimeline,
): { imageId: string; kenBurns: KenBurns }[] {
  if (timeline.template === 'composed') {
    return timelineImageIds(timeline).map((imageId) => ({ imageId, kenBurns: 'static' as KenBurns }))
  }
  return timeline.scenes.map((scene) => ({
    // A title card carries no picture at all, and `undersizedScenes` skips an
    // empty id — which is the honest answer for a scene that paints none.
    imageId: 'imageId' in scene ? scene.imageId : '',
    kenBurns: 'kenBurns' in scene ? scene.kenBurns : ('static' as KenBurns),
  }))
}

/**
 * Seconds, in the reader's language.
 *
 * One decimal always, so "4,0 s" and "4,5 s" line up and a total does not jump a
 * character wide as it changes. The locale matters more than it looks: French
 * writes 4,5 and English 4.5, and a hard-coded dot in a French panel is the kind
 * of detail that makes a whole interface feel translated rather than written.
 */
export function formatSeconds(ms: number, lang = 'fr'): string {
  return (ms / 1000).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
