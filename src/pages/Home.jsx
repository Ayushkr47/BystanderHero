import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSpeech, speechSupported } from '../lib/useSpeech';
import { useReveal } from '../lib/useReveal';
import SafetyBar from '../components/SafetyBar';
import SceneStage from '../components/SceneStage';

const DEMO_PHRASES = [
  "He's choking! He can't speak, he's grabbing his throat!",
  'She just collapsed, she is not breathing, I cannot find a pulse',
  'There is blood everywhere, the cut is really deep, it will not stop',
  'He is on the floor shaking, I think it is a seizure',
  'She is not waking up, her lips are blue, I think she took something'
];

/* The order the system actually runs in, which is why these are numbered. */
const SEQUENCE = [
  {
    title: 'It listens to the shouting',
    body: 'Speech from the scene goes to Claude, which picks one of five protocols and reports how confident it is. Below 60%, or any time you disagree, a human confirms before anything is sent. No signal? A cue engine on the server does the same job offline.'
  },
  {
    title: 'It hands out different jobs',
    body: 'Nobody has to volunteer, because nobody is asked. Each phone that arrives is given the next unfilled role in survival order — compressions, the 911 call, the AED, clearing the way, relief.'
  },
  {
    title: 'Everyone sees the same scene',
    body: 'One shared session. When the person who ran for the AED ticks “pads attached”, it appears on the compressor’s phone within a second. One clock, one checklist, no duplicated effort and no gaps.'
  },
  {
    title: 'It keeps the quality up',
    body: 'A 110 bpm metronome holds the compression rate, in sound and on screen. Relief is prompted at two minutes and swaps the role to another phone in one tap, because compressions go bad long before the person doing them notices.'
  }
];

