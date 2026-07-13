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
- Write plain JavaScript with JSX. Do NOT use TypeScript type annotations.
- Do NOT write any import statements and do NOT use named exports. React and all of its hooks (useState, useEffect, useRef, useMemo, useCallback, etc.) are available as globals — call them directly, e.g. const [open, setOpen] = useState(false).
- Define exactly ONE top-level component named App, and end the file with: export default App
- Style everything with Tailwind utility classes only. No external CSS files, no styled-components, no third-party UI/icon libraries.
- Do not fetch from the network and do not use <img> with external URLs. Use inline SVG, emoji, or solid-color placeholder divs instead.

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
  return [
    '',
    'CAPABILITIES — ALREADY IN SCOPE (read carefully):',
    'The following components and libraries are ALREADY DEFINED as globals in the runtime scope.',
    'You MUST NOT write any import statement for them — there is no module system in the sandbox.',
    'Writing "import" will break the render. Use them directly by name.',
    '',
    ...items,
  ].join('\n')
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
): Promise<GeneratedComponent> {
  const capsPrompt = caps ? buildCapabilitiesPrompt(caps) : ''
  const baseSystem = extraSystem ? `${extraSystem}\n\n${SYSTEM_PROMPT}` : SYSTEM_PROMPT
  const system = capsPrompt ? `${baseSystem}\n${capsPrompt}` : baseSystem
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

export const EDIT_RULES = `You are EDITING an existing screen, not designing a new one. The single most important rule:

PRESERVE EVERYTHING THAT THE USER DID NOT EXPLICITLY ASK TO CHANGE.
- Treat the provided source as the source of truth. Change ONLY what the instruction explicitly requests.
- Keep every other detail byte-for-byte identical: all text/content, colors, Tailwind classes, spacing, sizes, layout, structure, order of elements, state, hooks, and behaviour.
- Do NOT redesign, refactor, rename, reformat, reorder, restyle, "clean up", "improve", or modernise anything that was not requested.
- Do NOT add, remove, or rename features, sections, props, or imports beyond the requested change.
- If the instruction is ambiguous, make the smallest possible change that satisfies it and leave the rest untouched.
- Return the COMPLETE updated component (the whole file, not a diff), keeping the same component name and export.
- Use the same sentinel format: <<<MOCKY>>> ... <<<END>>>. No prose, no fences.`

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
      // Both sentinels present — extract the body between them.
      return content.slice(bodyStart, closeIdx).trim()
    }
    if (streaming) {
      // Opening sentinel found but no closing one yet — return the partial body.
      return content.slice(bodyStart).trim()
    }
    // Non-streaming and no close sentinel — treat the body after open as code.
    // (The model may have forgotten the close sentinel; still try to use the code.)
    return content.slice(bodyStart).trim()
  }

  // --- Legacy fenced code block (backward compat) ---
  const fence = /```(?:[a-zA-Z0-9]+)?\s*\n([\s\S]*?)\n\s*```/g
  let best = ''
  let m: RegExpExecArray | null
  while ((m = fence.exec(content))) {
    if (m[1].length > best.length) best = m[1]
  }
  if (best) {
    return best
      .replace(/^\s*```[a-zA-Z0-9]*\s*\n?/m, '')
      .replace(/\n?\s*```\s*$/m, '')
      .trim()
  }

  // --- Raw fallback (no sentinels, no fences) ---
  const cleaned = content.trim()
  return cleaned
    .replace(/^\s*```[a-zA-Z0-9]*\s*\n?/m, '')
    .replace(/\n?\s*```\s*$/m, '')
    .trim()
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
