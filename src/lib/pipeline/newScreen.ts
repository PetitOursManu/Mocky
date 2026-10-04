/**
 * A new screen, from a request to a finished component on the canvas.
 *
 * ── Why this is not in ProjectView any more ─────────────────────────────────
 *
 * It was a `useCallback` of a thousand lines, and that was fine while the
 * composer was the only door. The MCP server is a second one (plans/
 * mcp-serveur.md): a request arriving from Claude or ChatGPT has to run THIS
 * pipeline — the same direction, the same Muse, the same Motion Ultra, the same
 * planner — or every invariant those stages keep would need keeping twice. A
 * second pipeline written for the server would be a mirror of a thousand lines,
 * and this repository knows what its mirrors cost.
 *
 * So the stages live here, and everything the component used to touch directly
 * arrives through two arguments: `NewScreenRequest`, what the composer held when
 * "Générer" was pressed, and `NewScreenHooks`, where the run reports what it is
 * doing and writes what it made. ProjectView keeps the React state, the abort
 * controller and the error banner; a headless runner supplies the same hooks
 * without a composer behind them.
 *
 * The move was mechanical on purpose. Every comment below was written about
 * the code it sits on, and it still sits on it; what changed is how a stage
 * reaches the screen (`hooks.updateScreen` for `onUpdateScreen`), never what it
 * sends to a model. Checked by recording the provider's requests for the same
 * scenarios before and after the move: identical.
 */
import type { Settings } from '../settings'
import { buildIdentityReference, buildLayoutReference, deriveDesignSystem, detectComponentName, generateComponent, readSiteContent } from '../generate'
import { deriveName, deriveProjectName, DEFAULT_PROJECT_NAME, newId, type Project, type Screen, type ScreenUltra } from '../project'
import { filmMedia } from '../screenMedia'
import { resolveDirection } from '../direction'
import { getPreset } from '../presets'
import { composerPageFormat, documentHint, documentPipeline, pickReference } from '../documentMode'
import type { PageFormatId } from '../pageFormats'
import { checkLegibility } from '../capture'
import { selectCapabilities, resolveCapabilities, capabilitiesFor } from '../capabilities/select'
import { planScreen, planToPromptSection, inferMode, modeToPromptSection } from '../plan'
import { runStoryboard, type UltraImageCount } from '../ultra/storyboard'
import { generateUltraImages } from '../ultra/images'
import { buildUltraPreamble } from '../ultra/preamble'
import { missingUltraImages, ultraMotionCount, ULTRA_BUDGET } from '../ultra/check'
import { filmSectionOf, plugFilmIntoSlot } from '../ultra/filmSlot'
import { buildReuseSection, projectUltraPictures } from '../ultra/reuse'
import { screenThemeBriefLine, withScreenTheme, type ScreenThemeId } from '../screenThemes'
import { buildSiteReferenceSection, buildSitePicturesSection, parseSitePictures, siteLanguage, type SiteRefMode } from '../siteReference'
import { findSitePictures, type SitePictureFound } from '../sitePictures'
import {
  buildDocumentPictureSection,
  documentPictureSource,
  documentPictureWant,
  findDocumentPicture,
  imageGenerationAvailable,
  type DocumentImageChoice,
} from '../documentPictures'
import { createStockFinder, photoReferenceNote, pickStockSlotImages, PHOTO_REFERENCES_MAX, type ImageSource } from '../stockImages'
import {
  runMuseDossier,
  generateSlotImages,
  buildMusePreamble,
  parseUrls,
  absoluteUrl,
  checkVision,
  generateScrollVideo,
  buildVideoPrompt,
  describeUserMedia,
  imageAsDataUrl,
  profileForMode,
  buildInspirationPrompt,
  INSPIRATION_NEGATIVE,
  type MuseConfig,
  type MuseDossier,
  type MuseResult,
  type MuseImageMode,
  type GeneratedSlotImage,
  type GeneratedVideo,
  type MuseVideoAvailability,
} from '../muse'
import { buildDesignPreamble, extractDesignColors } from '../design'
import { imageUrl, listLibrary, type PinnedImage } from '../imageLibrary'
import { videoBase, type PinnedVideo } from '../videoLibrary'
import { awaitVideoJob, motionNotices, proposeVideoTimeline, startVideoRender, type MotionKindOffer } from '../video/client'
import { toRenderInputFrom } from '../video/draft'
import { themeFromDesign } from '../video/theme'
import { readPage3D } from '../video/pageScenes'
import { directionBriefFrom } from '../video/directionBrief'
import { withAnimations } from '../animations'
import { lintSlop } from '../lint'
import { buildProvidedPicturesSection, type ProvidedPicture } from '../providedPictures'
import type { TranslationKey } from '../../i18n'

/** What the run is busy with, for the composer's progress line. */
export type NewScreenPhase = 'planning' | 'generating' | 'muse' | 'design' | 'ultra' | 'site' | 'sitePictures' | 'docPicture'

/** Site screenshots attached to the request, already cut into parts. */
export interface SiteRun {
  mode: SiteRefMode
  /** How many parts each screenshot was cut into, in order. */
  groups: number[]
  parts: string[]
}

/**
 * Everything the composer held when "Générer" was pressed.
 *
 * Read ONCE, at the press: the run outlives the render that started it, and a
 * value changed in the composer meanwhile belongs to the next run.
 */
