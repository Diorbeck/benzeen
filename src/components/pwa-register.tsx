'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker once on the client. Rendered near the root so
 * every page gets offline support + push capability. No-op when the browser
 * has no service-worker support.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        // Non-fatal: app still works without the SW.
        console.warn('[pwa] service worker registration failed:', err);
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
