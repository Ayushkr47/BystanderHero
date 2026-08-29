import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSpeech, speechSupported } from '../lib/useSpeech';
import SafetyBar from '../components/SafetyBar';

const DEMO_PHRASES = [
  "He's choking! He can't speak, he's grabbing his throat!",
  'She just collapsed, she is not breathing, I cannot find a pulse',
  'There is blood everywhere, the cut is really deep, it will not stop',
  'He is on the floor shaking, I think it is a seizure',
  'She is not waking up, her lips are blue, I think she took something'
];

const HOW_IT_WORKS = [
  {
    n: '01 · Hear', color: 'var(--violet)', title: 'It listens to the shouting',
    body: 'Speech from the scene goes to Claude, which picks one protocol out of five and reports how confident it is. Under 60% confidence, or any time you disagree, a human confirms first. No network? A cue engine on the server does the same job offline.'
  },
  {
    n: '02 · Split', color: 'var(--red)', title: 'It splits the work',
    body: 'The bystander effect is a coordination failure, not apathy. So nobody chooses. Each arriving phone is handed the next unfilled role in survival order — compressions, the 911 call, the AED, crowd control, relief.'
  },
  {
    n: '03 · Sync', color: 'var(--blue)', title: 'Everyone sees the same scene',
    body: 'One shared session over server-sent events. When the AED runner ticks "AED attached", it appears on the compressor’s phone instantly. One clock, one checklist, no duplicated effort, no gaps.'
  },
  {
    n: '04 · Sustain', color: 'var(--teal)', title: 'It keeps the quality up',
    body: 'A 110 bpm visual metronome holds the compression rate. Relief rotation is prompted every two minutes and swaps roles across phones in one tap, because tired compressions stop working long before the person doing them notices.'
  }
];

