import { api, subscribe, mmss, clockTime, esc } from './api.mjs';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const incidentId = params.get('id');
let responderId = params.get('r');
const arrivingFromAlert = params.get('alert') === '1';
let rejoining = false;

if (!incidentId || !responderId) location.href = '/';

let snap = null;
let me = null;
let lastLogTop = null;
let lastCrisis = null;
let compressionStartedAt = null;

/* ------------------------------------------------------- compression audio
   A visual beat is not enough when you are looking at the patient, not the phone.
   Generated with an oscillator so there is no audio file to fail to load. */

let audioCtx = null;
let metronomeTimer = null;

function clickSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.35, audioCtx.currentTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.09);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function startMetronome() {
  if (metronomeTimer) return;
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.resume?.();
  clickSound();
  metronomeTimer = setInterval(clickSound, 60000 / 110); // 110 bpm, mid of the 100-120 guideline band
}

function stopMetronome() {
  clearInterval(metronomeTimer);
  metronomeTimer = null;
}

/* ---------------------------------------------------------------- stream */

subscribe(incidentId, (state) => {
  snap = state;
  me = state.responders.find((r) => r.id === responderId) || null;

  // Phone locked, signal dropped, tab restored: the roster no longer knows us. Take a role
  // again rather than standing there roleless in the middle of an emergency.
  if (!me && state.status === 'active' && !rejoining) {
    rejoining = true;
    api.join(incidentId, sessionStorage.getItem('bh-name') || '')
      .then(({ responderId: fresh }) => {
        responderId = fresh;
        const url = new URL(location.href);
        url.searchParams.set('r', fresh);
        history.replaceState(null, '', url);
      })
      .finally(() => { rejoining = false; });
  }

  render();
});

api.snapshot(incidentId).catch(() => {
  document.body.innerHTML = '<main class="narrow" style="padding:4rem 0;"><h2>This scene has closed.</h2>'
    + '<p class="dim" style="margin-top:1rem;">Incidents are cleared once EMS takes over.</p>'
    + '<a class="btn" style="margin-top:1.5rem;" href="/">Back to start</a></main>';
});

// Leaving frees the role for whoever is still standing there.
window.addEventListener('pagehide', () => {
  navigator.sendBeacon?.(
    `/api/incident/${incidentId}/leave`,
    new Blob([JSON.stringify({ responderId })], { type: 'application/json' })
  );
});

/* ---------------------------------------------------------------- render */

function myRole() {
  if (!snap?.protocol || !me) return null;
  return snap.protocol.roles.find((r) => r.key === me.roleKey) || null;
}

function render() {
  if (!snap) return;

  renderHeader();
  renderIncoming();
  renderRole();
  renderSteps();
  renderActions();
  renderBoard();
  renderLog();
  renderTranscript();
  renderSwitcher();
}

function renderHeader() {
  $('hdr-crisis').textContent = snap.protocol ? snap.protocol.label : 'Awaiting confirmation';
  $('hdr-place').textContent = snap.place;
  $('hdr-clock').textContent = mmss(snap.elapsedSec);
  $('hdr-code').textContent = snap.code;
  $('hdr-responders').textContent = `${snap.responders.length} on scene`;
  $('hdr-status').textContent = snap.status === 'active' ? 'Live scene' : 'Closed';

  // Anything that changes the whole scene gets a banner, because heads are down.
  const banner = $('banner');
  if (snap.status !== 'active') {
    banner.classList.remove('hidden');
    $('banner-text').textContent = 'Scene closed. EMS has taken over.';
  } else if (snap.reliefRequested) {
    banner.classList.remove('hidden');
    $('banner-text').textContent = 'Someone needs relief and there is nobody spare — shout for another pair of hands.';
  } else if (lastCrisis && snap.crisis !== lastCrisis) {
    banner.classList.remove('hidden');
    $('banner-text').textContent = `Protocol changed to ${snap.protocol.label}. Your role has been reassigned — read it again.`;
    setTimeout(() => banner.classList.add('hidden'), 9000);
  } else {
    banner.classList.add('hidden');
  }
  lastCrisis = snap.crisis;
}

function renderIncoming() {
  const overlay = $('incoming');
  if (!arrivingFromAlert || overlay.dataset.done === '1' || !snap.protocol || !me) return;

  const role = myRole();
  overlay.classList.remove('hidden');
  $('incoming-crisis').textContent = snap.protocol.label;
  $('incoming-place').textContent = snap.place;
  $('incoming-role').textContent = role ? role.title : 'Standby';
  $('incoming-role-sub').textContent = role ? role.subtitle : 'Wait for a job. Do not crowd the patient.';

  $('incoming-go').onclick = () => {
    overlay.dataset.done = '1';
    overlay.classList.add('hidden');
  };
}

