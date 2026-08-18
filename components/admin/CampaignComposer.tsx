'use client';

import { useEffect, useId, useState, useTransition } from 'react';
import { sendCampaign, previewCampaignAudience } from '@/app/admin/campaigns/actions';
import { Dialog } from '@/components/ui/Dialog';

const fieldCls = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]';

// Body preview shown in the confirmation dialog: first few lines, capped so a
// pasted-in wall of text can't blow out the dialog.
const BODY_PREVIEW_LINES = 4;
const BODY_PREVIEW_CHARS = 320;
function previewBody(body: string): { text: string; truncated: boolean } {
  const lines = body.split('\n');
  const byLines = lines.slice(0, BODY_PREVIEW_LINES).join('\n');
  const truncatedByLines = lines.length > BODY_PREVIEW_LINES;
  const truncatedByChars = byLines.length > BODY_PREVIEW_CHARS;
  const text = truncatedByChars ? byLines.slice(0, BODY_PREVIEW_CHARS) : byLines;
  return { text, truncated: truncatedByLines || truncatedByChars };
}

// A pending send captured from the form at "Send campaign" click — held while
// the confirmation dialog is open, then handed to the server action only if
// the marketer confirms inside the dialog (BLD-1352: a misclick on the button
// used to send to the full list immediately, with no recall).
type PendingSend = { formData: FormData; subject: string; body: string; segment: string };

export function CampaignComposer({ audience }: { audience: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string>('');
  const [discountOn, setDiscountOn] = useState(false);
  const [confirming, setConfirming] = useState<PendingSend | null>(null);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [countFailed, setCountFailed] = useState(false);
  const titleId = useId();

  // Re-count the audience for the confirmation dialog whenever it opens, so
  // the number reflects the tag filter actually in the form (the `audience`
  // prop is only the unfiltered total, computed once when the page loaded).
  // The count is advisory: sendCampaign re-derives its own recipients server
  // side, so a failed count must not dead-end the dialog — it is reported and
  // the send stays available.
  useEffect(() => {
    if (!confirming) return;
    let live = true;
    setLiveCount(null);
    setCountFailed(false);
    previewCampaignAudience(confirming.segment)
      .then((n) => { if (live) setLiveCount(n); })
      .catch(() => { if (live) setCountFailed(true); });
    return () => { live = false; };
  }, [confirming]);

  function reviewBeforeSending(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Guards against opening a second dialog on a repeat click, and against
    // this ever firing while a send from a previous confirm is still in flight.
    if (pending || confirming) return;
    const formData = new FormData(e.currentTarget);
    setConfirming({
      formData,
      subject: String(formData.get('subject') || ''),
      body: String(formData.get('body') || ''),
      segment: String(formData.get('segment') || '').trim(),
    });
  }

  function confirmAndSend() {
    if (!confirming || pending) return;
    const { formData } = confirming;
    setConfirming(null);
    start(async () => {
      setResult('');
      const r = await sendCampaign(formData);
      setResult(r.ok ? `Sent to ${r.sent} of ${r.total} subscribers ✓` : r.error || 'Failed');
    });
  }

  const body = confirming ? previewBody(confirming.body) : null;

  return (
    <>
      <form
        onSubmit={reviewBeforeSending}
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
        <button type="submit" disabled={pending} className="rounded-full bg-[var(--color-gold-deep)] px-6 py-2.5 text-sm text-white disabled:opacity-60">
          {pending ? 'Sending…' : 'Send campaign'}
        </button>
      </form>

      {/* `relative z-10` on the panel is required, not cosmetic: <Dialog>'s
          backdrop is `fixed inset-0` while the panel it wraps is left static,
          and a positioned element paints above a non-positioned sibling
          whatever the DOM order. Without it the panel renders under the 60%
          black scrim and every click inside it lands on the backdrop, which
          calls onClose — so the confirm button could never be pressed. */}
      <Dialog open={!!confirming} onClose={() => { if (!pending) setConfirming(null); }} labelledby={titleId} className="relative z-10">
        {confirming && body && (
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-xl)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)] sm:rounded-[var(--radius-xl)] md:p-7">
            <h2 id={titleId} className="font-[family-name:var(--font-display)] text-2xl">Send this campaign?</h2>
            <p className="mt-1 text-sm text-[var(--color-stone)]">This cannot be recalled once it starts sending.</p>

            <dl className="mt-4 space-y-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Recipients</dt>
                <dd className="mt-0.5 font-medium">
                  {countFailed
                    ? <span className="text-[var(--color-stone)]">Count unavailable. The send still goes to every opted-in subscriber{confirming.segment ? <> tagged “{confirming.segment}”</> : ''}.</span>
                    : liveCount === null
                      ? 'Counting…'
                      : <>{liveCount.toLocaleString('en-GB')} opted-in {liveCount === 1 ? 'subscriber' : 'subscribers'}{confirming.segment ? <> tagged “{confirming.segment}”</> : ''}</>}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Subject</dt>
                <dd className="mt-0.5 font-medium">{confirming.subject || <span className="text-[var(--color-stone)]">(empty)</span>}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Message</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-[var(--color-stone)]">
                  {body.text || <span className="italic">(empty)</span>}{body.truncated ? '…' : ''}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirming(null)} disabled={pending} className="px-4 py-2 text-sm text-[var(--color-stone)] disabled:opacity-50">Cancel</button>
              <button type="button" onClick={confirmAndSend} disabled={pending || (liveCount === null && !countFailed)} className="rounded-full bg-[var(--color-gold-deep)] px-6 py-2.5 text-sm text-white disabled:opacity-60">
                {pending ? 'Sending…' : 'Send campaign'}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