export interface NewScreenRequest {
  /** The request in words — the default sentence when screenshots stand in for it. */
  text: string
  settings: Settings
  project: Project
  /** The project's screens at the press (its identity reference, its first-screen naming). */
  screens: Screen[]
  /** Pictures for the model, annotations FIRST: their numbers are the ones the user wrote. */
  images: string[]
  /** How many of `images` are annotations — the site section counts its own from after them. */
  annotationCount: number
  site: SiteRun | null
  /** The global DESIGN.md, when it is active. */
  globalMd?: string
  presetId: string
  themeId: ScreenThemeId | null
  pageFormatId: PageFormatId | null
  /** "Nouvelle direction", ticked for this run. */
  redesign: boolean
  museConfig: MuseConfig
  /** null while unknown — Muse then runs and degrades if the server says no (M3). */
  museAvail: boolean | null
  museVision: boolean | null
  pinnedImages: PinnedImage[]
  pinnedVideo: PinnedVideo | null | undefined
  videoAvail: MuseVideoAvailability | null
  motionAvail: { available: boolean; kinds: MotionKindOffer[] } | null
  /** The project's Motion Ultra setting, unpaused and allowed for this account. */
  ultraActive: boolean
  ultraCount: number
  /** The composer's "Images" choice, after what the server allows. */
  effectiveImageSource: ImageSource
  /** A document's own picture choice, after what the server allows. */
  docPictureSource: ImageSource | null
  docImageChoice: DocumentImageChoice
  /** Whether picture generation exists here; null until the server has said. */
  imageGenOk: boolean | null
  stockImagesUsable: boolean
  /**
   * Pictures the requester supplied, already in the account's library — an
   * assistant's choice through MCP (lib/providedPictures.ts). Absent from every
   * composer run, which therefore builds the prompt it always built (X5).
   */
  providedPictures?: ProvidedPicture[]
  /** What a document's own picture should show, said by the requester; absent, it is read from the request. */
  pictureSubject?: string
}

/** A list updated either with a value or from the previous one, like a React setter. */
type ListUpdate<T> = T[] | ((prev: T[]) => T[])

/**
 * Where a run reports and writes. ProjectView backs these with its state; a
 * caller with no composer can make most of them no-ops — what it cannot skip
 * is `addScreen`, `updateScreen` and `currentScreens`, which ARE the project.
 */
export interface NewScreenHooks {
  signal: AbortSignal
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  setPhase(phase: NewScreenPhase | null): void
  setMuseStage(label: string | null): void
  setUltraStage(label: string | null): void
  /** A sentence about this run that replaces what was said before. */
  replaceNotice(line: string): void
  /** A sentence added after what was already said. */
  notice(line: string): void
  setMuseResult(result: MuseResult | null): void
  setMuseImages(update: ListUpdate<GeneratedSlotImage>): void
  setMuseImageError(message: string | null): void
  setImageGenOk(ok: boolean): void
  /** Placed by the canvas, which is why it carries no position. */
  addScreen(screen: Omit<Screen, 'x' | 'y'>): void
  updateScreen(id: string, patch: Partial<Screen>): void
  removeScreen(id: string): void
  /** The project's screens NOW — a long run must not write over a newer state with an old one. */
  currentScreens(): Screen[]
  renameProject(name: string): void
  setDesign(markdown: string): void
  /** The site reading behind a screen, kept for its later edits. */
  rememberSiteRef(screenId: string, ref: SiteRun & { content: string | null; pictures: string }): void
  /** The screen exists and the model is about to write it. */
  screenStarted(screenId: string): void
  /** The model has finished writing it; what follows is checks and the film. */
  screenWritten(screenId: string): void
  /** Motion Ultra's film is being made for this screen. */
  motionStage(screenId: string, label: string): void
  motionStageDone(): void
}

export interface NewScreenOutcome {
  screenId: string
  /** What the error banner should say, when something about the result needs saying. */
  error?: string
  /** Set when `error` is the placeholder-text advisory, which the polish path reads back. */
  slop?: string
}

export function joinSystem(parts: Array<string | undefined>): string | undefined {
  const joined = parts.filter(Boolean).join('\n\n')
  return joined || undefined
}

/**
 * The reference a new screen borrows from the project — a layout when one is
 * pinned (or the screens share a form), an identity otherwise. See
 * `pickReference` for which screen and why.
 */
export function identityOrLayoutReference(
  screens: Screen[],
  pinnedId: string | undefined,
  excludeId: string | undefined,
  forDocument: boolean,
): string | undefined {
  const ref = pickReference(screens, { pinnedId, excludeId, document: forDocument })
  if (!ref) return undefined
  return ref.kind === 'layout' ? buildLayoutReference(ref.screen.code) : buildIdentityReference(ref.screen.code)
}

/**
 * Run the whole pipeline for one new screen.
 *
 * Throws what the stages throw — an abort included, as an AbortError — and
 * cleans up after itself first: a screen that was added but never received a
 * character is removed, while one with code in it is kept as the work it is.
 */
