// What the renderer is TOLD about quality, and what each codec is told.
//
// A module of its own, with no Remotion import, for exactly the reason
// `staging.js` and `remotion/composition.js` have one: `render.js` imports
// `@remotion/renderer` at the top, so no test in this repository can load it —
// and the option object handed to `renderMedia` is the one part of a render a
// test CAN check. Every number below is a claim about a file nobody has
// produced yet; `encoding.test.js` is where those claims are held.
//
// It exists because `renderMedia` was called with the codec and nothing else.
// Every quality setting was Remotion's default, inherited in silence, and the
// only way to find out was to watch an export: a 1920×1080 film of forest
// photographs came back soft and blocky. The defaults, at the version
// `package.json` pins (4.0.507):
//
//   imageFormat      'jpeg'      DEFAULT_VIDEO_IMAGE_FORMAT
//   jpegQuality      80          DEFAULT_JPEG_QUALITY
//   crf              18 (h264)   getDefaultCrfForCodec — 9 for vp8, on another scale
//   pixelFormat      'yuv420p'   DEFAULT_PIXEL_FORMAT
//   x264Preset       'medium'    h264 only
//   scale            1
//   everyNthFrame    1
//   concurrency      half the CPU threads Remotion can SEE — see the note at the
//                    bottom of this file, which is the one default that a
//                    container makes actively wrong
//
// So each frame was quantised twice: once by Chromium as an 80-quality JPEG on
// its way out of the browser, then again by x264 at CRF 18. Two quantisers on
// the same 8×8 grid, and the first one bought nothing — the frames never touch
// a disk, they come back over the devtools socket and go straight into the
// encoder. On a dark, high-frequency photograph that first pass is precisely
// the "blockeux" in the report.

/**
 * The output format the timeline asks for, as a codec Remotion knows.
 *
 * vp8 rather than vp9 for webm. vp9 encodes several times slower for a gain
 * nobody watching a fifteen-second slideshow will see, and the budget is 110
 * seconds on a container limited to two cores — a format choice that turns a
 * working export into a timeout is not a quality improvement.
 */
export const CODECS = { mp4: 'h264', webm: 'vp8' }

/** The codec for a container, or h264. See the note on the lookup below. */
export function codecFor(outputFormat) {
  // `Object.hasOwn`, not a plain lookup, for the reason `server/video/store.js`
  // spells out beside its own container table: a plain lookup answers for the
  // whole prototype chain, so `outputFormat: "constructor"` returns a function
  // that is perfectly truthy and reaches Remotion as a codec. Every caller today
  // is validated — this is the second lock, so a validator loosened one day
  // cannot silently become an encoder argument.
  return typeof outputFormat === 'string' && Object.hasOwn(CODECS, outputFormat) ? CODECS[outputFormat] : CODECS.mp4
}

// ── The capture: what leaves the browser ─────────────────────────────────────

/**
 * The frames still come out as JPEG, and this is the one setting here that was
 * argued the other way first.
 *
 * `imageFormat: 'png'` is the correct answer to "do not quantise a frame twice":
 * it removes the first pass outright. It is refused on the render budget, and
 * the budget is not a detail — the worker gives up at `RENDER_TIMEOUT_MS`
 * (110 s), serves one render at a time, and the schema permits 120 s of film,
 * which at `FPS` 30 is 3600 frames. Every frame is encoded inside Chromium and
 * carried back over the devtools protocol as base64; a 1080p PNG of a
 * photograph is an order of magnitude larger than a JPEG of the same frame, and
 * an order of magnitude of per-frame cost on a two-core container is how a
 * thirty-second film that renders today starts answering 504. A setting that
 * trades an export for a sharper one nobody receives is not a quality
 * improvement either.
 *
 * So the capture stays JPEG and stops being lossy in the way that mattered.
 */
export const CAPTURE_FORMAT = 'jpeg'

/**
 * 100, against a default of 80.
 *
 * At 100 libjpeg's quantisation tables are flat, so the luma — the blocking the
 * report is about — survives the trip out of the browser essentially intact,
 * and the only quantiser left on it is the one that is supposed to be there.
 *
 * What quality 100 does NOT recover is chroma resolution, and that is the
 * reason this is most of the distance to PNG rather than a compromise: the
 * output is `yuv420p` regardless (see below), so the chroma was going to be
 * halved by the encoder whatever the capture did. Halving it twice costs a
 * fraction of what the luma quantisation cost.
 *
 * The price is the intermediate frame, several times larger in memory and a
 * little slower to entropy-code. Neither is measurable against a render whose
 * time goes on laying out and painting 1080p in a browser.
 */
export const CAPTURE_QUALITY = 100

// ── The output: what a player has to be able to open ─────────────────────────

