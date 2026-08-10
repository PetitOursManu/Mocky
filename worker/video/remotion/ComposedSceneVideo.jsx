import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion'
import {
  backgroundKind,
  composedLayout,
  composedPalette,
  entranceStyle,
  fieldPaints,
  frameBase,
  groundDensity,
  groundPainted,
  hairlineTexture,
  planTimeline,
  resolveTheme,
  sceneMotion,
  withAlpha,
} from './composition.js'
import { ThreeCanvas } from '@remotion/three'
import { blockComponent } from './blocks/index.js'
import { blockCanvas, sceneCanvasImages } from './blocks/canvases.js'
import { useStageTextures } from './textures.js'

/**
 * `composed` — a ground, and a stack of typed blocks on it.
 *
 * The sixth entry in the catalogue and the one that is a different KIND of
 * entry. The other five are a look: a slideshow is one picture per scene, a
 * product card is a picture beside three arguments. This one is a LAYOUT ENGINE
 * for twenty-four components, and what varies inside it is which of them a
 * document asked for, where, and in what order.
 *
 * It does not reopen the founding rule and it is worth saying why, because it
 * looks as though it might. Every `kind` is one name out of a closed enum;
 * `blocks/index.js` maps that name to a component somebody wrote and a reviewer
 * read; every field of every block is bounded by three validators; and nothing
 * in a document becomes JSX, CSS, a file name or a colour. What the model got is
 * arithmetic — combinations instead of five cards — not permission to describe
 * its own rendering.
 *
 * ── What this file owns, and what it must not take back ─────────────────────
 *
 * It owns the LAYOUT: which cell an anchor is, what happens when two blocks want
 * the same one, and what the ground looks like. It owns none of the arithmetic:
 * the plan, the cues, the drift, the camera move and every colour come out of
 * `composition.js`, where `composition.test.js` and `tests/video-motion.test.js`
 * can reach them without Remotion. Moving any of that in here is how a film stops
 * being checkable, which is the rule at the top of `composition.js` and the
 * reason it is a separate file at all.
 *
 * ── The three layers, in paint order ────────────────────────────────────────
 *
 *   1. the ground — a colour, and at most one second layer over it;
 *   2. the blocks anchored `full` — a map, a wave, a gallery: things that ARE a
 *      field rather than an element in one;
 *   3. the nine cells — a 3×3 grid, each cell a column that stacks whatever was
 *      anchored to it, in the order the document listed it.
 *
 * Layers 2 and 3 are one list, `composedLayout(...).zones`, in paint order. The
 * boxes are pixels off `composition.js` rather than percentages resolved by CSS,
 * and that is not a refactor: a percentage in a `padding` resolves against the
 * WIDTH on all four sides, which put the margin of a portrait frame on the wrong
 * axis, and a portrait frame is the one that has to keep a fifth of its height
 * clear of the feed's own interface. A number a test can read is also a margin a
 * test can prove nothing crosses.
 *
 * ── One box per BLOCK, and it is the prop that matters ──────────────────────
 *
 * What this file hands a block is `zone.layers[i].box` — the box that block was
 * allotted — and the type unit its stack agreed on. Never the zone's box, which
 * is what it used to pass to every block in the zone: eight fields anchored
 * `full` were eight canvases of 589 px each, 4712 px of content inside 950 px of
 * safe height. The rule the blocks are written to is at the top of
 * `composition.js`, the arithmetic that divides a zone is `stackIn`, and what a
 * block is supposed to draw in the box it gets is `blockExtent`. `base` is still
 * passed, for the three constant metrics named there and for nothing else.
 *
 * Everything is an `AbsoluteFill` or an absolutely positioned box, which is what
 * makes DOM order the paint order. `AnimatedTitlesVideo` learned that the other
 * way round: an absolutely positioned child paints above its in-flow siblings
 * whatever the DOM says, so a texture drawn as a layer covers the headline it was
 * supposed to sit behind.
 */

/** Which way a gradient runs. The document names a direction; this file owns the CSS. */
const GRADIENT_CSS = {
  'to-bottom': 'to bottom',
  'to-right': 'to right',
  diagonal: '135deg',
}

/**
 * The second layer of the ground, painted from the same object the palette
 * measured.
 *
 * `palette.ground.tint` is an array of `{ color, alpha }` and it is read back
 * here rather than rebuilt: a density somebody nudges in this file would
 * otherwise leave the measurement behind, which is the one way a decorative
 * layer undoes the whole legibility section without touching a line of it. An
 * ABSENT tint means paint nothing — and it means two things at once, "this
 * ground has no second layer" and "the second layer was what made a line
 * illegible, so `texturedGround` dropped it". This file does not need to tell
 * them apart, which is the point of the shape.
 */
