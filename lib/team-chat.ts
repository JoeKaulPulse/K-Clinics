import 'server-only';
import { db } from '@/lib/db';

// ─────────────────────────────────────────────────────────────────────────────
// Team chat — server logic for internal staff messaging (DMs + group channels).
//
// Best-effort notifications (never block a send). Real-time delivery is a thin
// SSE "something changed in these channels" signal (see the stream route) that
// the client turns into delta fetches — keeps the hot path cheap and correct.
// All membership/permission checks live here so every API op shares one guard.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_BODY = 4000;
export const MAX_ATTACHMENTS = 10;
const PREVIEW_LEN = 140;

export type ChatMember = { id: string; name: string; email: string; photoUrl: string | null; title: string | null };
export type ChatAttachment = { id: string; kind: string; url: string; name: string | null; mime: string | null; width: number | null; height: number | null };
export type ChatReaction = { emoji: string; count: number; mine: boolean };
export type ChatMessageDTO = {
  id: string; channelId: string; authorId: string | null; authorName: string; authorPhoto: string | null;
  kind: string; body: string; mentionIds: string[]; mentionsAll: boolean;
  replyToId: string | null; replyTo: { id: string; authorName: string; preview: string } | null;
  attachments: ChatAttachment[]; reactions: ChatReaction[];
  editedAt: string | null; deletedAt: string | null; createdAt: string; mine: boolean;
};
export type ChannelDTO = {
  id: string; kind: string; title: string; avatarUrl: string | null; topic: string | null;
  members: ChatMember[]; memberCount: number;
  lastMessageAt: string; lastMessagePreview: string; unread: number; muted: boolean; myRole: string;
};

/** Stable key for a 1:1 channel: the two member ids, sorted, joined. */
export function dmKeyFor(a: string, b: string): string {
  return [a, b].sort().join(':');
}

const previewOf = (body: string, attachmentCount: number): string => {
  const t = (body || '').replace(/\s+/g, ' ').trim();
  if (t) return t.slice(0, PREVIEW_LEN);
  return attachmentCount > 0 ? '📎 Attachment' : '';
};

/** Roster of active staff for the "new chat" picker and @-mention autocomplete. */
export async function chatRoster(): Promise<ChatMember[]> {
  const users = await db.adminUser.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, photoUrl: true, title: true },
  });
  return users.map((u) => ({ id: u.id, name: u.name || u.email, email: u.email, photoUrl: u.photoUrl, title: u.title }));
}

/** The membership row, or null if the user isn't in the channel. The single guard. */
export async function membership(meId: string, channelId: string) {
  return db.teamChannelMember.findUnique({ where: { channelId_userId: { channelId, userId: meId } } });
}

/** Find (or create) the 1:1 DM between me and another staff member. */
export async function getOrCreateDm(meId: string, otherId: string): Promise<string> {
  if (meId === otherId) throw new Error('Cannot DM yourself.');
  const key = dmKeyFor(meId, otherId);
  const existing = await db.teamChannel.findUnique({ where: { dmKey: key }, select: { id: true } });
  if (existing) return existing.id;
  // Confirm the other person is a real, active staff member.
  const other = await db.adminUser.findFirst({ where: { id: otherId, active: true }, select: { id: true } });
  if (!other) throw new Error('That person is not an active staff member.');
  const channel = await db.teamChannel.create({
    data: {
      kind: 'DM', dmKey: key, createdById: meId,
      members: { create: [{ userId: meId, role: 'MEMBER' }, { userId: otherId, role: 'MEMBER' }] },
    },
    select: { id: true },
  });
  return channel.id;
}

/** Create a named group channel with the given members (plus me as OWNER). */
export async function createGroup(meId: string, name: string, memberIds: string[]): Promise<string> {
  const clean = (name || '').trim().slice(0, 80) || 'New group';
  const ids = Array.from(new Set([meId, ...memberIds]));
  const valid = await db.adminUser.findMany({ where: { id: { in: ids }, active: true }, select: { id: true } });
  const validIds = new Set(valid.map((v) => v.id));
  const channel = await db.teamChannel.create({
    data: {
      kind: 'GROUP', name: clean, createdById: meId,
      members: { create: ids.filter((id) => validIds.has(id)).map((id) => ({ userId: id, role: (id === meId ? 'OWNER' : 'MEMBER') as 'OWNER' | 'MEMBER' })) },
    },
    select: { id: true },
  });
  await postSystemMessage(channel.id, `${await displayName(meId)} created the group.`);
  return channel.id;
}

async function displayName(userId: string): Promise<string> {
  const u = await db.adminUser.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  return u?.name || u?.email || 'Someone';
}

