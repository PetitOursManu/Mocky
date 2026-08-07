// The timeline while somebody is still building it.
//
// `VideoTimeline` is the finished document: every scene has a duration, an
// overlay is present or absent, and the whole thing is either valid or refused.
// A form is none of those things — rows get reordered, an overlay is typed one
// character at a time, and the total crosses the ceiling on the way to a
// timeline that fits. So the editor has its own shape, and `toTimelineInput()`
// is the one place it becomes something the schema will look at.
//
// Everything here is pure, which is the point: the dialog is untestable in this
// repository (no DOM, no testing-library), so the arithmetic that decides
// whether the button is live has to live somewhere a test can reach it.
import {
  MAX_SCENES,
  MAX_TOTAL_DURATION_MS,
  MAX_SCENE_DURATION_MS,
  MIN_SCENE_DURATION_MS,
  TextOverlaySchema,
  type AspectRatio,
  type KenBurns,
  type OutputFormat,
  type OverlayPosition,
  type Transition,
  type VideoTimelineInput,
} from './timeline'

/**
 * Asked of the schema, never copied from it.
 *
 * The 120 in `TextOverlaySchema` is a legibility limit that could be revised;
 * the same number typed a second time into a `maxLength` attribute is a silent
 * disagreement waiting for that revision, and the half that loses is the form —
 * it would let a 140-character overlay be typed and the render refused.
 */
export const OVERLAY_MAX_LENGTH: number = TextOverlaySchema.shape.content.maxLength ?? 120

/**
 * What a freshly added scene lasts.
 *
 * Four seconds because twenty of them come to 80 s, comfortably under the 120 s
 * ceiling: adding a scene is never the click that makes the timeline illegal,
 * which would be a maddening thing for the "Add" button to do. Six would also
 * fit — at exactly 120 s — and would leave no room to lengthen anything.
 */
export const DEFAULT_SCENE_DURATION_MS = 4000

/**
 * The step the duration control moves in. Half a second is the smallest change
 * worth making to a slideshow beat, and it keeps `durationMs` a whole number of
 * milliseconds, which the schema requires (`z.number().int()`).
 */
export const DURATION_STEP_MS = 500

export interface DraftScene {
  /**
   * Stable across reorders, and the React key.
   *
   * Not the image id: a timeline may legitimately open and close on the same
   * picture, so image ids are not unique. Not the array index either — that is
   * what every reorder changes, and React would then keep the moved row's DOM
   * (and its focused overlay input) attached to the wrong scene.
   */
  key: string
  imageId: string
  durationMs: number
  kenBurns: KenBurns
  transitionOut: Transition
  /** '' means no overlay. `toTimelineInput` is where that becomes `null`. */
  overlayText: string
  overlayPosition: OverlayPosition
}

export interface VideoDraft {
  scenes: DraftScene[]
  aspectRatio: AspectRatio
  outputFormat: OutputFormat
}

let counter = 0
/** Unique within one page life, which is all a React key has to be. */
const newKey = () => `s${++counter}`

export function emptyDraft(): VideoDraft {
  return { scenes: [], aspectRatio: '16:9', outputFormat: 'mp4' }
}

/**
 * Append one scene.
 *
 * The motion and transition start on the schema's own defaults — `static` and
 * `crossfade` — rather than on something livelier. A hand-built timeline and a
 * model-written one that named the same images should render the same film, and
 * they would not if the form quietly opened on a zoom the schema does not
 * default to.
 */
export function addScene(draft: VideoDraft, imageId: string): VideoDraft {
  if (draft.scenes.length >= MAX_SCENES) return draft
  const scene: DraftScene = {
    key: newKey(),
    imageId,
    durationMs: DEFAULT_SCENE_DURATION_MS,
    kenBurns: 'static',
    transitionOut: 'crossfade',
    overlayText: '',
    overlayPosition: 'bottom',
  }
  return { ...draft, scenes: [...draft.scenes, scene] }
}

export function removeScene(draft: VideoDraft, key: string): VideoDraft {
  return { ...draft, scenes: draft.scenes.filter((s) => s.key !== key) }
}