function renderRole() {
  const role = myRole();
  const hero = $('role-hero');

  if (me) sessionStorage.setItem('bh-name', me.name); // Survives a rejoin after signal loss.

  hero.dataset.role = me ? me.roleKey : 'standby';
  $('role-badge').textContent = me?.isPrimary ? 'You opened this scene' : 'Your job';
  $('role-title').textContent = role ? role.title : 'Stand by';
  $('role-sub').textContent = role
    ? role.subtitle
    : 'Every role is filled. Stay close, keep the crowd back, and be ready to take over.';
  $('role-you').textContent = me ? me.name : 'You';
}

function renderSteps() {
  const role = myRole();
  const container = $('steps');

  if (!role) {
    container.innerHTML = `<div class="panel"><p class="dim">
      Nothing assigned to you yet. The moment a role opens — someone tires, someone leaves —
      it lands here.</p></div>`;
    return;
  }

  // Exactly one step is "current": the first unticked one. Everything else recedes.
  const firstOpen = role.steps.find((s) => !snap.steps[`${role.key}:${s.key}`]);

  container.innerHTML = role.steps.map((step, index) => {
    const record = snap.steps[`${role.key}:${step.key}`];
    const isCurrent = firstOpen && step.key === firstOpen.key;
    const classes = ['step', record ? 'step-done' : '', isCurrent ? 'step-current' : ''].filter(Boolean).join(' ');

    return `
      <div class="${classes}" role="button" tabindex="0" data-step="${step.key}" data-role="${role.key}" data-done="${record ? '1' : '0'}">
        <span class="step-num">${record ? '✓' : index + 1}</span>
        <span>
          <span class="step-text">${esc(step.text)}</span>
          ${step.detail ? `<span class="step-detail">${esc(step.detail)}</span>` : ''}
          ${record ? `<span class="step-by">${esc(record.by)} · ${clockTime(record.at)}</span>` : ''}
          ${isCurrent ? renderStepMode(step) : ''}
        </span>
      </div>`;
  }).join('');
}

/** Extra apparatus attached to whichever step is live right now. */
function renderStepMode(step) {
  switch (step.mode) {
    case 'metronome':
      return `
        <span class="metronome">
          <span class="beat-label"><span>110 beats per minute</span><span id="beat-count">push on every flash</span></span>
          <span class="beat-track"><span class="beat-orb"></span></span>
          <span style="display:flex; gap:0.5rem; margin-top:0.7rem;">
            <button class="btn btn-sm btn-ghost" data-audio="on" style="flex:1;">Sound on</button>
            <button class="btn btn-sm btn-ghost" data-audio="off" style="flex:1;">Sound off</button>
          </span>
        </span>`;

    case 'rhythm5':
      return `
        <span class="metronome">
          <span class="beat-label"><span>Count them out loud</span><span>1 · 2 · 3 · 4 · 5</span></span>
          <span class="beat-track"><span class="beat-orb" style="animation-duration: 1s;"></span></span>
        </span>`;

    case 'dispatch':
      return `<span class="dispatch-quote">“${esc(snap.protocol.dispatchLine)}”</span>`;

    case 'timer':
      return `<span class="metronome">
          <span class="beat-label"><span>Running since the scene opened</span></span>
          <span class="clock" style="font-size:2.1rem;">${mmss(snap.elapsedSec)}</span>
        </span>`;

    case 'breathing':
      return `
        <span class="metronome">
          <span class="beat-label"><span>One breath every 5 seconds</span></span>
          <span class="beat-track"><span class="beat-orb" style="animation-duration: 5s;"></span></span>
        </span>`;

    case 'rotation': {
      const elapsed = compressionStartedAt ? (Date.now() - compressionStartedAt) / 1000 : 0;
      const due = elapsed > 120;
      return `<span class="metronome">
          <span class="beat-label"><span>Time on compressions</span><span style="color:${due ? 'var(--amber)' : 'inherit'}">${due ? 'SWAP NOW' : mmss(Math.max(0, 120 - elapsed)) + ' until swap'}</span></span>
        </span>`;
    }

    case 'escalate':
      return `<span style="display:block; margin-top:0.75rem;">
          <button class="btn btn-sm btn-role" data-escalate="${step.escalateTo}">
            Switch everyone to ${esc(step.escalateTo.replace('_', ' '))}
          </button>
        </span>`;

    default:
      return '';
  }
}

// Steps are divs so they can legally contain the metronome buttons; keep them keyboard-operable.
$('steps').addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('[data-step]')) {
    event.preventDefault();
    event.target.closest('[data-step]').click();
  }
});

