// Client-side mirrors of the team-chat API DTOs (lib/team-chat.ts is server-only,
// so the shapes are re-declared here for the browser bundle).

export type ChatMember = { id: string; name: string; email: string; photoUrl: string | null; title: string | null };

export type ChatAttachment = { id: string; kind: string; url: string; name: string | null; mime: string | null; width: number | null; height: number | null };

export type ChatReaction = { emoji: string; count: number; mine: boolean };

export type ChatMessage = {
  id: string; channelId: string; authorId: string | null; authorName: string; authorPhoto: string | null;
  kind: string; body: string; mentionIds: string[]; mentionsAll: boolean;
  replyToId: string | null; replyTo: { id: string; authorName: string; preview: string } | null;
  attachments: ChatAttachment[]; reactions: ChatReaction[];
  editedAt: string | null; deletedAt: string | null; createdAt: string; mine: boolean;
};

export type Channel = {
  id: string; kind: string; title: string; avatarUrl: string | null; topic: string | null;
  members: ChatMember[]; memberCount: number;
  lastMessageAt: string; lastMessagePreview: string; unread: number; muted: boolean; myRole: string;
};

// Draft attachment the composer holds before send (already uploaded to blob, or a GIF URL).
export type DraftAttachment = { kind: 'IMAGE' | 'VIDEO' | 'FILE' | 'GIF'; url: string; name?: string; mime?: string; size?: number; width?: number; height?: number };

export type StreamSnap = { rev: string; channels: { id: string; lastMessageAt: string; unread: number }[]; totalUnread: number };
