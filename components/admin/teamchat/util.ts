'use client';

import { upload } from '@vercel/blob/client';
import type { DraftAttachment } from './types';

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
}

/** Short clock time, e.g. "09:41". */
export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Relative-ish label for conversation lists: "09:41", "Mon", "12 Jun". */
export function shortWhen(iso: string): string {
  const d = new Date(iso); const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** A date divider label for the message stream. */
export function dayLabel(iso: string): string {
  const d = new Date(iso); const now = new Date();
  const today = d.toDateString() === now.toDateString();
  const yest = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
  if (today) return 'Today';
  if (yest) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function attachmentKind(mime: string): DraftAttachment['kind'] {
  if (mime.startsWith('image/gif')) return 'IMAGE';
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.startsWith('video/')) return 'VIDEO';
  return 'FILE';
}

/** Upload a file straight to Vercel Blob via our signed-token route. */
export async function uploadFile(file: File): Promise<DraftAttachment> {
  const safe = (file.name || 'file').replace(/[^a-zA-Z0-9.\-_]/g, '-').slice(0, 80);
  const blob = await upload(`team-chat/${Date.now().toString(36)}-${safe}`, file, {
    access: 'public',
    handleUploadUrl: '/api/admin/team-chat/blob-token',
    contentType: file.type || undefined,
  });
  return { kind: attachmentKind(file.type || ''), url: blob.url, name: file.name, mime: file.type, size: file.size };
}

// Quick reactions shown on hover, and a fuller picker set.
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🙏', '👀'];
export const EMOJI: string[] = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔', '🙄', '😴', '😢', '😭', '😡', '🥳', '🤯',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '👋', '✌️', '🤞', '👀', '🧠', '💯', '🔥', '✨', '⭐',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '💖', '💘',
  '✅', '❌', '⚠️', '❓', '❗', '📌', '📎', '📝', '📅', '⏰', '☕', '🎉', '🎂', '🍕', '🚀', '💡',
];

/** Split a message body into text + mention chips. A "@Name" token is a mention
 *  when it matches the start of a mentioned member's display name (or @everyone). */
export function tokenizeBody(body: string, members: { id: string; name: string }[], mentionIds: string[], mentionsAll: boolean): { text: string; mention: boolean }[] {
  if (!body) return [];
  const names = members.filter((m) => mentionIds.includes(m.id)).map((m) => m.name);
  const out: { text: string; mention: boolean }[] = [];
  const re = /@([\p{L}][\p{L}\d'’.\-]*(?:\s[\p{L}][\p{L}\d'’.\-]*)?)/gu;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const token = m[1];
    const isAll = mentionsAll && /^(everyone|channel|all|here)$/i.test(token);
    const isName = names.some((n) => n.toLowerCase().startsWith(token.toLowerCase()) || token.toLowerCase().startsWith(n.toLowerCase()));
    if (!isAll && !isName) continue;
    if (m.index > last) out.push({ text: body.slice(last, m.index), mention: false });
    out.push({ text: m[0], mention: true });
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push({ text: body.slice(last), mention: false });
  return out.length ? out : [{ text: body, mention: false }];
}
