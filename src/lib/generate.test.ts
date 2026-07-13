import { describe, it, expect } from 'vitest'
import { extractCode, toPreviewModule } from './generate'

describe('extractCode', () => {
  it('extracts code between <<<MOCKY>>> and <<<END>>> sentinels', () => {
    const content = `Sure, here's your component:\n\n<<<MOCKY>>>\nconst App = () => <div>Hello</div>;\nexport default App;\n<<<END>>>\n\nLet me know if you need anything else!`
    const result = extractCode(content)
    expect(result).toBe('const App = () => <div>Hello</div>;\nexport default App;')
  })

  it('returns partial body during streaming when closing sentinel is missing', () => {
    const content = `<<<MOCKY>>>\nconst App = () => {\n  return (\n    <div>\n      <h1>Hello</h`
    const result = extractCode(content, { streaming: true })
    expect(result).toBe('const App = () => {\n  return (\n    <div>\n      <h1>Hello</h')
  })

  it('ignores prose before the opening sentinel', () => {
    const content = `I'll create a beautiful pricing page for you.\n\n<<<MOCKY>>>\nconst App = () => null;\nexport default App;\n<<<END>>>`
    const result = extractCode(content)
    expect(result).toBe('const App = () => null;\nexport default App;')
  })

  it('ignores prose after the closing sentinel', () => {
    const content = `<<<MOCKY>>>\nconst App = () => null;\nexport default App;\n<<<END>>>\n\nHope you like it!`
    const result = extractCode(content)
    expect(result).toBe('const App = () => null;\nexport default App;')
  })

  it('falls back to legacy fenced code block when no sentinels are present', () => {
    const content = 'Here is the code:\n\n```jsx\nconst App = () => <div>Hi</div>;\nexport default App;\n```\n\nDone!'
    const result = extractCode(content)
    expect(result).toBe('const App = () => <div>Hi</div>;\nexport default App;')
  })

  it('falls back to raw content when no sentinels and no fences', () => {
    const content = 'const App = () => <div>Raw</div>;\nexport default App;'
    const result = extractCode(content)
    expect(result).toBe('const App = () => <div>Raw</div>;\nexport default App;')
  })

  it('handles sentinels with surrounding whitespace and newlines', () => {
    const content = '\n\n  <<<MOCKY>>>  \n\nconst App = () => null;\nexport default App;\n\n  <<<END>>>  \n\n'
    const result = extractCode(content)
    expect(result).toBe('const App = () => null;\nexport default App;')
  })

  it('picks the largest fenced block when multiple are present (legacy mode)', () => {
    const content = '```js\nshort\n```\n\n```jsx\nconst App = () => <div>longer code here</div>;\nexport default App;\n```'
    const result = extractCode(content)
    expect(result).toBe('const App = () => <div>longer code here</div>;\nexport default App;')
  })

  it('returns empty string for empty content', () => {
    expect(extractCode('')).toBe('')
    expect(extractCode('   \n\n  ')).toBe('')
  })

  it('handles streaming with only the opening sentinel and no code yet', () => {
    const content = '<<<MOCKY>>>'
    const result = extractCode(content, { streaming: true })
    expect(result).toBe('')
  })

  it('handles non-streaming with opening sentinel but no closing one', () => {
    const content = '<<<MOCKY>>>\nconst App = () => null;\nexport default App;'
    const result = extractCode(content)
    expect(result).toBe('const App = () => null;\nexport default App;')
  })

  it('prefers sentinel over legacy fences when both are present', () => {
    const content = '```jsx\nold code\n```\n\n<<<MOCKY>>>\nconst App = () => <div>new code</div>;\nexport default App;\n<<<END>>>'
    const result = extractCode(content)
    expect(result).toBe('const App = () => <div>new code</div>;\nexport default App;')
  })
})

describe('toPreviewModule', () => {
  it('strips single-line import', () => {
    const code = `import { useState } from 'react'\nconst App = () => null;`
    expect(toPreviewModule(code)).toBe('const App = () => null;')
  })

  it('strips multi-line named import', () => {
    const code = `import {\n  PieChart,\n  Pie,\n  Cell,\n  ResponsiveContainer\n} from 'recharts'\nconst App = () => null;`
    expect(toPreviewModule(code)).toBe('const App = () => null;')
  })

  it('strips default import', () => {
    const code = `import React from 'react'\nconst App = () => null;`
    expect(toPreviewModule(code)).toBe('const App = () => null;')
  })

  it('strips mixed default + named import', () => {
    const code = `import React, { useState, useEffect } from 'react'\nconst App = () => null;`
    expect(toPreviewModule(code)).toBe('const App = () => null;')
  })

  it('strips side-effect import', () => {
    const code = `import 'tailwindcss'\nconst App = () => null;`
    expect(toPreviewModule(code)).toBe('const App = () => null;')
  })

  it('strips multiple imports', () => {
    const code = `import { useState } from 'react'\nimport { motion } from 'framer-motion'\nconst App = () => null;`
    expect(toPreviewModule(code)).toBe('const App = () => null;')
  })

  it('strips require() leftover', () => {
    const code = `const React = require('react')\nconst App = () => null;`
    expect(toPreviewModule(code)).toBe('const App = () => null;')
  })

  it('transforms export default function to function', () => {
    const code = `export default function App() { return null; }`
    expect(toPreviewModule(code)).toBe('function App() { return null; }')
  })

  it('transforms export default assignment', () => {
    const code = `const App = () => null;\nexport default App;`
    expect(toPreviewModule(code)).toBe('const App = () => null;\nconst __mockyDefault = App;')
  })

  it('strips export from named exports', () => {
    const code = `export const foo = 1\nexport function bar() { return null; }`
    expect(toPreviewModule(code)).toBe('const foo = 1\nfunction bar() { return null; }')
  })

  it('leaves code without imports unchanged (except exports)', () => {
    const code = `const App = () => {\n  const [x, setX] = useState(0);\n  return null;\n}`
    expect(toPreviewModule(code)).toBe(`const App = () => {\n  const [x, setX] = useState(0);\n  return null;\n}`)
  })
})