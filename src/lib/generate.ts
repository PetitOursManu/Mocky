import type { Settings } from './settings'
import { proxyFetch, truncate } from './proxy'
import type { Capability } from './capabilities/types'

export const SYSTEM_PROMPT = `You are an expert React + Tailwind CSS UI engineer. Given a description of a screen, you output a single self-contained React component that renders a polished, production-ready interface — never a wireframe.

STRICT OUTPUT RULES:
- Respond with EXACTLY the following format and NOTHING else:
  <<<MOCKY>>>
  ...your complete component code...
  <<<END>>>
- No markdown fences. No prose before the opening sentinel. No prose after the closing sentinel.
- Output ONLY finished code — no "thinking out loud" or meta commentary inside it. Do NOT write comments like "// I will use…", "// Let's use…", "// Now I'll add…", or notes weighing options. Such comments derail the JSX structure and cause syntax errors. Decide, then write the clean code. A rare one-line comment labelling a section is fine; a running narration is not.
- Write plain JavaScript with JSX. Do NOT use TypeScript type annotations.
- Do NOT write any import statements and do NOT use named exports. React and all of its hooks (useState, useEffect, useRef, useMemo, useCallback, etc.) are available as globals — call them directly, e.g. const [open, setOpen] = useState(false).
- Define exactly ONE top-level component named App, and end the file with: export default App
- Style everything with Tailwind utility classes only. No external CSS files, no styled-components, no third-party UI/icon libraries.
- Do not fetch from the network and do not use <img> with external URLs. Use inline SVG, emoji, or solid-color placeholder divs instead.
- A JSX tag name must be a bare identifier (<Card />) or a dot path (<Icon.Home />). NEVER put bracket access, a call, or any other expression in the tag position: <Icon[item.icon] />, <icons[name] />, <getIcon() /> are all SYNTAX ERRORS. To pick a component dynamically, first assign it to a Capitalized variable (JSX treats lowercase names as HTML tags), then render that variable — e.g. const Ico = Icon[item.icon]; return <Ico className="w-6 h-6" />. Equivalently, use React.createElement(Icon[item.icon], { className: 'w-6 h-6' }).
- Only render components that actually exist. "Icon" is a PRE-DEFINED global namespace — NEVER declare your own "const Icon = {...}" or "var Icon" (it collides with the built-in: "Identifier 'Icon' has already been declared" is fatal). Use only the icon names listed in the capabilities section below. If you need an icon that is genuinely absent (e.g. a brand logo like Google/Apple), define a SEPARATE, uniquely-named component (e.g. const GoogleLogo = () => (<svg .../>)) — never touch Icon. Rendering an undefined component crashes with "Element type is invalid: got undefined"; when picking dynamically, guard it: const Ico = Icon[name] || Icon.MoreHorizontal.

SYNTAX VERIFICATION (CRITICAL):
- Before sending your response, mentally re-read your entire code and verify it is syntactically valid JSX/JavaScript.
- Pay special attention to: balanced braces {}, parentheses (), and brackets []; closed string literals (every quote and backtick must have a matching close); correct template literal syntax (every \` must be closed with a matching \`, and every \${ must be closed with }); no stray or missing characters around className expressions; all tags properly opened and closed.
- If you find any syntax error, fix it before outputting. Your code MUST compile without errors on the first try.

VISUAL QUALITY REQUIREMENTS:
- Build a REAL finished UI, not a wireframe or a gray box mock-up. Use a complete, modern color palette (slate/indigo/emerald/amber/rose as appropriate), subtle shadows, rounded corners, and clear visual hierarchy.
- NEVER use generic placeholder text like "Lorem ipsum", "Sample text", "Content here", or repeated gray rectangles. Write realistic, context-aware copy (labels, values, names, numbers, taglines, CTA text).
- Every interactive element MUST have visible states: hover, active/focus rings, disabled opacity, and cursor pointers.
- Use appropriate whitespace: generous padding, consistent gaps, readable font sizes, and aligned grids. No crushed text or misaligned elements.
- Cards, buttons, inputs, badges, and nav should look professional and on-brand. Use gradients or accent colors sparingly but deliberately.
- Include realistic initial data: names, prices, stats, notifications, avatars (initials or emoji), chart bars, list items, etc.
- Prefer inline SVG icons over emoji when they make the UI cleaner; keep emoji style consistent if used.
- The result must look like a screenshot from a real SaaS/mobile/desktop app, ready to be dropped into a prototype or product demo.`

