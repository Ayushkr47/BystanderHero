import { api, esc } from './api.mjs';
import { createListener, speechSupported } from './listen.mjs';

const $ = (id) => document.getElementById(id);

const DEMO_PHRASES = [
  "He's choking! He can't speak, he's grabbing his throat!",
  'She just collapsed, she is not breathing, I cannot find a pulse',
  'There is blood everywhere, the cut is really deep, it will not stop',
  'He is on the floor shaking, I think it is a seizure',
  'She is not waking up, her lips are blue, I think she took something'
];

const state = {
  protocols: [],
  transcript: '',
  chosen: null,
  suggestion: null
};

let listener = null;

/* ------------------------------------------------------------------ boot */

api.meta().then(({ aiMode, protocols }) => {
  state.protocols = protocols;
  const chip = $('ai-mode-chip');
  chip.textContent = aiMode === 'claude' ? 'Claude triage · live' : 'Offline cue triage';
  chip.title = aiMode === 'claude'
    ? 'ANTHROPIC_API_KEY detected. Transcripts are classified by claude-opus-5.'
    : 'No API key set, so the deterministic cue engine is running. Everything still works.';
  renderProtocolPicker();
}).catch(() => {});

renderDemoPhrases();

/* --------------------------------------------------------------- screens */

function show(panelId) {
  for (const id of ['listen-panel', 'confirm-panel', 'join-panel']) {
    $(id).classList.toggle('hidden', id !== panelId);
  }
  if (panelId) $(panelId).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('btn-start').addEventListener('click', () => {
  show('listen-panel');
  startListening();
});

$('btn-cancel-listen').addEventListener('click', () => {
  listener?.stop();
  show(null);
});

$('btn-join').addEventListener('click', () => {
  show('join-panel');
  loadNearby();
});

$('btn-cancel-join').addEventListener('click', () => show(null));

/* ------------------------------------------------------------- listening */

function startListening() {
  if (!speechSupported) {
    $('listening-live').classList.add('hidden');
    $('manual-input').focus();
    return;
  }

  listener = createListener({
    onTranscript: ({ settled, interim }) => {
      state.transcript = `${settled} ${interim}`.trim();
      $('transcript-box').innerHTML = state.transcript
        ? `<b>${esc(settled)}</b> ${esc(interim)}`
        : '<span class="faint">Waiting for speech…</span>';
    },
    onStatus: (status) => {
      const messages = {
        listening: 'Listening to the scene…',
        quiet: 'Still listening — say what you can see',
        denied: 'Microphone blocked. Type it below instead.',
        unsupported: 'This browser has no speech input. Type it below.',
        error: 'Microphone trouble. Type it below instead.',
        stopped: 'Stopped listening'
      };
      $('listen-status').textContent = messages[status] || status;
    }
  });

  listener.start();
}

function renderDemoPhrases() {
  $('demo-phrases').innerHTML = DEMO_PHRASES
    .map((phrase, i) => `<button class="btn btn-ghost btn-sm" data-phrase="${i}">${esc(phrase.slice(0, 34))}…</button>`)
    .join('');

  $('demo-phrases').addEventListener('click', (event) => {
    const button = event.target.closest('[data-phrase]');
    if (!button) return;
    $('manual-input').value = DEMO_PHRASES[Number(button.dataset.phrase)];
    listener?.stop();
  });
}

/* ------------------------------------------------------------- classify */

$('btn-analyse').addEventListener('click', async () => {
  const typed = $('manual-input').value.trim();
  const transcript = typed || state.transcript;

  if (!transcript) {
    $('listen-status').textContent = 'Say or type what is happening first.';
    return;
  }

  listener?.stop();
  state.transcript = transcript;

  const button = $('btn-analyse');
  button.disabled = true;
  button.textContent = 'Identifying…';

  try {
    const result = await api.classify(transcript);
    state.suggestion = result;
    state.chosen = result.crisis;
    renderConfirm(result);
    show('confirm-panel');
  } catch (err) {
    $('listen-status').textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Identify the emergency';
  }
});

function renderConfirm(result) {
  const match = state.protocols.find((p) => p.id === result.crisis);
  const pct = Math.round((result.confidence || 0) * 100);

  $('confirm-label').textContent = match ? match.label : 'Could not tell — choose below';

  const chip = $('confirm-confidence');
  chip.textContent = match ? `${pct}% confident` : 'No match';
  chip.className = `chip ${pct >= 60 ? 'chip-ok' : 'chip-live'}`;

  const engine = result.source === 'claude' ? 'Claude' : 'The offline cue engine';
  $('confirm-heard').innerHTML = result.heard
    ? `${engine} keyed on <b style="color: var(--ink)">“${esc(result.heard)}”</b> in what you said.`
    : `${engine} could not find a clear signal. Pick the protocol yourself.`;

  renderProtocolPicker();

  const dispatch = $('btn-dispatch');
  const needsChoice = !state.chosen;
  dispatch.disabled = needsChoice;
  dispatch.textContent = needsChoice ? 'Choose an emergency type' : 'Open the scene & assign roles';
}

function renderProtocolPicker() {
  const picker = $('protocol-picker');
  if (!picker) return;
  picker.innerHTML = state.protocols
    .map((p) => `<button class="btn btn-sm ${p.id === state.chosen ? 'btn-role' : 'btn-ghost'}"
        data-protocol="${p.id}" style="--role: var(--red);">${esc(p.label)}</button>`)
    .join('');
}

$('protocol-picker').addEventListener('click', (event) => {
  const button = event.target.closest('[data-protocol]');
  if (!button) return;
  state.chosen = button.dataset.protocol;
  renderProtocolPicker();
  const match = state.protocols.find((p) => p.id === state.chosen);
  $('confirm-label').textContent = match.label;
  $('btn-dispatch').disabled = false;
  $('btn-dispatch').textContent = 'Open the scene & assign roles';
});

/* -------------------------------------------------------------- dispatch */

$('btn-dispatch').addEventListener('click', async () => {
  const button = $('btn-dispatch');
  button.disabled = true;
  button.textContent = 'Opening…';

  try {
    const { incident, responderId } = await api.open({
      transcript: state.transcript,
      crisis: state.chosen,
      place: $('place').value.trim(),
      name: $('your-name').value.trim()
    });
    location.href = `/incident?id=${incident.id}&r=${responderId}`;
  } catch (err) {
    button.disabled = false;
    button.textContent = 'Open the scene & assign roles';
    alert(err.message);
  }
});

/* ------------------------------------------------------------------ join */

async function loadNearby() {
  try {
    const { incidents } = await api.nearby();
    const list = $('nearby-list');

    if (!incidents.length) {
      list.innerHTML = '<p class="faint">Nothing active. Open an incident in another tab and it appears here.</p>';
      return;
    }

    list.innerHTML = incidents.map((i) => `
      <button class="board-row is-you" data-incident="${i.id}" style="--role: var(--red); width: 100%; text-align: left;">
        <span class="bar"></span>
        <span>
          <span class="board-role">${esc(i.label)}</span>
          <span class="board-who">${esc(i.place)} · ${i.responders} on scene</span>
        </span>
        <span class="board-open">${i.openRoles} role${i.openRoles === 1 ? '' : 's'} open →</span>
      </button>
    `).join('');
  } catch {
    $('nearby-list').innerHTML = '<p class="faint">Could not load nearby incidents.</p>';
  }
}

$('nearby-list').addEventListener('click', (event) => {
  const row = event.target.closest('[data-incident]');
  if (row) joinIncident(row.dataset.incident);
});

$('btn-join-code').addEventListener('click', async () => {
  const code = $('join-code').value.trim().toUpperCase();
  if (code.length !== 4) {
    $('join-error').textContent = 'Scene codes are 4 characters.';
    return;
  }
  try {
    const { id } = await api.byCode(code);
    joinIncident(id);
  } catch (err) {
    $('join-error').textContent = err.message;
  }
});

async function joinIncident(incidentId) {
  try {
    const { responderId } = await api.join(incidentId, $('join-name').value.trim());
    location.href = `/incident?id=${incidentId}&r=${responderId}&alert=1`;
  } catch (err) {
    $('join-error').textContent = err.message;
  }
}

// Keep the nearby list honest while the panel is open.
setInterval(() => {
  if (!$('join-panel').classList.contains('hidden')) loadNearby();
}, 4000);
