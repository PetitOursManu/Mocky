import { describe, it, expect } from 'vitest'
import type { Screen } from '../project'
import { buildProjectFiles } from './project'
import { unresolvedKnownGlobals } from './rewrite'
import { PRELUDE_MODULE } from './rewrite'
import { uiFiles } from './snippets'
import { CAPABILITIES } from '../capabilities/registry'

function screen(partial: Partial<Screen> & { code: string; name: string }): Screen {
  return {
    id: partial.name.toLowerCase(),
    prompt: 'test',
    componentName: 'App',
    createdAt: 0,
    x: 0, y: 0, w: 1024, h: 720,
    device: 'none',
    links: [],
    caps: [],
    ...partial,
  }
}

const DESIGN = `# Design System
## Color tokens
- Background: #0b1020
- Surface: #141a2e
- Text: #e6e9f0
- Muted text: #94a3b8
- Primary: #22c55e (emerald-500)
- Border: #1f2740`

// Two screens exercising different implicit globals: hooks + Icon + cn, and charts.
const screens: Screen[] = [
  screen({
    name: 'Login',
    code: `function App() {
  const [show, setShow] = useState(false);
  return (
    <div className={cn('p-6')}>
      <Icon.Lock className="w-5 h-5" />
      <button onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
    </div>
  );
}
export default App`,
  }),
  screen({
    name: 'Dashboard',
    code: `function App() {
  return (
    <div className="p-6">
      <BarChart data={[{ label: 'Jan', value: 42 }]} />
      <Icon.TrendingUp className="w-5 h-5" />
    </div>
  );
}
export default App`,
  }),
]

describe('buildProjectFiles (shadcn target)', () => {
  it('emits a coherent runnable project', async () => {
    const files = await buildProjectFiles(screens, { stack: 'shadcn', designMarkdown: DESIGN, projectName: 'demo' })
    const byPath = new Map(files.map((f) => [f.name, f.content]))

    // package.json parses and has scripts + react
    const pkgRaw = byPath.get('package.json')
    expect(pkgRaw).toBeTruthy()
    const pkg = JSON.parse(pkgRaw!)
    expect(pkg.scripts.dev).toBe('vite')
    expect(pkg.dependencies.react).toBeTruthy()

    // Expected files present
    for (const p of [
      'vite.config.ts', 'tsconfig.json', 'index.html', 'tailwind.config.ts',
      'postcss.config.js', 'src/main.tsx', 'src/App.tsx', 'src/globals.css',
      'src/lib/utils.ts', 'src/components/ui/icons.jsx', 'src/components/ui/charts.jsx',
      'src/components/ui/motion.jsx', 'components.json', 'README.md',
      'src/screens/Login.tsx', 'src/screens/Dashboard.tsx',
    ]) {
      expect(byPath.has(p), `missing ${p}`).toBe(true)
    }

    // globals.css carries a --primary derived from the DESIGN.md (emerald-ish).
    const css = byPath.get('src/globals.css')!
    const primary = /--primary:\s*([^;]+);/.exec(css)?.[1].trim()
    expect(primary).toMatch(/^\d{1,3} \d{1,3}% \d{1,3}%$/)
    // #22c55e is ~142° hue — assert it's greenish, i.e. derived from DESIGN, not the default indigo.
    const hue = Number(primary!.split(' ')[0])
    expect(hue).toBeGreaterThan(100)
    expect(hue).toBeLessThan(180)

    // No screen file relies on an implicit global — every hook/Icon/chart used
    // must be imported.
    for (const path of ['src/screens/Login.tsx', 'src/screens/Dashboard.tsx']) {
      const src = byPath.get(path)!
      const unresolved = await unresolvedKnownGlobals(src)
      expect(unresolved, `${path} still uses implicit globals: ${unresolved.join(', ')}`).toEqual([])
      // and it actually imported the things it uses
      expect(src).toContain("from 'react'")
    }
    expect(byPath.get('src/screens/Login.tsx')!).toContain("@/components/ui/icons")
    expect(byPath.get('src/screens/Login.tsx')!).toContain("@/lib/utils")
    expect(byPath.get('src/screens/Dashboard.tsx')!).toContain("@/components/ui/charts")
  })

  it('plain and daisyui targets build without shadcn-only files', async () => {
    const plain = await buildProjectFiles(screens, { stack: 'plain', designMarkdown: DESIGN })
    expect(plain.find((f) => f.name === 'components.json')).toBeUndefined()
    const daisy = await buildProjectFiles(screens, { stack: 'daisyui' })
    expect(daisy.find((f) => f.name === 'tailwind.config.ts')!.content).toContain('daisyui')
  })
})