/** A SYSTEM message (joins, renames, leaves). No author, no notification. */
export async function postSystemMessage(channelId: string, body: string): Promise<void> {
  await db.teamMessage.create({ data: { channelId, kind: 'SYSTEM', body: body.slice(0, 300), authorId: null } });
  await db.teamChannel.update({ where: { id: channelId }, data: { lastMessageAt: new Date() } });
}

function channelTitle(kind: string, name: string | null, members: ChatMember[], meId: string): string {
  if (kind === 'GROUP') return name || members.filter((m) => m.id !== meId).map((m) => m.name).join(', ') || 'Group';
  const other = members.find((m) => m.id !== meId);
  return other?.name || 'Direct message';
}

/** All my channels, newest activity first, with members, last-message preview and unread. */
export async function listMyChannels(meId: string): Promise<ChannelDTO[]> {
  const memberships = await db.teamChannelMember.findMany({
    where: { userId: meId },
    select: {
      role: true, muted: true, lastReadAt: true,
      channel: {
        select: {
          id: true, kind: true, name: true, topic: true, avatarUrl: true, lastMessageAt: true,
          members: { select: { user: { select: { id: true, name: true, email: true, photoUrl: true, title: true } } } },
          messages: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, attachments: { select: { id: true } } } },
        },
      },
    },
  });

  const rows = await Promise.all(memberships.map(async (m) => {
    const c = m.channel;
    const members: ChatMember[] = c.members.map((mm) => ({ id: mm.user.id, name: mm.user.name || mm.user.email, email: mm.user.email, photoUrl: mm.user.photoUrl, title: mm.user.title }));
    const last = c.messages[0];
    // Unread: messages since I last read, not mine, not deleted. Only query when
    // the channel has moved on since my lastReadAt (cheap pre-filter).
    let unread = 0;
    if (!m.lastReadAt || c.lastMessageAt > m.lastReadAt) {
      unread = await db.teamMessage.count({
        where: { channelId: c.id, deletedAt: null, authorId: { not: meId }, ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}) },
      });
    }
    return {
      id: c.id, kind: c.kind, title: channelTitle(c.kind, c.name, members, meId), avatarUrl: c.avatarUrl, topic: c.topic,
      members, memberCount: members.length,
      lastMessageAt: c.lastMessageAt.toISOString(),
      lastMessagePreview: last ? previewOf(last.body, last.attachments.length) : '',
      unread, muted: m.muted, myRole: m.role,
    } as ChannelDTO;
  }));

  return rows.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

/** Lightweight per-user signal for the SSE stream: channel ids + lastMessageAt +
 *  unread. The client refetches detail when this changes. */
export async function streamSnapshot(meId: string): Promise<{ rev: string; channels: { id: string; lastMessageAt: string; unread: number }[]; totalUnread: number }> {
  const memberships = await db.teamChannelMember.findMany({
    where: { userId: meId },
    select: { lastReadAt: true, muted: true, channel: { select: { id: true, lastMessageAt: true } } },
  });
  const channels = await Promise.all(memberships.map(async (m) => {
    let unread = 0;
    if (!m.lastReadAt || m.channel.lastMessageAt > m.lastReadAt) {
      unread = await db.teamMessage.count({
        where: { channelId: m.channel.id, deletedAt: null, authorId: { not: meId }, ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}) },
      });
    }
    return { id: m.channel.id, lastMessageAt: m.channel.lastMessageAt.toISOString(), unread, muted: m.muted };
  }));
  const totalUnread = channels.reduce((s, c) => s + (c.muted ? 0 : c.unread), 0);
  const rev = channels.map((c) => `${c.id}:${c.lastMessageAt}:${c.unread}`).sort().join('|');
  return { rev, channels: channels.map(({ id, lastMessageAt, unread }) => ({ id, lastMessageAt, unread })), totalUnread };
}

/** Total unread across my un-muted channels (for the launcher badge). */
export async function totalUnread(meId: string): Promise<number> {
  const snap = await streamSnapshot(meId);
  return snap.totalUnread;
}

type ReplyPreview = { id: string; authorName: string; preview: string };

