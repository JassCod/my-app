import { Component, type ReactNode } from 'react';

/** If a screen ever fails to render, show a way out instead of a frozen page. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page">
        <div className="empty">
          <h3>Something went wrong on this screen</h3>
          <p>Your data is safe. Go back home or reload the app.</p>
          <div className="row gap-8">
            <button className="btn ghost" onClick={() => (location.hash = '/')}>
              Home
            </button>
            <button className="btn primary" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
