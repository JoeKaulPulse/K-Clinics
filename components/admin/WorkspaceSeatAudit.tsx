'use client';

import { useEffect, useState } from 'react';

// Seat-usage / cost panel for /admin/workspace (BLD-312 Phase C). Reads the
// seat-audit endpoint and shows paid seats vs free aliases plus any active staff
// still missing a mailbox. Stays silent until/unless it loads OK, so it never
// competes with the page's own error banner.
type Audit = {
  ok: boolean;
  seats?: number;
  active?: number;
  suspended?: number;
  admins?: number;
  aliasCount?: number;
  staffWithoutMailbox?: { email: string; name: string }[];
};

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold leading-none">{value ?? 0}</span>
      <span className="text-xs text-[var(--color-muted)] mt-1">{label}</span>
    </div>
  );
}

export function WorkspaceSeatAudit() {
  const [a, setA] = useState<Audit | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/admin/integrations/google-workspace/seat-audit')
      .then((r) => r.json())
      .then((j) => { if (live) setA(j); })
      .catch(() => { if (live) setA({ ok: false }); });
    return () => { live = false; };
  }, []);

  if (!a || !a.ok) return null;

  const missing = a.staffWithoutMailbox ?? [];

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <Stat label="Paid seats" value={a.seats} />
        <Stat label="Active" value={a.active} />
        {a.suspended ? <Stat label="Suspended" value={a.suspended} /> : null}
        <Stat label="Admins" value={a.admins} />
        <Stat label="Free aliases" value={a.aliasCount} />
      </div>

      {missing.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <strong>{missing.length} active {missing.length === 1 ? 'staff member has' : 'staff have'} no mailbox:</strong>{' '}
          {missing.map((s) => s.name || s.email).join(', ')}.
          <span className="block text-xs mt-1">Create a mailbox in the Users tab — or, if they don’t need their own seat, add them as a group member / alias (both free).</span>
        </div>
      )}

      <p className="text-xs text-[var(--color-muted)] mt-3">
        You pay per seat; aliases and groups are free. Keep role addresses (hello@, info@, support@…) as aliases or groups rather than separate paid mailboxes.
      </p>
    </div>
  );
}
