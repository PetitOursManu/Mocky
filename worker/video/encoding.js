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

// The one import, and it is the right kind: the longest film this worker will
// accept is a fact about the validator, and the rate below is derived from it.
// `validate.js` imports nothing at all, so this costs the module graph nothing
// and cannot drag Remotion into a file whose whole point is being testable.
import { MAX_TOTAL_DURATION_MS } from './validate.js'

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
 * The frames still come out as JPEG — and the reason is now a measurement
 * rather than the estimate this comment used to carry.
 *
 * `imageFormat: 'png'` is the correct answer to "do not quantise a frame twice":
 * it removes the first pass outright. It was refused the first time on the
 * render budget, on the grounds that a 1080p PNG is "an order of magnitude"
 * dearer than a JPEG of the same frame. Nobody had measured it, so it was
 * measured: the same slideshow of library photographs, 1920×1080, in this
 * container (`cpus: 2.0`, concurrency 2), rendered twice.
 *
 *                          jpeg 100      png        against
 *   465 frames (15.5 s)      66.2 s    106.5 s      RENDER_TIMEOUT_MS = 110 s
 *   915 frames (30.5 s)     129.9 s    212.8 s
 *   peak container memory   3081 MB    4096 MB      mem_limit: 4g
 *   90 frames, per frame     168 ms     250 ms
 *   PSNR vs a lossless ref  43.15 dB   44.32 dB     (png capture, crf 1)
 *
 * Not an order of magnitude — about 60%. And still a refusal, for a reason the
 * old estimate was too coarse to state: a fifteen-second film finishes 3.5 s
 * inside a 110 s deadline, and the thirty-second one takes twice the deadline
 * and touches the memory limit exactly. PNG does not buy a sharper export; it
 * buys a 504 on the next film that is slightly longer, and an OOM kill that
 * reaches the user as "the worker could not be reached".
 *
 * What settles it is the other column. PNG's entire gain is +1.17 dB, and
 * +1.00 dB of that was sitting in the bitrate ceiling below — which had started
 * clipping CRF 16 without anyone noticing — for +0.3% of render time. Lowering
 * the CRF two notches on top buys +2.01 dB for +5.4%. The capture was never
 * where the remaining loss lived; it just looked like the obvious place.
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
 * CRF 14 for h264, against a default of 18. Remotion's range for h264 is
 * [1, 51] and lower is better.
 *
 * It was 16, chosen by reasoning; 14 is chosen by measurement, on the content
 * that provoked the report — dark foliage, fine detail, a slow Ken Burns drift
 * over all of it, which is the expensive end of the scale. Against a lossless
 * reference (png capture, crf 1) and with the ceiling below no longer clipping:
 *
 *   crf 18   43.06 dB   13.1 Mbit/s      (Remotion's default)
 *   crf 16   44.15 dB   16.9 Mbit/s
 *   crf 14   45.16 dB   21.8 Mbit/s      +5.4% render time over crf 16
 *   crf 12   46.09 dB   28.3 Mbit/s      +11.2%, and past the ceiling
 *
 * The render-time column is the short doc's, which is the pessimistic one: on a
 * 915-frame film the same two notches cost 2.7%, because most of a render is
 * Chromium laying out and painting 1080p and none of that changed.
 *
 * 14 is where the series stops, and the stop is the ceiling's doing rather than
 * the eye's: 12 averages 28.3 Mbit/s, so it would need a cap in the middle
 * thirties, and no length-dependent allowance can grant a long film that
 * without giving up the size bound the store depends on. A setting that a
 * two-minute export silently loses is not a setting.
 */
export const H264_CRF = 14

/**
 * The bitrate ceiling, which used to be one number and is now a function of how
 * long the film is — because the one number had quietly become a quality
 * setting instead of a guard.
 *
 * ── Why a cap exists at all ──────────────────────────────────────────────────
 *
 * CRF alone has no size bound — that is what "constant rate factor" means — and
 * the bound matters here more than in most places that encode video. The film
 * comes back whole in an HTTP response, crosses `server/video/worker.js` as one
 * Buffer, and is written by `server/video/store.js`, which shares the instance
 * `diskBudget` with the image and clip libraries. A full volume fails writes
 * silently almost everywhere in this repository, so a setting whose worst case
 * is unknown is a setting that eventually turns an export into a silently
 * broken instance.
 *
 * ── The defect ───────────────────────────────────────────────────────────────
 *
 * The cap was 16 Mbit/s, on the stated grounds that it "sits ABOVE the rate CRF
 * 18 spends on the same frames, so it cannot cost a film anything". That was
 * true of CRF 18 — 13.1 Mbit/s measured — and it stopped being true in the same
 * commit that lowered the CRF to 16, which spends 16.9. Measured on a
 * photographic slideshow: the same three seconds encoded 5594 kB against the
 * 16 Mbit/s cap and 6340 kB with the cap lifted, 44.15 dB against 43.15. So a
 * guard that was supposed to refuse runaways and nothing else was throwing away
 * a decibel of every film — more than the whole PNG capture was worth, and
 * invisible, because a clipped encode reports no error.
 *
 * ── What replaces it ─────────────────────────────────────────────────────────
 *
 * The thing that actually has to be bounded is the FILE, not the rate: the
 * store, the Buffer and the HTTP response all care about bytes. So the budget
 * is stated in bytes and the rate is whatever a film of that length can afford
 * inside it, up to a ceiling the encoder can genuinely use.
 *
 * A rate that depends on the length is a real choice and not a fudge: two
 * minutes of 1080p and eight seconds of it are not the same object, and giving
 * the eight-second one the two-minute one's per-second allowance was the only
 * thing making them equal. `MAX_FILE_MBIT` is 1952 — 244 MB, the number the
 * disk budget was already sized against and the one `render.js` quotes — so the
 * worst case is unchanged at the schema's maximum length and strictly smaller
 * everywhere else.
 *
 * The ceiling is 28 Mbit/s, and it is above the rate CRF 14 spends rather than
 * equal to it — which is the part the old cap got wrong twice over, because
 * `maxrate` bounds the PEAK over a `bufsize` window and a CRF's published rate
 * is an average. CRF 14 averages 21.8 Mbit/s on the worst content measured, and
 * a cap of 24 still clipped it. Measured against the same encode with no cap at
 * all (45.24 dB, 8296 kB):
 *
 *   cap 24 Mbit/s   44.82 dB   7778 kB     −0.42 dB
 *   cap 28 Mbit/s   45.14 dB   8137 kB     −0.10 dB
 *   cap 32 Mbit/s   45.16 dB   8177 kB     −0.08 dB
 *
 * 28 is the smallest ceiling that is not a quality setting. That is the rule
 * this number answers to; going further buys two hundredths of a decibel and
 * moves the crossover below, which is a real cost to films of a minute.
 *
 * The floor is the old 16 Mbit/s, so no film can come out of this worse than it
 * did before the function existed. At the schema's own 120 s the two agree
 * exactly — floor(1952/122) is 16 — which is why the floor never binds today
 * and is here for the day `MAX_TOTAL_DURATION_MS` moves.
 *
 * The buffer stays twice the rate: ffmpeg measures the cap over a window of
 * `bufsize` bits, so a two-second window lets a hard cut spend freely and still
 * bounds the file. Remotion refuses `encodingMaxRate` without
 * `encodingBufferSize`, which is why they are computed together and never
 * separable — and why the budget is divided by `seconds + 2` rather than by
 * `seconds`: the buffer is part of the worst case, so it has to be part of what
 * the film is allowed to spend.
 */
export const MAX_FILE_MBIT = 1952
export const H264_RATE_CEILING_MBPS = 28
export const H264_RATE_FLOOR_MBPS = 16

/**
 * A duration this module will act on, in milliseconds.
 *
 * Anything that is not a finite NUMBER — undefined, null, NaN, the string a
 * query parameter arrives as — is read as the longest film the schema permits,
 * because that is the strictest answer. A caller that forgot to say how long
 * the film is must not thereby be granted the shortest film's allowance: the
 * whole point of a length-dependent rate is that a short film may spend more
 * per second, and "I don't know" is not short.
 *
 * A negative number is a readable one and clamps to zero, which is why this is
 * a normaliser and not a validator — `worstCaseBytes(-1)` has always answered
 * what `worstCaseBytes(0)` answers.
 */
function readDurationMs(durationMs) {
  return typeof durationMs === 'number' && Number.isFinite(durationMs) ? Math.max(0, durationMs) : MAX_TOTAL_DURATION_MS
}

/**
 * The rate and buffer for a film of `durationMs`, in Mbit/s and Mbit.
 *
 * `Math.floor` rather than a round, and it is the difference between a bound
 * that holds and one that nearly holds: rounding up gives back a rate whose
 * worst case is a few megabytes over the budget, which is the direction an
 * estimate of this kind must never be wrong in.
 *
 * Returned as a pair because they are one decision. Remotion refuses
 * `encodingMaxRate` without `encodingBufferSize`, and a buffer computed from a
 * rate other than the one being applied is a cap measured over the wrong window.
 */
export function h264RateFor(durationMs) {
  const seconds = readDurationMs(durationMs) / 1000
  const affordable = Math.floor(MAX_FILE_MBIT / (seconds + 2))
  const mbps = Math.min(H264_RATE_CEILING_MBPS, Math.max(H264_RATE_FLOOR_MBPS, affordable))
  return { maxRateMbps: mbps, bufferMbit: mbps * 2 }
}

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
 * `x264Preset` is absent deliberately rather than forgotten, and that too is
 * now measured rather than assumed: `slow` at the same CRF returned 43.14 dB
 * against `medium`'s 43.15 — the same picture, a file 1.5% smaller — for 17%
 * more render time. A preset trades size against CPU at constant quality, so
 * there was never a decibel in it; on two cores inside a 110 s budget that
 * makes it the one lever here with a cost and no benefit.
 *
 * vp8 keeps a flat rate. It is not measured — this container encodes mp4 in
 * every path anybody has reported on — and inventing a length-dependent
 * allowance for a codec nobody has profiled would be the same mistake the h264
 * ceiling just made, in the other direction. Its worst case (10 Mbit/s × 120 s
 * plus a 20 Mbit buffer, 152 MB) is already inside the budget.
 *
 * @param {number} durationMs  the film's own length; see `h264RateFor`
 */
function perCodec(durationMs) {
  const { maxRateMbps, bufferMbit } = h264RateFor(durationMs)
  return {
    h264: {
      crf: H264_CRF,
      encodingMaxRate: rate(maxRateMbps),
      encodingBufferSize: rate(bufferMbit),
    },
    vp8: {
      videoBitrate: rate(VP8_BITRATE_MBPS),
      encodingMaxRate: rate(VP8_MAX_RATE_MBPS),
      encodingBufferSize: rate(VP8_BUFFER_MBIT),
    },
  }
}

/** The codecs this worker has settings for. Read by the lookup guard below. */
const CODEC_NAMES = ['h264', 'vp8']

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
 * @param {string} codec        as returned by `codecFor`
 * @param {number} [durationMs] the film's own length. Omitted means "as long as
 *   the schema permits", which is the settings a two-minute film gets — see
 *   `readDurationMs` for why the default is the strictest answer and not the
 *   most generous one.
 */
export function encodingOptionsFor(codec, durationMs) {
  if (typeof codec !== 'string' || !CODEC_NAMES.includes(codec)) {
    throw new Error(`No encoder settings for codec "${String(codec)}"; this worker encodes ${CODEC_NAMES.join(', ')}.`)
  }
  return {
    imageFormat: CAPTURE_FORMAT,
    jpegQuality: CAPTURE_QUALITY,
    pixelFormat: PIXEL_FORMAT,
    ...perCodec(durationMs)[codec],
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
 *
 * The duration now enters twice — once as the running time, and once through
 * the settings, since `h264RateFor` reads it. That is what keeps the two halves
 * from drifting: an allowance computed for one length and multiplied by another
 * is a bound that holds on paper and not on disk.
 */
export function worstCaseBytes(codec, durationMs) {
  const options = encodingOptionsFor(codec, durationMs)
  // The same normalisation the rate was computed from. Reading the duration
  // twice, two different ways, is how a bound comes out multiplied by one
  // length and granted for another.
  const seconds = readDurationMs(durationMs) / 1000
  const mbps = Number.parseFloat(options.encodingMaxRate)
  const buffer = Number.parseFloat(options.encodingBufferSize)
  return Math.ceil(((mbps * seconds + buffer) * 1_000_000) / 8)
}
