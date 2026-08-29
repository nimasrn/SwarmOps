import { Component, type ErrorInfo, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface ErrorBoundaryProps {
  children: ReactNode
  /** Rendered instead of the children when they throw. Receives the error and
   *  a reset callback so the surface can offer a way back without a reload. */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** Somewhere to report the failure — a logger, a beacon. Called once per
   *  error, never during render. */
  onError?: (error: Error, info: ErrorInfo) => void
  /** Changing this resets the boundary. Pass the route or record id, so
   *  navigating away from a screen that threw does not leave the reader stuck
   *  on its wreckage. */
  resetKey?: unknown
  className?: string
}

interface State {
  error: Error | null
}

/**
 * Contains a render failure to one region.
 *
 * React unmounts the entire tree from the root when a render throws and nothing
 * catches it. In an application shell that means the navigation goes with the
 * screen: the reader is left on a blank page with no way back, and no
 * indication that anything failed rather than finished loading.
 *
 * Wrap the workspace, not the shell. The chrome that lets someone leave a
 * broken screen has to survive it, so a boundary placed around everything
 * protects nothing worth protecting.
 *
 * This deliberately does not retry on its own. A component that threw once
 * usually throws again on the same props, and a boundary that re-renders in a
 * loop turns one visible failure into an invisible one.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info)
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.reset()
    }
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div className={cn('nim-boundary', this.props.className)} role="alert">
        <p className="nim-boundary__title">This screen stopped rendering</p>
        <p className="nim-boundary__body">
          The rest of the application is unaffected — the failure is contained to this region, and
          everything around it still works.
        </p>
        <pre className="nim-boundary__detail">{error.message}</pre>
        <button className="nim-button nim-button--secondary nim-button--sm" onClick={this.reset} type="button">
          Try this screen again
        </button>
      </div>
    )
  }
}