const Ground = ({ kind, background, palette, motion, imageSrc }) => {
  // `groundTint` and not `ground.tint`: the second is everything that was
  // MEASURED, which on a scene with a stacked field also holds the field's own
  // density — painting that here would draw the field twice and would take a
  // gradient's far end off the accent, since the branch below reads the last
  // entry. See `composedPalette`.
  const tint = palette.groundTint

  if (kind === 'image') {
    return (
      <>
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <img
            src={imageSrc?.[background.imageId]}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              // The camera move, from `sceneMotion` — this file never builds a
              // transform of its own.
              transform: motion.picture,
            }}
          />
        </AbsoluteFill>
        {/*
          The veil, at the density the palette resolved. A photograph is not in
          the theme, so every run on this ground was measured at BOTH ends of
          what the picture can composite the veil to — over a frame that is all
          black and one that is all white. The cost is a veil denser than a dark
          photograph needs; it is the price of a guarantee made without opening
          the picture.
        */}
        <AbsoluteFill style={{ backgroundColor: withAlpha(palette.ground.color, palette.ground.alpha) }} />
      </>
    )
  }

  // Nothing left to paint: this ground either never had a second layer, or the
  // layer was what made a line illegible and the palette dropped it. Read through
  // `groundPainted` rather than checked here, because `composedMotion` asks the
  // same question to decide whether to report a `ground` progress at all — two
  // readings of "is there a layer" is one of them reporting a number that moves
  // on a frame that does not.
  if (!groundPainted(palette)) return null

  if (kind === 'gradient') {
    const far = tint[tint.length - 1].color
    const direction = GRADIENT_CSS[background?.direction] ?? GRADIENT_CSS['to-bottom']
    const image =
      background?.direction === 'radial'
        ? `radial-gradient(circle at 50% 45%, ${far}, ${palette.ground.color})`
        : `linear-gradient(${direction}, ${palette.ground.color}, ${far})`
    return (
      <AbsoluteFill
        style={{
          backgroundImage: image,
          // Larger than the frame and slid across it, so the ramp moves without
          // the colours leaving the range the palette sampled: every value in
          // between is a blend of the same two ends.
          backgroundSize: '170% 170%',
          backgroundPosition: `${(motion.ground ?? 0) * 100}% ${(motion.ground ?? 0) * 100}%`,
        }}
      />
    )
  }

  const layer = tint[0]
  if (kind === 'particles') {
    const density = 1 + (background?.density ?? 2)
    const dot = `radial-gradient(${withAlpha(layer.color, layer.alpha)} 45%, transparent 45%)`
    return (
      <AbsoluteFill
        style={{
          backgroundImage: dot,
          backgroundSize: `${Math.round(120 / density)}px ${Math.round(120 / density)}px`,
          // Drifting downwards over the scene, and fading only DOWNWARDS from the
          // density that was measured — `groundDensity` owns that curve, because
          // it is the one quantity here that could undo the legibility guarantee.
          backgroundPosition: `0px ${(motion.ground ?? 0) * 120}px`,
          opacity: groundDensity(kind, motion.ground),
        }}
      />
    )
  }

  if (kind === 'gridPulse') {
    const cells = background?.cells ?? 8
    const line = withAlpha(layer.color, layer.alpha)
    const step = `${100 / cells}%`
    return (
      <AbsoluteFill
        style={{
          backgroundImage:
            `repeating-linear-gradient(to right, ${line} 0 1px, transparent 1px ${step}), ` +
            `repeating-linear-gradient(to bottom, ${line} 0 1px, transparent 1px ${step})`,
          opacity: groundDensity(kind, motion.ground),
        }}
      />
    )
  }

  // `hairlines`, and anything a future schema adds that this build does not know:
  // the house's own field of 1 px rules, at the density that was measured.
  return <AbsoluteFill style={{ backgroundImage: hairlineTexture(layer.color, layer.alpha) }} />
}

