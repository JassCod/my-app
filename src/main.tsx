import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Splash } from './components/Backdrop';
import { ErrorBoundary } from './components/ErrorBoundary';
import { cloudEnabled } from './lib/cloudEnabled';
import { LocalStoreProvider, ToastProvider } from './lib/store';
import './styles.css';

// Firebase is only downloaded when the shared (multi-user) mode is configured.
const CloudRoot = lazy(() => import('./cloud/CloudRoot'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      {cloudEnabled ? (
        <ErrorBoundary resetKey="root">
          <Suspense fallback={<Splash />}>
            <CloudRoot>
              <App />
            </CloudRoot>
          </Suspense>
        </ErrorBoundary>
      ) : (
        <LocalStoreProvider>
          <App />
        </LocalStoreProvider>
      )}
    </ToastProvider>
  </StrictMode>
);

// After an update, a phone may still run the previous version, which asks for files that no longer exist.
// Reload once to pick up the new version instead of leaving a broken screen.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('teampulse.reloadedAt') || 0);
    if (Date.now() - last < 30000) return; // already tried: let the error screen show
    sessionStorage.setItem('teampulse.reloadedAt', String(Date.now()));
  } catch {
    /* ignore */
  }
  event.preventDefault();
  location.reload();
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
