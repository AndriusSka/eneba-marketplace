import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { blockType: string; children: ReactNode }
type State = { failed: boolean }

/** Wraps one homepage block: if it throws while rendering, only that block disappears. */
export class BlockErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`Homepage block "${this.props.blockType}" failed to render`, error, info.componentStack)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
