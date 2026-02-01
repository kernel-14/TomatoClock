/**
 * Renderer process entry point
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global error handler for uncaught errors
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
  // You could send this to the main process for logging
  // window.electron?.logError?.(event.error);
});

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // You could send this to the main process for logging
  // window.electron?.logError?.(event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