/**
 * `yuv420p`, which is also Remotion's default — stated anyway, and the reason
 * is that it is a GUARANTEE here rather than an inherited accident.
 *
 * 4:2:0 is the chroma that destroys a coloured hairline of text over a
 * photograph, and every instinct says to raise it to `yuv444p` for a film that
 * is mostly type over pictures. It is the wrong move, and expensively so: h264
 * at 4:4:4 is the High 4:4:4 Predictive profile, which browsers do not decode.
 * Mocky's own Media tab plays these films in a `<video>` element, so the "sharp"
 * export would be the one nobody can watch — the failure this repository calls
 * reporting a success for nothing.
 *
 * Written down explicitly so that a Remotion release changing its own default
 * cannot change what a Mocky export can be played in. v4 → v5 already moved the
 * default `colorSpace`; a default is not a promise.
 */
export const PIXEL_FORMAT = 'yuv420p'

/**
 * CRF 16 for h264, against a default of 18. Remotion's range for h264 is
 * [1, 51] and lower is better.
 *
 * Two notches, not ten. CRF is exponential in file size and the content that
 * provoked this — dark foliage, fine detail, a slow Ken Burns drift over all of
 * it — is the expensive end of the scale; 16 is where the quantiser stops being
 * what the eye finds first, and 12 would be a file three times the size for a
 * difference visible on a still nobody exports.
 */
export const H264_CRF = 16

/**
 * A ceiling on the bitrate, in Mbit/s, and a buffer over which it is measured.
 *
 * CRF alone has no size bound at all — that is what "constant rate factor"
 * means — and the bound matters here more than it does in most places that
 * encode video. The film comes back whole in an HTTP response, crosses
 * `server/video/worker.js` as one Buffer, and is written by
 * `server/video/store.js`, which shares the instance `diskBudget` with the
 * image and clip libraries. A full volume fails writes silently almost
 * everywhere in this repository, so a setting whose worst case is unknown is a
 * setting that eventually turns an export into a silently broken instance.
 *
 * 16 Mbit/s sits ABOVE the rate CRF 18 spends on the same frames today, so the
 * cap cannot cost a film anything it currently has; it refuses the runaway and
 * nothing else. `worstCaseBytes` turns the pair into the number that can be
 * checked against the budget, and `encoding.test.js` checks it.
 *
 * The buffer is twice the rate: ffmpeg measures the cap over a window of
 * `bufsize` bits, so a two-second window lets a hard cut spend freely and still
 * bounds the file. Remotion refuses `encodingMaxRate` without
 * `encodingBufferSize`, which is why they are one constant apart and never
 * separable.
 */
export const H264_MAX_RATE_MBPS = 16
export const H264_BUFFER_MBIT = 32

/**
 * vp8 is given a BITRATE, not a CRF, and that is not a preference.
 *
 * Remotion emits `-crf <n>` for vp8 and never `-b:v 0`. libvpx reads a CRF as
 * *constrained* quality, bounded by the target bitrate — and with no `-b:v` on
 * the command line that target is ffmpeg's own default for a video encoder,
 * 200 kbit/s. So the webm path was not merely using a default; the default it
 * was using capped a 1080p film at a rate meant for a thumbnail. The visible
 * symptom is the same word the report uses, one order of magnitude worse.
 *
 * 8 Mbit/s is a generous 1080p30 target for photographic content, and the cap
 * below is what makes the size bound hold for webm the way the h264 pair does.
 * They are honoured: libvpx maps `-maxrate` and `-bufsize` onto its own rate
 * control. `crf` and `videoBitrate` may not both be set — Remotion refuses the
 * pair by name — which is why this branch has no CRF at all.
 */
export const VP8_BITRATE_MBPS = 8
export const VP8_MAX_RATE_MBPS = 10
export const VP8_BUFFER_MBIT = 20

/** Mbit/s as the string ffmpeg reads. */
const rate = (mbps) => `${mbps}M`

/**
 * What each codec is told, and nothing it would ignore.
 *
 * The split is the point of the table. `crf` means [1,51] on h264 and [4,63] on
 * vp8 — the same key, two scales, two defaults — and `x264Preset` is h264-only,
 * so one flat "quality" object handed to both codecs would be a comment
 * pretending to be a setting on whichever one dropped half of it.
 *
 * `x264Preset` is absent deliberately rather than forgotten: the default
 * ('medium') is the right trade on two cores. `slow` buys perhaps a tenth of a
 * bitrate at the same quality and spends encoder CPU that is running alongside
 * Chromium inside a 110 s budget.
 */
const PER_CODEC = {
  h264: {
    crf: H264_CRF,
    encodingMaxRate: rate(H264_MAX_RATE_MBPS),
    encodingBufferSize: rate(H264_BUFFER_MBIT),
  },
  vp8: {
    videoBitrate: rate(VP8_BITRATE_MBPS),
    encodingMaxRate: rate(VP8_MAX_RATE_MBPS),
    encodingBufferSize: rate(VP8_BUFFER_MBIT),
  },
}

