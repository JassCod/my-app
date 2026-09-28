import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Splash } from './components/Backdrop';
import { cloudEnabled } from './lib/cloudEnabled';
import { LocalStoreProvider, ToastProvider } from './lib/store';
import './styles.css';

// Firebase is only downloaded when the shared (multi-user) mode is configured.
const CloudRoot = lazy(() => import('./cloud/CloudRoot'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      {cloudEnabled ? (
        <Suspense fallback={<Splash />}>
          <CloudRoot>
            <App />
          </CloudRoot>
        </Suspense>
      ) : (
        <LocalStoreProvider>
          <App />
        </LocalStoreProvider>
      )}
    </ToastProvider>
  </StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