function shapeMessage(m: {
  id: string; channelId: string; authorId: string | null; kind: string; body: string; mentionIds: string[]; mentionsAll: boolean;
  replyToId: string | null; editedAt: Date | null; deletedAt: Date | null; createdAt: Date;
  author: { name: string | null; email: string; photoUrl: string | null } | null;
  attachments: { id: string; kind: string; url: string; name: string | null; mime: string | null; width: number | null; height: number | null }[];
  reactions: { emoji: string; userId: string }[];
}, meId: string, replyMap?: Map<string, ReplyPreview>): ChatMessageDTO {
  const byEmoji = new Map<string, { count: number; mine: boolean }>();
  for (const r of m.reactions) {
    const cur = byEmoji.get(r.emoji) || { count: 0, mine: false };
    cur.count += 1; if (r.userId === meId) cur.mine = true;
    byEmoji.set(r.emoji, cur);
  }
  return {
    id: m.id, channelId: m.channelId, authorId: m.authorId,
    authorName: m.author?.name || m.author?.email || (m.kind === 'SYSTEM' ? 'System' : 'Unknown'),
    authorPhoto: m.author?.photoUrl || null,
    kind: m.kind, body: m.deletedAt ? '' : m.body, mentionIds: m.mentionIds, mentionsAll: m.mentionsAll,
    replyToId: m.replyToId,
    replyTo: (m.replyToId && replyMap?.get(m.replyToId)) || null,
    attachments: m.deletedAt ? [] : m.attachments.map((a) => ({ id: a.id, kind: a.kind, url: a.url, name: a.name, mime: a.mime, width: a.width, height: a.height })),
    reactions: Array.from(byEmoji.entries()).map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine })),
    editedAt: m.editedAt?.toISOString() || null, deletedAt: m.deletedAt?.toISOString() || null,
    createdAt: m.createdAt.toISOString(), mine: m.authorId === meId,
  };
}

// NOTE: replyToId is a plain column (no Prisma relation), so reply previews are
// resolved with a separate batched lookup (replyPreviewMap) — NOT a relation
// include. Including a non-relation field here throws at runtime.
const MSG_INCLUDE = {
  author: { select: { name: true, email: true, photoUrl: true } },
  attachments: { orderBy: { createdAt: 'asc' as const } },
  reactions: { select: { emoji: true, userId: true } },
} as const;

/** Resolve quoted-message previews for a batch of rows (replyToId → preview). */
async function replyPreviewMap(rows: { replyToId: string | null }[]): Promise<Map<string, ReplyPreview>> {
  const ids = Array.from(new Set(rows.map((r) => r.replyToId).filter(Boolean))) as string[];
  if (!ids.length) return new Map();
  const targets = await db.teamMessage.findMany({ where: { id: { in: ids } }, select: { id: true, body: true, author: { select: { name: true, email: true } } } });
  return new Map(targets.map((t) => [t.id, { id: t.id, authorName: t.author?.name || t.author?.email || 'Unknown', preview: previewOf(t.body, 0) }]));
}

/** A page of messages, oldest→newest. `before` paginates older; `after` fetches new. */
export async function getMessages(meId: string, channelId: string, opts: { before?: string; after?: string; limit?: number } = {}): Promise<ChatMessageDTO[]> {
  const limit = Math.min(opts.limit ?? 40, 100);
  if (opts.after) {
    const rows = await db.teamMessage.findMany({
      where: { channelId, createdAt: { gt: new Date(opts.after) } },
      orderBy: { createdAt: 'asc' }, take: limit, include: MSG_INCLUDE,
    });
    const map = await replyPreviewMap(rows);
    return rows.map((m) => shapeMessage(m, meId, map));
  }
  const rows = await db.teamMessage.findMany({
    where: { channelId, ...(opts.before ? { createdAt: { lt: new Date(opts.before) } } : {}) },
    orderBy: { createdAt: 'desc' }, take: limit, include: MSG_INCLUDE,
  });
  const map = await replyPreviewMap(rows);
  return rows.reverse().map((m) => shapeMessage(m, meId, map));
}

export type SendInput = {
  body?: string;
  attachments?: { kind: string; url: string; name?: string; mime?: string; size?: number; width?: number; height?: number }[];
  mentionIds?: string[];
  mentionsAll?: boolean;
  replyToId?: string;
};

const ATTACH_KINDS = new Set(['IMAGE', 'VIDEO', 'FILE', 'GIF']);

