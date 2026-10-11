import { useEffect, useMemo, useRef, useState } from 'react'
import { FRAME_HEADER, type Screen } from '../lib/project'
import Preview from './Preview'
import DeviceChrome, { SCREEN_RADIUS } from './DeviceChrome'
import WireframeDevice from './WireframeDevice'
import {
  browserStorage,
  deviceFrame,
  fitFrameScale,
  frameDimensions,
  frameKindFor,
  readFramePref,
  writeFramePref,
  type FrameKind,
} from '../lib/deviceFrames'
import { Button, Icon, IconButton, Select } from '../ui'
import { demoOrder, stepScreen } from '../lib/demoNav'
import DocumentPages from './DocumentPages'
import DocumentInHand from './DocumentInHand'
import DocumentInPhone from './DocumentInPhone'
import { getPageFormat } from '../lib/pageFormats'
import { newId } from '../lib/project'
import { cleanFlowState, resolveRoute, SCENARIOS_MAX, SCENARIO_NAME_MAX, type DemoScenario } from '../lib/flows'
import { useT } from '../i18n'

/**
 * Prototype player: renders one screen at a time and lets the user click the
 * hotspot links to navigate between screens, like a clickable prototype.
 *
 * With the device frame on (the default), the screen is shown inside a
 * wireframe laptop, tablet or phone chosen from its size — see
 * `lib/deviceFrames.ts`. Off, it is the bare preview exactly as before.
 */

const KIND_LABEL: Record<FrameKind, string> = {
  phone: 'canvas.demoDevicePhone',
  tablet: 'canvas.demoDeviceTablet',
  computer: 'canvas.demoDeviceComputer',
}

