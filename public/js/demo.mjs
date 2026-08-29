/**
 * Demo director.
 *
 * Drives two real clients through the same real server. Nothing here is mocked or
 * pre-recorded: the frames talk to the same endpoints a phone would.
 */

import { api, esc } from './api.mjs';

const $ = (id) => document.getElementById(id);

const SCENARIOS = [
  {
    transcript: 'She just collapsed on the platform, she is not breathing, I cannot find a pulse, someone help',
    place: 'Platform 3, Central Station'
  },
  {
    transcript: 'He is choking, he cannot speak, he is grabbing at his throat and going red',
    place: 'Rossi’s, 40 High Street'
  },
  {
    transcript: 'There is blood everywhere, the cut on his leg is deep and it will not stop bleeding',
    place: 'Site entrance, Wharf Road'
  }
];

const CUES = [
  'Open on the empty stage. "An ambulance takes 4 to 8 minutes. This is what happens in between."',
  'Press 1. Maya speaks the emergency, the AI names it, she confirms. Point out the confidence figure.',
  'Phone A lands on its role: hands-on, one instruction dominant, 110 bpm metronome running.',
  'Press 2. Phone B flashes red without being asked. Read out its assignment: a DIFFERENT job.',
  'Tick a step on Phone B. Show it appear in Phone A’s scene log a second later.',
  'Press 3. A third responder arrives and is handed the third-priority role automatically.',
  'On Phone A, press "I am tiring". The role swaps across phones live.',
  'Close on the safety panel: dispatcher outranks the app, human can always override.'
];

let incidentId = null;
let cueIndex = 0;

renderCues();

function renderCues() {
  $('cues').innerHTML = CUES.map((cue, i) => `
    <div class="cue ${i === cueIndex ? 'cue-live' : ''}">
      <span class="cue-n">${i + 1}</span>
      <p class="${i === cueIndex ? '' : 'dim'}">${esc(cue)}</p>
    </div>`).join('');
}

function advance(to) {
  cueIndex = to;
  renderCues();
}

function status(text) {
  $('d-status').textContent = text;
}

/* ------------------------------------------------------------- sequence */

$('d1').addEventListener('click', async () => {
  const scenario = SCENARIOS[Number($('scenario').value)];
  status('Classifying what Maya said…');

  try {
    const { incident, responderId } = await api.open({
      transcript: scenario.transcript,
      place: scenario.place,
      name: 'Maya'
    });

    incidentId = incident.id;
    $('phone-a').src = `/incident?id=${incident.id}&r=${responderId}`;
    $('a-role').textContent = incident.responders[0]?.roleTitle || 'assigned';

    $('d2').disabled = false;
    $('d1').disabled = true;
    advance(2);
    status(`Scene ${incident.code} open · ${incident.protocol.label} · ${Math.round(incident.confidence * 100)}% confidence from the ${incident.aiSource === 'claude' ? 'Claude' : 'offline'} classifier.`);
  } catch (err) {
    status(err.message);
  }
});

$('d2').addEventListener('click', async () => {
  if (!incidentId) return;
  status('Pulling in a nearby responder…');

  const { responderId, incident } = await api.join(incidentId, 'Dev');
  // alert=1 makes Phone B open on the full-bleed incoming screen, the way a pocket alert would.
  $('phone-b').src = `/incident?id=${incidentId}&r=${responderId}&alert=1`;

  const dev = incident.responders.find((r) => r.id === responderId);
  $('b-role').textContent = dev ? dev.roleTitle : 'assigned';

  $('d2').disabled = true;
  $('d3').disabled = false;
  advance(3);
  status(`Dev was assigned "${dev ? dev.roleTitle : 'a role'}" — deliberately not the job Maya is doing.`);
});

$('d3').addEventListener('click', async () => {
  if (!incidentId) return;
  const { incident } = await api.join(incidentId, 'Priya');
  const priya = incident.responders[incident.responders.length - 1];
  $('d3').disabled = true;
  advance(5);
  status(`Priya joined and took "${priya.roleTitle}". Watch both phones update their role board.`);
});

$('reset').addEventListener('click', async () => {
  if (incidentId) await api.close(incidentId, 'demo reset').catch(() => {});
  incidentId = null;
  $('phone-a').src = '/';
  $('phone-b').src = '/';
  $('a-role').textContent = 'first on scene';
  $('b-role').textContent = '40 metres away';
  $('d1').disabled = false;
  $('d2').disabled = true;
  $('d3').disabled = true;
  advance(0);
  status('Stage reset. Press 1 to open a scene.');
});
