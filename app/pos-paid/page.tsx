import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Payment — KClinics', robots: { index: false, follow: false } };

// Customer-facing confirmation shown on their phone after a hosted Stripe
// Checkout payment — a POS card sale, a booking balance, or a BNPL course
// pre-payment (BLD-399, ?course=1).
export default async function PosPaidPage({ searchParams }: { searchParams: Promise<{ n?: string; cancelled?: string; course?: string }> }) {
  const { n, cancelled, course } = await searchParams;
  const paid = !cancelled;
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f6ece3', color: '#2a2420', fontFamily: 'Georgia, serif', textAlign: 'center', padding: 24 }}>
      <div>
        <div style={{ fontSize: 56, lineHeight: 1 }}>{paid ? '✓' : '—'}</div>
        <h1 style={{ fontSize: 28, marginTop: 16 }}>{paid ? 'Payment received' : 'Payment cancelled'}</h1>
        <p style={{ marginTop: 8, color: '#7d6259' }}>
          {paid
            ? (course ? 'Thank you — your course is paid in full. We look forward to seeing you.' : <>Thank you — please collect your items from the team.{n ? ` (Ref ${n})` : ''}</>)
            : 'No payment was taken. Please speak to the team.'}
        </p>
      </div>
    </div>
  );
}
