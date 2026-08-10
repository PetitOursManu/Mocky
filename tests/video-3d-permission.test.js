import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { THREE_D_BLOCKS } from '../server/video/three-d.js'
import { BLOCK_KINDS } from '../server/video/timeline.js'
// The worker's legibility table. `composition.js` holds no React and no Remotion
// — that is the rule its own header states — so importing it here costs this
// suite nothing, and it is the only way to ask the last question below: does
// every block this file rations also declare the surface it paints?
import { FIELD_PAINTS, FIELD_PAINT_KINDS } from '../worker/video/remotion/composition.js'

/**
 * The tripwire under the 3D permission, and the direction it guards is the one
 * a unit test cannot reach.
 *
 * `server/video/three-d.js` names the blocks that are drawn in 3D, and its own
 * test proves every name in it is a real block kind. That is the harmless
 * direction: a stale name guards nothing and breaks nothing. The dangerous one
 * is the opposite — somebody adds a second 3D block, writes its component, its
 * schema entry and its card, and never opens the permission file. The block is
 * then offered to every account, refused by nobody, and the administrator's
 * setting silently covers one block out of two. Nothing about that fails, and
 * nothing about it is visible: the feature works.
 *
 * So the list is compared against the WORKER, which is where three-dimensionality
 * actually lives. A 3D block is one whose component returns react-three-fiber
 * intrinsics — `<mesh>`, `<boxGeometry>`, `<meshLambertMaterial>` — because that
 * is precisely the property `ComposedSceneVideo` uses to decide what to wrap in a
 * `ThreeCanvas`, and precisely what costs the render time the permission
 * rations. A block that draws with divs is not 3D whatever it is called.
 *
 * The files are read as TEXT, like `tests/video-worker-separation.test.js` and
 * for the same reason: `worker/video/` has its own manifest, Remotion and
 * `three` are installed there and nowhere else, and this suite must run on a
 * checkout that has never entered that directory.
 *
 * What it deliberately does NOT do is derive the list. A regexp over source is a
 * good alarm and a bad definition — a block could grow an intrinsic in a comment
 * or lose one to a refactor — so the list stays hand-written and argued, and
 * this only refuses to let the two disagree.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BLOCKS_DIR = path.join(root, 'worker/video/remotion/blocks')

/**
 * The r3f intrinsics that mean "this draws in GL".
 *
 * Lower-case JSX tags the reconciler resolves at render time, the same way
 * react-dom resolves `<div>`. None of them is a valid HTML element, which is
 * what makes the set safe to match on: there is no flat block that could
 * legitimately contain `<meshStandardMaterial`.
 */
const INTRINSIC = /<(mesh|group|points|line2|instancedMesh|ambientLight|pointLight|directionalLight|spotLight|hemisphereLight|perspectiveCamera|orthographicCamera|[a-z][A-Za-z]*Geometry|[a-z][A-Za-z]*Material)[\s/>]/

/** Every component file in the registry's directory, by the kind it draws. */
function blockFiles() {
  return fs
    .readdirSync(BLOCKS_DIR)
    .filter((name) => name.endsWith('.jsx') && !name.endsWith('.test.jsx'))
    .map((name) => ({ kind: name.replace(/\.jsx$/, ''), file: `worker/video/remotion/blocks/${name}` }))
}

describe('the 3D block list and the worker agree', () => {
  it('found the components', () => {
    // A directory read that silently matched nothing would make every case
    // below vacuously true, which is the one way this file could stop working
    // without anybody noticing.
    expect(blockFiles().length).toBeGreaterThan(10)
  })

  it('names every component that renders a react-three-fiber intrinsic', () => {
    const drawn = blockFiles()
      .filter(({ file }) => INTRINSIC.test(fs.readFileSync(path.join(root, file), 'utf8')))
      .map(({ kind }) => kind)

    expect(
      drawn.sort(),
      'a block that draws in GL must be listed in server/video/three-d.js, or the permission does not cover it',
    ).toEqual([...THREE_D_BLOCKS].sort())
  })

  it('names blocks that are in the catalogue', () => {
    for (const kind of THREE_D_BLOCKS) expect(BLOCK_KINDS, kind).toContain(kind)
  })

  /**
   * The other end of the same wire: a 3D block still has a component, so a name
   * on the list with no file is a permission guarding nothing.
   */
  it('names blocks the worker has a component for', () => {
    const files = new Set(blockFiles().map(({ kind }) => kind))
    for (const kind of THREE_D_BLOCKS) expect([...files], kind).toContain(kind)
  })

  /**
   * And every one of them says what it PAINTS, because the default is a guess
   * that is wrong for half this family.
   *
   * `FIELD_PAINTS` is how a block anchored `full` enters the legibility
   * measurement, and a kind with no row falls through to `DEFAULT_FIELD_PAINT` —
   * the accent. That default is right for a scatter of specks and a floor of
   * rules, and it is wrong for every LIT surface here: a solid, a wave, a picture
   * panel and a chart are painted at two brightnesses of `palette.solid`, and an
   * extruded line paints its faces in the display ink. Measured as the accent,
   * the search dims a surface nothing on the frame carries and leaves the heading
   * standing on it exactly as unreadable as before — which is the failure
   * `solidScene` shipped and the whole reason the table exists.
   *
   * The check is on the 3D list rather than on the catalogue because a flat block
   * that really does paint the accent is right to say nothing. What no block
   * drawn by a renderer may do is inherit an answer: it is the family whose
   * surfaces are largest, whose colours a reader cannot infer from the kind, and
   * whose omission has already cost two real exports.
   */
  it('gives every 3D block an explicit paint, rather than the default', () => {
    for (const kind of THREE_D_BLOCKS) {
      expect(
        Object.hasOwn(FIELD_PAINTS, kind),
        `${kind} is drawn by a renderer and names no paint in FIELD_PAINTS, so it is measured as the accent`,
      ).toBe(true)
      // A value may be a LIST: the two picture stages paint a lit body AND a
      // photograph, and neither of them covers the other.
      for (const paint of Array.isArray(FIELD_PAINTS[kind]) ? FIELD_PAINTS[kind] : [FIELD_PAINTS[kind]]) {
        expect(FIELD_PAINT_KINDS, kind).toContain(paint)
      }
    }
  })
})
