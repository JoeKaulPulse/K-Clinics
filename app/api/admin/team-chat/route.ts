import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Internal team chat (staff-to-staff). Any signed-in staff member may use it;
// per-channel membership is enforced inside lib/team-chat.ts. Reads via GET,
// writes via POST. Real-time delivery is the SSE stream route; this is the
// REST surface the client pulls deltas from.

async function me() {
  const { getSession } = await import('@/lib/auth');
  return getSession();
}

export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const session = await me();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const url = new URL(req.url);
  const op = url.searchParams.get('op') || 'channels';
  const chat = await import('@/lib/team-chat');

  try {
  if (op === 'channels') {
    const [channels, roster] = await Promise.all([chat.listMyChannels(session.sub), chat.chatRoster()]);
    const totalUnread = channels.reduce((s, c) => s + (c.muted ? 0 : c.unread), 0);
    return NextResponse.json({ ok: true, channels, roster, totalUnread, meId: session.sub });
  }
  if (op === 'roster') {
    return NextResponse.json({ ok: true, roster: await chat.chatRoster() });
  }
  if (op === 'messages') {
    const channelId = url.searchParams.get('channelId') || '';
    if (!channelId || !(await chat.membership(session.sub, channelId))) return NextResponse.json({ ok: false, error: 'Not in this conversation.' }, { status: 403 });
    const before = url.searchParams.get('before') || undefined;
    const after = url.searchParams.get('after') || undefined;
    const messages = await chat.getMessages(session.sub, channelId, { before, after, limit: 40 });
    return NextResponse.json({ ok: true, messages });
  }
  if (op === 'channel') {
    const channelId = url.searchParams.get('channelId') || '';
    const channel = await chat.getChannel(session.sub, channelId);
    if (!channel) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
    return NextResponse.json({ ok: true, channel });
  }
  if (op === 'search') {
    return NextResponse.json({ ok: true, results: await chat.searchMessages(session.sub, url.searchParams.get('q') || '') });
  }
  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
  } catch (e) {
    console.error('[team-chat] GET failed', (e as Error)?.message);
    return NextResponse.json({ ok: false, error: 'Something went wrong loading chat.' }, { status: 200 });
  }
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const session = await me();
  if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const chat = await import('@/lib/team-chat');

  try {
    switch (b.op) {
      case 'send': {
        const { enforceRateLimit } = await import('@/lib/security/guard');
        if (!(await enforceRateLimit(req, 'team-chat-send', 40, 60))) return NextResponse.json({ ok: false, error: 'Slow down a moment.' }, { status: 429 });
        if (!b.channelId || !(await chat.membership(session.sub, b.channelId))) return NextResponse.json({ ok: false, error: 'Not in this conversation.' }, { status: 403 });
        const message = await chat.sendMessage(session.sub, b.channelId, { body: b.body, attachments: b.attachments, mentionIds: b.mentionIds, mentionsAll: b.mentionsAll, replyToId: b.replyToId });
        return NextResponse.json({ ok: true, message });
      }
      case 'startDm': {
        const channelId = await chat.getOrCreateDm(session.sub, String(b.userId || ''));
        return NextResponse.json({ ok: true, channelId, channel: await chat.getChannel(session.sub, channelId) });
      }
      case 'createGroup': {
        const channelId = await chat.createGroup(session.sub, String(b.name || ''), Array.isArray(b.memberIds) ? b.memberIds.map(String) : []);
        return NextResponse.json({ ok: true, channelId, channel: await chat.getChannel(session.sub, channelId) });
      }
      case 'markRead': {
        await chat.markRead(session.sub, String(b.channelId || ''));
        return NextResponse.json({ ok: true });
      }
      case 'react': {
        await chat.toggleReaction(session.sub, String(b.messageId || ''), String(b.emoji || ''));
        return NextResponse.json({ ok: true });
      }
      case 'edit': {
        await chat.editMessage(session.sub, String(b.messageId || ''), String(b.body || ''));
        return NextResponse.json({ ok: true });
      }
      case 'delete': {
        await chat.deleteMessage(session.sub, String(b.messageId || ''));
        return NextResponse.json({ ok: true });
      }
      case 'addMembers': {
        await chat.addMembers(session.sub, String(b.channelId || ''), Array.isArray(b.memberIds) ? b.memberIds.map(String) : []);
        return NextResponse.json({ ok: true, channel: await chat.getChannel(session.sub, String(b.channelId || '')) });
      }
      case 'leave': {
        await chat.leaveChannel(session.sub, String(b.channelId || ''));
        return NextResponse.json({ ok: true });
      }
      case 'rename': {
        await chat.renameChannel(session.sub, String(b.channelId || ''), String(b.name || ''));
        return NextResponse.json({ ok: true, channel: await chat.getChannel(session.sub, String(b.channelId || '')) });
      }
      case 'mute': {
        await chat.setMuted(session.sub, String(b.channelId || ''), Boolean(b.muted));
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Something went wrong.' }, { status: 400 });
  }
}
