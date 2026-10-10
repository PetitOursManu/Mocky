import PresetPicker from './PresetPicker'
import { STYLE_PRESETS } from '../lib/styles'
import MusePanel from './MusePanel'
import { useT } from '../i18n'
import { Banner, Button, Icon, MockyLoader } from '../ui'
import type { MuseConfig, MuseResult, GeneratedSlotImage, MuseVideoAvailability } from '../lib/muse'
import type { PinnedImage } from '../lib/imageLibrary'
import type { ProjectUltra } from '../lib/project'
import UltraControl from './UltraControl'
import ImageSourceControl, { DocumentImageControl } from './ImageSourceControl'
import type { ImageChoice } from '../lib/stockImages'
import type { DocumentImageChoice } from '../lib/documentPictures'
import type { MediaTab } from './Bibliotheque'
import { useState } from 'react'
import type { SiteRefMode, SiteShot } from '../lib/siteReference'
import { SiteAttachButton, SiteShotsRow, siteDropHandlers } from './SiteReferencePicker'
import ScreenThemePicker from './ScreenThemePicker'
import { EnhanceNotice, PromptEnhanceButton } from './PromptEnhancer'
import type { PromptEnhancer } from '../lib/usePromptEnhancer'
import type { ScreenThemeId } from '../lib/screenThemes'
import type { PageFormatId } from '../lib/pageFormats'

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
  /** The page format while a DOCUMENT type is chosen, null otherwise — see PresetPicker. */
  pageFormat: PageFormatId | null
  onPageFormatChange: (id: PageFormatId) => void
  onOpenSettings: () => void
  onOpenDesign: () => void
  onApplyStyle: (markdown: string) => void
  museConfig: MuseConfig
  onMuseChange: (c: MuseConfig) => void
  museAvail: boolean | null
  museResult: MuseResult | null
  museImages: GeneratedSlotImage[]
  museStage: string | null
  onOpenLibrary: (tab?: MediaTab) => void
  pinned: PinnedImage[]
  onUnpin: (hash: string) => void
  museImageError: string | null
  museVision: boolean | null
  museVideo: MuseVideoAvailability | null
  /** Motion Ultra — the project's setting and the composer's pause. */
  ultra: ProjectUltra | undefined
  ultraPaused: boolean
  onSetUltra: (ultra: ProjectUltra | null) => void
  onToggleUltraPause: () => void
  /** Whether a Motion Ultra video background can be rendered right now. */
  ultraVideoAvailable?: boolean
  /** The Motion Ultra series sizes this account may use. */
  ultraCounts?: readonly number[]
  /** Where new pictures come from — generated, found in the free libraries, or none. */
  imageChoice: ImageChoice
  /** The choices this account can open (see ImageSourceControl). */
  imageChoices: ImageChoice[]
  onImageChoice: (choice: ImageChoice) => void
  /** A real choice exists AND a pass that makes pictures is on. */
  imageChoiceAvailable: boolean
  /**
   * A DOCUMENT's own picture choice ("Sans image" first), drawn in place of the
   * general one while a page format is active — see DocumentImageControl.
   */
  documentImage: { value: DocumentImageChoice; choices: DocumentImageChoice[]; onChange: (c: DocumentImageChoice) => void }
  /** What a running pass is doing, when it has more to say than "generating". */
  busyLabel: string | null
  /** Screenshots of an existing site — state and reader live in ProjectView. */
  siteShots: SiteShot[]
  siteReading: number
  siteMode: SiteRefMode
  onSiteMode: (mode: SiteRefMode) => void
  onRemoveSiteShot: (id: string) => void
  onAddSiteFiles: (files: File[]) => void
  onComposerPaste: (e: React.ClipboardEvent) => void
  /** The screen type for the first screen — state lives in ProjectView, like the preset. */
  themeId: ScreenThemeId | null
  onThemeChange: (id: ScreenThemeId | null) => void
  /** "Améliorer le prompt", shared with the floating bar so an Undo survives the switch. */
  enhancer: PromptEnhancer
  onEnhance: () => void
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
  pageFormat,
  onPageFormatChange,
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
  museVideo,
  ultra,
  ultraPaused,
  onSetUltra,
  onToggleUltraPause,
  ultraVideoAvailable = false,
  ultraCounts,
  imageChoice,
  imageChoices,
  onImageChoice,
  imageChoiceAvailable,
  documentImage,
  busyLabel,
  siteShots,
  siteReading,
  siteMode,
  onSiteMode,
  onRemoveSiteShot,
  onAddSiteFiles,
  onComposerPaste,
  themeId,
  onThemeChange,
  enhancer,
  onEnhance,
}: Props) {
  const t = useT()
  const [dragOver, setDragOver] = useState(false)

  /**
   * The Muse control announces itself whenever Muse is off — see `.muse-sweep`.
   *
   * It used to stop after the first activation, on the theory that a hint which
   * keeps hinting is noise. That theory was wrong for this control: switching
   * Muse off is a per-screen decision, not a verdict on the feature, so the
   * question "did you mean to leave this off?" stays worth asking. The gate
   * also had a nasty consequence — anyone who had already used Muse once never
   * saw the hint at all, which is precisely the person most likely to want it
   * back on.
   */
  const museHint = !museConfig.enabled

  function toggleMuse() {
    onMuseChange({ ...museConfig, enabled: !museConfig.enabled })
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!enhancer.running) onGenerate()
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">
        <header className="rule-double mb-8 pb-6 text-center">
          <p className="kicker text-accent-ink">{t('auth.welcome.kicker')}</p>
          <h1 className="mt-2 text-h2 text-ink sm:text-display">{t('auth.welcome.title')}</h1>
          <p className="mt-3 text-lead text-ink-muted">{t('auth.welcome.lead')}</p>
        </header>

        <div
          className={`rounded-2xl border bg-surface p-3 shadow-xl transition ${
            dragOver ? 'border-accent ring-2 ring-accent/40' : 'border-line'
          }`}
          {...siteDropHandlers(onAddSiteFiles, setDragOver)}
        >
          <textarea
            autoFocus
            className="input min-h-[120px] resize-y border-0 bg-transparent text-lead"
            placeholder={siteShots.length ? t('project.sitePlaceholder') : t('auth.welcome.placeholder')}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onComposerPaste}
            readOnly={enhancer.running}
            aria-busy={enhancer.running || undefined}
          />
          <SiteShotsRow
            className="px-1 pb-2"
            shots={siteShots}
            reading={siteReading}
            mode={siteMode}
            onMode={onSiteMode}
            onRemove={onRemoveSiteShot}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {/* First, because on an empty project "reproduce this site" is
                  the whole request, not an option among the others. */}
              <SiteAttachButton
                onFiles={onAddSiteFiles}
                disabled={busy}
                size={15}
                labelled
                className="inline-flex items-center gap-1.5 text-body-sm text-ink-faint transition hover:text-ink"
              />
              <button
                type="button"
                onClick={onOpenDesign}
                className={`text-body-sm transition ${
                  designActive ? 'text-ok hover:opacity-80' : 'text-ink-faint hover:text-ink'
                }`}
                title={t('auth.welcome.designTitle')}
              >
                {designActive ? t('auth.welcome.designOn') : t('auth.welcome.designOff')}
              </button>
              <button
                type="button"
                onClick={toggleMuse}
                // `muse-ink`, not `muse`: on paper the two differ, and the
                // brighter one measures 4.27:1 against the surface — under the
                // 4.5:1 AA floor for text this size. The ink variant exists for
                // exactly this, and is identical in the dark theme.
                className={`inline-flex items-center gap-1.5 text-body-sm transition ${
                  museConfig.enabled ? 'text-muse-ink hover:opacity-80' : 'text-ink-faint hover:text-ink'
                }`}
                title={museHint ? t('auth.welcome.museHint') : t('auth.welcome.museTitle')}
              >
                <Icon name="sparkle" size={15} className={museHint ? 'muse-sweep-icon' : undefined} />
                <span className={museHint ? 'muse-sweep' : undefined}>
                  {museConfig.enabled ? t('auth.welcome.museOn') : t('auth.welcome.museOff')}
                </span>
              </button>
              {/* The first screen is the one Motion Ultra matters most for: it
                  is usually the landing page, and it sets the tone. */}
              <UltraControl
                ultra={ultra}
                paused={ultraPaused}
                onSetUltra={onSetUltra}
                onTogglePause={onToggleUltraPause}
                videoAvailable={ultraVideoAvailable}
                allowedCounts={ultraCounts}
                size={15}
                className="text-body-sm"
              />
              {/* A document decides its picture here, and it is never hidden:
                  it is the one choice that may cost a paid generation. */}
              {pageFormat ? (
                <DocumentImageControl
                  value={documentImage.value}
                  choices={documentImage.choices}
                  onChange={documentImage.onChange}
                  size={15}
                  className="text-body-sm"
                />
              ) : (
                imageChoiceAvailable && (
                  <ImageSourceControl
                    value={imageChoice}
                    choices={imageChoices}
                    onChange={onImageChoice}
                    size={15}
                    className="text-body-sm"
                  />
                )
              )}
            </div>
            <div className="flex items-center gap-3">
              <PromptEnhanceButton
                enhancer={enhancer}
                onStart={onEnhance}
                disabled={busy || !prompt.trim()}
                // Captures describe the screen; a brief invented on top would
                // argue with them (Reproduce: "nothing added"; Redesign: "keep the content").
                disabledReason={siteShots.length ? t('composer.enhanceCaptures') : undefined}
              />
              <span className="hidden text-caption text-ink-faint sm:inline">⌘/Ctrl + Enter</span>
              <Button
                variant="primary"
                onClick={onGenerate}
                // Screenshots alone are a request for a new screen.
                disabled={busy || enhancer.running || siteReading > 0 || (!prompt.trim() && !siteShots.length)}
              >
                {busy ? (
                  <>
                    {/* MockyLoader porte deja role="status" + aria-label : le texte
                        visible est masque aux lecteurs d'ecran pour que l'etat ne
                        soit pas annonce deux fois. */}
                    <MockyLoader size={64} label={busyLabel || t('auth.welcome.generatingAria')} className="shrink-0" />
                    <span aria-hidden>{busyLabel || t('composer.generating')}</span>
                  </>
                ) : (
                  `${t('composer.generate')} ↵`
                )}
              </Button>
            </div>
          </div>
        </div>

        <EnhanceNotice enhancer={enhancer} className="mt-3" />

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
              video={museVideo}
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <span className="kicker">{t('auth.welcome.format')}</span>
          <PresetPicker
            value={presetId}
            onChange={onPresetChange}
            pageFormat={pageFormat}
            onPageFormatChange={onPageFormatChange}
            disabled={enhancer.running}
          />
          <ScreenThemePicker
            value={themeId}
            onChange={onThemeChange}
            placement="down"
            disabled={busy || enhancer.running}
            ignored={siteShots.length > 0 && siteMode === 'reproduce'}
          />
        </div>

        {/* First-run style picker (D.1) — sets a DESIGN.md so the very first
            screen is on-brand. Hidden once a design system is active. */}
        {!designActive && (
          <div className="rule-thin mt-8 pb-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-center">
              <span className="kicker text-accent-ink">{t('auth.welcome.pickStyle')}</span>
              <span className="text-caption text-ink-faint">{t('auth.welcome.pickStyleHint')}</span>
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
            {t('auth.welcome.designSystemOn')}{' '}
            <button type="button" onClick={onOpenDesign} className="underline underline-offset-2 transition hover:opacity-80">
              {t('auth.welcome.designSystemEdit')}
            </button>
          </div>
        )}

        <div className="mt-6">
          <div className="kicker mb-3 text-center text-accent-ink">{t('auth.welcome.examples')}</div>
          <div className="flex flex-wrap justify-center gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setPrompt(ex)}
                // The field is read-only while a rewrite streams into it; an
                // example written now is overwritten by the next chunk.
                disabled={enhancer.running}
                className="rounded-full border border-line-soft px-3 py-1.5 text-body-sm text-ink-muted transition hover:border-accent hover:bg-ink/5 hover:text-accent-ink disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <Banner
            tone="danger"
            title={t('auth.welcome.generationFailed')}
            className="mt-6"
            action={
              <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                {t('auth.welcome.openSettings')}
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