export function updateScene(draft: VideoDraft, key: string, patch: Partial<Omit<DraftScene, 'key'>>): VideoDraft {
  return { ...draft, scenes: draft.scenes.map((s) => (s.key === key ? { ...s, ...patch } : s)) }
}

/**
 * Move one scene by `delta` places. Clamped at both ends, never wrapped.
 *
 * Wrapping would send "up" from the first row to the last, which reads as the
 * row having disappeared — the user looks at the top of a twenty-scene list and
 * sees a different picture there.
 */
export function moveScene(draft: VideoDraft, key: string, delta: number): VideoDraft {
  const from = draft.scenes.findIndex((s) => s.key === key)
  if (from === -1) return draft
  const to = Math.min(draft.scenes.length - 1, Math.max(0, from + delta))
  if (to === from) return draft
  const scenes = [...draft.scenes]
  const [moved] = scenes.splice(from, 1)
  scenes.splice(to, 0, moved)
  return { ...draft, scenes }
}

/**
 * Snap a duration onto the legal ladder.
 *
 * This is not the repair `timeline.ts` forbids, and the difference is which
 * document is being touched. That rule is about a timeline somebody already
 * wrote — clamping a model's 40-second scene to 15 hands back a film nobody
 * asked for and reports it as a success. This runs on the way IN, on a slider
 * that has no way to express 40 seconds in the first place, so nothing invalid
 * is ever recorded and nothing has to be corrected afterwards.
 */
export function clampDuration(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_SCENE_DURATION_MS
  const snapped = Math.round(ms / DURATION_STEP_MS) * DURATION_STEP_MS
  return Math.min(MAX_SCENE_DURATION_MS, Math.max(MIN_SCENE_DURATION_MS, snapped))
}

export function draftTotalMs(draft: VideoDraft): number {
  return draft.scenes.reduce((sum, s) => sum + s.durationMs, 0)
}

/**
 * Why the render button is off.
 *
 * A list rather than a boolean, because the panel names the reason next to the
 * disabled button: a control that will not fire and will not say why is the
 * thing this whole screen was built to avoid. Ordered from "there is nothing to
 * render" outwards, so the first entry is the one worth showing when several
 * hold at once.
 */
export type DraftBlocker = 'no-scenes' | 'too-many-scenes' | 'over-budget' | 'overlay-too-long'

export function draftBlockers(draft: VideoDraft): DraftBlocker[] {
  const out: DraftBlocker[] = []
  if (draft.scenes.length === 0) out.push('no-scenes')
  if (draft.scenes.length > MAX_SCENES) out.push('too-many-scenes')
  if (draftTotalMs(draft) > MAX_TOTAL_DURATION_MS) out.push('over-budget')
  // Reachable by paste in browsers that ignore `maxLength` on a programmatic
  // set, and by any future control that forgets the attribute. Cheap to check,
  // and the alternative is a 400 arriving after the queue accepted nothing.
  if (draft.scenes.some((s) => s.overlayText.trim().length > OVERLAY_MAX_LENGTH)) out.push('overlay-too-long')
  return out
}

/**
 * The draft as something the schema will look at.
 *
 * The overlay is the only field that changes shape: an empty box means "no
 * overlay", which the schema spells `null`, and `''` would fail `min(1)`. The
 * text is trimmed for the same reason a space-only box is not an overlay.
 */
export function toTimelineInput(draft: VideoDraft): VideoTimelineInput {
  return {
    aspectRatio: draft.aspectRatio,
    outputFormat: draft.outputFormat,
    scenes: draft.scenes.map((s) => ({
      imageId: s.imageId,
      durationMs: s.durationMs,
      kenBurns: s.kenBurns,
      transitionOut: s.transitionOut,
      textOverlay: s.overlayText.trim() ? { content: s.overlayText.trim(), position: s.overlayPosition } : null,
    })),
  }
}

/**
 * Seconds, in the reader's language.
 *
 * One decimal always, so "4,0 s" and "4,5 s" line up in a column and the total
 * does not jump a character wide every time a slider moves. The locale matters
 * more than it looks: French writes 4,5 and English 4.5, and a hard-coded dot in
 * a French panel is the kind of detail that makes a whole interface feel
 * translated rather than written.
 */
export function formatSeconds(ms: number, lang = 'fr'): string {
  return (ms / 1000).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
