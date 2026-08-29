/**
 * BystanderHero server.
 *
 * Zero dependencies on purpose. `node server/index.mjs` and it is up: no install step,
 * no bundler, nothing to fail while a demo is being recorded or, one day, while
 * somebody is on the floor.
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { classify, AI_MODE } from './classify.mjs';
import { PROTOCOL_LIST } from './protocols.mjs';
import * as store from './incidents.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('payload too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('invalid json');
  }
}

async function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.join(PUBLIC, rel);

  // Never let a crafted path escape /public.
  if (!target.startsWith(PUBLIC)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const data = await fs.readFile(target);
    res.writeHead(200, {
      'content-type': MIME[path.extname(target)] || 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    res.end(data);
  } catch {
    // Clean URLs: /join -> join.html
    try {
      const data = await fs.readFile(path.join(PUBLIC, `${rel}.html`));
      res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    }
  }
}

/* ------------------------------------------------------------------- API */

async function handleApi(req, res, url) {
  const seg = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const method = req.method;

  // GET /api/meta
  if (seg[1] === 'meta' && method === 'GET') {
    return json(res, 200, { aiMode: AI_MODE, protocols: PROTOCOL_LIST });
  }

  // GET /api/nearby  - stands in for a real geofenced query
  if (seg[1] === 'nearby' && method === 'GET') {
    return json(res, 200, { incidents: store.listActive() });
  }

  // POST /api/classify  - preview only, creates nothing
  if (seg[1] === 'classify' && method === 'POST') {
    const { transcript } = await readBody(req);
    return json(res, 200, await classify(transcript));
  }

  // POST /api/incident  - open a scene
  if (seg[1] === 'incident' && seg.length === 2 && method === 'POST') {
    const { transcript = '', place = '', crisis = null, name = '' } = await readBody(req);

    let result = { crisis, confidence: crisis ? 1 : 0, heard: '', source: 'manual' };
    if (!crisis) result = await classify(transcript);

    const incident = store.createIncident({
      crisis: result.crisis,
      confidence: result.confidence,
      heard: result.heard,
      aiSource: result.source,
      transcript,
      place
    });
    const responder = store.joinIncident(incident, name);
    return json(res, 201, { incident: store.snapshot(incident), responderId: responder.id });
  }

  // GET /api/incident/by-code/:code
  if (seg[1] === 'incident' && seg[2] === 'by-code' && method === 'GET') {
    const incident = store.getIncidentByCode(seg[3]);
    if (!incident) return json(res, 404, { error: 'No active incident with that code.' });
    return json(res, 200, { id: incident.id });
  }

  // Everything below is /api/incident/:id/...
  if (seg[1] !== 'incident' || !seg[2]) return json(res, 404, { error: 'Unknown endpoint' });

  const incident = store.getIncident(seg[2]);
  if (!incident) return json(res, 404, { error: 'Incident not found or already closed.' });
  const action = seg[3];

  // GET /api/incident/:id/stream  - SSE, the shared clock for the whole scene
  if (action === 'stream' && method === 'GET') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no'
    });
    res.write('retry: 1500\n\n');
    res.write(`event: state\ndata: ${JSON.stringify(store.snapshot(incident))}\n\n`);
    store.subscribe(incident.id, res);
    return undefined;
  }

  if (action === 'snapshot' && method === 'GET') {
    return json(res, 200, store.snapshot(incident));
  }

  if (method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const body = await readBody(req);

  switch (action) {
    case 'join': {
      const responder = store.joinIncident(incident, body.name);
      return json(res, 200, { responderId: responder.id, incident: store.snapshot(incident) });
    }
    case 'leave': {
      store.leaveIncident(incident, body.responderId);
      return json(res, 200, { ok: true });
    }
    case 'step': {
      store.toggleStep(incident, body.responderId, body.roleKey, body.stepKey, Boolean(body.done));
      return json(res, 200, { ok: true });
    }
    case 'relief': {
      return json(res, 200, store.requestRelief(incident, body.responderId));
    }
    case 'crisis': {
      const responder = incident.responders.find((r) => r.id === body.responderId);
      store.setCrisis(incident, body.crisis, { byName: responder ? responder.name : 'A responder' });
      return json(res, 200, { ok: true });
    }
    case 'transcript': {
      store.addTranscript(incident, String(body.text || '').slice(0, 500));
      // Speech keeps arriving after dispatch. If the AI now reads it very differently
      // and the scene has not been human-confirmed, surface that rather than silently switching.
      if (body.reclassify && !incident.confirmed) {
        const result = await classify(incident.transcript.map((t) => t.text).join(' '));
        if (result.crisis && result.crisis !== incident.crisis && result.confidence > 0.75) {
          store.setCrisis(incident, result.crisis, { manual: false });
        }
      }
      return json(res, 200, { ok: true });
    }
    case 'close': {
      store.closeIncident(incident, body.reason);
      return json(res, 200, { ok: true });
    }
    default:
      return json(res, 404, { error: 'Unknown action' });
  }
}

/* ---------------------------------------------------------------- server */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) json(res, 500, { error: err.message || 'Server error' });
    else res.end();
  }
});

// SSE connections must not be reaped mid-incident.
server.keepAliveTimeout = 0;
server.headersTimeout = 0;
server.requestTimeout = 0;

store.startHeartbeat();

server.listen(PORT, () => {
  console.log(`\n  BystanderHero  ->  http://localhost:${PORT}`);
  console.log(`  Two-phone demo ->  http://localhost:${PORT}/demo`);
  console.log(`  AI triage      ->  ${AI_MODE === 'claude' ? 'Claude (claude-opus-5)' : 'offline cue engine (set ANTHROPIC_API_KEY for Claude)'}\n`);
});
