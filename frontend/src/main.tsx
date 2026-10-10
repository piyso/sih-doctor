import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './fonts';
import './index.css';
import { ThemeProvider } from './components/providers/ThemeProvider';
import { resolveLiveBackend } from './services/liveBackend';

// The app reads its backend address when its modules load, so on the public demonstration site
// the current address is looked up first (a no-op everywhere else; see services/liveBackend.ts).
resolveLiveBackend()
  .catch(() => undefined)
  .then(() => import('./App.tsx'))
  .then(({ App }) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <ThemeProvider defaultTheme="dark">
          <App />
        </ThemeProvider>
      </StrictMode>,
    );
  });

// Offline app shell (production builds only; needs HTTPS or localhost).
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('[SW] registration failed', err));
  });
}