/**
 * The quality half of a `renderMedia` call, for one codec.
 *
 * Throws on a codec it has no settings for, the same way `compositionIdFor`
 * throws on a template with no composition and for the same reason: the only
 * caller feeds it `codecFor`, whose answers are a closed set of two, so an
 * unknown codec here is a table someone extended on one side. Falling back to
 * the h264 settings would hand `crf: 16` to an encoder whose scale runs to 63
 * and produce a file nobody would think to question.
 *
 * `scale` and `everyNthFrame` are deliberately absent. Their defaults are 1 and
 * 1 — full size, every frame — which is what this feature wants; a setting
 * restated because it happens to be correct is noise that hides the six that
 * are not.
 *
 * @param {string} codec  as returned by `codecFor`
 */
export function encodingOptionsFor(codec) {
  if (typeof codec !== 'string' || !Object.hasOwn(PER_CODEC, codec)) {
    throw new Error(`No encoder settings for codec "${String(codec)}"; this worker encodes ${Object.keys(PER_CODEC).join(', ')}.`)
  }
  return {
    imageFormat: CAPTURE_FORMAT,
    jpegQuality: CAPTURE_QUALITY,
    pixelFormat: PIXEL_FORMAT,
    ...PER_CODEC[codec],
  }
}

// ── How many of those frames exist at once ───────────────────────────────────

/**
 * Render processes in parallel. Unset until now, which meant Remotion's own
 * default: half the CPU threads it can see.
 *
 * A container does not get its own count. `cpus: 2.0` in the compose file is a
 * CFS quota, not an affinity mask, so nothing the worker can call — neither
 * `os.cpus()` nor `os.availableParallelism()` — reports two. It reports the
 * HOST's threads, sixteen on an ordinary build machine, and the render opens
 * eight Chromium tabs to time-share two cores. That was already the wrong trade
 * on its own: eight processes on two cores finish no sooner than two, they pay
 * for the switching, and the deadline they are racing is 110 s.
 *
 * What turns it from waste into a defect is the setting at the top of this file.
 * `concurrency` is how many captured frames are in flight at once, and a frame
 * at quality 100 is several times the size of the same frame at 80. Raising the
 * capture and leaving the multiplier to whatever host the image happens to run
 * on is how a worker that renders perfectly on one machine is OOM-killed on a
 * bigger one — `mem_limit: 4g`, no message, and a job that reports only that the
 * worker could not be reached.
 *
 * So the number is stated, and stated where the compose file can move it with
 * the CPU allowance it has to match. Two, because `cpus: 2.0`.
 */
export const DEFAULT_CONCURRENCY = 2

/**
 * A ceiling on what the environment may ask for.
 *
 * Not a Remotion limit — it is this container's. Every unit of concurrency is
 * another Chromium holding 1080p frames against a 4 GB cap, and the value
 * arrives from an operator's compose file rather than from code, so the failure
 * a typo produces (`RENDER_CONCURRENCY: 200`) is an OOM kill mid-render rather
 * than a refusal anybody can read.
 */
export const MAX_CONCURRENCY = 16

/**
 * @param {Record<string, string|undefined>} [env]
 */
export function renderConcurrency(env = process.env) {
  const raw = env?.RENDER_CONCURRENCY
  if (raw == null || raw === '') return DEFAULT_CONCURRENCY
  // Rounded rather than floored, and the default rather than 1 on nonsense: a
  // mistyped value should render the way an unset one does, not at the slowest
  // setting there is with nothing to say why.
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n) || n < 1) return DEFAULT_CONCURRENCY
  return Math.min(n, MAX_CONCURRENCY)
}

/**
 * The largest file a render of `durationMs` can produce, in bytes.
 *
 * `maxrate` bounds the average over a window of `bufsize` bits, so the whole
 * file is at most the rate times the running time plus one buffer. That is the
 * only claim about output size this worker can make, and it exists so it can be
 * held against the limits it has to pass through — the disk budget above all,
 * which refuses BEFORE writing and would otherwise start refusing exports on an
 * instance whose settings changed under it.
 *
 * A slight overestimate for every real film and exact enough to size a volume,
 * which is the direction an estimate of this kind has to be wrong in.
 */
export function worstCaseBytes(codec, durationMs) {
  const options = encodingOptionsFor(codec)
  const seconds = Math.max(0, Number(durationMs) || 0) / 1000
  const mbps = Number.parseFloat(options.encodingMaxRate)
  const buffer = Number.parseFloat(options.encodingBufferSize)
  return Math.ceil(((mbps * seconds + buffer) * 1_000_000) / 8)
}
