import { useEffect, useRef, useState } from 'react'
import { Banner, Button, Icon, Modal, type IconName } from '../ui'
import { useLang, useT } from '../i18n'
import type { Screen } from '../lib/project'
import { DEFAULT_PAGE_FORMAT, getPageFormat } from '../lib/pageFormats'
import { exportDocument, type ExportKind, type ExportProgress, type RenderNotice } from '../lib/docExport'
import { documentHasFields, downloadBlob } from '../lib/docExport/files'

/**
 * Downloading a DOCUMENT screen (lib/pageFormats.ts): PDF with fillable
 * fields, PowerPoint / Google Slides, PNG per page.
 *
 * Three buttons and nothing to configure, because each output answers a
 * different next step — print it, keep editing it, post it — and the page
 * format was chosen when the document was made. The file is handed to the
 * browser as a download the moment it exists: the print dialog was the other
 * way to get a PDF out of a page, and it is the one the user asked NOT to have
 * (it paginates by itself, drops backgrounds by default, and cannot make a
 * field fillable).
 *
 * An export renders the screen offscreen and walks it page by page, so it takes
 * seconds, not milliseconds: it reports which page it is on, can be cancelled,
 * and a failure is a sentence in the dialog — the canvas is never touched.
 */

const KINDS: { kind: ExportKind; icon: IconName; title: string; help: string }[] = [
  { kind: 'pdf', icon: 'download', title: 'docExport.pdf.title', help: 'docExport.pdf.help' },
  { kind: 'pptx', icon: 'pencil', title: 'docExport.pptx.title', help: 'docExport.pptx.help' },
  { kind: 'png', icon: 'image', title: 'docExport.png.title', help: 'docExport.png.help' },
]

type State =
  | { step: 'idle' }
  | { step: 'running'; kind: ExportKind; progress: ExportProgress }
  | { step: 'done'; filename: string; notices: RenderNotice[] }
  | { step: 'cancelled' }
  | { step: 'error' }

/** How far along, 0–1, for the bar. Rendering the frame is a fixed slice; pages share the rest. */
function fraction(p: ExportProgress): number {
  if (p.phase === 'render') return 0.05
  if (p.phase === 'build') return 0.92
  return 0.1 + (0.8 * (p.page - 1)) / Math.max(1, p.total)
}

