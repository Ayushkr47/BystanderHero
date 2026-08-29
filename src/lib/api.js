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

const body = (payload) => ({ method: 'POST', body: JSON.stringify(payload) });

export const api = {
  meta: () => request('/api/meta'),
  nearby: () => request('/api/nearby'),
  classify: (transcript) => request('/api/classify', body({ transcript })),
  open: (payload) => request('/api/incident', body(payload)),
  byCode: (code) => request(`/api/incident/by-code/${encodeURIComponent(code)}`),
  snapshot: (id) => request(`/api/incident/${id}/snapshot`),
  join: (id, name) => request(`/api/incident/${id}/join`, body({ name })),
  step: (id, payload) => request(`/api/incident/${id}/step`, body(payload)),
  relief: (id, responderId) => request(`/api/incident/${id}/relief`, body({ responderId })),
  setCrisis: (id, payload) => request(`/api/incident/${id}/crisis`, body(payload)),
  close: (id, reason) => request(`/api/incident/${id}/close`, body({ reason }))
};

export function mmss(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function clockTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
