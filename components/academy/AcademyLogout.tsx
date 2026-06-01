'use client';

export function AcademyLogout() {
  async function logout() {
    await fetch('/api/academy/account/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/academy';
  }
  return <button onClick={logout} className="text-sm font-medium text-[var(--color-stone)] hover:text-[var(--color-ink)]">Sign out</button>;
}
