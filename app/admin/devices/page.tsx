import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { DeviceManager, type DeviceRow } from '@/components/admin/DeviceManager';
import { terminalProviderIds, anyTerminalConfigured } from '@/lib/terminal';

export const dynamic = 'force-dynamic';

// BLD-195 — registry of the clinic's physical devices (card terminals, displays,
// kiosks, printers). Terminals route in-person card capture (BLD-196) through
// lib/terminal.ts.
export default async function DevicesPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!session) redirect('/admin/login');
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const can = await sessionPermissions();

  const { db } = await import('@/lib/db');
  const rows = await db.device.findMany({ orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }] }).catch(() => []);
  const devices: DeviceRow[] = rows.map((d) => ({
    id: d.id, name: d.name, kind: d.kind, provider: d.provider, externalId: d.externalId,
    location: d.location, station: d.station, active: d.active,
    lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null, notes: d.notes,
  }));

  return (
    <AdminShell user={session.email} can={can}>
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Devices</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
          The hardware in your clinics — card terminals, storefront displays, sign-in kiosks and printers. Card terminals
          registered here can take in-person payments during a session. {anyTerminalConfigured()
            ? 'A card terminal provider is connected.'
            : 'No card terminal provider is connected yet — terminal payments stay unavailable until its credentials are added, and checkout falls back to a payment link or the card on file.'}
        </p>
      </div>

      <div className="mt-7">
        <DeviceManager devices={devices} providers={terminalProviderIds()} />
      </div>
    </AdminShell>
  );
}
