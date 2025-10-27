// Polyfill for Node.js global in browser
window.global = window;

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Optional global styles (uncomment if present in your project)
// import '@/styles/index.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  // Fail fast with a clear message instead of rendering a blank page
  // This helps identify missing/incorrect index.html root element issues.
  // If index.html doesn't have <div id="root"></div>, add it.
  // Throwing will surface the error in the terminal/console.
  // eslint-disable-next-line no-console
  console.error('Root element with id="root" not found. Ensure index.html contains <div id="root"></div>.');
  throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootEl);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