/** Post a message to a channel I belong to: persists, bumps activity, notifies. */
export async function sendMessage(meId: string, channelId: string, input: SendInput): Promise<ChatMessageDTO> {
  const body = (input.body || '').trim().slice(0, MAX_BODY);
  const attachments = (input.attachments || [])
    .filter((a) => a && typeof a.url === 'string' && /^https?:\/\//.test(a.url) && ATTACH_KINDS.has(a.kind))
    .slice(0, MAX_ATTACHMENTS);
  if (!body && attachments.length === 0) throw new Error('Type a message or attach a file.');

  // Mentions: keep only ids that are real members of this channel.
  const memberRows = await db.teamChannelMember.findMany({ where: { channelId }, select: { userId: true } });
  const memberIds = new Set(memberRows.map((m) => m.userId));
  const mentionIds = Array.from(new Set(input.mentionIds || [])).filter((id) => memberIds.has(id) && id !== meId);
  const mentionsAll = Boolean(input.mentionsAll);

  const replyToId = input.replyToId && (await db.teamMessage.findFirst({ where: { id: input.replyToId, channelId }, select: { id: true } })) ? input.replyToId : null;

  const message = await db.teamMessage.create({
    data: {
      channelId, authorId: meId, kind: 'TEXT', body, mentionIds, mentionsAll, replyToId,
      attachments: attachments.length ? {
        create: attachments.map((a) => ({
          kind: a.kind, url: a.url, name: a.name?.slice(0, 200) || null, mime: a.mime?.slice(0, 100) || null,
          size: typeof a.size === 'number' ? a.size : null, width: typeof a.width === 'number' ? a.width : null, height: typeof a.height === 'number' ? a.height : null,
        })),
      } : undefined,
    },
    include: MSG_INCLUDE,
  });
  await db.teamChannel.update({ where: { id: channelId }, data: { lastMessageAt: message.createdAt } });
  // Sender has implicitly read up to their own message.
  await db.teamChannelMember.update({ where: { channelId_userId: { channelId, userId: meId } }, data: { lastReadAt: message.createdAt } }).catch(() => {});

  void notifyMessage(meId, channelId, message.id, body, attachments.length, mentionIds, mentionsAll).catch(() => {});
  const replyMap = await replyPreviewMap([message]);
  return shapeMessage(message, meId, replyMap);
}

/** Fan out notifications for a new message to the other members (mentions get a
 *  higher-priority 'mention' notification; muted members are skipped). */
async function notifyMessage(meId: string, channelId: string, messageId: string, body: string, attachmentCount: number, mentionIds: string[], mentionsAll: boolean): Promise<void> {
  const [channel, author, members] = await Promise.all([
    db.teamChannel.findUnique({ where: { id: channelId }, select: { kind: true, name: true } }),
    db.adminUser.findUnique({ where: { id: meId }, select: { name: true, email: true } }),
    db.teamChannelMember.findMany({ where: { channelId, userId: { not: meId } }, select: { userId: true, muted: true } }),
  ]);
  if (!channel) return;
  const authorName = author?.name || author?.email || 'A colleague';
  const isGroup = channel.kind === 'GROUP';
  const groupLabel = isGroup ? channel.name || 'group' : null;
  const titleFor = (mentioned: boolean) =>
    mentioned ? `${authorName} mentioned you${groupLabel ? ` in ${groupLabel}` : ''}`
      : isGroup ? `${authorName} in ${groupLabel}` : `New message from ${authorName}`;
  const preview = previewOf(body, attachmentCount);
  const href = `/admin/messages?c=${channelId}`;
  const { notifyStaffById } = await import('@/lib/notifications');
  const mentionSet = new Set(mentionIds);

  await Promise.all(members.map(async (m) => {
    if (m.muted) return; // muted: no in-app burst, no push
    const mentioned = mentionsAll || mentionSet.has(m.userId);
    await notifyStaffById(m.userId, {
      kind: mentioned ? 'mention' : 'comment',
      category: 'messages',
      priority: mentioned ? 'high' : 'normal',
      title: titleFor(mentioned),
      body: preview,
      href,
      groupKey: `team-chat:${channelId}`,
    }, meId).catch(() => {});
  }));
}

export async function markRead(meId: string, channelId: string): Promise<void> {
  await db.teamChannelMember.update({ where: { channelId_userId: { channelId, userId: meId } }, data: { lastReadAt: new Date() } }).catch(() => {});
  // Clear the collapsed chat notification for this channel so the bell agrees with the dock.
  await db.staffNotification.updateMany({ where: { userId: meId, groupKey: `team-chat:${channelId}`, readAt: null }, data: { readAt: new Date() } }).catch(() => {});
}

export async function toggleReaction(meId: string, messageId: string, emoji: string): Promise<void> {
  const e = (emoji || '').trim().slice(0, 16);
  if (!e) return;
  const msg = await db.teamMessage.findUnique({ where: { id: messageId }, select: { channelId: true } });
  if (!msg || !(await membership(meId, msg.channelId))) throw new Error('Not permitted.');
  const existing = await db.teamMessageReaction.findUnique({ where: { messageId_userId_emoji: { messageId, userId: meId, emoji: e } } });
  if (existing) await db.teamMessageReaction.delete({ where: { id: existing.id } });
  else await db.teamMessageReaction.create({ data: { messageId, userId: meId, emoji: e } });
  await db.teamChannel.update({ where: { id: msg.channelId }, data: { lastMessageAt: new Date() } }).catch(() => {});
}

export async function editMessage(meId: string, messageId: string, body: string): Promise<void> {
  const msg = await db.teamMessage.findUnique({ where: { id: messageId }, select: { authorId: true, deletedAt: true } });
  if (!msg || msg.authorId !== meId || msg.deletedAt) throw new Error('You can only edit your own messages.');
  await db.teamMessage.update({ where: { id: messageId }, data: { body: (body || '').trim().slice(0, MAX_BODY), editedAt: new Date() } });
}

export async function deleteMessage(meId: string, messageId: string): Promise<void> {
  const msg = await db.teamMessage.findUnique({ where: { id: messageId }, select: { authorId: true, channelId: true } });
  if (!msg) return;
  const mem = await membership(meId, msg.channelId);
  const isOwner = mem?.role === 'OWNER';
  if (msg.authorId !== meId && !isOwner) throw new Error('You can only delete your own messages.');
  await db.teamMessage.update({ where: { id: messageId }, data: { deletedAt: new Date(), body: '' } });
}

export async function addMembers(meId: string, channelId: string, memberIds: string[]): Promise<void> {
  const channel = await db.teamChannel.findUnique({ where: { id: channelId }, select: { kind: true } });
  if (!channel || channel.kind !== 'GROUP' || !(await membership(meId, channelId))) throw new Error('Not permitted.');
  const valid = await db.adminUser.findMany({ where: { id: { in: memberIds }, active: true }, select: { id: true, name: true, email: true } });
  for (const u of valid) {
    const created = await db.teamChannelMember.upsert({
      where: { channelId_userId: { channelId, userId: u.id } },
      create: { channelId, userId: u.id, role: 'MEMBER' }, update: {},
      select: { createdAt: true },
    });
    void created;
    await postSystemMessage(channelId, `${u.name || u.email} was added.`);
  }
}

export async function leaveChannel(meId: string, channelId: string): Promise<void> {
  const channel = await db.teamChannel.findUnique({ where: { id: channelId }, select: { kind: true } });
  if (!channel || channel.kind !== 'GROUP') throw new Error('You can only leave group channels.');
  await postSystemMessage(channelId, `${await displayName(meId)} left.`);
  await db.teamChannelMember.deleteMany({ where: { channelId, userId: meId } });
}

export async function renameChannel(meId: string, channelId: string, name: string): Promise<void> {
  const mem = await membership(meId, channelId);
  if (!mem) throw new Error('Not permitted.');
  const channel = await db.teamChannel.findUnique({ where: { id: channelId }, select: { kind: true } });
  if (channel?.kind !== 'GROUP') throw new Error('Only group channels can be renamed.');
  const clean = (name || '').trim().slice(0, 80);
  if (!clean) return;
  await db.teamChannel.update({ where: { id: channelId }, data: { name: clean } });
  await postSystemMessage(channelId, `${await displayName(meId)} renamed the group to “${clean}”.`);
}

export async function setMuted(meId: string, channelId: string, muted: boolean): Promise<void> {
  await db.teamChannelMember.update({ where: { channelId_userId: { channelId, userId: meId } }, data: { muted: Boolean(muted) } }).catch(() => {});
}

/** Search my messages (and channel names) for a term. */
export async function searchMessages(meId: string, q: string): Promise<{ channelId: string; messageId: string; preview: string; createdAt: string }[]> {
  const term = (q || '').trim().slice(0, 100);
  if (term.length < 2) return [];
  const myChannels = await db.teamChannelMember.findMany({ where: { userId: meId }, select: { channelId: true } });
  const ids = myChannels.map((c) => c.channelId);
  if (!ids.length) return [];
  const rows = await db.teamMessage.findMany({
    where: { channelId: { in: ids }, deletedAt: null, body: { contains: term, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, channelId: true, body: true, createdAt: true },
  });
  return rows.map((r) => ({ channelId: r.channelId, messageId: r.id, preview: previewOf(r.body, 0), createdAt: r.createdAt.toISOString() }));
}

/** Get a single channel's DTO for me (used after creating/opening a channel). */
export async function getChannel(meId: string, channelId: string): Promise<ChannelDTO | null> {
  if (!(await membership(meId, channelId))) return null;
  const all = await listMyChannels(meId);
  return all.find((c) => c.id === channelId) || null;
}
