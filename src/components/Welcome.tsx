import PresetPicker from './PresetPicker'

type Props = {
  prompt: string
  setPrompt: (v: string) => void
  onGenerate: () => void
  busy: boolean
  error: string | null
  designActive: boolean
  examples: string[]
  presetId: string
  onPresetChange: (id: string) => void
  onOpenSettings: () => void
  onOpenDesign: () => void
}

export default function Welcome({
  prompt,
  setPrompt,
  onGenerate,
  busy,
  error,
  designActive,
  examples,
  presetId,
  onPresetChange,
  onOpenSettings,
  onOpenDesign,
}: Props) {
  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      onGenerate()
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
            What do you want to design?
          </h2>
          <p className="mt-3 text-slate-400">
            Describe a screen in plain language — Mocky turns it into a real React + Tailwind component
            with a live preview.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3 shadow-xl">
          <textarea
            autoFocus
            className="input min-h-[120px] resize-y border-0 bg-transparent text-base focus:ring-0"
            placeholder="e.g. A clean SaaS landing page with a hero, three feature cards, and a footer…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="flex items-center justify-between gap-3 px-1 pt-1">
            <button
              type="button"
              onClick={onOpenDesign}
              className={`text-xs transition ${
                designActive ? 'text-emerald-300 hover:text-emerald-200' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Manage DESIGN.md"
            >
              {designActive ? '● DESIGN.md on' : '○ DESIGN.md off'}
            </button>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-slate-500 sm:inline">⌘/Ctrl + Enter</span>
              <button
                type="button"
                className="btn-primary"
                onClick={onGenerate}
                disabled={busy || !prompt.trim()}
              >
                {busy ? 'Generating…' : 'Generate ↵'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="text-xs text-slate-500">Format</span>
          <PresetPicker value={presetId} onChange={onPresetChange} />
        </div>

        <div className="mt-6">
          <div className="mb-2 text-center text-xs uppercase tracking-wide text-slate-500">
            or try an example
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setPrompt(ex)}
                className="rounded-full border border-slate-700 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 hover:bg-slate-800"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-rose-700/50 bg-rose-900/30 p-3 text-sm text-rose-200">
            <div className="font-medium">Generation failed</div>
            <div className="mt-1 text-xs">{error}</div>
            <button type="button" className="btn-ghost mt-2 text-xs" onClick={onOpenSettings}>
              Open Settings
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
