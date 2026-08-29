/**
 * In-memory incident registry.
 *
 * One incident = one shared session that every bystander on scene is looking at.
 * State lives in this process only. That is a deliberate prototype choice: no database
 * to provision at 3am, and an incident is meaningless once EMS arrives anyway.
 * Production notes are in README.md.
 */

import { randomUUID } from 'node:crypto';
import { getProtocol } from './protocols.mjs';

/** @type {Map<string, object>} */
const incidents = new Map();
/** @type {Map<string, Set<import('node:http').ServerResponse>>} */
const streams = new Map();

const CODE_ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY349'; // No look-alike glyphs; this gets shouted across a room.
const INCIDENT_TTL_MS = 1000 * 60 * 60 * 2;

function makeCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
  } while ([...incidents.values()].some((i) => i.code === code));
  return code;
}

function now() {
  return Date.now();
}

export function createIncident({ crisis, confidence = 0, heard = '', aiSource = 'offline', transcript = '', place = '' }) {
  const id = randomUUID();
  const incident = {
    id,
    code: makeCode(),
    createdAt: now(),
    crisis,
    confidence,
    heard,
    aiSource,
    confirmed: confidence >= 0.6,
    place: place || 'Location not set',
    status: 'active',
    transcript: transcript ? [{ text: transcript, at: now() }] : [],
    responders: [],
    steps: {},
    log: [],
    reliefRequested: false
  };
  incidents.set(id, incident);
  addLog(incident, `Incident opened. ${crisis ? getProtocol(crisis).label : 'Awaiting confirmation'}.`, 'system');
  sweep();
  return incident;
}

export function getIncident(id) {
  return incidents.get(id) || null;
}

export function getIncidentByCode(code) {
  const wanted = String(code || '').trim().toUpperCase();
  return [...incidents.values()].find((i) => i.code === wanted) || null;
}

/** Active incidents, newest first. Stands in for a real geospatial "within 200m of you" query. */
export function listActive() {
  sweep();
  return [...incidents.values()]
    .filter((i) => i.status === 'active')
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((i) => ({
      id: i.id,
      code: i.code,
      crisis: i.crisis,
      label: i.crisis ? getProtocol(i.crisis).label : 'Unconfirmed',
      place: i.place,
      responders: i.responders.length,
      openRoles: openRoleCount(i),
      startedAt: i.createdAt
    }));
}

function sweep() {
  const cutoff = now() - INCIDENT_TTL_MS;
  for (const [id, incident] of incidents) {
    if (incident.createdAt < cutoff) {
      incidents.delete(id);
      streams.delete(id);
    }
  }
}

export function addLog(incident, text, kind = 'action') {
  incident.log.unshift({ at: now(), text, kind });
  if (incident.log.length > 60) incident.log.length = 60;
}

/* ------------------------------------------------------------------ roles */

function roleOccupancy(incident) {
  const counts = new Map();
  for (const r of incident.responders) counts.set(r.roleKey, (counts.get(r.roleKey) || 0) + 1);
  return counts;
}

function openRoleCount(incident) {
  if (!incident.crisis) return 0;
  const counts = roleOccupancy(incident);
  return getProtocol(incident.crisis).roles.reduce(
    (sum, role) => sum + Math.max(0, role.slots - (counts.get(role.key) || 0)),
    0
  );
}

/**
 * The core of the whole idea: hand each arriving person a DIFFERENT job, in the order
 * that saves the most life-minutes. Nobody has to decide, so nobody freezes.
 */
function nextOpenRole(incident) {
  if (!incident.crisis) return 'standby';
  const counts = roleOccupancy(incident);
  for (const role of getProtocol(incident.crisis).roles) {
    if ((counts.get(role.key) || 0) < role.slots) return role.key;
  }
  return 'standby';
}

