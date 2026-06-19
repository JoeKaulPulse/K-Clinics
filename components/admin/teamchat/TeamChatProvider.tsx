'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLiveChannel } from '@/hooks/useLiveChannel';
import type { Channel, ChatMember, StreamSnap } from './types';

// Shared team-chat state for the whole admin shell: the channel list, roster,
// unread counts and the set of open docked windows. The live SSE signal drives
// refetches; the launcher (top bar) and the dock (bottom-right) both consume it.

const MAX_OPEN = 3; // docked windows kept on screen at once (desktop)

type Ctx = {
  ready: boolean;
  meId: string;
  channels: Channel[];
  roster: ChatMember[];
  totalUnread: number;
  openIds: string[];
  minimized: Record<string, boolean>;
  tick: number;
  channelById: (id: string) => Channel | undefined;
  openChannel: (id: string) => void;
  closeWindow: (id: string) => void;
  toggleMinimize: (id: string) => void;
  startDm: (userId: string) => Promise<string | null>;
  createGroup: (name: string, memberIds: string[]) => Promise<string | null>;
  refreshChannels: () => Promise<void>;
  markRead: (id: string) => void;
};

const TeamChatCtx = createContext<Ctx | null>(null);
export function useTeamChat(): Ctx {
  const c = useContext(TeamChatCtx);
  if (!c) throw new Error('useTeamChat must be used inside TeamChatProvider');
  return c;
}

async function fetchChannels(): Promise<{ channels: Channel[]; roster: ChatMember[]; totalUnread: number; meId: string } | null> {
  try {
    const r = await fetch('/api/admin/team-chat?op=channels').then((x) => x.json());
    if (!r?.ok) return null;
    return { channels: r.channels as Channel[], roster: r.roster as ChatMember[], totalUnread: r.totalUnread as number, meId: r.meId as string };
  } catch { return null; }
}

export function TeamChatProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [meId, setMeId] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roster, setRoster] = useState<ChatMember[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [minimized, setMinimized] = useState<Record<string, boolean>>({});
  const [tick, setTick] = useState(0);
  const knownIds = useRef<Set<string>>(new Set());

  const refreshChannels = useCallback(async () => {
    const data = await fetchChannels();
    if (!data) return;
    setChannels(data.channels);
    setRoster(data.roster);
    setTotalUnread(data.totalUnread);
    if (data.meId) setMeId(data.meId);
    knownIds.current = new Set(data.channels.map((c) => c.id));
    setReady(true);
  }, []);

  useEffect(() => { void refreshChannels(); }, [refreshChannels]);

  // Live signal: poll fallback hits the channels endpoint and reshapes it.
  const pollSnap = useCallback(async (): Promise<StreamSnap | null> => {
    const data = await fetchChannels();
    if (!data) return null;
    const chans = data.channels.map((c) => ({ id: c.id, lastMessageAt: c.lastMessageAt, unread: c.unread }));
    return { rev: chans.map((c) => `${c.id}:${c.lastMessageAt}:${c.unread}`).sort().join('|'), channels: chans, totalUnread: data.totalUnread };
  }, []);
  const { snapshot: stream } = useLiveChannel<StreamSnap>('/api/admin/team-chat/stream', pollSnap, (s) => s.rev, { pollMs: 5000 });

  useEffect(() => {
    if (!stream) return;
    setTotalUnread(stream.totalUnread);
    // A channel we don't know about appeared (new DM / added to a group) → full refresh.
    const unknown = stream.channels.some((c) => !knownIds.current.has(c.id));
    if (unknown) { void refreshChannels(); }
    else {
      // Merge unread + lastMessageAt; reorder by recency so the list stays live.
      setChannels((prev) => {
        const map = new Map(stream.channels.map((c) => [c.id, c]));
        const next = prev.map((c) => { const s = map.get(c.id); return s ? { ...c, unread: s.unread, lastMessageAt: s.lastMessageAt } : c; });
        next.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
        return next;
      });
      // Keep previews fresh in the background (debounced by the rev change cadence).
      void refreshChannels();
    }
    setTick((t) => t + 1);
  }, [stream, refreshChannels]);

  const channelById = useCallback((id: string) => channels.find((c) => c.id === id), [channels]);

  const markRead = useCallback((id: string) => {
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
    fetch('/api/admin/team-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'markRead', channelId: id }) }).catch(() => {});
  }, []);

  const openChannel = useCallback((id: string) => {
    setMinimized((m) => ({ ...m, [id]: false }));
    setOpenIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      return next.length > MAX_OPEN ? next.slice(next.length - MAX_OPEN) : next;
    });
    markRead(id);
  }, [markRead]);

  const closeWindow = useCallback((id: string) => setOpenIds((prev) => prev.filter((x) => x !== id)), []);
  const toggleMinimize = useCallback((id: string) => setMinimized((m) => ({ ...m, [id]: !m[id] })), []);

  const startDm = useCallback(async (userId: string): Promise<string | null> => {
    const r = await fetch('/api/admin/team-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'startDm', userId }) }).then((x) => x.json()).catch(() => null);
    if (r?.ok) { await refreshChannels(); openChannel(r.channelId); return r.channelId; }
    return null;
  }, [refreshChannels, openChannel]);

  const createGroup = useCallback(async (name: string, memberIds: string[]): Promise<string | null> => {
    const r = await fetch('/api/admin/team-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'createGroup', name, memberIds }) }).then((x) => x.json()).catch(() => null);
    if (r?.ok) { await refreshChannels(); openChannel(r.channelId); return r.channelId; }
    return null;
  }, [refreshChannels, openChannel]);

  const value: Ctx = {
    ready, meId, channels, roster, totalUnread, openIds, minimized, tick,
    channelById, openChannel, closeWindow, toggleMinimize, startDm, createGroup, refreshChannels, markRead,
  };
  return <TeamChatCtx.Provider value={value}>{children}</TeamChatCtx.Provider>;
}
