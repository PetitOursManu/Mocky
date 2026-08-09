// The block registry: a kind, from the schema, to the component that draws it.
//
// ── Why this file exists and why nothing else belongs in it ──────────────────
//
// `ComposedSceneVideo` lays out a stack of typed blocks, and what a `kind` means
// is decided here and nowhere else. It is the same shape `COMPOSITIONS` has one
// level up — what cannot be named cannot be asked for — applied to the twenty-
// seven components under this directory instead of to the six compositions above
// it.
//
// It is deliberately a map and nothing more. Twenty-seven people can each own one
// `.jsx` file in here without ever touching the same line, which is only true
// while this file holds no logic: a helper added here is a helper every block
// author edits, and a shared file with twenty-four authors is the one thing this
// arrangement was designed to avoid. Anything genuinely shared goes in
// `../composition.js`, where a test can reach it without React.
//
// ── The import rule, restated because it is load-bearing ─────────────────────
//
// **Nothing in this directory imports `remotion`.** A block is a plain React
// component: the frame reaches it as `progress` and `life`, computed by
// `sceneMotion`, so there is no need for `useCurrentFrame` and no excuse for it.
// That is what lets `blocks.test.js` import this registry inside Mocky's own
// vitest suite — where Remotion is not installed and never will be, because its
// licence is the reason the worker is a separate image at all.
//
// A block that reached for a frame hook would take the whole registry out of the
// test that proves the registry is complete, which is a much larger loss than
// whatever the hook was for.
import { AnimatedList } from './animatedList.jsx'
import { BarChart } from './barChart.jsx'
import { Button } from './button.jsx'
import { Carousel } from './carousel.jsx'
import { Clock } from './clock.jsx'
import { Counter } from './counter.jsx'
import { DateStamp } from './dateStamp.jsx'
import { Equalizer } from './equalizer.jsx'
import { CodeBlock } from './codeBlock.jsx'
import { Form } from './form.jsx'
import { FunTitle } from './funTitle.jsx'
import { Gallery } from './gallery.jsx'
import { Heading } from './heading.jsx'
import { ImageFrame } from './imageFrame.jsx'
import { Kicker } from './kicker.jsx'
import { LineChart } from './lineChart.jsx'
import { LogoType } from './logoType.jsx'
import { LowerThird } from './lowerThird.jsx'
import { WorldMap } from './map.jsx'
import { Notification } from './notification.jsx'
import { ProgressBar } from './progressBar.jsx'
import { Quote } from './quote.jsx'
import { Separator } from './separator.jsx'
import { SolidScene } from './solidScene.jsx'
import { SoundWave } from './soundWave.jsx'
import { TextHighlight } from './textHighlight.jsx'
import { Typewriter } from './typewriter.jsx'

/**
 * Every block kind the schema can name, and the component that draws it.
 *
 * The keys are the schema's `BLOCK_KINDS`, in the schema's own order, and
 * `blocks.test.js` asserts the two lists are equal in BOTH directions. Each
 * failure it prevents is a different one:
 *
 *   - a kind in the schema with no entry here is a document Mocky validates,
 *     queues and charges a render for, which then draws nothing where the block
 *     was — an export that succeeded and is missing what it was cut to deliver;
 *   - an entry here with no kind in the schema is a component nobody can reach,
 *     which is the cheaper mistake and still a lie: it reads as a feature.
 *
 * `validate.js` keeps its own list, `RENDERABLE_BLOCKS`, and that one is allowed
 * to lag — the worker is a separate image behind an opt-in profile, so an
 * operator really can run last month's build. Refusing by name there is what
 * turns that into a sentence instead of a blank corner of a frame.
 */
export const BLOCKS = {
  heading: Heading,
  kicker: Kicker,
  quote: Quote,
  textHighlight: TextHighlight,
  funTitle: FunTitle,
  typewriter: Typewriter,
  animatedList: AnimatedList,
  counter: Counter,
  logoType: LogoType,
  button: Button,
  form: Form,
  notification: Notification,
  lowerThird: LowerThird,
  barChart: BarChart,
  lineChart: LineChart,
  equalizer: Equalizer,
  soundWave: SoundWave,
  map: WorldMap,
  imageFrame: ImageFrame,
  gallery: Gallery,
  carousel: Carousel,
  clock: Clock,
  dateStamp: DateStamp,
  separator: Separator,
  progressBar: ProgressBar,
  codeBlock: CodeBlock,
  solidScene: SolidScene,
}

/**
 * The component for a kind, or `null`.
 *
 * `Object.hasOwn` and not `BLOCKS[kind]`, for the reason `dimensionsFor` and
 * `overlayAlignment` both spell out: a plain lookup answers for the prototype
 * chain, so `kind: "constructor"` hands back a function — and a function is
 * exactly what the caller is looking for, so nothing downstream would notice
 * until React tried to render `Object`.
 *
 * Null and not a throw. The kind was refused by `validate.js` long before a
 * frame, so reaching this branch means the two lists disagree — and a scene that
 * draws one block short is a worse export than the same scene with a gap in it,
 * but neither is worth killing a render half a minute in (Q1).
 */
export function blockComponent(kind) {
  return typeof kind === 'string' && Object.hasOwn(BLOCKS, kind) ? BLOCKS[kind] : null
}
