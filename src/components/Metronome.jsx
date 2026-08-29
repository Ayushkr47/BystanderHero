import { useEffect, useRef, useState } from 'react';

const BPM = 110; // Mid-point of the 100-120 lay-rescuer guideline band.

/**
 * Compression pacing.
 *
 * A visual beat alone is not enough — you are looking at the patient, not the phone — so this also
 * ticks audibly. The click is synthesised with an oscillator, which means there is no audio file
 * that can fail to load at the worst possible moment.
 */
export default function Metronome({ intervalMs = 60000 / BPM, label = `${BPM} beats per minute`, hint = 'push on every flash', sound = true }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!playing) return undefined;

    const ctx = audioRef.current || new (window.AudioContext || window.webkitAudioContext)();
    audioRef.current = ctx;
    ctx.resume?.();

    const click = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    };

    click();
    const timer = setInterval(click, intervalMs);
    return () => clearInterval(timer);
  }, [playing, intervalMs]);

  return (
    <div className="metronome" onClick={(e) => e.stopPropagation()}>
      <div className="beat-label"><span>{label}</span><span>{hint}</span></div>
      <div className="beat-track">
        <span className="beat-orb" style={{ animationDuration: `${intervalMs}ms` }} />
      </div>
      {sound && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${playing ? 'btn-role' : 'btn-ghost'}`}
            style={{ flex: 1 }}
            onClick={() => setPlaying(true)}
          >
            Sound on
          </button>
          <button
            type="button"
            className={`btn btn-sm ${playing ? 'btn-ghost' : 'btn-role'}`}
            style={{ flex: 1 }}
            onClick={() => setPlaying(false)}
          >
            Sound off
          </button>
        </div>
      )}
    </div>
  );
}
