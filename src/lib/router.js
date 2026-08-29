import { useEffect, useState } from 'react';

/**
 * Three routes and no nested layouts, so a router dependency would cost more than it returns.
 * Real URLs (not hashes) matter here: the demo stage loads two incident consoles into iframes,
 * and the scene link is something you would text to someone.
 */

export function navigate(to) {
  window.history.pushState(null, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute() {
  const read = () => ({
    path: window.location.pathname.replace(/\/+$/, '') || '/',
    params: new URLSearchParams(window.location.search)
  });

  const [route, setRoute] = useState(read);

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);

  return route;
}
