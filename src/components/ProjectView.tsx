import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { loadSettings } from '../lib/settings'
import { buildDesignPreamble, isDesignActive, loadDesign, extractDesignColors, extractProductName } from '../lib/design'
import { editComponent, fixComponent, generateComponent, polishComponent, auditFixComponent, detectComponentName, buildLayoutReference, buildIdentityReference, buildAnimationInstruction, ANIMATION_LEVELS, buildElementEditInstruction, tryDirectTextReplace, deriveDesignSystem, type AnimationLevel } from '../lib/generate'
import { deriveName, deriveProjectName, DEFAULT_PROJECT_NAME, designForProject, newId, type AttachedMedia, type Hotspot, type Project, type Screen, headline } from '../lib/project'
import { filmMedia } from '../lib/screenMedia'
import { resolveDirection } from '../lib/direction'
import { usePhone } from '../lib/usePhone'
import { DEFAULT_PRESET_ID, getPreset, hintForDevice } from '../lib/presets'
import { captureRegion } from '../lib/capture'
import { queueThumbs } from '../lib/thumbnails'
import { proposeLinks, withoutExisting, type LinkCandidate } from '../lib/autolink'
import { selectCapabilities, resolveCapabilities, capabilitiesFor } from '../lib/capabilities/select'
import { planScreen, planToPromptSection, inferMode, modeToPromptSection } from '../lib/plan'
import { checkQuality, type QualityFinding } from '../lib/quality'
import { auditScreen } from '../lib/audit'
import { runPolishLoop, type PolishReport } from '../lib/polish'
import { closeSlot, toggleSlot, type RightSlot } from '../lib/rightSlot'
import { downloadZip, downloadTsx } from '../lib/export'
import type { StackTarget } from '../lib/export/project'
import { replaceTokenHex, type DesignToken } from '../lib/designTokens'
import Welcome from './Welcome'
import Canvas from './Canvas'
import MobileProject from './MobileProject'
import type { SweptElement } from './Preview'
import DesignSystemPanel from './DesignSystemPanel'
import PresetPicker from './PresetPicker'
import DemoPlayer from './DemoPlayer'
import ProposedLinks from './ProposedLinks'
import CodeView from './CodeView'
import ShareDialog from './ShareDialog'
import { SaveDesignDialog } from './DesignLibrary'
import DesignSpecSheet from './DesignSpecSheet'
import { type PickInfo } from './Preview'
import MusePanel from './MusePanel'
import Bibliotheque, { type MediaTab } from './Bibliotheque'
import ImageLightbox from './ImageLightbox'
import FilmLightbox from './FilmLightbox'
import ScreenImagesDialog from './ScreenImagesDialog'
import VideoExportDialog from './VideoExportDialog'
import AuditPanel from './AuditPanel'
import {
  loadMuseConfig,
  saveMuseConfig,
  museAvailable,
  runMuseDossier,
  generateSlotImages,
  buildMusePreamble,
  parseUrls,
  absoluteUrl,
  checkVision,
  checkVideoAvailability,
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
} from '../lib/muse'
import { imageUrl, listLibrary, type LibraryImage, type PinnedImage } from '../lib/imageLibrary'
import { videoBase, videoPosterUrl, type PinnedVideo } from '../lib/videoLibrary'
import {
  fetchVideoAccess,
  fetchVideoJob,
  proposeVideoTimeline,
  startVideoRender,
  videoStreamUrl,
  POLL_INTERVAL_MS,
  type MotionKindOffer,
} from '../lib/video/client'
import { filmTextRuns, toRenderInputFrom } from '../lib/video/draft'
import type { RenderTimeline, VideoTimeline } from '../lib/video/timeline'
import { themeFromDesign } from '../lib/video/theme'
import { directionBriefFrom } from '../lib/video/directionBrief'
import { matchImagesToScreens } from '../lib/imageBackfill'
import {
  applyAnimationMode,
  loadAnimationMode,
  nextAnimationMode,
  saveAnimationMode,
  type AnimationMode,
} from '../lib/animations'
import { lintSlop } from '../lib/lint'
import { getLang, useT } from '../i18n'
import { Button, Icon, IconButton, MockyLoader, Modal, Select, type IconName } from '../ui'

/** Translation keys per animation state — resolved at render, like every label. */
const ANIM_LABELS: Record<AnimationMode, { label: string; hint: string }> = {
  auto: { label: 'project.animAuto', hint: 'project.animHintAuto' },
  on: { label: 'project.animOn', hint: 'project.animHintOn' },
  off: { label: 'project.animOff', hint: 'project.animHintOff' },
}

/** Fixed viewport formats offered in the screen context menu. */
type ViewportFormat = 'mobile' | 'tablet' | 'desktop' | 'full'
const VIEWPORTS: Record<Exclude<ViewportFormat, 'full'>, { w: number; h: number; device: 'iphone' | 'none' }> = {
  mobile: { w: 390, h: 844, device: 'iphone' },
  tablet: { w: 768, h: 1024, device: 'none' },
  desktop: { w: 1280, h: 1024, device: 'none' },
}

const FRAME_PREF_KEY = 'mocky.showFrame'
const BRIEF_PREF_KEY = 'mocky.brief.open'

/** One-tap recolor swatches offered in the no-code Modify panel (Lot C.2). */
const MODIFY_SWATCHES: { nameKey: string; hex: string }[] = [
  { nameKey: 'project.colorInk', hex: '#0f172a' },
  { nameKey: 'project.colorWhite', hex: '#ffffff' },
  { nameKey: 'project.colorRed', hex: '#ef4444' },
  { nameKey: 'project.colorAmber', hex: '#f59e0b' },
  { nameKey: 'project.colorGreen', hex: '#10b981' },
  { nameKey: 'project.colorBlue', hex: '#3b82f6' },
  { nameKey: 'project.colorIndigo', hex: '#6366f1' },
  { nameKey: 'project.colorFuchsia', hex: '#d946ef' },
]

/** Animation intensities, as dictionary keys — the labels are translated at render. */
const ANIMATION_LEVEL_KEYS: Record<AnimationLevel, string> = {
  subtle: 'project.animSubtle',
  moderate: 'project.animModerate',
  rich: 'project.animRich',
}

