# Notifications — design & build plan

How staff are told that something needs them, across the whole admin. This replaces
the current ad-hoc setup (a single flat `StaffNotification` list, 45s polling bell,
no categories, no priority, no per-user control, and whole areas — chat, reviews,
waitlist, stock, payments, time-off — that fire nothing).

## Problems today

- **Unclear / sporadic.** Only six areas fire anything (bookings same-day requests,
  consultation notes, build board, tasks, contractor tasks, room turnover). The wording
  varies and there is no sense of what matters more.
- **No click-through on some.** A few notifications have no `href`, so they dead-end.
- **No categories.** Everything is one flat list; you can't see "3 messages, 1 payment
  problem" at a glance.
- **No preferences.** Every user gets the same things; you can't mute a category or
  choose email vs in-app. The only toggles are two clinic-wide digest switches.
- **Chat has no notification at all.** A visitor messages and staff only find out if they
  happen to be looking at the chat page (5–6s polling, a number in a list).

## Principles

1. **Every notification answers "what, who, and where."** A clear title, the person/record
   it's about, and a click-through that lands on the exact screen to act.
2. **Priority is explicit.** Four levels (below) drive ordering, colour, and which channels fire.
3. **Categorised.** Each notification has a category so the bell can group and count, and so
   preferences can be set per category.
4. **The user is in control.** Per-category choice of in-app and/or email, plus quiet hours.
   Sensible defaults so it works out of the box.