export function joinIncident(incident, name) {
  const roleKey = nextOpenRole(incident);
  const responder = {
    id: randomUUID(),
    name: (name || '').trim().slice(0, 24) || `Responder ${incident.responders.length + 1}`,
    roleKey,
    joinedAt: now(),
    isPrimary: incident.responders.length === 0
  };
  incident.responders.push(responder);

  const roleTitle = roleKey === 'standby' ? 'Standby' : roleTitleFor(incident, roleKey);
  addLog(incident, `${responder.name} joined and took ${roleTitle}.`, 'join');
  broadcast(incident);
  return responder;
}

export function leaveIncident(incident, responderId) {
  const index = incident.responders.findIndex((r) => r.id === responderId);
  if (index === -1) return;
  const [gone] = incident.responders.splice(index, 1);
  addLog(incident, `${gone.name} left the scene.`, 'system');
  reassignOrphans(incident);
  broadcast(incident);
}

/**
 * Somebody walked away. Refill from the top of the priority list down.
 *
 * A standby is taken first, but if there is no spare we will strip a lower-priority role
 * to cover a higher one: an unattended crowd is survivable, an unattended chest is not.
 */
function reassignOrphans(incident) {
  if (!incident.crisis) return;
  const roles = getProtocol(incident.crisis).roles;

  for (let i = 0; i < roles.length; i += 1) {
    const role = roles[i];
    let counts = roleOccupancy(incident);

    while ((counts.get(role.key) || 0) < role.slots) {
      let donor = incident.responders.find((r) => r.roleKey === 'standby');

      if (!donor) {
        // Search from the least critical role upwards, never above the gap we are filling.
        for (let j = roles.length - 1; j > i; j -= 1) {
          donor = incident.responders.find((r) => r.roleKey === roles[j].key);
          if (donor) break;
        }
      }
      if (!donor) return; // Genuinely nobody left to move.

      const from = roleTitleFor(incident, donor.roleKey);
      donor.roleKey = role.key;
      addLog(incident, `${donor.name} moved from ${from} to ${role.title} — that role was uncovered.`, 'alert');
      counts = roleOccupancy(incident);
    }
  }
}

function roleTitleFor(incident, roleKey) {
  if (!incident.crisis) return 'Standby';
  const role = getProtocol(incident.crisis).roles.find((r) => r.key === roleKey);
  return role ? role.title : 'Standby';
}

/* ------------------------------------------------------- protocol changes */

export function setCrisis(incident, crisis, { byName = 'A responder', manual = true } = {}) {
  if (incident.crisis === crisis) return;
  const previous = incident.crisis ? getProtocol(incident.crisis).label : 'unconfirmed';
  incident.crisis = crisis;
  incident.confirmed = true;
  incident.steps = {}; // Old protocol progress means nothing under the new one.
  incident.reliefRequested = false;

  // Everyone gets rebriefed against the new role list, keeping arrival order.
  const ordered = [...incident.responders];
  incident.responders = [];
  for (const responder of ordered) {
    responder.roleKey = nextOpenRole({ ...incident, responders: incident.responders });
    incident.responders.push(responder);
  }

  addLog(incident, `${manual ? byName : 'AI'} switched protocol: ${previous} to ${getProtocol(crisis).label}. Everyone rebriefed.`, 'protocol');
  broadcast(incident);
}

export function toggleStep(incident, responderId, roleKey, stepKey, done) {
  const responder = incident.responders.find((r) => r.id === responderId);
  const key = `${roleKey}:${stepKey}`;
  if (done) {
    incident.steps[key] = { done: true, by: responder ? responder.name : 'Someone', at: now() };
    const role = incident.crisis ? getProtocol(incident.crisis).roles.find((r) => r.key === roleKey) : null;
    const step = role ? role.steps.find((s) => s.key === stepKey) : null;
    if (step) addLog(incident, `${responder ? responder.name : 'Someone'}: ${step.text}`, 'done');
  } else {
    delete incident.steps[key];
  }
  broadcast(incident);
}

/**
 * The person doing compressions is tiring. Quality drops long before they will admit it,
 * so this swaps them out rather than asking anyone to volunteer.
 *
 * Preference order for who takes over: a designated relief, then anyone idle, then the
 * least critical working role. Holding a crowd back can wait two minutes. A chest cannot.
 */