/**
 * Every pack a screen can import must arrive as a file.
 *
 * `rewrite.ts` builds its import map from the REGISTRY — every snippet-pack
 * export becomes `@/components/ui/<capability id>` — while `uiFiles()` was a
 * hand-written list of three. Four packs were therefore imported and never
 * shipped: `animate`, `scene3d`, `scrollvideo` and `motionfilm`. `<Animated>`
 * is on nearly every generated screen, so nearly every exported project failed
 * `npm run build` on a module that was not there.
 *
 * Derived from `CAPABILITIES` rather than restated, so the next pack cannot
 * repeat it: a snippet-pack with no file fails here, including a RETIRED one,
 * because a screen generated before it was retired still imports it.
 */
describe('the packs an exported project carries', () => {
  const paths = new Map(uiFiles().map((f) => [f.path, f.content]))

  it('ships a module for every snippet-pack in the registry', () => {
    for (const cap of CAPABILITIES) {
      if (cap.kind !== 'snippet-pack' || !cap.snippets) continue
      const path = `src/components/ui/${cap.id}.jsx`
      const types = `src/components/ui/${cap.id}.d.ts`
      expect(paths.has(path), `${cap.id}: no file for the module rewrite.ts imports`).toBe(true)
      // The declarations are what let a SCREEN be type-checked against a pack
      // that is plain JavaScript: without them `cn('p-6')` and `Icon.Zap` are
      // errors in the exported project's own `npm run build`.
      expect(paths.has(types), `${cap.id}: no declarations beside the module`).toBe(true)
      for (const name of cap.snippets.flatMap((s) => s.exports)) {
        expect(paths.get(path), `${cap.id} exports ${name}`).toContain(name)
        expect(paths.get(types), `${cap.id} declares ${name}`).toContain(name)
      }
    }
  })

  it('points every import the rewrite can emit at one of those files', () => {
    for (const [name, mod] of Object.entries(PRELUDE_MODULE)) {
      if (mod === '@/lib/utils') continue
      const path = `${mod.replace('@/', 'src/')}.jsx`
      expect(paths.has(path), `${name} would import ${mod}`).toBe(true)
    }
  })

  it('gives each pack the one import its source assumes', () => {
    // Written against Mocky's preview globals: React as a namespace, and `cn`
    // for the two packs that call it. A file missing that line compiles in the
    // preview and not in a project.
    for (const [path, content] of paths) {
      if (!path.endsWith('.jsx')) continue
      expect(content, path).toContain("import React")
    }
  })
})

/**
 * three.js follows the screens, not the catalogue.
 *
 * The component reads `window.THREE` — that is how the library arrives inside
 * Mocky's preview — so the exported module is what puts it there. 600 KB in
 * every export would be paying for the catalogue instead of for the screens,
 * and `<Scene3D>` without it draws its calm gradient rather than failing.
 */
describe('a project whose screens draw a 3D scene', () => {
  const withScene = [
    screen({
      name: 'Hero',
      code: `function App() {
  return (
    <section className="relative">
      <Scene3D preset="grid" className="absolute inset-0" />
      <Animated preset="fade-up"><h1>Serveurs</h1></Animated>
    </section>
  );
}`,
    }),
  ]

  it('adds three.js, pinned to the version Mocky vendors', async () => {
    const files = await buildProjectFiles(withScene, { stack: 'plain', projectName: 'Scene' })
    const pkg = JSON.parse(files.find((f) => f.name === 'package.json')!.content as string)
    expect(pkg.dependencies.three).toBeTruthy()
    const scene = files.find((f) => f.name === 'src/components/ui/scene3d.jsx')!.content as string
    expect(scene).toContain("import * as THREE from 'three'")
    expect(scene).toContain('window.THREE = THREE')
  })

  it('leaves it out of a project that never names one, and still ships the file', async () => {
    const files = await buildProjectFiles(
      [screen({ name: 'Flat', code: `function App() { return <div className="p-8">Rien</div> }` })],
      { stack: 'plain', projectName: 'Flat' },
    )
    const pkg = JSON.parse(files.find((f) => f.name === 'package.json')!.content as string)
    expect(pkg.dependencies.three).toBeUndefined()
    // The file is still there: the import map does not know which screens used what.
    const scene = files.find((f) => f.name === 'src/components/ui/scene3d.jsx')!.content as string
    // The line, not the word: the comment in that file TELLS the reader to
    // write this import, which is the one place the string legitimately is.
    expect(scene).not.toMatch(/^import \* as THREE from 'three'/m)
    expect(scene).toContain('npm i three')
  })

  it('leaves no import unresolved in a screen that uses both', async () => {
    const files = await buildProjectFiles(withScene, { stack: 'plain', projectName: 'Scene' })
    const source = files.find((f) => f.name === 'src/screens/Hero.tsx')!.content as string
    expect(source).toContain("from '@/components/ui/scene3d'")
    expect(source).toContain("from '@/components/ui/animate'")
    expect(await unresolvedKnownGlobals(source)).toEqual([])
  })
})