5. **No spam.** De-duplicate (don't repeat the same unread notification within a short window)
   and collapse bursts (e.g. five chat messages in a row = one "new messages" notification that
   updates, not five rows).
6. **Permission-safe.** A notification never leaks data a role can't see; clinical detail never
   reaches front-desk/contractor/developer views (the body stays non-clinical, the link gates).

## Categories

| Category | Covers | Default channels |
| --- | --- | --- |
| `messages` | live chat, email replies, contact-form enquiries | in-app + push |
| `bookings` | new/confirmed/cancelled/rescheduled/no-show, same-day requests, arrivals | in-app (+ email for owners/front desk) |
| `clinical` | consultation notes, @mentions, consent signed, health-flag arrivals | in-app |
| `finance` | payment failed, refund, large refund, payout, daily takings | in-app + email |
| `reviews` | new review, low rating needing a reply | in-app (+ email on low rating) |
| `inventory` | low stock, batch expiring, orders to fulfil | in-app + email |
| `team` | time-off requests/decisions, rota changes, room turnover, clock reminders | in-app |
| `academy` | new application, funding application, course completion | in-app |
| `marketing` | campaign sent/failed, kiosk lead, new lead | in-app |
| `system` | build board, deploys, cron failures, GDPR requests, security events | in-app + email |

## Priority

| Level | Meaning | Effect |
| --- | --- | --- |
| `urgent` | act now | red; in-app + email + push (push in Phase 2), ignores quiet hours |
| `high` | today | amber; in-app + email if the category has email on |
| `normal` | routine | default; in-app only unless the user opted the category into email |
| `low` | FYI / digestible | grey; rolled into the daily/weekly digest, no individual ping |

## What each tool notifies for

The full matrix. "Who" is by permission (resolved to real users), so it always reaches the
right people without naming individuals. Every row has a click-through.

### Messages (the owner's "new messages" question)
| Event | Who | Priority | Link |
| --- | --- | --- | --- |
| New inbound chat message | `chat.view` | urgent in open hours, else high | `/admin/chat?c={id}` |
| Visitor replied by email (chat bridge) | the responder + `chat.view` | high | `/admin/chat?c={id}` |
| New contact-form / enquiry | `clients.view` | high | `/admin/leads/{id}` |

**How a new message appears:** the bell badge turns red and bumps immediately; a row appears
at the top of the bell titled "New message from {name}" with a one-line preview and a direct link
to that conversation; the chat nav item shows its own unread count. A burst from the same
conversation collapses into one row that updates its preview and count rather than stacking.
With push enabled (Phase 2) and the tab closed, the browser/OS shows it. Polling drops from 45s
to ~10s for `messages`, and the open chat thread keeps its 5s refresh, so it feels live without a
socket. A soft chime (default off, per-user) can be enabled for chat.

### Bookings
| Event | Who | Priority | Link |
| --- | --- | --- | --- |
| New booking / confirmed | assigned clinician + `bookings.view` | high | `/admin/bookings/{id}` |
| Same-day request (needs approval) | `bookings.manage` | urgent | `/admin/bookings/{id}` |
| Cancelled / rescheduled | assigned clinician + front desk | high | `/admin/bookings/{id}` |
| No-show marked | `bookings.manage` | normal | `/admin/bookings/{id}` |
| Arrival checked in | assigned clinician | normal | `/admin/my-day` |

### Clinical
| Event | Who | Priority | Link |
| --- | --- | --- | --- |
| @mention in a consultation/client note | the mentioned user | high | `/admin/consultations/{id}` |
| New note on your client | the clinician | normal | `/admin/clients/{id}` |
| Consent signed for an appointment | assigned clinician | normal | `/admin/bookings/{id}` |
| Medical-flag client arriving today | assigned clinician | high | `/admin/my-day` |

### Finance
| Event | Who | Priority | Link |
| --- | --- | --- | --- |
| Payment failed / needs SCA | `finance.view` | urgent | `/admin/bookings/{id}` |
| Refund processed | `finance.view` | normal | `/admin/bookings/{id}` |
| Large refund (> threshold) | `finance.view` + owner | high | `/admin/bookings/{id}` |
| Completed-but-not-charged (daily) | `finance.view` | high | `/admin/bookings` |
| Daily takings ready | `finance.view` | low (digest) | `/admin/reports` |

### Reviews, inventory, team, academy, marketing, system
| Event | Who | Priority | Link |
| --- | --- | --- | --- |
| New review | `reviews.manage` | normal (high if ≤ 3★) | `/admin/reviews` |
| Stock below threshold / batch expiring | `inventory.view` | high | `/admin/inventory` |
| Order to fulfil | `finance.view` | high | `/admin/orders` |
| Time-off request | `schedule.manage` | high | `/admin/time-off` |
| Time-off approved/declined | the requester | normal | `/admin/time-off` |
| Room needs turnover | `rooms.prep.manage` | high | `/admin/my-day` |
| New academy application / funding | `settings.manage` | high | `/admin/academy` |
| Kiosk lead claimed | `marketing.view` | normal | `/admin/marketing` |
| Campaign send failed | `campaigns.send` | high | `/admin/marketing/email` |
| Build item assigned / @mention | the assignee | normal | `/admin/build` |
| Cron job failed / deploy issue | `platform.status` | high | `/admin/status` |
| GDPR export / erasure run | `settings.manage` | high | `/admin/clients/{id}` |
| Account locked out (security) | `staff.view` | high | `/admin/security` |

## Managing preferences in-app

A new **Settings → Notifications** page (and a shortcut from the bell's gear icon). Per user:

- A row per category with two switches: **In-app** and **Email**. Defaults from the table above.
- **Quiet hours** (e.g. 20:00–08:00): non-urgent notifications are held and rolled into the next
  digest; `urgent` always comes through.
- **Digest**: off / daily / weekly for `low` items (replaces the two clinic-wide switches with a
  per-user choice; the clinic-wide default remains as the fallback).
- **Chat sound**: on/off.
- **Browser push**: a "Enable on this device" button (Phase 2) that registers the browser.

Stored on `AdminUser.notifPrefs` (JSON, additive) so there's no new table and nothing to migrate
destructively. Unset = the defaults, so existing staff need do nothing.

## The bell & the notifications page

- **Bell**: grouped by category with a count chip each ("Messages 3 · Finance 1"), urgent items
  pinned to the top in red. Each row: icon, title, preview, relative time, and it always links
  somewhere. Clicking a row marks just that row read (opening the panel no longer marks everything
  read). A "Mark all read" action and a "See all →" link remain.
- **`/admin/notifications`**: full history with category filter tabs and read/unread, so nothing is
  lost once it scrolls out of the bell.

## Delivery channels

- **In-app** (now): the bell + page, ~10s polling for `messages`, 45s otherwise, paused on hidden tabs.
- **Email** (now): per the category/priority rules and the user's prefs, via Resend; `low` items roll
  into the existing daily/weekly digest.
- **Web push** (Phase 2): a service worker + `PushSubscription` (VAPID), opt-in per device, for
  `urgent` and `messages` so a closed tab still surfaces a new chat or a payment failure.
- **SMS** (not planned for staff): kept for client reminders only; staff push covers the urgent gap.

## Build phases

1. **Foundation** — `category` + `priority` on `StaffNotification`; `AdminUser.notifPrefs`; a single
   `notify()` that categorises, sets priority, respects prefs + quiet hours, de-dupes, and always
   carries an href. Back-compat wrappers keep existing callers working and auto-categorise them.
2. **Bell + preferences UI** — grouped bell, per-row read, `/admin/notifications`, Settings → Notifications.
3. **Coverage** — wire the matrix above into each tool (messages/chat first, then bookings, finance,
   reviews, inventory, team/time-off, academy, marketing, GDPR).
4. **Web push** — service worker + subscriptions for urgent + messages.

Phases 1–3 are in-app + email only and need no new infrastructure or keys. Phase 4 adds push and is
the one piece that needs a VAPID keypair.