const ComposedScene = ({ entry, theme, palette, imageSrc }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const { scene } = entry
  const base = frameBase(width, height)

  const kind = backgroundKind(scene.background)
  // What this scene is actually going to PAINT, handed to the motion rather than
  // guessed by it. A ground's second layer is dropped when it is what made a line
  // illegible, and that is a legibility answer: it needs the theme, which the
  // motion has never been given. See `groundPainted`.
  const motion = sceneMotion('composed', entry, frame, { ground: groundPainted(palette) })
  // Where every block goes, worked out where a test can reach it. This file
  // paints the boxes it is handed and decides none of them.
  const layout = composedLayout(scene, width, height)
  /*
   * The pictures a GL block stands on, decoded before this scene draws a frame.
   *
   * A `<img>` in the DOM is loaded by the browser and composited whenever it is
   * ready; a texture is an OBJECT a mesh has to be handed, and the panel it goes
   * on takes the picture's own shape — so a component that rendered before the
   * decode finished would draw a slab of the wrong dimensions. `useStageTextures`
   * holds the frame with `delayRender` until they are in AND a render has seen
   * them; the argument is in that file, and it is the one thing about this family
   * that a screenshot of one frame would never show.
   *
   * Empty for every scene with no such block, which is almost all of them, and
   * the hook costs one `continueRender` there.
   */
  const textures = useStageTextures(sceneCanvasImages(scene), imageSrc)

  // A fraction of the short edge on the way out of `composition.js`, pixels here:
  // the movement is arithmetic and the size of the frame is layout.
  const drift = motion.drift * base

  const draw = (layer, index, box, unit, align) => {
    const Block = blockComponent(layer.kind)
    // Null only if the registry and the schema disagree, which `blocks.test.js`
    // is what prevents. A gap in a frame beats a render that dies half a minute
    // in (Q1).
    if (!Block) return null
    const drawn = (
      <Block
        key={index}
        block={layer}
        palette={palette}
        theme={theme}
        // The box this block was actually given — its own, never its zone's. It
        // is the prop every size in a block is derived from; see the rule at the
        // top of `composition.js` and `blockExtent`, which is what a block draws
        // in it. `base` stays for the three constant metrics named there and for
        // nothing else.
        box={box}
        // The type unit its whole stack reads, so two blocks in one zone are two
        // steps of one scale rather than two fractions of a frame.
        unit={unit}
        base={base}
        progress={motion.layers[index] ?? 1}
        // The scene's own clock, for the blocks that run continuously rather
        // than arriving once: an equalizer, a carousel, the hand of a clock.
        life={progressOf(frame, entry.durationInFrames)}
        images={imageSrc}
        // The same pictures as GL textures. Only the blocks of the picture-stage
        // family read it, exactly as only the three media blocks read `images`.
        textures={textures}
      />
    )

    /*
     * The blocks that need a renderer opened around them.
     *
     * A 3D block returns react-three-fiber intrinsics — `<mesh>`,
     * `<planeGeometry>`, `<meshLambertMaterial>` — which are meaningless outside
     * a canvas, and it imports neither `three` nor `@remotion/three`. That is
     * deliberate and it is what keeps `blocks/index.js` loadable inside Mocky's
     * own vitest suite, where those packages are no more installed than Remotion
     * is: a single import there would take the registry out of the test that
     * proves it matches the schema in both directions.
     *
     * So the canvas is opened HERE, next to the frame, the layout and the
     * palette — the three other things a block is handed rather than allowed to
     * decide. `ThreeCanvas` is Remotion's own: it holds the frame back until the
     * GL draw has finished, which a bare react-three-fiber `<Canvas>` does not,
     * and a frame captured before its draw lands is a black square in an mp4.
     *
     * WHICH blocks, how large the canvas is and what camera looks into it are
     * `blocks/canvases.js`'s answer rather than a branch here. This used to read
     * `if (layer.kind !== 'solidScene')` with a size and a camera imported beside
     * it, which is one branch per 3D block in a file every block author would
     * then have to edit.
     *
     * Sized to the block's own box and never to the frame: this is the family
     * whose wasted pixels are measured in render seconds — about 0.9 of them per
     * second of film for a full-frame lit solid, against the 1.7 the deadline
     * leaves spare.
     */
    const canvas = blockCanvas(layer, box, base, unit)
    if (!canvas) return drawn
    /*
     * The FLAT half, for the one block that has one.
     *
     * `solidChart` sets its captions in DOM over the canvas rather than inside
     * it, because type in GL is either a font file this container does not carry
     * or a texture painting glyphs at a size nobody chose — and a caption is a
     * RUN, sized on the one type scale and measured against the surface it lands
     * on. So the wrapper is the block's FRAME, the GL surface sits at the top of
     * it, and the overlay is painted over the whole thing. For every other 3D
     * block the frame IS the canvas and this changes nothing.
     */
    const Overlay = canvas.overlay
    const surface = (
      <ThreeCanvas
        width={canvas.width}
        height={canvas.height}
        camera={canvas.camera}
        // Parallel rather than perspective, when the block says so. It is one
        // block so far and it is not a taste: a bar chart under a vanishing
        // point draws two equal values as two different columns.
        orthographic={canvas.orthographic}
      >
        {drawn}
      </ThreeCanvas>
    )
    return (
      <div
        key={index}
        style={{
          position: 'relative',
          width: canvas.frame.width,
          height: canvas.frame.height,
          flex: '0 0 auto',
          // The only children with an intrinsic width, and therefore the ones
          // that `stretch` cannot place. A `full` zone has no horizontal edge the
          // document chose — `align` is `stretch` there, which stretches a block
          // that has no width of its own and leaves this canvas at the start.
          // A real export showed it: a torus asked for the whole frame drew a
          // square against the left margin with the heading crossing it. Every
          // other zone keeps the edge the anchor named.
          ...(align === 'stretch' ? { alignSelf: 'center' } : null),
        }}
      >
        {/*
          The GL surface, painted over its frame when the block says so.

          Only the three FIELDS say so, and the reason is a stopwatch rather than
          a shape: a field covers its whole box, which at full frame is 2.4 times
          the pixels the largest solid covers, and a lit sheet at that size spent
          nearly the whole margin the render deadline leaves. Drawn inside
          `FIELD_PIXEL_BUDGET` and scaled back up it costs what a solid costs, on
          three blocks that have nothing on them finer than the gradient across
          them. Two scales and not one: the backing store is an integer number of
          pixels and the box is another, so a single rounded factor lands a
          fraction of a pixel short of the right edge and paints a hairline of
          the ground down it.
        */}
        {canvas.stretch ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: canvas.width,
              height: canvas.height,
              transformOrigin: 'top left',
              transform: `scale(${canvas.frame.width / canvas.width}, ${canvas.frame.height / canvas.height})`,
            }}
          >
            {surface}
          </div>
        ) : (
          surface
        )}
        {Overlay ? (
          <Overlay
            block={layer}
            palette={palette}
            theme={theme}
            box={box}
            unit={unit}
            base={base}
            progress={motion.layers[index] ?? 1}
            life={progressOf(frame, entry.durationInFrames)}
            images={imageSrc}
          />
        ) : null}
      </div>
    )
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.ground.color,
        ...entranceStyle(entry.enterTransition, frame, entry.enterFrames),
      }}
    >
      <Ground kind={kind} background={scene.background} palette={palette} motion={motion} imageSrc={imageSrc} />

      {/* The stack drifts, the ground does not. That is the legibility half of
          the choice as much as the compositional one: the ground is the surface
          every run was measured against, and a ground moving under fixed type
          would be text crossing a surface nobody measured. Same argument
          `TITLE_BLOCK_DRIFT` already makes for the titled card. */}
      <AbsoluteFill style={{ transform: `translateY(${drift}px)` }}>
        {layout.zones.map((zone) => (
          <div
            key={zone.anchor}
            style={{
              // Absolute and in pixels, off the same object the test measures.
              // A grid with a percentage padding drew the same picture and could
              // not be asked whether anything crossed the safe margin.
              position: 'absolute',
              left: zone.box.left,
              top: zone.box.top,
              width: zone.box.width,
              height: zone.box.height,
              textAlign: zone.textAlign,
              /*
               * The edge a full-measure ORNAMENT is drawn out from, inherited.
               *
               * Four blocks — `heading`, `kicker`, `quote`, `textHighlight` — draw a
               * rule the width of their box and reveal it with a `scaleX`, which
               * needs an origin. All four had `left`, so a centred stack came back
               * with its type in the middle of the measure and its rule flush against
               * the left margin; on `05-pile-de-trois` that rule sat directly above a
               * `separator` the flex row HAD centred, which is two ornaments in one
               * stack disagreeing about where the margin is.
               *
               * It is `textAlign`'s own answer and not a second table: `left`,
               * `center` and `right` are the three values `TEXT_OF` produces and the
               * three keywords `transform-origin` takes, and the question they answer
               * is the same one — which edge did the document choose by naming an
               * anchor. A custom property because a block cannot read an inherited
               * `text-align` from JavaScript, and inheritance is what keeps this out
               * of the twenty-seven-prop contract every block is written to.
               */
              '--mocky-rule-origin': zone.textAlign,
              // The field cedes density to whatever stands on it, at the value
              // `composedPalette` measured — 1 on every scene that stacks
              // nothing over a `full` block, which is most of them. It is on the
              // ZONE because `full` is the only thing that makes a block a
              // field, and a rule kept here is a rule the twenty-eighth block
              // cannot forget. See `FIELD_ALPHAS` for the export that made it
              // necessary.
              ...(zone.anchor === 'full' ? { opacity: palette.field.alpha } : null),
            }}
          >
            {/*
              One wrapper per block, at the box `composedLayout` gave THAT block
              — not the zone's box repeated. A flex column with `gap` drew the
              same picture and answered a different question: the height a block
              ended up with was whatever it decided to draw, so a stack of eight
              fields was eight full-size fields overflowing a zone nobody could
              measure. Here the boxes tile the zone, the arithmetic that divided
              it is in `stackIn`, and a test can ask what any of them got.

              The vertical alignment is `center` inside a box a block is expected
              to fill: it decides nothing when the block fills its box, and it
              keeps a block that draws less than its box in the middle of it
              rather than pinned to a corner. The horizontal one is the zone's,
              because that is the edge the DOCUMENT chose by naming an anchor.
            */}
            {zone.layers.map(({ block, index, box, unit }) => (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  left: box.left - zone.box.left,
                  top: box.top - zone.box.top,
                  width: box.width,
                  height: box.height,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: zone.align,
                  minWidth: 0,
                }}
              >
                {draw(block, index, box, unit, zone.align)}
              </div>
            ))}
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/**
 * The scene's own clock for a ground that does not report one.
 *
 * `motion.ground` exists only when the background ANIMATES — a term is reported
 * only when the composition draws it, which is what stops a number that moves on
 * a frame that does not. The continuous blocks still need a clock, so this is it:
 * the same quantity, computed the same way, for the case the motion has no reason
 * to publish.
 */
/**
 * What a palette depends on, and therefore how many of them a film resolves.
 *
 * The ground's KIND, as before — the direction of a gradient and the cell count
 * of a grid change what is painted, never what is measured — and now what the
 * scene stands its stack ON, because a `full` block is a second surface and it is
 * measured. The PAINTS and not a flag: a wave and a lit solid are two different
 * colours under the same heading, so a key that said "field" for both would hand
 * one of them the other's search. Twelve scenes still resolve at most twelve
 * palettes and usually one, which is what this memo was for: the tree is rebuilt
 * on every one of a film's 3600 frames, and behind a palette is a real search.
 */
function paletteKey(scene) {
  return `${backgroundKind(scene?.background)}:${fieldPaints(scene).join('+') || 'plain'}`
}

function progressOf(frame, durationInFrames) {
  const span = Math.max(1, durationInFrames - 1)
  return Math.min(1, Math.max(0, frame / span))
}

/**
 * @param {{timeline: object, imageSrc: Record<string, string>}} props
 */
export const ComposedSceneVideo = ({ timeline, imageSrc }) => {
  const plan = planTimeline(timeline)
  const theme = resolveTheme(timeline?.theme)

  /*
   * One palette per GROUND, not one per scene.
   *
   * `composedPalette` depends on the theme and on the ground's KIND and on
   * nothing else — the direction of a gradient, the cell count of a grid and the
   * picture behind a veil change what gets painted, never what gets measured. So
   * a film of twelve scenes resolves at most six searches, and usually one.
   *
   * It matters because this component re-renders on every frame, like every
   * composition in this directory: Remotion draws the tree again for each of the
   * 3600 frames a film can hold, and the search behind a palette really is a
   * search — an ordered walk over seven inks, a quiet ladder and a veil ladder,
   * measured against up to five grounds. `AnimatedTitlesVideo` resolves once for
   * the whole film for the same reason; this is that rule with a scene-level
   * field in the way of it.
   */
  const palettes = {}
  for (const entry of plan.scenes) {
    const key = paletteKey(entry.scene)
    if (!palettes[key]) {
      palettes[key] = composedPalette(theme, entry.scene.background, { field: fieldPaints(entry.scene) })
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      {plan.scenes.map((entry, index) => (
        <Sequence key={index} from={entry.from} durationInFrames={entry.durationInFrames}>
          <ComposedScene
            entry={entry}
            theme={theme}
            palette={palettes[paletteKey(entry.scene)]}
            imageSrc={imageSrc}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
