import { useEffect, useState } from 'react';
import { mmss } from '../lib/api';

/**
 * The hero, and the one thing this page should be remembered by.
 *
 * Rather than describe role assignment, it performs it: a shared clock counting up over four
 * cards that deal themselves in one at a time, the way people actually arrive at a scene. Each
 * card is a different person doing a different job — which is the entire argument of the product.
 */

const CREW = [
  { who: 'Maya', role: 'compressions', job: 'Chest compressions', sub: 'You are the pump. Do not stop.', pulse: true },
  { who: 'Dev', role: 'dispatch', job: 'Call 911, stay on the line', sub: 'You are the link to the ambulance.' },
  { who: 'Priya', role: 'aed', job: 'Find the AED', sub: 'Lobby, reception, near the lifts. Go now.' },
  { who: 'Tom', role: 'access', job: 'Clear the way, flag them in', sub: 'Nobody filming. Hold the door open.' }
];

export default function SceneStage() {
  const [seconds, setSeconds] = useState(74);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="stage-3d" aria-label="Illustration of a live scene with four assigned roles">
      <div className="stage-inner">
        <div className="scene-head">
          <div>
            <div className="eyebrow">Scene 9REN · Central Station</div>
            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.72)', marginTop: '0.2rem' }}>
              Cardiac arrest · 4 on scene
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="eyebrow">Elapsed</div>
            <div className="scene-clock">{mmss(seconds)}</div>
          </div>
        </div>

        <div className="assign-stack">
          {CREW.map((member, i) => (
            <article className="assign" data-role={member.role} style={{ '--i': i }} key={member.who}>
              <span>
                <span className="assign-who">
                  <span className="avatar avatar-sm">{member.who[0]}</span>
                  {member.who}
                </span>
                <span className="assign-job">{member.job}</span>
                <span className="assign-sub">{member.sub}</span>
                {member.pulse && <span className="assign-pulse"><span /></span>}
              </span>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
