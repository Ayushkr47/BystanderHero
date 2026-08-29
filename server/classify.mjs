/**
 * Crisis classification.
 *
 * Two tiers, in this order:
 *   1. Claude (claude-opus-5) when ANTHROPIC_API_KEY is set. Better at messy panicked speech
 *      ("he just went down, he's not- he isn't doing anything") than any keyword list.
 *   2. A deterministic cue-scoring fallback that runs offline, so a dead network or a
 *      missing key never leaves a bystander staring at a spinner.
 *
 * Whatever comes back is a SUGGESTION. The UI always exposes a one-tap override, because
 * a wrong protocol pushed to four people is worse than no protocol at all.
 */

import { PROTOCOLS, PROTOCOL_LIST } from './protocols.mjs';

const MODEL = 'claude-opus-5';
const API_KEY = process.env.ANTHROPIC_API_KEY;

export const AI_MODE = API_KEY ? 'claude' : 'offline';

const SYSTEM = `You triage panicked bystander speech at the scene of a medical emergency.

You will receive a rough, possibly garbled speech-to-text transcript of what people at the scene are shouting. Identify which single emergency protocol should be dispatched to the bystanders.

Allowed protocol ids (choose exactly one):
${PROTOCOL_LIST.map((p) => `- ${p.id}: ${p.label} (${p.short})`).join('\n')}

Rules:
- Judge only from what is actually said. Do not invent symptoms.
- Prefer the protocol that is most dangerous if missed, when the transcript is genuinely ambiguous between two.
- "confidence" is your honest 0-1 confidence. Below 0.6 means a human must confirm before the app commits.
- "heard" is the single short phrase from the transcript that drove your decision, quoted.
- Never diagnose beyond protocol selection. You are routing, not practising medicine.

Reply with ONLY a JSON object, no prose, no markdown fence:
{"crisis":"<id>","confidence":<0-1>,"heard":"<quoted phrase>"}`;

/** Deterministic cue scorer. Runs when there is no API key, or when Claude fails. */
function classifyOffline(transcript) {
  const text = ` ${String(transcript || '').toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ')} `;
  let best = null;

  for (const protocol of Object.values(PROTOCOLS)) {
    let score = 0;
    let heard = '';
    for (const cue of protocol.cues) {
      if (text.includes(` ${cue} `) || text.includes(` ${cue}`)) {
        // Longer cues are more specific, so they are worth more.
        const weight = 1 + cue.split(' ').length * 0.5;
        score += weight;
        if (cue.length > heard.length) heard = cue;
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { crisis: protocol.id, score, heard };
  }

  if (!best) {
    return { crisis: null, confidence: 0, heard: '', source: 'offline' };
  }
  // Squash the raw score into a confidence that tops out just under certainty.
  const confidence = Math.min(0.94, 0.45 + best.score * 0.13);
  return { crisis: best.crisis, confidence: Number(confidence.toFixed(2)), heard: best.heard, source: 'offline' };
}

async function classifyWithClaude(transcript) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000); // A bystander will not wait longer.

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Transcript from the scene:\n"""${transcript}"""` }]
      })
    });

    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    const raw = (data.content || []).map((b) => b.text || '').join('').trim();
    const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json);

    if (!PROTOCOLS[parsed.crisis]) throw new Error(`unknown protocol ${parsed.crisis}`);
    return {
      crisis: parsed.crisis,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      heard: String(parsed.heard || '').slice(0, 140),
      source: 'claude'
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * @param {string} transcript raw speech-to-text from the scene
 * @returns {Promise<{crisis:string|null, confidence:number, heard:string, source:string}>}
 */
export async function classify(transcript) {
  if (!transcript || !transcript.trim()) {
    return { crisis: null, confidence: 0, heard: '', source: 'empty' };
  }

  if (API_KEY) {
    try {
      return await classifyWithClaude(transcript);
    } catch (err) {
      // Degrade, never fail. Someone is on the floor.
      console.warn('[classify] Claude unavailable, using offline cues:', err.message);
      const fallback = classifyOffline(transcript);
      return { ...fallback, source: 'offline-fallback' };
    }
  }

  return classifyOffline(transcript);
}
