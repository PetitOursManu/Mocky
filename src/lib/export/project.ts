/**
 * Assemble a RUNNABLE Vite + React + Tailwind project from a set of screens.
 * Returns a flat list of {path, content} files ready to be zipped.
 *
 * Stack targets:
 *  - 'plain'   : Tailwind + the vendored Mocky UI packs.
 *  - 'shadcn'  : same, plus a shadcn-compatible setup (components.json, the
 *                standard cn(), shadcn tailwind theme) so `npx shadcn add …`
 *                inherits the DESIGN.md brand via globals.css.
 *  - 'daisyui' : Tailwind + the daisyUI plugin.
 */
import type { Screen } from '../project'
import type { ZipEntry } from '../zip'
import { pascalCase } from '../export'
import { rewriteScreenToEsm } from './rewrite'
import { uiFiles } from './snippets'
import { globalsCssFromDesign } from './theme'

export type StackTarget = 'plain' | 'shadcn' | 'daisyui'

export interface ExportOptions {
  stack: StackTarget
  designMarkdown?: string
  projectName?: string
}

interface NamedScreen {
  screen: Screen
  /** unique PascalCase base used for the file + import alias */
  base: string
}

/** Assign unique PascalCase file bases to each screen. */
function nameScreens(screens: Screen[]): NamedScreen[] {
  const used = new Set<string>()
  return screens.map((screen) => {
    let base = pascalCase(screen.name || screen.componentName || 'Screen')
    let candidate = base
    let i = 2
    while (used.has(candidate.toLowerCase())) candidate = `${base}${i++}`
    used.add(candidate.toLowerCase())
    return { screen, base: candidate }
  })
}

// ---- static templates -------------------------------------------------------

function packageJson(name: string, stack: StackTarget): string {
  const deps: Record<string, string> = {
    react: '^18.3.1',
    'react-dom': '^18.3.1',
  }
  const devDeps: Record<string, string> = {
    '@types/react': '^18.3.12',
    '@types/react-dom': '^18.3.1',
    '@vitejs/plugin-react': '^4.3.4',
    autoprefixer: '^10.4.20',
    postcss: '^8.4.49',
    tailwindcss: '^3.4.17',
    typescript: '^5.7.2',
    vite: '^5.4.11',
  }
  if (stack === 'shadcn') {
    deps['class-variance-authority'] = '^0.7.1'
    deps['clsx'] = '^2.1.1'
    deps['tailwind-merge'] = '^2.6.0'
    deps['tailwindcss-animate'] = '^1.0.7'
    deps['lucide-react'] = '^0.468.0'
  }
  if (stack === 'daisyui') {
    devDeps['daisyui'] = '^4.12.10'
  }
  return (
    JSON.stringify(
      {
        name,
        private: true,
        version: '0.1.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'tsc && vite build',
          preview: 'vite preview',
        },
        dependencies: deps,
        devDependencies: devDeps,
      },
      null,
      2,
    ) + '\n'
  )
}

