'use client';

import { useState, useTransition } from 'react';
import { sendCampaign } from '@/app/admin/campaigns/actions';

const fieldCls = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-gold)]';

export function CampaignComposer({ audience }: { audience: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string>('');
  const [discountOn, setDiscountOn] = useState(false);

  return (
    <form
      action={(fd) => start(async () => {
        setResult('');
        const r = await sendCampaign(fd);
        setResult(r.ok ? `Sent to ${r.sent} of ${r.total} subscribers ✓` : r.error || 'Failed');
      })}
      className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6"
    >
      <p className="text-sm text-[var(--color-stone)]">Broadcasts to your {audience} opted-in subscriber{audience === 1 ? '' : 's'}. Use <code>{'{firstName}'}</code> to personalise{discountOn ? <> and <code>{'{discountCode}'}</code> to insert each recipient&rsquo;s unique code</> : ''}.</p>
      <input name="name" className={fieldCls} placeholder="Campaign name (internal)" aria-label="Campaign name" required />
      <input name="segment" className={fieldCls} placeholder="Tag filter (optional, e.g. vip)" aria-label="Tag filter" />
      <input name="subject" className={fieldCls} placeholder="Email subject" aria-label="Email subject" required />
      <textarea name="body" rows={8} className={fieldCls} aria-label="Message body" placeholder={discountOn ? 'Dear {firstName},\n\nHere is £25 off your next treatment — use code {discountCode} when you book.' : 'Dear {firstName},\n\n…'} required />

      {/* Per-recipient discount */}
      <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="discountOn" checked={discountOn} onChange={(e) => setDiscountOn(e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
          Give each recipient a unique discount code
        </label>
        {discountOn && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <select name="discountType" className={`${fieldCls} w-28`}><option value="PERCENT">% off</option><option value="FIXED">£ off</option></select>
            <input name="discountValue" type="number" min={1} className={`${fieldCls} w-28`} placeholder="Value" aria-label="Discount value" />
            <span className="text-[var(--color-stone)]">valid for</span>
            <input name="discountDays" type="number" min={1} defaultValue={14} className={`${fieldCls} w-20`} />
            <span className="text-[var(--color-stone)]">days. Insert <code>{'{discountCode}'}</code> in the message.</span>
          </div>
        )}
      </div>
      {result && <p className="text-sm text-[var(--color-stone)]">{result}</p>}
      <button disabled={pending} className="rounded-full bg-[var(--color-gold-deep)] px-6 py-2.5 text-sm text-white disabled:opacity-60">
        {pending ? 'Sending…' : 'Send campaign'}
      </button>
    </form>
  );
}
