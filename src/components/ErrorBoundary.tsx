import { Component, type ReactNode } from 'react';

const RELOAD_KEY = 'teampulse.autoReloadAt';

/** A crash caused by a missing app file means the phone has a stale copy from before an update. */
const isStaleVersion = (e: unknown) =>
  /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError|Loading chunk/i.test(String((e as Error)?.message ?? e));

/**
 * Reload once, silently, fetching a fresh copy of the page (the query string skips the
 * browser's 10-minute cache of the old page). Returns false if we already tried very recently.
 */
export function freshReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* storage blocked: still try once */
  }
  location.replace(`${location.pathname}?v=${Date.now()}${location.hash}`);
  return true;
}

interface Props {
  children: ReactNode;
  resetKey: string;
  /** Top-level boundary: recover by reloading once before showing anything. */
  root?: boolean;
  /** Custom recovery instead of the error screen (e.g. close a pop-up). */
  onError?: (error: unknown) => void;
}

/** If part of the app fails to render, recover or show a way out instead of a frozen page. */
export class ErrorBoundary extends Component<Props, { error: unknown; reloading: boolean }> {
  state = { error: null as unknown, reloading: false };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    console.error('TeamPulse crash:', error);
    if (this.props.onError) {
      this.props.onError(error);
      this.setState({ error: null });
    } else if (this.props.root || isStaleVersion(error)) {
      if (freshReload()) this.setState({ reloading: true });
    }
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.state.reloading || this.props.onError) return null;
    const err = this.state.error as Error;
    const detail = `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}`.slice(0, 300);
    return (
      <div className="page">
        <div className="empty">
          <h3>Something went wrong on this screen</h3>
          <p>Your data is safe. Go back home or reload the app.</p>
          <div className="row gap-8">
            <button className="btn ghost" onClick={() => (location.hash = '/')}>
              Home
            </button>
            <button className="btn primary" onClick={() => location.replace(`${location.pathname}?v=${Date.now()}${location.hash}`)}>
              Reload
            </button>
          </div>
          <p className="crash-detail">{detail}</p>
        </div>
      </div>
    );
  }
}
