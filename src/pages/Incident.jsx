import { useEffect, useRef, useState } from 'react';
import { api, mmss } from '../lib/api';
import { useIncident } from '../lib/useIncident';

import SafetyBar from '../components/SafetyBar';
import StepList from '../components/StepList';
import RoleBoard from '../components/RoleBoard';
import SceneLog from '../components/SceneLog';
import IncomingAlert from '../components/IncomingAlert';

const HANDS_ON_ROLES = ['compressions', 'thrusts', 'pressure'];

export default function Incident({ params }) {
  const incidentId = params.get('id');
  const initialResponder = params.get('r');

  const { snapshot, me, role, closed, toggleStep, requestRelief, switchProtocol } =
    useIncident(incidentId, initialResponder);

  const [alertDismissed, setAlertDismissed] = useState(params.get('alert') !== '1');
  const [protocols, setProtocols] = useState([]);
  const [locale, setLocale] = useState({ emergency: '112', ambulance: '108' });
  const [reliefState, setReliefState] = useState(null);
  const [banner, setBanner] = useState(null);

  // How long this person has held their current role, for the 2-minute rotation prompt.
  const [secondsOnRole, setSecondsOnRole] = useState(0);
  const roleSinceRef = useRef(Date.now());
  const lastCrisisRef = useRef(null);

  useEffect(() => {
    api.meta().then(({ protocols: p, locale: l }) => { setProtocols(p); if (l) setLocale(l); }).catch(() => {});
  }, []);

  useEffect(() => {
    roleSinceRef.current = Date.now();
    setReliefState(null);
  }, [me?.roleKey]);

  useEffect(() => {
    const timer = setInterval(
      () => setSecondsOnRole(Math.floor((Date.now() - roleSinceRef.current) / 1000)),
      1000
    );
    return () => clearInterval(timer);
  }, []);

  // Heads are down at a scene, so anything that changes the whole plan gets announced.
  useEffect(() => {
    if (!snapshot?.crisis) return;
    if (lastCrisisRef.current && lastCrisisRef.current !== snapshot.crisis) {
      setBanner(`Protocol changed to ${snapshot.protocol.label}. Your role has been reassigned — read it again.`);
      const timer = setTimeout(() => setBanner(null), 9000);
      lastCrisisRef.current = snapshot.crisis;
      return () => clearTimeout(timer);
    }
    lastCrisisRef.current = snapshot.crisis;
    return undefined;
  }, [snapshot?.crisis]);

  if (!incidentId || !initialResponder) {
    window.location.href = '/';
    return null;
  }

  if (closed) {
    return (
      <main className="narrow" style={{ padding: '4rem 0' }}>
        <h2>This scene has closed.</h2>
        <p className="dim" style={{ marginTop: '1rem' }}>Incidents are cleared once EMS takes over.</p>
        <a className="btn" style={{ marginTop: '1.5rem' }} href="/">Back to start</a>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="narrow" style={{ padding: '4rem 0' }}>
        <p className="dim">Connecting to the scene…</p>
      </main>
    );
  }

  const showAlert = !alertDismissed && snapshot.protocol && me;

  const activeBanner = snapshot.status !== 'active'
    ? 'Scene closed. EMS has taken over.'
    : snapshot.reliefRequested
      ? 'Someone needs relief and there is nobody spare — shout for another pair of hands.'
      : banner;

  const onRelief = async () => {
    setReliefState('calling');
    const result = await requestRelief();
    setReliefState(result.swapped ? 'swapped' : 'none');
    roleSinceRef.current = Date.now();
  };

  return (
    <>
      {showAlert && (
        <IncomingAlert snapshot={snapshot} role={role} onAccept={() => setAlertDismissed(true)} />
      )}

      <SafetyBar>
        <strong>Call {locale.emergency} if nobody has.</strong> Ambulance direct on {locale.ambulance}.
        Follow the operator over this app if they conflict.
      </SafetyBar>

      <main className="wrap" style={{ padding: '1.5rem 0 4rem' }}>
        <header className="between" style={{ marginBottom: '1.25rem' }}>
          <div>
            <div className="row">
              <span className="chip chip-live">
                <span className="dot" /> {snapshot.status === 'active' ? 'Live scene' : 'Closed'}
              </span>
              <span className="chip">{snapshot.responders.length} on scene</span>
            </div>
            <h2 style={{ marginTop: '0.6rem' }}>
              {snapshot.protocol ? snapshot.protocol.label : 'Awaiting confirmation'}
            </h2>
            <p className="faint" style={{ fontSize: '0.88rem', marginTop: '0.25rem' }}>{snapshot.place}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="eyebrow">Elapsed</div>
            <div className="clock">{mmss(snapshot.elapsedSec)}</div>
            <div className="eyebrow" style={{ marginTop: '0.6rem' }}>Scene code</div>
            <div className="code">{snapshot.code}</div>
          </div>
        </header>

        {activeBanner && (
          <div
            className="panel"
            style={{ borderColor: 'var(--caution)', background: 'var(--caution-soft)', marginBottom: '1rem' }}
          >
            <strong style={{ fontSize: '1.05rem' }}>{activeBanner}</strong>
          </div>
        )}

        <div id="layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)', gap: '1.25rem', alignItems: 'start' }}>

          <div className="stack" style={{ '--gap': '1rem' }}>
            <section className="role-hero" data-role={me ? me.roleKey : 'standby'}>
              <div className="between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <span className="role-badge">{me?.isPrimary ? 'You opened this scene' : 'Your job'}</span>
                  <h1 className="role-title" style={{ marginTop: '0.7rem' }}>
                    {role ? role.title : 'Stand by'}
                  </h1>
                  <p className="dim" style={{ marginTop: '0.4rem', fontSize: '1.02rem' }}>
                    {role
                      ? role.subtitle
                      : 'Every role is filled. Stay close, keep the crowd back, and be ready to take over.'}
                  </p>
                </div>
                <span className="chip">{me ? me.name : 'You'}</span>
              </div>
            </section>

            <StepList
              role={role}
              snapshot={snapshot}
              onToggle={toggleStep}
              onSwitchProtocol={switchProtocol}
              secondsOnRole={secondsOnRole}
            />

            <div className="row">
              {role && HANDS_ON_ROLES.includes(role.key) && (
                <button
                  type="button"
                  className="btn btn-role"
                  style={{ flex: 1 }}
                  onClick={onRelief}
                  disabled={reliefState === 'calling'}
                >
                  {reliefState === 'calling' && 'Calling for relief…'}
                  {reliefState === 'swapped' && 'Swapped'}
                  {reliefState === 'none' && 'No relief on scene — shout for one'}
                  {!reliefState && 'I am tiring — send my relief'}
                </button>
              )}
              {role?.key === 'dispatch' && (
                <>
                  <a className="btn btn-role" style={{ flex: 1 }} href={`tel:${locale.emergency}`}>
                    Call {locale.emergency}
                  </a>
                  <a className="btn btn-ghost" style={{ flex: 1 }} href={`tel:${locale.ambulance}`}>
                    Ambulance · {locale.ambulance}
                  </a>
                </>
              )}
            </div>
          </div>

          <aside className="stack" style={{ '--gap': '1rem' }}>
            <section className="card" style={{ padding: '1.1rem' }}>
              <div className="between" style={{ marginBottom: '0.85rem' }}>
                <h3>Who is doing what</h3>
                <span className="faint" style={{ fontSize: '0.78rem' }}>live</span>
              </div>
              <RoleBoard snapshot={snapshot} me={me} />
            </section>

            <section className="card" style={{ padding: '1.1rem' }}>
              <h3 style={{ marginBottom: '0.6rem' }}>Scene log</h3>
              <SceneLog log={snapshot.log} />
            </section>

            <section className="card" style={{ padding: '1.1rem' }}>
              <h3 style={{ marginBottom: '0.6rem' }}>Heard at the scene</h3>
              <div className="transcript">
                {snapshot.transcript.length === 0 && <span className="faint">Nothing captured.</span>}
                {snapshot.heard && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span className="chip chip-ai">
                      {snapshot.aiSource === 'claude' ? 'Claude' : 'cue engine'} keyed on “{snapshot.heard}”
                    </span>
                  </div>
                )}
                {snapshot.transcript.map((t) => <div key={t.at}>“{t.text}”</div>)}
              </div>
            </section>

            <section className="card" style={{ padding: '1.1rem' }}>
              <h3 style={{ marginBottom: '0.35rem' }}>Wrong protocol?</h3>
              <p className="faint" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Switching rebriefs every phone on scene and reassigns all roles.
              </p>
              <div className="row">
                {protocols.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`btn btn-sm ${p.id === snapshot.crisis ? 'btn-role' : 'btn-ghost'}`}
                    onClick={() => p.id !== snapshot.crisis && switchProtocol(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="card" style={{ padding: '1.1rem' }}>
              <h3 style={{ marginBottom: '0.75rem' }}>When EMS takes over</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ width: '100%' }}
                onClick={() => api.close(incidentId, 'EMS on scene')}
              >
                Close the scene &amp; hand over
              </button>
            </section>

            <p className="faint" style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
              Prototype for RescueHacks. Not a medical device and not a substitute for emergency
              services or trained clinicians. Guidance follows published lay-rescuer first aid; if a
              dispatcher or paramedic tells you otherwise, do what they say.
            </p>
          </aside>
        </div>
      </main>
    </>
  );
}