export async function runNewScreen(req: NewScreenRequest, hooks: NewScreenHooks): Promise<NewScreenOutcome> {
  const {
    text,
    settings,
    project,
    images,
    site,
    globalMd,
    presetId,
    themeId,
    pageFormatId,
    museConfig,
    museAvail,
    museVision,
    pinnedImages,
    pinnedVideo,
    videoAvail,
    motionAvail,
    ultraActive,
    effectiveImageSource,
    docPictureSource,
    docImageChoice,
    imageGenOk,
    stockImagesUsable,
  } = req
  const ultraCount = req.ultraCount as UltraImageCount
  const { signal, t } = hooks
  /** On a new screen, screenshots come with an intent (lib/siteReference.ts). */
  const siteNew = !!site
  /** A reproduction takes the look from the screenshots, so nothing else may supply one. */
  const reproducing = siteNew && site.mode === 'reproduce'
  const redesigning = req.redesign
  let siteSection = siteNew ? buildSiteReferenceSection(site.mode, site.groups, req.annotationCount + 1) : undefined
  /**
   * The free-photo finder for this run, when the composer says "Images: free".
   *
   * Vision is what makes it choose well (the judge looks at the thumbnails),
   * so it is asked for here if Muse did not already probe it: Motion Ultra
   * can run without Muse, and then nobody had. The answer is cached server
   * side, so asking again costs a round trip at most.
   */
  const stockFinder = async (ultra?: number) => {
    const vision = museVision ?? (await checkVision(signal)).vision
    return createStockFinder({
      project: project.id,
      settings,
      vision: vision === true,
      brief: text,
      ultra,
      signal,
    })
  }
  /** The screen this run created, if any — so a failure can clean it up. */
  let newScreenId: string | null = null
  try {
    // Create a new screen using the selected format preset.
    const preset = getPreset(presetId)
    /*
     * The screen type rides on the form-factor hint, so it reaches every
     * stage the hint does — the preamble (and Muse's), the planner, the
     * storyboard. Not on a reproduction: the screenshot is the brief, and a
     * type's structure would argue with the structure it shows. No type,
     * and this IS `preset.hint`, byte for byte.
     */
    const runTheme = reproducing ? null : themeId
    /*
     * A DOCUMENT type makes a document: its page format, its page hint in
     * place of the preset's, and every stage decision in one place
     * (`documentPipeline`). No document type, and `pipe` changes nothing —
     * `formHint` is the line it always was.
     */
    const runPage = composerPageFormat(runTheme, pageFormatId)
    const pipe = documentPipeline(runPage)
    /*
     * The document's picture source for THIS run. A remembered "Générée"
     * cannot be honoured until the server has said whether generation
     * exists here, and a run started before that answer went ahead with no
     * picture and no word about it. So a pending answer is awaited, once.
     */
    let runDocPicture = docPictureSource
    if (pipe.document && docImageChoice === 'ai' && imageGenOk === null) {
      const ok = await imageGenerationAvailable(signal).catch(() => false)
      hooks.setImageGenOk(ok)
      runDocPicture = documentPictureSource(docImageChoice, { generation: ok, stock: stockImagesUsable })
    }
    /*
     * Where a document's pictures come from: its OWN choice, for every path
     * that makes one. On a document the composer shows that choice INSTEAD
     * of the general Images control, so the general one is invisible there —
     * and "Sans image" beside a Muse hero or redesigned-site pictures being
     * generated from the hidden setting was a paid picture the screen said
     * would not happen. Muse still writes its dossier (palette, type); only
     * its pictures follow the document's choice.
     */
    const museImageSource: ImageSource = pipe.document && runDocPicture ? runDocPicture : effectiveImageSource
    const picturesAllowed = !pipe.document || runDocPicture !== null
    const pictureSource: ImageSource = pipe.document && runDocPicture ? runDocPicture : effectiveImageSource
    const formHint =withScreenTheme(pipe.format ? documentHint(pipe.format) : preset.hint, runTheme)
    /** Motion Ultra for THIS run: the project's setting, unless the screen is a document. */
    const runUltra = ultraActive && pipe.motionUltra
    if (ultraActive && !runUltra) hooks.replaceNotice(t('project.docUltraSkipped'))
    const frameW = pipe.frame?.w ?? preset.w
    const frameH = pipe.frame?.h ?? preset.h
    // With site screenshots, the site's own brand is the identity to carry,
    // not the one an earlier screen invented. A PINNED layout still holds on
    // a redesign — pinning is the user's own statement — and never on a
    // reproduction, whose chrome is the screenshot's.
    const referencePreamble = !siteNew
      ? identityOrLayoutReference(req.screens, project.referenceScreenId, undefined, pipe.document)
      : !reproducing && project.referenceScreenId
        ? identityOrLayoutReference(req.screens, project.referenceScreenId, undefined, pipe.document)
        : undefined

    // --- Muse: build a Design Dossier + hero image. The dossier is a
    // CANDIDATE direction, not the authority it once was — see the
    // resolveDirection call below. Muse must never block generation (M3),
    // and when OFF the path below is byte-identical to pre-Muse Mocky (M1).
    /** The Motion kinds this account can render right now — empty when it cannot. */
    const motionKindIds = motionAvail?.available ? motionAvail.kinds.map((k) => k.id) : []
    let musePreamble: string | undefined
    let museMarkdown: string | undefined
    /** Whether Muse got far enough to have something to say. */
    let museRan = false
    /** This run's dossier — kept for its palette and its imagery plan. */
    let museDossier: MuseDossier | undefined
    /** The images this run ended up with, pinned or generated. */
    let museImgs: GeneratedSlotImage[] = []
    /** Art-direction reference sent to a vision model ("inspiration" mode). */
    let museVisionRef: string | undefined
    /**
     * Thumbnails of the free photos this run FOUND, shown to the model that
     * writes the page so it designs around them (`photoReferenceNote`).
     * Only filled when a vision model chose them — the thumbnails exist
     * because it looked.
     */
    let photoRefs: string[] = []
    /** Library hash of the image backing this screen, shown on the canvas. */
    let museImageHash: string | undefined
    /** The scroll sequence, when one was asked for and produced. */
    let museVideo: GeneratedVideo | null = null
    // A clip pinned before the administrator closed video to this account
    // is not used: the pin lives in the browser, the permission on the
    // server, and the server's answer is the one that holds. Nor on a
    // document: a scroll sequence scrubs on a scroll a page does not have.
    const runPin =
      pipe.scrollVideo &&
      pinnedVideo &&
      (!videoAvail?.access || videoAvail.access.generate || videoAvail.access.stock)
        ? pinnedVideo
        : null
    // The saved preference is kept as-is; a model without vision can only
    // honour "content", so THIS RUN degrades without touching the setting.
    const effectiveImageMode: MuseImageMode =
      museVision === false && museConfig.imageMode !== 'content' ? 'content' : museConfig.imageMode
    /*
     * A redesign reads the site's CONTENT first — brand, navigation, sections,
     * copy — as words. Without it Muse wrote its dossier from "Refonte
     * graphique de ce site" alone, invented a product to go with it, and its
     * preamble made that invention authoritative: the first real test came
     * back as an unrelated site. With it, the dossier is about the site that
     * exists, and the page gets the copy in words as well as in pixels.
     *
     * A reproduction reads too, for the list of the site's PICTURES the
     * reading also returns: each gets a replacement below.
     */
    let siteContent: string | null = null
    if (siteNew) {
      hooks.setPhase('site')
      siteContent = await readSiteContent(settings, site.parts, signal)
      siteSection = buildSiteReferenceSection(site.mode, site.groups, req.annotationCount + 1, siteContent)
    }
    /** Muse would write about a product it cannot see: not without the reading. */
    const museBlind = siteNew && !reproducing && !siteContent
    if (museBlind && museConfig.enabled && museAvail !== false) hooks.replaceNotice(t('project.siteMuseSkipped'))
    const siteLang = siteLanguage(siteContent)
    const museBriefBase = siteContent
      ? `${text}\n\nThe existing site to REDESIGN, as read from the user's screenshots. Its brand, content and copy are to be KEPT; only its visual design is to be reinvented.${siteLang ? ` All copy stays in ${siteLang}.` : ''}\n\n${siteContent}`
      : text
    // The dossier is told WHAT it is dressing — a dashboard wants no hero
    // photograph — and nothing more: the layout is the page's business.
    const museThemeLine = screenThemeBriefLine(runTheme)
    const museBrief = museThemeLine ? `${museBriefBase}\n\n${museThemeLine}` : museBriefBase
    // A reproduction's direction is the screenshot: a dossier would be a
    // second, contradicting one, and a paid call to write it.
    if (museConfig.enabled && museAvail !== false && !reproducing && !museBlind) {
      try {
        hooks.setMuseResult(null)
        hooks.setMuseImages([])
        hooks.setMuseImageError(null)
        hooks.setPhase('muse')

        /*
         * The user's own media, described BEFORE the dossier is written.
         *
         * This is the difference between a screen that merely contains the
         * user's picture and one that was designed around it: the dossier
         * writes the palette, and until now it wrote it blind. A chosen
         * sequence wins over a pinned image — it is the hero, and the whole
         * page is built on top of it.
         *
         * Best-effort throughout. No media, an unreadable file, a model
         * without vision: Muse runs exactly as it did before.
         */
        let userMedia = null
        const mediaSource = runPin
          ? { url: absoluteUrl(runPin.poster), kind: 'video' as const }
          : pinnedImages[0]
            ? { url: absoluteUrl(pinnedImages[0].url), kind: 'image' as const }
            : null
        if (mediaSource) {
          hooks.setMuseStage(t('project.museStageMedia'))
          userMedia = await describeUserMedia(mediaSource.url, mediaSource.kind, {
            vision: museVision,
            signal: signal,
          })
          if (userMedia && runPin?.drive === 'pointer') userMedia = { ...userMedia, drive: 'pointer' as const }
        }

        hooks.setMuseStage(t('project.museStageDossier'))
        const res = await runMuseDossier(museBrief, {
          language: siteLang,
          urls: parseUrls(museConfig.urls),
          useFetch: museConfig.useFetch,
          projectName: project.name,
          userMedia,
          // No question about films: none is made on its own any more (see
          // the note where the screen's 3D is read, after generation).
          signal: signal,
        })
        hooks.setMuseResult(res)
        const plan = res.dossier.imageryPlan || []
        // Pinned library images (possibly from other projects) fill the
        // first slots BEFORE any new generation (§4.3). URLs must be absolute
        // for the null-origin preview iframe (M6).
        const pins: GeneratedSlotImage[] = pinnedImages.map((p, i) => ({
          slot: plan[i]?.slot || plan[i]?.id || `image-${i + 1}`,
          id: plan[i]?.id || `pin-${i + 1}`,
          url: absoluteUrl(p.url),
        }))
        let imgs: GeneratedSlotImage[] = [...pins]
        if (pins.length) hooks.setMuseImages(pins)
        // Generate a new hero only when no pin already covers a slot (capped
        // to keep the run fast; multi-image is a later increment).
        const remaining = plan.slice(pins.length)
        // Motion Ultra generates its own series further down, planned as
        // one shoot. Muse's hero on top of it would be a seventh picture
        // nobody placed, paid for on every run.
        if (remaining.length && pins.length === 0 && !runUltra && picturesAllowed) {
          // A mood/art-direction reference and a hero photo are different
          // jobs, so they run on different image models (Admin → profils).
          const profile = profileForMode(effectiveImageMode)
          hooks.setMuseStage(
            t(profile === 'inspiration' ? 'project.museStageInspiration' : 'project.museStageHero'),
          )
          // In 'inspiration' the image is never embedded — it exists only to
          // be looked at. So it is not the hero photo routed to another
          // model (which is what it used to be, and why the mode so often
          // changed nothing): it is an abstract art-direction plate built
          // from the dossier's own palette and mood.
          const slotsToRun =
            profile === 'inspiration'
              ? [
                  {
                    id: 'art-direction',
                    slot: 'inspiration',
                    prompt: buildInspirationPrompt(res.dossier),
                    negative: INSPIRATION_NEGATIVE,
                  },
                ]
              : remaining
          /*
           * Free photos instead of a model. Up to three slots rather than
           * one: the cap on generation is Pollinations' pace and a price per
           * picture, and a search has neither — a page with its real
           * product shots is worth three quick requests. In 'inspiration'
           * the found photo of the HERO is the reference; an abstract mood
           * plate is something a model paints, not something a library has.
           */
          let gen: GeneratedSlotImage[]
          if (museImageSource === 'stock') {
            hooks.setMuseStage(t('project.museStageStock'))
            const finder = await stockFinder()
            gen = await pickStockSlotImages(remaining, finder, {
              max: profile === 'inspiration' ? 1 : 3,
              signal: signal,
              onImage: (im) => hooks.setMuseImages((a) => [...a, im]),
              onError: (msg) => hooks.setMuseImageError(msg),
            })
            // Only where nothing else shows them: 'inspiration' and 'both'
            // already attach the hero at full size, with their own words.
            if (effectiveImageMode === 'content') photoRefs = finder.chosen().slice(0, PHOTO_REFERENCES_MAX)
          } else {
            gen = await generateSlotImages(slotsToRun, project.id, {
              max: 1,
              profile,
              signal: signal,
              onImage: (im) => hooks.setMuseImages((a) => [...a, im]),
              onError: (msg) => hooks.setMuseImageError(msg),
            })
          }
          imgs = [...imgs, ...gen]
        } else if (!remaining.length && !pins.length && !runUltra) {
          // No imagery slot at all. The dossier now guarantees a hero, so
          // this means something upstream produced nothing — say so rather
          // than finishing silently with an image-less screen.
          hooks.setMuseImageError(t('project.museNoImage'))
        }
        // "inspiration" and "both" show the image to the model. In "both"
        // it is the same image it will embed, so it can design around it.
        if (effectiveImageMode !== 'content' && imgs.length) {
          const dataUrl = await imageAsDataUrl(imgs[0].url, signal)
          if (dataUrl) museVisionRef = dataUrl
        }
        // Remember which image backs this screen so the canvas can show it.
        if (imgs.length) museImageHash = imgs[0].url.split('/').pop() || undefined

        /*
         * The scroll sequence, when it was asked for.
         *
         * Runs LAST and on the hero's own prompt, so the clip and the still
         * describe the same subject — the still is what the screen falls
         * back to if this fails, and two unrelated pictures would be worse
         * than one.
         *
         * A failure here does not sink the generation: the screen is built
         * without the sequence, which is exactly the screen the user would
         * have got with the box unticked. But it is reported, unlike an
         * image failure, because this one cost minutes and money.
         */
        if (runPin) {
          // A sequence chosen from the library wins over generating one.
          // Same rule the pinned IMAGES follow, and for the same reason:
          // the user has already answered the question this step exists to
          // ask, and answering it again costs minutes and money.
          museVideo = {
            hash: runPin.hash,
            base: absoluteUrl(videoBase(runPin.hash)),
            poster: absoluteUrl(runPin.poster),
            frames: runPin.frames,
            fromCache: true,
            drive: runPin.drive,
          }
        } else if (museConfig.video && videoAvail?.available && pipe.scrollVideo) {
          const heroSlot = plan[0]
          const heroPrompt = heroSlot?.prompt || heroSlot?.subject || text
          hooks.setMuseStage(t('project.museStageVideo'))
          try {
            museVideo = await generateScrollVideo(buildVideoPrompt(heroPrompt), project.id, {
              negative: heroSlot?.negative,
              slot: 'hero',
              signal: signal,
            })
          } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') throw err
            hooks.setMuseImageError(
              t('project.museVideoFailed', { detail: err instanceof Error ? err.message : String(err) }),
            )
          }
        }

        /*
         * Muse's results are published only once it has finished.
         *
         * All of it or none of it, which is the M3 contract read strictly: a
         * run that threw halfway used to leave the preamble unbuilt — Muse
         * contributed nothing — while still labelling the screen with the
         * dossier it had written. Now that a dossier can become the whole
         * project's direction, that discrepancy stops being cosmetic.
         */
        museMarkdown = res.markdown
        museDossier = res.dossier
        museImgs = imgs
        museRan = true
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err
        // Degrade: continue without Muse rather than fail the generation.
        hooks.setMuseStage(null)
      }
    }

    /*
     * One direction per project — decided here, once, for this run.
     *
     * Muse used to be the authority by construction: whatever dossier it had
     * just written superseded everything, on every generation, so a project
     * accumulated one visual language per screen. It is now a candidate like
     * any other, and it only wins when there is nothing to protect (the
     * project's first screen) or when the user asked for a redesign.
     */
    const dir: { markdown?: string; establish?: string } = reproducing
      ? {}
      : resolveDirection({
          established: project.design,
          fresh: museMarkdown,
          global: globalMd,
          redesign: redesigning,
        })

    /*
     * Muse's preamble, carrying whichever direction won.
     *
     * The palette is restated as Tailwind classes because the dossier's own
     * hex list, buried in a long markdown block, lost every time to the base
     * rules naming concrete Tailwind families — see buildMusePreamble. So the
     * restatement has to describe the direction ACTUALLY in force: handing
     * over the fresh dossier's tokens while the text above them is last
     * week's direction is worse than not restating anything.
     *
     * Radius is dropped along with them. It is still stated inside the
     * document itself; only the emphatic repetition goes.
     */
    if (museRan && dir.markdown) {
      const tokens = dir.establish
        ? museDossier?.tokens
        : { colors: extractDesignColors(dir.markdown).slice(0, 12) }
      musePreamble = buildMusePreamble(
        dir.markdown,
        museImgs,
        effectiveImageMode,
        museDossier ? { ...museDossier, tokens } : undefined,
        museVideo,
      )
    }

    // Muse's preamble supersedes DESIGN.md's when present; otherwise the
    // exact pre-Muse composition (M1). Both now carry the same direction.
    const dirPreamble = dir.markdown ? buildDesignPreamble(dir.markdown) : undefined
    const extraSystem = musePreamble
      ? joinSystem([musePreamble, referencePreamble, formHint])
      : joinSystem([dirPreamble, referencePreamble, formHint])

    // Deterministic shortlist first — this is the guaranteed fallback.
    const shortlist = selectCapabilities(text, dir.markdown)
    // Optional planner pass. It runs first (so its capability choice and
    // structure guide generation), but can NEVER block: on failure/timeout
    // it returns null and we use the shortlist unchanged. Skipped when Muse
    // ran — the dossier already provides the structure.
    let capIds = shortlist
    let planSection: string | undefined
    // What the visitor of this screen is here to do. The planner decides it
    // when it runs; otherwise a keyword guess, because the planner is
    // skipped on every Muse run and whenever the setting is off, and a mode
    // that only existed on the planner path would almost never exist.
    let mode = inferMode(text)

    /*
     * Motion Ultra: storyboard → a series of pictures → a section that
     * replaces the planner's (the storyboard IS the plan, in recipes).
     *
     * Off, this block does not run and the path below is exactly the one
     * every non-Ultra project has always taken. On, it degrades rather than
     * fails: the storyboard falls back on its own, a picture that could not
     * be made leaves its recipe to <Backdrop>, and anything that throws here
     * short of a cancel leaves an ordinary generation.
     */
    let ultraRecord: ScreenUltra | undefined
    let ultraImageHash: string | undefined
    /** The one section whose background becomes a rendered film (v2), if any. */
    let ultraFilmSection: string | null = null
    /** Video background asked for, and a film can be rendered right now. */
    const ultraVideo = !!project.ultra?.video && motionKindIds.includes('background')
    /*
     * Not on site screenshots. A storyboard invents the page's sections, and
     * the site already has its sections — the page would be asked to follow
     * two structures at once. Said, because the project setting is on.
     */
    if (runUltra && siteNew) hooks.replaceNotice(t('project.siteUltraSkipped'))
    if (runUltra && project.ultra && !siteNew) {
      try {
        hooks.setPhase('ultra')
        hooks.setUltraStage(t('project.ultraStageStoryboard'))
        const board = await runStoryboard(settings, text, ultraCount as UltraImageCount, mode, {
          design: dir.markdown,
          presetHint: formHint,
          signal: signal,
          stockQueries: effectiveImageSource === 'stock',
        })
        // The storyboard read the whole request; its mode beats the keyword guess.
        mode = board.mode
        const total = board.images.length
        hooks.setUltraStage(t('project.ultraStageImages', { done: 0, total }))
        const failures: string[] = []
        const finder = effectiveImageSource === 'stock' ? await stockFinder(ultraCount) : undefined
        const made = await generateUltraImages(board, project.id, {
          signal: signal,
          onImage: (_im, done) => hooks.setUltraStage(t('project.ultraStageImages', { done, total })),
          onError: (msg) => failures.push(msg),
          series: ultraCount,
          source: effectiveImageSource,
          finder,
        })
        // In storyboard order, since the finder runs one picture at a time.
        if (finder) photoRefs = finder.chosen().slice(0, PHOTO_REFERENCES_MAX)
        if (made.length < total) {
          hooks.setMuseImageError(
            t('project.ultraImagesMissing', { made: made.length, total, reason: failures[0] || '—' }),
          )
        }
        ultraFilmSection = ultraVideo ? filmSectionOf(board.sections, board.mode) : null
        planSection = [
          buildUltraPreamble(board, made, { filmSection: ultraFilmSection }),
          modeToPromptSection(mode),
        ].join('\n\n')
        ultraRecord = {
          recipes: board.sections.map((s) => s.recipe),
          images: made.map((im) => im.hash),
          planned: ultraCount,
        }
        ultraImageHash = made[0]?.hash
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err
        if (signal.aborted) throw err
      } finally {
        hooks.setUltraStage(null)
      }
    }

    // Nor the planner, for the same reason: the screenshots are the plan.
    // Nor on a document: its vocabulary is screens a visitor uses, and the
    // page hint and the type's brief already say what a page holds.
    if (settings.usePlanner && pipe.planner && !musePreamble && !ultraRecord && !siteNew) {
      hooks.setPhase('planning')
      const plan = await planScreen(
        settings, text, shortlist,
        { design: dir.markdown, presetHint: formHint },
        signal,
      )
      if (plan) {
        capIds = plan.capabilities
        planSection = planToPromptSection(plan)
        if (plan.mode) mode = plan.mode
      }
    }
    // Appended to the plan section rather than folded into it, so the mode
    // still reaches generation on the paths where no plan was produced.
    // A reproduction's mode is whatever the site is; the generic advice for
    // a mode would only argue with the screenshot.
    if (!planSection && !reproducing && pipe.modeGuidance) planSection = modeToPromptSection(mode)
    /*
     * No series for THIS screen, but the project has pictures a Motion Ultra
     * run already paid for: offer them (lib/ultra/reuse.ts). Only a project
     * that has such pictures is touched, so one that never used Motion
     * Ultra takes exactly the path it always took (U1). Best-effort: a
     * library that does not answer offers nothing.
     */
    if (!ultraRecord && !reproducing) {
      const owned = projectUltraPictures(hooks.currentScreens())
      if (owned.length) {
        try {
          const lib = await listLibrary({ project: project.id }, signal)
          const pictures = owned.map((hash) => {
            const meta = lib.find((m) => m.hash === hash)
            return { url: absoluteUrl(imageUrl(hash)), about: (meta?.prompt || '').split('.')[0].slice(0, 140) || 'a picture of this project' }
          })
          const reuse = buildReuseSection(pictures)
          if (reuse) planSection = [planSection, reuse].filter(Boolean).join('\n\n')
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') throw err
        }
      }
    }
    // Page animations are always offered: the vocabulary costs nothing and
    // a screen that does not need motion simply does not use it. Holding a
    // screen still is its own setting, in its menu.
    /*
     * The site's pictures, replaced: a free photo of the same subject, or a
     * generated one, following the composer's "Images" choice. A reproduction
     * with every photograph turned into a flat block was faithful and
     * unshowable. Not on a redesign Muse ran for — its dossier already
     * planned and made the pictures, and a second set would compete.
     */
    let sitePics: SitePictureFound[] = []
    let sitePicturesSection = ''
    const sitePictures = siteNew && (reproducing || !museRan) && picturesAllowed ? parseSitePictures(siteContent) : []
    if (sitePictures.length) {
      hooks.setPhase('sitePictures')
      const failures: string[] = []
      const finder = pictureSource === 'stock' ? await stockFinder() : undefined
      const got = await findSitePictures(sitePictures, {
        source: pictureSource,
        project: project.id,
        finder,
        signal: signal,
        onError: (m) => failures.push(m),
      })
      sitePics = got.found
      sitePicturesSection = buildSitePicturesSection(got.found, got.missing)
      if (got.missing) {
        const line = t('project.sitePicturesMissing', {
          missing: got.missing,
          total: sitePictures.length,
          // The finder's sentences end with a full stop; this one is in brackets.
          reason: failures.find(Boolean)?.replace(/[.\s]+$/, '') || '—',
        })
        hooks.notice(line)
      }
    }
    /*
     * A document's own picture, when nothing above made one and the person
     * ASKED for one: Motion Ultra is skipped for paper and Muse is off by
     * default, so this is the only way a flyer gets a hero — and it may be
     * a paid generation, which is why "Sans image" is the default and the
     * choice is drawn wherever a page format is (lib/documentPictures.ts).
     * With none, the flyer's brief composes shapes instead. Not on site
     * captures, whose pictures were just replaced above.
     */
    let docPicture: { hash: string; url: string } | null = null
    if (pipe.ownPicture && pipe.format && !museRan && !siteNew && runDocPicture) {
      hooks.setPhase('docPicture')
      // What the picture should SHOW, when the requester said it apart from the
      // request (an assistant through MCP, in English): far better for a photo
      // library than words lifted from the front of a French sentence.
      const want = documentPictureWant(req.pictureSubject?.trim() || text, pipe.format)
      let miss = ''
      const finder = runDocPicture === 'stock' ? await stockFinder() : undefined
      docPicture = await findDocumentPicture(want, {
        source: runDocPicture,
        project: project.id,
        finder,
        signal: signal,
        onError: (m) => {
          miss = m
        },
      })
      if (docPicture) {
        planSection = [planSection, buildDocumentPictureSection({ ...want, url: docPicture.url })].filter(Boolean).join('\n\n')
        if (finder) photoRefs = finder.chosen().slice(0, PHOTO_REFERENCES_MAX)
      } else {
        const line = t('project.docPictureMissing', { reason: miss.replace(/[.\s]+$/, '') || '—' })
        hooks.notice(line)
      }
    }
    // Pictures the requester chose themselves: said by URL, like a document's
    // own picture, and only when there are some.
    const provided = req.providedPictures?.length ? req.providedPictures : null
    if (provided) planSection = [planSection, buildProvidedPicturesSection(provided)].filter(Boolean).join('\n\n')
    // Last, so on a reproduction it is the final word over the base rules' taste.
    if (siteSection) planSection = [planSection, siteSection, sitePicturesSection].filter(Boolean).join('\n\n')
    capIds = withAnimations(capIds)

    // A sequence exists → the component that plays it must be in scope,
    // whatever the shortlist or the planner decided. 'scrollvideo' has no
    // keyword triggers precisely because it is never a guess: it is added
    // here, and only here, when there is something for it to draw.
    if (museVideo) capIds = capIds.includes('scrollvideo') ? capIds : [...capIds, 'scrollvideo']
    // Same rule for the Ultra kit: force-added when a storyboard exists, and
    // then persisted on the screen, so every later edit of it sees the kit.
    if (ultraRecord && !capIds.includes('ultra')) capIds = [...capIds, 'ultra']
    // A document: what cannot live on paper out, the page kit in. Identity
    // for every other screen.
    capIds = pipe.caps(capIds)

    hooks.setPhase('generating')
    const caps = resolveCapabilities(capIds)
    const screenId = newId()
    newScreenId = screenId
    hooks.addScreen({
      id: screenId,
      name: deriveName(text),
      prompt: text,
      code: '',
      componentName: 'App',
      createdAt: Date.now(),
      w: frameW,
      h: frameH,
      device: pipe.document ? 'none' : preset.device,
      links: [],
      caps: capIds,
      // Whatever was ACTUALLY authoritative for this screen — which, now
      // that a project has one direction, is the same document for every
      // screen in it. That is the point: the field is a record of what
      // produced the screen, and it used to record a different answer each
      // time because a different answer was being invented each time.
      //
      // Kept per-screen rather than read off the project, because a screen
      // generated under an older direction must keep saying so — that is
      // what makes "reprendre ce DESIGN.md" meaningful.
      design: dir.markdown,
      imageHash: museImageHash ?? ultraImageHash ?? sitePics[0]?.hash ?? docPicture?.hash ?? provided?.[0]?.hash,
      // Recorded so the canvas can say what the image was for. Without it
      // the badge could only ever say "Image Muse", which is exactly the
      // ambiguity that made it impossible to tell whether inspiration mode
      // had done anything.
      imageRole: museImageHash ? effectiveImageMode : ultraImageHash || sitePics.length || docPicture || provided ? 'content' : undefined,
      ultra: ultraRecord,
      // Persisted as a pair so a reload can rebuild the sequence without
      // asking the server what it cut.
      videoHash: museVideo?.hash,
      videoFrames: museVideo?.frames,
      siteRef: siteNew ? { mode: site.mode, shots: site.groups.length } : undefined,
      theme: runTheme ?? undefined,
      page: runPage ?? undefined,
      // A document holds still: an entrance whose resting state is
      // opacity 0 prints blank. Undefined — the default — otherwise.
      animations: pipe.animations,
    })
    if (siteNew) hooks.rememberSiteRef(screenId, { ...site, content: siteContent, pictures: sitePicturesSection })
    // Name the project after its FIRST prompt, so it stops being called
    // "Untitled project". A name the user already chose is never touched.
    if (req.screens.length === 0 && project.name.trim() === DEFAULT_PROJECT_NAME) {
      hooks.renameProject(deriveProjectName(text))
    }
    hooks.screenStarted(screenId)
    // The found photos go LAST, after the user's annotations and any
    // inspiration reference: the note that explains them counts from the end.
    const result = await generateComponent(
      settings, text, extraSystem,
      [...images, ...(museVisionRef ? [museVisionRef] : []), ...photoRefs],
      signal,
      (partial) => hooks.updateScreen(screenId, { code: partial }),
      caps,
      [planSection, photoReferenceNote(photoRefs.length)].filter(Boolean).join('\n\n') || undefined,
    )
    hooks.updateScreen(screenId, {
      code: result.code,
      componentName: result.componentName,
      // A document was OFFERED no animation and no 3D, and may have used
      // one anyway: load what the code names, or it renders undefined.
      ...(pipe.document ? { caps: capabilitiesFor(capIds, result.code) } : {}),
    })
    hooks.screenWritten(screenId)
    // Every picture of the series was paid for; one the page left out is
    // worth a sentence (see lib/ultra/check.ts).
    if (ultraRecord) {
      const said: string[] = []
      const unused = missingUltraImages(result.code, ultraRecord)
      if (unused.length) {
        said.push(t('project.ultraUnusedImages', { count: unused.length, total: ultraRecord.images.length }))
      }
      // The budget the prompt states, checked on what came back.
      const moving = ultraMotionCount(result.code)
      if (moving.over) {
        said.push(
          t('project.ultraTooMuchMotion', {
            backdrops: moving.backdrops,
            loops: moving.loops,
            maxBackdrops: ULTRA_BUDGET.backdrops,
            maxLoops: ULTRA_BUDGET.loops,
          }),
        )
      }
      if (said.length) hooks.replaceNotice(said.join(' '))
      /*
       * Text laid over a picture, read on the rendered pixels (see
       * lib/legibility.ts) — the one thing the class-based contrast audit
       * cannot see. In the background, after the screen is on the canvas:
       * about a second of rendering, no model call, and a failure to check
       * is not a finding (Q1).
       */
    }
    /*
     * Text laid over a picture, read on the rendered pixels (lib/legibility.ts)
     * — for EVERY screen that lays text over one, not only Motion Ultra's: a
     * Muse hero photo or a pinned image has the same blind spot in the
     * class-based audit. A screen with no picture is never rendered for it.
     * Local, about a second, in the background; a failure to check is not a
     * finding (Q1).
     */
    if (ultraRecord || ['/api/images/', '<Backdrop', '<MotionFilm', '<ScrollSequence', '<PointerSequence'].some((k) => result.code.includes(k))) {
      checkLegibility(result.code, frameW, pipe.format?.h ?? preset.h, caps)
        .then((hard) => {
          if (!hard.length) return
          const list = hard.slice(0, 3).map((f) => `« ${f.text.length > 40 ? f.text.slice(0, 40) + '…' : f.text} »`).join(', ')
          const line = t(ultraRecord ? 'project.ultraLegibility' : 'project.legibility', { count: hard.length, list })
          hooks.notice(line)
        })
        .catch(() => {})
    }

    /*
     * No film is made on its own any more. The composer's animation switch
     * used to decide one — "forced" rendered a film for EVERY screen, a
     * text call and minutes of the worker each time — and it is gone: page
     * animations are always on and free, and a film is made only when asked
     * for, by Motion Ultra's video background below or the Motion panel.
     *
     * What the page drew in 3D is still read: the video background is told
     * about it, so it does not draw a second world on the same screen.
     */
    const page3d = await readPage3D(result.code)


    /*
     * Motion Ultra's video background (v2).
     *
     * The page already has the place for it — `<Backdrop slot="film">` in
     * the section the storyboard pass chose — and is already alive there in
     * CSS. What runs here is the film: composed from the series' pictures
     * as a `background` kind, rendered by the LOCAL worker (no video is
     * billed), then plugged into that slot by one attribute at a parsed
     * offset, with no call and no rewrite. Every failure leaves the section
     * exactly as designed and says so (U4).
     */
    if (project.ultra?.video && ultraRecord && !ultraFilmSection) {
      hooks.notice(t(ultraVideo ? 'project.ultraFilmNoSection' : 'project.ultraFilmUnavailable'))
    }
    if (ultraFilmSection && ultraRecord) {
      try {
        hooks.motionStage(screenId, t('project.ultraFilmStage', { step: t('project.ultraFilmCompose') }))
        const theme = themeFromDesign(dir.markdown)
        const proposal = await proposeVideoTimeline(text, ultraRecord.images, {
          settings,
          theme,
          motionKind: 'background',
          placement: {
            section: ultraFilmSection,
            why: 'The moving ground of this section, behind its own copy: it carries no words of its own.',
          },
          scenery: page3d.scenes,
          direction: directionBriefFrom(dir.markdown),
          signal: signal,
        })
        if (!proposal.timeline) {
          hooks.notice(t('project.ultraFilmFailed', { detail: motionNotices(proposal.notices) }))
        } else {
          hooks.motionStage(screenId, t('project.ultraFilmStage', { step: t('project.ultraFilmRender') }))
          const renderable = toRenderInputFrom(proposal.timeline, proposal.timeline.outputFormat, proposal.timeline.aspectRatio)
          const job = await startVideoRender(renderable, { project: project.id, theme, brief: text, signal: signal })
          const finished = await awaitVideoJob(job.id, signal)
          if (finished.status === 'done' && finished.videoHash) {
            const now = hooks.currentScreens().find((s) => s.id === screenId)
            const plugged = now ? await plugFilmIntoSlot(now.code, absoluteUrl(`/api/video/${finished.videoHash}`)) : null
            if (now && plugged) {
              hooks.updateScreen(screenId, {
                code: plugged,
                componentName: detectComponentName(plugged),
                previousCode: now.code,
                attachedMedia: filmMedia(finished.videoHash),
              })
            } else {
              hooks.updateScreen(screenId, { attachedMedia: filmMedia(finished.videoHash) })
              hooks.notice(t('project.ultraFilmNoSlot'))
            }
          } else {
            hooks.notice(t('project.ultraFilmFailed', { detail: finished.error || '—' }))
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err
        hooks.notice(t('project.ultraFilmFailed', { detail: err instanceof Error ? err.message : String(err) }))
      } finally {
        hooks.motionStageDone()
      }
    }

    /*
     * The direction is kept only once the screen exists.
     *
     * Doing it at onAddScreen time would have changed what the whole project
     * looks like on the strength of a run the user then cancelled — and a
     * cancelled run deletes its screen, so there would be nothing left to
     * explain why every subsequent screen had changed.
     */
    if (dir.establish) {
      hooks.setDesign(dir.establish)
    } else if ((redesigning || (reproducing && !project.design?.trim())) && result.code.trim()) {
      /*
       * A redesign with Muse off.
       *
       * There is no dossier to keep, so the direction is read back off the
       * screen the prompt just produced — the same derivation as "Faire de
       * cet écran mon DESIGN.md", run automatically because the user already
       * said that is what they wanted by ticking the box.
       *
       * Best-effort: the screen is finished and correct either way, and a
       * failure here only means the next screen falls back to the direction
       * that was in force before.
       *
       * A reproduction takes the same road when the project has no direction
       * yet: the site it copied becomes the project's look, so the next page
       * asked for is a page of that site and not of the global DESIGN.md.
       */
      hooks.setPhase('design')
      try {
        const derived = await deriveDesignSystem(settings, result.code, signal)
        if (derived.trim()) hooks.setDesign(derived)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err
      }
    }

    if (result.truncated) {
      // The code is cut mid-token; the preview would only show a cryptic
      // "Unterminated string constant". Say what actually happened.
      return { screenId, error: t('project.truncated') }
    } else {
      // Anti-slop lint (§5.2): flag placeholder text so the user can regenerate.
      const lint = lintSlop(result.code)
      if (!lint.ok) {
        const advisory = t('project.slop', { list: lint.violations.join(', ') })
        return { screenId, error: advisory, slop: advisory }
      }
    }
    return { screenId }
  } catch (err) {
    // A screen that was added but never received a single character is not a
    // draft, it is debris: pressing "Stop" one second in used to leave a blank
    // frame on the canvas that the user then had to find and delete by hand.
    // Anything with code in it is kept — that is work, however partial.
    if (newScreenId) {
      const added = hooks.currentScreens().find((s) => s.id === newScreenId)
      if (added && !added.code.trim()) hooks.removeScreen(newScreenId)
    }
    throw err
  }
}
