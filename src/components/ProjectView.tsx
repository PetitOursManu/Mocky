import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadSettings } from '../lib/settings'
import { buildDesignPreamble, isDesignActive, loadDesign, saveDesign, extractDesignColors } from '../lib/design'
import { editComponent, fixComponent, generateComponent, detectComponentName, buildLayoutReference, buildAnimationInstruction, ANIMATION_LEVELS, ANIMATION_LEVEL_LABELS, buildElementEditInstruction, tryDirectTextReplace, type AnimationLevel } from '../lib/generate'
import { deriveName, newId, type Hotspot, type Project, type Screen } from '../lib/project'
import { DEFAULT_PRESET_ID, getPreset, hintForDevice } from '../lib/presets'
import { captureRegion } from '../lib/capture'
import { selectCapabilities, resolveCapabilities } from '../lib/capabilities/select'
import { planScreen, planToPromptSection } from '../lib/plan'
import { downloadZip, downloadTsx } from '../lib/export'
import type { StackTarget } from '../lib/export/project'
import Welcome from './Welcome'
import Canvas from './Canvas'
import PresetPicker from './PresetPicker'
import DemoPlayer from './DemoPlayer'
import CodeView from './CodeView'
import { type PickInfo } from './Preview'

/** Fixed viewport formats offered in the screen context menu. */
type ViewportFormat = 'mobile' | 'tablet' | 'desktop' | 'full'
const VIEWPORTS: Record<Exclude<ViewportFormat, 'full'>, { w: number; h: number; device: 'iphone' | 'none' }> = {
  mobile: { w: 390, h: 844, device: 'iphone' },
  tablet: { w: 768, h: 1024, device: 'none' },
  desktop: { w: 1280, h: 1024, device: 'none' },
}

const FRAME_PREF_KEY = 'mocky.showFrame'

