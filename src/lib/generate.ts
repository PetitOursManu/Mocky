import type { Settings } from './settings'
import { proxyFetch, truncate } from './proxy'

export const SYSTEM_PROMPT = `You are an expert React + Tailwind CSS UI engineer. Given a description of a screen, you output a single self-contained React component that renders it.

STRICT OUTPUT RULES:
- Respond with ONE fenced code block (\`\`\`jsx ... \`\`\`) and nothing else — no explanation before or after.
- Write plain JavaScript with JSX. Do NOT use TypeScript type annotations.
- Do NOT write any import statements and do NOT use named exports. React and all of its hooks (useState, useEffect, useRef, useMemo, useCallback, etc.) are available as globals — call them directly, e.g. const [open, setOpen] = useState(false).
- Define exactly ONE top-level component named App, and end the file with: export default App
- Style everything with Tailwind utility classes only. No external CSS files, no styled-components, no third-party UI/icon libraries.
- Do not fetch from the network and do not use <img> with external URLs. Use inline SVG, emoji, or solid-color placeholder divs instead.
- Make the result visually polished, responsive, and realistic, with sensible placeholder content.`

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

/** Shared chat call: posts messages and returns the assistant content. */
async function chat(s: Settings, messages: ChatMessage[]): Promise<string> {
  const body = JSON.stringify({ model: s.model, stream: false, messages, options: { temperature: 0.4 } })

  let res: Response
  try {
    res = await proxyFetch(s, '/api/chat', { method: 'POST', body })
  } catch (err) {
    throw new Error(`Network error: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(`Authentication failed (HTTP ${res.status}). Check your API key in Settings.`)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} from provider. ${truncate(text, 300)}`)
  }

  const data = (await res.json()) as OllamaChatResponse
  const content = data.message?.content ?? data.choices?.[0]?.message?.content ?? ''
  if (!content.trim()) throw new Error('The model returned an empty response.')
  return content
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
): Promise<GeneratedComponent> {
  const system = extraSystem ? `${extraSystem}\n\n${SYSTEM_PROMPT}` : SYSTEM_PROMPT
  const content = await chat(s, [
    { role: 'system', content: system },
    { role: 'user', content: withImageNote(userPrompt, images), images: images?.map(stripDataUrl) },
  ])
  const code = extractCode(content)
  return { raw: content, code, componentName: detectComponentName(code) }
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
- Return the COMPLETE updated component (the whole file, not a diff), keeping the same component name and export.`

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
): Promise<GeneratedComponent> {
  const system = [extraSystem, SYSTEM_PROMPT, EDIT_RULES].filter(Boolean).join('\n\n')
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
  const content = await chat(s, [
    { role: 'system', content: system },
    { role: 'user', content: user, images: images?.map(stripDataUrl) },
  ])
  const code = extractCode(content)
  return { raw: content, code, componentName: detectComponentName(code) }
}

/** Pull the largest fenced code block out of a markdown response, else use it whole. */
export function extractCode(content: string): string {
  const fence = /```(?:[a-zA-Z0-9]+)?\n([\s\S]*?)```/g
  let best = ''
  let m: RegExpExecArray | null
  while ((m = fence.exec(content))) {
    if (m[1].length > best.length) best = m[1]
  }
  return (best || content).trim()
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
 */
export function toPreviewModule(code: string): string {
  return code
    .replace(/^\s*import\s+[^\n]*\n/gm, '')
    .replace(/^\s*export\s+default\s+function/gm, 'function')
    .replace(/^\s*export\s+default\s+/gm, 'const __mockyDefault = ')
    .replace(/^\s*export\s+(const|let|var|function|class)\b/gm, '$1')
}
