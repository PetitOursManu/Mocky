import { useState } from 'react'

export default function CodeView({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be unavailable; ignore */
    }
  }

  return (
    <div className="relative h-full w-full overflow-auto bg-slate-950">
      <button
        type="button"
        onClick={copy}
        className="absolute right-3 top-3 z-10 rounded-md border border-slate-600 bg-slate-800/90 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
      <pre className="min-h-full p-4 text-xs leading-relaxed text-slate-200">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  )
}
