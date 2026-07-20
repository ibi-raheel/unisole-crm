// Shown instantly on every navigation within the app while the next page's
// data loads on the server (Next.js streams this as the Suspense fallback).
// A skeleton reads as much snappier than a blank screen or a spinner.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton sk-title" />
      <div className="sk-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton sk-card" />
        ))}
      </div>
      <div className="skeleton sk-block" />
    </div>
  );
}
