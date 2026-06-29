'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export type GReview = {
  id: string;
  googleName: string;
  reviewerName: string | null;
  starRating: number;
  comment: string | null;
  createTime: string | null;
  replyComment: string | null;
};

const Stars = ({ n }: { n: number }) => (
  <span className="text-[var(--color-gold-deep)]" aria-label={`${n} star${n === 1 ? '' : 's'}`}>{'★'.repeat(n)}{'☆'.repeat(Math.max(0, 5 - n))}</span>
);

async function post(payload: object) {
  const r = await fetch('/api/admin/reviews/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false }));
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--color-stone)]">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs text-[var(--color-ink)]">{value}</code>
        <button
          onClick={() => { navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}
          className="shrink-0 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-bone)]"
        >{copied ? 'Copied ✓' : 'Copy'}</button>
      </div>
    </div>
  );
}

function GoogleSetupGuide({ configured, redirectUri }: { configured: boolean; redirectUri: string }) {
  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/50 p-4">
      <p className="text-sm font-medium text-[var(--color-ink)]">Connect in 4 steps</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-[var(--color-stone)]">
        <li>In <a href="https://console.cloud.google.com/apis/library" target="_blank" rel="noreferrer noopener" className="text-[var(--color-gold-deep)] underline">Google Cloud → APIs Library</a>, enable <strong>Business Profile API</strong> + <strong>My Business Account Management</strong> + <strong>Business Information</strong> APIs. (Google also needs to approve your project via their one-time <a href="https://developers.google.com/my-business/content/prereqs" target="_blank" rel="noreferrer noopener" className="text-[var(--color-gold-deep)] underline">access request</a>.)</li>
        <li>In <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noreferrer noopener" className="text-[var(--color-gold-deep)] underline">OAuth consent screen</a>: add scope <code className="text-xs">…/auth/business.manage</code> and add the owner under <strong>Test users</strong> (or Publish).</li>
        <li>In <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer noopener" className="text-[var(--color-gold-deep)] underline">Credentials</a> → your <strong>Web application</strong> OAuth client, paste the redirect URI below exactly.</li>
        <li>Click <strong>Connect Google Business</strong> — we auto-detect your location and import reviews. No numeric IDs needed.</li>
      </ol>
      <div className="mt-3"><CopyField label="Authorised redirect URI (paste into the OAuth client)" value={redirectUri} /></div>
      {!configured && <p className="mt-3 rounded-[var(--radius-sm)] bg-amber-50 px-3 py-2 text-xs text-amber-800">Waiting on <code>GOOGLE_CLIENT_ID</code> + <code>GOOGLE_CLIENT_SECRET</code> in the environment (then redeploy) — the Connect button appears once they’re set.</p>}
    </div>
  );
}

type LocationOpt = { ref: string; title: string; address: string | null };

