import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ambient speech capture.
 *
 * Two independent things run here, deliberately:
 *
 *  1. A microphone level meter, from getUserMedia + an AnalyserNode. This is the honest signal.
 *     It proves the mic is open and hearing you even when transcription produces nothing, which
 *     is the difference between "this app is broken" and "say it louder". It also forces the
 *     permission prompt up front instead of leaving SpeechRecognition to request it silently.
 *
 *  2. SpeechRecognition for the words themselves. In Chrome this is a *cloud* service, so it
 *     needs a working connection and a secure origin, and it fails in ways worth naming rather
 *     than sitting on "Listening…" forever.
 *
 * Audio never leaves the device until the user opens an incident; only the transcript is sent.
 * Typing is always available beside this and is never the lesser path.
 */

const Recognition = typeof window !== 'undefined'
  && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const speechSupported = Boolean(Recognition);

const MESSAGES = {
  idle: 'Ready when you are',
  requesting: 'Asking for the microphone…',
  listening: 'Listening — say what you can see',
  hearing: 'I can hear you',
  quiet: 'Microphone is on, but I am not picking up words yet',
  silent: 'The microphone is open but hearing nothing. Check it is not muted, or type below.',
  denied: 'Microphone permission was refused. Type it below instead.',
  insecure: 'Speech needs a secure connection (https or localhost). Type it below.',
  network: 'Speech recognition needs internet and cannot reach it. Type it below.',
  unsupported: 'This browser has no speech input. Type it below.',
  nomic: 'No microphone found. Type it below instead.',
  error: 'Microphone trouble. Type it below instead.',
  stopped: 'Stopped listening'
};

export function useSpeech() {
  const [transcript, setTranscript] = useState({ settled: '', interim: '' });
  const [status, setStatus] = useState('idle');
  const [level, setLevel] = useState(0);

  const recognitionRef = useRef(null);
  const runningRef = useRef(false);
  const settledRef = useRef('');
  const streamRef = useRef(null);
  const audioRef = useRef(null);
  const meterRef = useRef(null);
  const peakRef = useRef(0);
  const watchdogRef = useRef(null);

  const teardown = useCallback(() => {
    runningRef.current = false;
    clearInterval(meterRef.current);
    clearTimeout(watchdogRef.current);
    try { recognitionRef.current?.stop(); } catch { /* never started */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioRef.current?.close?.().catch(() => {});
    audioRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => teardown, [teardown]);

  const start = useCallback(async () => {
    if (!Recognition) { setStatus('unsupported'); return; }

    // Chrome silently refuses both APIs off a secure origin. Say so rather than hanging.
    if (!window.isSecureContext) { setStatus('insecure'); return; }

    setStatus('requesting');

    /* ---- 1. Microphone, and a live level so the user can see it working ---- */
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      // setInterval rather than rAF: the meter must keep working even when the tab is not
      // being painted, and 20fps is plenty for a level bar.
      meterRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i += 1) {
          const v = (buffer[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buffer.length);
        const scaled = Math.min(1, rms * 4); // Speech sits low in the range; make it visible.
        peakRef.current = Math.max(peakRef.current, scaled);
        setLevel(scaled);
      }, 50);
    } catch (err) {
      const name = err?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') setStatus('denied');
      else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') setStatus('nomic');
      else setStatus('error');
      return;
    }

    /* ---- 2. The words ---- */
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-IN';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) settledRef.current += `${result[0].transcript.trim()} `;
        else interim += result[0].transcript;
      }
      setTranscript({ settled: settledRef.current.trim(), interim: interim.trim() });
      setStatus('hearing');
    };

    recognition.onerror = (event) => {
      switch (event.error) {
        case 'not-allowed':
        case 'service-not-allowed': setStatus('denied'); break;
        case 'network': setStatus('network'); break;
        case 'no-speech': setStatus('quiet'); break;
        case 'aborted': break; // Our own restart. Not worth reporting.
        default: setStatus('error');
      }
    };

    // Chrome ends the stream after a pause. At a scene that pause is normal, so restart.
    recognition.onend = () => {
      if (!runningRef.current) { setStatus('stopped'); return; }
      try { recognition.start(); } catch { /* already restarting */ }
    };

    recognitionRef.current = recognition;
    runningRef.current = true;

    try {
      recognition.start();
      setStatus('listening');
    } catch {
      setStatus('error');
      return;
    }

    // If the mic has been open for a while and has never registered any sound at all,
    // the problem is the hardware, not the speaker. Say the useful thing.
    watchdogRef.current = setTimeout(() => {
      if (runningRef.current && peakRef.current < 0.02 && !settledRef.current) setStatus('silent');
    }, 7000);
  }, []);

  const stop = useCallback(() => { teardown(); setStatus('stopped'); }, [teardown]);

  const heard = `${transcript.settled} ${transcript.interim}`.trim();

  return {
    transcript,
    heard,
    status,
    message: MESSAGES[status] || status,
    level,
    listening: status === 'listening' || status === 'hearing' || status === 'quiet',
    start,
    stop
  };
}
