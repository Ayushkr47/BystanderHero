/**
 * What a nearby bystander sees when a scene pulls them in.
 *
 * The job is the headline, not the diagnosis: "Clear the airway" is actionable, "Choking" is
 * only information. Someone reading this has just pulled a buzzing phone out of their pocket.
 */
export default function IncomingAlert({ snapshot, role, onAccept }) {
  return (
    <div className="incoming">
      <div className="stack" style={{ '--gap': '1.1rem', maxWidth: '34rem', width: '100%' }}>
        <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: '0.2em' }}>
          Emergency within 60 metres · {snapshot.protocol.label}
        </div>

        <div style={{ opacity: 0.9, fontSize: '1.05rem' }}>{snapshot.place}</div>

        <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.75)', marginTop: '0.5rem' }}>Your job</div>
        <h2 style={{ marginTop: '-0.4rem' }}>{role ? role.title : 'Stand by'}</h2>
        <p style={{ fontSize: '1.2rem', opacity: 0.92, fontWeight: 600 }}>
          {role ? role.subtitle : 'Wait for a job. Do not crowd the patient.'}
        </p>

        <button
          type="button"
          className="btn"
          onClick={onAccept}
          style={{
            background: '#fff', color: '#b3140b', minHeight: 84, width: '100%',
            fontSize: '1.45rem', fontWeight: 820, border: 'none', marginTop: '0.5rem'
          }}
        >
          I&apos;m on it
        </button>

        <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>
          Not nearby or cannot help? Close this and the role passes to the next person.
        </p>
      </div>
    </div>
  );
}
