'use client';

import { initials } from './util';
import type { ChatMember } from './types';

/** Single staff avatar — photo if present, else initials on ink. */
export function Avatar({ name, photo, size = 32 }: { name: string; photo?: string | null; size?: number }) {
  if (photo) {
    return <img src={photo} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-[var(--color-ink)] font-[family-name:var(--font-display)] text-[var(--color-gold-bright)]"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4) }}
    >
      {initials(name)}
    </span>
  );
}

/** A small overlapped cluster for group channels. */
export function AvatarStack({ members, meId, size = 32 }: { members: ChatMember[]; meId: string; size?: number }) {
  const others = members.filter((m) => m.id !== meId).slice(0, 3);
  const pick = others.length ? others : members.slice(0, 3);
  if (pick.length <= 1) return <Avatar name={pick[0]?.name || '?'} photo={pick[0]?.photoUrl} size={size} />;
  const sub = Math.round(size * 0.66);
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span className="absolute left-0 top-0"><Avatar name={pick[0].name} photo={pick[0].photoUrl} size={sub} /></span>
      <span className="absolute bottom-0 right-0 rounded-full ring-2 ring-[var(--color-porcelain)]"><Avatar name={pick[1].name} photo={pick[1].photoUrl} size={sub} /></span>
    </span>
  );
}
