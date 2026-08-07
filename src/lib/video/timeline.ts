// The video-export data contract, shared by the browser, the server queue and
// the Remotion worker.
//
// The founding rule of the feature is that the model NEVER writes Remotion
// code: it writes one JSON object, validated here, and hand-written
// compositions consume it. Everything below follows from that. This schema is
// the entire surface the model is allowed to reach, so anything it can express
// has to be something a composition already knows how to render — and anything
// it cannot express is unreachable, not merely discouraged.
import { z } from 'zod'

/** Scene count and per-scene bounds. Exported: the UI and the prompt both quote them. */
export const MAX_SCENES = 20
export const MIN_SCENE_DURATION_MS = 1000
export const MAX_SCENE_DURATION_MS = 15000

/**
 * The whole-timeline ceiling, and the reason the refinement at the bottom
 * exists: 20 scenes × 15 s is 300 s, so the per-scene bounds alone permit a
 * five-minute render. A render is minutes of CPU on a worker nobody is
 * watching, which is exactly the kind of cost that should be refused at
 * validation rather than discovered at the end of the queue.
 */
export const MAX_TOTAL_DURATION_MS = 120000

export const KEN_BURNS = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'static'] as const
export const TRANSITIONS = ['crossfade', 'wipe-left', 'wipe-right', 'none'] as const
export const OVERLAY_POSITIONS = ['top', 'center', 'bottom'] as const
export const OUTPUT_FORMATS = ['mp4', 'webm'] as const
export const ASPECT_RATIOS = ['16:9', '9:16', '1:1'] as const

/** The image-library address: a SHA-256, lower-case, exactly as `digest('hex')` writes it. */
const IMAGE_ID = /^[0-9a-f]{64}$/

export const TextOverlaySchema = z
  .object({
    // 120 characters is a legibility limit, not a storage one: an overlay is
    // burnt into the frame at a fixed size, and a paragraph rendered there is
    // unreadable at any aspect ratio.
    content: z.string().min(1).max(120),
    position: z.enum(OVERLAY_POSITIONS),
  })
  .strict()

export const SceneSchema = z
  .object({
    /**
     * An identifier into Mocky's image library, never a location. M2 forbids
     * storing or displaying a third-party image and M8 makes the content hash
     * the identity of a stored one; accepting a URL here would hand the model a
     * way to pull remote bytes into a file Mocky then hosts as its own.
     *
     * Lower-case only. `data/image-library/{hash}` is a path, so `AB…` and
     * `ab…` would be two names for one file on a case-sensitive volume and one
     * file with two spellings elsewhere — a lookup miss that only reproduces on
     * Linux is not worth the tolerance.
     */
    imageId: z.string().regex(IMAGE_ID, 'imageId must be a 64-character lower-case SHA-256 from the image library, not a URL'),
    durationMs: z.number().int().min(MIN_SCENE_DURATION_MS).max(MAX_SCENE_DURATION_MS),
    kenBurns: z.enum(KEN_BURNS).default('static'),
    transitionOut: z.enum(TRANSITIONS).default('crossfade'),
    // Absent and explicitly null mean the same thing — no overlay — because the
    // model writes this object and asking it to spell out `"textOverlay": null`
    // on every silent scene buys nothing but a retry.
    textOverlay: TextOverlaySchema.nullable().default(null),
  })
  .strict()

export const VideoTimelineSchema = z
  .object({
    scenes: z.array(SceneSchema).min(1).max(MAX_SCENES),
    outputFormat: z.enum(OUTPUT_FORMATS).default('mp4'),
    aspectRatio: z.enum(ASPECT_RATIOS).default('16:9'),
  })
  // `.strict()` here and on every nested object is the load-bearing part. An
  // unknown key is how a field the compositions do not read gets accepted in
  // silence: the model asks for an audio track, or an `src`, validation passes,
  // the render ignores it, and the user is told the export succeeded while
  // watching something it did not ask for. There is no audio, and a schema that
  // strips unknown keys cannot say so.
  .strict()
  .superRefine((timeline, ctx) => {
    const total = timeline.scenes.reduce((sum, scene) => sum + scene.durationMs, 0)
    if (total > MAX_TOTAL_DURATION_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scenes'],
        message:
          `Total duration is ${total} ms; the maximum is ${MAX_TOTAL_DURATION_MS} ms ` +
          `(${MAX_TOTAL_DURATION_MS / 1000} seconds). Shorten or remove scenes.`,
      })
    }
  })

/**
 * No repair, ever. There is no `clampScene`, no truncation of a 200-character
 * overlay, no dropping of the twenty-first scene — a rejection is a rejection,
 * and the caller retries with the message.
 *
 * The temptation is real, because every one of those repairs turns a failed
 * model call into a shipped video. It is also exactly the hole this schema was
 * written to close: a repaired document is one nobody validated. Clamping a 40 s
 * scene to 15 s does not produce the video that was asked for, it produces a
 * different one that happens to be legal, and the user has no way to tell which
 * they are looking at. Worse, repair is where the total-duration rule dies: fix
 * each scene independently and twenty of them still add up to five minutes.
 */
export type TextOverlay = z.infer<typeof TextOverlaySchema>
export type Scene = z.infer<typeof SceneSchema>
export type VideoTimeline = z.infer<typeof VideoTimelineSchema>

/** What a caller may hand in — defaults not yet applied. */
export type VideoTimelineInput = z.input<typeof VideoTimelineSchema>

export type KenBurns = (typeof KEN_BURNS)[number]
export type Transition = (typeof TRANSITIONS)[number]
export type OverlayPosition = (typeof OVERLAY_POSITIONS)[number]
export type OutputFormat = (typeof OUTPUT_FORMATS)[number]
export type AspectRatio = (typeof ASPECT_RATIOS)[number]

/** Sum of the scene durations, in ms. The render budget, and what the UI shows. */
export function totalDurationMs(timeline: Pick<VideoTimeline, 'scenes'>): number {
  return timeline.scenes.reduce((sum, scene) => sum + scene.durationMs, 0)
}
