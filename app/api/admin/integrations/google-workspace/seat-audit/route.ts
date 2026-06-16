import { NextResponse } from 'next/server';
import { getSession, sessionCan } from '@/lib/auth';
import { listWorkspaceUsersResult } from '@/lib/google-workspace';

// Seat-usage / cost audit for /admin/workspace (BLD-312 Phase C).
// Read-only: counts paid seats vs free aliases, and correlates the Workspace
// directory against active staff so mailboxes that still need creating surface.
export async function GET() {
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const r = await listWorkspaceUsersResult();
  if (!r.ok) return NextResponse.json({ ok: false, configured: r.configured, error: r.error ?? 'Failed to load.' });

  const users = r.users;
  const active = users.filter((u) => !u.suspended).length;
  const suspended = users.filter((u) => u.suspended).length;
  const admins = users.filter((u) => u.isAdmin).length;
  const aliasCount = users.reduce((n, u) => n + (u.aliases?.length ?? 0), 0);

  // Correlate against active staff on the Workspace domain to flag who has no
  // mailbox yet (and isn't already covered by an alias).
  const have = new Set<string>();
  for (const u of users) {
    have.add(u.email.toLowerCase());
    for (const a of u.aliases ?? []) have.add(a.toLowerCase());
  }
  const domain = primaryDomain(users.map((u) => u.email));
  let staffWithoutMailbox: { email: string; name: string }[] = [];
  if (domain) {
    const { db } = await import('@/lib/db');
    const staff = await db.adminUser.findMany({ where: { active: true }, select: { email: true, name: true } });
    staffWithoutMailbox = staff
      .filter((s) => s.email.toLowerCase().endsWith('@' + domain) && !have.has(s.email.toLowerCase()))
      .map((s) => ({ email: s.email, name: s.name ?? '' }));
  }

  return NextResponse.json({ ok: true, seats: users.length, active, suspended, admins, aliasCount, staffWithoutMailbox });
}

// Most common email domain among the directory's users — the Workspace's primary
// domain, used to scope the staff correlation without hard-coding it.
function primaryDomain(emails: string[]): string | null {
  const counts = new Map<string, number>();
  for (const e of emails) {
    const d = e.split('@')[1]?.toLowerCase();
    if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [d, c] of counts) if (c > n) { best = d; n = c; }
  return best;
}
