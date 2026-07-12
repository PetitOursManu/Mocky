import { useCallback, useRef, useState } from 'react'
import { loadSettings } from '../lib/settings'
import { buildDesignPreamble, isDesignActive, loadDesign } from '../lib/design'
import { editComponent, fixComponent, generateComponent, detectComponentName } from '../lib/generate'
import { deriveName, newId, type Hotspot, type Project, type Screen } from '../lib/project'
import { DEFAULT_PRESET_ID, getPreset, hintForDevice } from '../lib/presets'
import { captureRegion } from '../lib/capture'
import Welcome from './Welcome'
import Canvas from './Canvas'
import PresetPicker from './PresetPicker'
import DemoPlayer from './DemoPlayer'
import { type PickInfo } from './Preview'

const FRAME_PREF_KEY = 'mocky.showFrame'

function joinSystem(parts: Array<string | undefined>): string | undefined {
  const joined = parts.filter(Boolean).join('\n\n')
  return joined || undefined
}

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
}: {
  project: Project
  onAddScreen: (screen: Omit<Screen, 'x' | 'y'>) => void
  onUpdateScreen: (screenId: string, patch: Partial<Screen>) => void
  onRemoveScreen: (screenId: string) => void
  onOpenSettings: () => void
  onOpenDesign: () => void
  onBack: () => void
}) {
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESET_ID)
  const [linkMode, setLinkMode] = useState(false)
  const [interactAll, setInteractAll] = useState(false)
  const [showFrame, setShowFrame] = useState(() => localStorage.getItem(FRAME_PREF_KEY) !== '0')
  const [pendingLink, setPendingLink] = useState<{ screenId: string; info: PickInfo } | null>(null)
  const [demoStartId, setDemoStartId] = useState<string | null>(null)
  const [highlightHotspot, setHighlightHotspot] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ screenId: string; nonce: number } | null>(null)
  const [annotateMode, setAnnotateMode] = useState(false)
  const [captureReq, setCaptureReq] = useState<
    { screenId: string; id: string; clientRect: { left: number; top: number; width: number; height: number } } | null
  >(null)
  const [capturing, setCapturing] = useState(false)
  const [annotations, setAnnotations] = useState<{ id: string; dataUrl: string }[]>([])
  const retryRefs = useRef<Record<string, number>>({})
  const retryAbortRef = useRef<AbortController | null>(null)

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

  const designActive = isDesignActive(loadDesign())
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
  // broken code + the error message back to the model for a one-shot fix.
  // Only one retry per screen to avoid infinite loops.
  // IMPORTANT: do NOT retry while a generation is in progress (busy=true) —
  // the code is still streaming and incomplete errors are expected.
  const onScreenError = useCallback(async (screenId: string, errorMessage: string) => {
    if (busy) return
    if (retryRefs.current[screenId]) return
    retryRefs.current[screenId] = 1
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

      if (targets.length > 0) {
        // Edit mode: apply the instruction to each selected screen in place,
        // keeping each screen in its existing form factor. Stream partial code
        // so the preview updates live as the model writes.
        // Save the current code as previousCode so the user can revert.
        for (const sc of targets) {
          const extraSystem = joinSystem([designPreamble, hintForDevice(sc.device)])
          // Snapshot the old code before overwriting
          const oldCode = sc.code
          const res = await editComponent(
            settings, text, sc.code, extraSystem, images, ac.signal,
            (partial) => onUpdateScreen(sc.id, { code: partial }),
          )
          onUpdateScreen(sc.id, { code: res.code, componentName: res.componentName, previousCode: oldCode })
        }
        setPrompt('')
        setAnnotations([])
      } else {
        // Create a new screen using the selected format preset. Add it
        // immediately with empty code, then stream the code in live.
        const preset = getPreset(presetId)
        const extraSystem = joinSystem([designPreamble, preset.hint])
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
        })
        setSelectedIds([screenId])
        setPrompt('')
        setAnnotations([])
        const result = await generateComponent(
          settings, text, extraSystem, images, ac.signal,
          (partial) => onUpdateScreen(screenId, { code: partial }),
        )
        onUpdateScreen(screenId, { code: result.code, componentName: result.componentName })
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }, [prompt, screens, selectedIds, presetId, annotations, onAddScreen, onUpdateScreen])

  function cancelGenerate() {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
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
        linkMode={linkMode}
        interactAll={interactAll}
        showFrame={showFrame}
        onPickElement={(screenId, info) => setPendingLink({ screenId, info })}
        onRemoveHotspot={removeHotspot}
        highlightedHotspotId={highlightHotspot}
        focusScreenId={focus?.screenId ?? null}
        focusNonce={focus?.nonce}
        annotateMode={annotateMode}
        onCaptureRegion={onCaptureRegion}
        captureReq={captureReq}
        onCaptureRect={onCaptureRect}
        onError={onScreenError}
        onRevertScreen={onRevertScreen}
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
          onClick={() => setLinkMode((v) => !v)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            linkMode ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-slate-700/60'
          }`}
          title="Draw links between screens"
        >
          🔗 Link
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
              {busy ? 'Generating…' : editing ? `Update ${selectedScreens.length}` : 'Generate'}
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

      {demoStartId && (
        <DemoPlayer screens={screens} startId={demoStartId} onExit={() => setDemoStartId(null)} />
      )}
    </div>
  )
}
