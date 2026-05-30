'use client';

import { useState, useTransition } from 'react';
import { sendCampaign } from '@/app/admin/campaigns/actions';

const fieldCls = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-gold)]';

export function CampaignComposer({ audience }: { audience: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string>('');

  return (
    <form
      action={(fd) => start(async () => {
        setResult('');
        const r = await sendCampaign(fd);
        setResult(r.ok ? `Sent to ${r.sent} of ${r.total} subscribers ✓` : r.error || 'Failed');
      })}
      className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6"
    >
      <p className="text-sm text-[var(--color-stone)]">Broadcasts to your {audience} opted-in subscriber{audience === 1 ? '' : 's'}. Use <code>{'{firstName}'}</code> to personalise.</p>
      <input name="name" className={fieldCls} placeholder="Campaign name (internal)" required />
      <input name="segment" className={fieldCls} placeholder="Tag filter (optional, e.g. vip)" />
      <input name="subject" className={fieldCls} placeholder="Email subject" required />
      <textarea name="body" rows={8} className={fieldCls} placeholder={'Dear {firstName},\n\n…'} required />
      {result && <p className="text-sm text-[var(--color-stone)]">{result}</p>}
      <button disabled={pending} className="rounded-full bg-[var(--color-gold)] px-6 py-2.5 text-sm text-white disabled:opacity-60">
        {pending ? 'Sending…' : 'Send campaign'}
      </button>
    </form>
  );
}
