# Project: Role-based My Day & Dashboards

> Status: **Planning** · Board project slug: `role-based-views` (seeds as `PRJ-n`)
> Source: owner request — "My Day planning and dashboard displays based on user type."

The admin currently shows **one** dashboard and **one** My Day to everyone, gated
only by permission (hiding widgets a role can't see). This project makes the
landing experience **role-shaped**: each user type sees a daily view built around
*their* job, and admins/owners can switch between views. It introduces two new
user types, several new data structures, new cross-user interactions, and a set
of reusable view components.

This is the fleshed-out spec. The actionable breakdown lives on the Build board
under this project (epic + tasks + subtasks); cite the `PRJ-` refs in commits/PRs.

---

## 1. Goals & principles

- **Right view, right person, zero clicks.** A clinician lands on clinical day;
  a receptionist on front-of-house; a developer on the build board; a contractor
  on their jobs + time clock. No hunting.
- **Admins/Owners can switch views** to see what any role sees (support, training,
  oversight) — with their choice remembered.
- **Permission-safe by construction.** A view never exposes data the role lacks
  (e.g. clinical health data must never reach FRONT_DESK / CONTRACTOR / DEVELOPER).
  Views are a *presentation* layer on top of the existing permission matrix
  (`lib/permissions.ts`), never a replacement for it.
- **Reuse, don't fork.** Build a small set of dashboard widgets and compose them
  per view, rather than four divergent pages.
- **Mobile-first & accessible** (front-of-house and contractors are on phones/tablets).
- **Additive & non-destructive** data changes (the deploy gate forbids destructive
  `prisma db push`): new enum values, new nullable columns, new tables only.

## 2. User types

| View | Maps to `Role` | Notes |
| --- | --- | --- |
| **Developer** | `DEVELOPER` *(new)* | Build board, CI/deploys, errors, logs. No client/clinical data by default. |
| **Admin / Owner** | `ADMIN`, `OWNER` | Full access; **can switch** to any view. Default view = a management overview. |
| **Clinician** | `PRACTITIONER` | Clinic appointments, room availability & prep, client info, appointment flow. |
| **Receptionist** | `FRONT_DESK` | Front-of-house: arrivals, check-in, prep handoff, payments, calls/chat. |
| **Contractor** | `CONTRACTOR` *(new)* | Contracted tasks, time tracking, facility plans & "where to find things". |
| (legacy) | `STAFF` | Falls back to a minimal general view. |

### New roles to add (additive enum change)
`DEVELOPER`, `CONTRACTOR` added to `enum Role` in `prisma/schema.prisma`.
Because `ROLE_DEFAULTS` in `lib/permissions.ts` is typed `Record<Role, string[]>`,
TypeScript will **force** us to define permission defaults for each new role —
a built-in safety net against shipping a role with no/over-broad permissions.

- `DEVELOPER` defaults: `dashboard.view`, `build.view`, `platform.status`. No client data.
- `CONTRACTOR` defaults: `dashboard.view` only + contractor-scoped keys (new, see §4).

## 3. Per-view specifications

### 3.1 Developer
- Build board snapshot: Open / In-review / Blocked / Not-on-GitHub counts + top items.
- Recent deployments (Vercel) with state; link to inspector + logs.
- Error reports (`BuildItem.type = ERROR`) newest first.
- Quick links: GitHub repo, runtime logs, platform status, token/usage stats.
- My Day: assigned build items, today's PRs/reviews, a focus list.

### 3.2 Admin / Owner
- Management overview (current dashboard's KPIs, revenue, attention items) **plus**
  a **View switcher** to preview any role's view.
- My Day: their own tasks + approvals (time-off, sign-offs) + day actions.

### 3.3 Clinician (PRACTITIONER)
- **Today's appointments** (own first, then clinic) with status & running-late flags.
- **Room availability** board (which rooms are free/occupied now & next).
- **Room prep status** for their next clients (clean/set — from §4 RoomPrep).
- **Client info** quick-cards: allergies, medical flag, consent state (clinical-gated).
- **Appointment flow** entry → the guided session (BLD-138) for the current/next client.
- My Day: clinical checklist, consult follow-ups, today's earnings (if permitted).

### 3.4 Receptionist (FRONT_DESK)
- **Arrivals timeline** + one-tap **check-in**; "prepare for arrival" prep (drinks,
  room) handed off to the clinician.
- **Payments due** / cards to capture; daily takings snapshot.
- **Calls & chat** needing a reply; **new booking** quick action; walk-in capture.
- No clinical health data.
- My Day: front-desk task list, callbacks, follow-ups.

### 3.5 Contractor (CONTRACTOR)
- **Contracted tasks / work to complete** (assigned, with due dates & status).
- **Time tracking**: clock in/out, breaks, today's hours, this week's total.
- **Facility knowledge**: floor plans, electrical plans, equipment locations,
  "where to find things", site instructions (from §4 FacilityDoc).
- No client, clinical, or financial data.
- My Day: their jobs for the day, time clock front-and-centre, relevant docs.

## 4. Data model changes (additive)

### Enum
- `Role` += `DEVELOPER`, `CONTRACTOR`.

### `AdminUser` (new nullable columns)
- `preferredDashboardView String?` — for admins/owners who switch; null = role default.
- `contractCompany String?`, `contractTradeType String?` — contractor metadata (optional).

### New models
- **`RoomPrep`** — daily prep state for a room.
  `id, roomId (→ Resource), date (DateOnly), status ('DIRTY'|'CLEANING'|'READY'),
  cleanedAt, cleanedBy, note, updatedAt`. One row per room per day (structural
  uniqueness via upsert on `roomId+date`, not a DB unique constraint — per the gate).
- **`TimeEntry`** — time tracking. `id, userId (→ AdminUser), kind ('SHIFT'|'BREAK'),
  startedAt, endedAt?, note?, taskId? (→ ContractorTask), createdAt`. Open entry =
  `endedAt null`. Powers clock in/out, breaks (incl. dashboard "lunch break"), timesheets.
- **`ContractorTask`** — contracted work. `id, ref?, title, detail?, status
  ('TODO'|'DOING'|'DONE'|'BLOCKED'), assigneeId (→ AdminUser), createdBy, dueAt?,
  locationId?, completedAt?, completedBy?, createdAt, updatedAt`.
  (Decision to record: extend `Task`/`BuildItem` vs a dedicated model — leaning
  dedicated to keep contractor scope cleanly isolated from staff/dev tasks.)
- **`FacilityDoc`** — facility knowledge base. `id, title, type ('FLOOR_PLAN'|
  'ELECTRICAL'|'PLUMBING'|'EQUIPMENT'|'INSTRUCTION'|'OTHER'), fileUrl (Blob),
  description?, locationId?, tags String[], order, createdAt`. Viewer is image/PDF.

### Touch points
- `lib/permissions.ts`: defaults for the two new roles; new permission keys
  (`contractor.tasks.view/manage`, `timetracking.use`, `timetracking.manage`,
  `facility.view/manage`, `rooms.prep.manage`).
- `prisma/seed`/demo seeds: one demo user per role for QA.

## 5. New components

- `lib/dashboard-views.ts` — role → default view, view registry, `resolveView()`.
- `<ViewSwitcher>` — admin/owner-only segmented control; persists `preferredDashboardView`.
- `<DashboardShell>` — view-aware grid that renders a view's widget set.
- Widget primitives: `<DashWidget>`, `<StatTile>`, `<TimelineList>`, `<EmptyWidget>`.
- View bundles: `<DeveloperView>`, `<AdminOverview>` (existing, refactored),
  `<ClinicianView>`, `<ReceptionistView>`, `<ContractorView>`.
- Feature components: `<RoomAvailabilityBoard>`, `<RoomPrepStatus>`,
  `<TimeClock>`, `<FacilityDocs>`, `<ContractorTaskList>`, `<ArrivalsBoard>`.
- My Day counterparts reuse the same widgets in a day-planner layout.

## 6. Cross-user interactions (new)

- **Prep handoff**: receptionist marks a room `READY` → clinician's view reflects it
  live (poll/SSE, reuse the BLD-138 session channel pattern).
- **Room turnover request**: clinician finishes → requests turnover → reception/cleaner
  notified; room flips to `DIRTY`→`CLEANING`→`READY`.
- **Task assignment**: admin assigns a `ContractorTask` → contractor notified; on
  `DONE`, admin notified.
- **Time tracking visibility**: contractor clock entries roll up into an admin timesheet.
- All interactions emit activity-log entries and respect permission scope.

## 7. Phasing → epics

Ordered for safe, incremental delivery (foundation → shell → views → services →
interactions → QA). Dependencies are wired on the board.

1. **Foundation: roles & view resolution** (new roles, permissions, preferredView, ViewSwitcher).
2. **View-aware dashboard shell & widget registry.**
3. **Clinician view** (appointments, rooms, prep, client info, appointment flow).
4. **Receptionist view** (arrivals, check-in, prep handoff, payments, calls/chat).
5. **Developer view** (build board, deploys, errors, logs).
6. **Contractor view + contractor data model** (tasks, scope).
7. **Room availability & prep-status service** (RoomPrep, shared by 3 & 4).
8. **Time-tracking service** (TimeEntry, clock/breaks/timesheets; used by 6 & lunch break).
9. **Facility knowledge base** (FacilityDoc + viewer, used by 6).
10. **Cross-role interactions & notifications** (handoffs, turnover, assignment).
11. **Lunch-break & per-role day actions wiring** (connects dashboard actions to 8 + schedule).
12. **My Day per-role rebuild** (day-planner counterparts of the views).
13. **QA, permission-leakage hardening, demo seeding & staged rollout** (feature-flagged).

## 8. Risks & safeguards

- **Clinical-data leakage** to non-clinical views → explicit permission gates on every
  widget + a test that asserts FRONT_DESK/CONTRACTOR/DEVELOPER never receive health fields.
- **Enum migration** → additive only; verify `prisma db push` (no `--accept-data-loss`)
  on a Neon branch first; update `ROLE_DEFAULTS` (compile-time enforced).
- **Scope creep** → ship behind a `role_views_enabled` flag; roll out view-by-view.
- **Realtime cost** → reuse the existing kiosk/session SSE+poll pattern, not new infra.
- **Mobile** → verify each view at 360/390px (front-of-house & contractors are on phones).

## 9. Acceptance (project-level)

- Each role logging in lands on its tailored dashboard + My Day.
- Owner/Admin can switch views and the choice persists.
- No view exposes data outside its role's permission set (tested).
- New data (RoomPrep, TimeEntry, ContractorTask, FacilityDoc) persists & is editable.
- Clean at 360/390/desktop; reduced-motion respected; `tsc` + `next build` green.
