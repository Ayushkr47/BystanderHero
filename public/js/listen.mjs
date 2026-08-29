/**
 * Ambient speech capture.
 *
 * Uses the browser's own SpeechRecognition, so audio never leaves the device until the
 * user commits to opening an incident. Only the transcript is ever sent, never the audio.
 *
 * Support is uneven (Chrome and Edge yes, Firefox no, Safari partial) and a noisy street
 * defeats it regularly, so typing is always available and never treated as the lesser path.
 */

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const speechSupported = Boolean(Recognition);

export function createListener({ onTranscript, onStatus }) {
  if (!Recognition) {
    return {
      start: () => onStatus?.('unsupported'),
      stop: () => {},
      supported: false
    };
  }

  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || 'en-US';

  let running = false;
  let settled = '';

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal) settled += `${result[0].transcript.trim()} `;
      else interim += result[0].transcript;
    }
    onTranscript?.({ settled: settled.trim(), interim: interim.trim() });
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') onStatus?.('denied');
    else if (event.error === 'no-speech') onStatus?.('quiet');
    else onStatus?.('error');
  };

  // Chrome cuts the stream after a pause. At a scene that pause is normal, so restart.
  recognition.onend = () => {
    if (running) {
      try { recognition.start(); } catch { /* already restarting */ }
    } else {
      onStatus?.('stopped');
    }
  };

  return {
    supported: true,
    start() {
      running = true;
      try {
        recognition.start();
        onStatus?.('listening');
      } catch {
        onStatus?.('error');
      }
    },
    stop() {
      running = false;
      try { recognition.stop(); } catch { /* not started */ }
    },
    reset() { settled = ''; }
  };
}
