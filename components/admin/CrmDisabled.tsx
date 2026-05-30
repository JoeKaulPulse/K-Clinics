export function CrmDisabled() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div className="max-w-md">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">CRM not enabled here</h1>
        <p className="mt-4 text-[var(--color-stone)]">
          The CRM runs in the full app environment (Vercel + Postgres), not in the static preview.
          Set <code className="rounded bg-[var(--color-bone)] px-1.5 py-0.5">NEXT_PUBLIC_CRM_ENABLED=true</code>,{' '}
          <code className="rounded bg-[var(--color-bone)] px-1.5 py-0.5">DATABASE_URL</code> and{' '}
          <code className="rounded bg-[var(--color-bone)] px-1.5 py-0.5">RESEND_API_KEY</code> to activate it.
        </p>
      </div>
    </div>
  );
}
