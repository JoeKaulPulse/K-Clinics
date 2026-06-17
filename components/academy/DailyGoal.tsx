'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { KMascot } from '@/components/academy/KMascot';

type Status = { tasks: number; goal: number; boxReady: boolean; boxOpened: boolean; streak: number };

function GiftBox({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="5" y="14" width="22" height="13" rx="1.5" fill="currentColor" />
      <rect x="3.5" y="10" width="25" height="6" rx="1.5" fill="currentColor" />
      <rect x="14" y="10" width="4" height="17" fill="var(--color-ink)" opacity="0.25" />
      <path d="M16 10c-1-4-7-5-7-1.5C9 10 14 10 16 10Zm0 0c1-4 7-5 7-1.5C23 10 18 10 16 10Z" fill="currentColor" />
    </svg>
  );
}

export function DailyGoal({ status }: { status: Status }) {
  const router = useRouter();
  const [overlay, setOverlay] = useState(false);
  const [reward, setReward] = useState<number | null>(null);
  const [opened, setOpened] = useState(status.boxOpened);
  const [busy, setBusy] = useState(false);
  const pct = Math.min(100, Math.round((status.tasks / status.goal) * 100));
  const ready = status.boxReady && !opened;

  async function open() {
    if (!ready || busy) return;
    setBusy(true); setOverlay(true);
    const r = await fetch('/api/academy/daily-box', { method: 'POST' }).then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok) { setReward(r.xp ?? 30); setOpened(true); setTimeout(() => router.refresh(), 400); }
    else { setOverlay(false); }
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-[family-name:var(--font-display)] text-lg">Daily goal</p>
          <p className="mt-0.5 text-sm text-[var(--color-stone)]">{Math.min(status.tasks, status.goal)} of {status.goal} done today{status.streak > 0 ? ` · 🔥 ${status.streak}-day streak` : ''}</p>
        </div>
        <button
          onClick={open}
          disabled={!ready}
          className={`relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl transition-transform ${ready ? 'bg-[var(--color-gold)]/15 text-[var(--color-gold)] hover:scale-105' : opened ? 'bg-[var(--color-bone)] text-[var(--color-stone-soft)]' : 'bg-[var(--color-bone)] text-[var(--color-stone-soft)]'}`}
          aria-label={ready ? 'Open your beauty box' : opened ? 'Box opened' : 'Beauty box locked'}
        >
          {ready ? (
            <motion.span animate={{ rotate: [-6, 6, -6], y: [0, -2, 0] }} transition={{ duration: 0.9, repeat: Infinity }}><GiftBox className="h-8 w-8" /></motion.span>
          ) : (
            <GiftBox className="h-8 w-8 opacity-60" />
          )}
          {opened && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--color-gold)] text-[0.6rem] text-white">✓</span>}
        </button>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--color-line)]"><div className="h-full rounded-full bg-[var(--color-gold)] transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
      <p className="mt-2 text-xs text-[var(--color-stone)]">{opened ? 'Box opened — nice. Come back tomorrow.' : ready ? 'You hit today’s goal — open your beauty box!' : `${status.goal - status.tasks} more task${status.goal - status.tasks === 1 ? '' : 's'} to unlock today’s box.`}</p>

      <AnimatePresence>
        {overlay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => reward != null && setOverlay(false)} className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[var(--color-ink)]/85 backdrop-blur-sm">
            {reward == null ? (
              <motion.div className="text-[var(--color-gold)]" animate={{ rotate: [-8, 8, -8], scale: [1, 1.05, 1] }} transition={{ duration: 0.5, repeat: Infinity }}><GiftBox className="h-24 w-24" /></motion.div>
            ) : (
              <div className="relative grid place-items-center text-center">
                <motion.span className="absolute rounded-full border border-[var(--color-gold)]/40" initial={{ width: 70, height: 70, opacity: 0.6 }} animate={{ width: 320, height: 320, opacity: 0 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
                {Array.from({ length: 16 }).map((_, i) => { const a = (i / 16) * Math.PI * 2; return <motion.span key={i} className={`absolute h-2 w-2 rounded-full ${i % 3 === 0 ? 'bg-[var(--color-porcelain)]' : 'bg-[var(--color-gold)]'}`} initial={{ x: 0, y: 0, opacity: 0 }} animate={{ x: Math.cos(a) * 140, y: Math.sin(a) * 140, opacity: [0, 1, 0] }} transition={{ duration: 1.2, delay: i * 0.02 }} />; })}
                <KMascot variant="perfect" size={84} />
                <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-8 font-[family-name:var(--font-display)] text-3xl text-[var(--color-porcelain)]">Beauty box!</motion.p>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-1 text-[var(--color-gold)]">+{reward} XP</motion.p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
