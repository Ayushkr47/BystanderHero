import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/**
 * Subscribes this device to one incident's shared state.
 *
 * The server pushes a complete snapshot once a second and again on every change, so there is no
 * client-side merging to get wrong: whatever the scene looks like on the server is what renders.
 */
export function useIncident(incidentId, initialResponderId) {
  const [snapshot, setSnapshot] = useState(null);
  const [responderId, setResponderId] = useState(initialResponderId);
  const [closed, setClosed] = useState(false);

  // Read inside the SSE callback without making it a dependency and tearing the stream down.
  const responderRef = useRef(initialResponderId);
  const rejoining = useRef(false);
  responderRef.current = responderId;

  useEffect(() => {
    if (!incidentId) return undefined;

    api.snapshot(incidentId).catch(() => setClosed(true));

    const source = new EventSource(`/api/incident/${incidentId}/stream`);

    source.addEventListener('state', (event) => {
      let state;
      try {
        state = JSON.parse(event.data);
      } catch {
        return;
      }
      setSnapshot(state);

      // Phone locked, signal dropped, tab restored: the roster no longer knows us. Take a role
      // again rather than standing there roleless in the middle of an emergency.
      const stillListed = state.responders.some((r) => r.id === responderRef.current);
      if (!stillListed && state.status === 'active' && !rejoining.current) {
        rejoining.current = true;
        api.join(incidentId, sessionStorage.getItem('bh-name') || '')
          .then(({ responderId: fresh }) => {
            responderRef.current = fresh;
            setResponderId(fresh);
            const url = new URL(window.location.href);
            url.searchParams.set('r', fresh);
            window.history.replaceState(null, '', url);
          })
          .finally(() => { rejoining.current = false; });
      }
    });

    return () => source.close();
  }, [incidentId]);

  // Leaving frees the role for whoever is still standing there.
  useEffect(() => {
    const release = () => {
      navigator.sendBeacon?.(
        `/api/incident/${incidentId}/leave`,
        new Blob([JSON.stringify({ responderId: responderRef.current })], { type: 'application/json' })
      );
    };
    window.addEventListener('pagehide', release);
    return () => window.removeEventListener('pagehide', release);
  }, [incidentId]);

  const me = snapshot?.responders.find((r) => r.id === responderId) || null;
  const role = snapshot?.protocol?.roles.find((r) => r.key === me?.roleKey) || null;

  useEffect(() => {
    if (me) sessionStorage.setItem('bh-name', me.name); // Survives a rejoin after signal loss.
  }, [me?.name]);

  const toggleStep = useCallback((roleKey, stepKey, done) => (
    api.step(incidentId, { responderId: responderRef.current, roleKey, stepKey, done })
  ), [incidentId]);

  const requestRelief = useCallback(() => (
    api.relief(incidentId, responderRef.current)
  ), [incidentId]);

  const switchProtocol = useCallback((crisis) => (
    api.setCrisis(incidentId, { crisis, responderId: responderRef.current })
  ), [incidentId]);

  return { snapshot, me, role, closed, toggleStep, requestRelief, switchProtocol };
}
