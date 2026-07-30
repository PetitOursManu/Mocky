import PresetPicker from './PresetPicker'
import { STYLE_PRESETS } from '../lib/styles'
import MusePanel from './MusePanel'
import { Banner, Button, Icon } from '../ui'
import type { MuseConfig, MuseResult, GeneratedSlotImage } from '../lib/muse'
import type { PinnedImage } from '../lib/imageLibrary'

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
  onApplyStyle: (markdown: string) => void
  museConfig: MuseConfig
  onMuseChange: (c: MuseConfig) => void
  museAvail: boolean | null
  museResult: MuseResult | null
  museImages: GeneratedSlotImage[]
  museStage: string | null
  onOpenLibrary: () => void
  pinned: PinnedImage[]
  onUnpin: (hash: string) => void
  museImageError: string | null
  museVision: boolean | null
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
  onApplyStyle,
  museConfig,
  onMuseChange,
  museAvail,
  museResult,
  museImages,
  museStage,
  onOpenLibrary,
  pinned,
  onUnpin,
  museImageError,
  museVision,
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
        <header className="rule-double mb-8 pb-6 text-center">
          <p className="kicker text-accent-ink">New screen</p>
          <h1 className="mt-2 text-h2 text-ink sm:text-display">
            What do you want to design?
          </h1>
          <p className="mt-3 text-lead text-ink-muted">
            Describe a screen in plain language — Mocky turns it into a real React + Tailwind component
            with a live preview.
          </p>
        </header>

        <div className="rounded-2xl border border-line bg-surface p-3 shadow-xl">
          <textarea
            autoFocus
            className="input min-h-[120px] resize-y border-0 bg-transparent text-lead"
            placeholder="e.g. A clean SaaS landing page with a hero, three feature cards, and a footer…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="flex items-center justify-between gap-3 px-1 pt-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenDesign}
                className={`text-body-sm transition ${
                  designActive ? 'text-ok hover:opacity-80' : 'text-ink-faint hover:text-ink'
                }`}
                title="Manage DESIGN.md"
              >
                {designActive ? '● DESIGN.md on' : '○ DESIGN.md off'}
              </button>
              <button
                type="button"
                onClick={() => onMuseChange({ ...museConfig, enabled: !museConfig.enabled })}
                className={`inline-flex items-center gap-1.5 text-body-sm transition ${
                  museConfig.enabled ? 'text-muse hover:opacity-80' : 'text-ink-faint hover:text-ink'
                }`}
                title="Muse — inspiration, art direction & real copy"
              >
                <Icon name="sparkle" size={15} />
                {museConfig.enabled ? 'Muse on' : 'Muse off'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-caption text-ink-faint sm:inline">⌘/Ctrl + Enter</span>
              <Button
                variant="primary"
                onClick={onGenerate}
                disabled={busy || !prompt.trim()}
              >
                {busy ? 'Generating…' : 'Generate ↵'}
              </Button>
            </div>
          </div>
        </div>

        {museConfig.enabled && (
          <div className="mt-3">
            <MusePanel
              config={museConfig}
              onChange={onMuseChange}
              available={museAvail}
              result={museResult}
              images={museImages}
              stage={museStage}
              busy={busy}
              onOpenLibrary={onOpenLibrary}
              pinned={pinned}
              onUnpin={onUnpin}
              imageError={museImageError}
              vision={museVision}
            />
          </div>
        )}

        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="kicker">Format</span>
          <PresetPicker value={presetId} onChange={onPresetChange} />
        </div>

        {/* First-run style picker (D.1) — sets a DESIGN.md so the very first
            screen is on-brand. Hidden once a design system is active. */}
        {!designActive && (
          <div className="rule-thin mt-8 pb-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-center">
              <span className="kicker text-accent-ink">Pick a style</span>
              <span className="text-caption text-ink-faint">— optional, keeps every screen consistent</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {STYLE_PRESETS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onApplyStyle(s.markdown)}
                  title={`${s.name} — ${s.description}`}
                  className="group shrink-0 rounded-xl border border-line-soft bg-surface p-2 text-left transition hover:border-accent hover:bg-ink/5"
                  style={{ width: 116 }}
                >
                  <div className="flex h-10 overflow-hidden rounded-md" style={{ background: s.preview.bg }}>
                    <span className="flex-1" style={{ background: s.preview.cardBg }} />
                    <span className="flex-1" style={{ background: s.preview.accent }} />
                    <span className="flex-1" style={{ background: s.preview.text }} />
                    <span className="flex-1" style={{ background: s.preview.mutedText }} />
                  </div>
                  <div className="mt-1.5 truncate text-caption font-medium text-ink-muted transition group-hover:text-accent-ink">{s.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {designActive && (
          <div className="mt-4 text-center text-body-sm text-ok">
            ● Design system on — your screens will follow it.{' '}
            <button type="button" onClick={onOpenDesign} className="underline underline-offset-2 transition hover:opacity-80">
              edit
            </button>
          </div>
        )}

        <div className="mt-6">
          <div className="kicker mb-3 text-center text-accent-ink">Or try an example</div>
          <div className="flex flex-wrap justify-center gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setPrompt(ex)}
                className="rounded-full border border-line-soft px-3 py-1.5 text-body-sm text-ink-muted transition hover:border-accent hover:bg-ink/5 hover:text-accent-ink"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <Banner
            tone="danger"
            title="Generation failed"
            className="mt-6"
            action={
              <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                Open Settings
              </Button>
            }
          >
            {error}
          </Banner>
        )}
      </div>
    </div>
  )
}
