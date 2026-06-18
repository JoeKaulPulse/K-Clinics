'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setLeaderboard } from '@/app/admin/clients/actions';

// BLD-140 — staff manage a client's public loyalty-leaderboard presence.
export function LeaderboardCard({ client }: { client: { id: string; optIn: boolean; photoUrl: string | null; displayName: string | null; firstName: string } }) {
  const router = useRouter();
  const [optIn, setOptIn] = useState(client.optIn);
  const [photoUrl, setPhotoUrl] = useState(client.photoUrl ?? '');
  const [displayName, setDisplayName] = useState(client.displayName ?? '');
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setMsg(null); setUploading(true);
    const fd = new FormData(); fd.append('file', file); fd.append('folder', 'leaderboard');
    const r = await fetch('/api/admin/media', { method: 'POST', body: fd }).then((x) => x.json()).catch(() => ({ ok: false }));
    setUploading(false);
    if (r.ok && r.asset?.url) setPhotoUrl(r.asset.url);
    else setMsg(r.error || 'Upload needs the media library (Settings access). Paste a photo URL instead.');
  }
  function save() {
    setMsg(null);
    start(async () => {
      const r = await setLeaderboard(client.id, { optIn, photoUrl: photoUrl || null, displayName: displayName || null });
      if (r.ok) { setMsg('Saved.'); router.refresh(); } else setMsg(r.error || 'Could not save.');
    });
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="font-[family-name:var(--font-display)] text-xl">Loyalty leaderboard</h2>
      <label className="mt-3 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]" />
        <span>Show on the public leaderboard <span className="block text-xs text-[var(--color-stone)]">Only switch on with the client’s written agreement — their name/photo become publicly visible on /membership.</span></span>
      </label>
      {optIn && (
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-[var(--color-stone)]">Display name <span className="text-[var(--color-stone)]">(defaults to {client.firstName})</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={client.firstName} className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
          </label>
          <div>
            <p className="text-xs text-[var(--color-stone)]">Photo</p>
            <div className="mt-1 flex items-center gap-3">
              {photoUrl
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={photoUrl} alt="" width={44} height={44} className="h-11 w-11 rounded-full object-cover" />
                : <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--color-bone)] text-xs text-[var(--color-stone)]">—</span>}
              <label className="cursor-pointer rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:bg-[var(--color-bone)]">
                {uploading ? 'Uploading…' : 'Upload'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
              </label>
              {photoUrl && <button onClick={() => setPhotoUrl('')} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-ink)]">Remove</button>}
            </div>
          </div>
        </div>
      )}
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={pending} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">{pending ? 'Saving…' : 'Save'}</button>
        {msg && <span className="text-xs text-[var(--color-stone)]">{msg}</span>}
      </div>
    </section>
  );
}
