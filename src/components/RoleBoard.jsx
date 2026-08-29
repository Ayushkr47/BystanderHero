/** The whole scene at a glance: who has what, and what nobody is covering. */
export default function RoleBoard({ snapshot, me }) {
  if (!snapshot.protocol) {
    return <p className="faint">Confirm the emergency type to assign roles.</p>;
  }

  return (
    <div className="board">
      {snapshot.protocol.roles.map((role) => {
        const mine = me?.roleKey === role.key;
        const open = role.slots - role.filled;

        return (
          <div key={role.key} className={`board-row ${mine ? 'is-you' : ''}`} data-role={role.key}>
            <span className="bar" />
            <span>
              <span className="board-role">{role.title}{mine && ' · you'}</span>
              <span className="board-who">{role.holders.length ? role.holders.join(', ') : 'Unfilled'}</span>
            </span>
            {open > 0
              ? <span className="board-open">{open} needed</span>
              : <span className="chip chip-ok">covered</span>}
          </div>
        );
      })}
    </div>
  );
}