$('steps').addEventListener('click', async (event) => {
  const audioButton = event.target.closest('[data-audio]');
  if (audioButton) {
    event.stopPropagation();
    if (audioButton.dataset.audio === 'on') startMetronome();
    else stopMetronome();
    return;
  }

  const escalateButton = event.target.closest('[data-escalate]');
  if (escalateButton) {
    event.stopPropagation();
    await api.setCrisis(incidentId, { crisis: escalateButton.dataset.escalate, responderId });
    return;
  }

  // Apparatus attached to a step (metronome, dispatch line) must not tick it off.
  if (event.target.closest('.metronome, .dispatch-quote')) return;

  const step = event.target.closest('[data-step]');
  if (!step) return;

  await api.step(incidentId, {
    responderId,
    roleKey: step.dataset.role,
    stepKey: step.dataset.step,
    done: step.dataset.done !== '1'
  });
});

function renderActions() {
  const role = myRole();
  const container = $('role-actions');
  const buttons = [];

  if (role && ['compressions', 'thrusts', 'pressure'].includes(role.key)) {
    buttons.push('<button class="btn btn-role" id="btn-relief" style="flex:1;">I am tiring — send my relief</button>');
  }
  if (role && role.key === 'dispatch') {
    buttons.push('<a class="btn btn-role" style="flex:1;" href="tel:911">Call 911</a>');
  }

  container.innerHTML = buttons.join('');
  const relief = $('btn-relief');
  if (relief) {
    relief.onclick = async () => {
      relief.disabled = true;
      relief.textContent = 'Calling for relief…';
      const result = await api.relief(incidentId, responderId);
      relief.disabled = false;
      relief.textContent = result.swapped ? 'Swapped' : 'No relief on scene — shout for one';
      compressionStartedAt = Date.now();
    };
  }
}

function renderBoard() {
  if (!snap.protocol) {
    $('board').innerHTML = '<p class="faint">Confirm the emergency type to assign roles.</p>';
    return;
  }

  $('board').innerHTML = snap.protocol.roles.map((role) => {
    const mine = me && me.roleKey === role.key;
    const open = role.slots - role.filled;
    return `
      <div class="board-row ${mine ? 'is-you' : ''}" data-role="${role.key}">
        <span class="bar"></span>
        <span>
          <span class="board-role">${esc(role.title)}${mine ? ' · you' : ''}</span>
          <span class="board-who">${role.holders.length ? esc(role.holders.join(', ')) : 'Unfilled'}</span>
        </span>
        ${open > 0
          ? `<span class="board-open">${open} needed</span>`
          : '<span class="chip chip-ok">covered</span>'}
      </div>`;
  }).join('');
}

function renderLog() {
  const html = snap.log.map((entry) => `
    <div class="log-item">
      <span class="log-time">${clockTime(entry.at)}</span>
      <span class="log-${esc(entry.kind)}">${esc(entry.text)}</span>
    </div>`).join('');

  // Only touch the DOM when the log actually moved, so the panel does not flicker every second.
  const top = snap.log[0] ? `${snap.log[0].at}:${snap.log.length}` : '';
  if (top !== lastLogTop) {
    $('log').innerHTML = html;
    lastLogTop = top;
  }
}

function renderTranscript() {
  const box = $('transcript');
  if (!snap.transcript.length) {
    box.innerHTML = '<span class="faint">Nothing captured.</span>';
    return;
  }
  const heard = snap.heard
    ? `<div style="margin-bottom:0.5rem;"><span class="chip chip-ai">${esc(snap.aiSource === 'claude' ? 'Claude' : 'cue engine')} keyed on “${esc(snap.heard)}”</span></div>`
    : '';
  box.innerHTML = heard + snap.transcript.map((t) => `<div>“${esc(t.text)}”</div>`).join('');
}

function renderSwitcher() {
  const picker = $('switch-picker');
  if (picker.dataset.built === '1') return;

  api.meta().then(({ protocols }) => {
    picker.innerHTML = protocols
      .map((p) => `<button class="btn btn-sm btn-ghost" data-switch="${p.id}">${esc(p.label)}</button>`)
      .join('');
    picker.dataset.built = '1';
  });
}

$('switch-picker').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-switch]');
  if (!button || button.dataset.switch === snap.crisis) return;
  await api.setCrisis(incidentId, { crisis: button.dataset.switch, responderId });
});

$('btn-close').addEventListener('click', async () => {
  stopMetronome();
  await api.close(incidentId, 'EMS on scene');
});

// Starts the two-minute rotation clock the first time compressions are actually assigned.
setInterval(() => {
  const role = myRole();
  if (role && role.key === 'compressions' && !compressionStartedAt) compressionStartedAt = Date.now();
  if (role && role.key !== 'compressions') {
    compressionStartedAt = null;
    stopMetronome();
  }
}, 1000);