const SAFETY = [
  ['The dispatcher outranks the app.', 'Every protocol says so on screen, inside the role holding the phone call. If 911 says something different, 911 wins.'],
  ['It never diagnoses.', 'The model chooses between five published lay-rescuer protocols and does nothing else. It cannot invent an instruction, because every instruction is written in advance.'],
  ['A human can always override.', 'Low confidence blocks dispatch until someone confirms, and any responder can switch protocol mid-incident, which rebriefs the whole scene.'],
  ['It assumes untrained hands.', 'No blind finger sweeps, no restraining a seizure, no lifting a dressing to check a bleed.']
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

  useReveal([screen]);

  useEffect(() => {
    api.meta().then(({ aiMode: mode, protocols: p }) => { setAiMode(mode); setProtocols(p); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (screen !== 'join') return undefined;
    const load = () => api.nearby().then(({ incidents }) => setNearby(incidents)).catch(() => {});
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [screen]);

  const openPanel = (next) => {
    setScreen(next);
    requestAnimationFrame(() => {
      document.getElementById('panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const startListening = () => {
    setError('');
    openPanel('listen');
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
      openPanel('confirm');
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
        <strong>Real emergency? Call 911 (or your local number) first.</strong>{' '}
        BystanderHero helps the people already there. It does not replace dispatchers or paramedics.
      </SafetyBar>

      <main>
        {/* ============================================================ hero */}
        <section className="hero wrap">
          <div className="hero-grid">
            <div>
              <div className="row">
                <span className="chip chip-hivis">Prototype · RescueHacks</span>
                <span
                  className="chip chip-ai"
                  title={aiMode === 'claude'
                    ? 'ANTHROPIC_API_KEY detected. Transcripts are classified by claude-opus-5.'
                    : 'No API key set, so the deterministic cue engine is running. Everything still works.'}
                >
                  {aiMode === 'claude' ? 'Claude triage · live' : aiMode ? 'Offline cue triage' : 'AI triage'}
                </span>
              </div>

              <h1>The first four minutes belong to <em>whoever is already there.</em></h1>

              <p className="lede">
                Someone’s dad is face down on a station platform. Six people are standing over him
                with their phones out. Every one of them wants to help, and every one of them is
                waiting for somebody else to go first.
              </p>

              <p className="lede" style={{ marginTop: '1.1rem' }}>
                BystanderHero listens to the scene, works out what kind of emergency it is, and gives{' '}
                <strong>each person there a different job</strong> — on every phone at once, on one
                shared clock.
              </p>

              <div className="grid-2" style={{ marginTop: '2rem' }}>
                <button type="button" className="btn btn-emergency" onClick={startListening}>
                  I’m with someone — start now
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ minHeight: 92, fontSize: '1.05rem', fontWeight: 700 }}
                  onClick={() => openPanel('join')}
                >
                  Join an incident nearby
                </button>
              </div>

              <div className="stat-strip">
                <div>
                  <span className="stat-n">4–8<span style={{ fontSize: '1.1rem' }}>min</span></span>
                  <span className="stat-l">Typical wait for an ambulance</span>
                </div>
                <div>
                  <span className="stat-n" style={{ color: 'var(--alarm)' }}>~10%</span>
                  <span className="stat-l">Survival lost for every minute nobody acts</span>
                </div>
                <div>
                  <span className="stat-n" style={{ color: 'var(--aid)' }}>2×</span>
                  <span className="stat-l">Survival when a bystander starts CPR early</span>
                </div>
              </div>
            </div>

            <SceneStage />
          </div>
        </section>

        {/* =========================================================== panel */}
        <div className="wrap" id="panel">
          {screen === 'listen' && (
            <section className="card" style={{ maxWidth: 780, marginBottom: '3rem' }}>
              <div className="between" style={{ marginBottom: '1.25rem' }}>
                <div>
                  <div className="eyebrow">Step 1 of 2</div>
                  <h2 style={{ marginTop: '0.4rem', fontSize: '1.9rem' }}>What is happening?</h2>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { speech.stop(); setScreen(null); }}>
                  Cancel
                </button>
              </div>

              <div className="panel" style={{ background: 'var(--alarm-soft)', borderColor: 'rgba(217,43,31,0.3)', marginBottom: '1.25rem' }}>
                <strong style={{ fontSize: '1.05rem', color: '#a41d14' }}>Call 911 now if you have not already.</strong>
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

              <div className="stack" style={{ '--gap': '0.5rem', marginTop: '1.25rem' }}>
                <div className="eyebrow">Try one — for judges and testing</div>
                <div className="row">
                  {DEMO_PHRASES.map((phrase) => (
                    <button
                      key={phrase}
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setTyped(phrase); speech.stop(); }}
                    >
                      {phrase.slice(0, 32)}…
                    </button>
                  ))}
                </div>
              </div>

              {error && <p style={{ color: 'var(--alarm)', marginTop: '0.9rem', fontWeight: 600 }}>{error}</p>}

              <button type="button" className="btn btn-emergency" style={{ marginTop: '1.5rem' }} onClick={analyse} disabled={analysing}>
                {analysing ? 'Identifying…' : 'Identify the emergency'}
              </button>
            </section>
          )}

          {screen === 'confirm' && (
            <section className="card" style={{ maxWidth: 780, marginBottom: '3rem' }}>
              <div className="eyebrow">Step 2 of 2 — confirm before it goes to everyone</div>

              <div className="between" style={{ margin: '1rem 0 0.5rem' }}>
                <h2 style={{ fontSize: '2rem' }}>{suggestedLabel || 'Could not tell — choose below'}</h2>
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
                there and it is not. If it is wrong, change it — the right protocol matters more than
                the AI being right.
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                <div className="eyebrow">It is actually…</div>
                <div className="row" style={{ marginTop: '0.6rem' }}>
                  {protocols.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`btn btn-sm ${p.id === chosen ? 'btn-role' : 'btn-ghost'}`}
                      data-role={p.id === chosen ? 'compressions' : undefined}
                      onClick={() => setChosen(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid-2" style={{ marginTop: '1.5rem' }}>
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

              <button type="button" className="btn btn-emergency" style={{ marginTop: '1.5rem' }} onClick={dispatch} disabled={!chosen || dispatching}>
                {!chosen ? 'Choose an emergency type' : dispatching ? 'Opening…' : 'Open the scene & assign roles'}
              </button>

              <p className="faint" style={{ fontSize: '0.84rem', marginTop: '0.85rem', textAlign: 'center' }}>
                This alerts every BystanderHero user nearby and gives each of them a different job.
              </p>
            </section>
          )}

          {screen === 'join' && (
            <section className="card" style={{ maxWidth: 780, marginBottom: '3rem' }}>
              <div className="between" style={{ marginBottom: '1.25rem' }}>
                <div>
                  <div className="eyebrow">Responding</div>
                  <h2 style={{ marginTop: '0.4rem', fontSize: '1.9rem' }}>Join an incident</h2>
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
        </div>

        {/* ========================================================= problem */}
        <section className="wrap" style={{ padding: '3rem 0 1rem' }}>
          <div className="card reveal" style={{ padding: 'clamp(1.75rem, 4vw, 3rem)', background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }}>
            <div className="eyebrow" style={{ color: 'var(--hivis)' }}>The actual problem</div>
            <h2 style={{ margin: '1rem 0 1.25rem', maxWidth: '20ch' }}>
              It isn’t that nobody cares. It’s that nobody has a job.
            </h2>
            <div className="grid-2" style={{ gap: '2rem' }}>
              <p style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.65 }}>
                The bystander effect gets described as apathy. It isn’t. Ten people who each assume
                somebody else is handling it produce exactly the same outcome as an empty street —
                not because they don’t want to help, but because responsibility spread across a crowd
                belongs to no one in it.
              </p>
              <p style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.65 }}>
                That is a coordination failure, and coordination failures have a fix that motivation
                doesn’t: <span className="mark">assignment</span>. So this app never asks for
                volunteers. It tells Maya to start compressions, Dev to call 911, Priya to run for
                the AED — by name, at the same moment, on their own phones.
              </p>
            </div>
          </div>
        </section>

        {/* ==================================================== how it works */}
        <section className="wrap" style={{ padding: '3.5rem 0' }}>
          <div className="reveal" style={{ marginBottom: '2rem' }}>
            <div className="eyebrow">What happens, in order</div>
            <h2 style={{ margin: '0.7rem 0 0.6rem' }}>Four people, four jobs, one clock.</h2>
            <p className="lede">Roughly the first ninety seconds of an incident.</p>
          </div>

          <div className="thread">
            {SEQUENCE.map((beat, i) => (
              <div className="beat reveal-3d" style={{ '--delay': `${i * 90}ms` }} key={beat.title}>
                <div className="beat-n">{String(i + 1).padStart(2, '0')}</div>
                <div>
                  <h3>{beat.title}</h3>
                  <p className="dim" style={{ fontSize: '0.97rem' }}>{beat.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================== safety */}
        <section className="wrap" style={{ padding: '2rem 0 4rem' }}>
          <div className="reveal" style={{ marginBottom: '1.75rem' }}>
            <div className="eyebrow" style={{ color: 'var(--caution)' }}>Where this stops</div>
            <h2 style={{ margin: '0.7rem 0 0.6rem' }}>Built to defer.</h2>
            <p className="lede">
              Every one of these is enforced in the code, not promised in a readme.
            </p>
          </div>

          <div className="grid-2">
            {SAFETY.map(([lead, rest], i) => (
              <div className="card reveal-3d" style={{ '--delay': `${i * 80}ms` }} key={lead}>
                <h3 style={{ marginBottom: '0.5rem' }}>{lead}</h3>
                <p className="dim" style={{ fontSize: '0.95rem' }}>{rest}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="wrap" style={{ padding: '2rem 0 3.5rem', borderTop: '1px solid var(--rule-2)' }}>
          <div className="between">
            <p className="faint" style={{ fontSize: '0.85rem', maxWidth: '46ch', lineHeight: 1.5 }}>
              BystanderHero · built for RescueHacks · a prototype, not a medical device, and not a
              substitute for emergency services.
            </p>
            <a href="/demo" className="btn btn-sm">Open the two-phone demo →</a>
          </div>
        </footer>
      </main>
    </>
  );
}