export default function Home() {
  const [screen, setScreen] = useState(null); // null | 'listen' | 'confirm' | 'join'
  const [aiMode, setAiMode] = useState(null);
  const [protocols, setProtocols] = useState([]);

  const [typed, setTyped] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [place, setPlace] = useState('');

  const [nearby, setNearby] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinError, setJoinError] = useState('');

  const speech = useSpeech();
  const transcript = typed.trim() || speech.heard;

  useEffect(() => {
    api.meta().then(({ aiMode: mode, protocols: p }) => { setAiMode(mode); setProtocols(p); }).catch(() => {});
  }, []);

  // Keep the nearby list honest while someone is looking at it.
  useEffect(() => {
    if (screen !== 'join') return undefined;
    const load = () => api.nearby().then(({ incidents }) => setNearby(incidents)).catch(() => {});
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [screen]);

  const startListening = () => {
    setScreen('listen');
    setError('');
    if (speechSupported) speech.start();
  };

  const analyse = async () => {
    if (!transcript) {
      setError('Say or type what is happening first.');
      return;
    }
    speech.stop();
    setAnalysing(true);
    try {
      const result = await api.classify(transcript);
      setSuggestion(result);
      setChosen(result.crisis);
      setScreen('confirm');
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalysing(false);
    }
  };

  const dispatch = async () => {
    setDispatching(true);
    try {
      const { incident, responderId } = await api.open({
        transcript, crisis: chosen, place: place.trim(), name: name.trim()
      });
      window.location.href = `/incident?id=${incident.id}&r=${responderId}`;
    } catch (err) {
      setError(err.message);
      setDispatching(false);
    }
  };

  const join = async (incidentId) => {
    try {
      const { responderId } = await api.join(incidentId, joinName.trim());
      window.location.href = `/incident?id=${incidentId}&r=${responderId}&alert=1`;
    } catch (err) {
      setJoinError(err.message);
    }
  };

  const joinByCode = async () => {
    if (joinCode.trim().length !== 4) {
      setJoinError('Scene codes are 4 characters.');
      return;
    }
    try {
      const { id } = await api.byCode(joinCode.trim().toUpperCase());
      join(id);
    } catch (err) {
      setJoinError(err.message);
    }
  };

  const suggestedLabel = protocols.find((p) => p.id === chosen)?.label;
  const confidencePct = Math.round((suggestion?.confidence || 0) * 100);

  return (
    <>
      <SafetyBar>
        <strong>If this is a real emergency, call 911 (or your local number) first.</strong>{' '}
        BystanderHero supports bystanders. It does not replace dispatchers or paramedics.
      </SafetyBar>

      <main className="wrap" style={{ padding: '3.5rem 0 4rem' }}>

        <section className="stack" style={{ '--gap': '1.5rem', maxWidth: 780 }}>
          <div className="row">
            <span className="chip chip-live"><span className="dot" /> Prototype</span>
            <span
              className="chip chip-ai"
              title={aiMode === 'claude'
                ? 'ANTHROPIC_API_KEY detected. Transcripts are classified by claude-opus-5.'
                : 'No API key set, so the deterministic cue engine is running. Everything still works.'}
            >
              {aiMode === 'claude' ? 'Claude triage · live' : aiMode ? 'Offline cue triage' : 'AI triage'}
            </span>
            <span className="chip">RescueHacks</span>
          </div>

          <h1>The first four minutes<br />belong to whoever<br />is already there.</h1>

          <p style={{ fontSize: '1.22rem', color: 'var(--ink-dim)', maxWidth: '60ch' }}>
            An ambulance takes 4 to 8 minutes. Survival from cardiac arrest falls about{' '}
            <strong style={{ color: 'var(--ink)' }}>10% for every minute</strong> nobody acts. The
            people who could act are already standing there — they just don&apos;t know what to do,
            or assume someone else will.
          </p>

          <p style={{ fontSize: '1.22rem', color: 'var(--ink-dim)', maxWidth: '60ch' }}>
            BystanderHero listens to the scene, works out what kind of emergency it is, and gives{' '}
            <strong style={{ color: 'var(--ink)' }}>every person present a different job</strong> —
            synchronised live, on every phone at once.
          </p>

          <div className="grid-2" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-emergency" onClick={startListening}>
              I&apos;m with someone — start now
            </button>
            <button
              type="button"
              className="btn"
              style={{ minHeight: 96, fontSize: '1.15rem', fontWeight: 750 }}
              onClick={() => setScreen('join')}
            >
              Join an incident nearby
            </button>
          </div>
        </section>

        {screen === 'listen' && (
          <section className="card" style={{ marginTop: '2rem', maxWidth: 780 }}>
            <div className="between" style={{ marginBottom: '1.25rem' }}>
              <div>
                <div className="eyebrow">Step 1 of 2</div>
                <h2 style={{ marginTop: '0.3rem' }}>What is happening?</h2>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { speech.stop(); setScreen(null); }}
              >
                Cancel
              </button>
            </div>

            <div
              className="panel"
              style={{ background: '#2a0b09', borderColor: 'rgba(255,59,48,0.4)', marginBottom: '1.25rem' }}
            >
              <strong style={{ fontSize: '1.05rem' }}>Call 911 now if you have not already.</strong>
              <p className="dim" style={{ marginTop: '0.3rem', fontSize: '0.92rem' }}>
                Put them on speaker and keep talking to them while you use this.
              </p>
            </div>

            {speechSupported && (
              <div className="stack" style={{ '--gap': '1rem', textAlign: 'center' }}>
                <div className="listening-orb">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{speech.message}</div>
                  <div className="faint" style={{ fontSize: '0.88rem', marginTop: '0.25rem' }}>
                    Say out loud what you can see.
                  </div>
                </div>
                <div className="panel transcript" style={{ textAlign: 'left', minHeight: 74 }}>
                  {speech.heard
                    ? <><b>{speech.transcript.settled}</b> {speech.transcript.interim}</>
                    : <span className="faint">Waiting for speech…</span>}
                </div>
              </div>
            )}

            <div style={{ marginTop: '1rem' }}>
              <label className="eyebrow" htmlFor="manual">
                {speechSupported ? 'Or type it — faster than fighting a microphone' : 'Type what is happening'}
              </label>
              <textarea
                id="manual"
                className="field"
                style={{ marginTop: '0.5rem' }}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="He's choking, he can't speak, he's grabbing his throat"
              />
            </div>

            <div className="stack" style={{ '--gap': '0.5rem', marginTop: '1rem' }}>
              <div className="eyebrow">Demo phrases — for judges and testing</div>
              <div className="row">
                {DEMO_PHRASES.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setTyped(phrase); speech.stop(); }}
                  >
                    {phrase.slice(0, 34)}…
                  </button>
                ))}
              </div>
            </div>

            {error && <p style={{ color: 'var(--amber)', marginTop: '0.75rem' }}>{error}</p>}

            <button
              type="button"
              className="btn btn-emergency"
              style={{ marginTop: '1.25rem' }}
              onClick={analyse}
              disabled={analysing}
            >
              {analysing ? 'Identifying…' : 'Identify the emergency'}
            </button>
          </section>
        )}

        {screen === 'confirm' && (
          <section className="card" style={{ marginTop: '2rem', maxWidth: 780 }}>
            <div className="eyebrow">Step 2 of 2 — confirm before it goes to everyone</div>

            <div className="between" style={{ margin: '1rem 0 0.4rem' }}>
              <h2>{suggestedLabel || 'Could not tell — choose below'}</h2>
              <span className={`chip ${confidencePct >= 60 ? 'chip-ok' : 'chip-live'}`}>
                {suggestion?.crisis ? `${confidencePct}% confident` : 'No match'}
              </span>
            </div>

            <p className="dim" style={{ fontSize: '0.95rem' }}>
              {suggestion?.heard
                ? <>
                    {suggestion.source === 'claude' ? 'Claude' : 'The offline cue engine'} keyed on{' '}
                    <b style={{ color: 'var(--ink)' }}>“{suggestion.heard}”</b> in what you said.
                  </>
                : 'No clear signal was found. Pick the protocol yourself.'}
            </p>

            <div className="disclaimer" style={{ marginTop: '1.25rem' }}>
              This is a <strong>suggestion from an AI</strong>, not a diagnosis. You are standing
              there and it is not. If this is wrong, change it — the correct protocol matters more
              than the AI being right.
            </div>

            <div style={{ marginTop: '1.25rem' }}>
              <div className="eyebrow">It is actually…</div>
              <div className="row" style={{ marginTop: '0.6rem' }}>
                {protocols.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`btn btn-sm ${p.id === chosen ? 'btn-role' : 'btn-ghost'}`}
                    onClick={() => setChosen(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: '1.25rem' }}>
              <div>
                <label className="eyebrow" htmlFor="name">Your first name</label>
                <input id="name" className="field" style={{ marginTop: '0.5rem' }} maxLength={24}
                  value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam" />
              </div>
              <div>
                <label className="eyebrow" htmlFor="place">Where are you?</label>
                <input id="place" className="field" style={{ marginTop: '0.5rem' }} maxLength={60}
                  value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Platform 3, Central Station" />
              </div>
            </div>

            <button
              type="button"
              className="btn btn-emergency"
              style={{ marginTop: '1.25rem' }}
              onClick={dispatch}
              disabled={!chosen || dispatching}
            >
              {!chosen ? 'Choose an emergency type' : dispatching ? 'Opening…' : 'Open the scene & assign roles'}
            </button>

            <p className="faint" style={{ fontSize: '0.84rem', marginTop: '0.75rem', textAlign: 'center' }}>
              This alerts every BystanderHero user nearby and gives each of them a different job.
            </p>
          </section>
        )}

        {screen === 'join' && (
          <section className="card" style={{ marginTop: '2rem', maxWidth: 780 }}>
            <div className="between" style={{ marginBottom: '1.25rem' }}>
              <div>
                <div className="eyebrow">Responding</div>
                <h2 style={{ marginTop: '0.3rem' }}>Join an incident</h2>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setScreen(null)}>Cancel</button>
            </div>

            <div className="eyebrow">Active near you</div>
            <div className="stack" style={{ '--gap': '0.6rem', marginTop: '0.6rem' }}>
              {nearby.length === 0 && (
                <p className="faint">Nothing active. Open an incident in another tab and it appears here.</p>
              )}
              {nearby.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  className="board-row is-you"
                  data-role="compressions"
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => join(i.id)}
                >
                  <span className="bar" />
                  <span>
                    <span className="board-role">{i.label}</span>
                    <span className="board-who">{i.place} · {i.responders} on scene</span>
                  </span>
                  <span className="board-open">{i.openRoles} role{i.openRoles === 1 ? '' : 's'} open →</span>
                </button>
              ))}
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <label className="eyebrow" htmlFor="code">Or enter the 4-character scene code</label>
              <div className="row" style={{ marginTop: '0.6rem', flexWrap: 'nowrap' }}>
                <input
                  id="code"
                  className="field mono"
                  style={{ letterSpacing: '0.25em', textTransform: 'uppercase' }}
                  maxLength={4}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && joinByCode()}
                  placeholder="A4KF"
                />
                <button type="button" className="btn" style={{ flexShrink: 0 }} onClick={joinByCode}>Join</button>
              </div>
              {joinError && <p className="faint" style={{ fontSize: '0.86rem', marginTop: '0.5rem' }}>{joinError}</p>}
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <label className="eyebrow" htmlFor="joinname">Your first name</label>
              <input id="joinname" className="field" style={{ marginTop: '0.5rem' }} maxLength={24}
                value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="Alex" />
            </div>
          </section>
        )}

        <section style={{ marginTop: '5rem' }}>
          <div className="eyebrow">How it works</div>
          <h2 style={{ margin: '0.6rem 0 1.75rem' }}>Four people, four jobs, one clock.</h2>
          <div className="grid-2">
            {HOW_IT_WORKS.map((card) => (
              <div className="card" key={card.n}>
                <div className="role-badge" style={{ '--role': card.color }}>{card.n}</div>
                <h3 style={{ margin: '0.85rem 0 0.5rem' }}>{card.title}</h3>
                <p className="dim" style={{ fontSize: '0.95rem' }}>{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card" style={{ marginTop: '3rem', borderColor: 'rgba(255,176,32,0.3)' }}>
          <div className="eyebrow" style={{ color: 'var(--amber)' }}>Where this stops</div>
          <h2 style={{ margin: '0.6rem 0 1rem' }}>Designed to defer.</h2>
          <div className="stack" style={{ '--gap': '0.85rem', maxWidth: '68ch' }}>
            <p className="dim">
              <strong style={{ color: 'var(--ink)' }}>The dispatcher outranks the app.</strong> Every
              protocol says so, on screen, in the role that holds the phone call. If 911 says
              something different, 911 wins.
            </p>
            <p className="dim">
              <strong style={{ color: 'var(--ink)' }}>It never diagnoses.</strong> The AI picks
              between five published lay-rescuer protocols and nothing else. It cannot invent an
              instruction, because every instruction is written in advance and reviewed — the model
              only routes.
            </p>
            <p className="dim">
              <strong style={{ color: 'var(--ink)' }}>A human can always override.</strong> Low
              confidence blocks dispatch until someone confirms, and any responder can switch
              protocol mid-incident, which rebriefs the whole scene.
            </p>
            <p className="dim">
              <strong style={{ color: 'var(--ink)' }}>It assumes untrained hands.</strong> Guidance
              stays inside what a layperson can safely do: no blind finger sweeps, no restraining a
              seizure, no lifting a dressing to check a bleed.
            </p>
          </div>
        </section>

        <footer style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--line)' }}>
          <div className="between">
            <p className="faint" style={{ fontSize: '0.85rem' }}>
              BystanderHero · built for RescueHacks · prototype, not a medical device
            </p>
            <a href="/demo" className="btn btn-ghost btn-sm">Open the two-phone demo →</a>
          </div>
        </footer>
      </main>
    </>
  );
}