function viteConfig(): string {
  return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Classic JSX runtime so the exported screens' \`import React\` is genuinely used.
export default defineConfig({
  plugins: [react({ jsxRuntime: 'classic' })],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
`
}

function tsconfig(): string {
  return (
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react',
          // Lenient on purpose: the vendored packs and generated screens are
          // untyped and may carry unused imports. This keeps `npm run build`
          // (tsc) green without hand-annotating machine-written code.
          strict: false,
          noImplicitAny: false,
          noUnusedLocals: false,
          noUnusedParameters: false,
          baseUrl: '.',
          paths: { '@/*': ['./src/*'] },
        },
        include: ['src'],
      },
      null,
      2,
    ) + '\n'
  )
}

function indexHtml(name: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
}

function postcssConfig(): string {
  return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`
}

function tailwindConfig(stack: StackTarget): string {
  if (stack === 'shadcn') {
    return `import type { Config } from 'tailwindcss'

// shadcn-compatible theme: colors resolve to the CSS variables in globals.css,
// which are derived from your DESIGN.md. \`npx shadcn add …\` inherits the brand.
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
`
  }
  const daisy = stack === 'daisyui' ? '\n  plugins: [require(\'daisyui\')],' : ''
  return `import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },${daisy}
} satisfies Config
`
}

function mainTsx(): string {
  return `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`
}

/** A simple client-side router: a sidebar to switch between screens. */
function appTsx(named: NamedScreen[]): string {
  const imports = named
    .map((n, i) => `import Screen${i} from './screens/${n.base}'`)
    .join('\n')
  const list = named
    .map((n, i) => `  { name: ${JSON.stringify(n.screen.name || n.base)}, Component: Screen${i} }`)
    .join(',\n')
  return `import React, { useState } from 'react'
${imports}

const SCREENS = [
${list},
]

export default function App() {
  const [active, setActive] = useState(0)
  const Current = SCREENS[active]?.Component ?? (() => null)
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <nav className="w-56 shrink-0 border-r p-4 space-y-1">
        <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Screens</div>
        {SCREENS.map((s, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={\`block w-full rounded-md px-3 py-2 text-left text-sm \${i === active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}\`}
          >
            {s.name}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-auto">
        <Current />
      </main>
    </div>
  )
}
`
}

function componentsJson(): string {
  return (
    JSON.stringify(
      {
        $schema: 'https://ui.shadcn.com/schema.json',
        style: 'default',
        rsc: false,
        tsx: true,
        tailwind: {
          config: 'tailwind.config.ts',
          css: 'src/globals.css',
          baseColor: 'slate',
          cssVariables: true,
        },
        aliases: { components: '@/components', utils: '@/lib/utils' },
      },
      null,
      2,
    ) + '\n'
  )
}

/** For the shadcn target, use the standard clsx + tailwind-merge cn(). */
function shadcnUtilsTs(): string {
  return `import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`
}

function readme(name: string, stack: StackTarget, screenCount: number): string {
  const lines = [
    `# ${name}`,
    '',
    `A runnable Vite + React + Tailwind project exported from Mocky — ${screenCount} screen${screenCount === 1 ? '' : 's'}.`,
    '',
    '## Getting started',
    '',
    '```bash',
    'npm install',
    'npm run dev',
    '```',
    '',
    '`src/globals.css` carries the color tokens derived from your DESIGN.md as CSS custom properties (light + dark).',
    '',
  ]
  if (stack === 'shadcn') {
    lines.push(
      '## Adding shadcn/ui components',
      '',
      'This project is shadcn-ready — the theme tokens already live in `src/globals.css`, so components inherit your brand automatically.',
      '',
      '```bash',
      'npx shadcn@latest init   # accept the detected config (components.json is included)',
      'npx shadcn@latest add button card input',
      '```',
      '',
      'No manual theming needed: `add`ed components read the same `--primary`, `--background`, `--radius`, … tokens.',
      '',
    )
  }
  if (stack === 'daisyui') {
    lines.push(
      '## daisyUI',
      '',
      'The daisyUI plugin is enabled in `tailwind.config.ts`. Use its semantic classes (`btn`, `card`, …) directly.',
      '',
    )
  }
  lines.push(
    '## Structure',
    '',
    '- `src/screens/*` — one component per screen.',
    '- `src/components/ui/*` — inline icon / chart / motion components (no external UI library).',
    '- `src/lib/utils.ts` — the `cn()` class-name helper.',
    '',
  )
  return lines.join('\n')
}

// ---- assembly ---------------------------------------------------------------

/**
 * Build every file of the exported project. Async because the screen rewrite
 * uses Babel to analyze scope.
 */
export async function buildProjectFiles(
  screens: Screen[],
  opts: ExportOptions,
): Promise<ZipEntry[]> {
  const name = (opts.projectName || 'mocky-app').replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase() || 'mocky-app'
  const named = nameScreens(screens)
  const files: ZipEntry[] = []

  // Root config
  files.push({ name: 'package.json', content: packageJson(name, opts.stack) })
  files.push({ name: 'vite.config.ts', content: viteConfig() })
  files.push({ name: 'tsconfig.json', content: tsconfig() })
  files.push({ name: 'index.html', content: indexHtml(name) })
  files.push({ name: 'tailwind.config.ts', content: tailwindConfig(opts.stack) })
  files.push({ name: 'postcss.config.js', content: postcssConfig() })

  // src entry + router
  files.push({ name: 'src/main.tsx', content: mainTsx() })
  files.push({ name: 'src/App.tsx', content: appTsx(named) })
  files.push({ name: 'src/globals.css', content: globalsCssFromDesign(opts.designMarkdown) })

  // Vendored UI packs (+ cn). For shadcn, override utils with the standard cn.
  for (const f of uiFiles()) {
    if (opts.stack === 'shadcn' && f.path === 'src/lib/utils.ts') {
      files.push({ name: f.path, content: shadcnUtilsTs() })
    } else {
      files.push({ name: f.path, content: f.content })
    }
  }

  // Screens (rewritten to explicit ESM)
  for (const n of named) {
    const { source } = await rewriteScreenToEsm(n.screen.code)
    files.push({ name: `src/screens/${n.base}.tsx`, content: source })
  }

  // shadcn config
  if (opts.stack === 'shadcn') {
    files.push({ name: 'components.json', content: componentsJson() })
  }

  files.push({ name: 'README.md', content: readme(name, opts.stack, screens.length) })
  return files
}