export function requestRelief(incident, responderId) {
  const tiring = incident.responders.find((r) => r.id === responderId);
  if (!tiring) return { swapped: false };

  const others = incident.responders.filter((r) => r.id !== responderId);
  let relief = others.find((r) => r.roleKey === 'relief' || r.roleKey === 'standby');

  if (!relief && incident.crisis) {
    const roles = getProtocol(incident.crisis).roles;
    const tiringRank = roles.findIndex((r) => r.key === tiring.roleKey);
    for (let j = roles.length - 1; j > tiringRank; j -= 1) {
      relief = others.find((r) => r.roleKey === roles[j].key);
      if (relief) break;
    }
  }

  if (!relief) {
    incident.reliefRequested = true;
    addLog(incident, `${tiring.name} needs relief. No spare responder on scene: shout for one.`, 'alert');
    broadcast(incident);
    return { swapped: false };
  }

  const tiringRole = tiring.roleKey;
  tiring.roleKey = relief.roleKey;
  relief.roleKey = tiringRole;
  incident.reliefRequested = false;
  addLog(incident, `SWAP NOW: ${relief.name} takes over ${roleTitleFor(incident, tiringRole)} from ${tiring.name}.`, 'alert');
  broadcast(incident);
  return { swapped: true };
}

export function addTranscript(incident, text) {
  incident.transcript.unshift({ text, at: now() });
  if (incident.transcript.length > 40) incident.transcript.length = 40;
  broadcast(incident);
}

export function closeIncident(incident, reason = 'EMS on scene') {
  incident.status = 'closed';
  addLog(incident, `Incident closed: ${reason}. Handover complete.`, 'system');
  broadcast(incident);
}

/* -------------------------------------------------------------- snapshots */

export function snapshot(incident) {
  const protocol = incident.crisis ? getProtocol(incident.crisis) : null;
  const counts = roleOccupancy(incident);

  return {
    id: incident.id,
    code: incident.code,
    createdAt: incident.createdAt,
    elapsedSec: Math.floor((now() - incident.createdAt) / 1000),
    crisis: incident.crisis,
    confidence: incident.confidence,
    heard: incident.heard,
    aiSource: incident.aiSource,
    confirmed: incident.confirmed,
    place: incident.place,
    status: incident.status,
    reliefRequested: incident.reliefRequested,
    transcript: incident.transcript.slice(0, 8),
    log: incident.log.slice(0, 20),
    steps: incident.steps,
    protocol: protocol && {
      id: protocol.id,
      label: protocol.label,
      short: protocol.short,
      severity: protocol.severity,
      dispatchLine: protocol.dispatchLine,
      roles: protocol.roles.map((role) => ({
        key: role.key,
        title: role.title,
        subtitle: role.subtitle,
        color: role.color,
        slots: role.slots,
        filled: counts.get(role.key) || 0,
        steps: role.steps,
        holders: incident.responders.filter((r) => r.roleKey === role.key).map((r) => r.name)
      }))
    },
    responders: incident.responders.map((r) => ({
      id: r.id,
      name: r.name,
      roleKey: r.roleKey,
      roleTitle: roleTitleFor(incident, r.roleKey),
      isPrimary: r.isPrimary
    }))
  };
}

/* ------------------------------------------------------------------- SSE */

export function subscribe(incidentId, res) {
  if (!streams.has(incidentId)) streams.set(incidentId, new Set());
  streams.get(incidentId).add(res);
  res.on('close', () => {
    const set = streams.get(incidentId);
    if (set) set.delete(res);
  });
}

export function broadcast(incident) {
  const set = streams.get(incident.id);
  if (!set || set.size === 0) return;
  const payload = `event: state\ndata: ${JSON.stringify(snapshot(incident))}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      set.delete(res);
    }
  }
}

/** Keeps the shared clock ticking on every device without each one guessing. */
export function startHeartbeat() {
  setInterval(() => {
    for (const incident of incidents.values()) {
      if (incident.status === 'active' && streams.get(incident.id)?.size) broadcast(incident);
    }
  }, 1000);
}
