import { clockTime, mmss } from '../lib/api';
import Metronome from './Metronome';

/**
 * Apparatus bolted onto whichever step is live right now — never onto the ones above or below it.
 * Panic collapses working memory, so exactly one instruction is allowed to be loud at a time.
 */
function StepApparatus({ step, snapshot, onSwitchProtocol, secondsOnRole }) {
  switch (step.mode) {
    case 'metronome':
      return <Metronome />;

    case 'rhythm5':
      return <Metronome intervalMs={1000} label="Count them out loud" hint="1 · 2 · 3 · 4 · 5" sound={false} />;

    case 'breathing':
      return <Metronome intervalMs={5000} label="One breath every 5 seconds" hint="in through their mouth" sound={false} />;

    case 'dispatch':
      return <div className="dispatch-quote">“{snapshot.protocol.dispatchLine}”</div>;

    case 'timer':
      return (
        <div className="metronome" onClick={(e) => e.stopPropagation()}>
          <div className="beat-label"><span>Running since the scene opened</span></div>
          <div className="clock" style={{ fontSize: '2.1rem' }}>{mmss(snapshot.elapsedSec)}</div>
        </div>
      );

    case 'rotation': {
      const due = secondsOnRole > 120;
      return (
        <div className="metronome" onClick={(e) => e.stopPropagation()}>
          <div className="beat-label">
            <span>Time on this role</span>
            <span style={{ color: due ? 'var(--caution)' : 'inherit', fontWeight: 800 }}>
              {due ? 'SWAP NOW' : `${mmss(120 - secondsOnRole)} until swap`}
            </span>
          </div>
        </div>
      );
    }

    case 'escalate':
      return (
        <div style={{ marginTop: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn btn-sm btn-role"
            onClick={() => onSwitchProtocol(step.escalateTo)}
          >
            Switch everyone to {step.escalateTo.replace('_', ' ')}
          </button>
        </div>
      );

    default:
      return null;
  }
}

export default function StepList({ role, snapshot, onToggle, onSwitchProtocol, secondsOnRole }) {
  if (!role) {
    return (
      <div className="panel">
        <p className="dim">
          Nothing assigned to you yet. The moment a role opens — someone tires, someone leaves —
          it lands here.
        </p>
      </div>
    );
  }

  // Exactly one step is "current": the first unticked one. Everything else recedes.
  const firstOpen = role.steps.find((s) => !snapshot.steps[`${role.key}:${s.key}`]);

  return (
    <div>
      {role.steps.map((step, index) => {
        const record = snapshot.steps[`${role.key}:${step.key}`];
        const isCurrent = firstOpen && step.key === firstOpen.key;
        const classes = ['step', record && 'step-done', isCurrent && 'step-current']
          .filter(Boolean).join(' ');

        const toggle = () => onToggle(role.key, step.key, !record);

        return (
          <div
            key={step.key}
            className={classes}
            role="button"
            tabIndex={0}
            onClick={toggle}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
            }}
          >
            <span className="step-num">{record ? '✓' : index + 1}</span>
            <span>
              <span className="step-text">{step.text}</span>
              {step.detail && <span className="step-detail">{step.detail}</span>}
              {record && <span className="step-by">{record.by} · {clockTime(record.at)}</span>}
              {isCurrent && (
                <StepApparatus
                  step={step}
                  snapshot={snapshot}
                  onSwitchProtocol={onSwitchProtocol}
                  secondsOnRole={secondsOnRole}
                />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