/** One-tap recolor swatches offered in the no-code Modify panel (Lot C.2). */
const MODIFY_SWATCHES: { name: string; hex: string }[] = [
  { name: 'Ink', hex: '#0f172a' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Green', hex: '#10b981' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Fuchsia', hex: '#d946ef' },
]

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

const EXAMPLES = [
  'A SaaS pricing page with three tiers and a monthly/yearly toggle',
  'A mobile login screen with email, password and social sign-in',
  'An analytics dashboard with stat cards, a chart and an activity list',
]

export default function ProjectView({
  project,
  onAddScreen,
  onUpdateScreen,
  onRemoveScreen,
  onOpenSettings,
  onOpenDesign,
  onBack,
  onSetReference,
}: {
  project: Project
  onAddScreen: (screen: Omit<Screen, 'x' | 'y'>) => void
  onUpdateScreen: (screenId: string, patch: Partial<Screen>) => void
  onRemoveScreen: (screenId: string) => void
  onOpenSettings: () => void
  onOpenDesign: () => void
  onBack: () => void
  onSetReference: (screenId: string | null) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<'planning' | 'generating' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESET_ID)
  const [linkMode, setLinkMode] = useState(false)
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
  const [menu, setMenu] = useState<{ screenId: string; x: number; y: number } | null>(null)
  const [codeScreen, setCodeScreen] = useState<Screen | null>(null)
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
  const [highlightHotspot, setHighlightHotspot] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ screenId: string; nonce: number } | null>(null)
  const [annotateMode, setAnnotateMode] = useState(false)
  const [captureReq, setCaptureReq] = useState<
    { screenId: string; id: string; clientRect: { left: number; top: number; width: number; height: number } } | null
  >(null)
  const [capturing, setCapturing] = useState(false)
  const [annotations, setAnnotations] = useState<{ id: string; dataUrl: string }[]>([])
  const retryRefs = useRef<Record<string, { count: number; lastError: string }>>({})
  const retryAbortRef = useRef<AbortController | null>(null)
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set())
  // Screens being regenerated: unlike generatingIds, we DON'T stream partial
  // code into these — the existing iframe stays fully rendered until the new
  // code is ready, then swaps in one clean step (no blank/flicker).
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set())
  const [regenLabel, setRegenLabel] = useState('Regenerating…')

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
      setError('Screenshot failed — try again or a smaller area.')
    } finally {
      setCapturing(false)
    }
  }

  // Re-read DESIGN.md whenever we change it in-view (D.1 quick-style apply).
  const [designVersion, setDesignVersion] = useState(0)
  const design = useMemo(() => loadDesign(), [designVersion])
  const designActive = isDesignActive(design)
  const designColors = designActive ? extractDesignColors(design.markdown).slice(0, 10) : []

  /** Apply a starter style's DESIGN.md from the Welcome quick-picker (D.1). */
  function applyStyleMarkdown(markdown: string) {
    saveDesign({ ...loadDesign(), markdown, enabled: true })
    setDesignVersion((v) => v + 1)
  }
  const screens = project.screens
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
    retryAbortRef.current = ac
    try {
      const res = await fixComponent(settings, screen.code, errorMessage, ac.signal)
      onUpdateScreen(screenId, { code: res.code, componentName: res.componentName })
    } catch {
      // Retry failed — leave the error visible to the user.
    } finally {
      retryAbortRef.current = null
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
      setError('No model set. Open Settings and configure a model first.')
      return
    }
    const targets = screens.filter((s) => selectedIds.includes(s.id))
    const images = annotations.map((a) => a.dataUrl)
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(true)
    setError(null)
    retryRefs.current = {} // reset retry counters for new generation
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
        const ids = new Set(targets.map((t) => t.id))
        setGeneratingIds(ids)
        for (const sc of targets) {
          const extraSystem = joinSystem([designPreamble, hintForDevice(sc.device)])
          const capIds = sc.caps && sc.caps.length > 0 ? sc.caps : selectCapabilities(text, designMd)
          const caps = resolveCapabilities(capIds)
          // Snapshot the old code before overwriting
          const oldCode = sc.code
          const res = await editComponent(
            settings, text, sc.code, extraSystem, images, ac.signal,
            (partial) => onUpdateScreen(sc.id, { code: partial }),
            caps,
          )
          onUpdateScreen(sc.id, { code: res.code, componentName: res.componentName, previousCode: oldCode, caps: capIds })
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
        const extraSystem = joinSystem([designPreamble, referencePreamble, preset.hint])

        // Deterministic shortlist first — this is the guaranteed fallback.
        const shortlist = selectCapabilities(text, designMd)
        // Optional planner pass. It runs first (so its capability choice and
        // structure guide generation), but can NEVER block: on failure/timeout
        // it returns null and we use the shortlist unchanged.
        let capIds = shortlist
        let planSection: string | undefined
        if (settings.usePlanner) {
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
        setPhase('generating')
        const caps = resolveCapabilities(capIds)
        const screenId = newId()
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
        })
        setGeneratingIds(new Set([screenId]))
        setSelectedIds([screenId])
        setPrompt('')
        setAnnotations([])
        const result = await generateComponent(
          settings, text, extraSystem, images, ac.signal,
          (partial) => onUpdateScreen(screenId, { code: partial }),
          caps, planSection,
        )
        onUpdateScreen(screenId, { code: result.code, componentName: result.componentName })
        setGeneratingIds(new Set())
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      abortRef.current = null
      setBusy(false)
      setPhase(null)
      setGeneratingIds(new Set())
    }
  }, [prompt, screens, selectedIds, presetId, annotations, onAddScreen, onUpdateScreen])

  function cancelGenerate() {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
  }

  async function handleExport(stack: StackTarget) {
    setExportMenu(false)
    if (!screens.length) {
      setError('Add at least one screen before exporting.')
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
      setError('No model set. Open Settings and configure a model first.')
      return
    }
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(true)
    setError(null)
    // Keep the current iframe rendered — no streaming, no spinner overlay.
    setRegenLabel('Regenerating…')
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
      onUpdateScreen(screenId, { code: result.code, componentName: result.componentName, previousCode: oldCode, caps: capIds })
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
      setError('No model set. Open Settings and configure a model first.')
      return
    }
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(true)
    setError(null)
    // Keep the current render visible; generate fully, then swap once.
    setRegenLabel('Adding motion…')
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
      setError('No model set. Open Settings and configure a model first.')
      return
    }
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(true)
    setError(null)
    // Keep the current render visible; generate fully, then swap once (no
    // streaming, so half-written code never flashes a broken/error preview).
    setRegenLabel('Updating…')
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

  if (screens.length === 0) {
    return (
      <Welcome
        prompt={prompt}
        setPrompt={setPrompt}
        onGenerate={generate}
        busy={busy}
        error={error}
        designActive={designActive}
        examples={EXAMPLES}
        presetId={presetId}
        onPresetChange={setPresetId}
        onOpenSettings={onOpenSettings}
        onOpenDesign={onOpenDesign}
        onApplyStyle={applyStyleMarkdown}
      />
    )
  }

  return (
    <div className="relative h-[calc(100vh-57px)]">
      <Canvas
        screens={screens}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onMoveScreens={(updates) => updates.forEach((u) => onUpdateScreen(u.id, { x: u.x, y: u.y }))}
        onResizeScreen={(id, box) => onUpdateScreen(id, box)}
        onRenameScreen={(id, name) => onUpdateScreen(id, { name })}
        onDeleteScreen={(id) => {
          if (confirm('Delete this screen?')) {
            onRemoveScreen(id)
            setSelectedIds((ids) => ids.filter((i) => i !== id))
          }
        }}
        referenceScreenId={project.referenceScreenId}
        onScreenContextMenu={(id, x, y) => setMenu({ screenId: id, x, y })}
        onContentHeight={(id, h) => {
          contentHeights.current[id] = h
        }}
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
        regenLabel={regenLabel}
      />

      {/* Links panel (link mode) */}
      {linkMode && (
        <div className="absolute right-4 top-11 flex max-h-[70vh] w-72 flex-col rounded-xl border border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
            <span className="text-sm font-semibold text-slate-100">
              Links · {screens.reduce((a, s) => a + s.links.length, 0)}
            </span>
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-slate-200"
              onClick={() => setLinkMode(false)}
              title="Close link mode"
            >
              Done
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {screens.every((s) => s.links.length === 0) ? (
              <p className="p-3 text-center text-xs text-slate-500">
                No links yet. Click a button inside a screen to create one.
              </p>
            ) : (
              <ul className="space-y-1">
                {screens.flatMap((s) =>
                  s.links.map((h) => {
                    const target = screens.find((t) => t.id === h.target)
                    return (
                      <li
                        key={h.id}
                        onMouseEnter={() => setHighlightHotspot(h.id)}
                        onMouseLeave={() => setHighlightHotspot((cur) => (cur === h.id ? null : cur))}
                        className="group flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-2 py-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => setFocus({ screenId: s.id, nonce: Date.now() })}
                          className="min-w-0 flex-1 text-left"
                          title="Center the canvas on this link"
                        >
                          <div className="truncate text-xs text-slate-300">
                            {h.label ? <span className="text-indigo-300">"{h.label}"</span> : 'element'} →{' '}
                            <span className="text-slate-100">{target?.name ?? '(missing)'}</span>
                          </div>
                          <div className="truncate text-[10px] text-slate-500">on {s.name}</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeHotspot(s.id, h.id)}
                          className="shrink-0 rounded px-1 text-xs text-rose-300 hover:bg-rose-900/40"
                          title="Delete link"
                        >
                          ✕
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
      <div className="absolute left-4 top-3 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/90 p-1 shadow-lg">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-700/60"
          title="Back to projects"
        >
          ← Back
        </button>
        <div className="mx-1 h-5 w-px bg-slate-700" />
        <button
          type="button"
          onClick={() => {
            setLinkMode((v) => !v)
            setModifyMode(false)
            setAnnotateMode(false)
          }}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            linkMode ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-slate-700/60'
          }`}
          title="Draw links between screens"
        >
          🔗 Link
        </button>
        <button
          type="button"
          onClick={() => {
            setModifyMode((v) => !v)
            setLinkMode(false)
            setAnnotateMode(false)
            setPendingModify(null)
          }}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            modifyMode ? 'bg-fuchsia-500 text-white' : 'text-slate-300 hover:bg-slate-700/60'
          }`}
          title="Click an element in a screen, then describe a change — no code needed"
        >
          ✎ Modify
        </button>
        <button
          type="button"
          onClick={() => setInteractAll((v) => !v)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            interactAll ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:bg-slate-700/60'
          }`}
          title="Make all screens interactive (click buttons, animations)"
        >
          ▶ Interact
        </button>
        <button
          type="button"
          onClick={() => {
            setAnnotateMode((v) => !v)
            setLinkMode(false)
            setModifyMode(false)
            setPendingModify(null)
          }}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            annotateMode ? 'bg-amber-500 text-white' : 'text-slate-300 hover:bg-slate-700/60'
          }`}
          title="Snip a region of a screen into the chat as a numbered reference"
        >
          ✂ Annotate
        </button>
        <button
          type="button"
          onClick={toggleFrame}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            showFrame ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/60'
          }`}
          title="Show/hide the iPhone frame on mobile screens"
        >
          📱 Frame
        </button>
        <div className="mx-1 h-5 w-px bg-slate-700" />
        <button
          type="button"
          onClick={() => setDemoStartId(selectedScreens[0]?.id ?? screens[0]?.id ?? null)}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-700/60"
          title="Play the prototype"
        >
          ▶ Demo
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setExportMenu((v) => !v)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              exportMenu ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-slate-700/60'
            }`}
            title="Export a runnable Vite + React + Tailwind project"
          >
            ⬇ Export
          </button>
          {exportMenu && (
            <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-xl">
              <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500">Runnable project (.zip)</div>
              {([
                ['shadcn', 'shadcn-ready', 'Theme tokens from DESIGN.md; npx shadcn add works'],
                ['plain', 'Plain Tailwind', 'Tailwind + vendored UI components'],
                ['daisyui', 'daisyUI', 'Tailwind + the daisyUI plugin'],
              ] as [StackTarget, string, string][]).map(([stack, label, hint]) => (
                <button
                  key={stack}
                  type="button"
                  onClick={() => handleExport(stack)}
                  className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs text-slate-200 transition hover:bg-slate-700/60"
                >
                  <span className="font-medium">{label}</span>
                  <span className="block text-[10px] text-slate-500">{hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating composer */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900/95 p-2 shadow-2xl backdrop-blur">
          {error && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-rose-700/50 bg-rose-900/30 px-3 py-2 text-xs text-rose-200">
              <span className="truncate">{error}</span>
              <button type="button" className="btn-ghost shrink-0 px-2 py-1 text-xs" onClick={onOpenSettings}>
                Settings
              </button>
            </div>
          )}

          {/* Annotation thumbnails */}
          {(annotations.length > 0 || capturing) && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {annotations.map((a, i) => (
                <div
                  key={a.id}
                  className="group relative h-14 w-14 overflow-hidden rounded-lg border border-amber-400/60 bg-white"
                  title={`Reference [${i + 1}] — attached to the model`}
                >
                  <img src={a.dataUrl} alt={`ref ${i + 1}`} className="h-full w-full object-cover" />
                  <span className="absolute left-0 top-0 rounded-br bg-amber-500 px-1 text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAnnotations((arr) => arr.filter((x) => x.id !== a.id))}
                    className="absolute right-0 top-0 rounded-bl bg-black/60 px-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                    title="Remove reference"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {capturing && (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-amber-400/60">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-300/40 border-t-amber-400" />
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
                  className="flex max-w-[200px] items-center gap-1 rounded-md bg-indigo-500 py-0.5 pl-2 pr-1 text-xs font-medium text-white"
                >
                  <span className="truncate">▦ {s.name}</span>
                  <button
                    type="button"
                    className="rounded px-1 text-indigo-100 hover:bg-white/20 hover:text-white"
                    onClick={() => setSelectedIds((ids) => ids.filter((i) => i !== s.id))}
                    title="Remove from selection"
                  >
                    ✕
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="ml-1 text-xs font-medium text-slate-300 underline-offset-2 hover:text-slate-100 hover:underline"
                onClick={() => setSelectedIds([])}
              >
                clear
              </button>
            </div>
          )}

          {/* Format preset — only relevant when creating a new screen */}
          {!editing && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-slate-500">Format</span>
              <PresetPicker value={presetId} onChange={setPresetId} />
            </div>
          )}

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={onOpenDesign}
              className={`mb-1.5 shrink-0 text-xs transition ${
                designActive ? 'text-emerald-300 hover:text-emerald-200' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Manage DESIGN.md"
            >
              {designActive ? '● DESIGN' : '○ DESIGN'}
            </button>
            <textarea
              rows={1}
              className="input min-h-[40px] resize-none"
              placeholder={
                editing
                  ? `Describe a change to apply to ${selectedScreens.length} selected screen${
                      selectedScreens.length === 1 ? '' : 's'
                    }…`
                  : 'Describe another screen to add to this project…'
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
              {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {busy ? (phase === 'planning' ? 'Planning…' : 'Generating…') : editing ? `Update ${selectedScreens.length}` : 'Generate'}
            </button>
            {busy && (
              <button
                type="button"
                className="btn-ghost mb-0.5 shrink-0 px-3 py-2 text-xs"
                onClick={cancelGenerate}
                title="Cancel the in-flight generation"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Target picker after drawing a hotspot */}
      {pendingLink && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => setPendingLink(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-800 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-sm font-semibold text-slate-100">
              Link {pendingLink.info.label ? `"${pendingLink.info.label}"` : 'element'} → which screen?
            </h3>
            <p className="mb-3 text-xs text-slate-400">
              In demo mode, clicking this element opens the chosen screen.
            </p>
            <div className="max-h-72 space-y-1 overflow-auto">
              {screens
                .filter((s) => s.id !== pendingLink.screenId)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addHotspot(pendingLink.screenId, s.id)}
                    className="block w-full truncate rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-left text-sm text-slate-200 hover:border-indigo-500 hover:bg-slate-800"
                  >
                    {s.name}
                  </button>
                ))}
              {screens.filter((s) => s.id !== pendingLink.screenId).length === 0 && (
                <p className="text-xs text-slate-500">Add another screen first to link to it.</p>
              )}
            </div>
            <button
              type="button"
              className="btn-ghost mt-3 w-full text-xs"
              onClick={() => setPendingLink(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* No-code element editor (Modify mode) */}
      {pendingModify && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => setPendingModify(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-fuchsia-700/50 bg-slate-800 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <span className="text-fuchsia-400">✎</span> Modify element
            </h3>
            <div className="mb-3 text-xs text-slate-400">
              <span>Selected </span>
              <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-fuchsia-200">
                {pendingModify.info.tag ? `<${pendingModify.info.tag}>` : 'element'}
              </span>
              {pendingModify.info.label && (
                <span className="ml-1">
                  “<span className="text-slate-200">{pendingModify.info.label}</span>”
                </span>
              )}
              {pendingModify.info.className && (
                <div
                  className="mt-1 truncate font-mono text-[10px] text-slate-500"
                  title={pendingModify.info.className}
                >
                  .{pendingModify.info.className.split(' ').filter(Boolean).join(' .')}
                </div>
              )}
            </div>
            {/* Quick text edit — deterministic in-place swap when unambiguous */}
            {pendingModify.info.label && (
              <div className="mb-3">
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Text</label>
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
                    className="btn-primary shrink-0 text-xs"
                    disabled={busy || !modifyLabelDraft.trim() || modifyLabelDraft === pendingModify.info.label}
                    onClick={() => applyTextChange(pendingModify.screenId, pendingModify.info, modifyLabelDraft)}
                  >
                    Update
                  </button>
                </div>
              </div>
            )}

            {/* One-tap recolor */}
            <div className="mb-3">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Recolor</label>

              {designColors.length > 0 && (
                <>
                  <div className="mb-1 text-[9px] uppercase tracking-wide text-slate-600">From your design</div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {designColors.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        disabled={busy}
                        title={`${c.label} · ${c.hex}`}
                        onClick={() => applyModify(pendingModify.screenId, pendingModify.info, recolorChange(c.hex))}
                        className="h-7 w-7 rounded-full border border-white/20 shadow-sm transition hover:scale-110 disabled:opacity-40"
                        style={{ background: c.hex }}
                      />
                    ))}
                  </div>
                  <div className="mb-1 text-[9px] uppercase tracking-wide text-slate-600">Basics</div>
                </>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                {MODIFY_SWATCHES.map((sw) => (
                  <button
                    key={sw.hex}
                    type="button"
                    disabled={busy}
                    title={sw.name}
                    onClick={() => applyModify(pendingModify.screenId, pendingModify.info, recolorChange(sw.hex))}
                    className="h-7 w-7 rounded-full border border-white/20 shadow-sm transition hover:scale-110 disabled:opacity-40"
                    style={{ background: sw.hex }}
                  />
                ))}
                {/* Custom hex */}
                <span className="mx-0.5 h-5 w-px bg-slate-700" />
                <span
                  className="h-7 w-7 shrink-0 rounded-full border border-white/20 shadow-sm"
                  style={{ background: HEX_RE.test(modifyHex.trim()) ? modifyHex.trim() : 'transparent' }}
                />
                <input
                  className="input h-7 w-[74px] px-2 text-xs"
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
                  title="Apply this hex color"
                  onClick={() => applyModify(pendingModify.screenId, pendingModify.info, recolorChange(modifyHex.trim()))}
                  className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 transition hover:bg-slate-700/60 disabled:opacity-40"
                >
                  Go
                </button>
              </div>
            </div>

            {/* Free-form change */}
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Or describe any change</label>
            <textarea
              rows={2}
              className="input min-h-[52px] resize-none"
              placeholder='e.g. "make it bigger and bold", "add a shadow", "round the corners"…'
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
              <button type="button" className="btn-ghost text-xs" onClick={() => setPendingModify(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={busy || !modifyText.trim()}
                onClick={() => applyModify(pendingModify.screenId, pendingModify.info, modifyText)}
              >
                Apply change
              </button>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">Text edits apply instantly when unique · other changes use the model · revertable from the ⋯ menu</p>
          </div>
        </div>
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
              <div
                className="fixed z-50 w-60 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 py-1 text-sm text-slate-200 shadow-2xl"
                style={{ left: Math.min(menu.x, window.innerWidth - 250), top: Math.min(menu.y, window.innerHeight - 400) }}
              >
                <MenuItem icon="🔄" label="Regenerate (new variant)" disabled={busy} onClick={() => { close(); regenerate(s.id) }} />
                <MenuItem
                  icon="✎"
                  label="Rename"
                  onClick={() => {
                    close()
                    const n = window.prompt('Screen name', s.name)
                    if (n && n.trim()) onUpdateScreen(s.id, { name: n.trim() })
                  }}
                />
                <MenuItem icon="⟨⟩" label="Show code" onClick={() => { close(); setCodeScreen(s) }} />
                <MenuItem
                  icon={isRef ? '📌' : '📍'}
                  label={isRef ? 'Unpin as reference' : 'Pin as layout reference'}
                  onClick={() => { close(); onSetReference(isRef ? null : s.id) }}
                />
                <MenuItem icon="⬇" label="Download .tsx" onClick={() => { close(); downloadTsx(s) }} />
                {s.previousCode && (
                  <MenuItem icon="↺" label="Revert to previous" onClick={() => { close(); onRevertScreen(s.id) }} />
                )}
                <MenuItem icon="🎨" label="Edit DESIGN.md" onClick={() => { close(); onOpenDesign() }} />

                <div className="my-1 border-t border-slate-700/70" />
                <div className="px-3 pb-1 pt-0.5 text-[10px] uppercase tracking-wide text-slate-500">Display format</div>
                <div className="flex gap-1 px-2 pb-1.5">
                  {([['mobile', '📱'], ['tablet', '▭'], ['desktop', '🖥'], ['full', '↕']] as [ViewportFormat, string][]).map(([f, ic]) => (
                    <button
                      key={f}
                      type="button"
                      title={f === 'full' ? 'Full height (fit content)' : f}
                      onClick={() => { close(); setFormat(s.id, f) }}
                      className="flex-1 rounded-md border border-slate-700 py-1.5 text-base transition hover:bg-slate-700/60"
                    >
                      {ic}
                    </button>
                  ))}
                </div>

                <div className="my-1 border-t border-slate-700/70" />
                <div className="px-3 pb-1 pt-0.5 text-[10px] uppercase tracking-wide text-slate-500">Add animations</div>
                <div className="flex gap-1 px-2 pb-1.5">
                  {ANIMATION_LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      disabled={busy || !s.code.trim()}
                      title={`Add ${ANIMATION_LEVEL_LABELS[lvl].toLowerCase()} motion (keeps content & layout; revertable)`}
                      onClick={() => { close(); addAnimations(s.id, lvl) }}
                      className="flex-1 rounded-md border border-slate-700 py-1 text-[11px] font-medium transition hover:bg-slate-700/60 disabled:opacity-40"
                    >
                      {ANIMATION_LEVEL_LABELS[lvl]}
                    </button>
                  ))}
                </div>

                <div className="my-1 border-t border-slate-700/70" />
                <MenuItem
                  icon="🗑"
                  label="Delete screen"
                  danger
                  onClick={() => {
                    close()
                    if (confirm('Delete this screen?')) {
                      onRemoveScreen(s.id)
                      setSelectedIds((ids) => ids.filter((i) => i !== s.id))
                    }
                  }}
                />
              </div>
            </>
          )
        })()}

      {/* Code viewer modal */}
      {codeScreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setCodeScreen(null)}
        >
          <div
            className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2.5">
              <span className="truncate text-sm font-semibold text-slate-100">{codeScreen.name} — code</span>
              <button type="button" className="btn-ghost text-sm" onClick={() => setCodeScreen(null)}>
                Close
              </button>
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

function MenuItem({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: string
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
        danger ? 'text-rose-300 hover:bg-rose-500/10' : 'hover:bg-slate-700/60'
      }`}
    >
      <span className="w-4 shrink-0 text-center text-[13px]">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}
