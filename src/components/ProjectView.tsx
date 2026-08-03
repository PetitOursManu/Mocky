import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { loadSettings } from '../lib/settings'
import { buildDesignPreamble, isDesignActive, loadDesign, saveDesign, extractDesignColors } from '../lib/design'
import { editComponent, fixComponent, generateComponent, detectComponentName, buildLayoutReference, buildAnimationInstruction, ANIMATION_LEVELS, buildElementEditInstruction, tryDirectTextReplace, deriveDesignSystem, type AnimationLevel } from '../lib/generate'
import { deriveName, deriveProjectName, DEFAULT_PROJECT_NAME, newId, type Hotspot, type Project, type Screen, autoFlow } from '../lib/project'
import { DEFAULT_PRESET_ID, getPreset, hintForDevice } from '../lib/presets'
import { captureRegion } from '../lib/capture'
import { cancelThumbs, queueThumbs } from '../lib/thumbnails'
import { selectCapabilities, resolveCapabilities } from '../lib/capabilities/select'
import { planScreen, planToPromptSection } from '../lib/plan'
import { downloadZip, downloadTsx } from '../lib/export'
import type { StackTarget } from '../lib/export/project'
import { replaceTokenHex, type DesignToken } from '../lib/designTokens'
import Welcome from './Welcome'
import Canvas from './Canvas'
import DesignSystemPanel from './DesignSystemPanel'
import PresetPicker from './PresetPicker'
import DemoPlayer from './DemoPlayer'
import CodeView from './CodeView'
import ShareDialog from './ShareDialog'
import { SaveDesignDialog, previewFromMarkdown } from './DesignLibrary'
import { ScaledMockup } from './DesignMockup'
import { type PickInfo } from './Preview'
import MusePanel from './MusePanel'
import Bibliotheque from './Bibliotheque'
import ImageLightbox from './ImageLightbox'
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
  type MuseResult,
  type MuseImageMode,
  type GeneratedSlotImage,
  type GeneratedVideo,
  type MuseVideoAvailability,
} from '../lib/muse'
import { imageUrl, listLibrary, type LibraryImage, type PinnedImage } from '../lib/imageLibrary'
import { videoBase, videoPosterUrl, type PinnedVideo } from '../lib/videoLibrary'
import { matchImagesToScreens } from '../lib/imageBackfill'
import {
  applyAnimationMode,
  loadAnimationMode,
  nextAnimationMode,
  saveAnimationMode,
  type AnimationMode,
} from '../lib/animations'
import { lintSlop } from '../lib/lint'
import { useT } from '../i18n'
import { Button, Icon, IconButton, MockyLoader, Modal, type IconName } from '../ui'

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
}) {
  const t = useT()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<'planning' | 'generating' | 'muse' | null>(null)
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
  /** Image opened full size (from the canvas card or the library grid). */
  const [lightboxHash, setLightboxHash] = useState<string | null>(null)
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
  const [linkMode, setLinkMode] = useState(false)
  const [modifyMode, setModifyMode] = useState(false)
  const [showSystem, setShowSystem] = useState(false)
  const [pendingModify, setPendingModify] = useState<{ screenId: string; info: PickInfo } | null>(null)
  const [modifyText, setModifyText] = useState('')
  const [modifyLabelDraft, setModifyLabelDraft] = useState('')
  const [modifyHex, setModifyHex] = useState('')
  const [interactAll, setInteractAll] = useState(false)
  const [showFrame, setShowFrame] = useState(() => localStorage.getItem(FRAME_PREF_KEY) !== '0')
  const [pendingLink, setPendingLink] = useState<{ screenId: string; info: PickInfo } | null>(null)
  /**
   * The open demo, if any: where it starts, and — when the user asked to be
   * walked through rather than to click their own hotspots — the ordered flow.
   * One piece of state because the player is mounted on its truthiness.
   */
  const [demo, setDemo] = useState<{ startId: string; flow?: string[] } | null>(null)
  const [exportMenu, setExportMenu] = useState(false)
  const [menu, setMenu] = useState<{ screenId: string; x: number; y: number } | null>(null)
  // An id, not the object. Holding the Screen froze whatever it contained at
  // click time: a regeneration or an auto-repair behind the open viewer left it
  // showing — and offering to copy — source the screen no longer had. Resolving
  // by id also closes the viewer by itself if the screen is deleted meanwhile.
  const [codeScreenId, setCodeScreenId] = useState<string | null>(null)
  const codeScreen = codeScreenId ? (project.screens.find((s) => s.id === codeScreenId) ?? null) : null
  const setCodeScreen = (s: Screen | null) => setCodeScreenId(s ? s.id : null)
  const contentHeights = useRef<Record<string, number>>({})

  // Esc closes the context menu / code viewer.
  useEffect(() => {
    if (!menu && !codeScreen && !pendingModify) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null)
        setCodeScreen(null)
        setPendingModify(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu, codeScreen, pendingModify])

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
  const [regenLabel, setRegenLabel] = useState(() => t('canvas.regenerating'))

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

  // Re-read DESIGN.md whenever we change it in-view (D.1 quick-style apply),
  // and whenever the overlay that edits it closes — ProjectView now stays
  // mounted underneath it, so nothing else would tell it the file has changed.
  const [designVersion, setDesignVersion] = useState(0)
  const design = useMemo(() => loadDesign(), [designVersion, designNonce])
  const designActive = isDesignActive(design)
  const designColors = designActive ? extractDesignColors(design.markdown).slice(0, 10) : []

  /** Apply a starter style's DESIGN.md from the Welcome quick-picker (D.1). */
  function applyStyleMarkdown(markdown: string) {
    saveDesign({ ...loadDesign(), markdown, enabled: true })
    setDesignVersion((v) => v + 1)
  }

  /** Recolor one token in the DESIGN.md from the Design-system frame (D.2). */
  function recolorToken(token: DesignToken, newHex: string) {
    const d = loadDesign()
    saveDesign({ ...d, markdown: replaceTokenHex(d.markdown, token, newHex), enabled: true })
    setDesignVersion((v) => v + 1)
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
    const before = loadDesign()
    if (before.markdown.trim() === md) return // already current — say nothing, do nothing
    if (before.markdown.trim() && !confirm(t('project.applyDesignConfirm', { name: sc.name }))) return
    saveDesign({ ...before, markdown: md, enabled: true, previousMarkdown: before.markdown || undefined })
    setDesignVersion((v) => v + 1)
  }

  /**
   * Write DESIGN.md from a screen the user points at.
   *
   * The document had to exist BEFORE there was anything to describe, which is
   * the wrong way round for how people actually work: they generate a few
   * screens, like one, and want the others to match it. Same document, written
   * afterwards and from evidence.
   *
   * It overwrites, so a non-empty file is confirmed first and the previous text
   * is kept in `previousMarkdown` — the derivation is a model call, and a model
   * call is exactly the kind of thing you want to be able to take back.
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
    const before = loadDesign()
    if (before.markdown.trim() && !confirm(t('project.deriveDesignConfirm', { name: screen.name }))) return

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
      saveDesign({
        ...loadDesign(),
        markdown,
        enabled: true,
        previousMarkdown: before.markdown || undefined,
      })
      setDesignVersion((v) => v + 1)
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
    // Never while a demo is on screen, and abandon anything already running:
    // a capture in flight keeps the thread for as long as it takes, and the demo
    // iframe's own render watchdog is armed the moment it mounts. Whichever
    // finishes first, the timer was armed earlier, so it wins — and a screen
    // that rendered perfectly accuses itself of a timeout.
    if (demo) {
      cancelThumbs()
      return
    }
    const timer = window.setTimeout(() => queueThumbs(screens), 1200)
    return () => window.clearTimeout(timer)
  }, [screens, busy, demo])
  const selectedScreens = screens.filter((s) => selectedIds.includes(s.id))

  // Revert a screen to its previousCode (saved before the last edit).
  function onRevertScreen(screenId: string) {
    const screen = screens.find((s) => s.id === screenId)
    if (!screen || !screen.previousCode) return
    // Swap: current code becomes the new previousCode, old code becomes current
    onUpdateScreen(screenId, {
      code: screen.previousCode,
      previousCode: undefined,
      componentName: detectComponentName(screen.previousCode),
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
    retryRefs.current = {} // reset retry counters for new generation
    /** The screen this run created, if any — so a failure can clean it up. */
    let newScreenId: string | null = null
    try {
      const design = loadDesign()
      const designPreamble = isDesignActive(design) ? buildDesignPreamble(design.markdown) : undefined
      const designMd = isDesignActive(design) ? design.markdown : undefined

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
            onUpdateScreen(sc.id, { code: res.code, componentName: res.componentName, previousCode: oldCode, caps: capIds })
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
        // Pinned reference screen → reproduce its shared nav/layout in the new
        // screen (skip if the reference is somehow the empty/only screen).
        const refScreen = project.referenceScreenId
          ? screens.find((s) => s.id === project.referenceScreenId)
          : undefined
        const referencePreamble =
          refScreen && refScreen.code.trim() ? buildLayoutReference(refScreen.code) : undefined

        // --- Muse: build a Design Dossier + hero image and use it as the
        // design authority for this screen. This supersedes DESIGN.md. Muse must
        // never block generation (M3), and when OFF the path below is byte-
        // identical to pre-Muse Mocky (M1).
        let musePreamble: string | undefined
        let museMarkdown: string | undefined
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
            museMarkdown = res.markdown
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

            musePreamble = buildMusePreamble(res.markdown, imgs, effectiveImageMode, res.dossier, museVideo)
          } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') throw err
            // Degrade: continue without Muse rather than fail the generation.
            setMuseStage(null)
          }
        }

        // Muse dossier supersedes DESIGN.md when present; otherwise the exact
        // pre-Muse composition (M1).
        const extraSystem = musePreamble
          ? joinSystem([musePreamble, referencePreamble, preset.hint])
          : joinSystem([designPreamble, referencePreamble, preset.hint])

        // Deterministic shortlist first — this is the guaranteed fallback.
        const shortlist = selectCapabilities(text, museMarkdown || designMd)
        // Optional planner pass. It runs first (so its capability choice and
        // structure guide generation), but can NEVER block: on failure/timeout
        // it returns null and we use the shortlist unchanged. Skipped when Muse
        // ran — the dossier already provides the structure.
        let capIds = shortlist
        let planSection: string | undefined
        if (settings.usePlanner && !musePreamble) {
          setPhase('planning')
          const plan = await planScreen(
            settings, text, shortlist,
            { design: designMd, presetHint: preset.hint },
            ac.signal,
          )
          if (plan) {
            capIds = plan.capabilities
            planSection = planToPromptSection(plan)
          }
        }
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
          // Whatever was ACTUALLY authoritative for this screen.
          //
          // Muse does not merge with DESIGN.md, it replaces it — the choice is a
          // ternary at the extraSystem line below, not a concatenation. So on a
          // Muse run the model never sees DESIGN.md at all, and recording it
          // here labelled the screen with a document that had no hand in it.
          //
          // The dossier is already rendered as DESIGN.md-shaped markdown by
          // dossierToMarkdown() on the server — same `- Label: #hex` lines, a
          // strict superset of the sections — so it drops straight in and the
          // swatches parse from it unchanged.
          design: museMarkdown || designMd,
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
      setMuseStage(null)
      setGeneratingIds(new Set())
    }
    // animationMode, museVision and videoAvail are read in the body and belong
    // here. Without them the closure was only rebuilt when something else in the
    // list changed — so clicking "No animation" after typing the prompt left the
    // stale 'auto' in the captured closure, and the button did nothing the
    // generation could see.
  }, [prompt, screens, selectedIds, presetId, annotations, onAddScreen, onUpdateScreen, onRemoveScreen, onRenameProject, museConfig, museAvail, project, pinnedImages, t, animationMode, museVision, videoAvail])

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
    if (!screens.length) {
      setError(t('project.exportEmpty'))
      return
    }
    const design = loadDesign()
    const md = isDesignActive(design) ? design.markdown : undefined
    try {
      await downloadZip(screens, { stack, designMarkdown: md, projectName: project.name })
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
      const design = loadDesign()
      const designMd = isDesignActive(design) ? design.markdown : undefined
      const designPreamble = designMd ? buildDesignPreamble(designMd) : undefined
      const refScreen =
        project.referenceScreenId && project.referenceScreenId !== screenId
          ? screens.find((s) => s.id === project.referenceScreenId)
          : undefined
      const referencePreamble = refScreen && refScreen.code.trim() ? buildLayoutReference(refScreen.code) : undefined
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
      onUpdateScreen(screenId, { code: result.code, componentName: result.componentName, previousCode: oldCode, caps: capIds, design: designMd })
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
      const design = loadDesign()
      const designMd = isDesignActive(design) ? design.markdown : undefined
      const designPreamble = designMd ? buildDesignPreamble(designMd) : undefined
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
      onUpdateScreen(screenId, { code: res.code, componentName: res.componentName, previousCode: oldCode, caps: capIds })
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
      const design = loadDesign()
      const designMd = isDesignActive(design) ? design.markdown : undefined
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
      onUpdateScreen(screenId, { code: res.code, componentName: res.componentName, previousCode: oldCode, caps: capIds })
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
   * Change only the visible text of the picked element (Lot C.2). Tries a
   * deterministic in-place swap first (instant, free, no model) and falls back
   * to a targeted LLM edit when the text isn't a unique verbatim match.
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
    phase === 'muse' ? 'project.busyMuse' : phase === 'planning' ? 'project.busyPlanning' : 'composer.generating',
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
        designActive={designActive}
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
        onOpenLibrary={() => setShowLibrary(true)}
        pinned={pinnedImages}
        onUnpin={(hash) => setPinnedImages((arr) => arr.filter((p) => p.hash !== hash))}
        museImageError={museImageError}
        museVision={museVision}
        museVideo={videoAvail}
        animationMode={animationMode}
        onCycleAnimations={cycleAnimations}
      />
      {libraryModal}
      </>
    )
  }

  return (
    <div className="relative h-[calc(100vh-57px)]">
      {libraryModal}
      <Canvas
        screens={screens}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onMoveScreens={(updates) => updates.forEach((u) => onUpdateScreen(u.id, { x: u.x, y: u.y }))}
        onResizeScreen={(id, box) => onUpdateScreen(id, box)}
        onRenameScreen={(id, name) => onUpdateScreen(id, { name })}
        onOpenImage={setLightboxHash}
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
        onCaptureRect={onCaptureRect}
        onError={onScreenError}
        generatingIds={generatingIds}
        regeneratingIds={regeneratingIds}
        fixingIds={fixingIds}
        regenLabel={regenLabel}
      />

      {/* Live Design-system frame (D.2) */}
      {showSystem && (
        <DesignSystemPanel
          markdown={design.markdown}
          onRecolor={recolorToken}
          onClose={() => setShowSystem(false)}
          onEdit={onOpenDesign}
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
              onClick={() => setLinkMode(false)}
              title={t('project.closeLinkMode')}
            >
              {t('project.done')}
            </button>
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

      {/* Top-left toolbar */}
      <div className="absolute left-4 top-3 flex items-center gap-1 rounded-lg border border-line bg-surface p-1 shadow-lg">
        <Button variant="toolbar" size="sm" onClick={onBack} title={t('error.backToProjects')}>
          <Icon name="chevronLeft" size={16} />
          {t('project.back')}
        </Button>
        <div className="mx-1 h-5 w-px bg-line-soft" />
        <Button
          variant="toolbar"
          size="sm"
          active={linkMode}
          onClick={() => {
            setLinkMode((v) => !v)
            setModifyMode(false)
            setAnnotateMode(false)
          }}
          title={t('project.linkTitle')}
        >
          <Icon name="link" size={16} />
          {t('mode.link')}
        </Button>
        <Button
          variant="toolbar"
          size="sm"
          active={modifyMode}
          onClick={() => {
            setModifyMode((v) => !v)
            setLinkMode(false)
            setAnnotateMode(false)
            setPendingModify(null)
          }}
          title={t('project.modifyTitle')}
        >
          <Icon name="pencil" size={16} />
          {t('mode.modify')}
        </Button>
        <Button
          variant="toolbar"
          size="sm"
          active={interactAll}
          onClick={() => setInteractAll((v) => !v)}
          title={t('project.interactTitle')}
        >
          <Icon name="hand" size={16} />
          {t('mode.interact')}
        </Button>
        <Button
          variant="toolbar"
          size="sm"
          active={annotateMode}
          onClick={() => {
            setAnnotateMode((v) => !v)
            setLinkMode(false)
            setModifyMode(false)
            setPendingModify(null)
          }}
          title={t('project.annotateTitle')}
        >
          <Icon name="crop" size={16} />
          {t('mode.annotate')}
        </Button>
        <Button
          variant="toolbar"
          size="sm"
          active={showFrame}
          onClick={toggleFrame}
          title={t('project.frameTitle')}
        >
          <Icon name="phone" size={16} />
          {t('mode.frame')}
        </Button>
        <Button
          variant="toolbar"
          size="sm"
          active={showSystem}
          onClick={() => setShowSystem((v) => !v)}
          title={t('project.systemTitle')}
        >
          <Icon name="image" size={16} />
          {t('mode.system')}
        </Button>
        <div className="mx-1 h-5 w-px bg-line-soft" />
        {/* Two ways to play. The left one follows the hotspots the user wired;
            the right one walks the screens in order and needs nothing wired at
            all, which is the whole point — demo mode used to be useless until
            you had linked everything by hand. */}
        <Button
          variant="toolbar"
          size="sm"
          onClick={() => {
            const start = selectedScreens[0]?.id ?? screens[0]?.id
            if (start) setDemo({ startId: start })
          }}
          title={t('project.demoTitle')}
        >
          <Icon name="play" size={14} />
          {t('mode.demo')}
        </Button>
        <Button
          variant="toolbar"
          size="sm"
          onClick={() => {
            const order = autoFlow(screens, selectedScreens[0]?.id)
            if (order.length > 0) setDemo({ startId: order[0], flow: order })
          }}
          title={t('project.demoFlowTitle')}
        >
          <Icon name="grid" size={14} />
          {t('project.demoFlow')}
        </Button>
        <div className="relative">
          <Button
            variant="toolbar"
            size="sm"
            active={exportMenu}
            onClick={() => setExportMenu((v) => !v)}
            title={t('project.exportTitle')}
          >
            <Icon name="download" size={16} />
            {t('mode.export')}
          </Button>
          {exportMenu && (
            <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-line bg-raised p-1 shadow-xl">
              <div className="kicker px-2 py-1 text-accent-ink">{t('project.exportHeading')}</div>
              {([
                ['shadcn', 'project.exportShadcn', 'project.exportShadcnHint'],
                ['plain', 'project.exportPlain', 'project.exportPlainHint'],
                ['daisyui', 'project.exportDaisy', 'project.exportDaisyHint'],
              ] as [StackTarget, string, string][]).map(([stack, labelKey, hintKey]) => (
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
          )}
        </div>
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
                  <button
                    type="button"
                    onClick={() => setAnnotations((arr) => arr.filter((x) => x.id !== a.id))}
                    className="absolute right-0 top-0 rounded-bl bg-ink/60 p-0.5 text-surface opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
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
                    onOpenLibrary={() => setShowLibrary(true)}
                    pinned={pinnedImages}
                    onUnpin={(hash) => setPinnedImages((arr) => arr.filter((p) => p.hash !== hash))}
                    imageError={museImageError}
                    vision={museVision}
                    video={videoAvail}
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
              this bar; it gets the width. */}
          <div className="mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              type="button"
              onClick={onOpenDesign}
              className={`kicker shrink-0 transition ${
                designActive ? 'text-accent-ink hover:opacity-80' : 'text-ink-faint hover:text-ink-muted'
              }`}
              title={t('project.designTitle')}
            >
              {designActive ? '● ' : '○ '}
              {t('project.designChip')}
            </button>
            <button
              type="button"
              onClick={toggleMuse}
              className={`kicker flex shrink-0 items-center gap-1 transition ${
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
              className={`kicker flex shrink-0 items-center gap-1 transition ${
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
            <textarea
              rows={1}
              className="input min-h-[40px] resize-none"
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
                      soit pas annonce deux fois. */}
                  <MockyLoader size={64} label={busyLabel} className="shrink-0" />
                  <span aria-hidden>{busyLabel}</span>
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

      {demo && (
        <DemoPlayer
          screens={screens}
          startId={demo.startId}
          flow={demo.flow}
          animations={animationMode !== 'off'}
          onExit={() => setDemo(null)}
        />
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
          const preview = previewFromMarkdown(md)
          return (
            <Modal title={sc.name || 'DESIGN.md'} size="lg" onClose={() => setInspectDesignId(null)}>
              {preview && (
                <div className="overflow-hidden border border-line-soft">
                  <ScaledMockup p={preview} name={sc.name || 'DESIGN.md'} />
                </div>
              )}
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
