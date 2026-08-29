import { useRef, useState } from 'react';
import { api } from '../lib/api';
import SafetyBar from '../components/SafetyBar';

/**
 * Demo director.
 *
 * Drives two real clients through the same real server. Nothing here is mocked or pre-recorded:
 * the frames hit the same endpoints a phone would, over the same live session.
 */

const SCENARIOS = [
  {
    label: 'Cardiac arrest — Mumbai local platform',
    transcript: 'She just collapsed on the platform, she is not breathing, I cannot find a pulse, someone help',
    place: 'Platform 3, Dadar Station, Mumbai'
  },
  {
    label: 'Choking — restaurant, Bengaluru',
    transcript: 'He is choking, he cannot speak, he is grabbing at his throat and going red',
    place: 'Sagar Ratna, 12 MG Road, Bengaluru'
  },
  {
    label: 'Severe bleeding — construction site',
    transcript: 'There is blood everywhere, the cut on his leg is deep and it will not stop bleeding',
    place: 'Site gate, Outer Ring Road, Hyderabad'
  }
];

const CUES = [
  'Open on the empty stage. "An ambulance takes 4 to 8 minutes. This is what happens in between."',
  'Press 1. Meera speaks the emergency, the AI names it, she confirms. Point out the confidence figure.',
  'Phone A lands on its role: hands-on, one instruction dominant, 110 bpm metronome running.',
  'Press 2. Phone B flashes red without being asked. Read out its assignment: a DIFFERENT job.',
  'Tick a step on Phone B. Show it appear in Phone A’s scene log a second later.',
  'Press 3. A third responder arrives and is handed the third-priority role automatically.',
  'On Phone A, press "I am tiring". The role swaps across phones live.',
  'Close on the safety panel: the 112 operator outranks the app, and a human can always override.'
];

const WATCH_FOR = [
  ['Different jobs, not the same one.', 'Phone A gets the hands-on role. Phone B is never told to do the same thing — it gets the next most valuable unfilled job.'],
  ['One shared truth.', 'Tick a step on either phone and watch it appear in the other’s scene log within a second, over the same live session.'],
  ['The human stays in charge.', 'Switch protocol on either phone and both are rebriefed and reassigned. The AI’s guess is never final.'],
  ['Rotation is prompted.', 'Press "I am tiring" on Phone A and the role physically swaps to Phone B, because compression quality collapses before people admit it.']
];