export default function DemoPlayer({
  screens,
  startId,
  onExit,
  scenarios = [],
  onSaveScenarios,
}: {
  screens: Screen[]
  startId: string
  onExit: () => void
  /** The project's ways to start the demo (lib/flows.ts). */
  scenarios?: DemoScenario[]
  /** Absent: scenarios can be played but not recorded (a read-only caller). */
  onSaveScenarios?: (next: DemoScenario[]) => void
}) {
  const t = useT()
  const [stack, setStack] = useState<string[]>([startId])
  /*
   * The prototype's shared data (snippets/Flow.ts): what the screens wrote with
   * useFlowState — the cart, the signed-in user. Held HERE because each screen
   * is its own document and this is the one thing that outlives them all; a
   * page opened next is born with it. Reset by "Restart" to the scenario's own.
   */
  const [scenarioId, setScenarioId] = useState<string>('')
  const scenario = scenarios.find((s) => s.id === scenarioId) ?? null
  const [flowState, setFlowState] = useState<Record<string, unknown>>({})
  /** Bumped to start the current frame over with the state as it now is. */
  const [frameNonce, setFrameNonce] = useState(0)
  const [flowNotice, setFlowNotice] = useState<string | null>(null)
  const [showData, setShowData] = useState(false)

  function startScenario(id: string) {
    const sc = scenarios.find((s) => s.id === id) ?? null
    setScenarioId(sc ? sc.id : '')
    setFlowState(sc ? { ...sc.state } : {})
    const start = sc && screens.some((s) => s.id === sc.startScreenId) ? sc.startScreenId : startId
    setStack([start])
    setFrameNonce((n) => n + 1)
  }

  function restart() {
    setFlowState(scenario ? { ...scenario.state } : {})
    setStack([scenario && screens.some((s) => s.id === scenario.startScreenId) ? scenario.startScreenId : startId])
    setFrameNonce((n) => n + 1)
  }

  function saveScenario() {
    if (!onSaveScenarios) return
    const name = window.prompt(t('canvas.demoScenarioNamePrompt'))?.replace(/\s+/g, ' ').trim().slice(0, SCENARIO_NAME_MAX)
    if (!name) return
    const state = cleanFlowState(flowState)
    if (!state) {
      setFlowNotice(t('canvas.demoScenarioTooLarge'))
      return
    }
    const sc: DemoScenario = { id: newId(), name, startScreenId: currentId, state, createdAt: Date.now() }
    onSaveScenarios([...scenarios, sc].slice(-SCENARIOS_MAX))
    setScenarioId(sc.id)
  }

  function deleteScenario() {
    if (!onSaveScenarios || !scenario) return
    if (!confirm(t('canvas.demoScenarioDeleteConfirm', { name: scenario.name }))) return
    onSaveScenarios(scenarios.filter((s) => s.id !== scenario.id))
    setScenarioId('')
  }

  // A route nobody answers says so, briefly, instead of doing nothing.
  useEffect(() => {
    if (!flowNotice) return
    const id = window.setTimeout(() => setFlowNotice(null), 3500)
    return () => window.clearTimeout(id)
  }, [flowNotice])
  const currentId = stack[stack.length - 1]
  const current = screens.find((s) => s.id === currentId) ?? screens.find((s) => s.id === startId) ?? screens[0]

  const areaRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [framed, setFramed] = useState(() => readFramePref(browserStorage()))

  function toggleFramed() {
    setFramed((on) => {
      writeFramePref(browserStorage(), !on)
      return !on
    })
  }

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  // Every screen of the prototype, reachable without its links — see demoNav.
  const order = useMemo(() => demoOrder(screens), [screens])

  function goTo(id: string | null) {
    if (id && id !== currentId && screens.some((s) => s.id === id)) setStack((st) => [...st, id])
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onExit()
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      // Not while a field has the keys: the screen picker is a <select>, whose
      // arrows already change the screen once — acting on them here as well
      // skipped a screen per press.
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName))) return
      e.preventDefault()
      const next = stepScreen(order, currentId, e.key === 'ArrowRight' ? 1 : -1)
      if (next) setStack((st) => [...st, next])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit, order, currentId])

  if (!current) return null

  const bodyW = current.w
  const bodyH = Math.max(1, current.h - FRAME_HEADER)
  const pad = 28
  const scale = size.w > 0 ? Math.min((size.w - pad * 2) / bodyW, (size.h - pad * 2) / bodyH) : 0
  const boxW = bodyW * scale
  const boxH = bodyH * scale

  function navigate(target: string) {
    if (screens.some((s) => s.id === target)) setStack((st) => [...st, target])
  }

  const demoLinks = current.links
    .filter((h) => h.selector)
    .map((h) => ({ selector: h.selector as string, target: h.target }))

  const flow = {
    state: flowState,
    onSet: (key: string, value: unknown) =>
      setFlowState((prev) => {
        const next = { ...prev }
        if (value === null || value === undefined) delete next[key]
        else next[key] = value
        return next
      }),
    onGo: (route: string) => {
      const id = resolveRoute(screens, route)
      if (id) navigate(id)
      else setFlowNotice(t('canvas.demoNoRoute', { route }))
    },
    onReset: () => {
      setFlowState({})
      setFrameNonce((n) => n + 1)
    },
  }
  const flowKeys = Object.keys(flowState)

  // The device only exists while the frame is on, and it is fitted as a whole
  // — screen, bezel, deck and caption — rather than by the screen alone.
  // A document is paper, not a device. With the frame on, a printed page is
  // held in a hand (DocumentInHand) and a social post is seen on a phone, in
  // its feed (DocumentInPhone); off — or for a presentation, which is
  // projected rather than held — its pages are shown bare, fitted to the width
  // and scrolled.
  const isDoc = !!current.page
  const docKind = current.page ? getPageFormat(current.page).kind : null
  const heldInHand = framed && docKind === 'print'
  const inPhone = framed && docKind === 'social'
  const frame = framed && !isDoc ? deviceFrame(frameKindFor(current.device, bodyW, bodyH), bodyW, bodyH) : null
  const frameScale = frame && size.w > 0 ? fitFrameScale(size.w, size.h, frame) : 0

  /* Fallback overlays for legacy links without an element selector. They are
     fractions of the screen, so they must live in the screen's own box — the
     frame's opening when there is one. */
  const legacyHotspots = current.links
    .filter((h) => !h.selector)
    .map((h) => (
      <button
        key={h.id}
        type="button"
        onClick={() => navigate(h.target)}
        title={t('canvas.demoGoToScreen')}
        aria-label={t('canvas.demoGoToScreen')}
        className="absolute rounded transition hover:bg-accent/20"
        style={{
          left: `${h.x * 100}%`,
          top: `${h.y * 100}%`,
          width: `${h.w * 100}%`,
          height: `${h.h * 100}%`,
        }}
      />
    ))

  return (
    <div className="fixed inset-0 z-top flex flex-col bg-sunken">
      <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <Button size="sm" onClick={onExit}>
          <Icon name="close" size={15} />
          {t('canvas.demoExit')}
        </Button>
        <Button
          size="sm"
          disabled={stack.length <= 1}
          onClick={() => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st))}
        >
          <Icon name="chevronLeft" size={15} />
          {t('canvas.demoBack')}
        </Button>
        <Button size="sm" onClick={restart} title={t('canvas.demoRestartTitle')}>
          <Icon name="refresh" size={15} />
          {t('canvas.demoRestart')}
        </Button>
        <Button
          size="sm"
          active={framed}
          // Explicit, because `active` only sets it when true: off, a screen
          // reader heard a plain button and never learnt it was a toggle.
          aria-pressed={framed}
          disabled={docKind === 'slides'}
          onClick={toggleFramed}
          title={t(docKind === 'social' ? 'canvas.demoFrameTitleSocial' : isDoc ? 'canvas.demoFrameTitleDoc' : 'canvas.demoFrameTitle')}
          aria-label={t('canvas.demoFrame')}
        >
          <Icon name="phone" size={15} />
          <span className="hidden sm:inline">{t('canvas.demoFrame')}</span>
        </Button>
        <span className="kicker ml-3 hidden shrink-0 sm:inline">{t('mode.demo')}</span>
        {/* Switching screens without the links: previous, the list, next. The
            steps go on the history like a followed link, so "Retour" still
            walks back through what was shown. */}
        <span className="flex min-w-0 items-center gap-1">
          <IconButton
            label={t('canvas.demoPrevScreen')}
            variant="quiet"
            disabled={order.length < 2}
            onClick={() => goTo(stepScreen(order, current.id, -1))}
          >
            <Icon name="chevronLeft" size={16} />
          </IconButton>
          <Select
            aria-label={t('canvas.demoPickScreen')}
            title={t('canvas.demoPickScreen')}
            value={current.id}
            onChange={(e) => goTo(e.target.value)}
            className="min-w-0 max-w-[16rem] truncate"
          >
            {(order.includes(current.id) ? order : [current.id, ...order]).map((id) => (
              <option key={id} value={id}>
                {screens.find((s) => s.id === id)?.name ?? id}
              </option>
            ))}
          </Select>
          <IconButton
            label={t('canvas.demoNextScreen')}
            variant="quiet"
            disabled={order.length < 2}
            onClick={() => goTo(stepScreen(order, current.id, 1))}
          >
            <Icon name="chevronRight" size={16} />
          </IconButton>
        </span>
        <span className="ml-2 hidden text-body-sm text-ink-faint 2xl:inline">{t('canvas.demoHintSwitch')}</span>
        {/* Scenarios: where the demo starts, and with what data. */}
        <span className="ml-auto flex min-w-0 items-center gap-1">
          <Select
            aria-label={t('canvas.demoScenario')}
            title={t('canvas.demoScenarioTitle')}
            value={scenarioId}
            onChange={(e) => startScenario(e.target.value)}
            className="min-w-0 max-w-[14rem] truncate"
          >
            <option value="">{t('canvas.demoScenarioFree')}</option>
            {scenarios.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
              </option>
            ))}
          </Select>
          {onSaveScenarios && (
            <IconButton label={t('canvas.demoScenarioSave')} variant="quiet" onClick={saveScenario}>
              <Icon name="plus" size={16} />
            </IconButton>
          )}
          {onSaveScenarios && scenario && (
            <IconButton label={t('canvas.demoScenarioDelete')} variant="quiet" onClick={deleteScenario}>
              <Icon name="trash" size={16} />
            </IconButton>
          )}
          <Button
            size="sm"
            active={showData}
            aria-pressed={showData}
            onClick={() => setShowData((v) => !v)}
            title={t('canvas.demoDataTitle')}
          >
            <Icon name="list" size={15} />
            <span className="hidden sm:inline">{t('canvas.demoData', { count: flowKeys.length })}</span>
          </Button>
        </span>
      </div>
      {flowNotice && (
        <div role="status" className="border-b border-line bg-raised px-3 py-1.5 text-body-sm text-warn">
          {flowNotice}
        </div>
      )}
      {showData && (
        <div className="max-h-48 overflow-auto border-b border-line bg-raised px-3 py-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="kicker text-accent-ink">{t('canvas.demoDataHeading')}</span>
            <Button size="sm" variant="quiet" disabled={!flowKeys.length} onClick={() => flow.onReset()}>
              {t('canvas.demoDataClear')}
            </Button>
          </div>
          {flowKeys.length === 0 ? (
            <p className="text-body-sm text-ink-faint">{t('canvas.demoDataEmpty')}</p>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-caption text-ink-muted">
              {JSON.stringify(flowState, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div ref={areaRef} className="relative flex flex-1 items-center justify-center overflow-hidden">
        {framed && frame && frameScale > 0 && (
          <WireframeDevice
            frame={frame}
            scale={frameScale}
            caption={`${frameDimensions(bodyW, bodyH)} · ${t(KIND_LABEL[frame.kind])}`}
            systemUi={current.device === 'iphone'}
          >
            {({ radius, hideScrollbars }) => (
              <>
                <div className="absolute inset-0">
                  <Preview
                    key={frameNonce}
                    code={current.code}
                    caps={current.caps}
                    demoLinks={demoLinks}
                    onNavigate={navigate}
                    hideScrollbars={hideScrollbars}
                    radius={radius}
                    flow={flow}
                  />
                </div>
                {legacyHotspots}
              </>
            )}
          </WireframeDevice>
        )}
        {heldInHand && current.page && size.w > 0 && (
          <DocumentInHand key={current.id} screen={current} page={current.page} width={size.w} height={size.h} />
        )}
        {inPhone && current.page && size.w > 0 && (
          <DocumentInPhone key={current.id} screen={current} page={current.page} width={size.w} height={size.h} />
        )}
        {isDoc && !heldInHand && !inPhone && current.page && size.w > 0 && (
          <DocumentPages key={current.id} screen={current} page={current.page} width={size.w} height={size.h} />
        )}
        {!isDoc && !framed && scale > 0 && (
          <div className="relative" style={{ width: boxW, height: boxH }}>
            <div className="absolute inset-0">
              {current.device === 'iphone' ? (
                <DeviceChrome>
                  <Preview key={frameNonce} code={current.code} caps={current.caps} demoLinks={demoLinks} onNavigate={navigate} hideScrollbars radius={SCREEN_RADIUS} flow={flow} />
                </DeviceChrome>
              ) : (
                <Preview key={frameNonce} code={current.code} caps={current.caps} demoLinks={demoLinks} onNavigate={navigate} flow={flow} />
              )}
            </div>
            {legacyHotspots}
          </div>
        )}
      </div>
    </div>
  )
}
