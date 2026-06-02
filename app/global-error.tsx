'use client';

// Root error boundary — catches errors thrown in the root layout itself, where
// the normal segment error.tsx can't run. Must render its own <html>/<body>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f3ece4', color: '#2a2420' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center' }}>
          <div style={{ maxWidth: 460 }}>
            <p style={{ letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 12, color: '#a98a6d' }}>K Clinics</p>
            <h1 style={{ fontSize: 28, margin: '0.75rem 0' }}>Something went wrong.</h1>
            <p style={{ color: '#6b6259', lineHeight: 1.6 }}>We hit an unexpected error. Please try again — if it persists, call us on 020 8050 0750.</p>
            <button onClick={reset} style={{ marginTop: '1.5rem', background: '#2a2420', color: '#f3ece4', border: 0, borderRadius: 999, padding: '0.75rem 1.75rem', fontSize: 14, cursor: 'pointer' }}>
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
