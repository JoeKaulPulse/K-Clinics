import { notFound } from 'next/navigation';
import { getSetting } from '@/lib/settings';
import { site } from '@/lib/site';
import { SearchBox } from '@/components/contractor/SearchBox';
import { RegisterForm } from '@/components/contractor/RegisterForm';

export const dynamic = 'force-dynamic';

// PRJ-63 — PUBLIC contractor reception landing. Mobile-first (these are phones at
// the front desk). Two paths: "find my profile" (search) and "I'm new here"
// (register). No auth, no session — see app/contractor/actions.ts.
export default async function ContractorLanding({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  // Flag off -> this surface does not exist.
  if (!(await getSetting('contractor_checkin_enabled'))) notFound();

  const { e } = await searchParams;
  const errorMsg =
    e === 'name' ? 'Please enter your full name.'
    : e === 'email' ? 'That email doesn’t look right — check it or leave it blank.'
    : e === 'blocked' ? 'We can’t sign you in. Please speak to reception.'
    : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-10">
      <header className="text-center">
        <p className="eyebrow text-[var(--color-gold-deep)]">{site.name}</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Contractor sign-in</h1>
        <p className="mt-2 text-sm text-[var(--color-stone)]">
          Welcome. Sign in for your visit so we know you’re on site and can show you your jobs and the building plans.
        </p>
      </header>

      {errorMsg && (
        <p className="mt-6 rounded-[var(--radius-md)] border border-[#e3c4c4] bg-[#fbedea] px-4 py-3 text-sm text-[#8a2f2f]">
          {errorMsg}
        </p>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-stone-soft)]">
          Find my profile
        </h2>
        <SearchBox />
      </section>

      <div className="my-8 flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-[var(--color-stone-soft)]">
        <span className="h-px flex-1 bg-[var(--color-line)]" />
        or
        <span className="h-px flex-1 bg-[var(--color-line)]" />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-stone-soft)]">
          First time here?
        </h2>
        <RegisterForm />
      </section>

      <footer className="mt-auto pt-10 text-center text-xs text-[var(--color-stone-soft)]">
        {site.address.street}, {site.address.locality}
      </footer>
    </main>
  );
}
