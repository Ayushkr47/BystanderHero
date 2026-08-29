/** Never conditional, never dismissible. It is the first thing on every screen. */
export default function SafetyBar({ children }) {
  return <div className="safety-bar"><span>{children}</span></div>;
}
