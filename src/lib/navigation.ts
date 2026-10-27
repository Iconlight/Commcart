/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type NavigationListener = (path: string) => void;
const listeners = new Set<NavigationListener>();

/**
 * Subscribes to custom client-side navigation events
 */
export function subscribeToNavigation(listener: NavigationListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Client-side navigation helper that updates window.location without a full page reload,
 * synchronously updating subscribed React route state and popstate listeners.
 */
export function navigateTo(path: string) {
  if (typeof window !== 'undefined') {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    // Synchronously notify React App state
    listeners.forEach((fn) => {
      try {
        fn(path);
      } catch (e) {
        console.error('Navigation listener error:', e);
      }
    });
    // Dispatch standard browser popstate
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}
