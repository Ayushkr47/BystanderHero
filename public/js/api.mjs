/** Thin fetch wrapper. Every call surfaces a readable error rather than a silent no-op. */

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: options.body ? { 'content-type': 'application/json' } : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  meta: () => request('/api/meta'),
  nearby: () => request('/api/nearby'),
  classify: (transcript) => request('/api/classify', { method: 'POST', body: JSON.stringify({ transcript }) }),
  open: (payload) => request('/api/incident', { method: 'POST', body: JSON.stringify(payload) }),
  byCode: (code) => request(`/api/incident/by-code/${encodeURIComponent(code)}`),
  snapshot: (id) => request(`/api/incident/${id}/snapshot`),
  join: (id, name) => request(`/api/incident/${id}/join`, { method: 'POST', body: JSON.stringify({ name }) }),
  step: (id, payload) => request(`/api/incident/${id}/step`, { method: 'POST', body: JSON.stringify(payload) }),
  relief: (id, responderId) => request(`/api/incident/${id}/relief`, { method: 'POST', body: JSON.stringify({ responderId }) }),
  setCrisis: (id, payload) => request(`/api/incident/${id}/crisis`, { method: 'POST', body: JSON.stringify(payload) }),
  transcript: (id, payload) => request(`/api/incident/${id}/transcript`, { method: 'POST', body: JSON.stringify(payload) }),
  close: (id, reason) => request(`/api/incident/${id}/close`, { method: 'POST', body: JSON.stringify({ reason }) })
};

/** Subscribes to the incident's shared state. Reconnects on its own if the phone drops signal. */
export function subscribe(incidentId, onState) {
  const source = new EventSource(`/api/incident/${incidentId}/stream`);
  source.addEventListener('state', (event) => {
    try {
      onState(JSON.parse(event.data));
    } catch (err) {
      console.error('bad state frame', err);
    }
  });
  return source;
}

export function mmss(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function clockTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Text is user- and AI-supplied; it never reaches innerHTML without this. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