/** Decisive recolor instruction: acts on bg for filled elements, text otherwise. */
function recolorChange(hex: string): string {
  return `Change this element's color to ${hex}. If it has a background color (a bg-* class or a background style), replace the background; otherwise change its text color. Prefer an arbitrary Tailwind value like bg-[${hex}] or text-[${hex}]. Keep any text readable (adjust the text color to contrast if needed). Change nothing else.`
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function joinSystem(parts: Array<string | undefined>): string | undefined {
  const joined = parts.filter(Boolean).join('\n\n')
  return joined || undefined
}

/** Max automatic fix attempts per screen before leaving the error visible. */
const MAX_FIX_ATTEMPTS = 2

const EXAMPLE_KEYS = ['project.example1', 'project.example2', 'project.example3']

/** The three export targets, as [stack, label key, hint key]. */
const EXPORT_TARGETS: [StackTarget, string, string][] = [
  ['shadcn', 'project.exportShadcn', 'project.exportShadcnHint'],
  ['plain', 'project.exportPlain', 'project.exportPlainHint'],
  ['daisyui', 'project.exportDaisy', 'project.exportDaisyHint'],
]

/**
 * A toolbar action that folds into the "Plus" menu below md.
 *
 * Data rather than JSX because the bar and the menu offer the same eight
 * actions, and the alternative was copying eight blocks of `onClick` — which is
 * how a mode ends up toggling on the bar and doing nothing in the menu. (Count
 * them in `foldedTools` before trusting that number; it said six for two tools
 * longer than it was true.)
 */
type FoldedTool = {
  id: string
  icon: IconName
  /** Only for glyphs that read a size larger than the rest; 16 otherwise. */
  iconSize?: number
  label: string
  title: string
  active?: boolean
  disabled?: boolean
  /** Draws the group rule before this one, the way the bar always has. */
  startsGroup?: boolean
  onClick: () => void
}

export default function ProjectView({
  project,
  onAddScreen,
  onUpdateScreen,
  onRemoveScreen,
  onOpenSettings,
  onOpenDesign,
  designNonce = 0,
  onBack,
  onSetReference,
  onRenameProject,
  onSetDesign,
}: {
  project: Project
  onAddScreen: (screen: Omit<Screen, 'x' | 'y'>) => void
  onUpdateScreen: (screenId: string, patch: Partial<Screen>) => void
  onRemoveScreen: (screenId: string) => void
  onOpenSettings: () => void
  onOpenDesign: () => void
  /** Bumped when the DESIGN.md overlay closes, so this view re-reads the file. */
  designNonce?: number
  onBack: () => void
  onSetReference: (screenId: string | null) => void
  onRenameProject: (name: string) => void
  /** Set this project's own design direction, or null to fall back to DESIGN.md. */
  onSetDesign: (markdown: string | null) => void
}) {
  const t = useT()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<'planning' | 'generating' | 'muse' | 'design' | null>(null)
  /**
   * "Cette génération redéfinit la direction" — armed by hand, spent on use.
   *
   * A project keeps one design direction; this is the composer's way of saying
   * the next prompt replaces it. Deliberately not persisted: a flag that
   * survived a reload would be a standing instruction to redesign, which is the
   * opposite of what a one-shot means.
   */
  const [redesign, setRedesign] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // --- Muse — optional design-intelligence pass before generation ---
  const [museConfig, setMuseConfig] = useState<MuseConfig>(() => loadMuseConfig())
  const [museAvail, setMuseAvail] = useState<boolean | null>(null)
  const [museResult, setMuseResult] = useState<MuseResult | null>(null)
  const [museImages, setMuseImages] = useState<GeneratedSlotImage[]>([])
  const [museStage, setMuseStage] = useState<string | null>(null)
  const [museImageError, setMuseImageError] = useState<string | null>(null)
  /** null until probed: does the active model accept images? */
  const [museVision, setMuseVision] = useState<boolean | null>(null)
  /** auto (Mocky decides) · on (force) · off (hold still). See lib/animations. */
  const [animationMode, setAnimationMode] = useState<AnimationMode>(() => loadAnimationMode())
  /**
   * One screen's own answer, cycled: follow the composer → forced on → off.
   *
   * Three states rather than a checkbox, so an override can be handed BACK.
   * With two, a screen switched off would stay off for good — the composer's
   * setting could never reach it again.
   */
  const cycleScreenAnimations = useCallback(
    (screenId: string) => {
      const screen = screensRef.current.find((s) => s.id === screenId)
      if (!screen) return
      const next = screen.animations === undefined ? true : screen.animations ? false : undefined
      onUpdateScreen(screenId, { animations: next })
    },
    [onUpdateScreen],
  )
  const cycleAnimations = useCallback(() => {
    setAnimationMode((cur) => {
      const next = nextAnimationMode(cur)
      saveAnimationMode(next)
      return next
    })
  }, [])
  const [showLibrary, setShowLibrary] = useState(false)
  /**
   * Which media tab the library opens on next time.
   *
   * Held here rather than inside `Bibliotheque` because the caller is what knows
   * WHY it is being opened: "Media" in the toolbar means images, "see it in
   * Media" after a render means the cut that was just made. Once the library is
   * open, which tab is showing is the user's business again — this only decides
   * the first one.
   */
  const [libraryTab, setLibraryTab] = useState<MediaTab>('images')
  /** Image opened full size (from the canvas card or the library grid). */
  const [lightboxHash, setLightboxHash] = useState<string | null>(null)
  /**
   * A film opened for playback from the attached-media card on the canvas.
   *
   * The counterpart of `lightboxHash` for the other kind of attachment. A
   * sequence has no state here on purpose: it is played by scrubbing numbered
   * stills, which `VideoPlayer` already does properly inside Média — a second
   * scrubber written for one card is two players that would drift.
   */
  const [playingFilm, setPlayingFilm] = useState<string | null>(null)
  /** The screen whose images are being swapped, if any. Id, not the screen: the
   *  dialog must follow the record as it is rewritten, not a stale copy. */
  const [imagesForScreen, setImagesForScreen] = useState<string | null>(null)
  const [showVideoExport, setShowVideoExport] = useState(false)
  /**
   * The render this session last started, kept here rather than in the dialog.
   *
   * A render takes minutes and the panel is a modal over the canvas, so closing
   * it while the queue works is the normal thing to do. Held inside the dialog,
   * the job id would die with it and the finished file would have no route back
   * to the person who asked for it — the download link is reachable only through
   * the id, and nothing else in the interface lists past exports.
   */
  const [videoJobId, setVideoJobId] = useState<string | null>(null)
  const [pinnedImages, setPinnedImages] = useState<PinnedImage[]>([])
  /** The brief above the composer. Folded by default: open, it eats the canvas. */
  const [briefOpen, setBriefOpen] = useState(() => localStorage.getItem(BRIEF_PREF_KEY) === '1')
  const updateMuse = useCallback((c: MuseConfig) => {
    setMuseConfig(c)
    saveMuseConfig(c)
  }, [])
  /**
   * A sequence chosen from the library for the next screen.
   *
   * At most one, because a screen has one hero. When it is set, the generation
   * skips the provider entirely — which is how an instance with no fal account
   * still gets a scroll sequence, using footage the user imported themselves.
   *
   * Read from the Muse settings rather than held here: it can also be chosen
   * from the standalone Media page, which has no project in scope, and it has
   * to survive a reload like every other Muse choice.
   */
  const pinnedVideo = museConfig.videoPin
  const setPinnedVideo = useCallback(
    (pin: PinnedVideo | null) => {
      // Choosing a sequence implies wanting the effect; see setMuseVideoPin.
      updateMuse({ ...museConfig, videoPin: pin, video: pin ? true : museConfig.video })
    },
    [museConfig, updateMuse],
  )
  // The Muse toggle washes the accent through its label whenever Muse is off —
  // here as well as on the first-screen composer, because this is the one a
  // user with projects actually sees. See `.muse-sweep` in index.css.
  const museHint = !museConfig.enabled
  const toggleMuse = useCallback(() => {
    updateMuse({ ...museConfig, enabled: !museConfig.enabled })
  }, [museConfig, updateMuse])
  const togglePin = useCallback((img: LibraryImage) => {
    setPinnedImages((arr) =>
      arr.some((p) => p.hash === img.hash)
        ? arr.filter((p) => p.hash !== img.hash)
        : [...arr, { hash: img.hash, url: imageUrl(img.hash), label: img.prompt.slice(0, 40) }],
    )
  }, [])
  const abortRef = useRef<AbortController | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESET_ID)
  /**
   * The one panel over the canvas' top-right corner — see lib/rightSlot.ts.
   *
   * One value and not three booleans: the Design System inspector, the audit
   * panel and the Links list all live at `absolute right-4 top-11`, and as
   * separate flags two of them could be — and were — open at once, painting over
   * each other with no z-index to settle it.
   */
  const [rightSlot, setRightSlot] = useState<RightSlot>(null)
  const linkMode = rightSlot === 'links'
  const showSystem = rightSlot === 'system'
  const showAudit = rightSlot === 'audit'
  const [modifyMode, setModifyMode] = useState(false)
  const [pendingModify, setPendingModify] = useState<{ screenId: string; info: PickInfo } | null>(null)
  const [modifyText, setModifyText] = useState('')
  const [modifyLabelDraft, setModifyLabelDraft] = useState('')
  const [modifyHex, setModifyHex] = useState('')
  const [interactAll, setInteractAll] = useState(false)
  const [showFrame, setShowFrame] = useState(() => localStorage.getItem(FRAME_PREF_KEY) !== '0')
  const [pendingLink, setPendingLink] = useState<{ screenId: string; info: PickInfo } | null>(null)
  const [demoStartId, setDemoStartId] = useState<string | null>(null)
  const [exportMenu, setExportMenu] = useState(false)
  /** The toolbar's overflow menu below md. See the bar itself for why it exists. */
  const [plusMenu, setPlusMenu] = useState(false)
  const [menu, setMenu] = useState<{ screenId: string; x: number; y: number } | null>(null)
  // An id, not the object. Holding the Screen froze whatever it contained at
  // click time: a regeneration or an auto-repair behind the open viewer left it
  // showing — and offering to copy — source the screen no longer had. Resolving
  // by id also closes the viewer by itself if the screen is deleted meanwhile.
  const [codeScreenId, setCodeScreenId] = useState<string | null>(null)
  const codeScreen = codeScreenId ? (project.screens.find((s) => s.id === codeScreenId) ?? null) : null
  const setCodeScreen = (s: Screen | null) => setCodeScreenId(s ? s.id : null)
  const contentHeights = useRef<Record<string, number>>({})

  // Esc closes the context menu / code viewer / the two toolbar dropdowns.
  // Escape is the second way out of the toolbar menus, never the only one: a
  // phone has no Escape key, so each of them also carries a tap-to-dismiss
  // backdrop. A dropdown whose only exit is a hardware key is a dropdown a
  // touch user cannot close.
  useEffect(() => {
    if (!menu && !codeScreen && !pendingModify && !plusMenu && !exportMenu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null)
        setCodeScreen(null)
        setPendingModify(null)
        setPlusMenu(false)
        setExportMenu(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu, codeScreen, pendingModify, plusMenu, exportMenu])

  // Probe the backend once Muse is switched on (Muse needs it; frontend-only ⇒ unavailable).
  useEffect(() => {
    if (!museConfig.enabled || museAvail !== null) return
    let alive = true
    museAvailable().then((ok) => alive && setMuseAvail(ok))
    return () => {
      alive = false
    }
  }, [museConfig.enabled, museAvail])

  // Does the model accept images? Decides whether "inspiration" mode is usable.
  // Probed once per session when Muse is on; the answer is cached server-side.
  useEffect(() => {
    if (!museConfig.enabled || museAvail === false || museVision !== null) return
    let alive = true
    checkVision().then((r) => {
      if (!alive) return
      setMuseVision(r.vision)
      // A failed probe must NOT rewrite the saved choice: it used to persist
      // imageMode:'content' over the user's "Inspiration"/"Les deux", so a
      // transient probe failure silently and permanently undid their setting.
      // The mode is now only downgraded for the run in progress (see
      // `effectiveImageMode`), and the panel says why.
    })
    return () => {
      alive = false
    }
  }, [museConfig, museAvail, museVision, updateMuse])

  // Can this instance make a scroll sequence at all? Two prerequisites live in
  // two different places (a video provider in Admin, ffmpeg in the container),
  // so the answer carries which one is missing and the panel says so rather
  // than greying a box out for no stated reason.
  const [videoAvail, setVideoAvail] = useState<MuseVideoAvailability | null>(null)
  useEffect(() => {
    if (!museConfig.enabled || videoAvail !== null) return
    let alive = true
    checkVideoAvailability().then((r) => {
      if (alive && r) setVideoAvail(r)
    })
    return () => {
      alive = false
    }
  }, [museConfig.enabled, videoAvail])

  /*
   * And can it cut a Motion FILM? A different question with a different answer.
   *
   * `checkVideoAvailability` above is about the clip library: a video provider
   * in Admin and ffmpeg in the container. Motion needs neither — it needs the
   * export feature enabled for this ACCOUNT and a render worker that answers. So
   * it is `GET /api/video/status`, the route the export panel already polls, and
   * the two probes are kept apart for the reason the two features are: one letter
   * of directory name apart, and nothing else in common.
   *
   * Degrades to "not available" on any failure (Q1): a probe that throws must
   * not take the composer down, and a control that is not drawn is the honest
   * outcome of not knowing.
   */
  const [motionAvail, setMotionAvail] = useState<{ available: boolean; kinds: MotionKindOffer[] } | null>(null)
  useEffect(() => {
    if (!museConfig.enabled || motionAvail !== null) return
    let alive = true
    fetchVideoAccess()
      .then((access) => {
        if (!alive) return
        setMotionAvail({
          available: Boolean(access.enabled && access.worker?.available),
          kinds: Array.isArray(access.motionKinds) ? access.motionKinds : [],
        })
      })
      .catch(() => alive && setMotionAvail({ available: false, kinds: [] }))
    return () => {
      alive = false
    }
  }, [museConfig.enabled, motionAvail])

  // Screens generated before the canvas image card existed have no imageHash,
  // even though the library still records which project each image belongs to
  // and when. Recover the link once per project (see lib/imageBackfill) so past
  // work shows its image instead of staying blank forever.
  const backfilledRef = useRef<string | null>(null)
  // Read through refs so the effect can depend on the project id ALONE.
  // `onUpdateScreen` is a fresh closure on every App render and `project.screens`
  // a fresh array, so depending on them re-ran the effect constantly — and its
  // cleanup cancelled the in-flight lookup before it could apply anything
  // (StrictMode's double-mount made that a guarantee, not a race).
  const screensRef = useRef(project.screens)
  screensRef.current = project.screens
  const updateScreenRef = useRef(onUpdateScreen)
  updateScreenRef.current = onUpdateScreen
  useEffect(() => {
    if (backfilledRef.current === project.id) return
    backfilledRef.current = project.id
    if (!screensRef.current.some((s) => !s.imageHash)) return
    listLibrary({ project: project.id })
      .then((images) => {
        // Idempotent: only ever fills an empty imageHash, so applying it after a
        // re-render (or a remount) is harmless.
        for (const m of matchImagesToScreens(screensRef.current, images, project.id)) {
          updateScreenRef.current(m.screenId, { imageHash: m.hash })
        }
      })
      .catch(() => {
        // Backend absent (frontend-only mode) — nothing to recover, never fail.
      })
  }, [project.id])
  const [highlightHotspot, setHighlightHotspot] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ screenId: string; nonce: number } | null>(null)
  const [annotateMode, setAnnotateMode] = useState(false)
  const [captureReq, setCaptureReq] = useState<
    { screenId: string; id: string; clientRect: { left: number; top: number; width: number; height: number } } | null
  >(null)
  const [capturing, setCapturing] = useState(false)

  /*
   * Automatic linking, in three pieces of state.
   *
   * `sweepReq` asks one screen's preview to list what could be linked FROM — a
   * nonce rather than a flag, so asking twice about the same screen is possible.
   * `proposals` is what came back, scored. Nothing is written until the user
   * says so: `Hotspot` carries no provenance, so a machine-made link would be
   * indistinguishable from one they drew, in a panel whose only affordance is a
   * delete button per row.
   */
  const [sweepReq, setSweepReq] = useState<{ screenId: string; nonce: number } | null>(null)
  const [proposals, setProposals] = useState<{ screenId: string; items: LinkCandidate[] } | null>(null)
  const [sweeping, setSweeping] = useState(false)
  /**
   * Which screen the panel will read.
   *
   * Chosen in the panel because it cannot be chosen on the canvas: Link mode
   * makes every frame pickable, so a click inside one designates an element.
   * Seeded from the canvas selection made BEFORE entering the mode, which is the
   * one moment the two agree.
   */
  const [autoLinkFrom, setAutoLinkFrom] = useState('')
  useEffect(() => {
    if (!linkMode) return
    const usable = screens.filter((s) => s.code && s.code.trim())
    if (usable.length === 0) return
    const picked = selectedIds.find((id) => usable.some((s) => s.id === id))
    setAutoLinkFrom(picked ?? usable[0].id)
    // Only when the mode opens: re-seeding on every selection change would undo
    // a choice the user had just made in the dropdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkMode])
  const [annotations, setAnnotations] = useState<{ id: string; dataUrl: string }[]>([])
  const retryRefs = useRef<Record<string, { count: number; lastError: string }>>({})
  /** In-flight auto-repairs, keyed by screen id so each can be cancelled alone. */
  const retryAborts = useRef<Map<string, AbortController>>(new Map())
  // ProjectView is mounted with key={project.id} and unmounted the moment you
  // go Back, switch project, or open Settings/Design/Media. Nothing used to stop
  // the work in flight: the provider kept streaming — and billing — for a screen
  // nobody would ever see, calling setState on a component that no longer exists.
  useEffect(
    () => () => {
      abortRef.current?.abort()
      for (const ac of retryAborts.current.values()) ac.abort()
      retryAborts.current.clear()
    },
    [],
  )
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set())
  // Screens being regenerated: unlike generatingIds, we DON'T stream partial
  // code into these — the existing iframe stays fully rendered until the new
  // code is ready, then swaps in one clean step (no blank/flicker).
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set())
  // Screens whose render error the auto-fixer is currently repairing.
  const [fixingIds, setFixingIds] = useState<Set<string>>(new Set())
  /** Phone: a coarse pointer AND a narrow viewport. See lib/usePhone.ts. */
  const phone = usePhone()
  const [regenLabel, setRegenLabel] = useState(() => t('canvas.regenerating'))

  /**
   * Is a Motion film mid-flight, and would leaving lose it?
   *
   * A ref rather than state: the only reader is a `beforeunload` handler, and
   * re-registering that listener on every render to close over fresh state is
   * how the listener ends up registered twice.
   *
   * The warning is honest about WHICH half is lost, and they are not the same.
   * The render itself is a server-side job on the worker and survives anything
   * the browser does — the film lands in the export store either way. What does
   * NOT survive is the browser's part: attaching it to the screen and running
   * the edit pass that writes `<MotionFilm>` into the page. Leave now and the
   * film exists in Media, and the screen that was supposed to carry it does not
   * know about it.
   */
  const motionRunning = useRef(false)
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!motionRunning.current) return
      // The only portable way to ask: no current browser shows custom text, so
      // the sentence lives in the on-canvas badge and in `leaveProject` below.
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [])

  /**
   * Going back to the project list, asked about while a film is mid-flight.
   *
   * `beforeunload` covers closing the tab and reloading, and it covered NOTHING
   * the user actually did: clicking "Accueil" is an in-app callback, the page
   * never unloads, so the browser is never consulted. ProjectView simply
   * unmounts, its AbortController fires, and the composition or the placement
   * dies with no dialog and no trace — which is precisely the report, "je ne
   * vois pas de popup".
   *
   * `window.confirm` rather than the browser's own: this one gets to say what is
   * actually at stake, and the two halves are not the same. The RENDER is a
   * server-side job and survives — the film lands in Media either way. What
   * dies is the browser's half: attaching it to the screen and writing
   * <MotionFilm> into the page.
   */
  const leaveProject = useCallback(() => {
    if (motionRunning.current && !window.confirm(t('project.motionLeaveConfirm'))) return
    onBack()
  }, [onBack, t])
  /** Neutral one-liner in the composer — the quality pass reporting back. */
  const [notice, setNotice] = useState<string | null>(null)

  function onCaptureRegion(screenId: string, clientRect: { left: number; top: number; width: number; height: number }) {
    setCapturing(true)
    setCaptureReq({ screenId, id: newId(), clientRect })
  }

  async function onCaptureRect(id: string, rect: { x: number; y: number; w: number; h: number }) {
    const screenId = captureReq?.screenId
    setCaptureReq(null)
    const screen = screens.find((s) => s.id === screenId)
    if (!screen) {
      setCapturing(false)
      return
    }
    try {
      const dataUrl = await captureRegion(screen.code, screen.w, screen.h, rect)
      setAnnotations((a) => [...a, { id, dataUrl }])
    } catch {
      setError(t('project.captureFailed'))
    } finally {
      setCapturing(false)
    }
  }

  // Re-read DESIGN.md whenever the overlay that edits it closes — ProjectView
  // stays mounted underneath it, so nothing else would tell it the file has
  // changed. Nothing in this view writes the global document any more: the
  // quick-style picker and the Design-system frame both edit the project's own
  // direction, which arrives through props and re-renders on its own.
  const design = useMemo(() => loadDesign(), [designNonce])
  const designActive = isDesignActive(design)

  /**
   * The direction in force, read fresh at call time.
   *
   * Every generation path used to open with the same three lines — load
   * DESIGN.md, check it is active, keep the markdown — which meant the project's
   * own direction had five separate places to be forgotten. One function now,
   * called by all of them.
   *
   * Fresh rather than memoised because DESIGN.md is edited in an overlay that
   * leaves this view mounted underneath; a value captured at render would be the
   * document as it stood before the user changed it.
   */
  const activeDirection = useCallback((): string | undefined => {
    const d = loadDesign()
    return designForProject(project, isDesignActive(d) ? d.markdown : undefined)
  }, [project])

  /**
   * The same resolution, as the render sees it.
   *
   * Everything the interface SHOWS about the design — the swatches, the
   * Design-system frame, whether the welcome screen says a direction is in
   * force — must be the document that will actually govern the next screen. Two
   * answers to that question is how the frame ended up offering to recolour a
   * palette no generation would ever read.
   */
  const directionMd = useMemo(
    () => designForProject(project, designActive ? design.markdown : undefined),
    [project, design, designActive],
  )
  const designColors = useMemo(() => extractDesignColors(directionMd || '').slice(0, 10), [directionMd])

  /**
   * Apply a starter style from the Welcome quick-picker (D.1).
   *
   * This project's direction, not the global file. Picking a style on an empty
   * project is a statement about that project; writing it globally repainted
   * every other one, which is the same bug as Muse re-rolling a dossier per
   * screen, wearing a different hat.
   */
  function applyStyleMarkdown(markdown: string) {
    onSetDesign(markdown)
  }

  /**
   * Recolor one token from the Design-system frame (D.2).
   *
   * Edits the direction the frame is DISPLAYING. It used to read the global file
   * while the swatches beside it came from elsewhere, so on a Muse project the
   * recolour landed in a document no generation would read and the palette on
   * screen never moved.
   */
  function recolorToken(token: DesignToken, newHex: string) {
    const md = activeDirection()
    if (!md) return
    onSetDesign(replaceTokenHex(md, token, newHex))
  }

  /**
   * What a new screen must inherit from the ones already here.
   *
   * Two contracts, and which one applies depends on whether the user pinned
   * anything:
   *
   *  - a screen IS pinned → the whole shared chrome, unchanged behaviour. Pinning
   *    is a statement that these screens are pages of one layout.
   *  - nothing pinned → only the product's identity, taken from the screen that
   *    established it. A direction says what a project looks like and nothing
   *    about what the product is CALLED, so the second screen was free to invent
   *    a second brand — and did.
   *
   * `excludeId` keeps a regenerating screen from being handed its own source as
   * a reference to copy.
   */
  function identityOrLayoutReference(excludeId?: string): string | undefined {
    const pinnedId = project.referenceScreenId
    if (pinnedId && pinnedId !== excludeId) {
      const pinned = screens.find((s) => s.id === pinnedId)
      return pinned && pinned.code.trim() ? buildLayoutReference(pinned.code) : undefined
    }
    // The oldest screen that actually rendered — the one whose name and mark the
    // rest of the project has been following. Not simply screens[0]: a screen
    // that never generated has no identity to lend, and canvas order is position
    // on a board, not chronology.
    const first = screens
      .filter((s) => s.id !== excludeId && s.code.trim())
      .reduce<Screen | undefined>((best, s) => (!best || s.createdAt < best.createdAt ? s : best), undefined)
    return first ? buildIdentityReference(first.code) : undefined
  }

  /**
   * Copy a screen, unlinked.
   *
   * "Regenerate" was the only way to explore a variant, and it overwrites — so
   * comparing two takes meant losing one of them. A duplicate is the cheap
   * alternative: keep this one, work on the copy.
   *
   * `links` are deliberately dropped. A hotspot points at a screen id, and a
   * copy that inherited them would silently drive the ORIGINAL's demo flow from
   * a different frame. Everything else travels, including the recorded
   * DESIGN.md — the copy really was made from that design.
   */
  function duplicateScreen(s: Screen) {
    const { id: _id, x: _x, y: _y, links: _links, ...rest } = s
    onAddScreen({
      ...rest,
      id: newId(),
      name: t('project.copyOf', { name: s.name }),
      createdAt: Date.now(),
      links: [],
    })
  }

  /** The screen whose share dialog is open, if any. */
  const [shareScreenId, setShareScreenId] = useState<string | null>(null)
  /** The screen whose recorded design is being looked at full size, if any. */
  const [inspectDesignId, setInspectDesignId] = useState<string | null>(null)
  /** Set when saving that design into the named library. */
  const [saveDesignFrom, setSaveDesignFrom] = useState<Screen | null>(null)

  /** The screen a DESIGN.md is currently being derived from, if any. */
  const [derivingDesignId, setDerivingDesignId] = useState<string | null>(null)

  /**
   * Adopt the DESIGN.md a screen recorded at generation time.
   *
   * No model call: the document is already there, byte for byte. This is the
   * difference the recorded copy buys — reconstructing a design system by
   * reading rendered code is an approximation that costs tokens and seconds,
   * while restoring the one that actually produced the screen is neither.
   */
  function applyScreenDesign(screenId: string) {
    const sc = screensRef.current.find((s) => s.id === screenId)
    const md = sc?.design?.trim()
    if (!sc || !md) return
    const before = activeDirection()?.trim()
    if (before === md) return // already current — say nothing, do nothing
    if (before && !confirm(t('project.applyDesignConfirm', { name: sc.name }))) return
    // This project's direction, not the global file: adopting a look here must
    // not repaint every other project on the machine. The direction being
    // replaced is not lost either — every screen made under it still records it,
    // which is what this very menu entry reads.
    onSetDesign(md)
  }

  /**
   * Write DESIGN.md from a screen the user points at.
   *
   * The document had to exist BEFORE there was anything to describe, which is
   * the wrong way round for how people actually work: they generate a few
   * screens, like one, and want the others to match it. Same document, written
   * afterwards and from evidence.
   *
   * It overwrites this PROJECT's direction — the global DESIGN.md is left alone,
   * since lifting a look off one screen is not a statement about every other
   * project on the machine. A direction already in force is confirmed first; the
   * one being replaced survives on the screens generated under it, which "Reprendre
   * ce DESIGN.md" reads back.
   */
  async function deriveDesignFrom(screen: Screen) {
    if (derivingDesignId) return
    if (!screen.code.trim()) {
      setError(t('project.deriveDesignEmpty'))
      return
    }
    const settings = loadSettings()
    if (!settings.model.trim()) {
      setError(t('project.noModel'))
      return
    }
    const before = activeDirection()?.trim()
    if (before && !confirm(t('project.deriveDesignConfirm', { name: screen.name }))) return

    setDerivingDesignId(screen.id)
    setError(null)
    const ac = new AbortController()
    retryAborts.current.set(`design:${screen.id}`, ac)
    try {
      const markdown = await deriveDesignSystem(settings, screen.code, ac.signal)
      if (!markdown.trim()) {
        setError(t('project.deriveDesignEmptyResult'))
        return
      }
      onSetDesign(markdown)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      retryAborts.current.delete(`design:${screen.id}`)
      setDerivingDesignId(null)
    }
  }
  const screens = project.screens

  /**
   * Photograph screens for the home page — here, not there.
   *
   * A capture mounts a short-lived iframe and runs the generated code in it.
   * Doing that on the home page meant every visit re-ran model code for every
   * project — and back then the capture frame was same-origin, so that was a
   * security problem as well as a cost. The frame is sandboxed now (see
   * capture.ts), but doing it here still costs the same work once, at the moment
   * the user has just asked Mocky to run that code anyway — and the home page
   * stays pure image display.
   *
   * Declarative on purpose: watching the settled screens covers new screens,
   * edits, regenerate, modify, animations and auto-repair without hooking each
   * of the six places a generation can finish. `busy` keeps it out of the way
   * while code is still streaming in.
   */
  useEffect(() => {
    if (busy) return
    const timer = window.setTimeout(() => queueThumbs(screens), 1200)
    return () => window.clearTimeout(timer)
  }, [screens, busy])
  const selectedScreens = screens.filter((s) => selectedIds.includes(s.id))
  // Looked up rather than captured, so the dialog re-renders from the rewritten
  // source after each swap — and closes on its own if the screen is deleted
  // from under it.
  const imageSwapScreen = imagesForScreen ? screens.find((s) => s.id === imagesForScreen) ?? null : null

  // Revert a screen to its previousCode (saved before the last edit).
  function onRevertScreen(screenId: string) {
    const screen = screens.find((s) => s.id === screenId)
    if (!screen || !screen.previousCode) return
    const back = screen.previousCode
    // Swap: current code becomes the new previousCode, old code becomes current
    onUpdateScreen(screenId, {
      code: back,
      previousCode: undefined,
      componentName: detectComponentName(back),
      /*
       * The sequence record follows the code back, or it stops claiming anything.
       *
       * `swapScreenImages` moves `videoHash`/`videoFrames` when a hero swap
       * re-points the very clip they name — the pair moves as one. Revert put the
       * source back and left them where they were, which splits the pair the
       * other way round: the screen draws clip A while the record says B. That is
       * the same defect this whole path exists to prevent, arrived at through the
       * button sitting next to it.
       *
       * The restored source is the arbiter, and it only has to answer one
       * question: does it still contain that content address? A 64-hex hash is
       * looked for literally, with no pattern and no name discovery — this is not
       * reading structure out of generated source (I1), it is asking whether a
       * string Mocky itself wrote is still in the file, and the answer is only
       * ever used to DROP a claim.
       *
       * Dropped rather than re-derived: what the old source pointed at cannot be
       * known without a parse, and absent means "not recorded", which is what
       * almost every screen says. A guess would mean something else.
       */
      ...(screen.videoHash && !back.includes(screen.videoHash)
        ? { videoHash: undefined, videoFrames: undefined }
        : {}),
    })
  }

  // Auto-retry when a preview reports a compile/runtime error. We send the
  // broken code + the error message back to the model for a targeted fix.
  // Up to MAX_FIX_ATTEMPTS per screen, and we bail early if the model made no
  // progress (the new error is identical to the last) — both guards prevent an
  // infinite loop while giving deterministic syntax slips a second chance.
  // IMPORTANT: do NOT retry while a generation is in progress (busy=true) —
  // the code is still streaming and incomplete errors are expected.
  const onScreenError = useCallback(async (screenId: string, errorMessage: string) => {
    if (busy) return
    const state = retryRefs.current[screenId] || { count: 0, lastError: '' }
    if (state.count >= MAX_FIX_ATTEMPTS) return
    if (state.count > 0 && errorMessage === state.lastError) return // no progress → stop
    retryRefs.current[screenId] = { count: state.count + 1, lastError: errorMessage }
    const screen = screens.find((s) => s.id === screenId)
    if (!screen || !screen.code.trim()) return
    const settings = loadSettings()
    if (!settings.model.trim()) return
    const ac = new AbortController()
    // Keyed per screen. A single ref meant two screens failing at once shared
    // one controller, so cancelling either cancelled neither reliably.
    retryAborts.current.set(screenId, ac)
    // What the screen held when the repair started. Applying the result over a
    // screen that has since changed is how a repair of the OLD broken code
    // silently replaced a fresh regeneration — and buried the revert target
    // under the broken version at the same time.
    const codeAtStart = screen.code
    // Mark this screen as "repairing" so the preview shows a calm state instead
    // of flashing the red error banner while the fix is in flight.
    setFixingIds((prev) => new Set(prev).add(screenId))
    try {
      // Pass the screen's capabilities so the fixer knows which globals/icons
      // actually exist — essential for repairing React #130 (undefined element).
      const caps = resolveCapabilities(
        screen.caps && screen.caps.length > 0 ? screen.caps : selectCapabilities(screen.prompt),
      )
      const res = await fixComponent(settings, screen.code, errorMessage, ac.signal, caps)
      // Someone else won while we were away — a regeneration, an edit, another
      // repair. Their result is newer than ours; drop ours rather than replace
      // working code with a patched-up copy of what it used to be.
      const now = screensRef.current.find((s) => s.id === screenId)
      if (!now || now.code !== codeAtStart) return
      // Keep the pre-repair code so "Revert" works after an auto-fix too. Every
      // other write path (edit, regenerate, animations, modify) already records
      // it; this one silently overwrote the last version that the user could
      // still fall back to.
      onUpdateScreen(screenId, { code: res.code, componentName: res.componentName, previousCode: screen.code })
    } catch {
      // Retry failed — leave the error visible to the user.
    } finally {
      retryAborts.current.delete(screenId)
      setFixingIds((prev) => {
        const next = new Set(prev)
        next.delete(screenId)
        return next
      })
    }
  }, [screens, onUpdateScreen, busy])

  function addHotspot(screenId: string, target: string) {
    const screen = screens.find((s) => s.id === screenId)
    if (!screen || !pendingLink) return
    const { selector, label, rect } = pendingLink.info
    const hotspot: Hotspot = { id: newId(), ...rect, target, selector, label }
    onUpdateScreen(screenId, { links: [...screen.links, hotspot] })
    setPendingLink(null)
  }

  /** Ask a screen's preview what it holds that could be linked. */
  function startAutoLink(screenId: string) {
    setProposals(null)
    setSweeping(true)
    setSweepReq({ screenId, nonce: Date.now() })
  }

  /**
   * The sweep came back. Score it, drop what is already wired, and show it.
   *
   * `withoutExisting` is not politeness: `addHotspot` appends without checking
   * anything, so re-proposing a wired element is how a second pass silently
   * doubles every link — the canvas stacks the overlays and the demo honours
   * only the first match.
   */
  function onSwept(screenId: string, elements: SweptElement[]) {
    setSweeping(false)
    setSweepReq(null)
    const from = screens.find((s) => s.id === screenId)
    if (!from) return
    setProposals({ screenId, items: withoutExisting(proposeLinks(elements, from, screens), from) })
  }

  /**
   * Write the accepted proposals — all of them, in ONE update.
   *
   * Not a loop over `addHotspot`: that function reads `screen.links` from the
   * render it was called in, so the second call would spread a list that does
   * not contain the first, and every hotspot but the last would vanish. The same
   * shape of bug the batch delete on the home page had to avoid.
   */
  function applyProposals(screenId: string, accepted: LinkCandidate[]) {
    const screen = screens.find((s) => s.id === screenId)
    if (!screen || accepted.length === 0) return setProposals(null)
    const added: Hotspot[] = accepted.map((c) => ({
      id: newId(),
      ...(c.rect ?? { x: 0, y: 0, w: 0, h: 0 }),
      target: c.target,
      selector: c.selector,
      label: c.label,
    }))
    onUpdateScreen(screenId, { links: [...screen.links, ...added] })
    setProposals(null)
  }

  function removeHotspot(screenId: string, hotspotId: string) {
    const screen = screens.find((s) => s.id === screenId)
    if (!screen) return
    onUpdateScreen(screenId, { links: screen.links.filter((h) => h.id !== hotspotId) })
  }

  const generate = useCallback(async () => {
    const text = prompt.trim()
    if (!text) return
    const settings = loadSettings()
    if (!settings.model.trim()) {
      setError(t('project.noModel'))
      return
    }
    const targets = screens.filter((s) => selectedIds.includes(s.id))
    const images = annotations.map((a) => a.dataUrl)
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(true)
    setError(null)
    setNotice(null) // a verdict about the previous screen does not survive a new one
    retryRefs.current = {} // reset retry counters for new generation
    /** The screen this run created, if any — so a failure can clean it up. */
    let newScreenId: string | null = null
    /**
     * A redesign only means anything when creating a screen.
     *
     * An edit reworks what an existing direction produced; letting it rewrite
     * that direction would reattribute every OTHER screen in the project to a
     * document written for a change to one of them. The toggle is hidden in edit
     * mode for the same reason — see the composer.
     */
    const redesigning = redesign && targets.length === 0
    try {
      // Read fresh, not from the render-scope memo: this callback outlives the
      // render that created it, and DESIGN.md is edited in an overlay that
      // leaves this view mounted underneath.
      const globalDesign = loadDesign()
      const globalMd = isDesignActive(globalDesign) ? globalDesign.markdown : undefined
      const designMd = designForProject(project, globalMd)
      const designPreamble = designMd ? buildDesignPreamble(designMd) : undefined

      if (targets.length > 0) {
        // Edit mode: apply the instruction to each selected screen in place,
        // keeping each screen in its existing form factor. Stream partial code
        // so the preview updates live as the model writes.
        // Save the current code as previousCode so the user can revert.
        // Use existing caps from the screen (or re-select from prompt).
        const ids = new Set(targets.map((sc) => sc.id))
        setGeneratingIds(ids)
        for (const sc of targets) {
          const extraSystem = joinSystem([designPreamble, hintForDevice(sc.device)])
          const capIds = sc.caps && sc.caps.length > 0 ? sc.caps : selectCapabilities(text, designMd)
          const caps = resolveCapabilities(capIds)
          // Snapshot the old code before overwriting.
          const oldCode = sc.code
          // And the revert target it already had, so cancelling can put the
          // screen back exactly as found — including its history. Overwriting
          // previousCode below is only correct if the edit actually lands.
          const oldPreviousCode = sc.previousCode
          // previousCode is recorded BEFORE the first chunk lands, not after the
          // last one. This is the only path that streams into the live screen,
          // so an interruption — "Stop", a dropped connection, a provider error
          // on the second of three selected screens — used to leave the screen
          // holding JSX cut off mid-tag while "Revert" stayed hidden, because
          // previousCode was still whatever it had been before. The original
          // design was gone with no way back.
          onUpdateScreen(sc.id, { previousCode: oldCode })
          try {
            const res = await editComponent(
              settings, text, sc.code, extraSystem, images, ac.signal,
              (partial) => onUpdateScreen(sc.id, { code: partial }),
              caps,
            )
            onUpdateScreen(sc.id, { code: res.code, componentName: res.componentName, previousCode: oldCode, caps: capabilitiesFor(capIds, res.code) })
          } catch (err) {
            // Put the screen back the way we found it. A half-written component
            // is worse than no change at all.
            //
            // previousCode goes back too. Leaving it at oldCode — which is what
            // the screen now holds again — offered a "Revert" that swapped the
            // code for an identical copy of itself: a menu entry that looks like
            // a way out and does nothing. Restoring the screen IS the undo; the
            // history it had before the cancelled edit is what should survive.
            onUpdateScreen(sc.id, { code: oldCode, previousCode: oldPreviousCode })
            throw err
          }
        }
        setGeneratingIds(new Set())
        setPrompt('')
        setAnnotations([])
      } else {
        // Create a new screen using the selected format preset.
        const preset = getPreset(presetId)
        const referencePreamble = identityOrLayoutReference()

        // --- Muse: build a Design Dossier + hero image. The dossier is a
        // CANDIDATE direction, not the authority it once was — see the
        // resolveDirection call below. Muse must never block generation (M3),
        // and when OFF the path below is byte-identical to pre-Muse Mocky (M1).
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
        /** Library hash of the image backing this screen, shown on the canvas. */
        let museImageHash: string | undefined
        /** The scroll sequence, when one was asked for and produced. */
        let museVideo: GeneratedVideo | null = null
        // The saved preference is kept as-is; a model without vision can only
        // honour "content", so THIS RUN degrades without touching the setting.
        const effectiveImageMode: MuseImageMode =
          museVision === false && museConfig.imageMode !== 'content' ? 'content' : museConfig.imageMode
        if (museConfig.enabled && museAvail !== false) {
          try {
            setMuseResult(null)
            setMuseImages([])
            setMuseImageError(null)
            setPhase('muse')

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
            const mediaSource = pinnedVideo
              ? { url: absoluteUrl(pinnedVideo.poster), kind: 'video' as const }
              : pinnedImages[0]
                ? { url: absoluteUrl(pinnedImages[0].url), kind: 'image' as const }
                : null
            if (mediaSource) {
              setMuseStage(t('project.museStageMedia'))
              userMedia = await describeUserMedia(mediaSource.url, mediaSource.kind, {
                vision: museVision,
                signal: ac.signal,
              })
            }

            setMuseStage(t('project.museStageDossier'))
            const res = await runMuseDossier(text, {
              urls: parseUrls(museConfig.urls),
              useFetch: museConfig.useFetch,
              projectName: project.name,
              userMedia,
              signal: ac.signal,
            })
            setMuseResult(res)
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
            if (pins.length) setMuseImages(pins)
            // Generate a new hero only when no pin already covers a slot (capped
            // to keep the run fast; multi-image is a later increment).
            const remaining = plan.slice(pins.length)
            if (remaining.length && pins.length === 0) {
              // A mood/art-direction reference and a hero photo are different
              // jobs, so they run on different image models (Admin → profils).
              const profile = profileForMode(effectiveImageMode)
              setMuseStage(
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
              const gen = await generateSlotImages(slotsToRun, project.id, {
                max: 1,
                profile,
                signal: ac.signal,
                onImage: (im) => setMuseImages((a) => [...a, im]),
                onError: (msg) => setMuseImageError(msg),
              })
              imgs = [...imgs, ...gen]
            } else if (!remaining.length && !pins.length) {
              // No imagery slot at all. The dossier now guarantees a hero, so
              // this means something upstream produced nothing — say so rather
              // than finishing silently with an image-less screen.
              setMuseImageError(t('project.museNoImage'))
            }
            // "inspiration" and "both" show the image to the model. In "both"
            // it is the same image it will embed, so it can design around it.
            if (effectiveImageMode !== 'content' && imgs.length) {
              const dataUrl = await imageAsDataUrl(imgs[0].url, ac.signal)
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
            if (pinnedVideo) {
              // A sequence chosen from the library wins over generating one.
              // Same rule the pinned IMAGES follow, and for the same reason:
              // the user has already answered the question this step exists to
              // ask, and answering it again costs minutes and money.
              museVideo = {
                hash: pinnedVideo.hash,
                base: absoluteUrl(videoBase(pinnedVideo.hash)),
                poster: absoluteUrl(pinnedVideo.poster),
                frames: pinnedVideo.frames,
                fromCache: true,
              }
            } else if (museConfig.video && videoAvail?.available) {
              const heroSlot = plan[0]
              const heroPrompt = heroSlot?.prompt || heroSlot?.subject || text
              setMuseStage(t('project.museStageVideo'))
              try {
                museVideo = await generateScrollVideo(buildVideoPrompt(heroPrompt), project.id, {
                  negative: heroSlot?.negative,
                  slot: 'hero',
                  signal: ac.signal,
                })
              } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') throw err
                setMuseImageError(
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
            setMuseStage(null)
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
        const dir = resolveDirection({
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
          ? joinSystem([musePreamble, referencePreamble, preset.hint])
          : joinSystem([dirPreamble, referencePreamble, preset.hint])

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
        if (settings.usePlanner && !musePreamble) {
          setPhase('planning')
          const plan = await planScreen(
            settings, text, shortlist,
            { design: dir.markdown, presetHint: preset.hint },
            ac.signal,
          )
          if (plan) {
            capIds = plan.capabilities
            planSection = planToPromptSection(plan)
            if (plan.mode) mode = plan.mode
          }
        }
        // Appended to the plan section rather than folded into it, so the mode
        // still reaches generation on the paths where no plan was produced.
        if (!planSection) planSection = modeToPromptSection(mode)
        // The user's standing answer about motion, applied once, after both the
        // shortlist and the planner have had their say. 'auto' — the default —
        // changes nothing.
        capIds = applyAnimationMode(capIds, animationMode)

        // A sequence exists → the component that plays it must be in scope,
        // whatever the shortlist or the planner decided. 'scrollvideo' has no
        // keyword triggers precisely because it is never a guess: it is added
        // here, and only here, when there is something for it to draw.
        if (museVideo) capIds = capIds.includes('scrollvideo') ? capIds : [...capIds, 'scrollvideo']

        setPhase('generating')
        const caps = resolveCapabilities(capIds)
        const screenId = newId()
        newScreenId = screenId
        onAddScreen({
          id: screenId,
          name: deriveName(text),
          prompt: text,
          code: '',
          componentName: 'App',
          createdAt: Date.now(),
          w: preset.w,
          h: preset.h,
          device: preset.device,
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
          imageHash: museImageHash,
          // Recorded so the canvas can say what the image was for. Without it
          // the badge could only ever say "Image Muse", which is exactly the
          // ambiguity that made it impossible to tell whether inspiration mode
          // had done anything.
          imageRole: museImageHash ? effectiveImageMode : undefined,
          // Persisted as a pair so a reload can rebuild the sequence without
          // asking the server what it cut.
          videoHash: museVideo?.hash,
          videoFrames: museVideo?.frames,
        })
        // Name the project after its FIRST prompt, so it stops being called
        // "Untitled project". A name the user already chose is never touched.
        if (screens.length === 0 && project.name.trim() === DEFAULT_PROJECT_NAME) {
          onRenameProject(deriveProjectName(text))
        }
        setGeneratingIds(new Set([screenId]))
        setSelectedIds([screenId])
        setPrompt('')
        setAnnotations([])
        const result = await generateComponent(
          settings, text, extraSystem,
          museVisionRef ? [...images, museVisionRef] : images,
          ac.signal,
          (partial) => onUpdateScreen(screenId, { code: partial }),
          caps, planSection,
        )
        onUpdateScreen(screenId, { code: result.code, componentName: result.componentName })
        setGeneratingIds(new Set())

        /*
         * The Motion film, cut from the dossier that was just written.
         *
         * ── Why it runs HERE, after the screen exists ───────────────────────
         *
         * A film is a model call and a render, and the render is minutes. Run
         * before generation it would hold the screen — the thing the person
         * actually asked for — behind a wait for something they ticked as an
         * extra. Run here, the screen is already on the canvas and finished, and
         * the film arrives on it when it arrives. `muse.motionCost` says the
         * number before the box is ticked; this is what makes the wait bearable
         * rather than merely announced.
         *
         * ── What it does NOT do, and cannot ─────────────────────────────────
         *
         * It does not put the film inside the mockup. The preview iframe is
         * sandboxed without `allow-same-origin`, so its origin is opaque: its
         * CSP resolves `media-src` to `default-src 'none'` and blocks a
         * `<video>` outright, and `GET /api/video/:hash` sits behind a session
         * cookie that an opaque origin does not send — it would answer 403 even
         * if the element were allowed. Both are load-bearing security controls
         * (I2, and the route's own ownership check), so the film is attached to
         * the SCREEN and drawn on the canvas beside the frame, which is the path
         * `AttachedMedia` already exists for.
         *
         * ── And it degrades, always (Q1) ────────────────────────────────────
         *
         * Every failure here leaves exactly the screen the user would have had
         * with the box unticked. It is REPORTED, unlike an image failure,
         * because this one cost a model call and minutes of a render.
         */
        if (museConfig.motion && motionAvail?.available && motionAvail.kinds.length > 0) {
          try {
            motionStage(screenId, t('project.motionStageCompose'))
            const theme = themeFromDesign(dir.markdown)
            const proposal = await proposeVideoTimeline(
              text,
              // The pictures Muse just made, and nothing else. The composer
              // never picks a picture (the founding rule), so this list is the
              // whole world it is shown — and a kind that needs none composes
              // from the twenty-one blocks that need none.
              museImgs.map((im) => im.url.split('/').pop() || '').filter((h) => /^[a-f0-9]{64}$/.test(h)),
              {
                settings,
                theme,
                motionKind: museConfig.motionKind,
                // The dossier in its own words. Not the theme, which travels
                // separately and never reaches the model: this is what makes a
                // film RESEMBLE the direction rather than merely carry its
                // colours. See lib/video/directionBrief.ts.
                direction: directionBriefFrom(dir.markdown),
                signal: ac.signal,
              },
            )
            if (!proposal.timeline) {
              // A proposal that could not be made is not a request that failed —
              // the server says why in its own sentence, and it is the only
              // thing here worth repeating verbatim.
              reportMotionFailure(t('project.motionFailed', { detail: proposal.notices[0] || '' }))
            } else {
              motionStage(screenId, t('project.motionStageRender'))
              /*
               * The theme is STRIPPED before this goes back out, and forgetting
               * that is what made this whole path silently produce nothing.
               *
               * `/compose` answers with the render document — the timeline the
               * server already attached a theme to. `startVideoRender` validates
               * its input against `VideoTimelineSchema`, which is `.strict()`
               * and has no `theme` key, precisely so a model that writes one is
               * refused. So handing the proposal straight back threw
               * "refused before it was sent", the catch below turned it into a
               * Motion failure notice, and no render was ever requested: a film
               * composed, paid for, and dropped one line later.
               *
               * `toRenderInputFrom` is the panel's own helper, which has always
               * done this. Using it rather than a local `delete` is the point —
               * two paths that build the same request must build it the same
               * way, or only one of them keeps working.
               */
              const renderable = toRenderInputFrom(
                proposal.timeline,
                proposal.timeline.outputFormat,
                proposal.timeline.aspectRatio,
              )
              const job = await startVideoRender(renderable, { project: project.id, theme, signal: ac.signal })
              /*
               * Polled until it lands, and bounded by the queue's own deadline
               * rather than by a number invented here.
               *
               * `pollDeadlinePassed` is the panel's rule and it needs a budget
               * this call does not have, so the bound is the job itself: the
               * queue kills a render that overruns and reports it as failed, and
               * this loop simply stops when the job stops being queued.
               */
              let finished = await fetchVideoJob(job.id, ac.signal)
              while (finished.status === 'queued' || finished.status === 'rendering') {
                await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
                if (ac.signal.aborted) throw new DOMException('aborted', 'AbortError')
                finished = await fetchVideoJob(job.id, ac.signal)
              }
              if (finished.status === 'done' && finished.videoHash) {
                // Attached to the SCREEN first, and unconditionally: this is
                // what makes the film findable on the canvas and in Media, and
                // it is the part that cannot fail. The edit pass below can.
                onUpdateScreen(screenId, { attachedMedia: filmMedia(finished.videoHash) })
                await placeFilmInScreen(
                  screenId,
                  finished.videoHash,
                  museConfig.motionKind,
                  ac.signal,
                  // The proposal, not the job: it is the document that carries
                  // the words, and it is right here.
                  proposal.timeline,
                )
              } else {
                reportMotionFailure(t('project.motionFailed', { detail: finished.error || '' }))
              }
            }
          } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') throw err
            reportMotionFailure(
              t('project.motionFailed', { detail: err instanceof Error ? err.message : String(err) }),
            )
          } finally {
            // Both, always: a badge left on a frame for a job that ended is a
            // screen that looks stuck for as long as the tab stays open.
            motionStageDone()
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
          onSetDesign(dir.establish)
        } else if (redesigning && result.code.trim()) {
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
           */
          setPhase('design')
          try {
            const derived = await deriveDesignSystem(settings, result.code, ac.signal)
            if (derived.trim()) onSetDesign(derived)
          } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') throw err
          }
        }

        if (result.truncated) {
          // The code is cut mid-token; the preview would only show a cryptic
          // "Unterminated string constant". Say what actually happened.
          setError(t('project.truncated'))
        } else {
          // Anti-slop lint (§5.2): flag placeholder text so the user can regenerate.
          const lint = lintSlop(result.code)
          if (!lint.ok) {
            setError(t('project.slop', { list: lint.violations.join(', ') }))
          }
        }
      }
    } catch (err) {
      // A screen that was added but never received a single character is not a
      // draft, it is debris: pressing "Stop" one second in used to leave a blank
      // frame on the canvas that the user then had to find and delete by hand.
      // Anything with code in it is kept — that is work, however partial.
      if (newScreenId) {
        const added = screensRef.current.find((s) => s.id === newScreenId)
        if (added && !added.code.trim()) onRemoveScreen(newScreenId)
      }
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      abortRef.current = null
      setBusy(false)
      setPhase(null)
      motionStageDone()
      setGeneratingIds(new Set())
      // The toggle is for ONE generation — the user's own words. It clears here
      // rather than on success so that a failed or cancelled run does not leave
      // a primed redesign waiting to fire on the next, unrelated prompt.
      if (redesigning) setRedesign(false)
    }
    // animationMode, museVision and videoAvail are read in the body and belong
    // here. Without them the closure was only rebuilt when something else in the
    // list changed — so clicking "No animation" after typing the prompt left the
    // stale 'auto' in the captured closure, and the button did nothing the
    // generation could see.
  }, [prompt, screens, selectedIds, presetId, annotations, onAddScreen, onUpdateScreen, onRemoveScreen, onRenameProject, onSetDesign, museConfig, museAvail, project, pinnedImages, t, animationMode, museVision, videoAvail, motionAvail, redesign])

  function cancelGenerate() {
    abortRef.current?.abort()
    abortRef.current = null
    // Auto-repairs were unreachable from here: "Stop" stopped the generation and
    // left a repair running, free to overwrite the screen a moment later.
    for (const ac of retryAborts.current.values()) ac.abort()
    retryAborts.current.clear()
    setBusy(false)
  }

  async function handleExport(stack: StackTarget) {
    setExportMenu(false)
    // Below md the export dropdown is reached through "Plus", which stays open
    // behind it otherwise — two stacked menus over a download that has started.
    setPlusMenu(false)
    if (!screens.length) {
      setError(t('project.exportEmpty'))
      return
    }
    try {
      await downloadZip(screens, {
        stack,
        designMarkdown: activeDirection(),
        projectName: project.name,
        // The interface language, which is the language the project was briefed
        // and written in. `lang` is what tells a screen reader how to pronounce
        // the page, so a hardcoded "en" made every French export unreadable
        // aloud — it is not a cosmetic default.
        lang: getLang(),
        description: project.productName ? `${project.productName} — ${project.name}` : undefined,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  /** Resize a screen to a fixed viewport format, or to fit its content ('full'). */
  function setFormat(screenId: string, fmt: ViewportFormat) {
    if (fmt === 'full') {
      const screen = screens.find((s) => s.id === screenId)
      const measured = contentHeights.current[screenId]
      if (screen) onUpdateScreen(screenId, { h: Math.max(400, Math.round(measured || screen.h)) })
      return
    }
    onUpdateScreen(screenId, VIEWPORTS[fmt])
  }

  /** Re-run generation with the screen's own prompt to get a different variant. */
  async function regenerate(screenId: string) {
    if (busy) return
    const screen = screens.find((s) => s.id === screenId)
    if (!screen || !screen.prompt.trim()) return
    const settings = loadSettings()
    if (!settings.model.trim()) {
      setError(t('project.noModel'))
      return
    }
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(true)
    setError(null)
    // Keep the current iframe rendered — no streaming, no spinner overlay.
    setRegenLabel(t('canvas.regenerating'))
    setRegeneratingIds(new Set([screenId]))
    retryRefs.current[screenId] = { count: 0, lastError: '' }
    try {
      const designMd = activeDirection()
      const designPreamble = designMd ? buildDesignPreamble(designMd) : undefined
      const referencePreamble = identityOrLayoutReference(screenId)
      const extraSystem = joinSystem([designPreamble, referencePreamble, hintForDevice(screen.device)])
      const capIds = screen.caps && screen.caps.length > 0 ? screen.caps : selectCapabilities(screen.prompt, designMd)
      const caps = resolveCapabilities(capIds)
      const oldCode = screen.code
      // No onChunk: the new code is generated fully in the background, then
      // swapped in at once, so the old design never disappears mid-stream.
      const result = await generateComponent(
        settings, screen.prompt, extraSystem, undefined, ac.signal,
        undefined,
        caps,
      )
      // Regenerating rebuilds the screen from the design system as it stands
      // now, so the recorded copy moves with it. Editing a screen does not: an
      // edit reworks what the original design produced, and overwriting the
      // record there would quietly reattribute the screen to a document that
      // never made it.
      onUpdateScreen(screenId, { code: result.code, componentName: result.componentName, previousCode: oldCode, caps: capabilitiesFor(capIds, result.code), design: designMd })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      abortRef.current = null
      setBusy(false)
      setRegeneratingIds(new Set())
    }
  }

  /**
   * Check a screen against the quality rules and correct what they find.
   *
   * On demand, never automatic. The check costs a server round trip and the
   * judged half costs a model call, so running it after every generation would
   * tax every screen for the benefit of the few that need it — and it would
   * break the promise that with Muse off the generation path is unchanged
   * (invariant M1). The user asks for a polish when they want one.
   *
   * The loop itself lives in lib/polish.ts, with its stopping conditions and
   * their tests. This function is the wiring: credentials, capabilities, the
   * busy state, and writing the result back under the same stale-write and
   * revert conventions every other screen mutation uses.
   */
  async function polishScreen(screenId: string) {
    if (busy) return
    const screen = screens.find((s) => s.id === screenId)
    if (!screen || !screen.code.trim()) return
    const settings = loadSettings()
    if (!settings.model.trim()) {
      setError(t('project.noModel'))
      return
    }
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(true)
    setError(null)
    setNotice(null)
    // Keep the current render on screen; the corrected code swaps in at once.
    setRegenLabel(t('project.polishing'))
    setRegeneratingIds(new Set([screenId]))
    retryRefs.current[screenId] = { count: 0, lastError: '' }
    try {
      const designMd = activeDirection()
      const capIds = screen.caps && screen.caps.length > 0 ? screen.caps : selectCapabilities(screen.prompt, designMd)
      const caps = resolveCapabilities(capIds)
      const codeAtStart = screen.code

      const outcome = await runPolishLoop(
        codeAtStart,
        {
          check: (code) =>
            checkQuality(code, {
              // An established direction owns the palette and the typography,
              // so the rules about them become advice rather than corrections.
              hasDirection: Boolean(designMd && designMd.trim()),
              settings,
              signal: ac.signal,
            }),
          polish: async (code, findingsBlock) => {
            const res = await polishComponent(settings, code, findingsBlock, ac.signal, caps)
            return res.code
          },
          onPass: (iteration, remaining) =>
            setRegenLabel(t('project.polishingPass', { i: iteration, n: remaining })),
        },
        { signal: ac.signal },
      )

      // Someone else may have rewritten this screen while the loop ran — the
      // same race fixComponent guards against, and the same answer: drop ours.
      const now = screensRef.current.find((s) => s.id === screenId)
      if (!now || now.code !== codeAtStart) return

      // Only a run that actually produced a report leaves a record. Writing one
      // from a run whose check never completed would store a 20/20 for a screen
      // nobody looked at, and `quality: undefined` — "never checked" — is the
      // honest state for that.
      const record = outcome.report
        ? {
            score: outcome.report.audit.score,
            band: outcome.report.audit.band,
            open: outcome.residual.map((f) => f.rule),
            fixed: outcome.fixed.map((f) => f.rule),
            iterations: outcome.iterations,
            judged: outcome.report.audit.coverage.judged === true,
            checkedAt: Date.now(),
          }
        : undefined

      if (outcome.code !== codeAtStart) {
        onUpdateScreen(screenId, {
          code: outcome.code,
          componentName: detectComponentName(outcome.code),
          // "Revert to previous" undoes a polish, exactly as it undoes an edit.
          previousCode: codeAtStart,
          caps: capabilitiesFor(capIds, outcome.code),
          ...(record ? { quality: record } : {}),
        })
      } else if (record) {
        onUpdateScreen(screenId, { quality: record })
      }

      // Say what happened. A polish that changed nothing is a result, not a
      // silent no-op, and the reason it stopped is the useful part.
      // Naming what changed is the whole point of the report. "Clean, 20/20"
      // was indistinguishable from "nothing to do" even when the pass had
      // rewritten half a dozen things, which is exactly how a working feature
      // reads as a broken one.
      const fixedList = outcome.fixed.map((f) => f.name).join(', ')
      if (outcome.stopped === 'error' || !record) {
        setError(t('project.polishFailed'))
      } else if (outcome.residual.length) {
        setNotice(
          t('project.polishResidual', {
            list: outcome.residual.map((f) => f.name).join(', '),
            score: record.score,
          }),
        )
      } else if (outcome.fixed.length) {
        setNotice(t('project.polishFixed', { list: fixedList, score: record.score }))
      } else {
        setNotice(t('project.polishClean', { score: record.score }))
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      abortRef.current = null
      setBusy(false)
      setRegeneratingIds(new Set())
    }
  }

  /**
   * Layer animations/transitions into a screen at a chosen intensity (Lot B).
   * Runs an edit pass (EDIT_RULES preserve everything but motion) with the
   * Motion capability pack unioned in, streams the result live, and saves the
   * pre-animation code as previousCode so "Revert to previous" undoes it.
   */
  async function addAnimations(screenId: string, level: AnimationLevel) {
    if (busy) return
    const screen = screens.find((s) => s.id === screenId)
    if (!screen || !screen.code.trim()) return
    const settings = loadSettings()
    if (!settings.model.trim()) {
      setError(t('project.noModel'))
      return
    }
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(true)
    setError(null)
    // Keep the current render visible; generate fully, then swap once.
    setRegenLabel(t('project.addingMotion'))
    setRegeneratingIds(new Set([screenId]))
    retryRefs.current[screenId] = { count: 0, lastError: '' }
    try {
      const designPreamble = (() => {
        const md = activeDirection()
        return md ? buildDesignPreamble(md) : undefined
      })()
      const extraSystem = joinSystem([designPreamble, hintForDevice(screen.device)])
      // Make the Motion pack available on top of whatever the screen already uses.
      const capIds = Array.from(new Set([...(screen.caps ?? []), 'motion']))
      const caps = resolveCapabilities(capIds)
      const oldCode = screen.code
      const res = await editComponent(
        settings, buildAnimationInstruction(level), screen.code, extraSystem, undefined, ac.signal,
        undefined,
        caps,
      )
      onUpdateScreen(screenId, { code: res.code, componentName: res.componentName, previousCode: oldCode, caps: capabilitiesFor(capIds, res.code) })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      abortRef.current = null
      setBusy(false)
      setRegeneratingIds(new Set())
    }
  }

  /**
   * A Motion failure, said where it can actually be read.
   *
   * All three of them used to go to `setMuseImageError` alone, which draws
   * inside the Muse panel of the composer — and by the time Motion runs, the
   * screen exists and that panel is behind a collapsed control the user has
   * every reason to have closed. So a film that cost a model call could fail
   * with a full explanation nobody ever saw: the reported symptom was "j'ai
   * demandé un héro et il n'y est pas", twice, with the reason on screen the
   * whole time, one click away.
   *
   * Both, not one. The panel copy is where somebody looking at Muse expects it,
   * and the banner is the one that cannot be missed — which is the standard this
   * module already set for itself: an image failure degrades in silence, a
   * Motion failure is REPORTED, because it spent a call and minutes of a render.
   */
  function reportMotionFailure(message: string) {
    setMuseImageError(message)
    setError(message)
  }

  /**
   * Where Motion says what it is doing — on the SCREEN, not only in the panel.
   *
   * The three stages went to `setMuseStage` alone, which draws a spinner inside
   * the composer's Muse panel. By the time Motion runs the screen exists, the
   * composer has collapsed, and that panel is behind a control the user has
   * every reason to have closed. So the honest report of the situation — a film
   * being composed, rendered, then written into the page, two to three minutes
   * after the screen looked finished — was invisible: "je ne l'aurais jamais
   * deviné si tu ne me l'avais pas précisé".
   *
   * `regeneratingIds` + `regenLabel` are the mechanism the canvas already has
   * for exactly this, and `addMotion` already uses them: the frame is badged
   * with what is happening to it, where the user is looking. Both, because
   * somebody watching the Muse panel should still see its own progress.
   *
   * Cleared by `motionStageDone`, which must run on every exit — success,
   * failure and abort — or a screen keeps a badge for a job that ended.
   */
  function motionStage(screenId: string, label: string) {
    setMuseStage(label)
    setRegenLabel(label)
    setRegeneratingIds(new Set([screenId]))
    motionRunning.current = true
  }

  function motionStageDone() {
    setMuseStage(null)
    setRegeneratingIds(new Set())
    setRegenLabel(t('canvas.regenerating'))
    motionRunning.current = false
  }

  /**
   * Put a rendered film INTO the screen, once it exists.
   *
   * ── Why an edit pass and not the generation itself ────────────────────────
   *
   * Because the film is not ready when the screen is generated, and making the
   * screen wait for it was the trade this flow already refused: a film is a
   * model call plus minutes of render, and holding the thing the person asked
   * for behind the thing they ticked as an extra is the wrong order. So the
   * screen lands fast, and the film slots into it when it arrives — the same
   * shape `addMotion` uses to add an animation pack to a screen already drawn.
   *
   * ── Why it is not merely attached ─────────────────────────────────────────
   *
   * It IS also attached, on the line above, and that used to be all. It put the
   * film in a card beside the frame on the canvas, which is a perfectly good
   * place to find one and not a place anybody asked for: a hero was requested
   * and the mockup came back without one. Two things had to change before this
   * could exist at all — `GET /api/video/:hash` is now public by hash, and the
   * preview's CSP names `media-src`, without which a `<video>` falls back to
   * `default-src 'none'` and is blocked outright.
   *
   * ── And it degrades (Q1) ──────────────────────────────────────────────────
   *
   * A failure here leaves the screen exactly as generated, with the film still
   * attached beside it. `previousCode` is set, so the edit is revertible like
   * every other screen mutation. It is reported rather than swallowed: it cost
   * a model call.
   */
  async function placeFilmInScreen(
    screenId: string,
    hash: string,
    kind: string | undefined,
    signal: AbortSignal,
    /*
     * What the film already SAYS, read off its own document.
     *
     * The first version of this omitted it and produced two headlines stacked
     * on one another: the page had written its hero copy and the film had burnt
     * its own into the frames, each correct, neither told about the other. The
     * answer is not to render a still and ask a vision model to look — a film
     * is structured data, so its words and their zones are exact, already in
     * hand, and cost nothing.
     */
    film: VideoTimeline | RenderTimeline | null,
  ) {
    const settings = loadSettings()
    if (!settings.model.trim()) return
    /*
     * Through the REF, and that is the whole reason this function did nothing.
     *
     * `screens` is captured when the generate callback is built — before the
     * screen this film belongs to has been created. Reading it here found
     * nothing, `codeAtStart` was empty, and the early return below fired: the
     * film was composed, rendered, attached to the screen, and then never put
     * INTO it, silently, because the guard that exists to skip an empty screen
     * cannot tell one apart from a screen it simply could not see.
     *
     * `screensRef` is kept current on every render for exactly this, and the
     * other three long-running mutations in this file already read it.
     */
    const screen = screensRef.current.find((s) => s.id === screenId)
    const codeAtStart = screen?.code ?? ''
    if (!codeAtStart.trim()) return

    const src = videoStreamUrl(hash)
    const where =
      kind === 'background'
        ? 'Use it as a section BACKGROUND: absolutely positioned inside a relative parent, with the existing copy on top of it. It is never the subject.'
        : kind === 'hero'
          ? 'Use it as the HERO: the first thing the visitor sees, with the existing headline and CTA passed as its children so they sit over the film.'
          : 'Give it the size its role deserves — a banner strip, a product card, a feature tile. It is NOT the hero unless the page has no other subject.'

    /*
     * The film's own words, quoted, with the instruction to DELETE the page's
     * duplicate rather than lay one over the other.
     *
     * Deleting is the right verb and it was the user's call: the film already
     * says it, and two headlines stacked is the one outcome nobody wants. The
     * page keeps everything the film does NOT say — the navigation, the body
     * copy, the cards — so what is thrown away is exactly what became a repeat.
     *
     * Quoted verbatim so the model can match on the words rather than guess
     * from a role name: Muse writes the page's copy and the composer writes the
     * film's, and the two say the same thing in different words about half the
     * time. Naming the ZONE as well, because a film that burns its title
     * bottom-left and a page that puts its own top-right do not collide, and
     * telling the model to delete then would cost real copy for nothing.
     */
    /*
     * The rule is about the ZONE, not about repetition — and getting that
     * backwards is what left two headlines on screen after the first fix.
     *
     * The instruction used to say "delete the page copy where it says the same
     * thing". A film burning "Des objets qui gardent la trace du geste" and a
     * page writing "La terre, façonnée à la main" say DIFFERENT things, so the
     * model correctly judged them not duplicates and kept both — stacked, in the
     * same place, unreadable. Two headlines collide because they are in the same
     * zone, whatever they happen to say.
     *
     * So: the film has taken that ground. The page's own display type there
     * goes. Deleting is the user's explicit call ("pas grave si elle jette du
     * code"), and it is the right one — the film already carries the words a
     * hero needs, and nothing below the hero is touched.
     */
    const burnt = filmTextRuns(film)
    const carries = burnt.length
      ? [
          '',
          'THE FILM ALREADY BURNS ITS OWN TEXT INTO THE FRAMES:',
          ...burnt.map((r) => `  · "${r.text}"${r.anchor ? ` (${r.anchor})` : ''}`),
          '',
          'That ground is TAKEN. The page must not put its own headline or subheadline over the film — not a',
          'shorter one, not a different one, not one that says something else. Two runs of display type in the',
          'same place collide whatever they say, and the film is the one that moves with the picture.',
          'DELETE the page copy that would land there: its <h1>, its subheadline, its eyebrow. Keep the logo,',
          'the navigation, the buttons, and every section below the film exactly as they are.',
          'If deleting leaves the film with nothing but buttons over it, that is correct — the film is speaking.',
        ]
      : [
          '',
          'The film carries no text of its own, so the page keeps all of its copy — lay it over the film.',
        ]

    motionStage(screenId, t('project.motionStagePlace'))
    const capIds = Array.from(new Set([...(screen?.caps ?? []), 'motionfilm']))
    const res = await editComponent(
      settings,
      [
        `A film has been rendered for this screen. Place it in the page using the <MotionFilm> component.`,
        `Use src="${src}" exactly — it is a content hash, and changing one character gives a screen whose film silently never loads.`,
        where,
        ...carries,
        '',
        'Change nothing else: every other section, its copy and its classes stay exactly as they are. Do not add',
        'a <video> tag of your own.',
      ].join('\n'),
      codeAtStart,
      undefined,
      undefined,
      signal,
      undefined,
      resolveCapabilities(capIds),
    )
    // The same guard every screen mutation in this file uses: the code may have
    // moved under us while the model was working, and writing back over a newer
    // edit would silently discard whatever the user did in the meantime.
    // The ref again, and here the stale read was worse than useless: `screens`
    // never contains this screen, so `now` was always undefined and the guard
    // silently passed — it would have overwritten whatever the user had edited
    // during the minutes this took, which is the one thing it exists to stop.
    const now = screensRef.current.find((s) => s.id === screenId)
    if (now && now.code !== codeAtStart) return
    onUpdateScreen(screenId, {
      code: res.code,
      componentName: res.componentName,
      previousCode: codeAtStart,
      caps: capabilitiesFor(capIds, res.code),
    })
  }

  /**
   * Apply a no-code, targeted change to a single clicked element (Lot C).
   * Runs an edit pass anchored on the picked element's text/selector, keeping
   * everything else intact, streaming live, and saving previousCode for revert.
   */
  async function applyModify(screenId: string, info: PickInfo, change: string) {
    if (busy || !change.trim()) return
    const screen = screens.find((s) => s.id === screenId)
    if (!screen || !screen.code.trim()) return
    const settings = loadSettings()
    if (!settings.model.trim()) {
      setError(t('project.noModel'))
      return
    }
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(true)
    setError(null)
    // Keep the current render visible; generate fully, then swap once (no
    // streaming, so half-written code never flashes a broken/error preview).
    setRegenLabel(t('project.updating'))
    setRegeneratingIds(new Set([screenId]))
    setPendingModify(null)
    setModifyText('')
    retryRefs.current[screenId] = { count: 0, lastError: '' }
    try {
      const designMd = activeDirection()
      const designPreamble = designMd ? buildDesignPreamble(designMd) : undefined
      const extraSystem = joinSystem([designPreamble, hintForDevice(screen.device)])
      const capIds = screen.caps && screen.caps.length > 0 ? screen.caps : selectCapabilities(screen.prompt, designMd)
      const caps = resolveCapabilities(capIds)
      const oldCode = screen.code
      const instruction = buildElementEditInstruction(
        { label: info.label, selector: info.selector, tag: info.tag, className: info.className },
        change,
      )
      const res = await editComponent(
        settings, instruction, screen.code, extraSystem, undefined, ac.signal,
        undefined,
        caps,
      )
      onUpdateScreen(screenId, { code: res.code, componentName: res.componentName, previousCode: oldCode, caps: capabilitiesFor(capIds, res.code) })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      abortRef.current = null
      setBusy(false)
      setRegeneratingIds(new Set())
    }
  }

  /**
   * Correct named SEO / accessibility findings on one screen.
   *
   * Reuses `runPolishLoop` — its four stop conditions are the hard part and are
   * worth having once — but not the quality pass's check or its prompt. The
   * check is the browser-side audit, and the prompt is `AUDIT_FIX_PROMPT`,
   * which says the screen must look identical afterwards. POLISH_PROMPT says
   * roughly the opposite, on purpose, and using it here would return a
   * redesigned screen with good markup: two changes where one was asked for.
   *
   * Deliberately does NOT write `Screen.quality`. That field records the /20
   * design audit, and putting an accessibility score in it would make two
   * different measurements share one number.
   *
   * @returns how many findings were resolved, or null when nothing could run.
   */
  async function fixAuditFindings(screenId: string, findings: QualityFinding[]): Promise<number | null> {
    /*
     * The same guard as regenerate, polishScreen, addAnimations and applyModify,
     * and the only one of the five that was missing it.
     *
     * `busy`, `abortRef.current`, `regenLabel` and `regeneratingIds` are one set
     * of state shared by every model-backed mutation, so a second one starting
     * mid-flight does not run beside the first — it overwrites it. Started
     * during a regeneration, this took over `abortRef`, so Stop cancelled the
     * audit fix and left the regeneration running with nothing pointing at it;
     * moved the progress overlay onto its own screen; and then cleared all four
     * in its `finally` while the regeneration was still going, which is how a
     * screen finishes generating with no sign it ever started.
     *
     * Returning null rather than throwing: AuditPanel already treats null as
     * "the pass could not run", and the panel's buttons are disabled on `busy`
     * anyway, so this is the backstop for a click that slipped through.
     */
    if (busy) return null
    const screen = screensRef.current.find((s) => s.id === screenId)
    if (!screen) return null
    // Read at call time, like every other model-backed path here, so an admin
    // changing the instance provider applies without a reload.
    const settings = loadSettings()
    if (!settings.model.trim()) {
      setError(t('project.noModel'))
      return null
    }
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(true)
    setRegenLabel(t('audit.fixing'))
    setRegeneratingIds(new Set([screenId]))
    // Every path that hands a screen wholesale to the model resets this first,
    // and this one did not. `retryRefs` is the auto-repair budget — two attempts
    // per screen, spent on render errors — and it is keyed by screen id, not by
    // version of the code. A screen that had already burned MAX_FIX_ATTEMPTS on
    // its previous source would get no repair at all if the markup correction
    // came back broken, which is the moment it is most likely to.
    retryRefs.current[screenId] = { count: 0, lastError: '' }
    try {
      const designMd = activeDirection()
      const capIds = screen.caps && screen.caps.length > 0 ? screen.caps : selectCapabilities(screen.prompt, designMd)
      const caps = resolveCapabilities(capIds)
      const codeAtStart = screen.code

      // Explicitly a PolishReport, not an AuditReport: `initialReport` below is
      // the findings the user pressed the button about, and nothing else of an
      // audit report is needed to steer the loop.
      const outcome = await runPolishLoop<PolishReport>(
        codeAtStart,
        {
          check: (code) => auditScreen(code, { settings, signal: ac.signal }),
          polish: async (code, findingsBlock) => {
            const res = await auditFixComponent(settings, code, findingsBlock, ac.signal, caps)
            return res.code
          },
        },
        {
          signal: ac.signal,
          // The report the user is looking at, so the first pass corrects what
          // they actually pressed the button about rather than re-deriving a
          // possibly different list a second later.
          initialReport: { findings },
          // And the same list as the yardstick. `check` re-audits the WHOLE
          // screen, so without this the loop compared the one finding the user
          // clicked against every finding the screen still had, decided things
          // had got worse, and threw away a correction that had worked.
          scope: findings.map((f) => f.rule),
        },
      )

      // Someone else may have rewritten this screen while the loop ran — the
      // same race polishScreen guards against, and the same answer: drop ours.
      const now = screensRef.current.find((s) => s.id === screenId)
      if (!now || now.code !== codeAtStart) return null

      if (outcome.code !== codeAtStart) {
        onUpdateScreen(screenId, {
          code: outcome.code,
          componentName: detectComponentName(outcome.code),
          previousCode: codeAtStart,
        })
      }
      return outcome.fixed.length
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return null
      setError(e instanceof Error ? e.message : String(e))
      return null
    } finally {
      setBusy(false)
      setRegenLabel('')
      setRegeneratingIds(new Set())
      abortRef.current = null
    }
  }

  /**
   * Write back a screen whose media URLs were swapped in the source.
   *
   * No AbortController and no `codeAtStart` re-check, unlike every model-backed
   * mutation here: the substitution is synchronous and was computed from the
   * source this very render handed the dialog, so there is no window in which
   * the screen could have moved underneath it. What it does share is
   * `previousCode`, which is what makes "Revert" undo a swap the same way it
   * undoes an edit.
   *
   * `componentName` is re-detected out of habit rather than need — a media URL
   * cannot rename a component — but every other write-back here does it, and a
   * path that skips it is a path someone has to reason about later.
   *
   * `sequence` arrives only when the swap re-pointed the very clip
   * `videoHash`/`videoFrames` records. Those two are written at generation time
   * to say which sequence Muse paid for; left behind after a hero swap they
   * describe a clip the screen no longer shows. They move as a pair or not at
   * all, here as everywhere — half a sequence draws its last frame for the rest
   * of the scroll.
   */
  function swapScreenImages(
    screenId: string,
    nextCode: string,
    sequence?: { hash: string; frames: number },
  ) {
    const screen = screensRef.current.find((s) => s.id === screenId)
    if (!screen || screen.code === nextCode) return
    onUpdateScreen(screenId, {
      code: nextCode,
      componentName: detectComponentName(nextCode),
      previousCode: screen.code,
      ...(sequence ? { videoHash: sequence.hash, videoFrames: sequence.frames } : {}),
    })
  }

  /**
   * Attach a film or a sequence to a screen, or detach it with null.
   *
   * The other relation between a screen and a media, and it is deliberately not
   * `swapScreenImages` with a flag: nothing here reads or writes `code`, so
   * there is no `previousCode` to keep and no component name to re-detect. Those
   * belong to a source rewrite, and carrying them on a metadata write would
   * make "Revert" offer to undo an attachment by restoring an old source.
   *
   * Every caller goes through here — the export panel's picker and the media
   * dialog's second section — so a field that has to survive `normalizeScreen`
   * has one writer to check.
   */
  function attachScreenMedia(screenId: string, media: AttachedMedia | null) {
    onUpdateScreen(screenId, { attachedMedia: media ?? undefined })
  }

  /**
   * Change only the visible text of the picked element (Lot C.2). Tries a
   * deterministic in-place swap first (instant, free, no model) and falls back
   * to a targeted LLM edit when the text isn't a unique verbatim match.
   *
   * No `busy` guard of its own: the direct swap is synchronous and costs
   * nothing, and the fallback is `applyModify`, which already refuses while
   * another mutation is running. Adding a second check here would be a second
   * place to keep in step with a rule that has one owner.
   */
  async function applyTextChange(screenId: string, info: PickInfo, newText: string) {
    const screen = screens.find((s) => s.id === screenId)
    if (!screen) return
    if (!newText.trim() || newText === info.label) {
      setPendingModify(null)
      return
    }
    const direct = tryDirectTextReplace(screen.code, info.label, newText)
    if (direct) {
      onUpdateScreen(screenId, { code: direct, componentName: detectComponentName(direct), previousCode: screen.code })
      setPendingModify(null)
      setModifyLabelDraft('')
      return
    }
    // Ambiguous or non-verbatim → targeted edit through the model.
    await applyModify(screenId, info, `Change the visible text of this element to exactly: "${newText}". Do not change anything else.`)
  }

  function onComposerKey(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      generate()
    }
  }

  const editing = selectedScreens.length > 0

  /**
   * Whether the iPhone bezel has anything to draw around in this project.
   *
   * Derived per render rather than stored: a screen's device is not fixed at
   * creation — the format switcher rewrites it — so a cached flag would go
   * stale the moment someone turns a desktop screen into a mobile one.
   */
  const hasPhoneScreen = screens.some((s) => s.device === 'iphone')

  function toggleFrame() {
    setShowFrame((v) => {
      const next = !v
      localStorage.setItem(FRAME_PREF_KEY, next ? '1' : '0')
      return next
    })
  }

  function toggleBrief() {
    setBriefOpen((v) => {
      const next = !v
      localStorage.setItem(BRIEF_PREF_KEY, next ? '1' : '0')
      return next
    })
  }

  /** Ce que fabrique Mocky en ce moment — sert de libelle ET de nom accessible. */
  const busyLabel = t(
    phase === 'muse'
      ? 'project.busyMuse'
      : phase === 'planning'
        ? 'project.busyPlanning'
        : phase === 'design'
          ? 'project.busyDesign'
          : 'composer.generating',
  )

  /** What the brief says in one line when it is folded. */
  const briefSummary =
    museStage ||
    (museImageError ? t('project.briefImageFailed', { reason: museImageError }) : '') ||
    museResult?.dossier?.concept ||
    (museAvail === false
      ? t('project.briefBackend')
      : pinnedImages.length
        ? t(pinnedImages.length === 1 ? 'project.briefPinned_one' : 'project.briefPinned_other', {
            count: pinnedImages.length,
          })
        : t('project.briefDefault'))

  const libraryModal = (
    <>
      {showLibrary && (
        <Bibliotheque
          projectId={project.id}
          initialTab={libraryTab}
          pinned={pinnedImages}
          onTogglePin={togglePin}
          pinnedVideo={pinnedVideo}
          onPinVideo={(v) =>
            setPinnedVideo(
              v
                ? { hash: v.hash, frames: v.frames, poster: videoPosterUrl(v.hash), label: v.prompt.slice(0, 60) }
                : null,
            )
          }
          onClose={() => setShowLibrary(false)}
          onOpenImage={setLightboxHash}
        />
      )}
      {lightboxHash && <ImageLightbox hash={lightboxHash} onClose={() => setLightboxHash(null)} />}
      {playingFilm && <FilmLightbox hash={playingFilm} onClose={() => setPlayingFilm(null)} />}
      {imageSwapScreen && (
        <ScreenImagesDialog
          screenName={imageSwapScreen.name}
          code={imageSwapScreen.code}
          projectId={project.id}
          attached={imageSwapScreen.attachedMedia}
          videoHash={imageSwapScreen.videoHash}
          onReplace={(code, sequence) => swapScreenImages(imageSwapScreen.id, code, sequence)}
          onAttach={(media) => attachScreenMedia(imageSwapScreen.id, media)}
          onClose={() => setImagesForScreen(null)}
        />
      )}
      {showVideoExport && (
        <VideoExportDialog
          projectId={project.id}
          /* The same direction the next generation will read, not the global
             file: a film cut in a project with its own DESIGN.md must come out
             in that project's colours, and `directionMd` is the one resolution
             of that question the rest of this view already draws from. */
          direction={directionMd}
          /* Read-only, and only what the picker draws — see AttachTarget. The
             thumbnail cache is keyed on the code, so it travels with the name. */
          screens={screens.map((s) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            attachedHash: s.attachedMedia?.kind === 'film' ? s.attachedMedia.hash : undefined,
          }))}
          onAttachFilm={(screenId, hash) => attachScreenMedia(screenId, filmMedia(hash))}
          jobId={videoJobId}
          onJobId={setVideoJobId}
          /*
           * Closes this panel and opens the library on the cut. Both, in that
           * order: leaving the export panel underneath would stack two modals
           * over each other, and the render it was watching is finished — the
           * job id survives in `videoJobId`, so reopening the panel still finds
           * it.
           */
          onOpenMedia={() => {
            setShowVideoExport(false)
            setLibraryTab('films')
            setShowLibrary(true)
          }}
          onClose={() => setShowVideoExport(false)}
        />
      )}
    </>
  )

  if (screens.length === 0) {
    return (
      <>
      <Welcome
        prompt={prompt}
        setPrompt={setPrompt}
        onGenerate={generate}
        busy={busy}
        error={error}
        designActive={!!directionMd}
        examples={EXAMPLE_KEYS.map((k) => t(k))}
        presetId={presetId}
        onPresetChange={setPresetId}
        onOpenSettings={onOpenSettings}
        onOpenDesign={onOpenDesign}
        onApplyStyle={applyStyleMarkdown}
        museConfig={museConfig}
        onMuseChange={updateMuse}
        museAvail={museAvail}
        museResult={museResult}
        museImages={museImages}
        museStage={museStage}
        onOpenLibrary={() => {
                      // Back to images. `libraryTab` is sticky so that "see it
                      // in Media" can land on the cut; leaving it there would
                      // make the ordinary Media button open on Motion ever after.
                      setLibraryTab('images')
                      setShowLibrary(true)
                    }}
        pinned={pinnedImages}
        onUnpin={(hash) => setPinnedImages((arr) => arr.filter((p) => p.hash !== hash))}
        museImageError={museImageError}
        museVision={museVision}
        museVideo={videoAvail}
        museMotion={motionAvail}
        animationMode={animationMode}
        onCycleAnimations={cycleAnimations}
      />
      {libraryModal}
      </>
    )
  }

  /**
   * Everything on the toolbar past "Modifier". Rendered as buttons on the bar
   * at md and above, as rows in the "Plus" menu below it — from this one list,
   * so the two can never drift apart.
   */
  const foldedTools: FoldedTool[] = [
    {
      id: 'interact',
      icon: 'hand',
      label: t('mode.interact'),
      title: t('project.interactTitle'),
      active: interactAll,
      onClick: () => setInteractAll((v) => !v),
    },
    {
      id: 'annotate',
      icon: 'crop',
      label: t('mode.annotate'),
      title: t('project.annotateTitle'),
      active: annotateMode,
      onClick: () => {
        setAnnotateMode((v) => !v)
        // Only Link mode: annotating has no panel in the right-hand slot, so
        // closing the Design System inspector or the audit report here would be
        // taking away a reference the user opened on purpose.
        setRightSlot((s) => closeSlot(s, 'links'))
        setModifyMode(false)
        setPendingModify(null)
      },
    },
    {
      id: 'frame',
      icon: 'phone',
      label: t('mode.frame'),
      // Disabled, not hidden: the control still says what it would do. It was
      // already a no-op without a phone screen — Canvas only draws the bezel on
      // `device === 'iphone'` — so this only makes the existing behaviour
      // visible instead of leaving a button that answers nothing.
      //
      // `showFrame` itself is deliberately NOT cleared by `toggleFrame`. It
      // lives in one global localStorage key shared by every project, so
      // resetting it because THIS project has no phone would silently un-frame
      // all the others. Gate the control, leave the preference.
      title: hasPhoneScreen ? t('project.frameTitle') : t('project.frameNeedsMobile'),
      active: showFrame && hasPhoneScreen,
      disabled: !hasPhoneScreen,
      onClick: toggleFrame,
    },
    {
      id: 'system',
      icon: 'image',
      label: t('mode.system'),
      title: t('project.systemTitle'),
      active: showSystem,
      onClick: () => setRightSlot((s) => toggleSlot(s, 'system')),
    },
    {
      id: 'audit',
      icon: 'shield',
      label: t('mode.audit'),
      title: t('audit.open'),
      active: showAudit,
      // Exclusive with the design system panel AND with the Links list, which
      // this used to forget: all three want `right-4 top-11`, and it only ever
      // cleared the one whose name was in the same paragraph. See lib/rightSlot.
      onClick: () => setRightSlot((s) => toggleSlot(s, 'audit')),
    },
    /*
     * Last of the first group — the panels and modes — and not with Démo and
     * Export past the rule.
     *
     * That second group is what LEAVES the project: a demo of screens that
     * exist, an archive of code that exists. Motion makes something that did not
     * exist a minute ago, out of the media library, and it opens a panel exactly
     * as Design System and Audit do. Sitting beside Export it read as a fourth
     * output format, which is the one thing it is not.
     *
     * Still deliberately NOT in a screen's context menu: a cut is made from the
     * media library, it does not read a screen and cannot be derived from one.
     * Hanging it off a screen would promise a relationship the pipeline does not
     * have, and the first thing the panel does — ask which pictures to use —
     * would contradict it.
     */
    {
      id: 'video',
      icon: 'film',
      label: t('video.toolbarLabel'),
      title: t('video.toolbarTitle'),
      active: showVideoExport,
      onClick: () => setShowVideoExport((v) => !v),
    },
    {
      id: 'demo',
      icon: 'play',
      iconSize: 14,
      label: t('mode.demo'),
      title: t('project.demoTitle'),
      startsGroup: true,
      onClick: () => setDemoStartId(selectedScreens[0]?.id ?? screens[0]?.id ?? null),
    },
    {
      id: 'export',
      icon: 'download',
      label: t('mode.export'),
      title: t('project.exportTitle'),
      active: exportMenu,
      onClick: () => setExportMenu((v) => !v),
    },
  ]

  return (
    <div className="relative h-[calc(100vh-57px)]">
      {libraryModal}
      {/*
        The viewport, and only the viewport.
        On a phone the infinite canvas is replaced — see MobileProject for why
        it is arithmetic rather than taste. Everything above and below this
        line is unchanged: the composer, the toolbar, the generation callbacks
        and their AbortController/codeAtStart/previousCode conventions all stay
        in this component, so there is exactly one mutation path on every
        device.
      */}
      {phone ? (
        <MobileProject
          screens={screens}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          generatingIds={generatingIds}
          regeneratingIds={regeneratingIds}
          fixingIds={fixingIds}
          regenLabel={regenLabel}
          onError={onScreenError}
          onOpenScreenMenu={(s, x, y) => setMenu({ screenId: s.id, x, y })}
        />
      ) : (
      <Canvas
        screens={screens}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onMoveScreens={(updates) => updates.forEach((u) => onUpdateScreen(u.id, { x: u.x, y: u.y }))}
        onResizeScreen={(id, box) => onUpdateScreen(id, box)}
        onRenameScreen={(id, name) => onUpdateScreen(id, { name })}
        onOpenImage={setLightboxHash}
        /*
         * A film plays here; a sequence goes to Média.
         *
         * Not an omission. A scroll sequence is played by scrubbing
         * `/f/1.jpg … /f/N.jpg`, which `VideoPlayer` already does properly in
         * the Vidéos tab — writing a second scrubber for one card is two
         * players that drift, and the first thing to drift would be the
         * cache-busting `?v=` a re-cut depends on.
         */
        onOpenScreenMedia={(media) => {
          if (media.kind === 'film') return setPlayingFilm(media.hash)
          setLibraryTab('videos')
          setShowLibrary(true)
        }}
        onDeleteScreen={(id) => {
          if (confirm(t('project.deleteScreenConfirm'))) {
            onRemoveScreen(id)
            setSelectedIds((ids) => ids.filter((i) => i !== id))
          }
        }}
        referenceScreenId={project.referenceScreenId}
        onScreenContextMenu={(id, x, y) => setMenu({ screenId: id, x, y })}
        onContentHeight={(id, h) => {
          contentHeights.current[id] = h
        }}
        // "Sans animation" holds the screens already on the canvas still too —
        // otherwise the button says one thing and the mockups do another.
        animations={animationMode !== 'off'}
        onCycleScreenAnimations={cycleScreenAnimations}
        onDeriveDesign={(id) => {
          const sc = screens.find((x) => x.id === id)
          if (sc) deriveDesignFrom(sc)
        }}
        onApplyScreenDesign={applyScreenDesign}
        onInspectScreenDesign={setInspectDesignId}
        derivingDesignId={derivingDesignId}
        linkMode={linkMode}
        modifyMode={modifyMode}
        interactAll={interactAll}
        showFrame={showFrame}
        onPickElement={(screenId, info) => {
          if (modifyMode) {
            setPendingModify({ screenId, info })
            setModifyText('')
            setModifyLabelDraft(info.label)
            setModifyHex('')
          } else {
            setPendingLink({ screenId, info })
          }
        }}
        onRemoveHotspot={removeHotspot}
        highlightedHotspotId={highlightHotspot}
        focusScreenId={focus?.screenId ?? null}
        focusNonce={focus?.nonce}
        annotateMode={annotateMode}
        onCaptureRegion={onCaptureRegion}
        captureReq={captureReq}
        sweepReq={sweepReq}
        onSwept={onSwept}
        onCaptureRect={onCaptureRect}
        onError={onScreenError}
        generatingIds={generatingIds}
        regeneratingIds={regeneratingIds}
        fixingIds={fixingIds}
        regenLabel={regenLabel}
      />
      )}

      {/* Live Design-system frame (D.2) */}
      {showSystem && (
        <DesignSystemPanel
          markdown={directionMd || ''}
          onRecolor={recolorToken}
          onClose={() => setRightSlot((s) => closeSlot(s, 'system'))}
          onEdit={onOpenDesign}
        />
      )}

      {showAudit && (
        <AuditPanel
          className="absolute right-4 top-11 w-80 rounded-xl shadow-2xl"
          screens={screens}
          projectName={project.name}
          productName={project.productName}
          selectedId={selectedIds[0] ?? null}
          // Selecting from the panel also frames the screen on the canvas: the
          // report names elements, and a report about a screen you cannot see
          // is a list of assertions you have to take on trust.
          onSelect={(id) => {
            setSelectedIds([id])
            setFocus({ screenId: id, nonce: Date.now() })
          }}
          onFix={fixAuditFindings}
          // Gated on the project being idle, not just on the panel's own state:
          // `fixAuditFindings` refuses while another screen mutation runs, and a
          // button whose only feedback would be "the correction failed" is worse
          // than one that says it is unavailable.
          busy={busy}
          onClose={() => setRightSlot((s) => closeSlot(s, 'audit'))}
        />
      )}

      {/* Links panel (link mode) */}
      {linkMode && (
        <div className="absolute right-4 top-11 flex max-h-[70vh] w-72 flex-col rounded-xl border border-line bg-raised shadow-2xl">
          <div className="flex items-center justify-between border-b border-line-soft px-3 py-2">
            <span className="kicker text-accent-ink">
              {t('project.links')} ·{' '}
              <span className="font-mono">{screens.reduce((a, s) => a + s.links.length, 0)}</span>
            </span>
            <button
              type="button"
              className="text-body-sm text-ink-muted hover:text-ink"
              onClick={() => setRightSlot((s) => closeSlot(s, 'links'))}
              title={t('project.closeLinkMode')}
            >
              {t('project.done')}
            </button>
          </div>

          {/* The whole point of the feature: stop making the user wire what the
              model already said. Scoped to one screen at a time — a proposal
              covering six screens at once is a list nobody reads. */}
          {/* The screen is chosen HERE, not on the canvas.
              Link mode makes every frame pickable, so a click inside one
              designates an ELEMENT, not the frame — asking the user to "select a
              screen" while this panel is open was asking for something the mode
              itself prevents. The dropdown honours a selection made before
              entering the mode, and otherwise starts on the first screen. */}
          <div className="border-b border-line-soft px-3 py-2">
            {screens.length < 2 ? (
              <p className="text-caption text-ink-faint">{t('project.autoLinkNeedsScreens')}</p>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1 block font-mono text-caption text-ink-faint">
                    {t('project.autoLinkFrom')}
                  </span>
                  <Select
                    value={autoLinkFrom}
                    onChange={(e) => setAutoLinkFrom(e.target.value)}
                    className="w-full !py-1.5"
                  >
                    {screens
                      .filter((s) => s.code && s.code.trim())
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {headline(s.name)}
                        </option>
                      ))}
                  </Select>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full justify-center"
                  disabled={sweeping || !autoLinkFrom}
                  onClick={() => autoLinkFrom && startAutoLink(autoLinkFrom)}
                >
                  <Icon name="wand" size={15} />
                  {sweeping ? t('project.autoLinkWorking') : t('project.autoLink')}
                </Button>
              </>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {screens.every((s) => s.links.length === 0) ? (
              <p className="p-3 text-center text-body-sm text-ink-faint">{t('project.noLinks')}</p>
            ) : (
              <ul className="space-y-1">
                {screens.flatMap((s) =>
                  s.links.map((h) => {
                    const target = screens.find((sc) => sc.id === h.target)
                    return (
                      <li
                        key={h.id}
                        onMouseEnter={() => setHighlightHotspot(h.id)}
                        onMouseLeave={() => setHighlightHotspot((cur) => (cur === h.id ? null : cur))}
                        className="group flex items-center gap-2 rounded-lg border border-line-soft bg-ink/5 px-2 py-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => setFocus({ screenId: s.id, nonce: Date.now() })}
                          className="min-w-0 flex-1 text-left"
                          title={t('project.centerOnLink')}
                        >
                          <div className="truncate text-body-sm text-ink-muted">
                            {h.label ? (
                              <span className="text-accent-ink">{t('project.linkElement', { label: h.label })}</span>
                            ) : (
                              t('project.elementWord')
                            )}{' '}
                            → <span className="text-ink">{target?.name ?? t('project.missingTarget')}</span>
                          </div>
                          <div className="truncate text-caption text-ink-faint">
                            {t('project.onScreen', { name: s.name })}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeHotspot(s.id, h.id)}
                          className="shrink-0 rounded px-1 py-1 text-danger hover:bg-danger/10"
                          aria-label={t('project.deleteLinkOn', { name: s.name })}
                          title={t('project.deleteLink')}
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </li>
                    )
                  }),
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      {/*
        Top-left toolbar.

        It was one row of nine labelled buttons whose natural width is ~850px,
        so on anything narrower than about 880px — a phone, but a half-width
        desktop window just as much — it pushed the document sideways and left
        six of the nine modes off-screen with no way to reach them.

        Three defences, because dropping the labels is not enough on its own:
         1. the labels fold away below md, leaving the icons and their titles;
         2. everything past "Modifier" folds into "Plus". Stripped to icons the
            nine buttons still come to roughly 408px — 38 each (a 16px glyph
            inside px-2.5), plus two group rules and ten gaps — against the
            358px a 390px screen leaves after the composer's gutters. The count
            is the problem, not the labels. `tap-target` in index.css raises the
            floor by height only, so this arithmetic holds on touch as well;
         3. max-w + overflow-x-auto, so whatever the labels end up doing the bar
            scrolls itself instead of scrolling the page. That is what carries
            the 768–880px band, where the labels are back but the window is
            still too narrow for them.

        The two dropdowns hang off this wrapper rather than off the row: defence
        3 makes the row a scroll container, and a scroll container clips a menu
        anchored inside it.
      */}
      <div className="absolute left-4 top-3 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1 shadow-lg">
          <Button variant="toolbar" size="sm" onClick={leaveProject} title={t('error.backToProjects')}>
            <Icon name="chevronLeft" size={16} />
            {/* Every label on the bar is wrapped, including the ones inside the
                folded group where the group already hides them. Uniform, so
                moving a tool in or out of the group cannot bring a label back
                at 390px by accident. The `title` is what remains at that width,
                and the icon-only buttons keep their accessible name from it. */}
            <span className="hidden md:inline">{t('project.back')}</span>
          </Button>
          <div className="mx-1 h-5 w-px bg-line-soft" />
          <Button
            variant="toolbar"
            size="sm"
            active={linkMode}
            onClick={() => {
              setRightSlot((s) => toggleSlot(s, 'links'))
              setModifyMode(false)
              setAnnotateMode(false)
            }}
            title={t('project.linkTitle')}
          >
            <Icon name="link" size={16} />
            <span className="hidden md:inline">{t('mode.link')}</span>
          </Button>
          <Button
            variant="toolbar"
            size="sm"
            active={modifyMode}
            onClick={() => {
              setModifyMode((v) => !v)
              // See the Annotate button: Link mode only, because Modify has no
              // panel of its own in that slot to make room for.
              setRightSlot((s) => closeSlot(s, 'links'))
              setAnnotateMode(false)
              setPendingModify(null)
            }}
            title={t('project.modifyTitle')}
          >
            <Icon name="pencil" size={16} />
            <span className="hidden md:inline">{t('mode.modify')}</span>
          </Button>

          {/* `contents` and not `flex`: at md and above this wrapper must add no
              box of its own, or the folded buttons would space as one item
              against the three before them. */}
          <div className="hidden md:contents">
            {foldedTools.map((tool) => (
              <Fragment key={tool.id}>
                {tool.startsGroup && <div className="mx-1 h-5 w-px bg-line-soft" />}
                <Button
                  variant="toolbar"
                  size="sm"
                  active={tool.active}
                  disabled={tool.disabled}
                  onClick={tool.onClick}
                  title={tool.title}
                >
                  <Icon name={tool.icon} size={tool.iconSize ?? 16} />
                  <span className="hidden md:inline">{tool.label}</span>
                </Button>
              </Fragment>
            ))}
          </div>

          <Button
            variant="toolbar"
            size="sm"
            className="md:hidden"
            active={plusMenu}
            aria-expanded={plusMenu}
            onClick={() => setPlusMenu((v) => !v)}
            title={t('project.moreToolsTitle')}
          >
            <Icon name="more" size={16} />
            {t('project.moreTools')}
          </Button>
        </div>

        {/* Both menus carry a backdrop rather than relying on Escape: opened by
            a finger, they have no keyboard to close them, and "click outside"
            only exists if something outside is listening for it. */}
        {plusMenu && (
          <>
            <div className="fixed inset-0 z-menu md:hidden" onClick={() => setPlusMenu(false)} />
            <div className="absolute left-0 top-full z-menu mt-1 w-64 max-w-[calc(100vw-2rem)] border border-line bg-raised py-1 md:hidden">
              {foldedTools.map((tool) => (
                <Fragment key={tool.id}>
                  {tool.startsGroup && <div className="my-1 border-t border-line-soft" />}
                  <button
                    type="button"
                    disabled={tool.disabled}
                    aria-pressed={tool.active || undefined}
                    onClick={() => {
                      setPlusMenu(false)
                      tool.onClick()
                    }}
                    title={tool.title}
                    className={`flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left text-body transition disabled:opacity-40 ${
                      // Inverted, not tinted — the same way an active toolbar
                      // button reads, and legible in both themes.
                      tool.active ? 'bg-ink text-surface' : 'text-ink hover:bg-ink/5'
                    }`}
                  >
                    <Icon name={tool.icon} size={tool.iconSize ?? 16} />
                    {tool.label}
                  </button>
                </Fragment>
              ))}
            </div>
          </>
        )}

        {exportMenu && (
          <>
            <div className="fixed inset-0 z-menu" onClick={() => setExportMenu(false)} />
            {/* left-0 below md, right-0 above it. Anchored right at every width,
                the panel opened at x 657–881 on a 390px screen — entirely past
                the edge, because the button it hangs from is itself pushed to
                the right of the bar. */}
            <div className="absolute left-0 top-full z-menu mt-1 w-56 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-raised p-1 shadow-xl md:left-auto md:right-0">
              <div className="kicker px-2 py-1 text-accent-ink">{t('project.exportHeading')}</div>
              {EXPORT_TARGETS.map(([stack, labelKey, hintKey]) => (
                <button
                  key={stack}
                  type="button"
                  onClick={() => handleExport(stack)}
                  className="group block w-full rounded-md px-2.5 py-1.5 text-left text-body-sm text-ink transition hover:bg-ink/5"
                >
                  <span className="font-medium transition group-hover:text-accent-ink">{t(labelKey)}</span>
                  <span className="block text-caption text-ink-faint">{t(hintKey)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Floating composer */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-line bg-surface p-2 shadow-2xl">
          {error && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-danger/50 bg-danger/10 px-3 py-2 text-body-sm text-danger">
              <span className="flex min-w-0 items-center gap-2">
                <Icon name="warning" size={16} />
                <span className="truncate">{error}</span>
              </span>
              <button type="button" className="btn-ghost shrink-0 px-2 py-1 text-body-sm" onClick={onOpenSettings}>
                {t('nav.settings')}
              </button>
            </div>
          )}

          {/*
           * Neutral counterpart to the error banner.
           *
           * The red banner is the only text channel the composer had, and a
           * quality pass that finds nothing has something worth saying that is
           * not a failure. Without this, asking for a polish on an already-clean
           * screen produced no visible change and no message — indistinguishable
           * from the action never having run.
           */}
          {notice && !error && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-line bg-raised px-3 py-2 text-body-sm text-ink-muted">
              <span className="flex min-w-0 items-center gap-2">
                <Icon name="sparkle" size={16} />
                <span className="truncate">{notice}</span>
              </span>
              <button
                type="button"
                className="btn-ghost shrink-0 px-2 py-1 text-body-sm"
                onClick={() => setNotice(null)}
              >
                {t('common.close')}
              </button>
            </div>
          )}

          {/* Annotation thumbnails */}
          {(annotations.length > 0 || capturing) && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {annotations.map((a, i) => (
                <div
                  key={a.id}
                  className="group relative h-14 w-14 overflow-hidden rounded-lg border border-warn/60 bg-surface"
                  title={t('project.refAttached', { n: i + 1 })}
                >
                  <img src={a.dataUrl} alt={t('project.refAlt', { n: i + 1 })} className="h-full w-full object-cover" />
                  <span className="absolute left-0 top-0 rounded-br bg-warn px-1 font-mono text-caption font-bold text-surface">
                    {i + 1}
                  </span>
                  {/* opacity-60, not opacity-0. The same bug PanelRow already
                      carries a note about: hidden-until-hover has no trigger on
                      a touch screen, so "remove this reference" was permanently
                      invisible on a phone — not merely hard to see, unreachable.
                      Visible by default, full strength on hover and on focus. */}
                  <button
                    type="button"
                    onClick={() => setAnnotations((arr) => arr.filter((x) => x.id !== a.id))}
                    className="absolute right-0 top-0 rounded-bl bg-ink/60 p-0.5 text-surface opacity-60 transition group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={t('project.removeRefN', { n: i + 1 })}
                    title={t('project.removeRef')}
                  >
                    <Icon name="close" size={12} />
                  </button>
                </div>
              ))}
              {capturing && (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-warn/60">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-warn/40 border-t-warn" />
                </div>
              )}
            </div>
          )}

          {/* Selected-screen chips */}
          {editing && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {selectedScreens.map((s) => (
                <span
                  key={s.id}
                  className="flex max-w-[200px] items-center gap-1 rounded-md border border-accent bg-ink py-0.5 pl-2 pr-1 text-body-sm font-medium text-surface"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Icon name="grid" size={12} />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <button
                    type="button"
                    className="rounded p-0.5 text-surface/70 transition hover:bg-surface/20 hover:text-surface"
                    onClick={() => setSelectedIds((ids) => ids.filter((i) => i !== s.id))}
                    aria-label={t('project.removeFromSelectionOf', { name: s.name })}
                    title={t('project.removeFromSelection')}
                  >
                    <Icon name="close" size={12} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="ml-1 text-body-sm font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                onClick={() => setSelectedIds([])}
              >
                {t('project.clearSelection')}
              </button>
            </div>
          )}

          {/* The brief — inspiration + moodboard, only when creating a new screen.
              Folded, it is one standing line; open, the whole dossier. */}
          {museConfig.enabled && !editing && (
            <div className="mb-2">
              <button
                type="button"
                onClick={toggleBrief}
                aria-expanded={briefOpen}
                aria-label={t(briefOpen ? 'composer.briefCollapse' : 'composer.briefExpand')}
                className="flex w-full items-center gap-2.5 rule-thin px-0.5 pb-1.5 text-left transition hover:text-ink"
              >
                <span className="kicker shrink-0">{t('muse.title')}</span>
                {museStage && (
                  /* Le dossier s'ecrit : meme signal que le bouton, en plus petit.
                     Purement decoratif ici — le bouton du composer porte deja
                     l'annonce, un second role="status" la dirait deux fois. */
                  <span aria-hidden className="flex shrink-0 items-center text-muse">
                    <MockyLoader size={52} />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-body-sm text-ink-muted">{briefSummary}</span>
                <Icon
                  name="chevronDown"
                  size={16}
                  className={`text-ink-faint transition-transform ${briefOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {briefOpen && (
                <div className="mt-2 text-body-sm">
                  <MusePanel
                    config={museConfig}
                    onChange={updateMuse}
                    available={museAvail}
                    result={museResult}
                    images={museImages}
                    stage={museStage}
                    busy={busy}
                    onOpenLibrary={() => {
                      // Back to images. `libraryTab` is sticky so that "see it
                      // in Media" can land on the cut; leaving it there would
                      // make the ordinary Media button open on Motion ever after.
                      setLibraryTab('images')
                      setShowLibrary(true)
                    }}
                    pinned={pinnedImages}
                    onUnpin={(hash) => setPinnedImages((arr) => arr.filter((p) => p.hash !== hash))}
                    imageError={museImageError}
                    vision={museVision}
                    video={videoAvail}
                    motion={motionAvail}
                  />
                </div>
              )}
            </div>
          )}

          {/* Format preset — only relevant when creating a new screen */}
          {!editing && (
            <div className="mb-2 flex items-center gap-2">
              <span className="kicker">{t('project.format')}</span>
              <PresetPicker value={presetId} onChange={setPresetId} />
            </div>
          )}

          {/* Two rows, not one.
              The three toggles grew from two words to a sentence each, and on
              one line they squeezed the prompt field down to a few characters
              and the Generate button to an initial. The field is the point of
              this bar; it gets the width.

              They were also bare `.kicker` text: 11px, 16px tall, no padding at
              all — three of the smallest hit targets in the product, and a
              design-system violation besides, since caption 11px is for badges
              only. They are controls, so they take body-sm 13px and a real box.
              `text-body-sm` after `kicker` is not redundant: Tailwind emits
              utilities after components, so that is what actually overrides the
              `@apply text-caption` inside `.kicker` while the rest of the
              device — capitals, tracking, weight — stays.

              `tap-target` because these are hand-rolled `<button>`s and not the
              `Button` primitive, so the 44px touch floor in index.css does not
              reach them on its own. `-mx-2` pays back the `px-2` each toggle now
              carries, so the labels still line up with the Format row above
              instead of sitting 8px in. */}
          <div className="-mx-2 mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* One direction per project, and this is the only way to change it
                from the composer: tick it, and THIS prompt writes the design
                every following screen will follow. Hidden while editing — an
                edit reworks what a direction produced, and letting it rewrite
                that direction would reattribute every other screen in the
                project to a document written for a change to one of them.
                DESIGN.md itself is still reachable from the header and from a
                screen's context menu; what it is not any more is a thing the
                composer silently rewrote on every generation. */}
            {!editing && (
              <button
                type="button"
                onClick={() => setRedesign((v) => !v)}
                className={`kicker tap-target inline-flex min-h-8 shrink-0 items-center px-2 py-1.5 text-body-sm transition ${
                  redesign ? 'text-accent-ink hover:opacity-80' : 'text-ink-faint hover:text-ink-muted'
                }`}
                title={t(redesign ? 'project.redesignOnTitle' : 'project.redesignTitle')}
                aria-pressed={redesign}
              >
                {redesign ? '● ' : '○ '}
                {t('project.redesignChip')}
              </button>
            )}
            <button
              type="button"
              onClick={toggleMuse}
              className={`kicker tap-target inline-flex min-h-8 shrink-0 items-center gap-1 px-2 py-1.5 text-body-sm transition ${
                museConfig.enabled ? 'text-muse-ink hover:opacity-80' : 'text-ink-faint hover:text-ink-muted'
              }`}
              title={museHint ? t('project.museHint') : t('project.museToggle')}
              aria-pressed={museConfig.enabled}
            >
              <Icon name="sparkle" size={14} className={museHint ? 'muse-sweep-icon' : undefined} />
              <span className={museHint ? 'muse-sweep' : undefined}>{t('muse.title')}</span>
            </button>
            <button
              type="button"
              onClick={cycleAnimations}
              className={`kicker tap-target inline-flex min-h-8 shrink-0 items-center gap-1 px-2 py-1.5 text-body-sm transition ${
                animationMode === 'on'
                  ? 'text-accent-ink hover:opacity-80'
                  : animationMode === 'off'
                    ? 'text-ink-faint line-through hover:text-ink-muted'
                    : 'text-ink-faint hover:text-ink-muted'
              }`}
              title={t(ANIM_LABELS[animationMode].hint)}
            >
              <Icon name="play" size={14} />
              {t(ANIM_LABELS[animationMode].label)}
            </button>
          </div>

          <div className="flex items-end gap-2">
            {/* min-w-0: a textarea's automatic minimum size comes from `cols`
                (20 by default), which is wider than the room left beside the
                two buttons at 390px — so without this the row overflowed the
                composer instead of the field giving way. */}
            <textarea
              rows={1}
              className="input min-h-[40px] min-w-0 resize-none"
              placeholder={
                editing
                  ? t(
                      selectedScreens.length === 1 ? 'project.composerEdit_one' : 'project.composerEdit_other',
                      { count: selectedScreens.length },
                    )
                  : t('composer.placeholder')
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={onComposerKey}
            />
            <button
              type="button"
              className="btn-primary mb-0.5 flex shrink-0 items-center gap-2"
              onClick={generate}
              disabled={busy || !prompt.trim()}
            >
              {busy ? (
                <>
                  {/* MockyLoader porte deja role="status" + aria-label : le texte
                      visible est masque aux lecteurs d'ecran pour que l'etat ne
                      soit pas annonce deux fois.

                      64px de signature plus le libelle plus le bouton Arreter,
                      tous shrink-0, ne laissaient que ~74px au champ de saisie
                      sur un telephone : la barre annoncait ce qu'elle faisait au
                      prix de ce a quoi elle sert. Le mot passe a 32 et le
                      libelle disparait sous sm — le champ garde ~190px, et le
                      nom accessible du loader dit toujours l'etat. */}
                  <MockyLoader size={32} label={busyLabel} className="shrink-0" />
                  <span aria-hidden className="hidden sm:inline">
                    {busyLabel}
                  </span>
                </>
              ) : editing ? (
                t('composer.update', { count: selectedScreens.length })
              ) : (
                t('composer.generate')
              )}
            </button>
            {busy && (
              <button
                type="button"
                className="btn-ghost mb-0.5 shrink-0 px-3 py-2 text-body-sm"
                onClick={cancelGenerate}
                title={t('project.stopTitle')}
              >
                {t('composer.stop')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Target picker after drawing a hotspot */}
      {pendingLink && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-ink/60 p-4"
          onClick={() => setPendingLink(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-line bg-raised p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kicker mb-1 text-accent-ink">{t('project.linkKicker')}</div>
            <h3 className="mb-1 text-lead text-ink">
              {pendingLink.info.label
                ? t('project.linkElement', { label: pendingLink.info.label })
                : t('project.thisElement')}{' '}
              → {t('project.linkQuestion')}
            </h3>
            <p className="measure mb-3 text-body-sm text-ink-muted">{t('project.linkHelp')}</p>
            <div className="max-h-72 space-y-1 overflow-auto">
              {screens
                .filter((s) => s.id !== pendingLink.screenId)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addHotspot(pendingLink.screenId, s.id)}
                    className="block w-full truncate rounded-lg border border-line-soft px-3 py-2 text-left text-body text-ink transition hover:border-accent hover:bg-ink/5 hover:text-accent-ink"
                  >
                    {s.name}
                  </button>
                ))}
              {screens.filter((s) => s.id !== pendingLink.screenId).length === 0 && (
                <p className="text-body-sm text-ink-faint">{t('project.linkNoOther')}</p>
              )}
            </div>
            <button
              type="button"
              className="btn-ghost mt-3 w-full text-body-sm"
              onClick={() => setPendingLink(null)}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* No-code element editor (Modify mode) */}
      {pendingModify && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-ink/60 p-4"
          onClick={() => setPendingModify(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line bg-raised p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kicker mb-1 flex items-center gap-1.5 text-accent-ink">
              <Icon name="pencil" size={14} />
              {t('mode.modify')}
            </div>
            <h3 className="mb-1 text-lead text-ink">{t('project.element')}</h3>
            <div className="mb-3 text-body-sm text-ink-muted">
              <span>{t('project.selectedWord')} </span>
              <span className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-caption text-accent-ink">
                {pendingModify.info.tag ? `<${pendingModify.info.tag}>` : t('project.elementWord')}
              </span>
              {pendingModify.info.label && (
                <span className="ml-1">
                  “<span className="text-ink">{pendingModify.info.label}</span>”
                </span>
              )}
              {pendingModify.info.className && (
                <div
                  className="mt-1 truncate font-mono text-caption text-ink-faint"
                  title={pendingModify.info.className}
                >
                  .{pendingModify.info.className.split(' ').filter(Boolean).join(' .')}
                </div>
              )}
            </div>
            {/* Quick text edit — deterministic in-place swap when unambiguous */}
            {pendingModify.info.label && (
              <div className="mb-3">
                <label className="kicker mb-1 block">{t('project.text')}</label>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    className="input flex-1"
                    value={modifyLabelDraft}
                    onChange={(e) => setModifyLabelDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        applyTextChange(pendingModify.screenId, pendingModify.info, modifyLabelDraft)
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-primary shrink-0 text-body-sm"
                    disabled={busy || !modifyLabelDraft.trim() || modifyLabelDraft === pendingModify.info.label}
                    onClick={() => applyTextChange(pendingModify.screenId, pendingModify.info, modifyLabelDraft)}
                  >
                    {t('project.textUpdate')}
                  </button>
                </div>
              </div>
            )}

            {/* One-tap recolor */}
            <div className="mb-3">
              <label className="kicker mb-1 block">{t('project.recolor')}</label>

              {designColors.length > 0 && (
                <>
                  <div className="mb-1 text-caption text-ink-faint">{t('project.fromYourDesign')}</div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {designColors.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        disabled={busy}
                        aria-label={t('project.recolorToHex', { name: c.label, hex: c.hex })}
                        title={`${c.label} · ${c.hex}`}
                        onClick={() => applyModify(pendingModify.screenId, pendingModify.info, recolorChange(c.hex))}
                        className="h-7 w-7 rounded-full border border-line-soft shadow-sm transition hover:scale-110 disabled:opacity-40"
                        style={{ background: c.hex }}
                      />
                    ))}
                  </div>
                  <div className="mb-1 text-caption text-ink-faint">{t('project.basics')}</div>
                </>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                {MODIFY_SWATCHES.map((sw) => (
                  <button
                    key={sw.hex}
                    type="button"
                    disabled={busy}
                    aria-label={t('project.recolorTo', { name: t(sw.nameKey) })}
                    title={t(sw.nameKey)}
                    onClick={() => applyModify(pendingModify.screenId, pendingModify.info, recolorChange(sw.hex))}
                    className="h-7 w-7 rounded-full border border-line-soft shadow-sm transition hover:scale-110 disabled:opacity-40"
                    style={{ background: sw.hex }}
                  />
                ))}
                {/* Custom hex */}
                <span className="mx-0.5 h-5 w-px bg-line-soft" />
                <span
                  className="h-7 w-7 shrink-0 rounded-full border border-line-soft shadow-sm"
                  style={{ background: HEX_RE.test(modifyHex.trim()) ? modifyHex.trim() : 'transparent' }}
                />
                <input
                  className="input h-7 w-[74px] px-2 font-mono text-body-sm"
                  aria-label={t('project.customHex')}
                  placeholder="#hex"
                  value={modifyHex}
                  onChange={(e) => setModifyHex(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && HEX_RE.test(modifyHex.trim())) {
                      e.preventDefault()
                      applyModify(pendingModify.screenId, pendingModify.info, recolorChange(modifyHex.trim()))
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={busy || !HEX_RE.test(modifyHex.trim())}
                  title={t('project.applyHex')}
                  onClick={() => applyModify(pendingModify.screenId, pendingModify.info, recolorChange(modifyHex.trim()))}
                  className="rounded-md border border-line-soft px-2 py-1 text-body-sm text-ink transition hover:border-line disabled:opacity-40"
                >
                  {t('project.go')}
                </button>
              </div>
            </div>

            {/* Free-form change */}
            <label className="kicker mb-1 block">{t('project.orDescribe')}</label>
            <textarea
              rows={2}
              className="input min-h-[52px] resize-none"
              placeholder={t('project.modifyPlaceholder')}
              value={modifyText}
              onChange={(e) => setModifyText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  applyModify(pendingModify.screenId, pendingModify.info, modifyText)
                }
              }}
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <button type="button" className="btn-ghost text-body-sm" onClick={() => setPendingModify(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary text-body-sm"
                disabled={busy || !modifyText.trim()}
                onClick={() => applyModify(pendingModify.screenId, pendingModify.info, modifyText)}
              >
                {t('project.applyChange')}
              </button>
            </div>
            <p className="measure mt-2 text-caption text-ink-faint">{t('project.modifyNote')}</p>
          </div>
        </div>
      )}

      {proposals && (
        <ProposedLinks
          items={proposals.items}
          screens={screens}
          onApply={(accepted) => applyProposals(proposals.screenId, accepted)}
          onClose={() => setProposals(null)}
        />
      )}

      {demoStartId && (
        <DemoPlayer screens={screens} startId={demoStartId} onExit={() => setDemoStartId(null)} />
      )}

      {/* Per-screen context menu (right-click or ⋯) */}
      {menu &&
        (() => {
          const s = screens.find((x) => x.id === menu.screenId)
          if (!s) return null
          const close = () => setMenu(null)
          const isRef = project.referenceScreenId === s.id
          return (
            <>
              <div
                className="fixed inset-0 z-50"
                onClick={close}
                onContextMenu={(e) => {
                  e.preventDefault()
                  close()
                }}
              />
              <ContextMenuShell x={menu.x} y={menu.y}>
                <MenuItem icon="refresh" label={t('project.regenerate')} disabled={busy} onClick={() => { close(); regenerate(s.id) }} />
                <MenuItem icon="sparkle" label={t('project.polish')} disabled={busy} onClick={() => { close(); polishScreen(s.id) }} />
                <MenuItem
                  icon="pencil"
                  label={t('canvas.rename')}
                  onClick={() => {
                    close()
                    const n = window.prompt(t('project.screenNamePrompt'), s.name)
                    if (n && n.trim()) onUpdateScreen(s.id, { name: n.trim() })
                  }}
                />
                <MenuItem icon="copy" label={t('canvas.duplicate')} onClick={() => { close(); duplicateScreen(s) }} />
                <MenuItem icon="link" label={t('share.menu')} onClick={() => { close(); setShareScreenId(s.id) }} />
                <MenuItem icon="code" label={t('project.showCode')} onClick={() => { close(); setCodeScreen(s) }} />
                <MenuItem
                  icon="pin"
                  label={t(isRef ? 'project.unpinReference' : 'project.pinReference')}
                  onClick={() => { close(); onSetReference(isRef ? null : s.id) }}
                />
                <MenuItem icon="download" label={t('canvas.download')} onClick={() => { close(); downloadTsx(s) }} />
                {s.previousCode && (
                  <MenuItem icon="undo" label={t('common.revert')} onClick={() => { close(); onRevertScreen(s.id) }} />
                )}
                <MenuItem
                  icon="wand"
                  label={t(derivingDesignId === s.id ? 'project.deriveDesignBusy' : 'project.deriveDesign')}
                  onClick={() => { close(); deriveDesignFrom(s) }}
                />
                <MenuItem icon="image" label={t('project.editDesign')} onClick={() => { close(); onOpenDesign() }} />
                <MenuItem
                  icon="library"
                  label={t('project.changeImages')}
                  onClick={() => { close(); setImagesForScreen(s.id) }}
                />

                <div className="my-1 border-t border-line-soft" />
                <div className="kicker px-3 pb-1 pt-0.5 text-accent-ink">{t('project.displayFormat')}</div>
                <div className="flex gap-1 px-2 pb-1.5">
                  {([
                    ['mobile', 'project.formatMobile'],
                    ['tablet', 'project.formatTablet'],
                    ['desktop', 'project.formatDesktop'],
                    ['full', 'project.formatFull'],
                  ] as [ViewportFormat, string][]).map(([f, labelKey]) => (
                    <button
                      key={f}
                      type="button"
                      aria-label={
                        f === 'full' ? t('project.formatFullTitle') : t('project.formatOf', { name: t(labelKey) })
                      }
                      title={f === 'full' ? t('project.formatFullTitle') : t(labelKey)}
                      onClick={() => { close(); setFormat(s.id, f) }}
                      className="flex-1 rounded-md border border-line-soft py-1 text-caption font-medium transition hover:border-accent hover:text-accent-ink"
                    >
                      {t(labelKey)}
                    </button>
                  ))}
                </div>

                <div className="my-1 border-t border-line-soft" />
                <div className="kicker px-3 pb-1 pt-0.5 text-accent-ink">{t('project.addAnimations')}</div>
                <div className="flex gap-1 px-2 pb-1.5">
                  {ANIMATION_LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      disabled={busy || !s.code.trim()}
                      title={t('project.animTitle', { level: t(ANIMATION_LEVEL_KEYS[lvl]).toLowerCase() })}
                      onClick={() => { close(); addAnimations(s.id, lvl) }}
                      className="flex-1 rounded-md border border-line-soft py-1 text-caption font-medium transition hover:border-accent hover:text-accent-ink disabled:opacity-40"
                    >
                      {t(ANIMATION_LEVEL_KEYS[lvl])}
                    </button>
                  ))}
                </div>

                <div className="my-1 border-t border-line-soft" />
                {/* Whether this screen PLAYS its animations. Distinct from
                    "Ajouter des animations" just above, which rewrites the
                    code; this only decides whether what is already there runs.
                    Three visible choices rather than one cycling label: in a
                    menu, a single item that changes wording never shows what
                    the other states are, or which one you are on. */}
                <div className="kicker px-3 pb-1 pt-0.5 text-accent-ink">{t('project.playAnimations')}</div>
                <div className="flex gap-1 px-2 pb-1.5">
                  {(
                    [
                      [undefined, 'project.playAuto', 'project.playAutoTitle'],
                      [true, 'project.playOn', 'project.playOnTitle'],
                      [false, 'project.playOff', 'project.playOffTitle'],
                    ] as const
                  ).map(([value, labelKey, titleKey]) => (
                    <button
                      key={String(value)}
                      type="button"
                      title={t(titleKey)}
                      onClick={() => {
                        close()
                        onUpdateScreen(s.id, { animations: value })
                      }}
                      className={`flex-1 rounded-md border py-1 text-caption font-medium transition ${
                        s.animations === value
                          ? 'border-accent bg-ink text-surface'
                          : 'border-line-soft hover:border-accent hover:text-accent-ink'
                      }`}
                    >
                      {t(labelKey)}
                    </button>
                  ))}
                </div>

                <div className="my-1 border-t border-line-soft" />
                <MenuItem
                  icon="trash"
                  label={t('canvas.delete')}
                  danger
                  onClick={() => {
                    close()
                    if (confirm(t('project.deleteScreenConfirm'))) {
                      onRemoveScreen(s.id)
                      setSelectedIds((ids) => ids.filter((i) => i !== s.id))
                    }
                  }}
                />
              </ContextMenuShell>
            </>
          )
        })()}

      {/* Code viewer modal */}
      {/* The recorded design, full size. At canvas zoom the card beside a frame
          is a postage stamp; this is where you actually judge it — and decide
          whether it is worth keeping under a name. */}
      {inspectDesignId &&
        (() => {
          const sc = screens.find((x) => x.id === inspectDesignId)
          const md = sc?.design?.trim()
          if (!sc || !md) return null
          // Wide, because this window is a document rather than a dialog. At
          // `lg` (768px) six sections in two columns produced ribbons of text
          // four words across and a page that scrolled forever; the Forbidden
          // list alone runs to twenty-odd entries.
          return (
            <Modal title={sc.name || 'DESIGN.md'} size="full" onClose={() => setInspectDesignId(null)}>
              {/* The document, read as a specification rather than glanced at
                  as a thumbnail. The canvas card keeps the thumbnail — it is
                  128px wide at the default zoom and a six-section sheet would
                  be illegible there — and this window, which that card already
                  opens on click, is where the document is actually judged.

                  The modal HEADER keeps the screen's name: "the design recorded
                  for this screen" is what this window is about. The wordmark
                  inside the sheet is a different claim — what the product is
                  called — so it must not be the sentence someone typed to get
                  one screen of it. */}
              <DesignSpecSheet
                markdown={md}
                title={
                  extractProductName(md) ||
                  project.productName ||
                  (/^#\s*Design Dossier/im.test(md) ? t('muse.dossier') : 'DESIGN.md')
                }
                density="full"
                columns={3}
                saveLabel={t('design.spec.saveAndApply')}
                // Saving does BOTH, and the label says so.
                //
                // Writing only to `screen.design` would be the tidy answer —
                // that field is the record of what this screen was generated
                // from — but it would also be a button that appears to do
                // nothing: the next generation reads the project's direction,
                // not a screen's record, so an edit saved there would sit
                // unused until someone found "Reprendre ce design". Editing a
                // design system is something you do in order to use it.
                onSave={(next: string) => {
                  onUpdateScreen(sc.id, { design: next })
                  onSetDesign(next)
                  setInspectDesignId(null)
                }}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => { applyScreenDesign(sc.id); setInspectDesignId(null) }}>
                  <Icon name="check" size={16} />
                  {t('canvas.applyDesign')}
                </Button>
                <Button variant="ghost" onClick={() => { setSaveDesignFrom(sc); setInspectDesignId(null) }}>
                  <Icon name="plus" size={16} />
                  {t('design.saveAs')}
                </Button>
              </div>
              {/* The document itself, because a palette is not a design system
                  and the difference is in the words. */}
              <pre className="mt-4 max-h-72 overflow-auto border border-line-soft bg-ink/5 p-3 text-body-sm text-ink-muted">
                {md}
              </pre>
            </Modal>
          )
        })()}

      {saveDesignFrom && (
        <SaveDesignDialog
          markdown={saveDesignFrom.design || ''}
          suggestedName={saveDesignFrom.name}
          origin={/^#\s*Design Dossier/im.test(saveDesignFrom.design || '') ? 'muse' : 'screen'}
          onClose={() => setSaveDesignFrom(null)}
          onSaved={() => setSaveDesignFrom(null)}
        />
      )}

      {/* Resolved by id, like the code viewer: a screen deleted while the
          dialog is open closes it rather than leaving a ghost. */}
      {shareScreenId &&
        (() => {
          const sc = screens.find((x) => x.id === shareScreenId)
          if (!sc) return null
          return <ShareDialog screen={sc} onClose={() => setShareScreenId(null)} />
        })()}

      {codeScreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          onClick={() => setCodeScreen(null)}
        >
          <div
            className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="min-w-0">
                <span className="kicker block text-accent-ink">{t('project.codeKicker')}</span>
                <span className="block truncate text-body text-ink">{codeScreen.name}</span>
              </span>
              <IconButton label={t('project.closeCode')} variant="quiet" onClick={() => setCodeScreen(null)}>
                <Icon name="close" size={18} />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1">
              <CodeView code={codeScreen.code} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The screen context menu's frame: as wide as its longest item, and always on
 * screen.
 *
 * It was a fixed `w-60` (240px) with `truncate` on every label, so the longer
 * entries — "Voir la demande qui a créé cet écran", "Faire de cet écran mon
 * DESIGN.md" — were cut off mid-word and you had to guess what they did. The
 * width now follows the content between a floor and a ceiling.
 *
 * The position used to be clamped against two hard-coded numbers (250 and 400)
 * that matched neither the real width nor the real height, so the menu could
 * still open partly off the bottom of the window. It is measured after mount
 * instead — the only way to know, since the height depends on which items the
 * screen actually offers.
 */
function ContextMenuShell({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  /** Which way it grew, so the animation grows the same way. */
  const [flipped, setFlipped] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const M = 8 // keep a hair of breathing room against the window edge
    // Flip above the pointer when there is more room there than below — what a
    // menu near the bottom edge is expected to do.
    const goesUp = y + height + M > window.innerHeight && y - height - M > 0
    setFlipped(goesUp)
    setPos({
      left: Math.max(M, Math.min(x, window.innerWidth - width - M)),
      top: goesUp ? Math.max(M, y - height) : Math.max(M, Math.min(y, window.innerHeight - height - M)),
    })
  }, [x, y])

  return (
    <div
      ref={ref}
      className="menu-in fixed z-50 w-max min-w-[15rem] max-w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-lg border border-line bg-raised py-1 text-body text-ink shadow-2xl"
      style={{
        left: pos.left,
        top: pos.top,
        // Grow from the corner nearest the cursor. A menu that opened upward
        // but animated downward would point away from the click that summoned
        // it, which reads worse than no animation.
        transformOrigin: flipped ? 'bottom left' : 'top left',
      }}
    >
      {children}
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: IconName
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition disabled:opacity-40 ${
        danger ? 'text-danger hover:bg-danger/10' : 'hover:bg-ink/5'
      }`}
    >
      {/* shrink-0 so a long label never squeezes the icon into a sliver. */}
      <Icon name={icon} size={16} className="shrink-0" />
      {/* No `truncate`: the frame now sizes to the content, so cutting the
          label was hiding text that had room to be read. */}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  )
}
