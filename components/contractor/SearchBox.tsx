'use client';

import { useState, useTransition } from 'react';
import { searchContractors, checkInExisting, type ContractorMatch } from '@/app/contractor/actions';

// PRJ-63 — public "find my profile" search. Shows only { name, company } returned
// by the anti-enumeration server action; tapping a result checks that profile in.
export function SearchBox() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ContractorMatch[]>([]);
  const [searched, setSearched] = useState(false);
  const [pending, start] = useTransition();
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  function run(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const query = q.trim();
    if (query.length < 2) return;
    start(async () => {
      const r = await searchContractors(query);
      setResults(r);
      setSearched(true);
    });
  }

  function pick(id: string) {
    if (checkingIn) return;
    setCheckingIn(id);
    start(async () => {
      await checkInExisting(id);
    });
  }

  const field =
    'w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]';

  return (
    <div>
      <form onSubmit={run} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Your name or email"
          className={field}
          autoComplete="off"
          inputMode="text"
          aria-label="Your name or email"
        />
        <button
          type="submit"
          disabled={pending || q.trim().length < 2}
          className="shrink-0 rounded-[var(--radius-md)] bg-[var(--color-ink)] px-5 py-3 text-base font-medium text-[var(--color-porcelain)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? '…' : 'Find me'}
        </button>
      </form>

      {searched && results.length === 0 && !pending && (
        <p className="mt-4 text-sm text-[var(--color-stone)]">
          No match found. If you’re new here, tap “I’m new here” below to register.
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-4 space-y-2">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => pick(r.id)}
                disabled={!!checkingIn}
                className="flex w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-left transition-colors hover:border-[var(--color-gold)] disabled:opacity-50"
              >
                <span>
                  <span className="block text-base font-medium">{r.name}</span>
                  {r.company && <span className="block text-sm text-[var(--color-stone)]">{r.company}</span>}
                </span>
                <span className="text-sm font-medium text-[var(--color-gold-deep)]">
                  {checkingIn === r.id ? 'Signing in…' : 'Sign in'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
