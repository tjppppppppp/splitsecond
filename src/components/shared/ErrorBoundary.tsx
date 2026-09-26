import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('SplitSecond crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="empty-state">
          <p className="empty-state-title">Something went wrong.</p>
          <p className="empty-state-description">{this.state.error.message}</p>
          <button className="btn btn-secondary" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
