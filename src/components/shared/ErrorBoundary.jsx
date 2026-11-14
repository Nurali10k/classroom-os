import { Component } from 'react'
import { withTranslation } from 'react-i18next'
import { RefreshCw, Triangle } from 'lucide-react'

import Button from '../ui/Button'

/**
 * Catches render-time failures anywhere below it and swaps in a calm recovery
 * panel instead of a white screen. Async/query errors are handled separately by
 * `useFirestore`, which surfaces them inline next to the data they belong to.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ClassroomOS] Unhandled render error', error, info?.componentStack)
  }

  handleReset = () => this.setState({ error: null })

  render() {
    const { error } = this.state

    if (!error) return this.props.children

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
        <div className="w-full max-w-[520px] rounded-lg border border-line bg-surface">
          <div className="flex items-start gap-3 border-b border-line px-4 py-3.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-danger-line bg-danger-soft text-danger">
              <Triangle size={14} strokeWidth={1.9} />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold leading-6 text-ink">{this.props.t('errors.somethingBroke')}</h2>
              <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
                {this.props.t('errors.renderFailed')}
              </p>
            </div>
          </div>

          <div className="px-4 py-4">
            <p className="font-mono tnum rounded-md border border-line bg-sunken px-2.5 py-2 text-[11.5px] leading-5 text-ink-soft">
              {error?.message || String(error)}
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-line bg-sunken/40 px-4 py-3">
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => window.location.reload()}
            >
              {this.props.t('errors.reloadApp')}
            </Button>
            <Button variant="primary" onClick={this.handleReset}>{this.props.t('errors.tryAgain')}</Button>
          </div>
        </div>
      </div>
    )
  }

}

export default withTranslation()(ErrorBoundary)
