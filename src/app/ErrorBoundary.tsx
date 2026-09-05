import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center p-6" role="alert">
          <div className="max-w-sm text-center">
            <h1 className="text-xl font-bold">Something went wrong</h1>
            <p className="mt-2 text-sm text-ink-3">Reload the app to try again.</p>
            <button
              className="mt-4 rounded-xl bg-ink px-4 py-2 font-bold text-white"
              type="button"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
