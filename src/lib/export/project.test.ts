import { describe, it, expect } from 'vitest'
import type { Screen } from '../project'
import { buildProjectFiles } from './project'
import { unresolvedKnownGlobals } from './rewrite'

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
      'src/lib/utils.ts', 'src/components/ui/icons.tsx', 'src/components/ui/charts.tsx',
      'src/components/ui/motion.tsx', 'components.json', 'README.md',
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
