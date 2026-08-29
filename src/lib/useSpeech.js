import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ambient speech capture.
 *
 * Uses the browser's own SpeechRecognition, so audio never leaves the device until the user
 * commits to opening an incident. Only the transcript is ever sent, never the audio.
 *
 * Support is uneven (Chrome and Edge yes, Firefox no, Safari partial) and a noisy street defeats
 * it regularly, so typing is always offered alongside and never treated as the lesser path.
 */

const Recognition = typeof window !== 'undefined'
  && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const speechSupported = Boolean(Recognition);

const MESSAGES = {
  idle: 'Ready when you are',
  listening: 'Listening to the scene…',
  quiet: 'Still listening — say what you can see',
  denied: 'Microphone blocked. Type it below instead.',
  unsupported: 'This browser has no speech input. Type it below.',
  error: 'Microphone trouble. Type it below instead.',
  stopped: 'Stopped listening'
};

export function useSpeech() {
  const [transcript, setTranscript] = useState({ settled: '', interim: '' });
  const [status, setStatus] = useState('idle');

  const recognitionRef = useRef(null);
  const runningRef = useRef(false);
  const settledRef = useRef('');

  useEffect(() => () => {
    runningRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* never started */ }
  }, []);

  const start = useCallback(() => {
    if (!Recognition) {
      setStatus('unsupported');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) settledRef.current += `${result[0].transcript.trim()} `;
        else interim += result[0].transcript;
      }
      setTranscript({ settled: settledRef.current.trim(), interim: interim.trim() });
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setStatus('denied');
      else if (event.error === 'no-speech') setStatus('quiet');
      else setStatus('error');
    };

    // Chrome cuts the stream after a pause. At a scene that pause is normal, so restart.
    recognition.onend = () => {
      if (runningRef.current) {
        try { recognition.start(); } catch { /* already restarting */ }
      } else {
        setStatus('stopped');
      }
    };

    recognitionRef.current = recognition;
    runningRef.current = true;
    try {
      recognition.start();
      setStatus('listening');
    } catch {
      setStatus('error');
    }
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* never started */ }
  }, []);

  const heard = `${transcript.settled} ${transcript.interim}`.trim();

  return { transcript, heard, status, message: MESSAGES[status] || status, start, stop };
}
