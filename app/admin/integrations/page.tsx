import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getIntegrations } from '@/lib/integrations';
import { getLocale } from '@/lib/locale';
import { translator } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  connected: 'bg-green-100 text-green-800',
  partial: 'bg-amber-100 text-amber-800',
  not_configured: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
};

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  // Integrations are owner/admin-level — gated on settings.manage.
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const sp = await searchParams;
  const integrations = await getIntegrations();
  const can = await sessionPermissions();
  const locale = await getLocale();
  const t = translator(locale);
  const uk = locale === 'uk';

  const statusLabel = (s: string) => uk
    ? s === 'connected' ? 'підключено' : s === 'partial' ? 'частково' : 'не налаштовано'
    : s === 'connected' ? 'connected' : s === 'partial' ? 'partial' : 'not configured';

  const categories = Array.from(new Set(integrations.map((i) => i.category)));

  // OAuth callbacks redirect back with ?xero=connected|error and ?bank=connected|error.
  const banners: { ok: boolean; text: string }[] = [];
  const note = (k: string, label: string) => {
    if (sp[k] === 'connected') banners.push({ ok: true, text: uk ? `${label} підключено ✓` : `${label} connected ✓` });
    else if (sp[k] === 'error') banners.push({ ok: false, text: uk ? `Не вдалося підключити ${label}. Спробуйте ще раз.` : `Couldn’t connect ${label}. Please try again.` });
  };
  note('xero', 'Xero');
  note('bank', uk ? 'Банк' : 'Bank feed');
  note('gcal', 'Google Calendar');

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t('nav.integrations')}</h1>
      {banners.map((b, i) => (
        <p key={i} className={`mt-4 rounded-[var(--radius-sm)] border px-4 py-3 text-sm ${b.ok ? 'border-green-600/30 bg-green-50 text-green-800' : 'border-[var(--color-blush)]/40 bg-[var(--color-blush)]/10 text-[var(--color-ink)]'}`}>{b.text}</p>
      ))}
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        {uk
          ? 'Стан усіх зовнішніх сервісів клініки. Ключі задаються у змінних середовища хостингу; тут показано лише їхній стан.'
          : 'Live status of every external service the clinic relies on. Secret keys are set in your hosting environment variables — only their presence is shown here, never the values.'}
      </p>

      <EncryptionStatus />

      <div className="mt-8 space-y-10">
        {categories.map((cat) => (
          <section key={cat}>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-stone)]">{cat}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {integrations.filter((i) => i.category === cat).map((i) => (
                <div key={i.id} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-[family-name:var(--font-display)] text-lg">{i.name}</h3>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-wide ${STATUS_BADGE[i.status]}`}>
                      {statusLabel(i.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-stone)]">{i.description}</p>
                  <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">{i.detail}</p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {i.envVars.map((v) => (
                      <span
                        key={v.name}
                        title={v.set ? 'Configured' : v.optional ? 'Optional — not set' : 'Required — not set'}
                        className={`rounded-full px-2 py-0.5 font-[family-name:var(--font-mono)] text-[0.65rem] ${
                          v.set ? 'bg-green-100 text-green-800' : v.optional ? 'bg-[var(--color-bone)] text-[var(--color-stone)]' : 'bg-[var(--color-blush)]/20 text-[var(--color-ink)]'
                        }`}
                      >
                        {v.set ? '✓' : v.optional ? '○' : '✗'} {v.name}
                      </span>
                    ))}
                  </div>

                  {(i.manageHref || i.docsHref) && (
                    <div className="mt-4 flex items-center gap-4 text-sm">
                      {i.manageHref && <a href={i.manageHref} className="font-medium text-[var(--color-gold)] hover:text-[var(--color-ink)]">{uk ? 'Керувати' : 'Manage'} →</a>}
                      {i.docsHref && <a href={i.docsHref} target="_blank" rel="noopener noreferrer" className="text-[var(--color-stone)] hover:text-[var(--color-ink)]">{uk ? 'Документація' : 'Get keys'} ↗</a>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdminShell>
  );
}

// Encryption-key health: shows the active key id and how many records still
// need re-encrypting onto it (so you can verify "0 remaining" before retiring an
// old key). Fully defensive — never breaks the page.
async function EncryptionStatus() {
  let status: { activeKeyId: string; total: number; pending: Record<string, number> } | null = null;
  let rotating = false;
  try {
    const { rotationStatus, rotationActive } = await import('@/lib/key-rotation');
    status = await rotationStatus();
    rotating = rotationActive();
  } catch {
    return null;
  }
  if (!status) return null;

  return (
    <section className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg">Clinical data encryption</h2>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Health records, clinical notes and OAuth tokens are encrypted (AES-256-GCM) with a versioned keyring, so a key can be rotated without data loss.</p>
        </div>
        <span className="rounded-full bg-[var(--color-bone)] px-3 py-1 text-xs text-[var(--color-stone)]">Active key <span className="font-mono font-medium text-[var(--color-ink)]">{status.activeKeyId}</span></span>
      </div>
      {rotating ? (
        status.total === 0 ? (
          <p className="mt-3 rounded-[var(--radius-sm)] border border-green-600/30 bg-green-50 px-4 py-2.5 text-sm text-green-800">Rotation complete — every record is on the active key. You can now safely remove the retired key from <code className="text-xs">HEALTH_ENCRYPTION_KEYS_OLD</code>.</p>
        ) : (
          <p className="mt-3 rounded-[var(--radius-sm)] border border-amber-500/30 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">Re-encryption in progress — <strong>{status.total}</strong> record(s) remaining on a retired key (health {status.pending.healthAssessments}, notes {status.pending.clinicalNotes}, SOPs {status.pending.sopChecklists}, tokens {status.pending.oauthTokens}). The daily job migrates these automatically; keep the old key until this reaches 0.</p>
        )
      ) : (
        <p className="mt-3 text-sm text-[var(--color-stone-soft)]">No rotation in progress. To rotate: add the new value to <code className="text-xs">HEALTH_ENCRYPTION_KEY</code>, move the old value into <code className="text-xs">HEALTH_ENCRYPTION_KEYS_OLD</code>, and redeploy.</p>
      )}
    </section>
  );
}
