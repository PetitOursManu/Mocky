// The block registry, against the schema that names the blocks.
//
// Everything in this file is about one failure: a `kind` the schema accepts with
// nothing behind it. That is not a crash — the composition draws the rest of the
// scene and leaves a hole where the block was — so it ships as a successful
// export missing the thing it was cut to deliver, which is the same shape as an
// unknown key accepted in silence and the reason the whole schema is `.strict()`.
//
// It imports `server/video/timeline.js` for the schema's own list. That import is
// TEST-ONLY and must stay that way, exactly as it is in `validate.test.js`: the
// Docker build copies `worker/video/` and nothing else, so a runtime import of
// anything under `server/` produces a container that boots and then fails every
// render on a missing module.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BLOCKS, blockComponent } from './index.js'
import { BLOCK_APPETITE } from '../composition.js'
import { BLOCK_KINDS } from '../../../../server/video/timeline.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const read = (file) => fs.readFileSync(path.join(here, file), 'utf8')
/** The directory above: the six compositions and the arithmetic they share. */
const above = path.resolve(here, '..')
const readAbove = (file) => fs.readFileSync(path.join(above, file), 'utf8')

/**
 * A block's source with its comments removed.
 *
 * The two checks below look for things a block must not DO, and the house style
 * is discursive enough that every one of them is named in prose somewhere — the
 * counter's header says its count walks an easeOutCubic, precisely so nobody
 * writes a second one. A check that read the comments would fail on the sentence
 * explaining why the code is right, which teaches people to delete the sentence.
 */
const strip = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
const code = (file) => strip(read(file))
const sources = fs
  .readdirSync(here)
  .filter((name) => name.endsWith('.jsx'))
  .sort()

/**
 * The components, the family modules beside them, AND the directory above.
 *
 * `sources` is the components, because the three checks it feeds are about what a
 * COMPONENT may contain — a colour, a curve, a Remotion import. The determinism
 * check below is about the whole renderer: `dataFigures.js`, `animatedText.js`
 * and their neighbours are where a "scattered" particle field or a "lively"
 * equalizer would most plausibly reach for `Math.random`, and none of them is a
 * `.jsx`.
 *
 * The parent directory is in the list for the same reason one directory later:
 * the scan used to stop at `blocks/`, so `composition.js` — which owns every
 * quantity that changes between two frames — and the six compositions that read it
 * were the one part of the renderer where a die or a clock would have gone
 * unnoticed. `groundDensity` is a sine of the scene's own progress precisely
 * because a "shimmering" texture is where somebody reaches for a random, and the
 * check has to cover the file that would tempt them.
 */
const renderable = (name) => (name.endsWith('.js') || name.endsWith('.jsx')) && !name.endsWith('.test.js')
const modules = [
  ...fs.readdirSync(here).filter(renderable).sort().map((name) => [name, read(name)]),
  ...fs
    .readdirSync(above, { withFileTypes: true })
    .filter((entry) => entry.isFile() && renderable(entry.name))
    .map((entry) => entry.name)
    .sort()
    .map((name) => [`../${name}`, readAbove(name)]),
]

describe('the registry', () => {
  /**
   * Both directions, because the two failures are different.
   *
   * A kind in the schema with no component is a document Mocky validates, queues
   * and charges a render for, which then draws nothing where the block was. A
   * component with no kind is unreachable — cheaper, and still a lie, because it
   * reads as a feature.
   */
  it('has a component for every block kind, and no others', () => {
    expect(Object.keys(BLOCKS).sort()).toEqual([...BLOCK_KINDS].sort())
  })

  it('lists the kinds in the schema’s own order, so a reader can compare the two files', () => {
    expect(Object.keys(BLOCKS)).toEqual([...BLOCK_KINDS])
  })

  it('has one file per kind, named after it', () => {
    expect(sources.filter((name) => !name.endsWith('.test.jsx'))).toEqual([...BLOCK_KINDS].sort().map((k) => `${k}.jsx`))
  })

  it('resolves a kind to something React can render', () => {
    for (const kind of BLOCK_KINDS) expect(typeof blockComponent(kind), kind).toBe('function')
  })

  /**
   * `Object.hasOwn` and not a plain lookup, for the reason `dimensionsFor` and
   * `overlayAlignment` both spell out: a lookup answers for the prototype chain,
   * so `kind: "constructor"` hands back a function — and a function is exactly
   * what the caller is looking for, so nothing downstream notices until React
   * tries to render `Object`.
   */
  it('does not resolve a name it inherited from Object', () => {
    for (const inherited of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
      expect(blockComponent(inherited), inherited).toBe(null)
    }
    expect(blockComponent(undefined)).toBe(null)
    expect(blockComponent('video')).toBe(null)
  })
})

