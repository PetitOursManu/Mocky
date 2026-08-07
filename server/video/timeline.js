// The video-export contract, as Node can run it.
//
// The definition to READ is `src/lib/video/timeline.ts`. It carries the
// reasoning behind every bound, every `.strict()` and the refusal to repair a
// document; none of that is repeated here, because a second copy of a rationale
// is a second copy to get out of date.
//
// This file exists only because the server cannot import that one. `package.json`
// declares `"node": ">=22.12"`, and at that floor type stripping is a flagged
// experiment — `node server/index.js` throws ERR_UNKNOWN_FILE_EXTENSION on a
// `.ts` import. Making the API's only validation depend on which Node minor the
// admin happens to run is a much worse trade than one mirrored file: the failure
// mode is the server booting fine everywhere the author tested and refusing to
// start on someone else's box.
//
// The repository already does this deliberately twice — `server/images/zip.js` is
// a port of `src/lib/zip.ts`, and `server/muse/quality/audit-questions.js` mirrors
// the family ids in `src/lib/audit/rules.ts`. Both are kept honest the same way
// this one is: `timeline.test.js` imports the TypeScript original (vitest resolves
// `.ts`, unlike `node`) and requires the two to agree on a corpus of documents. A
// bound loosened on one side alone fails the suite instead of quietly accepting
// on the server what the browser refuses — or, far worse, the reverse.
import { z } from 'zod'

export const MAX_SCENES = 20
export const MIN_SCENE_DURATION_MS = 1000
export const MAX_SCENE_DURATION_MS = 15000
export const MAX_TOTAL_DURATION_MS = 120000

export const KEN_BURNS = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'static']
export const TRANSITIONS = ['crossfade', 'wipe-left', 'wipe-right', 'none']
export const OVERLAY_POSITIONS = ['top', 'center', 'bottom']
export const OUTPUT_FORMATS = ['mp4', 'webm']
export const ASPECT_RATIOS = ['16:9', '9:16', '1:1']

const IMAGE_ID = /^[0-9a-f]{64}$/

export const TextOverlaySchema = z
  .object({
    content: z.string().min(1).max(120),
    position: z.enum(OVERLAY_POSITIONS),
  })
  .strict()

export const SceneSchema = z
  .object({
    imageId: z
      .string()
      .regex(IMAGE_ID, 'imageId must be a 64-character lower-case SHA-256 from the image library, not a URL'),
    durationMs: z.number().int().min(MIN_SCENE_DURATION_MS).max(MAX_SCENE_DURATION_MS),
    kenBurns: z.enum(KEN_BURNS).default('static'),
    transitionOut: z.enum(TRANSITIONS).default('crossfade'),
    textOverlay: TextOverlaySchema.nullable().default(null),
  })
  .strict()

export const VideoTimelineSchema = z
  .object({
    scenes: z.array(SceneSchema).min(1).max(MAX_SCENES),
    outputFormat: z.enum(OUTPUT_FORMATS).default('mp4'),
    aspectRatio: z.enum(ASPECT_RATIOS).default('16:9'),
  })
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

/** Sum of the scene durations, in ms. The render budget. */
export function totalDurationMs(timeline) {
  return (timeline?.scenes || []).reduce((sum, scene) => sum + scene.durationMs, 0)
}

/**
 * A zod error as something a person can act on.
 *
 * `error.message` is a JSON dump of the whole issue tree, which in a 400 body
 * reads as a stack trace and sends the caller to the wrong field. What the
 * caller needs is the path and the sentence, and the schema already writes the
 * sentences — see the imageId message, which names the two mistakes anyone
 * actually makes (a URL, or upper-case hex).
 */
export function readableIssues(error) {
  return (error?.issues || []).map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))
}
