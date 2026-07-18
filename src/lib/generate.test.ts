import { describe, it, expect } from 'vitest'
import { extractCode, toPreviewModule, sanitizeSource } from './generate'

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

describe('sanitizeSource', () => {
  it('replaces U+2028 (LINE SEPARATOR) with \\n', () => {
    const input = 'const x = 1;\u2028const y = 2;'
    expect(sanitizeSource(input)).toBe('const x = 1;\nconst y = 2;')
  })

  it('replaces U+2029 (PARAGRAPH SEPARATOR) with \\n', () => {
    const input = 'const x = 1;\u2029const y = 2;'
    expect(sanitizeSource(input)).toBe('const x = 1;\nconst y = 2;')
  })

  it('strips U+FEFF (BOM) anywhere', () => {
    const input = '\uFEFFconst x\uFEFF = 1;'
    expect(sanitizeSource(input)).toBe('const x = 1;')
  })

  it('strips C0 control chars except \\t \\n \\r', () => {
    const input = 'const\x00x\x01=\x02 1;\x0B\x0C'
    expect(sanitizeSource(input)).toBe('constx= 1;')
  })

  it('preserves \\t \\n \\r', () => {
    const input = 'const\tx = 1;\nconst y = 2;\r\n'
    expect(sanitizeSource(input)).toBe('const\tx = 1;\nconst y = 2;\n')
  })

  it('strips lone (unpaired) surrogates', () => {
    const input = 'const x = \uD800; const y = \uDC00;'
    const result = sanitizeSource(input)
    expect(result).not.toContain('\uD800')
    expect(result).not.toContain('\uDC00')
  })

  it('preserves valid surrogate pairs (emoji)', () => {
    const input = 'const emoji = \uD83D\uDE00;'
    expect(sanitizeSource(input)).toBe('const emoji = \uD83D\uDE00;')
  })

  it('normalizes \\r\\n and \\r to \\n', () => {
    expect(sanitizeSource('a\r\nb\rc')).toBe('a\nb\nc')
  })

  it('leaves clean code unchanged', () => {
    const input = 'const App = () => {\n  return React.createElement("div", null, "hello");\n};'
    expect(sanitizeSource(input)).toBe(input)
  })

  it('handles a string literal containing U+2028', () => {
    const input = 'const s = "hello\u2028world";'
    // U+2028 inside a string literal is replaced with \n — Babel tolerates it
    // but the browser's script parser treats it as a line terminator.
    expect(sanitizeSource(input)).toBe('const s = "hello\nworld";')
  })
})