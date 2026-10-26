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
import { autoFocusOk } from '../lib/touch'
import type { SiteRefMode, SiteShot } from '../lib/siteReference'
import { SiteAttachButton, SiteShotsRow, siteDropHandlers } from './SiteReferencePicker'
import ScreenThemePicker from './ScreenThemePicker'
import { EnhanceNotice, PromptEnhanceButton } from './PromptEnhancer'
import type { PromptEnhancer } from '../lib/usePromptEnhancer'
import type { ScreenThemeId } from '../lib/screenThemes'
import type { PageFormatId } from '../lib/pageFormats'
import type { FoldId } from '../lib/folds'
import FoldControl from './FoldControl'
import { OPTION_TILE, OptionTile, OptionTileAction, OptionTileChoice } from './ComposerOptions'

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
  /** Flat sheet or folded leaflet, and the folds the chosen size can take (empty: none offered). */
  fold?: FoldId | null
  folds?: FoldId[]
  onFoldChange?: (fold: FoldId | null) => void
  onOpenSettings: () => void
  onOpenDesign: () => void
  onApplyStyle: (markdown: string) => void
  museConfig: MuseConfig
  onMuseChange: (c: MuseConfig) => void
  /** The composer's "Parcours" (lib/flows.ts), shown here too: the first screen is often the one a flow starts from. */
  flowsOn?: boolean
  onToggleFlows?: () => void
  /** The account's brand for this project (lib/brand.ts): drawn only when a brand exists. */
  brandOn?: boolean
  onToggleBrand?: () => void
  /** Open Campaign Studio: a brief made into several formats at once (lib/campaign.ts). */
  onOpenCampaign?: () => void
  museAvail: boolean | null
  museResult: MuseResult | null
  museImages: GeneratedSlotImage[]
  museStage: string | null
  onOpenLibrary: (tab?: MediaTab) => void
  pinned: PinnedImage[]
  onUnpin: (hash: string) => void
  onPinChange: (hash: string, use: { insert: boolean; inspire: boolean }) => void
  /** Whether Muse paints its own mood plate on the next run. */
  musePlateOn: boolean
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
  fold = null,
  folds = [],
  onFoldChange,
  onOpenSettings,
  onOpenDesign,
  onApplyStyle,
  museConfig,
  onMuseChange,
  flowsOn,
  onToggleFlows,
  brandOn,
  onToggleBrand,
  onOpenCampaign,
  museAvail,
  museResult,
  museImages,
  museStage,
  onOpenLibrary,
  pinned,
  onUnpin,
  onPinChange,
  musePlateOn,
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

  /** How many option tiles are drawn — the first composer lays them out in one row. */
  const tileCount =
    3 + // DESIGN.md, Muse, the screenshots
    (ultraCounts === undefined || ultraCounts.length > 0 ? 1 : 0) +
    (onToggleBrand ? 1 : 0) +
    (onToggleFlows ? 1 : 0) +
    (pageFormat || imageChoiceAvailable ? 1 : 0)

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
    // Its own scroll area, with the scrollbar's room kept whether it shows or
    // not (`scrollbar-gutter: stable`): turning an option on makes the page a
    // little taller, and a scrollbar appearing then narrowed the whole composer
    // by its width.
    <div className="h-full overflow-y-auto [scrollbar-gutter:stable]">
    {/* Less air on a phone, where the page is taller than the screen anyway
        and 40px above and below plus the style row's own padding left a band
        of nothing under the last control. */}
    <div className="flex min-h-full items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
      {/* max-w-4xl: the tiles under the field want one row of five or six,
          and the field itself reads no worse wider. */}
      <div className="w-full max-w-4xl">
        <header className="mb-8 text-center">
          <p className="kicker">{t('auth.welcome.kicker')}</p>
          <h1 className="mt-2 text-h2 text-ink sm:text-display">{t('auth.welcome.title')}</h1>
          <p className="mt-3 text-lead text-ink-muted">{t('auth.welcome.lead')}</p>
        </header>

        {/* The composer answers three questions, in the order they are asked:
            WHAT is being made (above the field, because it changes what the
            field should say), the request itself, then HOW it is made (the
            options under the field, in groups), and last the button. The
            options used to be one row of ten bare words with the format chosen
            after the request, below the box. */}
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          <span className="kicker">{t('auth.welcome.format')}</span>
          <PresetPicker
            value={presetId}
            onChange={onPresetChange}
            pageFormat={pageFormat}
            onPageFormatChange={onPageFormatChange}
            themeId={themeId}
            disabled={enhancer.running}
          />
          <ScreenThemePicker
            value={themeId}
            onChange={onThemeChange}
            placement="down"
            disabled={busy || enhancer.running}
            ignored={siteShots.length > 0 && siteMode === 'reproduce'}
          />
          {/* Flat sheet or folded leaflet: a property of the format, so it sits
              beside it rather than among the options. */}
          {folds.length > 0 && onFoldChange && (
            <FoldControl value={fold} folds={folds} onChange={onFoldChange} size={15} className="composer-chip" />
          )}
          {/* A campaign is a different thing to make — several documents from
              one brief — not an option of this one, so it is offered beside the
              format, as the alternative to it. */}
          {onOpenCampaign && (
            <button type="button" onClick={onOpenCampaign} className="composer-chip" title={t('campaign.toolbarTitle')}>
              <Icon name="formats" size={15} />
              {t('campaign.toolbar')}
            </button>
          )}
        </div>

        <div
          // The focus is shown on the card, not on the field inside it: a ring
          // drawn around a borderless field sat inside the card's own edge.
          className={`rounded-2xl border bg-surface p-3 shadow-xl transition focus-within:border-accent/60 ${
            dragOver ? 'border-accent ring-2 ring-accent/40' : 'border-line'
          }`}
          {...siteDropHandlers(onAddSiteFiles, setDragOver)}
        >
          <textarea
            // Not on a phone: the keyboard would open over the page the person
            // has only just arrived on, before they chose to type.
            autoFocus={autoFocusOk()}
            // Taller on a phone: a request is a paragraph, and the three or four
            // lines of 120px were all a thumb could see of it before it scrolled.
            className="input min-h-[220px] resize-y sm:min-h-[120px] border-0 bg-transparent text-lead focus-visible:outline-0"
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
          {/* HOW the screen is made: one row of equal tiles under the field, in
              the order of the groups — what the screen follows, what helps
              write it, where its pictures come from (see OptionTile for why not
              three columns of rows). */}
          {/* As many columns as tiles, from sm: one row, never four and an
              orphan. Two by two on a phone. */}
          <div
            className="grid grid-cols-2 gap-2 border-t border-line-soft px-1 pt-3 sm:[grid-template-columns:var(--tiles)]"
            style={{ '--tiles': `repeat(${tileCount}, minmax(0, 1fr))` } as React.CSSProperties}
          >
            <OptionTileAction
              icon="image"
              label="DESIGN.md"
              hint={t('workspace.hintDesign')}
              status={designActive ? t('workspace.designOn') : t('workspace.designOff')}
              lit={designActive}
              onClick={onOpenDesign}
              title={t('auth.welcome.designTitle')}
            />
            {onToggleBrand && (
              <OptionTile
                icon="star"
                label={t('brand.toggle')}
                hint={t('workspace.hintBrand')}
                on={!!brandOn}
                onClick={onToggleBrand}
                title={t(brandOn ? 'brand.toggleOnTitle' : 'brand.toggleOffTitle')}
              />
            )}
            <OptionTile
              icon="muse"
              label={t('muse.title')}
              hint={t('workspace.hintMuse')}
              on={museConfig.enabled}
              onClick={toggleMuse}
              sweep={museHint}
              title={museHint ? t('auth.welcome.museHint') : t('auth.welcome.museTitle')}
            />
            {/* The first screen is the one Motion Ultra matters most for: it
                is usually the landing page, and it sets the tone. */}
            <UltraControl
              variant="tile"
              ultra={ultra}
              paused={ultraPaused}
              onSetUltra={onSetUltra}
              onTogglePause={onToggleUltraPause}
              videoAvailable={ultraVideoAvailable}
              allowedCounts={ultraCounts}
            />
            {onToggleFlows && (
              <OptionTile
                icon="cable"
                label={t('flows.toggle')}
                hint={t('workspace.hintFlows')}
                on={!!flowsOn}
                onClick={onToggleFlows}
                title={t(flowsOn ? 'flows.toggleOnTitle' : 'flows.toggleOffTitle')}
              />
            )}
            {/* A document decides its picture here, and it is never hidden:
                it is the one choice that may cost a paid generation. */}
            {(pageFormat || imageChoiceAvailable) && (
              <OptionTileChoice
                icon="image"
                label={t(pageFormat ? 'project.docImage' : 'project.imageSource')}
                hint={t('workspace.hintImages')}
              >
                {pageFormat ? (
                  <DocumentImageControl
                    value={documentImage.value}
                    choices={documentImage.choices}
                    onChange={documentImage.onChange}
                    bare
                  />
                ) : (
                  <ImageSourceControl value={imageChoice} choices={imageChoices} onChange={onImageChoice} bare />
                )}
              </OptionTileChoice>
            )}
            <SiteAttachButton
              onFiles={onAddSiteFiles}
              disabled={busy}
              size={18}
              labelled
              hint={t('workspace.hintCaptures')}
              className={`${OPTION_TILE} items-start text-body-sm font-semibold ${
                siteShots.length
                  ? 'border-accent/40 bg-accent/5 text-ink [&>svg]:text-accent-ink'
                  : 'border-line bg-raised/40 text-ink-muted hover:border-ink/25 hover:bg-ink/5 [&>svg]:text-ink-faint'
              }`}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line-soft px-1 pt-3">
            <PromptEnhanceButton
              enhancer={enhancer}
              onStart={onEnhance}
              disabled={busy || !prompt.trim()}
              // Captures describe the screen; a brief invented on top would
              // argue with them (Reproduce: "nothing added"; Redesign: "keep the content").
              disabledReason={siteShots.length ? t('composer.enhanceCaptures') : undefined}
            />
            <div className="flex items-center gap-3">
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
              onPinChange={onPinChange}
              plateOn={musePlateOn}
              imageError={museImageError}
              vision={museVision}
              video={museVideo}
            />
          </div>
        )}

        {/* First-run style picker (D.1) — sets a DESIGN.md so the very first
            screen is on-brand. Hidden once a design system is active. */}
        {!designActive && (
          <div className="rule-thin mt-8 pb-2 sm:pb-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-center">
              <span className="kicker">{t('auth.welcome.pickStyle')}</span>
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
          <div className="kicker mb-3 text-center">{t('auth.welcome.examples')}</div>
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
    </div>
  )
}