export default function DocumentDownloadDialog({ screen, onClose }: { screen: Screen; onClose: () => void }) {
  const t = useT()
  const [lang] = useLang()
  const [state, setState] = useState<State>({ step: 'idle' })
  const abortRef = useRef<AbortController | null>(null)
  // The run still unwinding after a cancel. A cancel disposes the offscreen
  // frame at once and the export races every step against the signal, so this
  // is short — but a page's encode may still be finishing, and the next export
  // waits for it rather than opening a second frame beside the first.
  const pendingRef = useRef<Promise<void> | null>(null)
  const buttonsRef = useRef<Partial<Record<ExportKind, HTMLButtonElement | null>>>({})
  const lastKindRef = useRef<ExportKind | null>(null)
  const format = getPageFormat(screen.page ?? DEFAULT_PAGE_FORMAT)
  const empty = !screen.code.trim()
  const fields = documentHasFields(screen.code)

  // Closing the dialog mid-export stops the export: a file that arrives after
  // its dialog has gone is a download nobody asked for any more.
  useEffect(() => () => abortRef.current?.abort(), [])

  /**
   * Focus back on the button that started the export, when it was lost. The
   * Cancel button unmounts when a run ends, and focus on an element that leaves
   * the DOM falls to <body> — outside the modal's trap, with a screen reader's
   * place gone with it.
   */
  function refocus() {
    const btn = lastKindRef.current ? buttonsRef.current[lastKindRef.current] : null
    const active = btn?.ownerDocument.activeElement
    if (btn && (!active || active === btn.ownerDocument.body)) btn.focus()
  }

  async function run(kind: ExportKind) {
    if (running || empty) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    lastKindRef.current = kind
    setState({ step: 'running', kind, progress: { phase: 'render' } })
    const previous = pendingRef.current
    let settle: () => void = () => {}
    const pending = new Promise<void>((resolve) => (settle = resolve))
    pendingRef.current = pending
    try {
      if (previous) await previous
      if (ctrl.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const result = await exportDocument(screen, kind, {
        signal: ctrl.signal,
        lang,
        onProgress: (progress) => {
          if (!ctrl.signal.aborted) setState({ step: 'running', kind, progress })
        },
      })
      if (ctrl.signal.aborted) return
      downloadBlob(result.blob, result.filename)
      setState({ step: 'done', filename: result.filename, notices: result.notices })
      refocus()
    } catch (err) {
      // `cancel()` has already said so; and after an unmount there is nobody to tell.
      if (ctrl.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return
      // The cause stays in the console: the sentence in the dialog is for the
      // person, the stack is for whoever has to find out why.
      console.warn('mocky: document export failed —', err)
      setState({ step: 'error' })
      refocus()
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null
      settle()
      if (pendingRef.current === pending) pendingRef.current = null
    }
  }

  /**
   * Said at once, and done at once: the abort disposes the offscreen frame (the
   * model's code stops running with it) and every step of the export races the
   * signal, so nothing arrives after it. A Cancel that seemed to do nothing for
   * seconds got clicked again, or the dialog closed.
   */
  function cancel() {
    abortRef.current?.abort()
    setState({ step: 'cancelled' })
    // The Cancel button is about to unmount under the focus.
    requestAnimationFrame(refocus)
  }

  function progressLabel(p: ExportProgress): string {
    if (p.phase === 'render') return t('docExport.progress.render')
    if (p.phase === 'build') return t('docExport.progress.build')
    return t('docExport.progress.page', { page: p.page, total: p.total })
  }

  function noticeText(n: RenderNotice): string {
    if (n.code === 'noPages') return t('docExport.notice.noPages')
    const pages = n.pages.join(', ')
    if (n.code === 'overflow') return t('docExport.notice.overflow', { pages })
    if (n.code === 'tilted') return t('docExport.notice.tilted', { pages })
    if (n.code === 'fallback') return t('docExport.notice.fallback', { pages })
    if (n.code === 'assets') return t('docExport.notice.assets', { pages })
    // What survives a page neither renderer could draw depends on the file:
    // the .pptx keeps its editable text, the PDF only its fillable fields (its
    // text layer is invisible by design), a PNG nothing at all.
    if (n.code === 'raster') return t(`docExport.notice.raster.${lastKindRef.current ?? 'pdf'}`, { pages })
    return t('docExport.notice.measure', { pages })
  }

  const running = state.step === 'running'

  return (
    <Modal title={t('docExport.title')} onClose={onClose} size="md">
      <p className="measure text-body text-ink-muted">
        {t('docExport.intro', { format: t(`docExport.format.${format.id}`) })}
      </p>

      {empty && (
        <div className="mt-3">
          <Banner tone="warn">{t('docExport.empty')}</Banner>
        </div>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {KINDS.map(({ kind, icon, title: plainTitle, help: plainHelp }) => {
          const active = running && state.kind === kind
          const title = kind === 'pdf' && fields ? 'docExport.pdf.titleFields' : plainTitle
          const help = kind === 'pdf' && fields ? 'docExport.pdf.helpFields' : plainHelp
          return (
            <li key={kind}>
              {/* `aria-disabled`, not `disabled`, while an export runs:
                  disabling the button that has the focus drops it to <body>,
                  outside the modal, and the next Tab lands in the canvas behind
                  it. `run` ignores the click instead. */}
              <button
                ref={(el) => {
                  buttonsRef.current[kind] = el
                }}
                type="button"
                onClick={() => run(kind)}
                disabled={empty}
                aria-disabled={running || undefined}
                aria-describedby={`doc-export-${kind}-help`}
                className={`tap-target flex w-full items-start gap-3 border px-4 py-3 text-left transition motion-reduce:transition-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed ${
                  active
                    ? 'border-accent bg-surface'
                    : 'border-line-soft hover:border-line disabled:opacity-50 aria-disabled:opacity-50 aria-disabled:hover:border-line-soft'
                }`}
              >
                <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium text-ink">{t(title)}</span>
                  <span id={`doc-export-${kind}-help`} className="mt-0.5 block text-body-sm text-ink-muted">
                    {t(help)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* One live region for every outcome, so a screen reader hears the progress and the result. */}
      <div className="mt-4" aria-live="polite">
        {running && (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-body-sm text-ink">{progressLabel(state.progress)}</p>
              <div
                role="progressbar"
                aria-label={t('docExport.progress.label')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(fraction(state.progress) * 100)}
                className="mt-1.5 h-1 w-full bg-line-soft"
              >
                <div
                  className="h-full bg-accent transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${Math.round(fraction(state.progress) * 100)}%` }}
                />
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={cancel}>
              {t('docExport.cancel')}
            </Button>
          </div>
        )}
        {state.step === 'done' && (
          <div className="flex flex-col gap-2">
            <Banner tone="ok">{t('docExport.done', { file: state.filename })}</Banner>
            {state.notices.map((n, i) => (
              <Banner key={i} tone="warn">
                {noticeText(n)}
              </Banner>
            ))}
          </div>
        )}
        {state.step === 'cancelled' && <Banner tone="info">{t('docExport.cancelled')}</Banner>}
        {state.step === 'error' && <Banner tone="danger">{t('docExport.error')}</Banner>}
      </div>
    </Modal>
  )
}