describe('what a block may not contain', () => {
  /**
   * The import rule, and it is load-bearing rather than tidy.
   *
   * A block that reached for `useCurrentFrame` would take this whole file out of
   * Mocky's suite — Remotion is not installed here and never will be, because its
   * licence is the reason the worker is a separate image at all. The test above
   * would then be untestable, which is a much larger loss than whatever the hook
   * was for. The frame arrives as `progress` and `life`; there is nothing to
   * reach for.
   */
  it('imports no Remotion package, anywhere in the directory', () => {
    const offenders = sources.filter((name) => /from\s+['"](@remotion\/[^'"]+|remotion)['"]/.test(code(name)))
    expect(offenders).toEqual([])
  })

  /**
   * No colour is written in a block, and this is the check that makes the
   * sentence true rather than a convention.
   *
   * Every colour a film carries is either a token the direction DECLARED or a
   * default somebody chose once, and both arrive through `composedPalette`, which
   * measured them against the surface the block is really painted on. A hex value
   * typed into a component is a colour nobody measured — the exact defect that
   * shipped a dark green headline on a near-black frame — and it would be
   * invisible to every test in `composition.test.js`, because that file measures
   * the palette and not the components.
   */
  it('writes no colour of its own', () => {
    const offenders = sources
      .map((name) => [name, code(name).match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g)])
      .filter(([, hits]) => hits)
    expect(offenders.map(([name, hits]) => `${name}: ${hits.join(', ')}`)).toEqual([])
  })

  /**
   * And no material paints through the renderer's own tone curve.
   *
   * react-three-fiber turns ACES Filmic tone mapping ON by default. It is a
   * curve whose purpose is to be non-linear, applied AFTER the light has been
   * computed — so a colour chosen by measuring it against a ground reaches the
   * frame as something else. Measured on the shipped `waveMesh`: a material of
   * `#f2f2f2` came off the renderer at 200 and its darkest face at 163, against
   * the 242 and 133 the palette measured and cleared. Lower at both ends, and on
   * a dark ground lower is LESS contrast than what was measured — the one
   * direction the guarantee cannot absorb.
   *
   * `extrudedType` has always known this and said so in its header; the other
   * eight GL blocks shipped without it, which is the shape of defect this check
   * exists for. A rule in one header is a rule the tenth block does not read.
   * The arithmetic that goes with it is `shading.js`.
   */
  it('paints through no tone curve: a material is the colour that was measured', () => {
    const offenders = []
    for (const name of sources) {
      for (const tag of code(name).match(/<(?:mesh\w*Material|pointsMaterial|lineBasicMaterial)\b[^>]*>/g) ?? []) {
        if (!/toneMapped=\{false\}/.test(tag)) offenders.push(`${name}: ${tag.replace(/\s+/g, ' ').slice(0, 60)}`)
      }
    }
    expect(offenders).toEqual([])
  })

  /**
   * And no easing curve either.
   *
   * `easeOutCubic` is the house curve and `cueProgress` is the one notion of "an
   * element arrives"; a component computing its own is a twenty-fifth notion, and
   * the one thing that most makes motion read as generated is exactly this — a
   * linear entrance beside eased ones. The blocks receive `progress` already
   * eased, so a `Math.pow` on it is somebody easing twice.
   */
  it('eases nothing itself: the curve arrives already applied', () => {
    const offenders = sources.filter((name) => /\beasing\b|cubic-bezier|easeIn|easeOut/.test(code(name)))
    expect(offenders).toEqual([])
  })

  /**
   * Nothing here may read a die or a clock.
   *
   * Two renders of one document have to produce the same bytes, and it is not a
   * taste: the export store is CONTENT-ADDRESSED, so a film that differs by one
   * dithered pixel between two runs is filed as two films, charged twice against
   * the same disk budget, and impossible to deduplicate afterwards. The clock is
   * the same failure wearing the other hat — `ClockBlockSchema.time` exists
   * precisely so a dial shows what the DOCUMENT said and never the hour a
   * container in another timezone happened to start work.
   *
   * A directory-wide scan rather than a rule in a header, because the tempting
   * call is not in the components: it is in the family modules, where a field of
   * particles or an equalizer's bars want to look scattered. The house answer to
   * that is a deterministic curve driven by `life` — `equalizerLevels` and
   * `waveHeights` are what it looks like — and this is what keeps the next author
   * from reaching past it.
   */
  it('reads no die and no clock: one document renders to one film', () => {
    const forbidden = /\bMath\.random\b|\bDate\.now\b|\bnew Date\b|\bperformance\.now\b|getRandomValues|randomUUID/
    const offenders = modules.filter(([, source]) => forbidden.test(strip(source))).map(([name]) => name)
    expect(offenders).toEqual([])
  })

  /**
   * Guarding the guard: the scan above is a loop over files, and a loop over the
   * wrong glob is green for having read nothing. It has to see both directories —
   * the twenty-seven components, the six family modules beside them, and the six
   * compositions with the arithmetic they share.
   */
  it('scans the whole renderer and not just this directory', () => {
    const names = modules.map(([name]) => name)
    expect(names.length).toBeGreaterThan(BLOCK_KINDS.length)
    expect(names).toContain('index.js')
    expect(names).toContain('../composition.js')
    expect(names).toContain('../ComposedSceneVideo.jsx')
    expect(names.filter((name) => name.endsWith('.test.js'))).toEqual([])
  })

  /**
   * A corner radius is bounded by the thing it rounds, and nothing may write the
   * theme's own number straight into a style.
   *
   * `radiusPx` is one of the three `CONSTANT_METRICS`: read off the theme rather
   * than off a box, because a corner that grew with its card is a card that
   * changed shape between two scenes. The exception has a CEILING —
   * `CONSTANT_CEILING` of whatever it rounds — and two blocks shipped without it,
   * `codeBlock` and `textHighlight`, while five of their neighbours clamped
   * theirs. `ThemeSchema` accepts up to 9999 px and a direction stating an
   * ordinary 40 px drew a marked word inside a lozenge.
   *
   * A source check rather than an arithmetic one, because this is the one part of
   * the rule that lives in the `.jsx`: `blockExtent` cannot see a `borderRadius`,
   * and a `.jsx` cannot be imported here. Same shape as the colour check above,
   * and it catches the same class of thing — a value that reached the frame
   * without passing the function that bounds it.
   */
  it('never writes the theme’s radius into a style without bounding it', () => {
    const offenders = sources
      .map((name) => [name, code(name).match(/borderRadius:[^,\n]*/g) ?? []])
      .flatMap(([name, hits]) =>
        hits
          .filter((hit) => /radiusPx/.test(hit) && !/(constantMetric|figureRadius|panelRadius|markerRadius)\(/.test(hit))
          .map((hit) => `${name}: ${hit.trim()}`),
      )
    expect(offenders).toEqual([])
  })

  /**
   * Every block states its contract at the top, and the three things it has to
   * state are the three a reviewer of a finished block has to check.
   *
   * A block whose header does not name its surface is a block whose author has
   * not decided which of `palette.display`, `palette.panelBody` and
   * `palette.onFill` it is entitled to — and that decision, taken wrong, is
   * invisible until somebody watches an mp4.
   */
  it('states its props, its surface and its legibility rule', () => {
    for (const name of sources) {
      const source = read(name)
      expect(source, name).toContain('PROPS')
      expect(source, name).toContain('SURFACE:')
      expect(source, name).toContain('LEGIBILITY:')
    }
  })

  /**
   * A run that wraps keeps `word-break`, and it is the LAST resort rather than the
   * wrapping model.
   *
   * The declaration was put here when it was read as the model: `textLines` packs
   * characters against the measure — 20 characters across a measure that holds 9
   * is three lines — and a browser left to itself breaks between words, so one
   * long word puts more type on a line than the layout reserved room for. Reading
   * it that way is what shipped `NEUF SEIZIEMES` as `NEUF S` / `EIZIEME` / `S`: a
   * word cut through the middle is the one failure in this feature a viewer reads
   * as broken software. The SIZE is bounded now — `wordCeiling` in
   * `composition.js` — so a word fits its line and this declaration does nothing.
   *
   * It stays because of the floor. A word longer than its measure at every legible
   * size is a URL or a German compound, and there the bound stops and breaking is
   * the decided lesser evil; without this line that word would run out of the box
   * instead. Checked from the WEIGHT TABLE rather than from a list somebody keeps:
   * a kind whose runs are all `nowrap` is bounded by `cappedByWidth` and needs
   * nothing, and a kind that gains a wrapping run gains this obligation with it.
   */
  it('keeps a break of last resort on every wrapping run, for the word no size can hold', () => {
    // Enough of a block to make every `runs()` in the table answer: the arrays are
    // what `animatedList`, `form` and `codeBlock` map over, and an empty one would
    // report a kind as having no wrapping run at all.
    const sample = { items: ['x'], fields: ['x'], labels: ['x'], lines: [{ text: 'x' }] }
    const wrapping = Object.entries(BLOCK_APPETITE)
      .filter(([, appetite]) => appetite.runs(sample).some((run) => !run?.nowrap))
      .map(([kind]) => kind)
    expect(wrapping.length).toBeGreaterThan(10)
    for (const kind of wrapping) expect(code(`${kind}.jsx`), kind).toContain('wordBreak')
  })
})
