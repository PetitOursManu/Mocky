/**
 * The passes on a screen that already exists — an edit, a polish, an
 * accessibility correction — as functions, so the composer and the MCP runner
 * run the same code (X5), the way `runNewScreen` is shared for a new screen.
 *
 * Only the model-facing core lives here: which capabilities a pass may use,
 * which system turn it gets, which loop steers it, what it hands back. The
 * write-back stays with the caller, because the conventions around it differ
 * by caller and are the caller's to keep — ProjectView streams an edit into the
 * live screen and re-checks `codeAtStart` against concurrent writers; the
 * runner holds a working copy and writes it once.
 *
 * The three passes stay three (CLAUDE.md, "four independent correction
 * passes"): each function calls one prompt, never a mix of them.
 */
import { auditFixComponent, editComponent, polishComponent, type GeneratedComponent } from '../generate'
import { capabilitiesFor, resolveCapabilities, selectCapabilities } from '../capabilities/select'
import { documentPipeline, hintForScreen } from '../documentMode'
import { buildDesignPreamble } from '../design'
import { checkQuality, type QualityFinding } from '../quality'
import { auditScreen } from '../audit'
import { runPolishLoop, type PolishOutcome, type PolishReport } from '../polish'
import { ultraLoss } from '../ultra/check'
import type { ScreenQuality, Screen } from '../project'
import type { Settings } from '../settings'
import { joinSystem } from './newScreen'

/**
 * The capabilities a pass on this screen may use: the ones it already has, or —
 * for a screen saved before they were recorded — a fresh selection from `text`.
 * A document is offered only what can live on paper.
 */
export function screenCapabilities(screen: Pick<Screen, 'caps' | 'page'>, text: string, designMd: string | undefined) {
  const capIds = documentPipeline(screen.page).caps(
    screen.caps && screen.caps.length > 0 ? screen.caps : selectCapabilities(text, designMd),
  )
  return { capIds, caps: resolveCapabilities(capIds) }
}

export interface EditedScreen {
  code: string
  componentName: GeneratedComponent['componentName']
  /** What the new source uses, for `Screen.caps`. */
  caps: string[]
  /** What a Motion Ultra screen lost to the edit (U5) — said, never undone. */
  loss: ReturnType<typeof ultraLoss> | null
}

/**
 * One edit of one screen, from an instruction. `designMd` is the direction in
 * force (the project's, else the global one); `onPartial` streams the source as
 * the model writes it, for a caller that shows it live.
 */
export async function editScreen(req: {
  settings: Settings
  instruction: string
  screen: Screen
  designMd: string | undefined
  images?: string[]
  signal?: AbortSignal
  onPartial?: (partial: string) => void
}): Promise<EditedScreen> {
  const { screen, designMd } = req
  // `hintForScreen`: a document keeps its page hint on every edit.
  const extraSystem = joinSystem([designMd ? buildDesignPreamble(designMd) : undefined, hintForScreen(screen)])
  const { capIds, caps } = screenCapabilities(screen, req.instruction, designMd)
  const res = await editComponent(req.settings, req.instruction, screen.code, extraSystem, req.images, req.signal, req.onPartial, caps)
  return {
    code: res.code,
    componentName: res.componentName,
    caps: capabilitiesFor(capIds, res.code),
    loss: screen.ultra ? ultraLoss(screen.code, res.code, screen.ultra) : null,
  }
}

export interface PolishedScreen {
  outcome: PolishOutcome
  /**
   * What `Screen.quality` should become. Only a run that actually produced a
   * report leaves one: a record from a run whose check never completed would
   * store a 20/20 for a screen nobody looked at.
   */
  record: ScreenQuality | undefined
  /** For `Screen.caps`, when the code changed. */
  caps: string[]
}

/** The quality pass on one screen: check, correct the named findings, check again. */
export async function polishScreenCode(req: {
  settings: Settings
  screen: Screen
  designMd: string | undefined
  signal?: AbortSignal
  onPass?: (iteration: number, remaining: number) => void
}): Promise<PolishedScreen> {
  const { screen, designMd, settings, signal } = req
  const { capIds, caps } = screenCapabilities(screen, screen.prompt, designMd)
  const outcome = await runPolishLoop(
    screen.code,
    {
      check: (code) =>
        checkQuality(code, {
          // An established direction owns the palette and the typography,
          // so the rules about them become advice rather than corrections.
          hasDirection: Boolean(designMd && designMd.trim()),
          // Motion Ultra's glass, gradients and halos are what the user
          // switched it on for — reported, never "corrected" away.
          ultra: Boolean(screen.ultra) || capIds.includes('ultra'),
          settings,
          signal,
        }),
      polish: async (code, findingsBlock) => {
        const res = await polishComponent(settings, code, findingsBlock, signal, caps)
        return res.code
      },
      onPass: req.onPass,
    },
    { signal },
  )
  const record: ScreenQuality | undefined = outcome.report
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
  return { outcome, record, caps: capabilitiesFor(capIds, outcome.code) }
}

/**
 * Correct named SEO / accessibility findings on one screen: `AUDIT_FIX_PROMPT`,
 * which says the screen must look identical afterwards — not the polish
 * prompt, which says roughly the opposite. `findings` is both the first pass's
 * list and the yardstick (`scope`): the check re-audits the WHOLE screen, and
 * measured against that a correction of one finding read as getting worse.
 */
export async function fixScreenAudit(req: {
  settings: Settings
  screen: Screen
  designMd: string | undefined
  findings: QualityFinding[]
  signal?: AbortSignal
}): Promise<PolishOutcome<PolishReport>> {
  const { screen, settings, signal } = req
  const { caps } = screenCapabilities(screen, screen.prompt, req.designMd)
  return runPolishLoop<PolishReport>(
    screen.code,
    {
      check: (code) => auditScreen(code, { settings, signal }),
      polish: async (code, findingsBlock) => {
        const res = await auditFixComponent(settings, code, findingsBlock, signal, caps)
        return res.code
      },
    },
    { signal, initialReport: { findings: req.findings }, scope: req.findings.map((f) => f.rule) },
  )
}
