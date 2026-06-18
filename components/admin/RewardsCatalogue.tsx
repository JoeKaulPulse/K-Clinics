'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type CatalogueReward = { id: string; name: string; description: string | null; costPoints: number; emoji: string | null; stock: number | null };
export type MyRedemption = { id: string; name: string; costPoints: number; status: string; createdAt: string };

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  FULFILLED: 'bg-emerald-100 text-emerald-800',
  DECLINED: 'bg-rose-100 text-rose-700',
};

export function RewardsCatalogue({
  rewards,
  balance,
  myRedemptions,
  uk = false,
}: {
  rewards: CatalogueReward[];
  balance: number;
  myRedemptions: MyRedemption[];
  uk?: boolean;
}) {
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  async function redeem(id: string) {
    const reward = rewards.find((x) => x.id === id);
    if (reward && !confirm(L(`Redeem "${reward.name}" for ${reward.costPoints} points?`, `Обміняти «${reward.name}» за ${reward.costPoints} балів?`))) return;
    setBusy(id); setMsg('');
    const res = await fetch('/api/admin/rewards/redeem', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rewardId: id }),
    });
    setBusy(null);
    if (res.ok) { router.refresh(); }
    else { const j = await res.json().catch(() => ({})); setMsg(j.error || L('Could not redeem.', 'Не вдалося обміняти.')); }
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl">{L('Rewards catalogue', 'Каталог винагород')}</h2>
        <p className="text-sm text-[var(--color-stone)]">
          {L('Your balance', 'Ваш баланс')}: <span className="font-medium text-[var(--color-gold)]">{balance} {L('pts', 'балів')}</span>
        </p>
      </div>
      {msg && <p className="mt-2 text-sm text-rose-600">{msg}</p>}

      {rewards.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-stone)]">{L('No rewards available yet.', 'Поки що немає доступних винагород.')}</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => {
            const affordable = balance >= r.costPoints;
            const out = r.stock != null && r.stock <= 0;
            return (
              <div key={r.id} className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none" aria-hidden>{r.emoji || '🎁'}</span>
                  <div className="min-w-0">
                    <p className="font-medium">{r.name}</p>
                    {r.description && <p className="mt-1 text-sm text-[var(--color-stone)]">{r.description}</p>}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 pt-3">
                  <span className="font-[family-name:var(--font-display)] text-lg text-[var(--color-gold)]">{r.costPoints} <span className="text-xs text-[var(--color-stone)]">{L('pts', 'балів')}</span></span>
                  {r.stock != null && <span className="text-[0.7rem] text-[var(--color-stone)]">{out ? L('Out of stock', 'Немає в наявності') : `${r.stock} ${L('left', 'залишилось')}`}</span>}
                </div>
                <button
                  onClick={() => redeem(r.id)}
                  disabled={!affordable || out || busy === r.id}
                  className="mt-3 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === r.id ? L('Redeeming…', 'Обмін…') : !affordable ? L('Not enough points', 'Недостатньо балів') : L('Redeem', 'Обміняти')}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {myRedemptions.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-medium text-[var(--color-stone)]">{L('My redemptions', 'Мої обміни')}</h3>
          <div className="space-y-2">
            {myRedemptions.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm">
                <span>{m.name}</span>
                <span className="flex items-center gap-3">
                  <span className="text-[var(--color-stone)]">−{m.costPoints} {L('pts', 'балів')}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${STATUS_STYLE[m.status] || 'bg-[var(--color-bone)]'}`}>
                    {m.status === 'PENDING' ? L('Pending', 'Очікує') : m.status === 'FULFILLED' ? L('Fulfilled', 'Виконано') : m.status === 'DECLINED' ? L('Declined', 'Відхилено') : m.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