export interface GeneratedComponent {
  /** Raw assistant message content. */
  raw: string
  /** Cleaned component source (with `export default App`), for the code view and export. */
  code: string
  /** Detected component identifier to mount in the preview. */
  componentName: string
}

interface OllamaChatResponse {
  message?: { role?: string; content?: string }
  // OpenAI-compatible shape, in case a future provider uses /v1/chat/completions
  choices?: Array<{ message?: { content?: string } }>
}

interface ChatMessage {
  role: string
  content: string
  /** base64 image data (no data-URL prefix) for vision-capable models. */
  images?: string[]
}

/** Strip the `data:image/...;base64,` prefix so Ollama gets raw base64. */
export function stripDataUrl(dataUrl: string): string {
  const i = dataUrl.indexOf('base64,')
  return i >= 0 ? dataUrl.slice(i + 'base64,'.length) : dataUrl
}

/** Shared chat call: posts messages and returns the assistant content.
 *  If `onChunk` is provided, uses streaming mode (stream: true) and invokes
 *  the callback with each incremental content piece as it arrives. */
async function chat(
  s: Settings,
  messages: ChatMessage[],
  signal?: AbortSignal,
  onChunk?: (partial: string) => void,
): Promise<string> {
  const useStream = !!onChunk
  const body = JSON.stringify({
    model: s.model,
    stream: useStream,
    messages,
    options: { temperature: 0.4, num_ctx: 32768, num_predict: 8192 },
  })

  let res: Response
  try {
    res = await proxyFetch(s, '/api/chat', { method: 'POST', body, signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err
    throw new Error(`Network error: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(`Authentication failed (HTTP ${res.status}). Check your API key in Settings.`)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let detail = text
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed.error === 'string') detail = parsed.error
    } catch {
      // not JSON — use raw text
    }
    throw new Error(`HTTP ${res.status} from provider. ${truncate(detail, 300)}`)
  }

  if (!useStream) {
    const data = (await res.json()) as OllamaChatResponse
    const content = data.message?.content ?? data.choices?.[0]?.message?.content ?? ''
    if (!content.trim()) throw new Error('The model returned an empty response.')
    return content
  }

  // --- Streaming: parse NDJSON (one JSON object per line) ---
  const reader = res.body?.getReader()
  if (!reader) {
    // Streaming not supported by the transport — fall back to full JSON.
    const data = (await res.json()) as OllamaChatResponse
    const content = data.message?.content ?? data.choices?.[0]?.message?.content ?? ''
    if (!content.trim()) throw new Error('The model returned an empty response.')
    onChunk(extractCode(content))
    return content
  }
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const obj = JSON.parse(trimmed)
        const piece = obj.message?.content ?? obj.choices?.[0]?.delta?.content ?? ''
        if (piece) {
          full += piece
          onChunk?.(full)
        }
      } catch {
        // partial JSON — ignore, will be completed on next chunk
      }
    }
  }
  // flush remaining buffer
  if (buffer.trim()) {
    try {
      const obj = JSON.parse(buffer.trim())
      const piece = obj.message?.content ?? obj.choices?.[0]?.delta?.content ?? ''
      if (piece) {
        full += piece
        onChunk?.(full)
      }
    } catch {
      // ignore
    }
  }
  if (!full.trim()) throw new Error('The model returned an empty response.')
  return full
}

/**
 * Builds the CAPABILITIES section for the system prompt. Lists only the
 * selected components with their signature + description, and states that
 * they are already in scope and MUST NOT be imported.
 */
function buildCapabilitiesPrompt(caps: Capability[]): string {
  const items: string[] = []
  const hasCharts = caps.some((c) => c.id === 'charts')
  const hasIcons = caps.some((c) => c.id === 'icons')
  for (const cap of caps) {
    if (cap.kind === 'cdn-css') {
      items.push(`- CSS library "${cap.id}" is loaded. Use its classes directly in className.`)
    } else if (cap.kind === 'cdn-script' && cap.cdn?.global) {
      const names = cap.globals ? cap.globals.join(', ') : cap.cdn.global
      items.push(`- Library "${cap.id}": ${names} are ALREADY DEFINED as globals. Use them directly by name.`)
    } else if (cap.kind === 'snippet-pack' && cap.components) {
      for (const comp of cap.components) {
        items.push(`- ${comp.name}: ${comp.signature} — ${comp.description}`)
      }
    }
  }
  if (items.length === 0) return ''
  const lines = [
    '',
    'CAPABILITIES — ALREADY IN SCOPE (read carefully):',
    'The following components and libraries are ALREADY DEFINED as globals in the runtime scope.',
    'You MUST NOT write any import statement for them — there is no module system in the sandbox.',
    'Writing "import" will break the render. Use them directly by name.',
    'Do NOT redeclare or stub any of them. Writing "const LineChart = () => null", "function BarChart() {...}", "var Icon = {}" (etc.) collides with the built-in and is a fatal "Identifier already declared" error — they already work, just call them as-is.',
    '',
    ...items,
  ]
  if (hasCharts) {
    const chartCap = caps.find((c) => c.id === 'charts')
    const chartNames = chartCap?.components?.map((c) => c.name).join(', ') || ''
    lines.push('')
    lines.push('IMPORTANT: Recharts is NOT available. Never write Recharts.xxx or import any chart library.')
    lines.push('Use the chart components listed above (' + chartNames + ').')
    lines.push('DonutChart already renders the total in its center AND a legend beside it — do NOT add your own center label or a second legend, or they overlap.')
  }
  if (hasIcons) {
    lines.push('')
    lines.push('ICONS: use <Icon.Search className="w-5 h-5" /> (or Icon.Home, Icon.Bell, Icon.User, Icon.Settings, etc.).')
    lines.push('NEVER hand-write an inline <svg><path d="..."/></svg> — long path data gets truncated mid-string and breaks the render.')
    lines.push('If the icon you need is not in the list above, pick the closest one.')
  }
  const hasMotion = caps.some((c) => c.id === 'motion')
  if (hasMotion) {
    const motionCap = caps.find((c) => c.id === 'motion')
    const motionNames = motionCap?.components?.map((c) => c.name).join(', ') || ''
    lines.push('')
    lines.push('ANIMATION: use the components listed above (' + motionNames + ').')
    lines.push('framer-motion is NOT available — never write <motion.div> or import any animation library.')
  }
  return lines.join('\n')
}

/**
 * Calls the configured provider's chat endpoint asking for a single
 * self-contained React component. `extraSystem` carries the DESIGN.md preamble.
 */
export async function generateComponent(
  s: Settings,
  userPrompt: string,
  extraSystem?: string,
  images?: string[],
  signal?: AbortSignal,
  onChunk?: (partialCode: string) => void,
  caps?: Capability[],
  planSection?: string,
): Promise<GeneratedComponent> {
  const capsPrompt = caps ? buildCapabilitiesPrompt(caps) : ''
  const baseSystem = extraSystem ? `${extraSystem}\n\n${SYSTEM_PROMPT}` : SYSTEM_PROMPT
  const system = [baseSystem, capsPrompt, planSection].filter(Boolean).join('\n')
  const content = await chat(
    s,
    [
      { role: 'system', content: system },
      { role: 'user', content: withImageNote(userPrompt, images), images: images?.map(stripDataUrl) },
    ],
    signal,
    onChunk ? (full) => onChunk(extractCode(full, { streaming: true })) : undefined,
  )
  const code = extractCode(content)
  const componentName = detectComponentName(code)
  return { raw: content, code, componentName }
}

/** Prepend a note so the model knows the attached reference images are numbered. */
function withImageNote(prompt: string, images?: string[]): string {
  if (!images || images.length === 0) return prompt
  const refs = images.map((_, i) => `[${i + 1}]`).join(', ')
  return `I've attached ${images.length} reference screenshot${images.length === 1 ? '' : 's'} (numbered ${refs}). Use them as visual context; the user may refer to them by number.\n\n${prompt}`
}

/**
 * Build a system section instructing the model to reproduce the shared
 * navigation/layout from a pinned "reference" screen, so newly generated
 * screens in a project stay visually consistent (same nav/header/sidebar).
 */
export function buildLayoutReference(referenceCode: string): string {
  return [
    'SHARED LAYOUT — the screens of this project share a common navigation/layout. A reference screen is pinned below.',
    'Reproduce that shared chrome in THIS screen faithfully: the same top nav / sidebar / header / tab bar the reference uses — same items, labels, order, icons, colors and styling. Then build the requested content in the main area.',
    'Do NOT invent a different navigation, rename its items, or omit it. Only the main content changes to match the request; the shared parts stay consistent. If the request names a destination that exists in the nav, mark it as the active item.',
    'Reference screen source:',
    referenceCode.trim(),
  ].join('\n')
}

export const EDIT_RULES = `You are EDITING an existing screen, not designing a new one. The single most important rule:

PRESERVE EVERYTHING THAT THE USER DID NOT EXPLICITLY ASK TO CHANGE.
- Treat the provided source as the source of truth. Change ONLY what the instruction explicitly requests.
- Keep every other detail byte-for-byte identical: all text/content, colors, Tailwind classes, spacing, sizes, layout, structure, order of elements, state, hooks, and behaviour.
- Do NOT redesign, refactor, rename, reformat, reorder, restyle, "clean up", "improve", or modernise anything that was not requested.
- Do NOT add, remove, or rename features, sections, props, or imports beyond the requested change.
- If the instruction is ambiguous, make the smallest possible change that satisfies it and leave the rest untouched.
- Return the COMPLETE updated component (the whole file, not a diff), keeping the same component name and export.
- Use the same sentinel format: <<<MOCKY>>> ... <<<END>>>. No prose, no fences.`

/** Animation intensity offered by the "Add animations" screen action (Lot B). */
export type AnimationLevel = 'subtle' | 'moderate' | 'rich'

export const ANIMATION_LEVELS: AnimationLevel[] = ['subtle', 'moderate', 'rich']

export const ANIMATION_LEVEL_LABELS: Record<AnimationLevel, string> = {
  subtle: 'Subtle',
  moderate: 'Moderate',
  rich: 'Rich',
}

/**
 * Build the edit instruction that layers motion into an existing screen.
 *
 * This is fed to `editComponent`, so EDIT_RULES still applies: the model must
 * ADD animation/transition only and keep all content, copy, colors, layout and
 * structure byte-for-byte. The Motion capability pack (FadeIn, Stagger, Reveal,
 * Counter, ShimmerButton, …) is made available alongside so the model wraps the
 * existing markup instead of hand-rolling keyframes. All Motion components
 * already respect prefers-reduced-motion.
 */
export function buildAnimationInstruction(level: AnimationLevel): string {
  const common = [
    'Add tasteful animations and transitions to this screen WITHOUT changing any content, copy, colors, layout, sizing, structure, or behaviour. Motion is the ONLY thing you may add.',
    'Wrap existing elements rather than rewriting them. Prefer the provided motion components (FadeIn, Stagger, Reveal, Counter, ShimmerButton, BorderBeam, Marquee) and plain Tailwind transition/hover utilities (transition, duration-*, ease-*, hover:scale-*, hover:shadow-*). Do NOT add any external library.',
    'Keep it accessible and never block interaction: entrance effects must settle to a fully visible resting state; nothing should hide content if animations are disabled.',
  ]
  const perLevel: Record<AnimationLevel, string[]> = {
    subtle: [
      'Level: SUBTLE. Add only gentle polish:',
      '- Smooth transitions on interactive elements (buttons, cards, links): color, background, shadow and a small hover lift (hover:scale-[1.02] / hover:shadow-lg with transition).',
      '- One soft entrance (FadeIn) on the main heading or hero block.',
      '- Nothing looping, no counters, no attention-grabbing effects.',
    ],
    moderate: [
      'Level: MODERATE. Add clear but tasteful motion:',
      '- Entrance animations on the major sections (FadeIn / Reveal) as they scroll into view.',
      '- Staggered reveals for lists and card grids (Stagger).',
      '- Animated number counters (Counter) for prominent stats/metrics if any exist.',
      '- Hover lift + shadow on cards and smooth transitions on all interactive elements.',
    ],
    rich: [
      'Level: RICH. Add expressive, high-end motion (still tasteful, never overwhelming):',
      '- Everything from the moderate level: section entrances, staggered lists, animated counters, hover states.',
      '- Use a ShimmerButton for the single primary call-to-action.',
      '- Add a BorderBeam or subtle glow accent on one hero/feature card where it fits.',
      '- Use a Marquee for any logo strip / testimonial row if present.',
      '- Only use Meteors on an already-dark hero background. Do not overload the page — pick a few focal points.',
    ],
  }
  return [...common, '', ...perLevel[level]].join('\n')
}

/**
 * Asks the model to modify an existing component and return the complete
 * updated source. Used when one or more screens are selected on the canvas.
 * Strongly constrains the model to change ONLY what was requested.
 */
export async function editComponent(
  s: Settings,
  instruction: string,
  existingCode: string,
  extraSystem?: string,
  images?: string[],
  signal?: AbortSignal,
  onChunk?: (partialCode: string) => void,
  caps?: Capability[],
): Promise<GeneratedComponent> {
  const capsPrompt = caps ? buildCapabilitiesPrompt(caps) : ''
  const baseSystem = [extraSystem, SYSTEM_PROMPT, EDIT_RULES].filter(Boolean).join('\n\n')
  const system = capsPrompt ? `${baseSystem}\n${capsPrompt}` : baseSystem
  const user = [
    'Here is the current complete source of the screen to edit:',
    '',
    '```jsx',
    existingCode,
    '```',
    '',
    'Make ONLY the change described below. Keep everything else in the component exactly as it is now — do not alter any other text, styling, layout, or behaviour. Return the COMPLETE updated component.',
    '',
    'Requested change:',
    withImageNote(instruction, images),
  ].join('\n')
  const content = await chat(
    s,
    [
      { role: 'system', content: system },
      { role: 'user', content: user, images: images?.map(stripDataUrl) },
    ],
    signal,
    onChunk ? (full) => onChunk(extractCode(full, { streaming: true })) : undefined,
  )
  const code = extractCode(content)
  const componentName = detectComponentName(code)
  return { raw: content, code, componentName }
}

const SENTINEL_OPEN = '<<<MOCKY>>>'
const SENTINEL_CLOSE = '<<<END>>>'

/**
 * Sanitize source code to remove characters that Babel tolerates but the
 * browser's JS parser rejects when the compiled script is inserted via a
 * Blob URL or script.textContent. The usual culprits:
 *
 * - U+2028 (LINE SEPARATOR) and U+2029 (PARAGRAPH SEPARATOR): valid in JS
 *   string literals per ES2018+ but NOT in the script body — the browser
 *   treats them as line terminators and throws "Invalid or unexpected token".
 * - U+FEFF (BOM): invisible, breaks the parser at the start of a line.
 * - C0 control characters (U+0000–U+001F) except \t \n \r.
 * - Lone (unpaired) surrogates (U+D800–U+DFFF).
 *
 * Also normalizes \r\n and \r to \n.
 */
export function sanitizeSource(code: string): string {
  return code
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Replace U+2028 and U+2029 with \n
    .replace(/\u2028/g, '\n')
    .replace(/\u2029/g, '\n')
    // Strip BOM anywhere
    .replace(/\uFEFF/g, '')
    // Strip C0 control chars except \t (\x09), \n (\x0A), \r (\x0D)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    // Strip lone (unpaired) surrogates
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
}

/**
 * Extract the component code from the model's response.
 *
 * Uses a sentinel protocol: the model emits <<<MOCKY>>> ...code... <<<END>>>.
 * During streaming the closing sentinel may not be present yet — in that case
 * we return the partial body after the opening sentinel as-is.
 *
 * Falls back to the legacy fenced-code-block regex for backward compat with
 * older models, then to the raw content as a last resort.
 *
 * @param content  The full (or partial) assistant message.
 * @param opts     { streaming?: boolean } — if true, allow missing close sentinel.
 */
export function extractCode(content: string, opts?: { streaming?: boolean }): string {
  const streaming = opts?.streaming ?? false

  // --- Sentinel protocol (preferred) ---
  const openIdx = content.indexOf(SENTINEL_OPEN)
  if (openIdx >= 0) {
    const bodyStart = openIdx + SENTINEL_OPEN.length
    const closeIdx = content.indexOf(SENTINEL_CLOSE, bodyStart)
    if (closeIdx >= 0) {
      return sanitizeSource(content.slice(bodyStart, closeIdx).trim())
    }
    if (streaming) {
      return sanitizeSource(content.slice(bodyStart).trim())
    }
    return sanitizeSource(content.slice(bodyStart).trim())
  }

  // --- Legacy fenced code block (backward compat) ---
  const fence = /```(?:[a-zA-Z0-9]+)?\s*\n([\s\S]*?)\n\s*```/g
  let best = ''
  let m: RegExpExecArray | null
  while ((m = fence.exec(content))) {
    if (m[1].length > best.length) best = m[1]
  }
  if (best) {
    return sanitizeSource(best
      .replace(/^\s*```[a-zA-Z0-9]*\s*\n?/m, '')
      .replace(/\n?\s*```\s*$/m, '')
      .trim())
  }

  // --- Raw fallback (no sentinels, no fences) ---
  return sanitizeSource(content.trim()
    .replace(/^\s*```[a-zA-Z0-9]*\s*\n?/m, '')
    .replace(/\n?\s*```\s*$/m, '')
    .trim())
}

/** Find the identifier of the component to mount in the preview. */
export function detectComponentName(code: string): string {
  let m: RegExpExecArray | null
  if ((m = /export\s+default\s+function\s+([A-Za-z0-9_$]+)/.exec(code))) return m[1]
  if ((m = /export\s+default\s+([A-Za-z0-9_$]+)\s*;?/.exec(code))) return m[1]
  if (/function\s+App\b/.test(code)) return 'App'
  if ((m = /(?:const|let|var)\s+([A-Z][A-Za-z0-9_$]*)\s*=\s*(?:\(|function|React\.memo|memo|forwardRef|React\.forwardRef)/.exec(code))) return m[1]
  if ((m = /function\s+([A-Z][A-Za-z0-9_$]*)\s*\(/.exec(code))) return m[1]
  return 'App'
}

/**
 * Strip imports/exports so the source can run inside the sandboxed preview
 * iframe (where React + hooks are provided as globals).
 *
 * Handles:
 * - Multi-line named imports: `import { A, B } from 'lib'` (possibly across
 *   several lines).
 * - Default imports: `import X from 'lib'`
 * - Mixed default+named: `import X, { A, B } from 'lib'`
 * - Side-effect imports: `import 'lib'`
 * - CommonJS require() leftovers after Babel transform
 * - export default / export named
 */
export function toPreviewModule(code: string): string {
  let out = code
    // `import ... from '...'` — [^;] spans newlines so multi-line specifier
    // lists are matched as a whole, including the closing `} from '...'`.
    .replace(/^[ \t]*import\b[^;]*?from\s*['"][^'"]+['"]\s*;?[ \t]*\r?\n?/gm, '')
    // side-effect import: `import 'x'`
    .replace(/^[ \t]*import\s+['"][^'"]+['"]\s*;?[ \t]*\r?\n?/gm, '')
    // dynamic/CJS leftovers: `const X = require('...')`
    .replace(/^[ \t]*(?:const|let|var)\s+.*=\s*require\([^)]*\)\s*;?[ \t]*\r?\n?/gm, '')
    .replace(/^\s*export\s+default\s+function\s+/gm, 'function ')
    .replace(/^\s*export\s+default\s+/gm, 'const __mockyDefault = ')
    .replace(/^\s*export\s+(const|let|var|function|class)\b/gm, '$1')

  // Guard: if any `import` statement survived (unusual regex edge case),
  // strip it again. Never ship an import to the iframe.
  if (/^\s*import\b/m.test(out)) {
    out = out
      .replace(/^[ \t]*import\b[^;]*?from\s*['"][^'"]+['"]\s*;?[ \t]*\r?\n?/gm, '')
      .replace(/^[ \t]*import\s+['"][^'"]+['"]\s*;?[ \t]*\r?\n?/gm, '')
  }
  return out
}

const FIX_PROMPT = `You are a code reviewer. The following React component has a syntax or runtime error. Fix ONLY the error — do not redesign, restyle, or change anything else. Return the COMPLETE corrected component in a single fenced jsx code block.`

/**
 * Asks the model to fix a broken component given the code + the error message.
 * Used for auto-retry when the preview iframe reports a compile/runtime error.
 * Returns the fixed code. Does NOT stream (the fix is usually small and fast).
 */
export async function fixComponent(
  s: Settings,
  brokenCode: string,
  errorMessage: string,
  signal?: AbortSignal,
): Promise<GeneratedComponent> {
  const user = [
    'The following component has an error:',
    '',
    '```jsx',
    brokenCode,
    '```',
    '',
    `Error: ${errorMessage}`,
    '',
    'Fix the error and return the COMPLETE corrected component. Do not change anything that is not broken.',
  ].join('\n')
  const content = await chat(s, [
    { role: 'system', content: FIX_PROMPT },
    { role: 'user', content: user },
  ], signal)
  const code = extractCode(content)
  return { raw: content, code, componentName: detectComponentName(code) }
}
