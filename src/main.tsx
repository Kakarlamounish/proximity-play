import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Import i18n after React
import './i18n';
// Initializes Sentry as a side effect (src/utils/sentry.ts calls Sentry.init()
// at module load, gated on production + VITE_SENTRY_DSN). Previously never
// imported anywhere in the app, so it silently never ran despite being fully
// implemented — found via live QA testing of ErrorBoundary's "we've been
// notified" claim.
import './utils/sentry';

const rootEl = document.getElementById('root');

if (!rootEl) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
