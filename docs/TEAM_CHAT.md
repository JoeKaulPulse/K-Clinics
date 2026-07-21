# Team chat & task automations

Internal staff-to-staff messaging in the admin, plus an admin-managed engine that
creates recurring and triggered work on the team Tasks board.

## Team chat

- **What it is.** 1:1 direct messages and group channels between staff. Separate
  from the visitor-facing `ChatConversation`/`ChatMessage` (different audience and
  lifecycle). Models: `TeamChannel`, `TeamChannelMember`, `TeamMessage`,
  `TeamMessageAttachment`, `TeamMessageReaction`.
- **Where it lives.** A chat button sits in the top bar next to the notification
  bell (the "hub"). Opening a conversation docks a window in the bottom-right.
  Windows are positioned *above* the existing Report-a-problem and Help buttons so
  nothing overlaps. On phones the launcher routes to the full-page `/admin/messages`
  view instead of docking.
- **Features.** Text, file/photo/video attachments (Vercel Blob, client-direct
  upload, up to 200 MB), GIFs, emoji, emoji reactions, `@`-mentions with
  autocomplete, reply/quote, edit/delete your own messages, group create / add
  people / rename / leave / mute, and "turn a message into a task".
- **Live delivery.** A per-user SSE stream (`/api/admin/team-chat/stream`) sends a
  tiny "these channels changed" signal; the client fetches the new messages. Falls
  back to polling if SSE drops (`hooks/useLiveChannel.ts`). No message bodies cross
  the SSE wire.
- **Notifications.** New messages notify the other members through the existing hub
  (`lib/notifications.ts`, category `messages`), which also drives web-push.
  Mentions are higher priority. Muting a channel silences it. Unread counts feed the
  launcher badge, the `Team chat` nav badge and `/api/admin/badges`.
- **Permissions.** Available to every signed-in staff member (no extra permission,
  like the Tasks board). Per-channel membership is enforced server-side in
  `lib/team-chat.ts`.

### GIFs

GIF search is optional. Set `TENOR_API_KEY` (preferred) or `GIPHY_API_KEY` to enable
it. Without a key the picker shows a tidy "not configured" note; everything else
works. The key stays server-side behind `/api/admin/team-chat/gifs`.

## Task automations

Admins (permission `tasks.automate`) manage these at `/admin/tasks/automations`
(linked from the Tasks board). They create tasks on the team board (TSK-) without
anyone lifting a finger. Automations carry an `AUT-<seq>` ref.

- **Repeat events (SCHEDULE).** Daily / weekly (pick weekdays) / monthly (pick a
  day), every N periods, at a clinic-local time. Each occurrence creates the
  template task, optionally with a due date N days out.
- **On completion (ON_TASK_COMPLETED).** When a completed task's title contains a
  phrase, spawn a follow-up task.
- **Assignment.** Fixed person, round-robin across a pool, or one copy each for
  everyone in the pool.
- **Templates.** Title and detail support `{date}`, `{weekday}` and `{day}` tokens.

### How it runs

The dispatch cron (`/api/cron/dispatch`, every 15 minutes) calls
`runDueTaskAutomations`. Recurrence is computed in `Europe/London` so times hold
across DST. A unique `(automationId, occurrenceKey)` run row makes it idempotent —
overlapping cron ticks can never double-spawn. "Run now" in the manager fires one
occurrence immediately.

## Schema / deploy note

All tables are additive and ship as the migration
`prisma/migrations/20260619120000_team_chat_and_task_automations`. The repo uses
versioned migrations (`USE_MIGRATIONS=true`), so they deploy via `prisma migrate
deploy` — keep it that way.
