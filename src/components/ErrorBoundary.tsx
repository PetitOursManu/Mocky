import { Component, type ErrorInfo, type ReactNode } from 'react'
import { getLang, translate } from '../i18n'
import { Icon } from '../ui'

/**
 * The app had no error boundary at all: the only one in the codebase lives
 * *inside* the preview iframe, guarding generated components. A render error in
 * Mocky's own tree therefore unmounted everything and left a blank page — with
 * no way back, and nothing on screen explaining what happened.
 *
 * Two are mounted: one around the whole app, and one around the project view, so
 * that a single corrupted project cannot take the other projects with it.
 */

interface Props {
  children: ReactNode
  /** Shown as the way out. Omit for the top-level boundary (which reloads). */
  onReset?: () => void
  resetLabel?: string
  /** Changing this value clears the error — e.g. the id of the open project. */
  resetKey?: string
}

interface State {
  error: Error | null
  info: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: '' }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep it in the console too — the details panel below is deliberately terse.
    console.error('Mocky crashed while rendering:', error, info.componentStack)
    this.setState({ info: info.componentStack || '' })
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null, info: '' })
    }
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    const reset = this.props.onReset
    // A class component cannot call `useT()`; the crash screen is not re-rendered
    // on a language switch anyway, so reading the language once is enough.
    const t = (key: string) => translate(getLang(), key)
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="w-full max-w-lg border border-line bg-surface p-6">
          <header className="rule-double pb-3">
            <p className="kicker text-accent-ink">{t('auth.error.kicker')}</p>
            <h2 className="masthead mt-1.5 text-h2">{t('error.crashed')}</h2>
          </header>
          <p className="measure mt-3 text-body text-ink-muted">{t('error.crashedHelp')}</p>

          <div className="mt-5 flex gap-2">
            <button
              className="btn-primary"
              onClick={() => {
                if (reset) {
                  this.setState({ error: null, info: '' })
                  reset()
                } else {
                  window.location.reload()
                }
              }}
            >
              <Icon name={reset ? 'chevronLeft' : 'refresh'} size={16} />
              {this.props.resetLabel || (reset ? t('auth.error.goBack') : t('auth.error.reloadMocky'))}
            </button>
            {reset && (
              <button className="btn-ghost" onClick={() => window.location.reload()}>
                <Icon name="refresh" size={16} />
                {t('common.reload')}
              </button>
            )}
          </div>

          <details className="mt-5 border-t border-line-soft pt-3">
            <summary className="kicker cursor-pointer transition hover:text-accent-ink">
              {t('common.details')}
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap border border-line-soft bg-sunken p-3 text-caption text-ink-muted">
              {error.message}
              {info ? `\n${info}` : ''}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
