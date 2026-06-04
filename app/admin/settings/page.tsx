import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { SettingsToggles } from '@/components/admin/SettingsToggles';
import { DataExportCard } from '@/components/admin/DataExportCard';
import { SETTING_META, SETTING_DEFAULTS, type SettingKey } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage') && !sessionCan(session, 'staff.view')) redirect('/admin');

  const { getSettings } = await import('@/lib/settings');
  const values = await getSettings();
  const initial = (Object.keys(SETTING_DEFAULTS) as SettingKey[]).map((key) => ({
    key,
    label: SETTING_META[key].label,
    description: SETTING_META[key].description,
    value: values[key],
  }));

  const can = await sessionPermissions();

  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t(locale, 'nav.settings')}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Clinic-wide booking & operations preferences.</p>
      <div className="mt-8">
        <SettingsToggles initial={initial} canManage={sessionCan(session, 'settings.manage')} />
      </div>
      <p className="mt-4 text-xs text-[var(--color-stone)]">
        Changes apply immediately. “Let clients choose their clinician” is off by default — when enabled, available
        clinicians are shown at booking.
      </p>
      {session?.role === 'OWNER' && <div className="mt-10"><DataExportCard /></div>}
    </AdminShell>
  );
}
