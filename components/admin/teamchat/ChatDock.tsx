'use client';

import { ChatWindow } from './ChatWindow';
import { Avatar, AvatarStack } from './Avatar';
import { useTeamChat } from './TeamChatProvider';

// Bottom-right docked windows. Positioned to sit ABOVE the existing floating
// actions (Report-a-problem pill + Help "?" button live at bottom-5 right-5),
// so chat never covers them — the `pb` clears that ~64px corner zone and the
// row is right-aligned. Hidden on small screens, where the launcher routes to
// the full /admin/messages page instead.
export function ChatDock() {
  const { openIds, minimized, channelById, closeWindow, toggleMinimize, markRead, meId } = useTeamChat();
  if (!openIds.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[45] hidden justify-end md:flex">
      <div className="pointer-events-none flex items-end gap-3 px-4 pb-[4.75rem] pr-[4.75rem]">
        {openIds.map((id) => {
          const channel = channelById(id);
          if (!channel) return null;
          if (minimized[id]) {
            return (
              <button
                key={id}
                onClick={() => { toggleMinimize(id); markRead(id); }}
                className="pointer-events-auto flex w-52 items-center gap-2 rounded-t-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-left text-[var(--color-porcelain)] shadow-[var(--shadow-lift)]"
              >
                {channel.kind === 'GROUP' ? <AvatarStack members={channel.members} meId={meId} size={24} /> : <Avatar name={channel.title} photo={channel.members.find((m) => m.id !== meId)?.photoUrl} size={24} />}
                <span className="min-w-0 flex-1 truncate text-sm">{channel.title}</span>
                {channel.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--color-gold-deep)] px-1 text-[0.65rem] font-semibold text-white">{channel.unread}</span>}
                <span onClick={(e) => { e.stopPropagation(); closeWindow(id); }} className="text-[var(--color-gold-bright)]" aria-label="Close">✕</span>
              </button>
            );
          }
          return (
            <div key={id} className="pointer-events-auto">
              <ChatWindow channelId={id} variant="docked" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