export default function Demo() {
  const [scenario, setScenario] = useState(0);
  const [incidentId, setIncidentId] = useState(null);
  const [cue, setCue] = useState(0);
  const [status, setStatus] = useState('Nothing running. Press 1 to open a scene.');
  const [stage, setStage] = useState(0); // how far through the sequence we are
  const [roles, setRoles] = useState({ a: 'first on scene', b: '40 metres away' });

  const phoneA = useRef(null);
  const phoneB = useRef(null);

  const openScene = async () => {
    setStatus('Classifying what Meera said…');
    try {
      const { incident, responderId } = await api.open({
        transcript: SCENARIOS[scenario].transcript,
        place: SCENARIOS[scenario].place,
        name: 'Meera'
      });

      setIncidentId(incident.id);
      phoneA.current.src = `/incident?id=${incident.id}&r=${responderId}`;
      setRoles((r) => ({ ...r, a: incident.responders[0]?.roleTitle || 'assigned' }));
      setStage(1);
      setCue(2);
      setStatus(
        `Scene ${incident.code} open · ${incident.protocol.label} · ${Math.round(incident.confidence * 100)}% `
        + `confidence from the ${incident.aiSource === 'claude' ? 'Claude' : 'offline'} classifier.`
      );
    } catch (err) {
      setStatus(err.message);
    }
  };

  const alertNearby = async () => {
    setStatus('Pulling in a nearby responder…');
    const { responderId, incident } = await api.join(incidentId, 'Arun');
    // alert=1 opens Phone B on the full-bleed incoming screen, the way a pocket alert would.
    phoneB.current.src = `/incident?id=${incidentId}&r=${responderId}&alert=1`;

    const dev = incident.responders.find((r) => r.id === responderId);
    setRoles((r) => ({ ...r, b: dev ? dev.roleTitle : 'assigned' }));
    setStage(2);
    setCue(3);
    setStatus(`Arun was assigned "${dev?.roleTitle}" — deliberately not the job Meera is doing.`);
  };

  const thirdResponder = async () => {
    const { incident } = await api.join(incidentId, 'Priya');
    const priya = incident.responders[incident.responders.length - 1];
    setStage(3);
    setCue(5);
    setStatus(`Priya joined and took "${priya.roleTitle}". Watch both phones update their role board.`);
  };

  const reset = async () => {
    if (incidentId) await api.close(incidentId, 'demo reset').catch(() => {});
    setIncidentId(null);
    phoneA.current.src = '/';
    phoneB.current.src = '/';
    setRoles({ a: 'first on scene', b: '40 metres away' });
    setStage(0);
    setCue(0);
    setStatus('Stage reset. Press 1 to open a scene.');
  };

  return (
    <>
      <SafetyBar>
        <strong>Demonstration only.</strong> Simulated incident, simulated responders. In a real
        emergency, call 112.
      </SafetyBar>

      <main className="wrap" style={{ padding: '1.75rem 0 3rem' }}>
        <header className="between" style={{ marginBottom: '1.5rem' }}>
          <div>
            <div className="eyebrow">BystanderHero</div>
            <h2 style={{ marginTop: '0.4rem' }}>Two phones, one scene</h2>
            <p className="dim" style={{ marginTop: '0.35rem', fontSize: '0.95rem' }}>
              Both frames are real clients on the real server, synchronised over the same live session.
            </p>
          </div>
          <a className="btn btn-ghost btn-sm" href="/">← Back to the app</a>
        </header>

        <div className="stage">
          <aside className="stack" style={{ '--gap': '1rem' }}>
            <section className="card" style={{ padding: '1.1rem' }}>
              <div className="eyebrow">Scenario</div>
              <select
                className="field"
                style={{ marginTop: '0.6rem' }}
                value={scenario}
                onChange={(e) => setScenario(Number(e.target.value))}
                disabled={stage > 0}
              >
                {SCENARIOS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
              </select>

              <div className="stack" style={{ '--gap': '0.55rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-emergency"
                  style={{ minHeight: 64, fontSize: '1.05rem' }}
                  onClick={openScene}
                  disabled={stage >= 1}
                >
                  1 · Meera opens the scene
                </button>
                <button type="button" className="btn" onClick={alertNearby} disabled={stage !== 1}>
                  2 · Arun gets pulled in nearby
                </button>
                <button type="button" className="btn" onClick={thirdResponder} disabled={stage !== 2}>
                  3 · Third responder joins
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Reset the stage</button>
              </div>

              <p className="faint" style={{ fontSize: '0.8rem', marginTop: '0.9rem', lineHeight: 1.5 }}>
                {status}
              </p>
            </section>

            <section className="card" style={{ padding: '1.1rem' }}>
              <div className="eyebrow">90-second script</div>
              <div style={{ marginTop: '0.5rem' }}>
                {CUES.map((text, i) => (
                  <div className={`cue ${i === cue ? 'cue-live' : ''}`} key={text}>
                    <span className="cue-n">{i + 1}</span>
                    <p className={i === cue ? '' : 'dim'}>{text}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <section>
            <div className="phone">
              <div className="phone-bar">
                <span style={{ color: 'var(--r-hands)' }}>● Phone A — Meera</span>
                <span className="faint">{roles.a}</span>
              </div>
              <iframe ref={phoneA} src="/" title="Phone A" />
            </div>
          </section>

          <section>
            <div className="phone">
              <div className="phone-bar">
                <span style={{ color: 'var(--r-relief)' }}>● Phone B — Arun</span>
                <span className="faint">{roles.b}</span>
              </div>
              <iframe ref={phoneB} src="/" title="Phone B" />
            </div>
          </section>
        </div>

        <section className="card" style={{ marginTop: '1.5rem' }}>
          <div className="eyebrow">What to watch for</div>
          <div className="grid-2" style={{ marginTop: '1rem' }}>
            {WATCH_FOR.map(([lead, rest]) => (
              <p className="dim" style={{ fontSize: '0.95rem' }} key={lead}>
                <strong style={{ color: 'var(--ink)' }}>{lead}</strong> {rest}
              </p>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