function LocationSetup({ onReady }: { onReady: () => void }) {
  const [state, setState] = useState<'loading' | 'ok' | 'pending' | 'none' | 'error'>('loading');
  const [locations, setLocations] = useState<LocationOpt[]>([]);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setState('loading'); setErr('');
    const r = await post({ op: 'locations' });
    if (!r.ok) { setState('error'); setErr(r.message || r.error || ''); return; }
    setState(r.status);
    if (r.status === 'ok') {
      setLocations(r.locations || []);
      setChosen(r.locations?.[0]?.ref || '');
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function choose(ref: string) {
    setBusy(true); setErr('');
    const r = await post({ op: 'setLocation', ref });
    setBusy(false);
    if (r.ok) onReady(); else setErr(r.error || 'Could not save your choice. Please try again.');
  }

  if (state === 'loading') {
    return <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/40 p-4 text-sm text-[var(--color-stone)]">Finding your business on Google…</div>;
  }

  if (state === 'pending') {
    return (
      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/50 p-4">
        <p className="text-sm font-medium text-[var(--color-ink)]">✓ Google account connected</p>
        <p className="mt-1.5 text-sm text-[var(--color-stone)]">Google is still approving access to your reviews. This usually takes a few days and happens automatically — there’s nothing else you need to do. We’ll start importing the moment it’s ready.</p>
        <button onClick={load} disabled={busy} className="mt-3 rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs font-medium hover:bg-[var(--color-bone)] disabled:opacity-50">Check again</button>
      </div>
    );
  }

  if (state === 'none') {
    return (
      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/50 p-4">
        <p className="text-sm font-medium text-[var(--color-ink)]">No business found on this Google account</p>
        <p className="mt-1.5 text-sm text-[var(--color-stone)]">The Google account you connected doesn’t manage a Business Profile yet. Claim or verify your clinic on <a href="https://business.google.com" target="_blank" rel="noreferrer noopener" className="text-[var(--color-gold-deep)] underline">business.google.com</a>, then check again.</p>
        <button onClick={load} disabled={busy} className="mt-3 rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs font-medium hover:bg-[var(--color-bone)] disabled:opacity-50">Check again</button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-900">We couldn’t reach Google just now</p>
        {err && <p role="alert" aria-live="assertive" className="mt-1 text-sm text-amber-800">{err}</p>}
        <button onClick={load} disabled={busy} className="mt-3 rounded-full border border-amber-300 px-4 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50">Try again</button>
      </div>
    );
  }

  // state === 'ok'
  if (locations.length === 1) {
    const l = locations[0];
    return (
      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/50 p-4">
        <p className="text-sm font-medium text-[var(--color-ink)]">We found your business</p>
        <div className="mt-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2">
          <p className="text-sm font-medium">{l.title}</p>
          {l.address && <p className="text-xs text-[var(--color-stone)]">{l.address}</p>}
        </div>
        {err && <p role="alert" aria-live="assertive" className="mt-2 text-xs text-[var(--color-blush)]">{err}</p>}
        <button onClick={() => choose(l.ref)} disabled={busy} className="mt-3 rounded-full bg-[var(--color-gold-deep)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Importing reviews…' : 'Use this & import reviews'}</button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/50 p-4">
      <p className="text-sm font-medium text-[var(--color-ink)]">Which location are these reviews for?</p>
      <div className="mt-2 space-y-2">
        {locations.map((l) => (
          <label key={l.ref} className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border px-3 py-2 ${chosen === l.ref ? 'border-[var(--color-gold)] bg-white' : 'border-[var(--color-line)] bg-white/60'}`}>
            <input type="radio" name="gloc" checked={chosen === l.ref} onChange={() => setChosen(l.ref)} className="mt-1 accent-[var(--color-gold-deep)]" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{l.title}</span>
              {l.address && <span className="block text-xs text-[var(--color-stone)]">{l.address}</span>}
            </span>
          </label>
        ))}
      </div>
      {err && <p role="alert" aria-live="assertive" className="mt-2 text-xs text-[var(--color-blush)]">{err}</p>}
      <button onClick={() => choose(chosen)} disabled={busy || !chosen} className="mt-3 rounded-full bg-[var(--color-gold-deep)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Importing reviews…' : 'Use this & import reviews'}</button>
    </div>
  );
}

export function GoogleReviewsPanel({ connected, configured, locationSet, reviews, redirectUri }: { connected: boolean; configured: boolean; locationSet: boolean; reviews: GReview[]; redirectUri: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const ready = connected && locationSet;

  async function sync() {
    setBusy('sync'); setMsg('Importing from Google…');
    const r = await post({ op: 'sync' });
    setBusy('');
    setMsg(r.ok ? `Imported ${r.imported} review${r.imported === 1 ? '' : 's'}.` : (r.detail || r.error || 'Sync failed.'));
    if (r.ok) router.refresh();
  }
  async function disconnect() {
    if (!confirm('Disconnect Google Business Profile? Imported reviews stay, but no new ones sync until you reconnect.')) return;
    setBusy('disc'); await post({ op: 'disconnect' }); setBusy(''); router.refresh();
  }

  return (
    <section className="mt-10 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl">Google reviews</h2>
          <p className="mt-0.5 text-sm text-[var(--color-stone)]">Every review from your Google Business Profile — read them here and reply directly.</p>
        </div>
        <div className="flex items-center gap-2">
          {ready ? (
            <>
              <button onClick={sync} disabled={!!busy} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy === 'sync' ? 'Importing…' : 'Sync now'}</button>
              <button onClick={disconnect} disabled={!!busy} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-stone)] hover:border-[var(--color-blush)]">Disconnect</button>
            </>
          ) : connected ? (
            <button onClick={disconnect} disabled={!!busy} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-stone)] hover:border-[var(--color-blush)]">Disconnect</button>
          ) : configured ? (
            <a href="/api/admin/integrations/google-business/connect" className="rounded-full bg-[var(--color-gold-deep)] px-4 py-2 text-sm font-medium text-white">Connect Google Business</a>
          ) : null}
        </div>
      </div>

      {msg && <p className="mt-3 text-sm text-[var(--color-stone)]">{msg}</p>}

      {!connected && <GoogleSetupGuide configured={configured} redirectUri={redirectUri} />}

      {connected && !locationSet && <LocationSetup onReady={() => router.refresh()} />}

      <ManualAdd onAdded={() => router.refresh()} />
      <BulkAdd onAdded={() => router.refresh()} />

      {reviews.length > 0 && (
        <div className="mt-5 space-y-3">
          {reviews.map((r) => <GoogleReviewCard key={r.id} review={r} onChange={() => router.refresh()} />)}
        </div>
      )}
      {ready && reviews.length === 0 && <p className="mt-4 text-sm text-[var(--color-stone)]">No reviews imported yet — click “Sync now”, or add them by hand above. They publish on the website straight away.</p>}
    </section>
  );
}

function ManualAdd({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const input = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]';

  async function add() {
    setBusy(true); setErr('');
    const r = await post({ op: 'add', reviewerName: name, starRating: stars, comment, createTime: date || undefined });
    setBusy(false);
    if (r.ok) { setName(''); setComment(''); setDate(''); setStars(5); setOpen(false); onAdded(); }
    else setErr(r.error || 'Could not add the review.');
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-4 rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-stone)] hover:bg-[var(--color-bone)]">+ Add a review by hand</button>
    );
  }
  return (
    <div className="mt-4 space-y-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4">
      <p className="text-sm font-medium text-[var(--color-ink)]">Add a Google review</p>
      <p className="text-xs text-[var(--color-stone)]">Copy each one from your Google Business dashboard. It publishes on the website immediately — handy while Google approves the automatic import.</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reviewer name (e.g. Jane D.)" className={input} />
      <div className="flex gap-2">
        <select value={stars} onChange={(e) => setStars(Number(e.target.value))} className={input + ' w-auto'}>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input + ' w-auto'} />
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Review text" className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
      {err && <p role="alert" aria-live="assertive" className="text-xs text-[var(--color-blush)]">{err}</p>}
      <div className="flex gap-2">
        <button onClick={add} disabled={busy || !comment.trim()} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Adding…' : 'Add review'}</button>
        <button onClick={() => setOpen(false)} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs text-[var(--color-stone)]">Cancel</button>
      </div>
    </div>
  );
}

function BulkAdd({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  function parse() {
    return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const p = line.split('|').map((s) => s.trim());
      const starRating = Number(p[0]);
      let createTime: string | undefined; let comment = '';
      if (p.length >= 4) { createTime = p[2] || undefined; comment = p.slice(3).join(' | '); }
      else if (p.length === 3) { comment = p[2]; }
      return { starRating, reviewerName: p[1] || '', createTime, comment };
    }).filter((r) => r.starRating >= 1 && r.starRating <= 5);
  }

  async function submit() {
    const reviews = parse();
    if (!reviews.length) { setMsg('Nothing valid found — check the format (rating | name | date | text).'); return; }
    setBusy(true); setMsg('');
    const r = await post({ op: 'bulkAdd', reviews });
    setBusy(false);
    if (r.ok) { setText(''); setOpen(false); onAdded(); } else setMsg(r.error || 'Could not import.');
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} className="mt-2 rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-stone)] hover:bg-[var(--color-bone)]">Paste many at once</button>;
  }
  return (
    <div className="mt-3 space-y-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4">
      <p className="text-sm font-medium text-[var(--color-ink)]">Paste your existing Google reviews</p>
      <p className="text-xs text-[var(--color-stone)]">One per line: <code className="text-[0.7rem]">rating | name | date | review text</code>. Date is optional. They publish on the site immediately.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={'5 | Jane D. | 2025-01-10 | Brilliant, the whole team were so kind.\n5 | Tom R. | 2025-02-02 | Highly recommend — natural results.'} className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 font-[family-name:var(--font-mono)] text-xs outline-none focus:border-[var(--color-gold)]" />
      {msg && <p className="text-xs text-[var(--color-blush)]">{msg}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Importing…' : 'Import all'}</button>
        <button onClick={() => setOpen(false)} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs text-[var(--color-stone)]">Cancel</button>
      </div>
    </div>
  );
}

function GoogleReviewCard({ review, onChange }: { review: GReview; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(review.replyComment || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send() {
    setBusy(true); setErr('');
    const r = await post({ op: 'reply', googleName: review.googleName, comment: text });
    setBusy(false);
    if (r.ok) { setOpen(false); onChange(); } else setErr(r.error || 'Could not post reply.');
  }
  async function remove() {
    if (!confirm('Delete your reply on Google?')) return;
    setBusy(true); const r = await post({ op: 'deleteReply', googleName: review.googleName }); setBusy(false);
    if (r.ok) { setText(''); setOpen(false); onChange(); } else setErr(r.error || 'Could not delete.');
  }
  async function removeReview() {
    if (!confirm('Remove this review from the website?')) return;
    setBusy(true); const r = await post({ op: 'delete', id: review.id }); setBusy(false);
    if (r.ok) onChange(); else setErr(r.error || 'Could not remove.');
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Stars n={review.starRating} />
        <span className="text-sm font-medium">{review.reviewerName || 'Google reviewer'}</span>
        {review.createTime && <span className="text-xs text-[var(--color-stone)]">{new Date(review.createTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
      </div>
      {review.comment && <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{review.comment}</p>}

      {review.replyComment && !open && (
        <div className="mt-3 rounded-[var(--radius-sm)] border-l-2 border-[var(--color-gold)] bg-[var(--color-bone)] px-3 py-2 text-sm">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--color-gold-deep)]">Your reply</p>
          <p className="mt-0.5 text-[var(--color-ink-soft)]">{review.replyComment}</p>
        </div>
      )}

      {open ? (
        <div className="mt-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Write a public reply…" className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
          {err && <p role="alert" aria-live="assertive" className="mt-1 text-xs text-[var(--color-blush)]">{err}</p>}
          <div className="mt-2 flex gap-2">
            <button onClick={send} disabled={busy || !text.trim()} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Posting…' : 'Post reply to Google'}</button>
            <button onClick={() => setOpen(false)} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs text-[var(--color-stone)]">Cancel</button>
            {review.replyComment && <button onClick={remove} disabled={busy} className="ml-auto text-xs text-[var(--color-blush)] hover:underline">Delete reply</button>}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-4">
          <button onClick={() => { setText(review.replyComment || ''); setOpen(true); }} className="text-xs font-medium text-[var(--color-gold-deep)] hover:underline">
            {review.replyComment ? 'Edit reply' : 'Reply'}
          </button>
          <button onClick={removeReview} disabled={busy} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-blush)] hover:underline disabled:opacity-50">Remove</button>
        </div>
      )}
    </div>
  );
}
