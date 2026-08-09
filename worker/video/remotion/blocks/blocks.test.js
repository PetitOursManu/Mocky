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
import { BLOCK_KINDS } from '../../../../server/video/timeline.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const read = (file) => fs.readFileSync(path.join(here, file), 'utf8')

/**
 * A block's source with its comments removed.
 *
 * The two checks below look for things a block must not DO, and the house style
 * is discursive enough that every one of them is named in prose somewhere — the
 * counter's header says its count walks an easeOutCubic, precisely so nobody
 * writes a second one. A check that read the comments would fail on the sentence
 * explaining why the code is right, which teaches people to delete the sentence.
 */
const code = (file) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
const sources = fs
  .readdirSync(here)
  .filter((name) => name.endsWith('.jsx'))
  .sort()

/**
 * The components AND the family modules beside them.
 *
 * `sources` is the components, because the three checks it feeds are about what a
 * COMPONENT may contain — a colour, a curve, a Remotion import. The determinism
 * check below is about the whole directory: `dataFigures.js`, `animatedText.js`
 * and their neighbours are where a "scattered" particle field or a "lively"
 * equalizer would most plausibly reach for `Math.random`, and none of them is a
 * `.jsx`.
 */
const modules = fs
  .readdirSync(here)
  .filter((name) => (name.endsWith('.js') || name.endsWith('.jsx')) && !name.endsWith('.test.js'))
  .sort()

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
    const offenders = modules.filter((name) => forbidden.test(code(name)))
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
})
