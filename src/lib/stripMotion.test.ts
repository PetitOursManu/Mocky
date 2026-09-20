import { describe, it, expect } from 'vitest'
import { stripForbiddenMotion } from './stripMotion'

describe('stripForbiddenMotion', () => {
  it('removes an import of the animation library', async () => {
    const src = `import { motion } from "motion/react"\nconst App = () => <div/>`
    const out = await stripForbiddenMotion(src)
    expect(out.code).not.toMatch(/import/)
    expect(out.removed).toContain('import from "motion/react"')
  })

  it('removes it under every name the library ships as', async () => {
    for (const mod of ['motion', 'motion/react', 'framer-motion', 'framer-motion/dom']) {
      const out = await stripForbiddenMotion(`import { motion } from "${mod}"\nconst App = () => <div/>`)
      expect(out.removed.length, mod).toBe(1)
    }
  })

  it('turns <motion.div> into a plain element that keeps its content', async () => {
    // Degrade to the static version — the same contract as the rest of the
    // feature. A removed element would be a hole in the screen.
    const src = `const App = () => <motion.section className="hero" initial={{opacity:0}}>Bonjour</motion.section>`
    const out = await stripForbiddenMotion(src)
    expect(out.code).toContain('<section')
    expect(out.code).toContain('Bonjour')
    expect(out.code).toContain('className="hero"')
    expect(out.code).not.toMatch(/motion\./)
    expect(out.removed).toContain('<motion.section>')
  })

  it('leaves everything else alone', async () => {
    const quoted = JSON.stringify('import { motion } from "motion/react"')
    const src = [
      'const App = () => (',
      '  <Animated preset="fade-up">',
      '    <p>Une promotion sur les emotions</p>',
      `    <span title="motion.div">{${quoted}}</span>`,
      '  </Animated>',
      ')',
    ].join('\n')
    const out = await stripForbiddenMotion(src)
    // A regex would have fired on "promotion", on the title attribute and on
    // the string literal. The AST fires on none of them.
    expect(out.removed).toEqual([])
    expect(out.code).toBe(src)
  })

  it('returns the source untouched when it cannot be parsed', async () => {
    // The compiler downstream reports a syntax error far better than this can,
    // and swallowing the code would turn a fixable error into an empty screen.
    const broken = 'const App = () => <div'
    const out = await stripForbiddenMotion(broken)
    expect(out.code).toBe(broken)
    expect(out.removed).toEqual([])
  })

  it('does not parse code that cannot contain the library', async () => {
    const clean = 'const App = () => <div className="p-4">salut</div>'
    const out = await stripForbiddenMotion(clean)
    expect(out.code).toBe(clean)
    expect(out.removed).toEqual([])
  })
})

/**
 * The 3D library, held out for a reason that is not the animation one.
 *
 * A hand-written scene takes a WebGL context and never gives it back, and the
 * canvas only has about sixteen to share — so a screen somewhere else goes
 * blank. `<Scene3D>` exists so the context is granted and returned by something
 * that knows about the budget.
 */
describe('the 3D import', () => {
  it('removes an import of three, or of its React bindings', async () => {
    for (const mod of ['three', 'three/addons/controls/OrbitControls.js', '@react-three/fiber']) {
      const out = await stripForbiddenMotion(`import * as THREE from "${mod}"\nconst App = () => <div/>`)
      expect(out.removed.join(' '), mod).toContain(mod)
      expect(out.code, mod).not.toContain(`from "${mod}"`)
    }
  })

  it('leaves <Scene3D> and a stray THREE reference alone', async () => {
    // The component is the sanctioned door, and an undefined identifier is the
    // repair loop's business rather than this pass's.
    const src = 'const App = () => <Scene3D preset="orb" />\nexport default App'
    expect((await stripForbiddenMotion(src)).code).toBe(src)
    const stray = 'const App = () => { const g = new THREE.Scene(); return <div/> }'
    expect((await stripForbiddenMotion(stray)).code).toBe(stray)
  })
})
